import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  Club,
  ContractRole,
  GameState,
  MatchFixture,
  NewsMessage,
  PageId,
  Player,
  StadiumUpgradeCategory,
  TacticalSetup,
  TrainingIntensity,
  TrainingType,
} from '../types/game';
import { createNewGameState } from '../engine/worldGenerator';
import { clearSavedGame, exportSaveJson, loadGameState, parseImportedSaveJson, saveGameState } from '../engine/storage';
import { advanceOneDay, applyCompletedFixtureToState, rebuildCalendarEvents } from '../engine/calendar';
import { autoSelectBestLineup } from '../engine/overall';
import { executeTrainingSession, TrainingSessionResult } from '../engine/training';
import { ContractNegotiationOffer, ContractNegotiationResponse, evaluateContractRenewal } from '../engine/contracts';
import { createStadiumConstruction, getNextUpgradeOffer } from '../engine/stadium';
import { recordTransaction, signSponsorship, takeBankLoan } from '../engine/economy';
import { executeCompletedTransfer, scheduleFutureTransfer } from '../engine/transfers';
import { createPlayerAuction, submitAuctionBid } from '../engine/auctions';
import { createYouthProspect } from '../engine/aiClubs';
import { clamp } from '../engine/constants';

export interface ToastMessage {
  id: string;
  text: string;
  type: 'success' | 'info' | 'warning' | 'danger';
}

interface GameContextValue {
  state: GameState;
  userClub: Club;
  userPlayers: Player[];
  activePage: PageId;
  showClubSelect: boolean;
  toasts: ToastMessage[];
  dismissToast: (id: string) => void;
  pushToast: (text: string, type?: ToastMessage['type']) => void;
  navigate: (page: PageId, playerId?: string) => void;
  openClubSelector: () => void;
  closeClubSelector: () => void;
  startNewCareer: (clubId: string, managerName: string) => void;
  exportSave: () => string;
  importSave: (json: string) => boolean;
  advanceDays: (days: number) => void;
  advanceToNextMatch: () => void;
  updateTactics: (partial: Partial<TacticalSetup>) => void;
  autoPickLineup: () => void;
  setPlayerListing: (playerId: string, transferListed: boolean, loanListed: boolean, askingPrice?: number) => void;
  setPlayerIndividualTraining: (playerId: string, focus: TrainingType) => void;
  runTrainingSession: (type: TrainingType, intensity: TrainingIntensity) => TrainingSessionResult | null;
  hireCoach: (coachId: string) => void;
  fireCoach: (coachId: string) => void;
  hireMedicalStaff: (medId: string) => void;
  fireMedicalStaff: (medId: string) => void;
  applyRehabProtocol: (playerId: string) => void;
  renegotiateContract: (playerId: string, offer: ContractNegotiationOffer) => ContractNegotiationResponse;
  commitCompletedMatch: (
    fixture: MatchFixture,
    newInjuries: { playerId: string; clubId: string; type: string; days: number; severity: 'Leve' | 'Moderada' | 'Grave' | 'Muito Grave' }[],
  ) => void;
  completeUserTransfer: (params: {
    playerId: string;
    buyerClubId: string;
    sellerClubId: string;
    fee: number;
    salary: number;
    contractYears: number;
    role: ContractRole;
    isLoan?: boolean;
  }) => void;
  scheduleUserFutureTransfer: (params: {
    playerId: string;
    buyerClubId: string;
    sellerClubId: string;
    fee: number;
    salary: number;
    contractYears: number;
    role: ContractRole;
  }) => void;
  respondIncomingOffer: (offerId: string, decision: 'accept' | 'reject' | 'counter', counterFee?: number) => void;
  placeUserAuctionBid: (auctionId: string, fee: number, salary: number, role: ContractRole) => string | null;
  putPlayerInAuction: (playerId: string, minPrice: number, durationDays: number) => void;
  startStadiumUpgrade: (category: StadiumUpgradeCategory) => void;
  updateTicketPrices: (ticketPrice: number, vipTicketPrice: number) => void;
  takeClubLoan: (principal: number, months: number, rate: number, bankName: string) => void;
  switchSponsor: (sponsorId: string) => void;
  promoteYouthAcademyPlayer: () => void;
  markAllNewsRead: () => void;
  markNewsRead: (id: string) => void;
  setActiveMatchId: (fixtureId: string | null) => void;
}

