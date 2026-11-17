import {
  Club,
  MatchEvent,
  MatchFixture,
  MatchPlayerPerformance,
  MatchStats,
  Player,
  TacticalMentality,
  TacticalSetup,
} from '../types/game';
import { clamp, FORMATIONS, POSITION_GROUPS } from './constants';
import {
  autoSelectBestLineup,
  calculateEffectiveOverall,
  calculateTeamStrength,
  getEffectiveMental,
  getEffectivePhysical,
  getEffectiveTechnical,
} from './overall';
import { calculateSquadChemistry } from './chemistry';
import { calculateMatchdayBoxOffice } from './stadium';
import { computeInjuryRiskForPlayer, generateInjury } from './infirmary';

export interface LiveTeamState {
  clubId: string;
  clubName: string;
  shortName: string;
  tactics: TacticalSetup;
  onPitchIds: string[]; // 11 slots (ou menos se expulso — null/vazio representado por '')
  benchIds: string[];
  subsUsed: number;
  stamina: Record<string, number>; // playerId -> 0..100 durante a partida
  ratings: Record<string, number>; // playerId -> 4.0..10.0
  goals: Record<string, number>;
  assists: Record<string, number>;
  saves: Record<string, number>;
  yellowCards: Set<string>;
  redCards: Set<string>;
  injuredIds: Set<string>;
  subbedInMinute: Record<string, number>;
  subbedOutMinute: Record<string, number>;
  initialStarters: string[];
}

export interface LiveMatchSession {
  fixtureId: string;
  minute: number;
  finished: boolean;
  halfTimeReached: boolean;
  homeGoals: number;
  awayGoals: number;
  attendance: number;
  ticketRevenue: number;
  homeAtmosphereBonus: number;
  weather: 'Ensolarado' | 'Noite Limpa' | 'Chuva Leve' | 'Nublado';
  home: LiveTeamState;
  away: LiveTeamState;
  stats: MatchStats;
  events: MatchEvent[];
  momentum: number; // -100 (away) a +100 (home)
  usedTemplates: Set<string>;
  newInjuries: { playerId: string; clubId: string; type: string; days: number; severity: 'Leve' | 'Moderada' | 'Grave' | 'Muito Grave' }[];
}

function pickUniqueTemplate(templates: string[], used: Set<string>, keyPrefix: string, rng: () => number): string {
  const unused = templates.filter((_, idx) => !used.has(`${keyPrefix}-${idx}`));
  const pool = unused.length > 0 ? unused : templates;
  if (unused.length === 0) {
    // Limpa somente o grupo se todos foram usados
    templates.forEach((_, idx) => used.delete(`${keyPrefix}-${idx}`));
  }
  const chosen = pool[Math.floor(rng() * pool.length)];
  const origIdx = templates.indexOf(chosen);
  used.add(`${keyPrefix}-${origIdx}`);
  return chosen;
}

function getActivePlayers(team: LiveTeamState, players: Record<string, Player>): Player[] {
  return team.onPitchIds
    .filter((id) => id && !team.redCards.has(id) && !team.injuredIds.has(id))
    .map((id) => players[id])
    .filter((p): p is Player => Boolean(p));
}

