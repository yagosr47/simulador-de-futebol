import {
  CalendarEvent,
  Club,
  ClubMilestone,
  Competition,
  GameState,
  LeagueStanding,
  MatchFixture,
  NewsMessage,
  Player,
  SeasonHistoryEntry,
} from '../types/game';
import { addDays, clamp, formatDateBR, isTransferWindowOpen } from './constants';
import { simulateMatchInstant } from './matchEngine';
import { updateChemistryAfterMatch } from './chemistry';
import { evaluateContractAfterMatch } from './contracts';
import { advanceDailyMedicalRecovery, generateInjury } from './infirmary';
import { advanceStadiumConstructions } from './stadium';
import { processMonthlyFinances, recordTransaction } from './economy';
import { calculateMarketValue, processMonthlyDevelopment } from './development';
import { processDailyAuctions } from './auctions';
import { executeCompletedTransfer } from './transfers';
import { runDailyAiClubActions } from './aiClubs';
import { autoSelectBestLineup } from './overall';

/**
 * Gera tabela de pontos corridos turno e returno (Berger algorithm) para N clubes (par)
 */
export function generateLeagueCompetition(
  clubIds: string[],
  season: number,
): Competition {
  const n = clubIds.length;
  const arr = [...clubIds];
  const fixtures: MatchFixture[] = [];
  const totalRoundsFirstHalf = n - 1;

  // Início da Série A em 18 de Janeiro, jogos a cada 6 ou 7 dias até Novembro
  let currentDate = `${season}-01-18`;

  for (let round = 0; round < totalRoundsFirstHalf * 2; round++) {
    const isSecondHalf = round >= totalRoundsFirstHalf;
    const baseRound = isSecondHalf ? round - totalRoundsFirstHalf : round;
    const roundNumber = round + 1;

    // Monta pares da rodada usando rotação de Berger
    const rotated = [arr[0], ...arr.slice(1)];
    for (let s = 0; s < baseRound; s++) {
      const last = rotated.pop()!;
      rotated.splice(1, 0, last);
    }

    for (let i = 0; i < n / 2; i++) {
      const cA = rotated[i];
      const cB = rotated[n - 1 - i];
      const swapHome = isSecondHalf ? i % 2 === 0 : i % 2 === 1;
      const homeClubId = swapHome ? cB : cA;
      const awayClubId = swapHome ? cA : cB;

      fixtures.push({
        id: `lig-${season}-r${roundNumber}-${i}`,
        competitionId: `league-${season}`,
        competitionName: 'Série A Nacional',
        competitionType: 'Liga',
        roundName: `Rodada ${roundNumber}`,
        roundNumber,
        date: currentDate,
        homeClubId,
        awayClubId,
        played: false,
        homeGoals: 0,
        awayGoals: 0,
        importance: roundNumber >= totalRoundsFirstHalf * 2 - 3 ? 9 : 6,
        events: [],
      });
    }

    currentDate = addDays(currentDate, round % 3 === 1 ? 10 : 7);
  }

  const standings: LeagueStanding[] = clubIds.map((clubId) => ({
    clubId,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    points: 0,
  }));

  return {
    id: `league-${season}`,
    name: 'Série A Nacional',
    type: 'Liga',
    season,
    standings,
    fixtures,
    prizeChampion: 24_000_000,
    prizeRunnerUp: 14_000_000,
    prizeParticipation: 4_500_000,
  };
}

export function generateCupCompetition(
  clubIds: string[],
  season: number,
  name: string,
  type: 'Copa' | 'Continental',
  startDate: string,
): Competition {
  // Oitavas de final (16 clubes -> 8 jogos) ou Quartas (8 clubes -> 4 jogos)
  const participants = type === 'Copa' ? [...clubIds] : [...clubIds].slice(0, 8);
  const fixtures: MatchFixture[] = [];
  const roundLabel = participants.length === 16 ? 'Oitavas de Final' : 'Quartas de Final';

  for (let i = 0; i < participants.length; i += 2) {
    fixtures.push({
      id: `${type.toLowerCase()}-${season}-r1-${i / 2}`,
      competitionId: `${type.toLowerCase()}-${season}`,
      competitionName: name,
      competitionType: type,
      roundName: roundLabel,
      roundNumber: 1,
      date: startDate,
      homeClubId: participants[i],
      awayClubId: participants[i + 1],
      played: false,
      homeGoals: 0,
      awayGoals: 0,
      importance: type === 'Continental' ? 8 : 7,
      events: [],
    });
  }

  return {
    id: `${type.toLowerCase()}-${season}`,
    name,
    type,
    season,
    standings: [],
    fixtures,
    prizeChampion: type === 'Continental' ? 28_000_000 : 15_000_000,
    prizeRunnerUp: type === 'Continental' ? 14_000_000 : 7_500_000,
    prizeParticipation: type === 'Continental' ? 5_000_000 : 2_000_000,
  };
}

export function sortStandings(standings: LeagueStanding[]): LeagueStanding[] {
  return [...standings].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.won !== a.won) return b.won - a.won;
    const gdA = a.goalsFor - a.goalsAgainst;
    const gdB = b.goalsFor - b.goalsAgainst;
    if (gdB !== gdA) return gdB - gdA;
    return b.goalsFor - a.goalsFor;
  });
}