const GameContext = createContext<GameContextValue | null>(null);

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<GameState>(() => {
    const saved = loadGameState();
    if (saved) return saved;
    return createNewGameState('palestra-sp', 'Técnico Gestor', Math.floor(Date.now() % 1000000) + 2026);
  });

  const [showClubSelect, setShowClubSelect] = useState<boolean>(() => !loadGameState());
  const [activePage, setActivePage] = useState<PageId>('dashboard');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const pushToast = useCallback((text: string, type: ToastMessage['type'] = 'info') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-3), { id, text, type }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Auto-save contínuo
  useEffect(() => {
    const timer = window.setTimeout(() => {
      saveGameState(state);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [state]);

  const userClub = state.clubs[state.userClubId];
  const userPlayers = useMemo(
    () => Object.values(state.players).filter((p) => p.clubId === state.userClubId),
    [state.players, state.userClubId],
  );

  const navigate = useCallback((page: PageId, playerId?: string) => {
    if (playerId) {
      setState((prev) => ({ ...prev, selectedPlayerId: playerId }));
    }
    setActivePage(page);
  }, []);

  const startNewCareer = useCallback(
    (clubId: string, managerName: string) => {
      clearSavedGame();
      const fresh = createNewGameState(
        clubId,
        managerName.trim() || 'Treinador Principal',
        Math.floor(Date.now() % 1000000) + 17,
      );
      setState(fresh);
      saveGameState(fresh);
      setShowClubSelect(false);
      setActivePage('dashboard');
      pushToast(`Carreira iniciada no ${fresh.clubs[clubId].name}!`, 'success');
    },
    [pushToast],
  );

  const exportSave = useCallback(() => exportSaveJson(state), [state]);

  const importSave = useCallback(
    (json: string) => {
      const parsed = parseImportedSaveJson(json);
      if (!parsed) {
        pushToast('Arquivo de save inválido ou corrompido.', 'danger');
        return false;
      }
      setState(parsed);
      saveGameState(parsed);
      setShowClubSelect(false);
      setActivePage('dashboard');
      pushToast('Save importado com sucesso!', 'success');
      return true;
    },
    [pushToast],
  );

  const advanceDays = useCallback(
    (days: number) => {
      let stoppedForMatch: MatchFixture | null = null;
      setState((prev) => {
        let cur = prev;
        for (let i = 0; i < days; i++) {
          const res = advanceOneDay(cur);
          cur = res.state;
          if (res.userMatchToday) {
            stoppedForMatch = res.userMatchToday;
            break;
          }
        }
        return cur;
      });
      if (stoppedForMatch) {
        pushToast('Chegou o dia da partida! Abra a aba Partidas para jogar.', 'success');
      }
    },
    [pushToast],
  );

  const advanceToNextMatch = useCallback(() => {
    let foundMatch: MatchFixture | null = null;
    setState((prev) => {
      // Verifica se já há jogo não jogado hoje
      for (const comp of prev.competitions) {
        const today = comp.fixtures.find(
          (f) =>
            !f.played &&
            f.date === prev.currentDate &&
            (f.homeClubId === prev.userClubId || f.awayClubId === prev.userClubId),
        );
        if (today) {
          foundMatch = today;
          return { ...prev, activeMatchId: today.id };
        }
      }

      let cur = prev;
      for (let i = 0; i < 40; i++) {
        const res = advanceOneDay(cur);
        cur = res.state;
        if (res.userMatchToday) {
          foundMatch = res.userMatchToday;
          break;
        }
      }
      return cur;
    });

    if (foundMatch) {
      setActivePage('matches');
      pushToast('Dia de partida! Equipe pronta para entrar em campo.', 'success');
    } else {
      pushToast('Calendário avançado!', 'info');
    }
  }, [pushToast]);

  const updateTactics = useCallback((partial: Partial<TacticalSetup>) => {
    setState((prev) => {
      const club = prev.clubs[prev.userClubId];
      return {
        ...prev,
        clubs: {
          ...prev.clubs,
          [club.id]: {
            ...club,
            tactics: {
              ...club.tactics,
              ...partial,
            },
          },
        },
      };
    });
  }, []);

  const autoPickLineup = useCallback(() => {
    setState((prev) => {
      const club = prev.clubs[prev.userClubId];
      const squad = Object.values(prev.players).filter((p) => p.clubId === club.id);
      const best = autoSelectBestLineup(club, squad);
      return {
        ...prev,
        clubs: {
          ...prev.clubs,
          [club.id]: {
            ...club,
            tactics: {
              ...club.tactics,
              startingXI: best.startingXI,
              bench: best.bench,
            },
          },
        },
      };
    });
    pushToast('Melhor escalação selecionada automaticamente conforme forma e posições.', 'success');
  }, [pushToast]);

  const setPlayerListing = useCallback(
    (playerId: string, transferListed: boolean, loanListed: boolean, askingPrice?: number) => {
      setState((prev) => {
        const p = prev.players[playerId];
        if (!p) return prev;
        return {
          ...prev,
          players: {
            ...prev.players,
            [playerId]: {
              ...p,
              isTransferListed: transferListed,
              isLoanListed: loanListed,
              askingPrice: askingPrice ?? p.askingPrice ?? Math.round(p.marketValue * 1.05),
            },
          },
        };
      });
      pushToast('Status de mercado do atleta atualizado.', 'info');
    },
    [pushToast],
  );

  const setPlayerIndividualTraining = useCallback((playerId: string, focus: TrainingType) => {
    setState((prev) => {
      const p = prev.players[playerId];
      if (!p) return prev;
      return {
        ...prev,
        players: {
          ...prev.players,
          [playerId]: {
            ...p,
            individualTrainingFocus: focus,
          },
        },
      };
    });
  }, []);

  const runTrainingSession = useCallback(
    (type: TrainingType, intensity: TrainingIntensity): TrainingSessionResult | null => {
      const club = state.clubs[state.userClubId];
      if (club.trainingSchedule.lastTrainedDate === state.currentDate) {
        pushToast('Você já comandou um treino hoje. Avance 1 dia para a próxima sessão.', 'warning');
        return null;
      }

      const result = executeTrainingSession(club, state.players, type, intensity, state.currentDate);
      setState((prev) => {
        const curClub = prev.clubs[prev.userClubId];
        let nextState: GameState = {
          ...prev,
          players: result.updatedPlayers,
          clubs: {
            ...prev.clubs,
            [curClub.id]: {
              ...curClub,
              trainingSchedule: {
                collectiveFocus: type,
                intensity,
                lastTrainedDate: prev.currentDate,
                sessionsThisWeek: curClub.trainingSchedule.sessionsThisWeek + 1,
              },
            },
          },
        };
        if (result.injuredPlayers.length > 0) {
          const trInjNews: NewsMessage = {
            id: `tr-inj-${prev.currentDate}-${Date.now()}`,
            date: prev.currentDate,
            category: 'Médico',
            title: `Lesão no treinamento (${result.injuredPlayers.map((i) => i.playerName).join(', ')})`,
            body: `O treino ${type} (${intensity}) resultou em lesão: ${result.injuredPlayers
              .map((i) => `${i.playerName} (${i.injuryType}, ${i.days}d)`)
              .join('; ')}.`,
            read: false,
            actionPage: 'infirmary',
            severity: 'danger',
          };
          nextState = {
            ...nextState,
            news: [trInjNews, ...nextState.news].slice(0, 80),
          };
        }
        // Cada sessão consome tempo: avança automaticamente 1 dia se não houver partida hoje
        const hasMatchToday = prev.competitions.some((comp) =>
          comp.fixtures.some(
            (f) =>
              !f.played &&
              f.date === prev.currentDate &&
              (f.homeClubId === prev.userClubId || f.awayClubId === prev.userClubId),
          ),
        );
        if (!hasMatchToday) {
          return advanceOneDay(nextState).state;
        }
        return nextState;
      });

      pushToast(result.summary, result.injuredPlayers.length > 0 ? 'warning' : 'success');
      return result;
    },
    [state, pushToast],
  );

  const hireCoach = useCallback(
    (coachId: string) => {
      const coach = state.availableCoaches.find((c) => c.id === coachId);
      if (!coach) return;
      if (userClub.finances.balance < coach.hiringFee) {
        pushToast('Saldo insuficiente para pagar a contratação deste treinador.', 'danger');
        return;
      }
      setState((prev) => {
        const club = prev.clubs[prev.userClubId];
        const charged = recordTransaction(
          club,
          prev.currentDate,
          'despesa',
          'Funcionários',
          `Contratação do treinador ${coach.name} (${coach.specialty})`,
          coach.hiringFee,
        );
        return {
          ...prev,
          clubs: {
            ...prev.clubs,
            [club.id]: {
              ...charged,
              coaches: [...charged.coaches, coach],
            },
          },
          availableCoaches: prev.availableCoaches.filter((c) => c.id !== coachId),
        };
      });
      pushToast(`${coach.name} contratado para a comissão técnica!`, 'success');
    },
    [state.availableCoaches, userClub.finances.balance, pushToast],
  );

  const fireCoach = useCallback(
    (coachId: string) => {
      setState((prev) => {
        const club = prev.clubs[prev.userClubId];
        const target = club.coaches.find((c) => c.id === coachId);
        if (!target) return prev;
        return {
          ...prev,
          clubs: {
            ...prev.clubs,
            [club.id]: {
              ...club,
              coaches: club.coaches.filter((c) => c.id !== coachId),
            },
          },
          availableCoaches: [target, ...prev.availableCoaches],
        };
      });
      pushToast('Membro desligado da comissão técnica.', 'info');
    },
    [pushToast],
  );

  const hireMedicalStaff = useCallback(
    (medId: string) => {
      const med = state.availableMedicalStaff.find((m) => m.id === medId);
      if (!med) return;
      if (userClub.finances.balance < med.hiringFee) {
        pushToast('Saldo insuficiente para contratar este profissional médico.', 'danger');
        return;
      }
      setState((prev) => {
        const club = prev.clubs[prev.userClubId];
        const charged = recordTransaction(
          club,
          prev.currentDate,
          'despesa',
          'Departamento Médico',
          `Contratação médica — ${med.name} (${med.specialty})`,
          med.hiringFee,
        );
        return {
          ...prev,
          clubs: {
            ...prev.clubs,
            [club.id]: {
              ...charged,
              medicalStaff: [...charged.medicalStaff, med],
            },
          },
          availableMedicalStaff: prev.availableMedicalStaff.filter((m) => m.id !== medId),
        };
      });
      pushToast(`${med.name} integrado ao departamento médico!`, 'success');
    },
    [state.availableMedicalStaff, userClub.finances.balance, pushToast],
  );

  const fireMedicalStaff = useCallback(
    (medId: string) => {
      setState((prev) => {
        const club = prev.clubs[prev.userClubId];
        const target = club.medicalStaff.find((m) => m.id === medId);
        if (!target) return prev;
        return {
          ...prev,
          clubs: {
            ...prev.clubs,
            [club.id]: {
              ...club,
              medicalStaff: club.medicalStaff.filter((m) => m.id !== medId),
            },
          },
          availableMedicalStaff: [target, ...prev.availableMedicalStaff],
        };
      });
      pushToast('Profissional desligado do departamento médico.', 'info');
    },
    [pushToast],
  );

  const applyRehabProtocol = useCallback(
    (playerId: string) => {
      const cost = 180_000;
      const p = state.players[playerId];
      if (!p || !p.injury) return;
      if (userClub.finances.balance < cost) {
        pushToast('Saldo insuficiente para tratamento intensivo (R$ 180.000).', 'danger');
        return;
      }
      setState((prev) => {
        const player = prev.players[playerId];
        if (!player || !player.injury) return prev;
        const club = prev.clubs[prev.userClubId];
        const charged = recordTransaction(
          club,
          prev.currentDate,
          'despesa',
          'Departamento Médico',
          `Tratamento intensivo com células-tronco/fisioterapia — ${player.shortName}`,
          cost,
        );
        const cutDays = Math.max(2, Math.round(player.injury.remainingDays * 0.28));
        const nextRem = Math.max(1, player.injury.remainingDays - cutDays);
        const pct = clamp(
          Math.round(((player.injury.totalDays - nextRem) / Math.max(1, player.injury.totalDays)) * 100),
          0,
          99,
        );
        return {
          ...prev,
          clubs: { ...prev.clubs, [club.id]: charged },
          players: {
            ...prev.players,
            [playerId]: {
              ...player,
              injury: {
                ...player.injury,
                remainingDays: nextRem,
                treatmentProgress: pct,
              },
              conditional: {
                ...player.conditional,
                moral: clamp(player.conditional.moral + 4, 15, 100),
              },
            },
          },
        };
      });
      pushToast(`Tratamento intensivo aplicado em ${p.shortName}! Tempo de recuperação reduzido.`, 'success');
    },
    [state.players, userClub.finances.balance, pushToast],
  );

  const renegotiateContract = useCallback(
    (playerId: string, offer: ContractNegotiationOffer): ContractNegotiationResponse => {
      const p = state.players[playerId];
      const club = state.clubs[state.userClubId];
      if (!p || !club) {
        return { accepted: false, reason: 'Jogador não encontrado.' };
      }
      const res = evaluateContractRenewal(p, club, offer, state.currentDate);
      if (res.accepted && res.updatedPlayer) {
        setState((prev) => {
          const nextState = {
            ...prev,
            players: { ...prev.players, [playerId]: res.updatedPlayer! },
          };
          return { ...nextState, calendarEvents: rebuildCalendarEvents(nextState) };
        });
        pushToast(`Contrato de ${p.shortName} renovado com sucesso!`, 'success');
      } else {
        pushToast(`${p.shortName} recusou a oferta e enviou contraproposta.`, 'warning');
      }
      return res;
    },
    [state.players, state.clubs, state.userClubId, state.currentDate, pushToast],
  );

  const commitCompletedMatch = useCallback(
    (
      fixture: MatchFixture,
      newInjuries: { playerId: string; clubId: string; type: string; days: number; severity: 'Leve' | 'Moderada' | 'Grave' | 'Muito Grave' }[],
    ) => {
      setState((prev) => {
        const applied = applyCompletedFixtureToState(prev, fixture, newInjuries);
        return { ...applied, activeMatchId: null };
      });
      pushToast(`Partida encerrada: ${fixture.homeGoals} x ${fixture.awayGoals}!`, 'success');
    },
    [pushToast],
  );

  const completeUserTransfer = useCallback(
    (params: {
      playerId: string;
      buyerClubId: string;
      sellerClubId: string;
      fee: number;
      salary: number;
      contractYears: number;
      role: ContractRole;
      isLoan?: boolean;
    }) => {
      setState((prev) => {
        const next = executeCompletedTransfer(prev, params);
        return { ...next, calendarEvents: rebuildCalendarEvents(next) };
      });
      pushToast('Negociação concluída! Jogador integrado ao clube.', 'success');
    },
    [pushToast],
  );

  const scheduleUserFutureTransfer = useCallback(
    (params: {
      playerId: string;
      buyerClubId: string;
      sellerClubId: string;
      fee: number;
      salary: number;
      contractYears: number;
      role: ContractRole;
    }) => {
      setState((prev) => scheduleFutureTransfer(prev, params));
      pushToast('Pré-acordo assinado para a próxima abertura da janela!', 'success');
    },
    [pushToast],
  );

  const respondIncomingOffer = useCallback(
    (offerId: string, decision: 'accept' | 'reject' | 'counter', counterFee?: number) => {
      const offer = state.transferOffers.find((o) => o.id === offerId);
      if (!offer) return;
      const player = state.players[offer.playerId];
      const buyer = state.clubs[offer.fromClubId];
      if (!player || !buyer) return;

      if (decision === 'reject') {
        setState((prev) => ({
          ...prev,
          transferOffers: prev.transferOffers.map((o) => (o.id === offerId ? { ...o, status: 'Recusada' } : o)),
        }));
        pushToast(`Proposta do ${buyer.shortName} por ${player.shortName} recusada.`, 'info');
        return;
      }

      if (decision === 'counter' && counterFee) {
        const maxAiWilling = Math.min(buyer.finances.transferBudget, Math.round(offer.fee * 1.24));
        if (counterFee <= maxAiWilling) {
          setState((prev) => {
            const updatedOffers = prev.transferOffers.map((o) =>
              o.id === offerId ? { ...o, fee: counterFee, status: 'Concluída' as const } : o,
            );
            const transferred = executeCompletedTransfer(
              { ...prev, transferOffers: updatedOffers },
              {
                playerId: offer.playerId,
                buyerClubId: offer.fromClubId,
                sellerClubId: offer.toClubId,
                fee: counterFee,
                salary: offer.offeredSalary,
                contractYears: offer.contractYears,
                role: offer.promisedRole,
                isLoan: offer.type === 'Empréstimo',
              },
            );
            return { ...transferred, calendarEvents: rebuildCalendarEvents(transferred) };
          });
          pushToast(
            `O ${buyer.shortName} aceitou sua contraproposta de R$ ${counterFee.toLocaleString('pt-BR')}!`,
            'success',
          );
        } else {
          setState((prev) => ({
            ...prev,
            transferOffers: prev.transferOffers.map((o) =>
              o.id === offerId ? { ...o, status: 'Recusada', counterFee } : o,
            ),
          }));
          pushToast(`O ${buyer.shortName} achou a contraproposta alta demais e encerrou a conversa.`, 'warning');
        }
        return;
      }

      // Accept
      setState((prev) => {
        const updatedOffers = prev.transferOffers.map((o) =>
          o.id === offerId ? { ...o, status: 'Concluída' as const } : o,
        );
        const transferred = executeCompletedTransfer(
          { ...prev, transferOffers: updatedOffers },
          {
            playerId: offer.playerId,
            buyerClubId: offer.fromClubId,
            sellerClubId: offer.toClubId,
            fee: offer.fee,
            salary: offer.offeredSalary,
            contractYears: offer.contractYears,
            role: offer.promisedRole,
            isLoan: offer.type === 'Empréstimo',
          },
        );
        return { ...transferred, calendarEvents: rebuildCalendarEvents(transferred) };
      });
      pushToast(`${player.shortName} negociado com o ${buyer.name}!`, 'success');
    },
    [state.transferOffers, state.players, state.clubs, pushToast],
  );

  const placeUserAuctionBid = useCallback(
    (auctionId: string, fee: number, salary: number, role: ContractRole): string | null => {
      let errMsg: string | null = null;
      setState((prev) => {
        const res = submitAuctionBid(prev, auctionId, prev.userClubId, fee, salary, role);
        if (res.error) {
          errMsg = res.error;
          return prev;
        }
        return res.state;
      });
      if (errMsg) {
        pushToast(errMsg, 'danger');
      } else {
        pushToast('Lance enviado com sucesso no leilão!', 'success');
      }
      return errMsg;
    },
    [pushToast],
  );

  const putPlayerInAuction = useCallback(
    (playerId: string, minPrice: number, durationDays: number) => {
      const p = state.players[playerId];
      if (!p || p.clubId !== state.userClubId) return;
      if (state.auctions.some((a) => a.playerId === playerId && a.status === 'Ativo')) {
        pushToast('Este jogador já está em um leilão ativo.', 'warning');
        return;
      }
      const auc = createPlayerAuction(p, userClub, state.currentDate, durationDays, minPrice);
      setState((prev) => {
        const next = { ...prev, auctions: [auc, ...prev.auctions] };
        return { ...next, calendarEvents: rebuildCalendarEvents(next) };
      });
      pushToast(`${p.shortName} colocado em leilão por ${durationDays} dias!`, 'success');
    },
    [state.players, state.userClubId, state.auctions, state.currentDate, userClub, pushToast],
  );

  const startStadiumUpgrade = useCallback(
    (category: StadiumUpgradeCategory) => {
      const offer = getNextUpgradeOffer(userClub.stadium, category);
      if (!offer.canUpgrade) {
        pushToast('Esta melhoria já está em andamento ou no nível máximo.', 'warning');
        return;
      }
      if (userClub.finances.balance < offer.cost) {
        pushToast('Saldo insuficiente em caixa para iniciar esta obra.', 'danger');
        return;
      }
      const construction = createStadiumConstruction(userClub.stadium, category, state.currentDate);
      if (!construction) return;

      setState((prev) => {
        const club = prev.clubs[prev.userClubId];
        const charged = recordTransaction(
          club,
          prev.currentDate,
          'despesa',
          'Estádio',
          `Início de obra: ${construction.name}`,
          construction.cost,
        );
        const next: GameState = {
          ...prev,
          clubs: {
            ...prev.clubs,
            [club.id]: {
              ...charged,
              stadium: {
                ...charged.stadium,
                activeConstructions: [...charged.stadium.activeConstructions, construction],
              },
            },
          },
        };
        return { ...next, calendarEvents: rebuildCalendarEvents(next) };
      });
      pushToast(`Obra "${construction.name}" iniciada! Prazo estimado: ${construction.totalDays} dias.`, 'success');
    },
    [userClub, state.currentDate, pushToast],
  );

  const updateTicketPrices = useCallback((ticketPrice: number, vipTicketPrice: number) => {
    setState((prev) => {
      const club = prev.clubs[prev.userClubId];
      return {
        ...prev,
        clubs: {
          ...prev.clubs,
          [club.id]: {
            ...club,
            stadium: {
              ...club.stadium,
              ticketPrice: clamp(Math.round(ticketPrice), 20, 260),
              vipTicketPrice: clamp(Math.round(vipTicketPrice), 100, 900),
            },
          },
        },
      };
    });
  }, []);

  const takeClubLoan = useCallback(
    (principal: number, months: number, rate: number, bankName: string) => {
      if (userClub.finances.loans.length >= 3) {
        pushToast('Limite máximo de 3 empréstimos bancários simultâneos atingido.', 'warning');
        return;
      }
      setState((prev) => {
        const club = prev.clubs[prev.userClubId];
        return {
          ...prev,
          clubs: {
            ...prev.clubs,
            [club.id]: takeBankLoan(club, principal, months, rate, bankName, prev.currentDate),
          },
        };
      });
      pushToast(`Empréstimo de R$ ${principal.toLocaleString('pt-BR')} creditado em caixa!`, 'success');
    },
    [userClub.finances.loans.length, pushToast],
  );

  const switchSponsor = useCallback(
    (sponsorId: string) => {
      const deal = state.availableSponsors.find((s) => s.id === sponsorId);
      if (!deal) return;
      if (userClub.reputation < deal.minReputation) {
        pushToast(`Este patrocinador exige reputação mínima de ${deal.minReputation}.`, 'warning');
        return;
      }
      setState((prev) => {
        const club = prev.clubs[prev.userClubId];
        return {
          ...prev,
          clubs: {
            ...prev.clubs,
            [club.id]: signSponsorship(club, deal, prev.currentDate),
          },
        };
      });
      pushToast(`Novo patrocínio assinado com ${deal.sponsorName}!`, 'success');
    },
    [state.availableSponsors, userClub.reputation, pushToast],
  );

  const promoteYouthAcademyPlayer = useCallback(() => {
    const cost = 650_000;
    if (userClub.finances.balance < cost) {
      pushToast('Saldo insuficiente para integrar e registrar novo talento da base (R$ 650.000).', 'danger');
      return;
    }
    const prospect = createYouthProspect(userClub, state.currentDate, state.season);
    setState((prev) => {
      const club = prev.clubs[prev.userClubId];
      const charged = recordTransaction(
        club,
        prev.currentDate,
        'despesa',
        'Funcionários',
        `Promoção da base — ${prospect.fullName}`,
        cost,
      );
      return {
        ...prev,
        clubs: { ...prev.clubs, [club.id]: charged },
        players: { ...prev.players, [prospect.id]: prospect },
      };
    });
    pushToast(
      `Jovem promovido: ${prospect.fullName} (${prospect.age} anos, ${prospect.primaryPosition}, Potencial ${prospect.potential})!`,
      'success',
    );
  }, [userClub, state.currentDate, state.season, pushToast]);

  const markAllNewsRead = useCallback(() => {
    setState((prev) => ({
      ...prev,
      news: prev.news.map((n) => ({ ...n, read: true })),
    }));
  }, []);

  const markNewsRead = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      news: prev.news.map((n) => (n.id === id ? { ...n, read: true } : n)),
    }));
  }, []);

  const setActiveMatchId = useCallback((fixtureId: string | null) => {
    setState((prev) => ({ ...prev, activeMatchId: fixtureId }));
  }, []);

  return (
    <GameContext.Provider
      value={{
        state,
        userClub,
        userPlayers,
        activePage,
        showClubSelect,
        toasts,
        dismissToast,
        pushToast,
        navigate,
        openClubSelector: () => setShowClubSelect(true),
        closeClubSelector: () => setShowClubSelect(false),
        startNewCareer,
        exportSave,
        importSave,
        advanceDays,
        advanceToNextMatch,
        updateTactics,
        autoPickLineup,
        setPlayerListing,
        setPlayerIndividualTraining,
        runTrainingSession,
        hireCoach,
        fireCoach,
        hireMedicalStaff,
        fireMedicalStaff,
        applyRehabProtocol,
        renegotiateContract,
        commitCompletedMatch,
        completeUserTransfer,
        scheduleUserFutureTransfer,
        respondIncomingOffer,
        placeUserAuctionBid,
        putPlayerInAuction,
        startStadiumUpgrade,
        updateTicketPrices,
        takeClubLoan,
        switchSponsor,
        promoteYouthAcademyPlayer,
        markAllNewsRead,
        markNewsRead,
        setActiveMatchId,
      }}
    >
      {children}
    </GameContext.Provider>
  );
};

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame deve ser usado dentro de GameProvider');
  return ctx;
}
