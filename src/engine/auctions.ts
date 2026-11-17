import {
  AuctionBid,
  Club,
  ContractRole,
  GameState,
  NewsMessage,
  Player,
  PlayerAuction,
} from '../types/game';
import { addDays, clamp } from './constants';
import { calculateBaseOverall } from './overall';
import { calculateFairMonthlySalary } from './development';
import { evaluatePlayerTransferDecision, executeCompletedTransfer } from './transfers';

export function computeAuctionProjectScore(
  player: Player,
  biddingClub: Club,
  sellerClub: Club,
  allPlayers: Record<string, Player>,
  offeredSalary: number,
  promisedRole: ContractRole,
): number {
  const decision = evaluatePlayerTransferDecision(
    player,
    biddingClub,
    sellerClub,
    allPlayers,
    offeredSalary,
    3,
    promisedRole,
    () => 0.99, // determinístico para pontuação de projeto
  );
  return decision.projectScore;
}

export function createPlayerAuction(
  player: Player,
  sellerClub: Club,
  currentDate: string,
  durationDays = 5,
  customMinPrice?: number,
): PlayerAuction {
  const minimumPrice =
    customMinPrice ?? Math.max(400_000, Math.round((player.marketValue * 0.8) / 100_000) * 100_000);
  const reservePrice = Math.round((Math.max(minimumPrice, player.marketValue * 0.96)) / 100_000) * 100_000;

  return {
    id: `auc-${player.id}-${currentDate}-${Math.random().toString(36).slice(2, 6)}`,
    playerId: player.id,
    sellerClubId: sellerClub.id,
    minimumPrice,
    reservePrice,
    startDate: currentDate,
    deadlineDate: addDays(currentDate, durationDays),
    bids: [],
    status: 'Ativo',
  };
}