export function rebuildCalendarEvents(state: GameState): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const userClub = state.clubs[state.userClubId];
  const season = state.season;

  // 1. Jogos do usuário (futuros e realizados) + Finais
  for (const comp of state.competitions) {
    for (const f of comp.fixtures) {
      const involvesUser = f.homeClubId === state.userClubId || f.awayClubId === state.userClubId;
      const isFinal = f.roundName === 'Final';
      if (!involvesUser && !isFinal) continue;
      const home = state.clubs[f.homeClubId];
      const away = state.clubs[f.awayClubId];
      if (!home || !away) continue;

      events.push({
        id: `cal-match-${f.id}`,
        date: f.date,
        type: isFinal ? 'final' : 'partida',
        title: f.played
          ? `${home.shortName} ${f.homeGoals} x ${f.awayGoals} ${away.shortName}`
          : `${home.shortName} x ${away.shortName}`,
        description: `${comp.name} — ${f.roundName}. ${
          f.played
            ? `Placar final: ${home.name} ${f.homeGoals} x ${f.awayGoals} ${away.name}${
                f.attendance ? ` (Público: ${f.attendance.toLocaleString('pt-BR')})` : ''
              }.`
            : `Local: ${home.stadium.name}. Importância: ${f.importance}/10.`
        }`,
        relatedId: f.id,
        badge: f.played ? 'Realizado' : comp.type,
      });
    }
  }

  // 2. Janelas de transferências
  events.push(
    {
      id: `cal-win-open1-${season}`,
      date: `${season}-01-01`,
      type: 'janela_abertura',
      title: 'Abertura da Janela de Transferências (1º Semestre)',
      description: 'O mercado está aberto para contratações imediatas, vendas e empréstimos até 28/02.',
      badge: 'Mercado',
    },
    {
      id: `cal-win-close1-${season}`,
      date: `${season}-02-28`,
      type: 'janela_fechamento',
      title: 'Fechamento da 1ª Janela de Transferências',
      description: 'Após esta data apenas pré-acordos para a janela seguinte serão permitidos.',
      badge: 'Prazo',
    },
    {
      id: `cal-win-open2-${season}`,
      date: `${season}-07-01`,
      type: 'janela_abertura',
      title: 'Abertura da Janela de Meio de Temporada',
      description: 'Mercado reaberto para reforços até 31/08. Pré-acordos pendentes são efetivados hoje.',
      badge: 'Mercado',
    },
    {
      id: `cal-win-close2-${season}`,
      date: `${season}-08-31`,
      type: 'janela_fechamento',
      title: 'Fechamento da Janela de Meio de Temporada',
      description: 'Último dia para registrar novos atletas na temporada atual.',
      badge: 'Prazo',
    },
  );

  // 3. Períodos de treinamento e recuperação ao longo do mês atual e seguinte
  const [cy, cm] = state.currentDate.split('-').map(Number);
  for (let mOffset = 0; mOffset <= 1; mOffset++) {
    const dt = new Date(Date.UTC(cy, cm - 1 + mOffset, 1));
    const yy = dt.getUTCFullYear();
    const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
    events.push(
      {
        id: `cal-train-${yy}-${mm}-05`,
        date: `${yy}-${mm}-05`,
        type: 'treinamento',
        title: 'Bloco de Treinamento Tático/Técnico',
        description: `Foco planejado: ${userClub.trainingSchedule.collectiveFocus} (${userClub.trainingSchedule.intensity}).`,
        badge: 'Treino',
      },
      {
        id: `cal-rec-${yy}-${mm}-15`,
        date: `${yy}-${mm}-15`,
        type: 'recuperacao',
        title: 'Dia de Recuperação Física & Avaliação Médica',
        description: 'Recomendado para sessões regenerativas e controle de sobrecarga muscular.',
        badge: 'Físico',
      },
      {
        id: `cal-fin-${yy}-${mm}-01`,
        date: `${yy}-${mm}-01`,
        type: 'especial',
        title: 'Fechamento Financeiro Mensal',
        description: 'Pagamento de salários, manutenção do estádio, entrada de patrocínios e evolução de atletas.',
        badge: 'Finanças',
      },
    );
  }

  // 4. Datas de conclusão de obras do estádio
  for (const c of userClub.stadium.activeConstructions) {
    events.push({
      id: `cal-obra-${c.id}`,
      date: c.estimatedEndDate,
      type: 'obra',
      title: `Entrega de Obra: ${c.name}`,
      description: `${c.benefitDescription} (+${c.capacityAdded.toLocaleString('pt-BR')} lugares).`,
      relatedId: c.id,
      badge: 'Estádio',
    });
  }

  // 5. Prazos de leilões ativos
  for (const auc of state.auctions.filter((a) => a.status === 'Ativo')) {
    const p = state.players[auc.playerId];
    if (!p) continue;
    events.push({
      id: `cal-auc-${auc.id}`,
      date: auc.deadlineDate,
      type: 'leilao',
      title: `Encerramento de Leilão: ${p.shortName}`,
      description: `Lance mínimo R$ ${auc.minimumPrice.toLocaleString('pt-BR')} • ${auc.bids.length} lance(s) registrado(s).`,
      relatedId: auc.id,
      badge: 'Leilão',
    });
  }

  // 6. Prazos contratuais de atletas do usuário vencendo em até 12 meses
  for (const p of Object.values(state.players)) {
    if (p.clubId !== state.userClubId) continue;
    if (p.contract.yearsRemaining <= 1) {
      events.push({
        id: `cal-contract-${p.id}`,
        date: p.contract.endDate,
        type: 'contrato',
        title: `Vencimento de Contrato: ${p.shortName}`,
        description: `${p.fullName} (${p.contract.role}) encerra seu vínculo nesta data. Renove antes para evitar perdê-lo.`,
        relatedId: p.id,
        badge: 'Contrato',
      });
    }
  }

  // 7. Evento especial: Gala de Encerramento da Temporada
  events.push({
    id: `cal-gala-${season}`,
    date: `${season}-12-15`,
    type: 'especial',
    title: 'Premiação e Encerramento da Temporada',
    description: 'Distribuição das premiações da Série A, Copas e atualização do histórico do clube.',
    badge: 'Especial',
  });

  return events.sort((a, b) => a.date.localeCompare(b.date));
}

