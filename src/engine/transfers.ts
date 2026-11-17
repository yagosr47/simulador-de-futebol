import {
  Club,
  ContractRole,
  GameState,
  NewsMessage,
  PendingFutureTransfer,
  Player,
  Position,
  TransferOffer,
} from '../types/game';
import { addDays, clamp, FORMATIONS, isTransferWindowOpen, ROLE_EXPECTED_START_RATIO } from './constants';
import { autoSelectBestLineup, calculateBaseOverall } from './overall';
import { calculateFairMonthlySalary, calculateMarketValue } from './development';
import { recordTransaction } from './economy';

export interface TransferSearchFilters {
  query: string;
  position: Position | 'ALL';
  minAge: number;
  maxAge: number;
  minOverall: number;
  maxOverall: number;
  minPotential: number;
  nationality: string;
  maxValue: number;
  onlyListed: boolean;
}

export function searchMarketPlayers(
  players: Record<string, Player>,
  userClubId: string,
  filters: TransferSearchFilters,
): Player[] {
  const q = filters.query.trim().toLowerCase();
  return Object.values(players)
    .filter((p) => p.clubId !== userClubId)
    .filter((p) => {
      if (q && !p.fullName.toLowerCase().includes(q) && !p.shortName.toLowerCase().includes(q)) {
        return false;
      }
      if (filters.position !== 'ALL' && p.primaryPosition !== filters.position && p.secondaryPosition !== filters.position) {
        return false;
      }
      if (p.age < filters.minAge || p.age > filters.maxAge) return false;
      const ovr = calculateBaseOverall(p);
      if (ovr < filters.minOverall || ovr > filters.maxOverall) return false;
      if (p.potential < filters.minPotential) return false;
      if (filters.nationality !== 'ALL' && p.nationality !== filters.nationality) return false;
      if (p.marketValue > filters.maxValue) return false;
      if (filters.onlyListed && !p.isTransferListed && !p.isLoanListed) return false;
      return true;
    })
    .sort((a, b) => calculateBaseOverall(b) - calculateBaseOverall(a));
}

export interface ClubBidEvaluation {
  accepted: boolean;
  counterFee?: number;
  reason: string;
}

export function evaluateClubBid(
  player: Player,
  sellerClub: Club,
  fee: number,
  isLoan: boolean,
): ClubBidEvaluation {
  const value = calculateMarketValue(player);
  const asking = player.askingPrice ?? Math.round(value * (player.isTransferListed ? 0.92 : 1.18));

  if (isLoan) {
    const minLoanFee = Math.round(value * 0.08);
    if (!player.isLoanListed && player.contract.role === 'Titular fixo') {
      return {
        accepted: false,
        reason: `O ${sellerClub.name} não aceita emprestar um titular absoluto como ${player.shortName}.`,
      };
    }
    if (fee >= minLoanFee || (player.isLoanListed && fee >= minLoanFee * 0.5)) {
      return {
        accepted: true,
        reason: `O ${sellerClub.name} aceitou a proposta de empréstimo de ${player.shortName}!`,
      };
    }
    return {
      accepted: false,
      counterFee: minLoanFee,
      reason: `O ${sellerClub.name} pede pelo menos R$ ${minLoanFee.toLocaleString('pt-BR')} de taxa pelo empréstimo.`,
    };
  }

  // Jogador que pediu transferência sai mais barato
  const discount = player.contract.requestedTransfer ? 0.85 : 1.0;
  const minAccept = Math.round((asking * discount) / 50_000) * 50_000;

  if (fee >= minAccept) {
    return {
      accepted: true,
      reason: `O ${sellerClub.name} aceitou a oferta de R$ ${fee.toLocaleString('pt-BR')} por ${player.shortName}! Agora negocie os termos com o jogador.`,
    };
  }

  if (fee >= minAccept * 0.72) {
    const counter = Math.round(((minAccept + fee) / 2) / 50_000) * 50_000;
    return {
      accepted: false,
      counterFee: Math.max(counter, Math.round(minAccept * 0.94)),
      reason: `O ${sellerClub.name} achou o valor baixo, mas está disposto a fechar por R$ ${Math.max(
        counter,
        Math.round(minAccept * 0.94),
      ).toLocaleString('pt-BR')}.`,
    };
  }

  return {
    accepted: false,
    counterFee: minAccept,
    reason: `Proposta recusada! O ${sellerClub.name} avalia ${player.shortName} em R$ ${minAccept.toLocaleString('pt-BR')}.`,
  };
}

