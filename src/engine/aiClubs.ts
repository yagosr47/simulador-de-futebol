import { Club, ClubMilestone, GameState, NewsMessage, Player, PlayStyle, Position } from '../types/game';
import { addDays, clamp, isTransferWindowOpen, NATIONALITY_LANGUAGES, POSITIONS, ROLE_EXPECTED_START_RATIO } from './constants';
import { autoSelectBestLineup, calculateBaseOverall } from './overall';
import { calculateFairMonthlySalary, calculateMarketValue } from './development';
import { executeCompletedTransfer, generateIncomingTransferOffer } from './transfers';

const AI_MANAGER_NAMES = [
  'Eduardo Baptista',
  'Marcelo Fernandes',
  'Thiago Carpini',
  'Fábio Carille',
  'Odair Hellmann',
  'Antônio Oliveira',
  'Luis Zubeldía',
  'Gabriel Milito',
  'Pedro Caixinha',
  'Paulo Pezzolano',
  'Juan Pablo Vojvoda',
  'Cuca Silva',
  'Renato Gaúcho',
  'Fernando Diniz',
  'Artur Jorge',
  'Rafael Paiva',
];

const YOUTH_FIRST_NAMES = [
  'Lucas', 'Gabriel', 'Matheus', 'Enzo', 'Kauã', 'Vitor', 'Pedro', 'João', 'Rafael', 'Caio',
  'Yuri', 'Davi', 'Bernardo', 'Arthur', 'Heitor', 'Murilo', 'Guilherme', 'Igor', 'Ruan', 'Breno',
];
const YOUTH_LAST_NAMES = [
  'Silva', 'Santos', 'Oliveira', 'Souza', 'Pereira', 'Costa', 'Rodrigues', 'Almeida', 'Nascimento',
  'Lima', 'Araújo', 'Fernandes', 'Carvalho', 'Gomes', 'Martins', 'Rocha', 'Ribeiro', 'Mendes', 'Teixeira', 'Freitas',
];

