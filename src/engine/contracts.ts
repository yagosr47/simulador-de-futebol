import {
  Club,
  ContractRole,
  DissatisfactionLevel,
  NewsMessage,
  Player,
} from '../types/game';
import { addDays, clamp, ROLE_EXPECTED_START_RATIO } from './constants';
import { calculateBaseOverall } from './overall';
import { calculateFairMonthlySalary, calculateMarketValue } from './development';

export function evaluateContractAfterMatch(
  clubPlayers: Player[],
  starterIds: Set<string>,
  subInIds: Set<string>,
  currentDate: string,
): { updatedPlayers: Player[]; complaints: NewsMessage[] } {
  const updatedPlayers: Player[] = [];
  const complaints: NewsMessage[] = [];

  for (const original of clubPlayers) {
    // Lesionados não reclamam de falta de minutagem
    if (original.injury) {
      updatedPlayers.push(original);
      continue;
    }

    const started = starterIds.has(original.id);
    const appeared = started || subInIds.has(original.id);

    const considered = Math.min(10, original.contract.recentTeamMatchesConsidered + 1);
    // Média móvel dos últimos até 10 jogos
    const prevStarts =
      original.contract.recentTeamMatchesConsidered >= 10
        ? original.contract.recentPlayerStarts * 0.9
        : original.contract.recentPlayerStarts;
    const prevApps =
      original.contract.recentTeamMatchesConsidered >= 10
        ? original.contract.recentPlayerAppearances * 0.9
        : original.contract.recentPlayerAppearances;

    const nextStarts = Number((prevStarts + (started ? 1 : 0)).toFixed(2));
    const nextApps = Number((prevApps + (appeared ? 1 : 0)).toFixed(2));
    const actualStartRatio = considered > 0 ? nextStarts / considered : 1;
    const actualAppRatio = considered > 0 ? nextApps / considered : 1;

    const expected = ROLE_EXPECTED_START_RATIO[original.contract.role];

    // Jovem promessa e reserva consideram aparições (incluindo banco) de maneira favorável
    const effectiveRatio =
      original.contract.role === 'Reserva' || original.contract.role === 'Jovem promessa'
        ? actualStartRatio * 0.5 + actualAppRatio * 0.5
        : original.contract.role === 'Volátil'
          ? actualStartRatio * 0.7 + actualAppRatio * 0.3
          : actualStartRatio;

    let points = original.contract.dissatisfactionPoints;

    // Só começa a cobrar fortemente após pelo menos 2 partidas
    if (considered >= 2) {
      const deficit = expected - effectiveRatio;
      const personalityWeight =
        original.personality === 'Temperamental' || original.personality === 'Ambicioso'
          ? 1.35
          : original.personality === 'Leal' || original.personality === 'Profissional'
            ? 0.72
            : 1.0;

      if (deficit > 0.12) {
        points = clamp(points + Math.round(deficit * 44 * personalityWeight), 0, 100);
      } else if (started || (appeared && original.contract.role !== 'Titular fixo')) {
        // Reversível conforme a situação do jogador melhora!
        points = clamp(points - (started ? 18 : 10), 0, 100);
      } else {
        points = clamp(points - 4, 0, 100);
      }
    }

    // Salário muito defasado também pode gerar insatisfação moderada
    const fairSalary = calculateFairMonthlySalary(original);
    if (original.contract.salary < fairSalary * 0.65 && calculateBaseOverall(original) >= 75) {
      points = clamp(points + 4, 0, 100);
    }

    const level: DissatisfactionLevel =
      points >= 70 ? 'Elevada' : points >= 42 ? 'Moderada' : points >= 20 ? 'Leve' : 'Satisfeito';

    let moral = original.conditional.moral;
    let confianca = original.conditional.confianca;
    let requestedTransfer = original.contract.requestedTransfer;
    let requestedRenegotiation = original.contract.requestedRenegotiation;
    let lastComplaintDate = original.contract.lastComplaintDate;

    if (level === 'Elevada') {
      moral = clamp(moral - 7, 15, 100);
      confianca = clamp(confianca - 6, 15, 100);
      requestedTransfer = true;
      requestedRenegotiation = true;
    } else if (level === 'Moderada') {
      moral = clamp(moral - 4, 20, 100);
      confianca = clamp(confianca - 3, 20, 100);
      requestedRenegotiation = true;
    } else if (level === 'Satisfeito') {
      requestedTransfer = false;
      if (started) {
        moral = clamp(moral + 3, 15, 100);
        confianca = clamp(confianca + 2, 15, 100);
      }
      if (points < 10) requestedRenegotiation = false;
    }

    // Gera reclamação no painel caso tenha piorado de faixa
    const worsened =
      (level === 'Moderada' && original.contract.dissatisfaction !== 'Moderada' && original.contract.dissatisfaction !== 'Elevada') ||
      (level === 'Elevada' && original.contract.dissatisfaction !== 'Elevada');

    if (worsened) {
      lastComplaintDate = currentDate;
      complaints.push({
        id: `complaint-${original.id}-${currentDate}`,
        date: currentDate,
        category: 'Elenco',
        title:
          level === 'Elevada'
            ? `${original.shortName} pediu transferência!`
            : `${original.shortName} está insatisfeito com seu papel`,
        body:
          level === 'Elevada'
            ? `Contratado como "${original.contract.role}", ${original.fullName} está muito insatisfeito com a falta de oportunidades. Seus atributos mentais e condicionais sofreram penalidade temporária (-5) e ele solicitou transferência ou renegociação urgente.`
            : `${original.fullName} esperava atuar mais conforme o contrato de "${original.contract.role}". Ele sofreu queda de moral e penalidade temporária (-3 mentais). Dê minutos em campo ou renegocie seu contrato.`,
        read: false,
        actionPage: 'player_profile',
        relatedId: original.id,
        severity: level === 'Elevada' ? 'danger' : 'warning',
      });
    }

    updatedPlayers.push({
      ...original,
      conditional: {
        ...original.conditional,
        moral,
        confianca,
      },
      contract: {
        ...original.contract,
        recentTeamMatchesConsidered: considered,
        recentPlayerStarts: nextStarts,
        recentPlayerAppearances: nextApps,
        dissatisfaction: level,
        dissatisfactionPoints: points,
        requestedTransfer,
        requestedRenegotiation,
        lastComplaintDate,
      },
    });
  }

  return { updatedPlayers, complaints };
}