export interface PlayerTransferDecision {
  accepted: boolean;
  changedMind: boolean;
  reason: string;
  desiredSalary: number;
  desiredYears: number;
  desiredRole: ContractRole;
  projectScore: number; // 0..100
}

/**
 * Avalia decisão do jogador com personalidade e interesses próprios:
 * - Salário oferecido
 * - Reputação do clube e qualidade do elenco
 * - Competições / projeto esportivo
 * - Tempo de jogo (ContractRole prometido)
 * - Posição preferida compatível com a formação do clube
 * - Duração do contrato
 * - Possibilidade realista de mudar de ideia durante a negociação
 */
export function evaluatePlayerTransferDecision(
  player: Player,
  buyingClub: Club,
  currentClub: Club,
  allPlayers: Record<string, Player>,
  offeredSalary: number,
  contractYears: number,
  promisedRole: ContractRole,
  rng: () => number = Math.random,
): PlayerTransferDecision {
  const ovr = calculateBaseOverall(player);
  const fairSalary = calculateFairMonthlySalary(player);

  // Salário exigido pela personalidade
  let wageMult = 1.08;
  if (player.personality === 'Mercenário') wageMult = 1.35;
  else if (player.personality === 'Ambicioso') wageMult = 1.18;
  else if (player.personality === 'Leal') wageMult = 1.14; // exige mais para deixar clube atual
  else if (player.personality === 'Profissional') wageMult = 1.05;

  const repDiff = buyingClub.reputation - currentClub.reputation;
  if (repDiff < -6) wageMult += 0.2; // pede muito mais para ir a clube menor
  if (repDiff > 8) wageMult -= 0.08; // aceita um pouco menos por clube gigante

  const desiredSalary = Math.round((Math.max(fairSalary, player.contract.salary * 1.1) * wageMult) / 5_000) * 5_000;

  // Verifica se formação do clube usa a posição preferida do jogador
  const formationSlots = FORMATIONS[buyingClub.tactics.formation];
  const usesPrimaryPos = formationSlots.some((s) => s.position === player.primaryPosition);
  const usesSecondaryPos = player.secondaryPosition
    ? formationSlots.some((s) => s.position === player.secondaryPosition)
    : false;
  const positionFitScore = usesPrimaryPos ? 15 : usesSecondaryPos ? 8 : -10;

  // Qualidade do elenco comprador
  const buyerSquad = Object.values(allPlayers).filter((p) => p.clubId === buyingClub.id);
  const avgBuyerOvr =
    buyerSquad.length > 0
      ? buyerSquad.reduce((a, p) => a + calculateBaseOverall(p), 0) / buyerSquad.length
      : buyingClub.reputation - 5;

  // Papel exigido
  const roleRank: Record<ContractRole, number> = {
    'Titular fixo': 5,
    'Titular rotativo': 4,
    Volátil: 3,
    'Jovem promessa': 2,
    Reserva: 1,
  };
  let neededRank = 2;
  if (ovr >= avgBuyerOvr + 3) neededRank = 5;
  else if (ovr >= avgBuyerOvr - 2) neededRank = 4;
  else if (ovr >= avgBuyerOvr - 6) neededRank = 3;
  if (player.age <= 20 && ovr < avgBuyerOvr - 2) neededRank = Math.min(neededRank, 2);
  if (player.personality === 'Ambicioso') neededRank = Math.min(5, neededRank + 1);

  const desiredRole = (Object.entries(roleRank).find(([, v]) => v === neededRank)?.[0] ??
    'Titular rotativo') as ContractRole;
  const desiredYears = player.age >= 32 ? 2 : player.age <= 23 ? 4 : 3;

  // Score do projeto esportivo (0..100)
  const salaryScore = clamp((offeredSalary / Math.max(1, desiredSalary)) * 36, 5, 44);
  const reputationScore = clamp((buyingClub.reputation / 100) * 28 + repDiff * 0.7, 5, 34);
  const roleScore = roleRank[promisedRole] >= neededRank ? 16 : -14;
  const durationScore =
    contractYears >= desiredYears ? 8 : contractYears === desiredYears - 1 ? 3 : -8;
  const loyaltyPenalty = player.personality === 'Leal' && !player.contract.requestedTransfer ? -9 : 0;

  const projectScore = clamp(
    Math.round(salaryScore + reputationScore + roleScore + durationScore + positionFitScore + loyaltyPenalty),
    0,
    100,
  );

  // Chance de mudar de ideia durante negociação (maior se Temperamental ou proposta no limite)
  const changeMindProb =
    player.personality === 'Temperamental' ? 0.14 : projectScore < 68 ? 0.08 : 0.03;
  const changedMind = projectScore >= 60 && projectScore < 76 && rng() < changeMindProb;

  if (changedMind) {
    return {
      accepted: false,
      changedMind: true,
      reason: `${player.shortName} mudou de ideia de última hora durante a negociação! Seu empresário informou que ele quer repensar o futuro e pede um salário maior (R$ ${Math.round(
        desiredSalary * 1.12,
      ).toLocaleString('pt-BR')}/mês).`,
      desiredSalary: Math.round((desiredSalary * 1.12) / 5_000) * 5_000,
      desiredYears,
      desiredRole,
      projectScore,
    };
  }

  // Condições de aceite
  const salaryOk = offeredSalary >= desiredSalary * 0.94;
  const roleOk = roleRank[promisedRole] >= neededRank || offeredSalary >= desiredSalary * 1.25;
  const repOk = !(player.personality === 'Ambicioso' && repDiff < -10 && offeredSalary < desiredSalary * 1.35);

  if (projectScore >= 66 && salaryOk && roleOk && repOk) {
    return {
      accepted: true,
      changedMind: false,
      reason: `${player.shortName} ficou entusiasmado com o projeto esportivo do ${buyingClub.name} e aceitou assinar contrato!`,
      desiredSalary,
      desiredYears,
      desiredRole,
      projectScore,
    };
  }

  const objections: string[] = [];
  if (!repOk) {
    objections.push(`busca um clube mais competitivo (reputação maior que o ${buyingClub.shortName})`);
  }
  if (!salaryOk) {
    objections.push(`pede salário de pelo menos R$ ${desiredSalary.toLocaleString('pt-BR')}/mês`);
  }
  if (!roleOk) {
    objections.push(`exige garantia mínima de "${desiredRole}"`);
  }
  if (!usesPrimaryPos && !usesSecondaryPos) {
    objections.push(`não vê espaço para sua posição natural (${player.primaryPosition}) na formação ${buyingClub.tactics.formation}`);
  }
  if (contractYears < desiredYears - 1) {
    objections.push(`prefere um vínculo mais longo (${desiredYears} anos)`);
  }
  if (objections.length === 0) {
    objections.push('não se sentiu totalmente convencido pelo pacote financeiro e esportivo');
  }

  return {
    accepted: false,
    changedMind: false,
    reason: `${player.shortName} recusou a oferta pessoal: ${objections.join('; ')}.`,
    desiredSalary,
    desiredYears,
    desiredRole,
    projectScore,
  };
}