export function createYouthProspect(
  club: Club,
  currentDate: string,
  season: number,
  rng: () => number = Math.random,
): Player {
  const first = YOUTH_FIRST_NAMES[Math.floor(rng() * YOUTH_FIRST_NAMES.length)];
  const last = YOUTH_LAST_NAMES[Math.floor(rng() * YOUTH_LAST_NAMES.length)];
  const pos: Position = POSITIONS[Math.floor(rng() * POSITIONS.length)];
  const baseAttr = clamp(Math.round(54 + (club.stadium.infrastructureLevel * 2.5) + rng() * 14), 52, 74);
  const potential = clamp(Math.round(baseAttr + 10 + rng() * 18), baseAttr + 5, 93);
  const randAttr = (boost = 0) => clamp(Math.round(baseAttr + boost + (rng() * 14 - 7)), 32, 86);

  const isGK = pos === 'GOL';
  const isDef = pos === 'ZAG' || pos === 'LD' || pos === 'LE';
  const isAtt = pos === 'ATA' || pos === 'PD' || pos === 'PE';

  const id = `youth-${club.id}-${season}-${Math.floor(rng() * 999999)}`;
  const styles: PlayStyle[] = ['Posse de Bola', 'Contra-Ataque', 'Pressão Alta', 'Jogo Direto', 'Tático Equilibrado'];

  const player: Player = {
    id,
    fullName: `${first} ${last}`,
    shortName: `${first} ${last[0]}.`,
    age: 17 + Math.floor(rng() * 3),
    nationality: 'Brasil',
    language: NATIONALITY_LANGUAGES['Brasil'],
    primaryPosition: pos,
    heightCm: isGK ? 188 + Math.floor(rng() * 8) : 170 + Math.floor(rng() * 18),
    weightKg: 66 + Math.floor(rng() * 16),
    dominantFoot: rng() < 0.72 ? 'Direito' : rng() < 0.92 ? 'Esquerdo' : 'Ambidestro',
    potential,
    peakAge: 25 + Math.floor(rng() * 5),
    marketValue: 900_000,
    personality: rng() < 0.4 ? 'Ambicioso' : rng() < 0.75 ? 'Profissional' : 'Resiliente',
    clubId: club.id,
    isTransferListed: false,
    isLoanListed: false,
    technical: {
      finalizacao: randAttr(isAtt ? 10 : isGK ? -25 : -4),
      passeCurto: randAttr(pos === 'MC' || pos === 'MEI' ? 8 : 0),
      passeLongo: randAttr(pos === 'MC' || pos === 'VOL' ? 6 : -3),
      cruzamento: randAttr(pos === 'LD' || pos === 'LE' || pos === 'PD' || pos === 'PE' ? 9 : -4),
      drible: randAttr(isAtt || pos === 'MEI' ? 8 : isGK ? -20 : -3),
      controleBola: randAttr(isGK ? -16 : 4),
      marcacao: randAttr(isDef || pos === 'VOL' ? 10 : -12),
      desarme: randAttr(isDef || pos === 'VOL' ? 10 : -12),
      cabeceio: randAttr(pos === 'ZAG' || pos === 'ATA' ? 8 : -4),
      posicionamento: randAttr(4),
      tecnica: randAttr(isGK ? -14 : 3),
      bolaParada: randAttr(-2),
      reflexos: isGK ? randAttr(14) : randAttr(-30),
      defesaGoleiro: isGK ? randAttr(13) : randAttr(-32),
      jogoAereo: isGK ? randAttr(11) : randAttr(-28),
    },
    physical: {
      velocidade: randAttr(isAtt || pos === 'LD' || pos === 'LE' ? 9 : 0),
      aceleracao: randAttr(isAtt ? 9 : 1),
      forca: randAttr(pos === 'ZAG' || pos === 'ATA' ? 6 : -4),
      resistencia: randAttr(5),
      agilidade: randAttr(5),
      equilibrio: randAttr(2),
      impulsao: randAttr(pos === 'ZAG' || isGK ? 7 : 0),
    },
    mental: {
      inteligenciaTatica: randAttr(0),
      visaoJogo: randAttr(pos === 'MC' || pos === 'MEI' ? 8 : -2),
      concentracao: randAttr(0),
      decisao: randAttr(0),
      determinacao: clamp(randAttr(10), 55, 92),
      lideranca: randAttr(-8),
      trabalhoEquipe: randAttr(4),
      antecipacao: randAttr(isDef ? 6 : 0),
      compostura: randAttr(-2),
    },
    conditional: {
      condicionamento: 84,
      fadiga: 10,
      ritmoJogo: 64,
      moral: 80,
      confianca: 76,
      formaRecente: 70,
    },
    contract: {
      salary: 25_000,
      yearsRemaining: 4,
      endDate: addDays(currentDate, 4 * 365),
      role: 'Jovem promessa',
      releaseClause: 6_000_000,
      expectedStartRatio: ROLE_EXPECTED_START_RATIO['Jovem promessa'],
      recentTeamMatchesConsidered: 0,
      recentPlayerStarts: 0,
      recentPlayerAppearances: 0,
      dissatisfaction: 'Satisfeito',
      dissatisfactionPoints: 0,
      requestedTransfer: false,
      requestedRenegotiation: false,
    },
    chemistry: {
      tacticalFamiliarity: 66,
      playStyle: styles[Math.floor(rng() * styles.length)],
      daysAtClub: 180,
      matchesWithTeammates: {},
      relationships: {},
    },
    careerStats: {
      matches: 0,
      starts: 0,
      goals: 0,
      assists: 0,
      cleanSheets: 0,
      yellowCards: 0,
      redCards: 0,
      minutesPlayed: 0,
      averageRating: 0,
      seasonMatches: 0,
      seasonStarts: 0,
      seasonGoals: 0,
      seasonAssists: 0,
      seasonYellowCards: 0,
      seasonRedCards: 0,
      seasonRatingSum: 0,
      seasonRatingCount: 0,
    },
    clubHistory: [
      {
        clubId: club.id,
        clubName: club.name,
        seasonStart: season,
        matches: 0,
        goals: 0,
        assists: 0,
        avgRating: 0,
      },
    ],
    injury: null,
    injuryProne: 4 + Math.floor(rng() * 10),
    injuryHistoryCount: 0,
    overplayStress: 0,
    developmentProgress: 15,
    returnToPlaySharpness: 100,
  };

  player.marketValue = calculateMarketValue(player);
  player.contract.salary = Math.min(45_000, calculateFairMonthlySalary(player));
  player.contract.releaseClause = Math.round(player.marketValue * 2.4);
  return player;
}