function advanceKnockoutIfRoundCompleted(comp: Competition): {
  comp: Competition;
  championClubId?: string;
  runnerUpClubId?: string;
} {
  if (comp.type === 'Liga') return { comp };
  const maxRound = Math.max(...comp.fixtures.map((f) => f.roundNumber));
  const roundFixtures = comp.fixtures.filter((f) => f.roundNumber === maxRound);
  if (!roundFixtures.every((f) => f.played)) return { comp };

  // Decide vencedores (em caso de empate no mata-mata, desempate por pênaltis favorecendo leve xG/casa)
  const winners: string[] = [];
  const losers: string[] = [];
  for (const f of roundFixtures) {
    if (f.homeGoals > f.awayGoals) {
      winners.push(f.homeClubId);
      losers.push(f.awayClubId);
    } else if (f.awayGoals > f.homeGoals) {
      winners.push(f.awayClubId);
      losers.push(f.homeClubId);
    } else {
      const homeAdv = (f.stats?.homeXG ?? 1) >= (f.stats?.awayXG ?? 1);
      winners.push(homeAdv ? f.homeClubId : f.awayClubId);
      losers.push(homeAdv ? f.awayClubId : f.homeClubId);
    }
  }

  if (winners.length === 1) {
    return {
      comp: { ...comp, championClubId: winners[0] },
      championClubId: winners[0],
      runnerUpClubId: losers[0],
    };
  }

  const nextRoundNumber = maxRound + 1;
  const nextRoundName =
    winners.length === 2 ? 'Final' : winners.length === 4 ? 'Semifinal' : 'Quartas de Final';
  const lastDate = roundFixtures[roundFixtures.length - 1].date;
  const nextDate = addDays(lastDate, 32);

  const nextFixtures: MatchFixture[] = [];
  for (let i = 0; i < winners.length; i += 2) {
    nextFixtures.push({
      id: `${comp.id}-r${nextRoundNumber}-${i / 2}`,
      competitionId: comp.id,
      competitionName: comp.name,
      competitionType: comp.type,
      roundName: nextRoundName,
      roundNumber: nextRoundNumber,
      date: nextDate,
      homeClubId: winners[i],
      awayClubId: winners[i + 1],
      played: false,
      homeGoals: 0,
      awayGoals: 0,
      importance: nextRoundName === 'Final' ? 10 : nextRoundName === 'Semifinal' ? 9 : 8,
      events: [],
    });
  }

  return {
    comp: {
      ...comp,
      fixtures: [...comp.fixtures, ...nextFixtures],
    },
  };
}

/**
 * Aplica todas as consequências de uma partida finalizada nos sistemas interligados:
 * - Classificação e mata-mata
 * - Estatísticas de carreira e temporada dos atletas
 * - Química entre titulares
 * - Fadiga, forma recente, moral, confiança e lesões sofridas na partida
 * - Expectativas contratuais & insatisfação (modificadores temporários!)
 * - Bilheteria e receita do mandante + recorde de público/maior goleada
 */