export function executeCompletedTransfer(
  state: GameState,
  params: {
    playerId: string;
    buyerClubId: string;
    sellerClubId: string;
    fee: number;
    salary: number;
    contractYears: number;
    role: ContractRole;
    isLoan?: boolean;
  },
): GameState {
  const player = state.players[params.playerId];
  const buyer = state.clubs[params.buyerClubId];
  const seller = state.clubs[params.sellerClubId];
  if (!player || !buyer || !seller) return state;

  const isLoan = Boolean(params.isLoan);
  const transferLabel = isLoan ? 'Empréstimo' : 'Compra';

  // Finanças
  let nextBuyer = recordTransaction(
    buyer,
    state.currentDate,
    'despesa',
    'Transferências',
    `${transferLabel} de ${player.shortName} (${seller.shortName})`,
    params.fee,
    true,
  );
  let nextSeller = recordTransaction(
    seller,
    state.currentDate,
    'receita',
    'Transferências',
    `${isLoan ? 'Empréstimo' : 'Venda'} de ${player.shortName} para ${buyer.shortName}`,
    params.fee,
    true,
  );

  // Atualiza histórico do jogador
  const updatedHistory = player.clubHistory.map((h, idx) =>
    idx === player.clubHistory.length - 1 && !h.seasonEnd ? { ...h, seasonEnd: state.season } : h,
  );
  updatedHistory.push({
    clubId: buyer.id,
    clubName: buyer.name,
    seasonStart: state.season,
    matches: 0,
    goals: 0,
    assists: 0,
    avgRating: 0,
  });

  const nextPlayer: Player = {
    ...player,
    clubId: buyer.id,
    loanedFromClubId: isLoan ? seller.id : undefined,
    loanEndDate: isLoan ? addDays(state.currentDate, 365) : undefined,
    isTransferListed: false,
    isLoanListed: false,
    askingPrice: undefined,
    conditional: {
      ...player.conditional,
      moral: clamp(player.conditional.moral + 10, 40, 100),
      confianca: clamp(player.conditional.confianca + 8, 40, 100),
    },
    contract: {
      ...player.contract,
      salary: params.salary,
      yearsRemaining: isLoan ? 1 : params.contractYears,
      endDate: addDays(state.currentDate, (isLoan ? 1 : params.contractYears) * 365),
      role: params.role,
      expectedStartRatio: ROLE_EXPECTED_START_RATIO[params.role],
      recentTeamMatchesConsidered: 0,
      recentPlayerStarts: 0,
      recentPlayerAppearances: 0,
      dissatisfaction: 'Satisfeito',
      dissatisfactionPoints: 0,
      requestedTransfer: false,
      requestedRenegotiation: false,
    },
    chemistry: {
      ...player.chemistry,
      daysAtClub: 0,
      tacticalFamiliarity: clamp(Math.round(player.chemistry.tacticalFamiliarity * 0.65), 35, 72),
    },
    clubHistory: updatedHistory,
  };
  nextPlayer.marketValue = calculateMarketValue(nextPlayer);

  const nextPlayers: Record<string, Player> = {
    ...state.players,
    [nextPlayer.id]: nextPlayer,
  };

  // Reajusta escalação do vendedor (remove jogador vendido) e do comprador (se IA)
  const sellerSquad = Object.values(nextPlayers).filter((p) => p.clubId === seller.id);
  const sellerLineup = autoSelectBestLineup(nextSeller, sellerSquad);
  nextSeller = {
    ...nextSeller,
    tactics: {
      ...nextSeller.tactics,
      startingXI: sellerLineup.startingXI,
      bench: sellerLineup.bench,
    },
  };

  if (!nextBuyer.isUserClub) {
    const buyerSquad = Object.values(nextPlayers).filter((p) => p.clubId === buyer.id);
    const buyerLineup = autoSelectBestLineup(nextBuyer, buyerSquad);
    nextBuyer = {
      ...nextBuyer,
      tactics: {
        ...nextBuyer.tactics,
        startingXI: buyerLineup.startingXI,
        bench: buyerLineup.bench,
      },
    };
  } else {
    // Adiciona ao banco do usuário se houver espaço
    if (!nextBuyer.tactics.bench.includes(nextPlayer.id) && nextBuyer.tactics.bench.length < 9) {
      nextBuyer = {
        ...nextBuyer,
        tactics: {
          ...nextBuyer.tactics,
          bench: [...nextBuyer.tactics.bench, nextPlayer.id],
        },
      };
    }
  }

  // Recordes e marcos do clube do usuário
  let nextRecords = { ...state.clubRecords };
  const nextMilestones = [...state.milestones];

  if (!isLoan && buyer.id === state.userClubId) {
    if (!nextRecords.recordSigning || params.fee > nextRecords.recordSigning.fee) {
      nextRecords.recordSigning = {
        playerName: player.fullName,
        fee: params.fee,
        date: state.currentDate,
      };
    }
    if (params.fee >= 5_000_000) {
      nextMilestones.unshift({
        id: `ms-sign-${player.id}-${state.currentDate}`,
        date: state.currentDate,
        season: state.season,
        title: `Contratação de ${player.shortName}`,
        description: `Chegou do ${seller.name} por R$ ${params.fee.toLocaleString('pt-BR')}.`,
        category: 'Transferência',
      });
    }
  }

  if (!isLoan && seller.id === state.userClubId) {
    if (!nextRecords.recordSale || params.fee > nextRecords.recordSale.fee) {
      nextRecords.recordSale = {
        playerName: player.fullName,
        fee: params.fee,
        date: state.currentDate,
      };
    }
  }

  const trNews: NewsMessage = {
    id: `news-tr-${player.id}-${state.currentDate}-${Math.random().toString(36).slice(2, 5)}`,
    date: state.currentDate,
    category: 'Mercado',
    title: `${isLoan ? 'Empréstimo fechado' : 'Transferência concluída'}: ${player.shortName}`,
    body: `${player.fullName} trocou o ${seller.name} pelo ${buyer.name} por R$ ${params.fee.toLocaleString(
      'pt-BR',
    )} (${params.role}).`,
    read: false,
    actionPage: 'transfers',
    severity: buyer.id === state.userClubId ? 'success' : 'info',
  };

  return {
    ...state,
    clubs: {
      ...state.clubs,
      [nextBuyer.id]: nextBuyer,
      [nextSeller.id]: nextSeller,
    },
    players: nextPlayers,
    clubRecords: nextRecords,
    milestones: nextMilestones.slice(0, 60),
    news: [trNews, ...state.news].slice(0, 80),
  };
}

