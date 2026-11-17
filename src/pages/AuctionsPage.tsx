import React, { useState } from 'react';
import { useGame } from '../store/GameContext';
import { ContractRole, PlayerAuction } from '../types/game';
import { diffDays, formatCurrency, formatDateBR } from '../engine/constants';
import { calculateBaseOverall } from '../engine/overall';
import { computeAuctionProjectScore } from '../engine/auctions';
import { ClubBadge, Modal, OverallBadge, Panel, PositionBadge } from '../components/UI';
import { Clock, Gavel, PlusCircle, Sparkles, Trophy } from 'lucide-react';

const ROLES: ContractRole[] = ['Titular fixo', 'Titular rotativo', 'Volátil', 'Reserva', 'Jovem promessa'];

export const AuctionsPage: React.FC = () => {
  const { state, userClub, userPlayers, placeUserAuctionBid, putPlayerInAuction, navigate } = useGame();

  const [bidAuction, setBidAuction] = useState<PlayerAuction | null>(null);
  const [bidFee, setBidFee] = useState(0);
  const [bidSalary, setBidSalary] = useState(120_000);
  const [bidRole, setBidRole] = useState<ContractRole>('Titular fixo');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [sellPlayerId, setSellPlayerId] = useState(userPlayers[0]?.id ?? '');
  const [sellMinPrice, setSellMinPrice] = useState(2_000_000);
  const [sellDays, setSellDays] = useState(5);

  const activeAuctions = state.auctions.filter((a) => a.status === 'Ativo');
  const closedAuctions = state.auctions.filter((a) => a.status !== 'Ativo').slice(0, 8);

  const openBidModal = (auc: PlayerAuction) => {
    const player = state.players[auc.playerId];
    const highest = auc.bids[0]?.fee ?? auc.minimumPrice;
    setBidAuction(auc);
    setBidFee(Math.round((highest + 250_000) / 50_000) * 50_000);
    setBidSalary(player ? Math.round((player.contract.salary * 1.2) / 5_000) * 5_000 : 120_000);
    setBidRole('Titular fixo');
  };

  const previewProjectScore =
    bidAuction && state.players[bidAuction.playerId] && state.clubs[bidAuction.sellerClubId]
      ? computeAuctionProjectScore(
          state.players[bidAuction.playerId],
          userClub,
          state.clubs[bidAuction.sellerClubId],
          state.players,
          bidSalary,
          bidRole,
        )
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">Sala de Leilões de Jogadores</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Dispute reforços contra clubes rivais! O jogador avalia salário + projeto esportivo e pode escolher uma oferta mesmo que não seja o maior lance.
          </p>
        </div>

        <button
          onClick={() => {
            const p = userPlayers[0];
            if (p) {
              setSellPlayerId(p.id);
              setSellMinPrice(Math.round((p.marketValue * 0.9) / 50_000) * 50_000);
            }
            setShowCreateModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-xs font-black text-white shadow-lg"
        >
          <PlusCircle className="w-4 h-4" />
          Colocar Jogador em Leilão
        </button>
      </div>

      {/* Leilões Ativos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {activeAuctions.map((auc) => {
          const p = state.players[auc.playerId];
          const seller = state.clubs[auc.sellerClubId];
          if (!p || !seller) return null;

          const daysLeft = Math.max(0, diffDays(state.currentDate, auc.deadlineDate));
          const topBid = auc.bids[0];
          const userBid = auc.bids.find((b) => b.clubId === userClub.id);
          const isSellerUser = auc.sellerClubId === userClub.id;

          return (
            <Panel
              key={auc.id}
              className="flex flex-col justify-between"
              title={`${p.fullName} (${p.primaryPosition})`}
              subtitle={`Clube vendedor: ${seller.name} • Personalidade: ${p.personality}`}
              right={
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-[11px] font-bold text-amber-300">
                  <Clock className="w-3.5 h-3.5" />
                  {daysLeft === 0 ? 'Encerra hoje!' : `${daysLeft} dia(s) restantes`}
                </span>
              }
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#0a101d] border border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <PositionBadge position={p.primaryPosition} />
                    <div>
                      <button
                        onClick={() => navigate('player_profile', p.id)}
                        className="text-xs font-bold text-white hover:text-emerald-300"
                      >
                        {p.age} anos • {p.nationality}
                      </button>
                      <p className="text-[11px] text-slate-400">
                        Valor mercado: {formatCurrency(p.marketValue)} • Lance mín: {formatCurrency(auc.minimumPrice)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <OverallBadge base={calculateBaseOverall(p)} size="md" />
                    <span className="px-2 py-1 rounded-lg bg-sky-500/15 border border-sky-500/35 text-xs font-mono font-bold text-sky-300">
                      POT {p.potential}
                    </span>
                  </div>
                </div>

                {/* Ranking de Lances */}
                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-400 mb-2">
                    Lances Registrados ({auc.bids.length}) — Valor + Projeto Esportivo
                  </p>
                  {auc.bids.length === 0 ? (
                    <p className="text-xs text-slate-500 italic py-2">Nenhum lance ainda. Seja o primeiro!</p>
                  ) : (
                    <div className="space-y-1.5">
                      {auc.bids.slice(0, 4).map((b, idx) => {
                        const isMine = b.clubId === userClub.id;
                        return (
                          <div
                            key={b.id}
                            className={`px-3 py-2 rounded-xl border flex items-center justify-between gap-2 text-xs ${
                              isMine
                                ? 'bg-emerald-500/15 border-emerald-500/45'
                                : 'bg-[#0a101d] border-slate-800'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-mono font-bold text-slate-400">#{idx + 1}</span>
                              <ClubBadge club={state.clubs[b.clubId]} size="xs" />
                              <div className="min-w-0">
                                <p className="font-bold text-white truncate">
                                  {b.clubName} {isMine && '(Você)'}
                                </p>
                                <p className="text-[10px] text-slate-400">
                                  Salário {formatCurrency(b.offeredSalary)}/mês • {b.promisedRole}
                                </p>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="font-mono font-black text-emerald-400 tabular-nums">
                                {formatCurrency(b.fee)}
                              </p>
                              <p className="text-[10px] text-amber-300 font-semibold">
                                Projeto {b.projectScore}/100
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                  <div className="text-[11px] text-slate-400">
                    Prazo: <strong className="text-slate-200">{formatDateBR(auc.deadlineDate)}</strong>
                    {topBid && (
                      <>
                        {' '}
                        • Maior lance:{' '}
                        <strong className="text-emerald-400">{formatCurrency(topBid.fee)}</strong>
                      </>
                    )}
                  </div>
                  {!isSellerUser ? (
                    <button
                      onClick={() => openBidModal(auc)}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-black text-white flex items-center gap-1.5"
                    >
                      <Gavel className="w-3.5 h-3.5" />
                      {userBid ? 'Aumentar Lance' : 'Dar Lance'}
                    </button>
                  ) : (
                    <span className="px-3 py-1.5 rounded-xl bg-amber-500/15 text-amber-300 text-xs font-bold">
                      Seu Atleta em Leilão
                    </span>
                  )}
                </div>
              </div>
            </Panel>
          );
        })}
      </div>

      {/* Leilões Encerrados */}
      {closedAuctions.length > 0 && (
        <Panel title="Histórico de Leilões Encerrados">
          <div className="space-y-2.5">
            {closedAuctions.map((auc) => {
              const p = state.players[auc.playerId];
              return (
                <div
                  key={auc.id}
                  className="p-3.5 rounded-xl bg-[#0a101d] border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <p className="font-bold text-white flex items-center gap-1.5">
                      <Trophy className="w-3.5 h-3.5 text-amber-400" />
                      {p?.fullName ?? auc.playerId}
                    </p>
                    <p className="text-slate-300 mt-0.5">{auc.winningReason ?? 'Leilão finalizado.'}</p>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">{formatDateBR(auc.deadlineDate)}</span>
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      {/* Modal de Dar Lance */}
      <Modal
        open={Boolean(bidAuction)}
        onClose={() => setBidAuction(null)}
        title={bidAuction ? `Enviar Lance — ${state.players[bidAuction.playerId]?.fullName}` : ''}
        subtitle={`Sua verba disponível: ${formatCurrency(userClub.finances.transferBudget)}`}
      >
        {bidAuction && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Valor do Lance ao Clube (R$)</label>
                <input
                  type="number"
                  step={100000}
                  min={bidAuction.minimumPrice}
                  value={bidFee}
                  onChange={(e) => setBidFee(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-[#0a101d] border border-slate-700 text-sm font-mono text-white"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Lance mínimo: {formatCurrency(bidAuction.minimumPrice)}
                </p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Salário Mensal ao Jogador (R$)</label>
                <input
                  type="number"
                  step={5000}
                  min={15000}
                  value={bidSalary}
                  onChange={(e) => setBidSalary(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-[#0a101d] border border-slate-700 text-sm font-mono text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Papel Prometido no Elenco</label>
              <select
                value={bidRole}
                onChange={(e) => setBidRole(e.target.value as ContractRole)}
                className="w-full px-3 py-2 rounded-xl bg-[#0a101d] border border-slate-700 text-sm text-white"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-950/25 border border-emerald-500/35 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-emerald-200">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                Atratividade do seu Projeto Esportivo + Salário:
              </span>
              <span className="font-mono font-black text-base text-emerald-300">{previewProjectScore}/100</span>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setBidAuction(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-bold text-slate-300"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  const err = placeUserAuctionBid(bidAuction.id, bidFee, bidSalary, bidRole);
                  if (!err) setBidAuction(null);
                }}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-black text-white"
              >
                Confirmar Lance
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal de Colocar Atleta do Clube em Leilão */}
      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Colocar Atleta do Elenco em Leilão"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Selecionar Jogador</label>
            <select
              value={sellPlayerId}
              onChange={(e) => {
                setSellPlayerId(e.target.value);
                const p = state.players[e.target.value];
                if (p) setSellMinPrice(Math.round((p.marketValue * 0.9) / 50_000) * 50_000);
              }}
              className="w-full px-3 py-2 rounded-xl bg-[#0a101d] border border-slate-700 text-xs text-white"
            >
              {userPlayers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName} ({p.primaryPosition} • OVR {calculateBaseOverall(p)} • {formatCurrency(p.marketValue)})
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Lance Mínimo (R$)</label>
              <input
                type="number"
                step={100000}
                min={200000}
                value={sellMinPrice}
                onChange={(e) => setSellMinPrice(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-[#0a101d] border border-slate-700 text-sm font-mono text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Prazo (Dias)</label>
              <select
                value={sellDays}
                onChange={(e) => setSellDays(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-[#0a101d] border border-slate-700 text-sm text-white"
              >
                {[3, 4, 5, 6, 7].map((d) => (
                  <option key={d} value={d}>
                    {d} dias
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowCreateModal(false)}
              className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-bold text-slate-300"
            >
              Cancelar
            </button>
            <button
              onClick={() => {
                putPlayerInAuction(sellPlayerId, sellMinPrice, sellDays);
                setShowCreateModal(false);
              }}
              className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-xs font-black text-white"
            >
              Iniciar Leilão
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