export function applyCompletedFixtureToState(
  state: GameState,
  completedFixture: MatchFixture,
  newInjuries: { playerId: string; clubId: string; type: string; days: number; severity: 'Leve' | 'Moderada' | 'Grave' | 'Muito Grave' }[] = [],
): GameState {
  let nextClubs = { ...state.clubs };
  let nextPlayers = { ...state.players };
  let nextNews = [...state.news];
  let nextMilestones = [...state.milestones];
  let nextRecords = { ...state.clubRecords };

  const homeClub = nextClubs[completedFixture.homeClubId];
  const awayClub = nextClubs[completedFixture.awayClubId];
  if (!homeClub || !awayClub) return state;

  const homeWon = completedFixture.homeGoals > completedFixture.awayGoals;
  const awayWon = completedFixture.awayGoals > completedFixture.homeGoals;
  const drawn = completedFixture.homeGoals === completedFixture.awayGoals;

  // 1. Atualiza receita de bilheteria e forma recente dos clubes
  const ticketRev = completedFixture.ticketRevenue ?? 0;
  const att = completedFixture.attendance ?? 0;

  let updHome = recordTransaction(
    homeClub,
    completedFixture.date,
    'receita',
    'Bilheteria',
    `Bilheteria — ${homeClub.shortName} x ${awayClub.shortName} (${att.toLocaleString('pt-BR')} pagantes)`,
    ticketRev,
  );
  updHome = {
    ...updHome,
    recentForm: [...updHome.recentForm, homeWon ? 'V' : drawn ? 'E' : 'D'].slice(-5) as ('V' | 'E' | 'D')[],
    popularity: clamp(updHome.popularity + (homeWon ? 0.4 : drawn ? 0 : -0.3), 35, 100),
    stadium: {
      ...updHome.stadium,
      lastAttendance: att,
      lastRevenue: ticketRev,
      recordAttendance: Math.max(updHome.stadium.recordAttendance, att),
    },
  };

  const updAway: Club = {
    ...awayClub,
    recentForm: [...awayClub.recentForm, awayWon ? 'V' : drawn ? 'E' : 'D'].slice(-5) as ('V' | 'E' | 'D')[],
    popularity: clamp(awayClub.popularity + (awayWon ? 0.5 : drawn ? 0.1 : -0.2), 35, 100),
  };

  nextClubs[updHome.id] = updHome;
  nextClubs[updAway.id] = updAway;

  // Recordes do clube do usuário
  if (updHome.id === state.userClubId) {
    if (!nextRecords.highestAttendance || att > nextRecords.highestAttendance.attendance) {
      nextRecords.highestAttendance = {
        attendance: att,
        opponent: awayClub.name,
        date: completedFixture.date,
      };
    }
  }
  if (updHome.id === state.userClubId && homeWon) {
    const margin = completedFixture.homeGoals - completedFixture.awayGoals;
    const prevMargin = nextRecords.biggestWin
      ? Number(nextRecords.biggestWin.score.split('x')[0]) - Number(nextRecords.biggestWin.score.split('x')[1])
      : -1;
    if (margin > prevMargin) {
      nextRecords.biggestWin = {
        score: `${completedFixture.homeGoals}x${completedFixture.awayGoals}`,
        opponent: awayClub.name,
        date: completedFixture.date,
      };
    }
  } else if (updAway.id === state.userClubId && awayWon) {
    const margin = completedFixture.awayGoals - completedFixture.homeGoals;
    const prevMargin = nextRecords.biggestWin
      ? Number(nextRecords.biggestWin.score.split('x')[0]) - Number(nextRecords.biggestWin.score.split('x')[1])
      : -1;
    if (margin > prevMargin) {
      nextRecords.biggestWin = {
        score: `${completedFixture.awayGoals}x${completedFixture.homeGoals}`,
        opponent: homeClub.name,
        date: completedFixture.date,
      };
    }
  }

  // 2. Atualiza estatísticas, fadiga, forma e moral de todos que participaram
  const applyPerfs = (
    perfs: typeof completedFixture.homePerformances,
    club: Club,
    won: boolean,
    isDraw: boolean,
    cleanSheet: boolean,
  ) => {
    if (!perfs) return;
    const playedIds: string[] = [];
    const starterIds = new Set<string>();
    const subInIds = new Set<string>();

    for (const perf of perfs) {
      const p = nextPlayers[perf.playerId];
      if (!p) continue;
      playedIds.push(p.id);
      if (perf.substitutedInMinute === undefined) starterIds.add(p.id);
      else subInIds.add(p.id);

      const newMatches = p.careerStats.matches + 1;
      const prevSum = p.careerStats.averageRating * p.careerStats.matches;
      const newAvg = Number(((prevSum + perf.rating) / newMatches).toFixed(2));
      const fatigueAdded = Math.round((perf.minutesPlayed / 90) * (26 - (p.physical.resistencia - 60) * 0.18));
      const newFatigue = clamp(p.conditional.fadiga + Math.max(8, fatigueAdded), 5, 100);
      const overplayAdd = newFatigue > 72 ? 12 : 4;

      const moralDelta = won ? 5 : isDraw ? 1 : -4;
      const formTarget = clamp(Math.round(perf.rating * 11), 35, 99);
      const newForm = clamp(Math.round(p.conditional.formaRecente * 0.68 + formTarget * 0.32), 25, 99);

      const updatedHistory = p.clubHistory.map((h, idx) =>
        idx === p.clubHistory.length - 1
          ? {
              ...h,
              matches: h.matches + 1,
              goals: h.goals + perf.goals,
              assists: h.assists + perf.assists,
              avgRating: newAvg,
            }
          : h,
      );

      const updatedP: Player = {
        ...p,
        overplayStress: clamp(p.overplayStress + overplayAdd, 0, 100),
        returnToPlaySharpness: clamp(p.returnToPlaySharpness + 12, 0, 100),
        conditional: {
          ...p.conditional,
          fadiga: newFatigue,
          ritmoJogo: clamp(p.conditional.ritmoJogo + 6, 30, 100),
          moral: clamp(p.conditional.moral + moralDelta + (perf.goals > 0 ? 4 : 0), 15, 100),
          confianca: clamp(p.conditional.confianca + (perf.rating >= 7.2 ? 5 : perf.rating < 5.8 ? -4 : 1), 15, 100),
          formaRecente: newForm,
        },
        careerStats: {
          ...p.careerStats,
          matches: newMatches,
          starts: p.careerStats.starts + (perf.substitutedInMinute === undefined ? 1 : 0),
          goals: p.careerStats.goals + perf.goals,
          assists: p.careerStats.assists + perf.assists,
          cleanSheets: p.careerStats.cleanSheets + (cleanSheet && p.primaryPosition === 'GOL' ? 1 : 0),
          yellowCards: p.careerStats.yellowCards + (perf.yellowCard ? 1 : 0),
          redCards: p.careerStats.redCards + (perf.redCard ? 1 : 0),
          minutesPlayed: p.careerStats.minutesPlayed + perf.minutesPlayed,
          averageRating: newAvg,
          seasonMatches: p.careerStats.seasonMatches + 1,
          seasonStarts: p.careerStats.seasonStarts + (perf.substitutedInMinute === undefined ? 1 : 0),
          seasonGoals: p.careerStats.seasonGoals + perf.goals,
          seasonAssists: p.careerStats.seasonAssists + perf.assists,
          seasonYellowCards: p.careerStats.seasonYellowCards + (perf.yellowCard ? 1 : 0),
          seasonRedCards: p.careerStats.seasonRedCards + (perf.redCard ? 1 : 0),
          seasonRatingSum: Number((p.careerStats.seasonRatingSum + perf.rating).toFixed(2)),
          seasonRatingCount: p.careerStats.seasonRatingCount + 1,
        },
        clubHistory: updatedHistory,
      };
      updatedP.marketValue = calculateMarketValue(updatedP);
      nextPlayers[p.id] = updatedP;
    }

    // Atualiza química entre companheiros que atuaram juntos
    nextPlayers = updateChemistryAfterMatch(playedIds, nextPlayers, won, isDraw);

    // Avalia expectativas contratuais & insatisfação para TODO o elenco do clube
    const clubSquad = Object.values(nextPlayers).filter((p) => p.clubId === club.id);
    const contractEval = evaluateContractAfterMatch(clubSquad, starterIds, subInIds, completedFixture.date);
    for (const cp of contractEval.updatedPlayers) {
      nextPlayers[cp.id] = cp;
    }
    if (club.id === state.userClubId && contractEval.complaints.length > 0) {
      nextNews = [...contractEval.complaints, ...nextNews];
    }
  };

  applyPerfs(completedFixture.homePerformances, updHome, homeWon, drawn, completedFixture.awayGoals === 0);
  applyPerfs(completedFixture.awayPerformances, updAway, awayWon, drawn, completedFixture.homeGoals === 0);

  // 3. Registra lesões sofridas na partida
  for (const injInfo of newInjuries) {
    const p = nextPlayers[injInfo.playerId];
    const c = nextClubs[injInfo.clubId];
    if (!p || !c || p.injury) continue;
    const injuryObj = generateInjury(p, 'Partida', completedFixture.date, c.medicalStaff);
    injuryObj.type = injInfo.type;
    injuryObj.totalDays = injInfo.days;
    injuryObj.remainingDays = injInfo.days;
    injuryObj.severity = injInfo.severity;

    nextPlayers[p.id] = {
      ...p,
      injury: injuryObj,
      injuryHistoryCount: p.injuryHistoryCount + 1,
      conditional: { ...p.conditional, moral: clamp(p.conditional.moral - 10, 15, 100) },
    };

    if (c.id === state.userClubId) {
      nextNews.unshift({
        id: `inj-match-${p.id}-${completedFixture.date}`,
        date: completedFixture.date,
        category: 'Médico',
        title: `Lesão na partida: ${p.shortName} vai para a Enfermaria`,
        body: `${p.fullName} sofreu ${injuryObj.type} (${injuryObj.severity}) e tem previsão de ${injuryObj.totalDays} dias de recuperação.`,
        read: false,
        actionPage: 'infirmary',
        severity: 'danger',
      });
    }
  }

  // 4. Atualiza tabela da competição e avança mata-mata
  const nextCompetitions = state.competitions.map((comp) => {
    if (comp.id !== completedFixture.competitionId) return comp;

    const updatedFixtures = comp.fixtures.map((f) =>
      f.id === completedFixture.id ? completedFixture : f,
    );

    let updatedStandings = comp.standings;
    if (comp.type === 'Liga') {
      updatedStandings = comp.standings.map((st) => {
        if (st.clubId === completedFixture.homeClubId) {
          return {
            ...st,
            played: st.played + 1,
            won: st.won + (homeWon ? 1 : 0),
            drawn: st.drawn + (drawn ? 1 : 0),
            lost: st.lost + (awayWon ? 1 : 0),
            goalsFor: st.goalsFor + completedFixture.homeGoals,
            goalsAgainst: st.goalsAgainst + completedFixture.awayGoals,
            points: st.points + (homeWon ? 3 : drawn ? 1 : 0),
          };
        }
        if (st.clubId === completedFixture.awayClubId) {
          return {
            ...st,
            played: st.played + 1,
            won: st.won + (awayWon ? 1 : 0),
            drawn: st.drawn + (drawn ? 1 : 0),
            lost: st.lost + (homeWon ? 1 : 0),
            goalsFor: st.goalsFor + completedFixture.awayGoals,
            goalsAgainst: st.goalsAgainst + completedFixture.homeGoals,
            points: st.points + (awayWon ? 3 : drawn ? 1 : 0),
          };
        }
        return st;
      });
    }

    let nextComp: Competition = {
      ...comp,
      fixtures: updatedFixtures,
      standings: updatedStandings,
    };

    // Verifica campeão da Liga ao encerrar todas as rodadas
    if (comp.type === 'Liga' && updatedFixtures.every((f) => f.played) && !nextComp.championClubId) {
      const sorted = sortStandings(updatedStandings);
      const champId = sorted[0]?.clubId;
      const runnerId = sorted[1]?.clubId;
      nextComp.championClubId = champId;

      if (champId && nextClubs[champId]) {
        let champ = recordTransaction(
          nextClubs[champId],
          completedFixture.date,
          'receita',
          'Premiação',
          `Premiação de Campeão — ${comp.name}`,
          comp.prizeChampion + nextClubs[champId].finances.sponsorship.titleBonus,
        );
        champ = {
          ...champ,
          reputation: clamp(champ.reputation + 2, 40, 99),
          titlesCount: { ...champ.titlesCount, league: champ.titlesCount.league + 1 },
        };
        nextClubs[champId] = champ;
        if (champId === state.userClubId) {
          nextMilestones.unshift({
            id: `title-league-${state.season}`,
            date: completedFixture.date,
            season: state.season,
            title: `Campeão da ${comp.name} ${state.season}!`,
            description: `Campanha histórica coroando o ${champ.name} campeão nacional!`,
            category: 'Título',
          });
        }
      }
      if (runnerId && nextClubs[runnerId]) {
        nextClubs[runnerId] = recordTransaction(
          nextClubs[runnerId],
          completedFixture.date,
          'receita',
          'Premiação',
          `Premiação de Vice-Campeão — ${comp.name}`,
          comp.prizeRunnerUp,
        );
      }
    }

    // Avança mata-mata (Copa / Continental)
    if (comp.type !== 'Liga') {
      const adv = advanceKnockoutIfRoundCompleted(nextComp);
      nextComp = adv.comp;
      if (adv.championClubId && nextClubs[adv.championClubId]) {
        let champ = recordTransaction(
          nextClubs[adv.championClubId],
          completedFixture.date,
          'receita',
          'Premiação',
          `Premiação de Campeão — ${comp.name}`,
          comp.prizeChampion,
        );
        champ = {
          ...champ,
          reputation: clamp(champ.reputation + 2, 40, 99),
          titlesCount: {
            ...champ.titlesCount,
            cup: comp.type === 'Copa' ? champ.titlesCount.cup + 1 : champ.titlesCount.cup,
            continental:
              comp.type === 'Continental' ? champ.titlesCount.continental + 1 : champ.titlesCount.continental,
          },
        };
        nextClubs[adv.championClubId] = champ;

        if (adv.championClubId === state.userClubId) {
          nextMilestones.unshift({
            id: `title-${comp.id}`,
            date: completedFixture.date,
            season: state.season,
            title: `Campeão da ${comp.name} ${state.season}!`,
            description: `O ${champ.name} levantou a taça da ${comp.name}!`,
            category: 'Título',
          });
        }

        nextNews.unshift({
          id: `champ-${comp.id}`,
          date: completedFixture.date,
          category: 'Partida',
          title: `${champ.name} é campeão da ${comp.name}!`,
          body: `Com campanha memorável, o ${champ.name} conquistou o título e recebeu R$ ${comp.prizeChampion.toLocaleString('pt-BR')} em premiação.`,
          read: false,
          actionPage: 'competitions',
          severity: adv.championClubId === state.userClubId ? 'success' : 'info',
        });
      }
      if (adv.runnerUpClubId && nextClubs[adv.runnerUpClubId]) {
        nextClubs[adv.runnerUpClubId] = recordTransaction(
          nextClubs[adv.runnerUpClubId],
          completedFixture.date,
          'receita',
          'Premiação',
          `Premiação de Vice-Campeão — ${comp.name}`,
          comp.prizeRunnerUp,
        );
      }
    }

    return nextComp;
  });

  const nextState: GameState = {
    ...state,
    clubs: nextClubs,
    players: nextPlayers,
    competitions: nextCompetitions,
    news: nextNews.slice(0, 80),
    milestones: nextMilestones.slice(0, 60),
    clubRecords: nextRecords,
  };

  return {
    ...nextState,
    calendarEvents: rebuildCalendarEvents(nextState),
  };
}