export function scheduleFutureTransfer(
  state: GameState,
  params: {
    playerId: string;
    buyerClubId: string;
    sellerClubId: string;
    fee: number;
    salary: number;
    contractYears: number;
    role: ContractRole;
  },
): GameState {
  const win = isTransferWindowOpen(state.currentDate);
  const effectiveDate = win.open ? state.currentDate : win.nextOpenDate;
  const player = state.players[params.playerId];
  const seller = state.clubs[params.sellerClubId];
  if (!player || !seller) return state;

  const pending: PendingFutureTransfer = {
    id: `fut-${params.playerId}-${effectiveDate}`,
    playerId: params.playerId,
    fromClubId: params.sellerClubId,
    toClubId: params.buyerClubId,
    fee: params.fee,
    salary: params.salary,
    contractYears: params.contractYears,
    role: params.role,
    effectiveDate,
  };

  const preNews: NewsMessage = {
    id: `news-pre-${player.id}-${state.currentDate}`,
    date: state.currentDate,
    category: 'Mercado',
    title: `Pré-acordo assinado com ${player.shortName}!`,
    body: `Como a janela está fechada, ${player.fullName} se juntará ao elenco automaticamente na abertura da próxima janela (${effectiveDate}) por R$ ${params.fee.toLocaleString(
      'pt-BR',
    )}.`,
    read: false,
    actionPage: 'transfers',
    severity: 'success',
  };

  return {
    ...state,
    pendingFutureTransfers: [...state.pendingFutureTransfers, pending],
    news: [preNews, ...state.news].slice(0, 80),
  };
}

