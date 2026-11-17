import React, { useMemo, useState } from 'react';
import { useGame } from '../store/GameContext';
import { StadiumUpgradeCategory } from '../types/game';
import { formatCurrency, formatDateBR, STADIUM_UPGRADES } from '../engine/constants';
import { calculateMatchdayBoxOffice, getNextUpgradeOffer } from '../engine/stadium';
import { Stadium3DViewer } from '../components/Stadium3DViewer';
import { Panel, ProgressBar, StatCard } from '../components/UI';
import { Building2, Hammer, Flame, Ticket, Users, Sparkles, Clock } from 'lucide-react';

export const Stadium3DPage: React.FC = () => {
  const { state, userClub, startStadiumUpgrade, updateTicketPrices } = useGame();
  const [simImportance, setSimImportance] = useState(7);

  // Adversário típico da liga para simular bilheteria ao vivo
  const sampleOpponent = useMemo(() => {
    const others = Object.values(state.clubs).filter((c) => c.id !== userClub.id);
    return others.sort((a, b) => Math.abs(b.reputation - 80) - Math.abs(a.reputation - 80))[0] ?? userClub;
  }, [state.clubs, userClub]);

  const boxOffice = useMemo(
    () => calculateMatchdayBoxOffice(userClub, sampleOpponent, simImportance),
    [userClub, sampleOpponent, simImportance],
  );

  const st = userClub.stadium;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">Estádio 3D & Gestão de Arena</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Arraste o modelo 3D para girar, use o scroll para dar zoom e acompanhe cada expansão transformar a arena visualmente!
          </p>
        </div>
        <div className="text-xs text-slate-300 bg-[#0e1525] border border-slate-800 px-4 py-2 rounded-xl">
          Caixa disponível: <strong className="text-emerald-400">{formatCurrency(userClub.finances.balance)}</strong>
        </div>
      </div>

      {/* Viewport 3D Interativo */}
      <Stadium3DViewer club={userClub} occupancyPct={boxOffice.occupancyPct} />

      {/* KPIs do Estádio */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Capacidade Total"
          value={st.capacity.toLocaleString('pt-BR')}
          sub={`Recorde: ${st.recordAttendance.toLocaleString('pt-BR')}`}
          icon={<Users className="w-5 h-5" />}
          accent="sky"
        />
        <StatCard
          label="Fator Casa / Torcida"
          value={`+${boxOffice.homeAtmosphereBonus}`}
          sub={`Estrutura +${st.homeFactorBonus} • Gramado ${st.pitchQuality}%`}
          icon={<Flame className="w-5 h-5" />}
          accent="amber"
        />
        <StatCard
          label="Renda Estimada / Jogo"
          value={formatCurrency(boxOffice.totalRevenue)}
          sub={`Última renda: ${formatCurrency(st.lastRevenue)}`}
          icon={<Ticket className="w-5 h-5" />}
          accent="emerald"
        />
        <StatCard
          label="Manutenção Mensal"
          value={formatCurrency(st.maintenanceMonthlyCost)}
          sub={`Popularidade da torcida: ${Math.round(userClub.popularity)}/100`}
          icon={<Building2 className="w-5 h-5" />}
          accent="indigo"
        />
      </div>

      {/* Obras em andamento */}
      {st.activeConstructions.length > 0 && (
        <Panel title="Obras em Andamento" subtitle="Concluídas automaticamente conforme os dias avançam">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {st.activeConstructions.map((c) => {
              const pct = Math.round(((c.totalDays - c.remainingDays) / Math.max(1, c.totalDays)) * 100);
              return (
                <div key={c.id} className="p-4 rounded-2xl bg-[#0a101d] border border-amber-500/40 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-black text-amber-200 flex items-center gap-1.5">
                      <Hammer className="w-4 h-4 text-amber-400" /> {c.name}
                    </p>
                    <span className="text-[11px] font-mono text-amber-300 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> {c.remainingDays}d restantes
                    </span>
                  </div>
                  <ProgressBar value={pct} color="amber" />
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Progresso: {pct}%</span>
                    <span>Entrega prevista: {formatDateBR(c.estimatedEndDate)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Construção & Expansão (7 cols) */}
        <Panel
          title="Construção e Expansão da Arena"
          subtitle="Cada melhoria altera visualmente o estádio 3D, a capacidade, o fator casa e a bilheteria"
          className="lg:col-span-7"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {STADIUM_UPGRADES.map((spec) => {
              const offer = getNextUpgradeOffer(st, spec.category as StadiumUpgradeCategory);
              const affordable = userClub.finances.balance >= offer.cost;
              return (
                <div
                  key={spec.category}
                  className="p-4 rounded-2xl bg-[#0a101d] border border-slate-800 flex flex-col justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h3 className="text-xs font-black text-white">{spec.name}</h3>
                      <span className="px-2 py-0.5 rounded-md bg-slate-800 text-[10px] font-mono font-bold text-emerald-300">
                        Nv {offer.currentLevel}/{offer.maxLevel}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">{spec.description}</p>
                    <div className="mt-2.5 flex flex-wrap gap-1.5 text-[10px]">
                      {offer.capacityAdded > 0 && (
                        <span className="px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 font-semibold">
                          +{offer.capacityAdded.toLocaleString('pt-BR')} lugares
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 font-semibold">
                        +{offer.homeFactorAdded} Fator Casa
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        {offer.days} dias de obra
                      </span>
                    </div>
                  </div>

                  {offer.currentLevel >= offer.maxLevel ? (
                    <div className="py-2 text-center rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-[11px] font-bold text-emerald-300">
                      Nível Máximo Alcançado
                    </div>
                  ) : offer.inProgress ? (
                    <div className="py-2 text-center rounded-xl bg-amber-500/15 border border-amber-500/40 text-[11px] font-bold text-amber-300">
                      Obra em Andamento...
                    </div>
                  ) : (
                    <button
                      onClick={() => startStadiumUpgrade(spec.category)}
                      disabled={!affordable}
                      className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-xs font-bold text-white transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Hammer className="w-3.5 h-3.5" />
                      Expandir ({formatCurrency(offer.cost)})
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </Panel>

        {/* Simulador de Bilheteria e Preço de Ingressos (5 cols) */}
        <Panel
          title="Gestão de Bilheteria e Ingressos"
          subtitle="Preços altos reduzem ocupação e pressão da torcida; encontre o ponto ideal entre renda e estádio cheio"
          className="lg:col-span-5"
        >
          <div className="space-y-5">
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="font-semibold text-slate-300">Preço Ingresso Arquibancada</span>
                <span className="font-mono font-black text-emerald-400">R$ {st.ticketPrice}</span>
              </div>
              <input
                type="range"
                min={20}
                max={220}
                step={5}
                value={st.ticketPrice}
                onChange={(e) => updateTicketPrices(Number(e.target.value), st.vipTicketPrice)}
                className="w-full accent-emerald-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="font-semibold text-slate-300">Preço Camarote / Setor VIP</span>
                <span className="font-mono font-black text-amber-300">R$ {st.vipTicketPrice}</span>
              </div>
              <input
                type="range"
                min={100}
                max={750}
                step={10}
                value={st.vipTicketPrice}
                onChange={(e) => updateTicketPrices(st.ticketPrice, Number(e.target.value))}
                className="w-full accent-amber-400"
              />
              {st.vipLevel === 0 && (
                <p className="text-[10px] text-amber-300 mt-1">
                  Construa Setores VIP para liberar vendas de camarotes corporativos!
                </p>
              )}
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="font-semibold text-slate-400">Simular Importância do Jogo</span>
                <span className="font-mono font-bold text-sky-300">{simImportance}/10</span>
              </div>
              <input
                type="range"
                min={3}
                max={10}
                value={simImportance}
                onChange={(e) => setSimImportance(Number(e.target.value))}
                className="w-full accent-sky-400"
              />
            </div>

            <div className="p-4 rounded-2xl bg-[#0a101d] border border-slate-800 space-y-2.5 text-xs">
              <p className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                Projeção contra {sampleOpponent.shortName} (Rep {sampleOpponent.reputation})
              </p>
              <div className="flex justify-between">
                <span className="text-slate-400">Público Total Previsto</span>
                <span className="font-mono font-bold text-white">
                  {boxOffice.attendance.toLocaleString('pt-BR')} ({boxOffice.occupancyPct}%)
                </span>
              </div>
              <ProgressBar value={boxOffice.occupancyPct} color="sky" height="h-1.5" />
              <div className="flex justify-between pt-1">
                <span className="text-slate-400">Arquibancadas ({boxOffice.regularTicketsSold.toLocaleString('pt-BR')} ing.)</span>
                <span className="font-mono text-slate-200">{formatCurrency(boxOffice.regularRevenue)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Setores VIP ({boxOffice.vipTicketsSold.toLocaleString('pt-BR')} ing.)</span>
                <span className="font-mono text-amber-300">{formatCurrency(boxOffice.vipRevenue)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-800 text-sm">
                <span className="font-bold text-white">Receita Total da Partida</span>
                <span className="font-mono font-black text-emerald-400">
                  {formatCurrency(boxOffice.totalRevenue)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Bônus de Fator Casa na Simulação</span>
                <span className="font-mono font-bold text-amber-300">+{boxOffice.homeAtmosphereBonus}</span>
              </div>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
};