function rolloverToNewSeason(state: GameState): GameState {
  const nextSeason = state.season + 1;
  const userClub = state.clubs[state.userClubId];
  const league = state.competitions.find((c) => c.type === 'Liga');
  const cup = state.competitions.find((c) => c.type === 'Copa');
  const cont = state.competitions.find((c) => c.type === 'Continental');

  // Grava histórico da temporada encerrada
  const sortedLeague = league ? sortStandings(league.standings) : [];
  const userPosIdx = sortedLeague.findIndex((s) => s.clubId === state.userClubId);
  const userStanding = sortedLeague[userPosIdx];
  const champLeague = sortedLeague[0] ? state.clubs[sortedLeague[0].clubId]?.name ?? '-' : '-';

  const userPlayers = Object.values(state.players).filter((p) => p.clubId === state.userClubId);
  const topScorer = [...userPlayers].sort((a, b) => b.careerStats.seasonGoals - a.careerStats.seasonGoals)[0];

  const totalRev = userClub.finances.transactions
    .filter((t) => t.type === 'receita')
    .reduce((a, t) => a + t.amount, 0);

  const seasonEntry: SeasonHistoryEntry = {
    season: state.season,
    leaguePosition: userPosIdx >= 0 ? userPosIdx + 1 : 0,
    leaguePoints: userStanding?.points ?? 0,
    won: userStanding?.won ?? 0,
    drawn: userStanding?.drawn ?? 0,
    lost: userStanding?.lost ?? 0,
    goalsFor: userStanding?.goalsFor ?? 0,
    goalsAgainst: userStanding?.goalsAgainst ?? 0,
    cupResult: cup?.championClubId === state.userClubId ? 'Campeão' : 'Participante',
    continentalResult: cont?.championClubId === state.userClubId ? 'Campeão' : 'Participante',
    topScorerName: topScorer ? topScorer.shortName : '-',
    topScorerGoals: topScorer?.careerStats.seasonGoals ?? 0,
    totalRevenue: totalRev,
    championLeagueName: champLeague,
  };

  // Envelhece jogadores em +1 ano, reduz contrato, zera estatísticas da temporada, retorna empréstimos
  const nextPlayers: Record<string, Player> = {};
  for (const p of Object.values(state.players)) {
    const returnClubId = p.loanedFromClubId ?? p.clubId;
    const nextYears = Math.max(1, p.contract.yearsRemaining - 1);
    const aged: Player = {
      ...p,
      age: p.age + 1,
      clubId: returnClubId,
      loanedFromClubId: undefined,
      loanEndDate: undefined,
      conditional: {
        ...p.conditional,
        fadiga: 10,
        condicionamento: 84,
      },
      contract: {
        ...p.contract,
        yearsRemaining: nextYears,
      },
      careerStats: {
        ...p.careerStats,
        seasonMatches: 0,
        seasonStarts: 0,
        seasonGoals: 0,
        seasonAssists: 0,
        seasonYellowCards: 0,
        seasonRedCards: 0,
        seasonRatingSum: 0,
        seasonRatingCount: 0,
      },
    };
    aged.marketValue = calculateMarketValue(aged);
    nextPlayers[aged.id] = aged;
  }

  // Gera novas competições da nova temporada
  const clubIds = Object.keys(state.clubs);
  const top8Ids =
    sortedLeague.length >= 8 ? sortedLeague.slice(0, 8).map((s) => s.clubId) : clubIds.slice(0, 8);

  const newLeague = generateLeagueCompetition(clubIds, nextSeason);
  const newCup = generateCupCompetition(clubIds, nextSeason, 'Copa Nacional', 'Copa', `${nextSeason}-03-12`);
  const newCont = generateCupCompetition(top8Ids, nextSeason, 'Copa Continental', 'Continental', `${nextSeason}-04-16`);

  // Atualiza clubes para nova temporada
  const nextClubs: Record<string, Club> = {};
  for (const c of Object.values(state.clubs)) {
    const sq = Object.values(nextPlayers).filter((p) => p.clubId === c.id);
    const auto = autoSelectBestLineup(c, sq);
    nextClubs[c.id] = {
      ...c,
      recentForm: [],
      tactics: {
        ...c.tactics,
        startingXI: c.isUserClub ? c.tactics.startingXI.filter((id) => nextPlayers[id]?.clubId === c.id) : auto.startingXI,
        bench: c.isUserClub ? c.tactics.bench.filter((id) => nextPlayers[id]?.clubId === c.id) : auto.bench,
      },
    };
    if (nextClubs[c.id].tactics.startingXI.length < 11) {
      nextClubs[c.id].tactics.startingXI = auto.startingXI;
      nextClubs[c.id].tactics.bench = auto.bench;
    }
  }

  const newSeasonNews: NewsMessage = {
    id: `new-season-${nextSeason}`,
    date: `${nextSeason}-01-01`,
    category: 'Partida',
    title: `Bem-vindo à Temporada ${nextSeason}!`,
    body: `O calendário da Série A Nacional, Copa Nacional e Copa Continental foi sorteado e a janela de transferências está aberta!`,
    read: false,
    actionPage: 'calendar',
    severity: 'success',
  };

  const nextState: GameState = {
    ...state,
    season: nextSeason,
    currentDate: `${nextSeason}-01-01`,
    clubs: nextClubs,
    players: nextPlayers,
    competitions: [newLeague, newCup, newCont],
    seasonHistory: [seasonEntry, ...state.seasonHistory],
    news: [newSeasonNews, ...state.news].slice(0, 80),
  };

  return {
    ...nextState,
    calendarEvents: rebuildCalendarEvents(nextState),
  };
}