export function submitAuctionBid(
  state: GameState,
  auctionId: string,
  clubId: string,
  fee: number,
  offeredSalary: number,
  promisedRole: ContractRole,
): { state: GameState; error?: string } {
  const auction = state.auctions.find((a) => a.id === auctionId);
  if (!auction || auction.status !== 'Ativo') {
    return { state, error: 'Este leilão não está mais ativo.' };
  }
  const club = state.clubs[clubId];
  const player = state.players[auction.playerId];
  const seller = state.clubs[auction.sellerClubId];
  if (!club || !player || !seller) {
    return { state, error: 'Dados do leilão inválidos.' };
  }
  if (clubId === auction.sellerClubId) {
    return { state, error: 'O clube vendedor não pode dar lances no próprio jogador.' };
  }
  if (fee < auction.minimumPrice) {
    return {
      state,
      error: `O lance mínimo é R$ ${auction.minimumPrice.toLocaleString('pt-BR')}.`,
    };
  }
  if (club.finances.transferBudget < fee) {
    return { state, error: 'Orçamento de transferências insuficiente para este lance.' };
  }

  const projectScore = computeAuctionProjectScore(
    player,
    club,
    seller,
    state.players,
    offeredSalary,
    promisedRole,
  );

  const newBid: AuctionBid = {
    id: `bid-${clubId}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    clubId,
    clubName: club.name,
    fee,
    offeredSalary,
    promisedRole,
    timestampDate: state.currentDate,
    projectScore,
  };

  // Substitui lance anterior do mesmo clube (atualização de oferta)
  const filteredBids = auction.bids.filter((b) => b.clubId !== clubId);
  const updatedAuction: PlayerAuction = {
    ...auction,
    bids: [...filteredBids, newBid].sort((a, b) => b.fee - a.fee),
  };

  return {
    state: {
      ...state,
      auctions: state.auctions.map((a) => (a.id === auctionId ? updatedAuction : a)),
    },
  };
}

/**
 * Processa concorrência de clubes IA em leilões ativos e encerra os leilões no prazo.
 * O jogador pode escolher uma proposta com projeto esportivo + salário superiores
 * mesmo que o valor da transferência não seja o maior!
 */
export function processDailyAuctions(
  state: GameState,
  rng: () => number = Math.random,
): GameState {
  let nextState = state;
  const updatedAuctions: PlayerAuction[] = [];
  const toExecute: {
    auction: PlayerAuction;
    winningBid: AuctionBid;
    reason: string;
  }[] = [];

  for (const auction of nextState.auctions) {
    if (auction.status !== 'Ativo') {
      updatedAuctions.push(auction);
      continue;
    }

    const player = nextState.players[auction.playerId];
    const seller = nextState.clubs[auction.sellerClubId];
    if (!player || !seller || player.clubId !== auction.sellerClubId) {
      updatedAuctions.push({ ...auction, status: 'Cancelado' });
      continue;
    }

    let currentBids = [...auction.bids];
    const highestFee = currentBids.length > 0 ? Math.max(...currentBids.map((b) => b.fee)) : auction.minimumPrice;

    // 1. Clubes IA competem dando lances durante o leilão
    const aiBidders = Object.values(nextState.clubs).filter(
      (c) =>
        !c.isUserClub &&
        c.id !== auction.sellerClubId &&
        c.finances.transferBudget >= highestFee * 1.06,
    );

    const userHasBid = currentBids.some((b) => b.clubId === nextState.userClubId);

    for (const aiClub of aiBidders) {
      const alreadyLeading = currentBids[0]?.clubId === aiClub.id;
      if (alreadyLeading) continue;

      const ovr = calculateBaseOverall(player);
      const interestChance =
        (ovr >= aiClub.reputation - 5 ? 0.25 : 0.1) +
        (aiClub.philosophy === 'Base e Jovens' && player.age <= 22 ? 0.16 : 0) +
        (aiClub.philosophy === 'Galácticos' && ovr >= 80 ? 0.18 : 0);

      // Teto que este clube IA aceita pagar
      const maxWilling = Math.min(
        aiClub.finances.transferBudget * 0.82,
        player.marketValue * (aiClub.philosophy === 'Galácticos' ? 1.38 : 1.2),
      );

      if (highestFee < maxWilling && rng() < interestChance) {
        const increment = Math.max(150_000, Math.round((highestFee * (0.04 + rng() * 0.08)) / 50_000) * 50_000);
        const bidFee = Math.min(Math.round(maxWilling / 50_000) * 50_000, highestFee + increment);
        const fairSalary = calculateFairMonthlySalary(player);
        const aiSalary = Math.round((fairSalary * (1.02 + rng() * 0.25)) / 5_000) * 5_000;
        const aiRole: ContractRole = ovr >= aiClub.reputation ? 'Titular fixo' : 'Titular rotativo';

        const projectScore = computeAuctionProjectScore(
          player,
          aiClub,
          seller,
          nextState.players,
          aiSalary,
          aiRole,
        );

        currentBids = [
          ...currentBids.filter((b) => b.clubId !== aiClub.id),
          {
            id: `bid-${aiClub.id}-${nextState.currentDate}-${Math.floor(rng() * 10000)}`,
            clubId: aiClub.id,
            clubName: aiClub.name,
            fee: bidFee,
            offeredSalary: aiSalary,
            promisedRole: aiRole,
            timestampDate: nextState.currentDate,
            projectScore,
          },
        ].sort((a, b) => b.fee - a.fee);

        // Notifica usuário se foi superado no leilão!
        if (userHasBid && bidFee > (auction.bids.find((b) => b.clubId === nextState.userClubId)?.fee ?? 0)) {
          const outbidNews: NewsMessage = {
            id: `outbid-${auction.id}-${aiClub.id}-${nextState.currentDate}`,
            date: nextState.currentDate,
            category: 'Leilão',
            title: `Seu lance por ${player.shortName} foi superado!`,
            body: `O ${aiClub.name} cobriu sua oferta com R$ ${bidFee.toLocaleString('pt-BR')} no leilão por ${player.fullName}. Encerramento em ${auction.deadlineDate}.`,
            read: false,
            actionPage: 'auctions',
            severity: 'warning',
          };
          nextState = {
            ...nextState,
            news: [outbidNews, ...nextState.news].slice(0, 80),
          };
        }
        break; // no máximo 1 novo lance IA por dia por leilão para ritmo realista
      }
    }

    // 2. Verifica encerramento do prazo
    if (nextState.currentDate >= auction.deadlineDate) {
      // Vendedor filtra ofertas que atingiram pelo menos 88% do preço de reserva (ou aceita melhor se vendedor for IA flexível)
      const sellerAcceptable = currentBids.filter(
        (b) => b.fee >= auction.reservePrice * 0.88 || (currentBids.length >= 2 && b.fee >= auction.minimumPrice),
      );

      if (sellerAcceptable.length === 0) {
        updatedAuctions.push({
          ...auction,
          bids: currentBids,
          status: 'Encerrado',
          winningReason: `O ${seller.name} recusou as ofertas por ficarem abaixo do valor de reserva (R$ ${auction.reservePrice.toLocaleString('pt-BR')}).`,
        });
      } else {
        // Jogador decide entre as propostas aceitas pelo vendedor considerando Projeto Esportivo + Salário + Valor!
        const maxFee = Math.max(...sellerAcceptable.map((b) => b.fee));
        const ranked = sellerAcceptable
          .map((bid) => {
            const feeScore = (bid.fee / Math.max(1, maxFee)) * 100;
            // O jogador dá peso forte ao projeto esportivo + salário (62%) e 38% à força da oferta ao clube
            const combined = bid.projectScore * 0.62 + feeScore * 0.38;
            return { bid, combined };
          })
          .sort((a, b) => b.combined - a.combined);

        const winner = ranked[0].bid;
        const wasHighestFee = winner.fee >= maxFee;
        const reason = wasHighestFee
          ? `${player.shortName} fechou com o ${winner.clubName} pela melhor proposta financeira (R$ ${winner.fee.toLocaleString('pt-BR')}) e projeto esportivo (${winner.projectScore}/100).`
          : `Surpresa no leilão! ${player.shortName} recusou uma oferta financeira maior (R$ ${maxFee.toLocaleString(
              'pt-BR',
            )}) e escolheu o ${winner.clubName} (R$ ${winner.fee.toLocaleString(
              'pt-BR',
            )}) pelo projeto esportivo e salário (${winner.projectScore}/100)!`;

        const closedAuction: PlayerAuction = {
          ...auction,
          bids: currentBids,
          status: 'Encerrado',
          winnerClubId: winner.clubId,
          winningReason: reason,
        };
        updatedAuctions.push(closedAuction);
        toExecute.push({ auction: closedAuction, winningBid: winner, reason });
      }
    } else {
      updatedAuctions.push({ ...auction, bids: currentBids });
    }
  }

  nextState = { ...nextState, auctions: updatedAuctions };

  // Efetiva transferências vencedoras dos leilões encerrados
  for (const item of toExecute) {
    const p = nextState.players[item.auction.playerId];
    const buyer = nextState.clubs[item.winningBid.clubId];
    if (!p || !buyer || buyer.finances.transferBudget < item.winningBid.fee) continue;

    nextState = executeCompletedTransfer(nextState, {
      playerId: p.id,
      buyerClubId: item.winningBid.clubId,
      sellerClubId: item.auction.sellerClubId,
      fee: item.winningBid.fee,
      salary: item.winningBid.offeredSalary,
      contractYears: 3,
      role: item.winningBid.promisedRole,
    });

    const winNews: NewsMessage = {
      id: `auc-win-${item.auction.id}`,
      date: nextState.currentDate,
      category: 'Leilão',
      title: `Leilão encerrado: ${p.shortName} é do ${buyer.shortName}!`,
      body: item.reason,
      read: false,
      actionPage: 'auctions',
      severity: buyer.id === nextState.userClubId ? 'success' : 'info',
    };
    nextState = {
      ...nextState,
      news: [winNews, ...nextState.news].slice(0, 80),
    };
  }

  // Garante sempre 3 a 5 leilões ativos interessantes no mercado
  const activeCount = nextState.auctions.filter((a) => a.status === 'Ativo').length;
  if (activeCount < 3 && rng() < 0.45) {
    const activePlayerIds = new Set(nextState.auctions.filter((a) => a.status === 'Ativo').map((a) => a.playerId));
    const candidates = Object.values(nextState.players).filter(
      (p) =>
        p.clubId !== nextState.userClubId &&
        !activePlayerIds.has(p.id) &&
        !p.injury &&
        calculateBaseOverall(p) >= 72,
    );
    if (candidates.length > 0) {
      const picked = candidates[Math.floor(rng() * candidates.length)];
      const seller = nextState.clubs[picked.clubId];
      if (seller) {
        const freshAuction = createPlayerAuction(picked, seller, nextState.currentDate, clamp(4 + Math.floor(rng() * 4), 4, 7));
        nextState = {
          ...nextState,
          auctions: [freshAuction, ...nextState.auctions].slice(0, 20),
        };
      }
    }
  }

  return nextState;
}
