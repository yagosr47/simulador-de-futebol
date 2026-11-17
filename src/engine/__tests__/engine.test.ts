import { describe, expect, it } from 'vitest';
import type { Player } from '../../types/game';
import { createNewGameState, createSeededRng } from '../worldGenerator';
import {
  calculateBaseOverall,
  calculateEffectiveOverall,
  calculateTeamStrength,
  getPlayerTemporaryModifiers,
} from '../overall';
import { calculatePairChemistry, calculateSquadChemistry } from '../chemistry';
import { executeTrainingSession } from '../training';
import { evaluateContractAfterMatch, evaluateContractRenewal } from '../contracts';
import { simulateMatchInstant } from '../matchEngine';
import {
  evaluateClubBid,
  evaluatePlayerTransferDecision,
  executeCompletedTransfer,
  scheduleFutureTransfer,
} from '../transfers';
import { createPlayerAuction, processDailyAuctions, submitAuctionBid } from '../auctions';
import {
  advanceStadiumConstructions,
  calculateMatchdayBoxOffice,
  createStadiumConstruction,
} from '../stadium';
import { advanceDailyMedicalRecovery, generateInjury } from '../infirmary';
import { advanceOneDay, applyCompletedFixtureToState } from '../calendar';
import { processMonthlyFinances, takeBankLoan } from '../economy';
import { processMonthlyDevelopment } from '../development';
import { isTransferWindowOpen } from '../constants';