export interface ContractNegotiationOffer {
  salary: number;
  years: number;
  role: ContractRole;
}

export interface ContractNegotiationResponse {
  accepted: boolean;
  reason: string;
  counterOffer?: ContractNegotiationOffer;
  updatedPlayer?: Player;
}

export function evaluateContractRenewal(
  player: Player,
  club: Club,
  offer: ContractNegotiationOffer,
  currentDate: string,
): ContractNegotiationResponse {
  const ovr = calculateBaseOverall(player);
  const fairSalary = calculateFairMonthlySalary(player);

  // Salário exigido depende de personalidade, overall e insatisfação atual
  let salaryMult = 1.02;
  if (player.personality === 'Mercenário') salaryMult = 1.28;
  else if (player.personality === 'Ambicioso') salaryMult = 1.15;
  else if (player.personality === 'Leal') salaryMult = 0.92;
  if (player.contract.dissatisfaction === 'Elevada') salaryMult += 0.14;

  const desiredSalary = Math.round((Math.max(fairSalary, player.contract.salary * 1.05) * salaryMult) / 5_000) * 5_000;

  // Papel mínimo aceito baseado no overall relativo ao clube
  const roleRank: Record<ContractRole, number> = {
    'Titular fixo': 5,
    'Titular rotativo': 4,
    Volátil: 3,
    'Jovem promessa': 2,
    Reserva: 1,
  };
  let minRoleRank = 1;
  if (ovr >= club.reputation + 2) minRoleRank = 5;
  else if (ovr >= club.reputation - 3) minRoleRank = 4;
  else if (ovr >= club.reputation - 8) minRoleRank = 3;
  else if (player.age <= 21) minRoleRank = 2;

  const minRoleEntry = (Object.entries(roleRank).find(([, r]) => r === minRoleRank)?.[0] ??
    'Titular rotativo') as ContractRole;

  // Duração desejada
  const desiredYears = player.age >= 32 ? 2 : player.age <= 22 ? 4 : 3;

  // Avaliação do aceite
  const salaryRatio = offer.salary / Math.max(1, desiredSalary);
  const roleOk = roleRank[offer.role] >= minRoleRank || salaryRatio >= 1.25;
  const yearsOk = offer.years >= Math.min(2, desiredYears) && (player.age >= 31 || offer.years >= 2);

  if (salaryRatio >= 0.95 && roleOk && yearsOk) {
    const newEndDate = addDays(currentDate, offer.years * 365);
    const updatedPlayer: Player = {
      ...player,
      conditional: {
        ...player.conditional,
        moral: clamp(player.conditional.moral + 15, 20, 100),
        confianca: clamp(player.conditional.confianca + 12, 20, 100),
      },
      contract: {
        ...player.contract,
        salary: offer.salary,
        yearsRemaining: offer.years,
        endDate: newEndDate,
        role: offer.role,
        expectedStartRatio: ROLE_EXPECTED_START_RATIO[offer.role],
        releaseClause: Math.round(calculateMarketValue(player) * 1.85),
        dissatisfaction: 'Satisfeito',
        dissatisfactionPoints: 0,
        requestedTransfer: false,
        requestedRenegotiation: false,
      },
    };
    updatedPlayer.marketValue = calculateMarketValue(updatedPlayer);

    return {
      accepted: true,
      reason: `${player.shortName} aceitou a proposta de renovação como "${offer.role}" por ${offer.years} ano(s)! Sua moral e satisfação foram restauradas.`,
      updatedPlayer,
    };
  }

  const reasons: string[] = [];
  if (salaryRatio < 0.95) {
    reasons.push(`considera o salário abaixo do esperado (deseja em torno de R$ ${desiredSalary.toLocaleString('pt-BR')}/mês)`);
  }
  if (!roleOk) {
    reasons.push(`exige no mínimo o papel de "${minRoleEntry}" no elenco`);
  }
  if (!yearsOk) {
    reasons.push(`prefere um contrato mais estável de ${desiredYears} anos`);
  }

  return {
    accepted: false,
    reason: `${player.shortName} recusou os termos atuais porque ${reasons.join(' e ')}.`,
    counterOffer: {
      salary: desiredSalary,
      years: desiredYears,
      role: roleRank[offer.role] >= minRoleRank ? offer.role : minRoleEntry,
    },
  };
}
