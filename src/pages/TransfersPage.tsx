import React, { useMemo, useState } from 'react';
import { useGame } from '../store/GameContext';
import { ContractRole, Player, Position } from '../types/game';
import {
  formatCurrency,
  formatDateBR,
  isTransferWindowOpen,
  NATIONALITY_LANGUAGES,
  POSITIONS,
  ROLE_DESCRIPTIONS,
} from '../engine/constants';
import { calculateBaseOverall } from '../engine/overall';
import {
  evaluateClubBid,
  evaluatePlayerTransferDecision,
  searchMarketPlayers,
  TransferSearchFilters,
} from '../engine/transfers';
import { ClubBadge, Modal, OverallBadge, Panel, PositionBadge } from '../components/UI';
import {
  ArrowLeftRight,
  CheckCircle2,
  Clock,
  Filter,
  Handshake,
  Lock,
  Search,
  Unlock,
  XCircle,
} from 'lucide-react';

const ROLES: ContractRole[] = ['Titular fixo', 'Titular rotativo', 'Volátil', 'Reserva', 'Jovem promessa'];

export const TransfersPage: React.FC = () => {
  const {
    state,
    userClub,
    completeUserTransfer,
    scheduleUserFutureTransfer,
    respondIncomingOffer,
    navigate,
  } = useGame();

  const [tab, setTab] = useState<'search' | 'incoming' | 'pending'>('search');
  const [filters, setFilters] = useState<TransferSearchFilters>({
    query: '',
    position: 'ALL',
    minAge: 17,
    maxAge: 38,
    minOverall: 60,
    maxOverall: 99,
    minPotential: 60,
    nationality: 'ALL',
    maxValue: 120_000_000,
    onlyListed: false,
  });

  // Estado do modal de negociação
  const [targetPlayer, setTargetPlayer] = useState<Player | null>(null);
  const [negoStage, setNegoStage] = useState<'club' | 'player' | 'done'>('club');
  const [isLoanOffer, setIsLoanOffer] = useState(false);
  const [bidFee, setBidFee] = useState(0);
  const [clubMsg, setClubMsg] = useState<string | null>(null);

  const [offerSalary, setOfferSalary] = useState(100_000);
  const [offerYears, setOfferYears] = useState(3);
  const [offerRole, setOfferRole] = useState<ContractRole>('Titular rotativo');
  const [playerMsg, setPlayerMsg] = useState<string | null>(null);
  const [lastProjectScore, setLastProjectScore] = useState<number | null>(null);

  // Contraproposta em propostas recebidas
  const [counterOfferMap, setCounterOfferMap] = useState<Record<string, number>>({});

  const winInfo = isTransferWindowOpen(state.currentDate);
  const marketResults = useMemo(
    () => searchMarketPlayers(state.players, userClub.id, filters).slice(0, 60),
    [state.players, userClub.id, filters],
  );

  const incomingOffers = state.transferOffers.filter((o) => o.isIncomingToUser);
  const pendingIncomingCount = incomingOffers.filter((o) => o.status === 'Pendente').length;

  const openNegotiation = (p: Player) => {
    setTargetPlayer(p);
    setNegoStage('club');
    setIsLoanOffer(false);
    setBidFee(Math.round((p.askingPrice ?? p.marketValue * 1.05) / 50_000) * 50_000);
    setOfferSalary(Math.round((p.contract.salary * 1.15) / 5_000) * 5_000);
    setOfferYears(3);
    setOfferRole(calculateBaseOverall(p) >= userClub.reputation - 2 ? 'Titular fixo' : 'Titular rotativo');
    setClubMsg(null);
    setPlayerMsg(null);
    setLastProjectScore(null);
  };

  const handleSubmitClubBid = () => {
    if (!targetPlayer) return;
    const seller = state.clubs[targetPlayer.clubId];
    if (!seller) return;

    if (bidFee > userClub.finances.transferBudget) {
      setClubMsg('Orçamento de transferências insuficiente para este valor.');
      return;
    }

    const res = evaluateClubBid(targetPlayer, seller, bidFee, isLoanOffer);
    setClubMsg(res.reason);
    if (res.accepted) {
      setNegoStage('player');
    } else if (res.counterFee) {
      setBidFee(res.counterFee);
    }
  };

  const handleSubmitPlayerTerms = () => {
    if (!targetPlayer) return;
    const seller = state.clubs[targetPlayer.clubId];
    if (!seller) return;

    const decision = evaluatePlayerTransferDecision(
      targetPlayer,
      userClub,
      seller,
      state.players,
      offerSalary,
      offerYears,
      offerRole,
    );
    setPlayerMsg(decision.reason);
    setLastProjectScore(decision.projectScore);

    if (decision.accepted) {
      if (winInfo.open) {
        completeUserTransfer({
          playerId: targetPlayer.id,
          buyerClubId: userClub.id,
          sellerClubId: seller.id,
          fee: bidFee,
          salary: offerSalary,
          contractYears: offerYears,
          role: offerRole,
          isLoan: isLoanOffer,
        });
      } else {
        scheduleUserFutureTransfer({
          playerId: targetPlayer.id,
          buyerClubId: userClub.id,
          sellerClubId: seller.id,
          fee: bidFee,
          salary: offerSalary,
          contractYears: offerYears,
          role: offerRole,
        });
      }
      setNegoStage('done');
    } else {
      // Ajusta sugestão conforme exigência do jogador
      setOfferSalary(decision.desiredSalary);
      setOfferRole(decision.desiredRole);
      setOfferYears(decision.desiredYears);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header + Banner da Janela */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">Mercado de Transferências</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Verba disponível: <strong className="text-emerald-400">{formatCurrency(userClub.finances.transferBudget)}</strong> •
            Folha mensal: <strong className="text-slate-200">{formatCurrency(userClub.finances.wageBudgetMonthly)}</strong>
          </p>
        </div>

        <div
          className={`px-4 py-2.5 rounded-2xl border flex items-center gap-2.5 text-xs font-bold ${
            winInfo.open
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
              : 'bg-amber-500/15 border-amber-500/40 text-amber-200'
          }`}
        >
          {winInfo.open ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
          <div>
            <p>{winInfo.label}</p>
            <p className="text-[10px] font-normal opacity-80">
              {winInfo.open
                ? `Fecha em ${formatDateBR(winInfo.closeDate)}`
                : `Próxima abertura: ${formatDateBR(winInfo.nextOpenDate)} — negociações fecham como Pré-Acordo Futuro`}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setTab('search')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            tab === 'search' ? 'bg-emerald-600 text-white' : 'bg-[#0e1525] border border-slate-800 text-slate-300'
          }`}
        >
          Explorar Mercado ({marketResults.length})
        </button>
        <button
          onClick={() => setTab('incoming')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 ${
            tab === 'incoming' ? 'bg-emerald-600 text-white' : 'bg-[#0e1525] border border-slate-800 text-slate-300'
          }`}
        >
          Propostas Recebidas
          {pendingIncomingCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-sky-500 text-[10px] font-black text-white">
              {pendingIncomingCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('pending')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            tab === 'pending' ? 'bg-emerald-600 text-white' : 'bg-[#0e1525] border border-slate-800 text-slate-300'
          }`}
        >
          Pré-Acordos Futuros ({state.pendingFutureTransfers.length})
        </button>
      </div>

      {/* ABA 1: BUSCA E FILTROS */}
      {tab === 'search' && (
        <>
          <Panel
            title="Filtros de Olheiro"
            right={
              <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.onlyListed}
                  onChange={(e) => setFilters((f) => ({ ...f, onlyListed: e.target.checked }))}
                  className="rounded accent-emerald-500"
                />
                Apenas listados p/ venda/empréstimo
              </label>
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={filters.query}
                  onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
                  placeholder="Nome do atleta..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#0a101d] border border-slate-700 text-white"
                />
              </div>

              <select
                value={filters.position}
                onChange={(e) => setFilters((f) => ({ ...f, position: e.target.value as Position | 'ALL' }))}
                className="px-3 py-2 rounded-xl bg-[#0a101d] border border-slate-700 text-slate-100"
              >
                <option value="ALL">Todas Posições</option>
                {POSITIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>

              <select
                value={filters.nationality}
                onChange={(e) => setFilters((f) => ({ ...f, nationality: e.target.value }))}
                className="px-3 py-2 rounded-xl bg-[#0a101d] border border-slate-700 text-slate-100"
              >
                <option value="ALL">Todas Nacionalidades</option>
                {Object.keys(NATIONALITY_LANGUAGES).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>

              <div>
                <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                  <span>Valor Máximo</span>
                  <span className="font-mono text-emerald-300">{formatCurrency(filters.maxValue)}</span>
                </div>
                <input
                  type="range"
                  min={1_000_000}
                  max={120_000_000}
                  step={1_000_000}
                  value={filters.maxValue}
                  onChange={(e) => setFilters((f) => ({ ...f, maxValue: Number(e.target.value) }))}
                  className="w-full accent-emerald-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-slate-400 shrink-0">Idade:</span>
                <input
                  type="number"
                  min={16}
                  max={40}
                  value={filters.minAge}
                  onChange={(e) => setFilters((f) => ({ ...f, minAge: Number(e.target.value) }))}
                  className="w-16 px-2 py-1.5 rounded-lg bg-[#0a101d] border border-slate-700 text-center font-mono"
                />
                <span className="text-slate-500">a</span>
                <input
                  type="number"
                  min={16}
                  max={40}
                  value={filters.maxAge}
                  onChange={(e) => setFilters((f) => ({ ...f, maxAge: Number(e.target.value) }))}
                  className="w-16 px-2 py-1.5 rounded-lg bg-[#0a101d] border border-slate-700 text-center font-mono"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-slate-400 shrink-0">OVR:</span>
                <input
                  type="number"
                  min={50}
                  max={99}
                  value={filters.minOverall}
                  onChange={(e) => setFilters((f) => ({ ...f, minOverall: Number(e.target.value) }))}
                  className="w-16 px-2 py-1.5 rounded-lg bg-[#0a101d] border border-slate-700 text-center font-mono"
                />
                <span className="text-slate-500">a</span>
                <input
                  type="number"
                  min={50}
                  max={99}
                  value={filters.maxOverall}
                  onChange={(e) => setFilters((f) => ({ ...f, maxOverall: Number(e.target.value) }))}
                  className="w-16 px-2 py-1.5 rounded-lg bg-[#0a101d] border border-slate-700 text-center font-mono"
                />
              </div>

              <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-400 shrink-0">Potencial mín:</span>
                <input
                  type="number"
                  min={50}
                  max={99}
                  value={filters.minPotential}
                  onChange={(e) => setFilters((f) => ({ ...f, minPotential: Number(e.target.value) }))}
                  className="w-16 px-2 py-1.5 rounded-lg bg-[#0a101d] border border-slate-700 text-center font-mono"
                />
              </div>
            </div>
          </Panel>

          <Panel title={`Jogadores Encontrados (${marketResults.length})`}>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] uppercase text-slate-400 border-b border-slate-800">
                    <th className="py-2 text-left">Atleta</th>
                    <th className="py-2 text-left">Clube</th>
                    <th className="py-2 text-center">Pos</th>
                    <th className="py-2 text-center">Idade</th>
                    <th className="py-2 text-center">OVR</th>
                    <th className="py-2 text-center">POT</th>
                    <th className="py-2 text-left">Personalidade</th>
                    <th className="py-2 text-right">Valor</th>
                    <th className="py-2 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {marketResults.map((p) => {
                    const c = state.clubs[p.clubId];
                    return (
                      <tr key={p.id} className="hover:bg-slate-800/40">
                        <td
                          onClick={() => navigate('player_profile', p.id)}
                          className="py-2.5 pr-2 cursor-pointer"
                        >
                          <p className="font-bold text-white hover:text-emerald-300">
                            {p.fullName}
                            {p.isTransferListed && (
                              <span className="ml-1.5 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold">
                                À Venda
                              </span>
                            )}
                            {p.isLoanListed && (
                              <span className="ml-1.5 px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 text-[9px] font-bold">
                                Empréstimo
                              </span>
                            )}
                          </p>
                          <p className="text-[10px] text-slate-400">{p.nationality}</p>
                        </td>
                        <td className="py-2.5">
                          <div className="flex items-center gap-1.5">
                            <ClubBadge club={c} size="xs" />
                            <span className="text-slate-300 truncate max-w-[130px]">{c?.name}</span>
                          </div>
                        </td>
                        <td className="py-2.5 text-center">
                          <PositionBadge position={p.primaryPosition} size="xs" />
                        </td>
                        <td className="py-2.5 text-center font-mono text-slate-300">{p.age}</td>
                        <td className="py-2.5 text-center">
                          <OverallBadge base={calculateBaseOverall(p)} />
                        </td>
                        <td className="py-2.5 text-center font-mono font-bold text-sky-300">{p.potential}</td>
                        <td className="py-2.5 text-slate-300">{p.personality}</td>
                        <td className="py-2.5 text-right font-mono font-bold text-white tabular-nums">
                          {formatCurrency(p.marketValue)}
                        </td>
                        <td className="py-2.5 pl-3 text-right">
                          <button
                            onClick={() => openNegotiation(p)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/40 text-[11px] font-bold transition-colors"
                          >
                            {winInfo.open ? 'Negociar' : 'Pré-Acordo'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}

      {/* ABA 2: PROPOSTAS RECEBIDAS */}
      {tab === 'incoming' && (
        <Panel
          title="Propostas Recebidas por Atletas do Seu Clube"
          subtitle="Clubes da IA enviam propostas durante a janela aberta — aceite, recuse ou envie contraproposta"
        >
          {incomingOffers.length === 0 ? (
            <p className="text-xs text-slate-400 py-8 text-center">
              Nenhuma proposta recebida ainda. Liste jogadores no Elenco e avance dias na janela aberta para receber ofertas dos clubes da IA!
            </p>
          ) : (
            <div className="space-y-3">
              {incomingOffers.map((offer) => {
                const p = state.players[offer.playerId];
                const buyer = state.clubs[offer.fromClubId];
                if (!p || !buyer) return null;
                const counterVal = counterOfferMap[offer.id] ?? Math.round((offer.fee * 1.15) / 50_000) * 50_000;

                return (
                  <div
                    key={offer.id}
                    className="p-4 rounded-2xl bg-[#0a101d] border border-slate-800 flex flex-wrap items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3">
                      <ClubBadge club={buyer} size="md" />
                      <div>
                        <p className="text-sm font-black text-white">
                          {buyer.name} quer {p.fullName} ({offer.type})
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Oferta: <strong className="text-emerald-400">{formatCurrency(offer.fee)}</strong> • Valor de
                          mercado: {formatCurrency(p.marketValue)} • Status: <strong>{offer.status}</strong>
                        </p>
                      </div>
                    </div>

                    {offer.status === 'Pendente' && (
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="number"
                          step={50000}
                          value={counterVal}
                          onChange={(e) =>
                            setCounterOfferMap((m) => ({ ...m, [offer.id]: Number(e.target.value) }))
                          }
                          className="w-32 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-white"
                        />
                        <button
                          onClick={() => respondIncomingOffer(offer.id, 'counter', counterVal)}
                          className="px-3 py-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white border border-amber-500/40 text-xs font-bold"
                        >
                          Contraproposta
                        </button>
                        <button
                          onClick={() => respondIncomingOffer(offer.id, 'accept')}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Aceitar
                        </button>
                        <button
                          onClick={() => respondIncomingOffer(offer.id, 'reject')}
                          className="px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/40 text-xs font-bold flex items-center gap-1"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Recusar
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      )}

      {/* ABA 3: PRÉ-ACORDOS FUTUROS */}
      {tab === 'pending' && (
        <Panel
          title="Transferências Agendadas para Próxima Janela"
          subtitle="Efetivadas automaticamente na abertura oficial do mercado"
        >
          {state.pendingFutureTransfers.length === 0 ? (
            <p className="text-xs text-slate-400 py-8 text-center">
              Nenhum pré-acordo futuro registrado. Quando a janela estiver fechada, você ainda pode fechar contratações antecipadas aqui.
            </p>
          ) : (
            <div className="space-y-3">
              {state.pendingFutureTransfers.map((ft) => {
                const p = state.players[ft.playerId];
                const seller = state.clubs[ft.fromClubId];
                return (
                  <div
                    key={ft.id}
                    className="p-4 rounded-2xl bg-[#0a101d] border border-slate-800 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <p className="font-bold text-white">
                        {p?.fullName} ({seller?.shortName} → {userClub.shortName})
                      </p>
                      <p className="text-slate-400 mt-0.5">
                        Valor: {formatCurrency(ft.fee)} • Salário: {formatCurrency(ft.salary)}/mês • Papel: {ft.role}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-sky-500/20 text-sky-300 font-bold">
                      <Clock className="w-3.5 h-3.5" /> Chega em {formatDateBR(ft.effectiveDate)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      )}

      {/* MODAL DE NEGOCIAÇÃO EM 2 ETAPAS (Clube -> Jogador) */}
      <Modal
        open={Boolean(targetPlayer)}
        onClose={() => setTargetPlayer(null)}
        title={targetPlayer ? `Negociação — ${targetPlayer.fullName}` : ''}
        subtitle={
          targetPlayer
            ? `${state.clubs[targetPlayer.clubId]?.name} • ${targetPlayer.primaryPosition} • OVR ${calculateBaseOverall(
                targetPlayer,
              )} • Personalidade: ${targetPlayer.personality}`
            : ''
        }
      >
        {targetPlayer && (
          <div className="space-y-5">
            {/* Indicador de Etapas */}
            <div className="flex items-center gap-2 text-xs">
              <span
                className={`px-3 py-1 rounded-full font-bold ${
                  negoStage === 'club' ? 'bg-emerald-600 text-white' : 'bg-emerald-500/20 text-emerald-300'
                }`}
              >
                1. Acordo entre Clubes
              </span>
              <ArrowLeftRight className="w-3.5 h-3.5 text-slate-500" />
              <span
                className={`px-3 py-1 rounded-full font-bold ${
                  negoStage === 'player'
                    ? 'bg-emerald-600 text-white'
                    : negoStage === 'done'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-slate-800 text-slate-400'
                }`}
              >
                2. Contrato com o Jogador
              </span>
            </div>

            {!winInfo.open && (
              <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/40 text-xs text-amber-200">
                Janela fechada: esta negociação será registrada como <strong>Pré-Acordo Futuro</strong> para{' '}
                {formatDateBR(winInfo.nextOpenDate)}.
              </div>
            )}

            {/* ETAPA 1: CLUBE */}
            {negoStage === 'club' && (
              <div className="space-y-4">
                {winInfo.open && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setIsLoanOffer(false);
                        setBidFee(Math.round((targetPlayer.marketValue * 1.05) / 50_000) * 50_000);
                      }}
                      className={`flex-1 py-2 rounded-xl border text-xs font-bold ${
                        !isLoanOffer
                          ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                          : 'bg-[#0a101d] border-slate-800 text-slate-400'
                      }`}
                    >
                      Compra Definitiva
                    </button>
                    <button
                      onClick={() => {
                        setIsLoanOffer(true);
                        setBidFee(Math.round((targetPlayer.marketValue * 0.1) / 50_000) * 50_000);
                      }}
                      className={`flex-1 py-2 rounded-xl border text-xs font-bold ${
                        isLoanOffer
                          ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                          : 'bg-[#0a101d] border-slate-800 text-slate-400'
                      }`}
                    >
                      Empréstimo (1 Ano)
                    </button>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {isLoanOffer ? 'Taxa de Empréstimo (R$)' : 'Valor da Transferência (R$)'}
                  </label>
                  <input
                    type="number"
                    step={100000}
                    min={0}
                    value={bidFee}
                    onChange={(e) => setBidFee(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0a101d] border border-slate-700 text-sm font-mono text-white"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Valor de mercado: {formatCurrency(targetPlayer.marketValue)} • Sua verba:{' '}
                    {formatCurrency(userClub.finances.transferBudget)}
                  </p>
                </div>

                {clubMsg && (
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200">
                    {clubMsg}
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setTargetPlayer(null)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-bold text-slate-300"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSubmitClubBid}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white flex items-center gap-1.5"
                  >
                    <Handshake className="w-4 h-4" /> Enviar Proposta ao Clube
                  </button>
                </div>
              </div>
            )}

            {/* ETAPA 2: JOGADOR */}
            {negoStage === 'player' && (
              <div className="space-y-4">
                {clubMsg && (
                  <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/35 text-xs text-emerald-200">
                    {clubMsg}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Salário Mensal (R$)</label>
                    <input
                      type="number"
                      step={5000}
                      min={15000}
                      value={offerSalary}
                      onChange={(e) => setOfferSalary(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-[#0a101d] border border-slate-700 text-sm font-mono text-white"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Atual: {formatCurrency(targetPlayer.contract.salary)}/mês
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Duração (Anos)</label>
                    <select
                      value={offerYears}
                      onChange={(e) => setOfferYears(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-[#0a101d] border border-slate-700 text-sm text-white"
                    >
                      {[1, 2, 3, 4, 5].map((y) => (
                        <option key={y} value={y}>
                          {y} {y === 1 ? 'ano' : 'anos'}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Promessa de Papel no Elenco
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {ROLES.map((r) => (
                      <button
                        key={r}
                        onClick={() => setOfferRole(r)}
                        className={`p-2 rounded-xl border text-left ${
                          offerRole === r
                            ? 'bg-emerald-500/15 border-emerald-400 text-white'
                            : 'bg-[#0a101d] border-slate-800 text-slate-300'
                        }`}
                      >
                        <p className="text-xs font-bold">{r}</p>
                        <p className="text-[10px] text-slate-400">{ROLE_DESCRIPTIONS[r]}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {playerMsg && (
                  <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/40 text-xs text-amber-100 space-y-1">
                    <p>{playerMsg}</p>
                    {lastProjectScore !== null && (
                      <p className="text-[11px] text-amber-300 font-semibold">
                        Avaliação do projeto esportivo pelo atleta: {lastProjectScore}/100
                      </p>
                    )}
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setTargetPlayer(null)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-bold text-slate-300"
                  >
                    Desistir
                  </button>
                  <button
                    onClick={handleSubmitPlayerTerms}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white"
                  >
                    Apresentar Contrato ao Jogador
                  </button>
                </div>
              </div>
            )}

            {/* ETAPA 3: CONCLUÍDA */}
            {negoStage === 'done' && (
              <div className="text-center py-6 space-y-3">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
                <h3 className="text-lg font-black text-white">Negociação Fechada!</h3>
                <p className="text-xs text-slate-300 max-w-md mx-auto">{playerMsg}</p>
                <button
                  onClick={() => setTargetPlayer(null)}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white"
                >
                  Voltar ao Mercado
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};