describe('Simulador de Futebol — Motores Interligados', () => {
  it('gera mundo completo com 16 clubes, elencos equilibrados, competições e calendário', () => {
    const state = createNewGameState('palestra-sp', 'Técnico Teste', 42);
    expect(Object.keys(state.clubs)).toHaveLength(16);
    const userPlayers = Object.values(state.players).filter((p) => p.clubId === state.userClubId);
    expect(userPlayers.length).toBe(22);
    expect(state.competitions).toHaveLength(3);
    expect(state.competitions[0].fixtures.length).toBe(240); // 16 clubes, 30 rodadas, 8 jogos/rodada
    expect(state.calendarEvents.length).toBeGreaterThan(20);
    expect(state.auctions.length).toBeGreaterThanOrEqual(3);
  });

  it('calcula overall ponderado por posição e força da equipe além da média simples', () => {
    const state = createNewGameState('palestra-sp', 'Tester', 101);
    const club = state.clubs[state.userClubId];
    const gk = Object.values(state.players).find(
      (p) => p.clubId === club.id && p.primaryPosition === 'GOL',
    )!;

    const gkAtGk = calculateEffectiveOverall(gk, 'GOL');
    const gkAtAta = calculateEffectiveOverall(gk, 'ATA');
    expect(gkAtGk).toBeGreaterThan(gkAtAta + 25);

    const strength = calculateTeamStrength(club, state.players);
    expect(strength.overall).toBeGreaterThan(50);
    expect(strength.overall).toBeLessThanOrEqual(99);
    expect(strength.chemistryScore).toBeGreaterThan(30);
    expect(strength.defensiveOrganization).toBeGreaterThan(40);
    expect(strength.offensiveOrganization).toBeGreaterThan(40);
  });

  it('aplica modificadores temporários visíveis (-3/-5) para insatisfação contratual e reverte após renovação', () => {
    const state = createNewGameState('palestra-sp', 'Tester', 102);
    const club = state.clubs[state.userClubId];
    const unhappy = Object.values(state.players).find(
      (p) => p.clubId === club.id && p.contract.dissatisfaction === 'Moderada',
    )!;
    expect(unhappy).toBeDefined();

    const mods = getPlayerTemporaryModifiers(unhappy);
    expect(mods.mentalDelta).toBeLessThanOrEqual(-3);
    expect(mods.reasons.length).toBeGreaterThan(0);

    // Renegociação generosa restaura satisfação e limpa modificadores negativos
    const renewal = evaluateContractRenewal(
      unhappy,
      club,
      {
        salary: unhappy.contract.salary * 2,
        years: 4,
        role: 'Titular fixo',
      },
      state.currentDate,
    );
    expect(renewal.accepted).toBe(true);
    expect(renewal.updatedPlayer?.contract.dissatisfaction).toBe('Satisfeito');
    const restoredMods = getPlayerTemporaryModifiers(renewal.updatedPlayer!);
    expect(restoredMods.mentalDelta).toBeGreaterThanOrEqual(0);
  });

  it('avalia expectativas contratuais após jogos sem minutagem gerando insatisfação', () => {
    const state = createNewGameState('palestra-sp', 'Tester', 103);
    const club = state.clubs[state.userClubId];
    let squad = Object.values(state.players).filter((p) => p.clubId === club.id);
    const fixedStarter = squad.find((p) => p.contract.role === 'Titular fixo' && !p.injury)!;

    // Deixa o titular fixo no banco por 5 jogos seguidos
    for (let i = 0; i < 5; i++) {
      const res = evaluateContractAfterMatch(squad, new Set(), new Set(), `2026-02-0${i + 1}`);
      squad = res.updatedPlayers;
    }
    const after = squad.find((p) => p.id === fixedStarter.id)!;
    expect(after.contract.dissatisfactionPoints).toBeGreaterThanOrEqual(42);
    expect(['Moderada', 'Elevada']).toContain(after.contract.dissatisfaction);
  });

  it('calcula química entre pares e esquadrão influenciando bônus coletivos', () => {
    const state = createNewGameState('palestra-sp', 'Tester', 104);
    const club = state.clubs[state.userClubId];
    const chem = calculateSquadChemistry(club, state.players);
    expect(chem.overallChemistry).toBeGreaterThan(40);
    expect(chem.links.length).toBeGreaterThan(10);
    expect(chem.passingBonus).toBeGreaterThan(0.8);

    const p1 = state.players[club.tactics.startingXI[1]];
    const p2 = state.players[club.tactics.startingXI[2]];
    const pair = calculatePairChemistry(p1, p2, club.tactics.playStyle);
    expect(pair.score).toBeGreaterThanOrEqual(10);
    expect(pair.score).toBeLessThanOrEqual(100);
  });

  it('executa treinamentos intensos e recuperação física afetando fadiga, evolução e lesões', () => {
    const state = createNewGameState('palestra-sp', 'Tester', 105);
    const club = state.clubs[state.userClubId];
    const rng = createSeededRng(555);

    const intense = executeTrainingSession(club, state.players, 'Físico', 'Intenso', state.currentDate, rng);
    expect(intense.avgFatigueDelta).toBeGreaterThan(10);

    const recovery = executeTrainingSession(
      club,
      intense.updatedPlayers,
      'Recuperação Física',
      'Leve',
      state.currentDate,
      rng,
    );
    expect(recovery.avgFatigueDelta).toBeLessThan(0);
  });

  it('simula partida completa com narração dinâmica, estatísticas coerentes e atualização global', () => {
    const state = createNewGameState('palestra-sp', 'Tester', 106);
    const rng = createSeededRng(999);
    const league = state.competitions[0];
    const firstFix = league.fixtures.find(
      (f) => f.homeClubId === state.userClubId || f.awayClubId === state.userClubId,
    )!;
    const home = state.clubs[firstFix.homeClubId];
    const away = state.clubs[firstFix.awayClubId];

    const { fixture, session } = simulateMatchInstant(firstFix, home, away, state.players, firstFix.date, rng);
    expect(fixture.played).toBe(true);
    expect(fixture.events.length).toBeGreaterThan(8);
    expect(fixture.stats).toBeDefined();
    expect((fixture.stats!.homePossession ?? 0) + (fixture.stats!.awayPossession ?? 0)).toBe(100);
    expect(fixture.attendance).toBeGreaterThan(5000);
    expect(fixture.ticketRevenue).toBeGreaterThan(100_000);

    const afterMatch = applyCompletedFixtureToState(state, fixture, session.newInjuries);
    const updatedLeague = afterMatch.competitions[0];
    const homeSt = updatedLeague.standings.find((s) => s.clubId === home.id)!;
    expect(homeSt.played).toBe(1);
    expect(afterMatch.clubs[home.id].finances.balance).toBeGreaterThan(home.finances.balance);
  });

  it('respeita abertura/fechamento de janelas de transferências, negociações e pré-acordos futuros', () => {
    expect(isTransferWindowOpen('2026-01-15').open).toBe(true);
    expect(isTransferWindowOpen('2026-04-15').open).toBe(false);
    expect(isTransferWindowOpen('2026-07-15').open).toBe(true);

    const state = createNewGameState('palestra-sp', 'Tester', 107);
    const buyer = state.clubs[state.userClubId];
    const target = Object.values(state.players).find(
      (p) => p.clubId !== buyer.id && p.marketValue < buyer.finances.transferBudget * 0.4,
    )!;
    const seller = state.clubs[target.clubId];

    const clubBid = evaluateClubBid(target, seller, target.marketValue * 1.35, false);
    expect(clubBid.accepted).toBe(true);

    const playerDec = evaluatePlayerTransferDecision(
      target,
      buyer,
      seller,
      state.players,
      target.contract.salary * 1.5,
      4,
      'Titular fixo',
      () => 0.99,
    );
    expect(playerDec.accepted).toBe(true);

    const afterTransfer = executeCompletedTransfer(state, {
      playerId: target.id,
      buyerClubId: buyer.id,
      sellerClubId: seller.id,
      fee: target.marketValue,
      salary: target.contract.salary * 1.4,
      contractYears: 4,
      role: 'Titular fixo',
    });
    expect(afterTransfer.players[target.id].clubId).toBe(buyer.id);
    expect(afterTransfer.clubs[buyer.id].finances.balance).toBeLessThan(buyer.finances.balance);

    // Pré-acordo futuro
    const closedState = { ...state, currentDate: '2026-04-10' };
    const withPre = scheduleFutureTransfer(closedState, {
      playerId: target.id,
      buyerClubId: buyer.id,
      sellerClubId: seller.id,
      fee: target.marketValue,
      salary: target.contract.salary * 1.4,
      contractYears: 3,
      role: 'Titular rotativo',
    });
    expect(withPre.pendingFutureTransfers).toHaveLength(1);
    expect(withPre.pendingFutureTransfers[0].effectiveDate).toBe('2026-07-01');
  });

  it('opera leilões competitivos onde projeto esportivo e prazo encerram negociação', () => {
    let state = createNewGameState('palestra-sp', 'Tester', 108);
    const rng = createSeededRng(777);
    const target = Object.values(state.players).find(
      (p) => p.clubId !== state.userClubId && calculateBaseOverall(p) >= 75 && p.marketValue < 15_000_000,
    )!;
    const seller = state.clubs[target.clubId];
    const auc = createPlayerAuction(target, seller, state.currentDate, 2);
    state = { ...state, auctions: [auc, ...state.auctions] };

    const bidRes = submitAuctionBid(
      state,
      auc.id,
      state.userClubId,
      auc.reservePrice + 500_000,
      target.contract.salary * 1.4,
      'Titular fixo',
    );
    expect(bidRes.error).toBeUndefined();
    state = { ...bidRes.state, currentDate: auc.deadlineDate };

    const resolved = processDailyAuctions(state, rng);
    const closed = resolved.auctions.find((a) => a.id === auc.id)!;
    expect(closed.status).toBe('Encerrado');
    expect(closed.winnerClubId).toBeDefined();
  });

  it('expande estádio, calcula bilheteria elástica, trata lesões na enfermaria e gerencia finanças/tempo', () => {
    const state = createNewGameState('palestra-sp', 'Tester', 109);
    const club = state.clubs[state.userClubId];
    const away = Object.values(state.clubs).find((c) => c.id !== club.id)!;

    // Estádio & Bilheteria
    const forecast = calculateMatchdayBoxOffice(club, away, 8);
    expect(forecast.attendance).toBeGreaterThan(10_000);
    expect(forecast.totalRevenue).toBeGreaterThan(500_000);

    const construction = createStadiumConstruction(club.stadium, 'iluminacao', state.currentDate);
    if (construction) {
      let st = { ...club.stadium, activeConstructions: [construction] };
      const origLevel = st.lightingLevel;
      for (let d = 0; d < construction.totalDays; d++) {
        st = advanceStadiumConstructions(st).stadium;
      }
      expect(st.lightingLevel).toBe(origLevel + 1);
    }

    // Enfermaria
    const healthy = Object.values(state.players).find((p) => p.clubId === club.id && !p.injury)!;
    const inj = generateInjury(healthy, 'Partida', state.currentDate, club.medicalStaff, createSeededRng(33));
    let injPlayer: Player = { ...healthy, injury: inj };
    let recovered = false;
    for (let d = 0; d < inj.totalDays + 5; d++) {
      const r = advanceDailyMedicalRecovery(injPlayer, club.medicalStaff);
      injPlayer = r.player;
      if (r.recoveredToday) {
        recovered = true;
        break;
      }
    }
    expect(recovered).toBe(true);
    expect(injPlayer.injury).toBeNull();
    expect(injPlayer.returnToPlaySharpness).toBeLessThan(100);

    // Finanças e empréstimo bancário
    const afterLoan = takeBankLoan(club, 5_000_000, 12, 12, 'Banco Nacional', state.currentDate);
    expect(afterLoan.finances.balance).toBe(club.finances.balance + 5_000_000);
    const afterMonth = processMonthlyFinances(
      afterLoan,
      Object.values(state.players).filter((p) => p.clubId === club.id),
      '2026-02-01',
    );
    expect(afterMonth.finances.transactions.length).toBeGreaterThan(afterLoan.finances.transactions.length);

    // Desenvolvimento por idade
    const young = Object.values(state.players).find((p) => p.age <= 20)!;
    const devRes = processMonthlyDevelopment(young, club.coaches, club.stadium.infrastructureLevel, createSeededRng(12));
    expect(devRes.player.developmentProgress).not.toBe(young.developmentProgress);

    // Avanço de dias
    const nextDay = advanceOneDay(state, createSeededRng(44));
    expect(nextDay.state.currentDate).toBe('2026-01-06');
  });

  it('simula progressão de temporada inteira com jogos IA, mata-mata, finanças e virada para nova temporada', () => {
    let state = createNewGameState('palestra-sp', 'Tester', 2026);
    const rng = createSeededRng(12345);

    // Avança 365 dias simulando também cada partida do usuário quando chega o dia
    for (let day = 0; day < 366; day++) {
      const step = advanceOneDay(state, rng);
      state = step.state;
      if (step.userMatchToday) {
        const hc = state.clubs[step.userMatchToday.homeClubId];
        const ac = state.clubs[step.userMatchToday.awayClubId];
        const { fixture, session } = simulateMatchInstant(
          step.userMatchToday,
          hc,
          ac,
          state.players,
          state.currentDate,
          rng,
        );
        state = applyCompletedFixtureToState(state, fixture, session.newInjuries);
      }
      if (state.season === 2027) break;
    }

    expect(state.season).toBe(2027);
    expect(state.seasonHistory.length).toBe(1);
    expect(state.seasonHistory[0].season).toBe(2026);
    expect(state.seasonHistory[0].leaguePosition).toBeGreaterThanOrEqual(1);
    expect(state.seasonHistory[0].leaguePosition).toBeLessThanOrEqual(16);
    // Verifica que todas as competições foram recriadas para 2027
    expect(state.competitions.every((c) => c.season === 2027)).toBe(true);
  });
});