/**
 * Executa decisões periódicas dos clubes controlados pela IA:
 * - Contratações e vendas entre clubes IA durante janelas abertas
 * - Propostas de compra/empréstimo para atletas do usuário
 * - Renovação de contratos em expiração
 * - Promoção de jovens da base
 * - Demissão e contratação de técnicos por resultados ruins
 */
export function runDailyAiClubActions(
  state: GameState,
  rng: () => number = Math.random,
): GameState {
  let nextState = state;
  const win = isTransferWindowOpen(nextState.currentDate);
  const aiClubs = Object.values(nextState.clubs).filter((c) => !c.isUserClub);

  // 1. Propostas para jogadores do usuário (durante janela aberta)
  if (win.open && rng() < 0.16) {
    const incoming = generateIncomingTransferOffer(nextState, rng);
    if (incoming) {
      const buyer = nextState.clubs[incoming.fromClubId];
      const player = nextState.players[incoming.playerId];
      if (buyer && player) {
        const msg: NewsMessage = {
          id: `inc-offer-${incoming.id}`,
          date: nextState.currentDate,
          category: 'Mercado',
          title: `Proposta de ${incoming.type} por ${player.shortName}!`,
          body: `O ${buyer.name} enviou uma proposta oficial de R$ ${incoming.fee.toLocaleString('pt-BR')} por ${player.fullName}. Acesse Transferências para aceitar, recusar ou enviar contraproposta.`,
          read: false,
          actionPage: 'transfers',
          severity: 'info',
        };
        nextState = {
          ...nextState,
          transferOffers: [incoming, ...nextState.transferOffers].slice(0, 40),
          news: [msg, ...nextState.news].slice(0, 80),
        };
      }
    }
  }

  // 2. Transferências entre clubes IA durante a janela
  if (win.open && rng() < 0.22) {
    const buyer = aiClubs[Math.floor(rng() * aiClubs.length)];
    if (buyer && buyer.finances.transferBudget > 2_500_000) {
      const candidates = Object.values(nextState.players).filter(
        (p) =>
          p.clubId !== buyer.id &&
          p.clubId !== nextState.userClubId &&
          !p.injury &&
          p.marketValue <= buyer.finances.transferBudget * 0.72 &&
          (buyer.philosophy === 'Base e Jovens'
            ? p.age <= 22 && p.potential >= 78
            : buyer.philosophy === 'Galácticos'
              ? calculateBaseOverall(p) >= 77
              : calculateBaseOverall(p) >= buyer.reputation - 8),
      );
      if (candidates.length > 0) {
        const picked = candidates[Math.floor(rng() * candidates.length)];
        const sellerSquadCount = Object.values(nextState.players).filter((p) => p.clubId === picked.clubId).length;
        if (sellerSquadCount >= 18) {
          const fee = Math.round((picked.marketValue * (0.95 + rng() * 0.22)) / 50_000) * 50_000;
          if (fee <= buyer.finances.transferBudget) {
            nextState = executeCompletedTransfer(nextState, {
              playerId: picked.id,
              buyerClubId: buyer.id,
              sellerClubId: picked.clubId,
              fee,
              salary: Math.round((calculateFairMonthlySalary(picked) * 1.1) / 5_000) * 5_000,
              contractYears: 3,
              role: calculateBaseOverall(picked) >= buyer.reputation - 2 ? 'Titular fixo' : 'Titular rotativo',
            });
          }
        }
      }
    }
  }

  // 3. Renovação automática de contratos de clubes IA (no dia 10 de cada mês)
  const dayOfMonth = Number(nextState.currentDate.split('-')[2]);
  if (dayOfMonth === 10) {
    const updatedPlayers = { ...nextState.players };
    for (const p of Object.values(updatedPlayers)) {
      if (p.clubId === nextState.userClubId) continue;
      if (p.contract.yearsRemaining <= 1 && calculateBaseOverall(p) >= 68 && p.age <= 34) {
        updatedPlayers[p.id] = {
          ...p,
          contract: {
            ...p.contract,
            yearsRemaining: 3,
            endDate: addDays(nextState.currentDate, 3 * 365),
            salary: Math.round((calculateFairMonthlySalary(p) * 1.05) / 5_000) * 5_000,
            dissatisfaction: 'Satisfeito',
            dissatisfactionPoints: 0,
          },
        };
      }
    }
    nextState = { ...nextState, players: updatedPlayers };
  }

  // 4. Promoção de jovens da base em clubes IA (dia 18, chance moderada)
  if (dayOfMonth === 18 && rng() < 0.45) {
    const club = aiClubs[Math.floor(rng() * aiClubs.length)];
    if (club) {
      const squadCount = Object.values(nextState.players).filter((p) => p.clubId === club.id).length;
      if (squadCount < 25) {
        const prospect = createYouthProspect(club, nextState.currentDate, nextState.season, rng);
        const youthNews: NewsMessage = {
          id: `ai-youth-${prospect.id}`,
          date: nextState.currentDate,
          category: 'Clubes IA',
          title: `${club.shortName} promove promessa da base`,
          body: `O ${club.name} integrou o jovem ${prospect.fullName} (${prospect.age} anos, ${prospect.primaryPosition}, potencial ${prospect.potential}) ao elenco profissional.`,
          read: false,
          severity: 'info',
        };
        nextState = {
          ...nextState,
          players: { ...nextState.players, [prospect.id]: prospect },
          news: [youthNews, ...nextState.news].slice(0, 80),
        };
      }
    }
  }

  // 5. Avaliação de treinadores dos clubes IA (dia 25) — demissão por má fase
  if (dayOfMonth === 25) {
    const league = nextState.competitions.find((c) => c.type === 'Liga');
    if (league) {
      const sorted = [...league.standings].sort(
        (a, b) => b.points - a.points || b.goalsFor - b.goalsAgainst - (a.goalsFor - a.goalsAgainst),
      );

      for (let posIdx = 0; posIdx < sorted.length; posIdx++) {
        const st = sorted[posIdx];
        const club = nextState.clubs[st.clubId];
        if (!club || club.isUserClub || st.played < 6) continue;

        const expectedMaxPos = club.reputation >= 82 ? 5 : club.reputation >= 74 ? 9 : 13;
        const recentLosses = club.recentForm.filter((r) => r === 'D').length;

        if (posIdx + 1 > expectedMaxPos + 2 && recentLosses >= 3 && rng() < 0.45) {
          const oldManager = club.managerName;
          const newManager =
            AI_MANAGER_NAMES.find((n) => n !== oldManager) ?? 'Rogério Micale';

          const squad = Object.values(nextState.players).filter((p) => p.clubId === club.id);
          const refreshedLineup = autoSelectBestLineup(club, squad);

          const sackMilestone: ClubMilestone = {
            id: `sack-${club.id}-${nextState.currentDate}`,
            date: nextState.currentDate,
            season: nextState.season,
            title: `Troca de técnico no ${club.shortName}`,
            description: `${club.name} demitiu ${oldManager} após má fase (${posIdx + 1}º lugar) e contratou ${newManager}.`,
            category: 'Técnico',
          };
          const sackNews: NewsMessage = {
            id: `news-sack-${club.id}-${nextState.currentDate}`,
            date: nextState.currentDate,
            category: 'Clubes IA',
            title: `Caiu! ${club.name} demite ${oldManager}`,
            body: `Após sequência negativa e ocupando a ${posIdx + 1}ª colocação na liga, o ${club.name} anunciou ${newManager} como novo comandante.`,
            read: false,
            actionPage: 'competitions',
            severity: 'warning',
          };

          nextState = {
            ...nextState,
            clubs: {
              ...nextState.clubs,
              [club.id]: {
                ...club,
                managerName: newManager,
                managerConfidence: 78,
                tactics: {
                  ...club.tactics,
                  startingXI: refreshedLineup.startingXI,
                  bench: refreshedLineup.bench,
                },
              },
            },
            milestones: [sackMilestone, ...nextState.milestones].slice(0, 60),
            news: [sackNews, ...nextState.news].slice(0, 80),
          };
          break; // no máximo 1 demissão por mês
        }
      }
    }
  }

  return nextState;
}