export function generateIncomingTransferOffer(
  state: GameState,
  rng: () => number = Math.random,
): TransferOffer | null {
  const win = isTransferWindowOpen(state.currentDate);
  if (!win.open) return null;

  const userClub = state.clubs[state.userClubId];
  const userPlayers = Object.values(state.players).filter(
    (p) => p.clubId === userClub.id && !p.loanedFromClubId && !p.injury,
  );
  if (userPlayers.length <= 16) return null;

  // Prioriza jogadores listados ou destaques
  const candidates = userPlayers.filter(
    (p) => p.isTransferListed || p.isLoanListed || p.contract.requestedTransfer || calculateBaseOverall(p) >= 75,
  );
  if (candidates.length === 0) return null;
  const target = candidates[Math.floor(rng() * candidates.length)];

  // Evita duplicata pendente para o mesmo jogador
  if (state.transferOffers.some((o) => o.playerId === target.id && o.status === 'Pendente')) {
    return null;
  }

  const aiClubs = Object.values(state.clubs).filter(
    (c) => !c.isUserClub && c.finances.transferBudget > target.marketValue * 0.75,
  );
  if (aiClubs.length === 0) return null;

  const buyer = aiClubs[Math.floor(rng() * aiClubs.length)];
  const isLoan = target.isLoanListed && !target.isTransferListed && rng() < 0.65;
  const fee = isLoan
    ? Math.round((target.marketValue * (0.09 + rng() * 0.06)) / 50_000) * 50_000
    : Math.round((target.marketValue * (0.88 + rng() * 0.28)) / 50_000) * 50_000;

  return {
    id: `offer-${target.id}-${buyer.id}-${state.currentDate}`,
    playerId: target.id,
    fromClubId: buyer.id,
    toClubId: userClub.id,
    type: isLoan ? 'Empréstimo' : 'Compra',
    fee: Math.max(150_000, fee),
    offeredSalary: Math.round((target.contract.salary * 1.15) / 5_000) * 5_000,
    contractYears: 3,
    promisedRole: 'Titular rotativo',
    createdDate: state.currentDate,
    status: 'Pendente',
    isIncomingToUser: true,
  };
}