/**
 * Avança o simulador em exatamente 1 dia, disparando todos os sistemas interligados!
 */
export function advanceOneDay(
  state: GameState,
  rng: () => number = Math.random,
): { state: GameState; userMatchToday: MatchFixture | null } {
  const nextDate = addDays(state.currentDate, 1);
  const [nextYear, nextMonth, nextDay] = nextDate.split('-').map(Number);

  // Virada de temporada (1º de Janeiro do ano seguinte)
  if (nextYear > state.season) {
    const rolled = rolloverToNewSeason(state);
    return { state: rolled, userMatchToday: null };
  }

  let nextState: GameState = {
    ...state,
    currentDate: nextDate,
  };

  // 1. Recuperação médica diária & dias no clube para química
  const updatedPlayers: Record<string, Player> = { ...nextState.players };
  const recoveredUserNames: string[] = [];

  for (const p of Object.values(updatedPlayers)) {
    const club = nextState.clubs[p.clubId];
    const med = advanceDailyMedicalRecovery(p, club?.medicalStaff ?? []);
    const nextP: Player = {
      ...med.player,
      chemistry: {
        ...med.player.chemistry,
        daysAtClub: med.player.chemistry.daysAtClub + 1,
      },
    };
    updatedPlayers[p.id] = nextP;
    if (med.recoveredToday && p.clubId === nextState.userClubId) {
      recoveredUserNames.push(p.shortName);
    }
  }
  nextState.players = updatedPlayers;

  if (recoveredUserNames.length > 0) {
    const recNews: NewsMessage = {
      id: `med-rec-${nextDate}`,
      date: nextDate,
      category: 'Médico',
      title: `Alta médica: ${recoveredUserNames.join(', ')}`,
      body: `${recoveredUserNames.join(', ')} recebeu alta do departamento médico e iniciou transição gradual de condicionamento para voltar aos jogos.`,
      read: false,
      actionPage: 'infirmary',
      severity: 'success',
    };
    nextState.news = [recNews, ...nextState.news].slice(0, 80);
  }

  // 2. Avanço de obras do estádio (para todos os clubes)
  const nextClubs = { ...nextState.clubs };
  for (const club of Object.values(nextClubs)) {
    if (club.stadium.activeConstructions.length > 0) {
      const adv = advanceStadiumConstructions(club.stadium);
      nextClubs[club.id] = { ...club, stadium: adv.stadium };
      if (club.id === nextState.userClubId && adv.completed.length > 0) {
        for (const comp of adv.completed) {
          const obraNews: NewsMessage = {
            id: `obra-done-${comp.id}`,
            date: nextDate,
            category: 'Estádio',
            title: `Obra concluída: ${comp.name}!`,
            body: `A expansão no ${adv.stadium.name} foi inaugurada! Nova capacidade: ${adv.stadium.capacity.toLocaleString('pt-BR')} lugares.`,
            read: false,
            actionPage: 'stadium',
            severity: 'success',
          };
          const obraMs: ClubMilestone = {
            id: `ms-obra-${comp.id}`,
            date: nextDate,
            season: nextState.season,
            title: `Inauguração: ${comp.name}`,
            description: `${adv.stadium.name} ampliado para ${adv.stadium.capacity.toLocaleString('pt-BR')} lugares.`,
            category: 'Estádio',
          };
          nextState.news = [obraNews, ...nextState.news].slice(0, 80);
          nextState.milestones = [obraMs, ...nextState.milestones].slice(0, 60);
        }
      }
    }
  }
  nextState.clubs = nextClubs;

  // 3. Efetiva pré-acordos pendentes quando a janela abre
  const win = isTransferWindowOpen(nextDate);
  if (win.open && nextState.pendingFutureTransfers.length > 0) {
    const remaining: typeof nextState.pendingFutureTransfers = [];
    for (const ft of nextState.pendingFutureTransfers) {
      if (nextDate >= ft.effectiveDate) {
        nextState = executeCompletedTransfer(nextState, {
          playerId: ft.playerId,
          buyerClubId: ft.toClubId,
          sellerClubId: ft.fromClubId,
          fee: ft.fee,
          salary: ft.salary,
          contractYears: ft.contractYears,
          role: ft.role,
        });
      } else {
        remaining.push(ft);
      }
    }
    nextState = { ...nextState, pendingFutureTransfers: remaining };
  }

  // 4. Fechamento financeiro mensal & desenvolvimento mensal (todo dia 1º)
  if (nextDay === 1) {
    const finClubs = { ...nextState.clubs };
    const devPlayers = { ...nextState.players };

    for (const club of Object.values(finClubs)) {
      const clubPlayers = Object.values(devPlayers).filter((p) => p.clubId === club.id);
      finClubs[club.id] = processMonthlyFinances(club, clubPlayers, nextDate);

      for (const p of clubPlayers) {
        const res = processMonthlyDevelopment(p, club.coaches, club.stadium.infrastructureLevel, rng);
        devPlayers[p.id] = res.player;
      }
    }

    const monthlyNews: NewsMessage = {
      id: `fin-monthly-${nextDate}`,
      date: nextDate,
      category: 'Finanças',
      title: `Relatório Mensal (${formatDateBR(nextDate)})`,
      body: `Folha salarial, patrocínios, manutenção do estádio e avaliação de desenvolvimento mensal do elenco foram processados.`,
      read: false,
      actionPage: 'finances',
      severity: 'info',
    };
    nextState = {
      ...nextState,
      clubs: finClubs,
      players: devPlayers,
      news: [monthlyNews, ...nextState.news].slice(0, 80),
    };
  }

  // 5. Leilões diários (lances da IA e encerramentos)
  nextState = processDailyAuctions(nextState, rng);

  // 6. Decisões dos clubes IA
  nextState = runDailyAiClubActions(nextState, rng);

  // 7. Partidas agendadas para hoje: simula jogos dos clubes IA automaticamente e detecta jogo do usuário!
  let userMatchToday: MatchFixture | null = null;
  const aiFixturesToday: MatchFixture[] = [];

  for (const comp of nextState.competitions) {
    for (const f of comp.fixtures) {
      if (f.played || f.date !== nextDate) continue;
      if (f.homeClubId === nextState.userClubId || f.awayClubId === nextState.userClubId) {
        userMatchToday = f;
      } else {
        aiFixturesToday.push(f);
      }
    }
  }

  for (const aiFix of aiFixturesToday) {
    const hc = nextState.clubs[aiFix.homeClubId];
    const ac = nextState.clubs[aiFix.awayClubId];
    if (!hc || !ac) continue;
    const { fixture: doneFix, session } = simulateMatchInstant(aiFix, hc, ac, nextState.players, nextDate, rng);
    nextState = applyCompletedFixtureToState(nextState, doneFix, session.newInjuries);
  }

  // Aviso de jogo do usuário hoje
  if (userMatchToday) {
    const hc = nextState.clubs[userMatchToday.homeClubId];
    const ac = nextState.clubs[userMatchToday.awayClubId];
    const matchdayNews: NewsMessage = {
      id: `matchday-${userMatchToday.id}`,
      date: nextDate,
      category: 'Partida',
      title: `Dia de Jogo: ${hc?.shortName} x ${ac?.shortName}!`,
      body: `${userMatchToday.competitionName} (${userMatchToday.roundName}). Vá para a central de Partidas para escalar, acompanhar ao vivo ou simular.`,
      read: false,
      actionPage: 'matches',
      severity: 'success',
    };
    nextState = {
      ...nextState,
      activeMatchId: userMatchToday.id,
      news: [matchdayNews, ...nextState.news].slice(0, 80),
    };
  }

  nextState = {
    ...nextState,
    calendarEvents: rebuildCalendarEvents(nextState),
  };

  return { state: nextState, userMatchToday };
}