function pickWeightedPlayer(
  candidates: Player[],
  weightFn: (p: Player) => number,
  rng: () => number,
): Player | undefined {
  if (candidates.length === 0) return undefined;
  const weights = candidates.map((p) => Math.max(1, weightFn(p)));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i];
    if (r <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

function getGoalkeeper(team: LiveTeamState, players: Record<string, Player>): Player | undefined {
  const active = getActivePlayers(team, players);
  return active.find((p) => p.primaryPosition === 'GOL') ?? active[0];
}

function prepareValidLineup(club: Club, players: Record<string, Player>): { xi: string[]; bench: string[] } {
  const clubPlayers = Object.values(players).filter((p) => p.clubId === club.id);
  const validXI = club.tactics.startingXI.filter((id) => {
    const p = players[id];
    return p && p.clubId === club.id && !p.injury;
  });
  if (validXI.length === 11) {
    const used = new Set(validXI);
    const validBench = club.tactics.bench.filter((id) => {
      const p = players[id];
      return p && p.clubId === club.id && !p.injury && !used.has(id);
    });
    return { xi: validXI, bench: validBench };
  }
  const auto = autoSelectBestLineup(club, clubPlayers);
  return { xi: auto.startingXI, bench: auto.bench };
}

export function createLiveMatchSession(
  fixture: MatchFixture,
  homeClub: Club,
  awayClub: Club,
  players: Record<string, Player>,
  rng: () => number = Math.random,
): LiveMatchSession {
  const homeLineup = prepareValidLineup(homeClub, players);
  const awayLineup = prepareValidLineup(awayClub, players);

  const boxOffice = calculateMatchdayBoxOffice(homeClub, awayClub, fixture.importance);

  const initTeam = (club: Club, lineup: { xi: string[]; bench: string[] }): LiveTeamState => {
    const stamina: Record<string, number> = {};
    const ratings: Record<string, number> = {};
    for (const id of [...lineup.xi, ...lineup.bench]) {
      const p = players[id];
      if (!p) continue;
      stamina[id] = clamp(Math.round(100 - p.conditional.fadiga * 0.65), 35, 100);
      ratings[id] = 6.3;
    }
    return {
      clubId: club.id,
      clubName: club.name,
      shortName: club.shortName,
      tactics: { ...club.tactics, startingXI: [...lineup.xi], bench: [...lineup.bench] },
      onPitchIds: [...lineup.xi],
      benchIds: [...lineup.bench],
      subsUsed: 0,
      stamina,
      ratings,
      goals: {},
      assists: {},
      saves: {},
      yellowCards: new Set(),
      redCards: new Set(),
      injuredIds: new Set(),
      subbedInMinute: {},
      subbedOutMinute: {},
      initialStarters: [...lineup.xi],
    };
  };

  const weathers: LiveMatchSession['weather'][] = ['Noite Limpa', 'Ensolarado', 'Nublado', 'Chuva Leve'];
  const weather = weathers[Math.floor(rng() * weathers.length)];

  return {
    fixtureId: fixture.id,
    minute: 0,
    finished: false,
    halfTimeReached: false,
    homeGoals: 0,
    awayGoals: 0,
    attendance: boxOffice.attendance,
    ticketRevenue: boxOffice.totalRevenue,
    homeAtmosphereBonus: boxOffice.homeAtmosphereBonus,
    weather,
    home: initTeam(homeClub, homeLineup),
    away: initTeam(awayClub, awayLineup),
    stats: {
      homePossession: 50,
      awayPossession: 50,
      homeShots: 0,
      awayShots: 0,
      homeShotsOnTarget: 0,
      awayShotsOnTarget: 0,
      homeXG: 0,
      awayXG: 0,
      homeSaves: 0,
      awaySaves: 0,
      homeFouls: 0,
      awayFouls: 0,
      homeYellowCards: 0,
      awayYellowCards: 0,
      homeRedCards: 0,
      awayRedCards: 0,
      homeCorners: 0,
      awayCorners: 0,
      homeOffsides: 0,
      awayOffsides: 0,
    },
    events: [
      {
        minute: 0,
        type: 'inicio',
        teamSide: 'neutral',
        text: `Apita o árbitro! Começa ${homeClub.name} x ${awayClub.name} no ${homeClub.stadium.name} para ${boxOffice.attendance.toLocaleString('pt-BR')} torcedores (${weather})!`,
        importance: 'high',
      },
    ],
    momentum: 0,
    usedTemplates: new Set(),
    newInjuries: [],
  };
}

export function makeLiveSubstitution(
  session: LiveMatchSession,
  side: 'home' | 'away',
  outPlayerId: string,
  inPlayerId: string,
  players: Record<string, Player>,
): LiveMatchSession {
  const team = side === 'home' ? session.home : session.away;
  if (team.subsUsed >= 5) return session;
  const outIdx = team.onPitchIds.indexOf(outPlayerId);
  const benchIdx = team.benchIds.indexOf(inPlayerId);
  if (outIdx === -1 || benchIdx === -1) return session;
  if (team.redCards.has(outPlayerId)) return session;

  const outPlayer = players[outPlayerId];
  const inPlayer = players[inPlayerId];
  if (!outPlayer || !inPlayer) return session;

  const nextOnPitch = [...team.onPitchIds];
  nextOnPitch[outIdx] = inPlayerId;
  const nextBench = team.benchIds.filter((id) => id !== inPlayerId);

  const nextTeam: LiveTeamState = {
    ...team,
    onPitchIds: nextOnPitch,
    benchIds: nextBench,
    subsUsed: team.subsUsed + 1,
    subbedOutMinute: { ...team.subbedOutMinute, [outPlayerId]: session.minute },
    subbedInMinute: { ...team.subbedInMinute, [inPlayerId]: session.minute },
    stamina: {
      ...team.stamina,
      [inPlayerId]: clamp(Math.round(100 - inPlayer.conditional.fadiga * 0.45), 60, 100),
    },
    ratings: { ...team.ratings, [inPlayerId]: 6.3 },
  };

  const subEvent: MatchEvent = {
    minute: session.minute,
    type: 'substituicao',
    teamSide: side,
    playerId: inPlayerId,
    playerName: inPlayer.shortName,
    text: `Substituição no ${team.clubName}: entra ${inPlayer.shortName} (${inPlayer.primaryPosition}) no lugar de ${outPlayer.shortName}.`,
    importance: 'medium',
  };

  return {
    ...session,
    home: side === 'home' ? nextTeam : session.home,
    away: side === 'away' ? nextTeam : session.away,
    events: [...session.events, subEvent],
  };
}

export function updateLiveTactics(
  session: LiveMatchSession,
  side: 'home' | 'away',
  mentality: TacticalMentality,
  pressing: TacticalSetup['pressing'],
  tempo: TacticalSetup['tempo'],
): LiveMatchSession {
  const team = side === 'home' ? session.home : session.away;
  const nextTeam: LiveTeamState = {
    ...team,
    tactics: {
      ...team.tactics,
      mentality,
      pressing,
      tempo,
    },
  };
  return {
    ...session,
    home: side === 'home' ? nextTeam : session.home,
    away: side === 'away' ? nextTeam : session.away,
  };
}

function computeDynamicTeamPower(
  club: Club,
  team: LiveTeamState,
  players: Record<string, Player>,
  homeBonus: number,
): {
  attack: number;
  midfield: number;
  defense: number;
  pressing: number;
  chemPassing: number;
  chemCollective: number;
} {
  const tempClub: Club = { ...club, tactics: team.tactics };
  const breakdown = calculateTeamStrength(tempClub, players, team.onPitchIds);
  const chem = calculateSquadChemistry(tempClub, players, team.onPitchIds);
  const active = getActivePlayers(team, players);

  // Fadiga em tempo real durante a partida
  const avgLiveStamina =
    active.length > 0
      ? active.reduce((acc, p) => acc + (team.stamina[p.id] ?? 75), 0) / active.length
      : 60;
  const staminaFactor = 0.72 + (avgLiveStamina / 100) * 0.32;

  // Penalidade forte por expulsão
  const redCardFactor = Math.max(0.55, 1 - team.redCards.size * 0.14);

  const mentalityAtt =
    team.tactics.mentality === 'Ultraofensiva'
      ? 9
      : team.tactics.mentality === 'Ofensiva'
        ? 4.5
        : team.tactics.mentality === 'Defensiva'
          ? -4
          : team.tactics.mentality === 'Ultradefensiva'
            ? -8
            : 0;
  const mentalityDef = -mentalityAtt * 0.85;

  const pressingMod =
    team.tactics.pressing === 'Pressão Total'
      ? 6
      : team.tactics.pressing === 'Alta'
        ? 3
        : team.tactics.pressing === 'Baixa'
          ? -3
          : 0;

  const baseOverall = breakdown.overall + homeBonus * 0.45;
  return {
    attack: (breakdown.offensiveOrganization * 0.55 + baseOverall * 0.45 + mentalityAtt) * staminaFactor * redCardFactor,
    midfield:
      (breakdown.overall * 0.55 + breakdown.chemistryScore * 0.25 + breakdown.tacticalCompatibility * 0.2 + pressingMod * 0.5) *
      staminaFactor *
      redCardFactor,
    defense: (breakdown.defensiveOrganization * 0.55 + baseOverall * 0.45 + mentalityDef) * staminaFactor * redCardFactor,
    pressing: 50 + pressingMod * 5,
    chemPassing: chem.passingBonus,
    chemCollective: chem.collectivePlayBonus,
  };
}

function tryAiSubstitution(
  session: LiveMatchSession,
  side: 'home' | 'away',
  club: Club,
  players: Record<string, Player>,
  rng: () => number,
): LiveMatchSession {
  if (club.isUserClub) return session;
  const team = side === 'home' ? session.home : session.away;
  if (team.subsUsed >= 5 || team.benchIds.length === 0) return session;
  if (session.minute < 58 || session.minute > 86) return session;
  if (rng() > 0.16) return session;

  // Escolhe jogador cansado ou amarelado em campo
  const slots = FORMATIONS[team.tactics.formation];
  let worstIdx = -1;
  let worstScore = 999;

  for (let i = 1; i < team.onPitchIds.length; i++) {
    const pid = team.onPitchIds[i];
    if (!pid || team.redCards.has(pid)) continue;
    const stam = team.stamina[pid] ?? 70;
    const cardPen = team.yellowCards.has(pid) ? 16 : 0;
    const score = stam - cardPen;
    if (score < worstScore && score < 62) {
      worstScore = score;
      worstIdx = i;
    }
  }

  if (worstIdx === -1) return session;
  const outId = team.onPitchIds[worstIdx];
  const slotPos = slots[worstIdx]?.position ?? 'MC';

  // Escolhe melhor reserva para a posição
  const bestBenchId = [...team.benchIds]
    .filter((id) => players[id] && players[id].primaryPosition !== 'GOL')
    .sort((a, b) => calculateEffectiveOverall(players[b], slotPos) - calculateEffectiveOverall(players[a], slotPos))[0];

  if (!bestBenchId) return session;
  return makeLiveSubstitution(session, side, outId, bestBenchId, players);
}

export function stepLiveMatchMinute(
  prev: LiveMatchSession,
  homeClub: Club,
  awayClub: Club,
  players: Record<string, Player>,
  currentDate: string,
  rng: () => number = Math.random,
): LiveMatchSession {
  if (prev.finished) return prev;

  let session: LiveMatchSession = {
    ...prev,
    minute: prev.minute + 1,
    stats: { ...prev.stats },
    events: [...prev.events],
    newInjuries: [...prev.newInjuries],
    home: {
      ...prev.home,
      stamina: { ...prev.home.stamina },
      ratings: { ...prev.home.ratings },
      goals: { ...prev.home.goals },
      assists: { ...prev.home.assists },
      saves: { ...prev.home.saves },
      yellowCards: new Set(prev.home.yellowCards),
      redCards: new Set(prev.home.redCards),
      injuredIds: new Set(prev.home.injuredIds),
    },
    away: {
      ...prev.away,
      stamina: { ...prev.away.stamina },
      ratings: { ...prev.away.ratings },
      goals: { ...prev.away.goals },
      assists: { ...prev.away.assists },
      saves: { ...prev.away.saves },
      yellowCards: new Set(prev.away.yellowCards),
      redCards: new Set(prev.away.redCards),
      injuredIds: new Set(prev.away.injuredIds),
    },
  };

  const min = session.minute;

  // Dreno físico por minuto em ambos os times
  const drainTeam = (team: LiveTeamState) => {
    const pressDrain =
      team.tactics.pressing === 'Pressão Total'
        ? 0.64
        : team.tactics.pressing === 'Alta'
          ? 0.52
          : team.tactics.pressing === 'Média'
            ? 0.42
            : 0.34;
    const tempoDrain = team.tactics.tempo === 'Rápido' ? 0.1 : team.tactics.tempo === 'Lento' ? -0.05 : 0;

    for (const pid of team.onPitchIds) {
      if (!pid || team.redCards.has(pid)) continue;
      const p = players[pid];
      if (!p) continue;
      const posMult = p.primaryPosition === 'GOL' ? 0.25 : 1.0;
      const resFactor = clamp(1.22 - (p.physical.resistencia / 100) * 0.5, 0.72, 1.18);
      const loss = (pressDrain + tempoDrain) * posMult * resFactor;
      team.stamina[pid] = clamp(Number(((team.stamina[pid] ?? 80) - loss).toFixed(2)), 10, 100);
    }
  };
  drainTeam(session.home);
  drainTeam(session.away);

  // Intervalo aos 45 minutos
  if (min === 45 && !session.halfTimeReached) {
    session.halfTimeReached = true;
    // Pequena recuperação no intervalo
    for (const pid of session.home.onPitchIds) {
      if (pid && session.home.stamina[pid]) session.home.stamina[pid] = clamp(session.home.stamina[pid] + 6, 15, 100);
    }
    for (const pid of session.away.onPitchIds) {
      if (pid && session.away.stamina[pid]) session.away.stamina[pid] = clamp(session.away.stamina[pid] + 6, 15, 100);
    }
    session.events.push({
      minute: 45,
      type: 'intervalo',
      teamSide: 'neutral',
      text: `Fim do primeiro tempo! ${homeClub.shortName} ${session.homeGoals} x ${session.awayGoals} ${awayClub.shortName}. Os treinadores ajustam suas equipes nos vestiários.`,
      importance: 'high',
    });
    return session;
  }

  // Substituições automáticas de clubes IA
  session = tryAiSubstitution(session, 'home', homeClub, players, rng);
  session = tryAiSubstitution(session, 'away', awayClub, players, rng);

  // Poder dinâmico minuto a minuto
  const homePower = computeDynamicTeamPower(homeClub, session.home, players, session.homeAtmosphereBonus);
  const awayPower = computeDynamicTeamPower(awayClub, session.away, players, 0);

  // Posse de bola suave
  const homeMidShare =
    (homePower.midfield * homePower.chemPassing) /
    Math.max(1, homePower.midfield * homePower.chemPassing + awayPower.midfield * awayPower.chemPassing);
  const targetHomePoss = clamp(Math.round(homeMidShare * 100), 28, 72);
  session.stats.homePossession = Math.round(session.stats.homePossession * 0.92 + targetHomePoss * 0.08);
  session.stats.awayPossession = 100 - session.stats.homePossession;

  // Decidir se ocorre um lance relevante neste minuto (~34% de chance por minuto = ~30 lances por jogo)
  const tempoEventBoost =
    session.home.tactics.tempo === 'Rápido' || session.away.tactics.tempo === 'Rápido' ? 0.05 : 0;
  const eventChance = 0.31 + tempoEventBoost;

  if (rng() < eventChance) {
    const homeAttackWeight = Math.pow(Math.max(20, homePower.attack * homePower.chemCollective), 1.35);
    const awayAttackWeight = Math.pow(Math.max(20, awayPower.attack * awayPower.chemCollective), 1.35);
    const attackingSide: 'home' | 'away' = rng() < homeAttackWeight / (homeAttackWeight + awayAttackWeight) ? 'home' : 'away';

    const attTeam = attackingSide === 'home' ? session.home : session.away;
    const defTeam = attackingSide === 'home' ? session.away : session.home;
    const attClub = attackingSide === 'home' ? homeClub : awayClub;
    const defClub = attackingSide === 'home' ? awayClub : homeClub;
    const attPower = attackingSide === 'home' ? homePower : awayPower;
    const defPower = attackingSide === 'home' ? awayPower : homePower;

    const attPlayers = getActivePlayers(attTeam, players);
    const defPlayers = getActivePlayers(defTeam, players);
    const defGK = getGoalkeeper(defTeam, players);

    const creator = pickWeightedPlayer(
      attPlayers.filter((p) => p.primaryPosition !== 'GOL'),
      (p) => {
        const t = getEffectiveTechnical(p);
        const m = getEffectiveMental(p);
        const posW = POSITION_GROUPS[p.primaryPosition] === 'MEI' ? 2.0 : POSITION_GROUPS[p.primaryPosition] === 'ATA' ? 1.4 : 0.7;
        return (t.passeCurto + m.visaoJogo + t.cruzamento + t.drible) * posW;
      },
      rng,
    );

    const finisher = pickWeightedPlayer(
      attPlayers.filter((p) => p.primaryPosition !== 'GOL'),
      (p) => {
        const t = getEffectiveTechnical(p);
        const posW =
          p.primaryPosition === 'ATA'
            ? 3.2
            : p.primaryPosition === 'PD' || p.primaryPosition === 'PE'
              ? 2.1
              : p.primaryPosition === 'MEI'
                ? 1.7
                : 0.45;
        return (t.finalizacao * 1.4 + t.posicionamento + t.cabeceio * 0.6) * posW;
      },
      rng,
    );

    const defender = pickWeightedPlayer(
      defPlayers.filter((p) => p.primaryPosition !== 'GOL'),
      (p) => {
        const t = getEffectiveTechnical(p);
        const posW = POSITION_GROUPS[p.primaryPosition] === 'DEF' ? 2.4 : p.primaryPosition === 'VOL' ? 2.0 : 0.6;
        return (t.marcacao + t.desarme + t.posicionamento) * posW;
      },
      rng,
    );

    if (creator && finisher && defender && defGK) {
      const roll = rng();

      // Atualiza momentum
      session.momentum = clamp(
        session.momentum * 0.7 + (attackingSide === 'home' ? 26 : -26),
        -100,
        100,
      );

      // 1. Impedimento (~7%)
      if (roll < 0.07) {
        if (attackingSide === 'home') session.stats.homeOffsides++;
        else session.stats.awayOffsides++;
        const tpl = pickUniqueTemplate(
          [
            `Bandeirinha levantada! ${creator.shortName} enfiou linda bola para ${finisher.shortName}, mas o atacante do ${attClub.shortName} estava em posição irregular.`,
            `Impedimento assinalado! ${finisher.shortName} arrancou um passo à frente da linha defensiva do ${defClub.shortName}.`,
            `A linha alta do ${defClub.shortName} funcionou perfeitamente e deixou ${finisher.shortName} em impedimento.`,
          ],
          session.usedTemplates,
          'offside',
          rng,
        );
        session.events.push({
          minute: min,
          type: 'impedimento',
          teamSide: attackingSide,
          playerId: finisher.id,
          playerName: finisher.shortName,
          text: tpl,
          importance: 'low',
        });
      }
      // 2. Falta / Cartões / Lesão por dividida (~19%)
      else if (roll < 0.26) {
        if (attackingSide === 'home') session.stats.awayFouls++;
        else session.stats.homeFouls++;

        const cardRoll = rng() + (defTeam.tactics.pressing === 'Pressão Total' ? 0.1 : 0);
        const alreadyYellow = defTeam.yellowCards.has(defender.id);

        if (cardRoll > 0.965 && !alreadyYellow) {
          // Vermelho direto
          defTeam.redCards.add(defender.id);
          defTeam.ratings[defender.id] = clamp((defTeam.ratings[defender.id] ?? 6) - 1.6, 3.5, 10);
          if (attackingSide === 'home') session.stats.awayRedCards++;
          else session.stats.homeRedCards++;
          session.events.push({
            minute: min,
            type: 'cartao_vermelho',
            teamSide: attackingSide === 'home' ? 'away' : 'home',
            playerId: defender.id,
            playerName: defender.shortName,
            text: `CARTÃO VERMELHO! Entrada duríssima de ${defender.shortName} em ${finisher.shortName}! O ${defClub.shortName} fica com um jogador a menos!`,
            importance: 'critical',
          });
        } else if (cardRoll > 0.67) {
          if (alreadyYellow) {
            defTeam.redCards.add(defender.id);
            defTeam.ratings[defender.id] = clamp((defTeam.ratings[defender.id] ?? 6) - 1.3, 3.5, 10);
            if (attackingSide === 'home') {
              session.stats.awayYellowCards++;
              session.stats.awayRedCards++;
            } else {
              session.stats.homeYellowCards++;
              session.stats.homeRedCards++;
            }
            session.events.push({
              minute: min,
              type: 'cartao_vermelho',
              teamSide: attackingSide === 'home' ? 'away' : 'home',
              playerId: defender.id,
              playerName: defender.shortName,
              text: `SEGUNDO AMARELO E EXPULSÃO! ${defender.shortName} matou o avanço de ${creator.shortName} e está fora do jogo!`,
              importance: 'critical',
            });
          } else {
            defTeam.yellowCards.add(defender.id);
            defTeam.ratings[defender.id] = clamp((defTeam.ratings[defender.id] ?? 6) - 0.3, 4.0, 10);
            if (attackingSide === 'home') session.stats.awayYellowCards++;
            else session.stats.homeYellowCards++;
            const tpl = pickUniqueTemplate(
              [
                `Cartão amarelo para ${defender.shortName}! Chegou atrasado na dividida com ${creator.shortName} e parou ataque promissor do ${attClub.shortName}.`,
                `Amarelado! ${defender.shortName} puxou a camisa de ${finisher.shortName} na intermediária e levou o cartão.`,
                `O árbitro não perdoou o carrinho de ${defender.shortName}: cartão amarelo para o defensor do ${defClub.shortName}.`,
              ],
              session.usedTemplates,
              'yellow',
              rng,
            );
            session.events.push({
              minute: min,
              type: 'cartao_amarelo',
              teamSide: attackingSide === 'home' ? 'away' : 'home',
              playerId: defender.id,
              playerName: defender.shortName,
              text: tpl,
              importance: 'medium',
            });
          }
        } else {
          const tpl = pickUniqueTemplate(
            [
              `Falta marcada para o ${attClub.shortName}. ${defender.shortName} derrubou ${creator.shortName} perto do círculo central.`,
              `${defender.shortName} comete falta tática em ${finisher.shortName} para reorganizar a defesa do ${defClub.shortName}.`,
              `Infração na ponta! ${creator.shortName} sofre falta e o ${attClub.shortName} se prepara para alçar bola na área.`,
            ],
            session.usedTemplates,
            'foul',
            rng,
          );
          session.events.push({
            minute: min,
            type: 'falta',
            teamSide: attackingSide,
            playerId: defender.id,
            playerName: defender.shortName,
            text: tpl,
            importance: 'low',
          });
        }

        // Possível lesão após dividida dura (respeitando fadiga e histórico físico)
        const injuryProb = computeInjuryRiskForPlayer(
          finisher,
          0.024,
          attClub.medicalStaff,
          attClub.stadium.infrastructureLevel,
        );
        if (rng() < injuryProb && !attTeam.injuredIds.has(finisher.id)) {
          const inj = generateInjury(finisher, 'Partida', currentDate, attClub.medicalStaff, rng);
          attTeam.injuredIds.add(finisher.id);
          session.newInjuries.push({
            playerId: finisher.id,
            clubId: attClub.id,
            type: inj.type,
            days: inj.totalDays,
            severity: inj.severity,
          });
          session.events.push({
            minute: min,
            type: 'lesao',
            teamSide: attackingSide,
            playerId: finisher.id,
            playerName: finisher.shortName,
            text: `Preocupação no banco do ${attClub.shortName}! ${finisher.shortName} sente dores após o choque (${inj.type}) e precisa deixar o gramado.`,
            importance: 'high',
          });
          // Substituição automática de emergência se tiver banco
          if (attTeam.subsUsed < 5 && attTeam.benchIds.length > 0) {
            const subId = attTeam.benchIds.find((id) => players[id]?.primaryPosition !== 'GOL') ?? attTeam.benchIds[0];
            if (subId) {
              session = makeLiveSubstitution(session, attackingSide, finisher.id, subId, players);
            }
          }
        }
      }
      // 3. Construção / Passe em profundidade / Cruzamento / Contra-ataque / Escanteio (~26%)
      else if (roll < 0.52) {
        const subRoll = rng();
        if (subRoll < 0.28) {
          if (attackingSide === 'home') session.stats.homeCorners++;
          else session.stats.awayCorners++;
          const tpl = pickUniqueTemplate(
            [
              `Escanteio para o ${attClub.shortName}! ${defender.shortName} bloqueou o cruzamento venenoso de ${creator.shortName} pela linha de fundo.`,
              `${attClub.shortName} pressiona e conquista escanteio após grande corte de ${defender.shortName}.`,
              `Bola desviada na marcação! Os zagueiros do ${attClub.shortName} sobem à área para a cobrança do escanteio.`,
            ],
            session.usedTemplates,
            'corner',
            rng,
          );
          session.events.push({
            minute: min,
            type: 'escanteio',
            teamSide: attackingSide,
            playerId: creator.id,
            playerName: creator.shortName,
            text: tpl,
            importance: 'low',
          });
        } else if (subRoll < 0.55) {
          const tpl = pickUniqueTemplate(
            [
              `Passe em profundidade espetacular de ${creator.shortName}! ${finisher.shortName} invade a área, mas ${defender.shortName} chega na trava no último instante.`,
              `Belo entrosamento do ${attClub.shortName}: ${creator.shortName} acha ${finisher.shortName} nas costas da zaga, exigindo cobertura rápida do ${defClub.shortName}.`,
              `Enfiada milimétrica de ${creator.shortName}! A torcida se levanta, mas ${defGK.shortName} sai arrojado nos pés de ${finisher.shortName}.`,
            ],
            session.usedTemplates,
            'throughball',
            rng,
          );
          session.events.push({
            minute: min,
            type: 'passe_profundidade',
            teamSide: attackingSide,
            playerId: creator.id,
            playerName: creator.shortName,
            text: tpl,
            importance: 'medium',
          });
        } else if (subRoll < 0.8) {
          const tpl = pickUniqueTemplate(
            [
              `Cruzamento fechado de ${creator.shortName} na segunda trave! ${defender.shortName} sobe mais alto e afasta o perigo de cabeça.`,
              `Ataque perigoso pelos lados! ${creator.shortName} leva à linha de fundo e levanta na pequena área buscando ${finisher.shortName}.`,
              `${attClub.shortName} envolve o adversário com troca rápida de passes e busca o cruzamento na marca do pênalti.`,
            ],
            session.usedTemplates,
            'cross',
            rng,
          );
          session.events.push({
            minute: min,
            type: 'cruzamento',
            teamSide: attackingSide,
            playerId: creator.id,
            playerName: creator.shortName,
            text: tpl,
            importance: 'medium',
          });
        } else {
          const tpl = pickUniqueTemplate(
            [
              `Contra-ataque fulminante do ${attClub.shortName}! ${creator.shortName} dispara em velocidade pelo meio e aciona ${finisher.shortName} na entrada da área!`,
              `Transição rápida! O ${attClub.shortName} rouba a bola e pega a defesa do ${defClub.shortName} completamente aberta!`,
              `Ataque perigoso do ${attClub.shortName}! ${finisher.shortName} limpa o marcador com drible curto e gera pânico na área adversária.`,
            ],
            session.usedTemplates,
            'counter',
            rng,
          );
          session.events.push({
            minute: min,
            type: 'contra_ataque',
            teamSide: attackingSide,
            playerId: finisher.id,
            playerName: finisher.shortName,
            text: tpl,
            importance: 'medium',
          });
        }
      }
      // 4. Finalização -> Fora / Defesa do Goleiro / GOL! (~48% dos eventos = ~13-16 finalizações totais por jogo)
      else {
        const finTech = getEffectiveTechnical(finisher);
        const finMent = getEffectiveMental(finisher);
        const gkTech = getEffectiveTechnical(defGK);
        const defTech = getEffectiveTechnical(defender);

        const attackEdge = (attPower.attack - defPower.defense) * 0.0045;
        const shotQuality = clamp(
          0.11 +
            ((finTech.finalizacao * 0.6 + finMent.compostura * 0.25 + finTech.posicionamento * 0.15) -
              (gkTech.reflexos * 0.45 + gkTech.defesaGoleiro * 0.35 + defTech.marcacao * 0.2)) *
              0.0038 +
            attackEdge,
          0.04,
          0.34,
        );

        if (attackingSide === 'home') {
          session.stats.homeShots++;
          session.stats.homeXG = Number((session.stats.homeXG + shotQuality).toFixed(2));
        } else {
          session.stats.awayShots++;
          session.stats.awayXG = Number((session.stats.awayXG + shotQuality).toFixed(2));
        }

        const onTargetChance = clamp(0.42 + (finTech.finalizacao - 65) * 0.006, 0.28, 0.68);
        const isOnTarget = rng() < onTargetChance;

        if (!isOnTarget) {
          const tpl = pickUniqueTemplate(
            [
              `Finalização de ${finisher.shortName}! Soltou a bomba de fora da área após passe de ${creator.shortName}, mas a bola subiu demais.`,
              `UHHH! ${finisher.shortName} bateu colocado buscando o ângulo do ${defClub.shortName} e a bola tirou tinta da trave!`,
              `Chute travado! ${finisher.shortName} finalizou da meia-lua, a bola desviou em ${defender.shortName} e saiu pela linha de fundo.`,
              `${finisher.shortName} cabeceia firme após levantamento de ${creator.shortName}, mas manda por cima do travessão!`,
            ],
            session.usedTemplates,
            'shot_miss',
            rng,
          );
          session.events.push({
            minute: min,
            type: 'finalizacao',
            teamSide: attackingSide,
            playerId: finisher.id,
            playerName: finisher.shortName,
            text: tpl,
            importance: 'medium',
          });
        } else {
          if (attackingSide === 'home') session.stats.homeShotsOnTarget++;
          else session.stats.awayShotsOnTarget++;

          // Chance de gol dado que foi no alvo
          const goalGivenOnTarget = clamp(shotQuality / Math.max(0.25, onTargetChance) * 0.88, 0.12, 0.48);
          if (rng() < goalGivenOnTarget) {
            // GOL!
            if (attackingSide === 'home') session.homeGoals++;
            else session.awayGoals++;

            attTeam.goals[finisher.id] = (attTeam.goals[finisher.id] ?? 0) + 1;
            attTeam.ratings[finisher.id] = clamp((attTeam.ratings[finisher.id] ?? 6.5) + 1.15, 4, 10);

            const hasAssist = creator.id !== finisher.id && rng() < 0.78;
            if (hasAssist) {
              attTeam.assists[creator.id] = (attTeam.assists[creator.id] ?? 0) + 1;
              attTeam.ratings[creator.id] = clamp((attTeam.ratings[creator.id] ?? 6.4) + 0.65, 4, 10);
            }
            defTeam.ratings[defGK.id] = clamp((defTeam.ratings[defGK.id] ?? 6.3) - 0.35, 4, 10);

            const scoreStr = `${homeClub.shortName} ${session.homeGoals} x ${session.awayGoals} ${awayClub.shortName}`;
            const tpl = hasAssist
              ? pickUniqueTemplate(
                  [
                    `GOOOOL DO ${attClub.name.toUpperCase()}! Assistência cirúrgica de ${creator.shortName} e finalização letal de ${finisher.shortName} no cantinho! (${scoreStr})`,
                    `É REDE! ${creator.shortName} quebra a linha defensiva com passe genial e ${finisher.shortName} tira de ${defGK.shortName} com muita categoria! (${scoreStr})`,
                    `GOLAÇO DO ${attClub.shortName}! Cruzamento perfeito de ${creator.shortName} e ${finisher.shortName} testa no fundo das redes sem chance para o goleiro! (${scoreStr})`,
                    `NO FUNDO DO GOL! Jogada coletiva envolvente do ${attClub.shortName}: ${creator.shortName} rola na medida e ${finisher.shortName} estufa as redes! (${scoreStr})`,
                  ],
                  session.usedTemplates,
                  'goal_assist',
                  rng,
                )
              : pickUniqueTemplate(
                  [
                    `GOOOOL DO ${attClub.name.toUpperCase()}! Jogada individual brilhante de ${finisher.shortName}, que limpa ${defender.shortName} e manda uma pancada indefensável! (${scoreStr})`,
                    `GOLAÇO! ${finisher.shortName} aproveita a sobra na entrada da área e dispara um foguete no ângulo de ${defGK.shortName}! (${scoreStr})`,
                    `BOLA NA REDE! ${finisher.shortName} mostra faro de artilheiro e empurra para o gol do ${defClub.shortName}! (${scoreStr})`,
                  ],
                  session.usedTemplates,
                  'goal_solo',
                  rng,
                );

            session.events.push({
              minute: min,
              type: 'gol',
              teamSide: attackingSide,
              playerId: finisher.id,
              playerName: finisher.shortName,
              assistPlayerId: hasAssist ? creator.id : undefined,
              assistPlayerName: hasAssist ? creator.shortName : undefined,
              text: tpl,
              importance: 'critical',
            });
          } else {
            // DEFESA DO GOLEIRO!
            if (attackingSide === 'home') session.stats.awaySaves++;
            else session.stats.homeSaves++;
            defTeam.saves[defGK.id] = (defTeam.saves[defGK.id] ?? 0) + 1;
            defTeam.ratings[defGK.id] = clamp((defTeam.ratings[defGK.id] ?? 6.4) + 0.35, 4, 10);
            attTeam.ratings[finisher.id] = clamp((attTeam.ratings[finisher.id] ?? 6.3) + 0.12, 4, 10);

            const tpl = pickUniqueTemplate(
              [
                `MILAGRE DE ${defGK.shortName.toUpperCase()}! ${finisher.shortName} chutou à queima-roupa e o goleiro do ${defClub.shortName} voou para espalmar!`,
                `Grande defesa de ${defGK.shortName}! Segurou firme a finalização colocada de ${finisher.shortName} após jogada de ${creator.shortName}.`,
                `Espalma o paredão ${defGK.shortName}! ${finisher.shortName} bateu cruzado com veneno, mas o camisa 1 salvou o ${defClub.shortName}!`,
                `${defGK.shortName} fecha o ângulo no mano a mano contra ${finisher.shortName} e evita o gol com os pés!`,
              ],
              session.usedTemplates,
              'save',
              rng,
            );
            session.events.push({
              minute: min,
              type: 'defesa',
              teamSide: attackingSide === 'home' ? 'away' : 'home',
              playerId: defGK.id,
              playerName: defGK.shortName,
              text: tpl,
              importance: 'high',
            });
          }
        }
      }
    }
  }

  // Encerramento aos 90 minutos
  if (min >= 90) {
    session.finished = true;
    const winnerText =
      session.homeGoals > session.awayGoals
        ? `Vitória do ${homeClub.name} diante da sua torcida!`
        : session.awayGoals > session.homeGoals
          ? `Grande vitória fora de casa do ${awayClub.name}!`
          : `Tudo igual no placar após 90 minutos disputados!`;
    session.events.push({
      minute: 90,
      type: 'fim',
      teamSide: 'neutral',
      text: `FIM DE JOGO! ${homeClub.name} ${session.homeGoals} x ${session.awayGoals} ${awayClub.name}. ${winnerText}`,
      importance: 'critical',
    });
  }

  return session;
}

export function buildMatchPerformances(
  team: LiveTeamState,
  players: Record<string, Player>,
  won: boolean,
  drawn: boolean,
  cleanSheet: boolean,
): MatchPlayerPerformance[] {
  const allParticipated = Array.from(
    new Set([...team.initialStarters, ...Object.keys(team.subbedInMinute)]),
  );

  return allParticipated
    .map((pid) => {
      const p = players[pid];
      if (!p) return null;
      const inMin = team.subbedInMinute[pid] ?? 0;
      const outMin = team.subbedOutMinute[pid] ?? 90;
      const minutesPlayed = Math.max(1, outMin - inMin);
      const baseRating = team.ratings[pid] ?? 6.3;
      const resultBonus = won ? 0.35 : drawn ? 0.05 : -0.25;
      const csBonus =
        cleanSheet && (p.primaryPosition === 'GOL' || POSITION_GROUPS[p.primaryPosition] === 'DEF') ? 0.45 : 0;
      const rating = clamp(Number((baseRating + resultBonus + csBonus).toFixed(1)), 4.0, 10.0);

      return {
        playerId: pid,
        playerName: p.shortName,
        position: p.primaryPosition,
        goals: team.goals[pid] ?? 0,
        assists: team.assists[pid] ?? 0,
        saves: team.saves[pid] ?? 0,
        yellowCard: team.yellowCards.has(pid),
        redCard: team.redCards.has(pid),
        injured: team.injuredIds.has(pid),
        substitutedInMinute: team.subbedInMinute[pid],
        substitutedOutMinute: team.subbedOutMinute[pid],
        minutesPlayed,
        staminaEnd: Math.round(team.stamina[pid] ?? 70),
        rating,
      } as MatchPlayerPerformance;
    })
    .filter((x): x is MatchPlayerPerformance => x !== null);
}

export function finalizeSessionToFixture(
  fixture: MatchFixture,
  session: LiveMatchSession,
  players: Record<string, Player>,
): MatchFixture {
  const homeWon = session.homeGoals > session.awayGoals;
  const awayWon = session.awayGoals > session.homeGoals;
  const drawn = session.homeGoals === session.awayGoals;

  const homePerf = buildMatchPerformances(session.home, players, homeWon, drawn, session.awayGoals === 0);
  const awayPerf = buildMatchPerformances(session.away, players, awayWon, drawn, session.homeGoals === 0);

  const allPerf = [
    ...homePerf.map((p) => ({ ...p, clubId: fixture.homeClubId })),
    ...awayPerf.map((p) => ({ ...p, clubId: fixture.awayClubId })),
  ].sort((a, b) => b.rating - a.rating);

  const motm = allPerf[0]
    ? {
        playerId: allPerf[0].playerId,
        playerName: allPerf[0].playerName,
        rating: allPerf[0].rating,
        clubId: allPerf[0].clubId,
      }
    : undefined;

  return {
    ...fixture,
    played: true,
    homeGoals: session.homeGoals,
    awayGoals: session.awayGoals,
    attendance: session.attendance,
    ticketRevenue: session.ticketRevenue,
    events: session.events,
    stats: session.stats,
    homePerformances: homePerf,
    awayPerformances: awayPerf,
    manOfTheMatch: motm,
  };
}

export function simulateMatchInstant(
  fixture: MatchFixture,
  homeClub: Club,
  awayClub: Club,
  players: Record<string, Player>,
  currentDate: string,
  rng: () => number = Math.random,
): { fixture: MatchFixture; session: LiveMatchSession } {
  let session = createLiveMatchSession(fixture, homeClub, awayClub, players, rng);
  while (!session.finished) {
    session = stepLiveMatchMinute(session, homeClub, awayClub, players, currentDate, rng);
  }
  const completedFixture = finalizeSessionToFixture(fixture, session, players);
  return { fixture: completedFixture, session };
}
