import React, { useMemo, useState } from 'react';
import { useGame } from '../store/GameContext';
import { Position } from '../types/game';
import { formatCurrency, POSITIONS } from '../engine/constants';
import { calculateBaseOverall, getPlayerTemporaryModifiers } from '../engine/overall';
import { calculateSquadChemistry } from '../engine/chemistry';
import {
  DissatisfactionBadge,
  OverallBadge,
  Panel,
  PositionBadge,
  ProgressBar,
  RoleBadge,
} from '../components/UI';
import { Search, UserPlus, HeartPulse, Tag, Sparkles } from 'lucide-react';

type SortKey = 'overall' | 'age' | 'potential' | 'value' | 'salary' | 'fatigue' | 'moral';

export const SquadPage: React.FC = () => {
  const { state, userClub, userPlayers, navigate, promoteYouthAcademyPlayer, setPlayerListing } = useGame();
  const [posFilter, setPosFilter] = useState<Position | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('overall');

  const chemReport = useMemo(() => calculateSquadChemistry(userClub, state.players), [userClub, state.players]);
  const starterSet = new Set(userClub.tactics.startingXI);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return userPlayers
      .filter((p) => {
        if (posFilter !== 'ALL' && p.primaryPosition !== posFilter && p.secondaryPosition !== posFilter) return false;
        if (q && !p.fullName.toLowerCase().includes(q) && !p.nationality.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'overall') return calculateBaseOverall(b) - calculateBaseOverall(a);
        if (sortBy === 'age') return a.age - b.age;
        if (sortBy === 'potential') return b.potential - a.potential;
        if (sortBy === 'value') return b.marketValue - a.marketValue;
        if (sortBy === 'salary') return b.contract.salary - a.contract.salary;
        if (sortBy === 'fatigue') return b.conditional.fadiga - a.conditional.fadiga;
        return b.conditional.moral - a.conditional.moral;
      });
  }, [userPlayers, posFilter, search, sortBy]);

  const totalPayroll = userPlayers.reduce((a, p) => a + p.contract.salary, 0);
  const totalValue = userPlayers.reduce((a, p) => a + p.marketValue, 0);
  const avgAge = (userPlayers.reduce((a, p) => a + p.age, 0) / Math.max(1, userPlayers.length)).toFixed(1);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">Gestão do Elenco</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {userPlayers.length} jogadores • Idade média {avgAge} anos • Valor total {formatCurrency(totalValue)} •
            Folha mensal {formatCurrency(totalPayroll)}
          </p>
        </div>

        <button
          onClick={promoteYouthAcademyPlayer}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-md transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Promover Jovem da Base (R$ 650 mil)
        </button>
      </div>

      {/* Barra de filtros */}
      <Panel>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar atleta ou nacionalidade..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#0a101d] border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <select
            value={posFilter}
            onChange={(e) => setPosFilter(e.target.value as Position | 'ALL')}
            className="px-3 py-2 rounded-xl bg-[#0a101d] border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="ALL">Todas Posições</option>
            {POSITIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="px-3 py-2 rounded-xl bg-[#0a101d] border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="overall">Ordenar: Overall</option>
            <option value="potential">Ordenar: Potencial</option>
            <option value="age">Ordenar: Idade</option>
            <option value="value">Ordenar: Valor de Mercado</option>
            <option value="salary">Ordenar: Salário</option>
            <option value="fatigue">Ordenar: Fadiga</option>
            <option value="moral">Ordenar: Moral</option>
          </select>
        </div>
      </Panel>

      {/* Tabela completa */}
      <Panel
        title={`Plantel Profissional (${filtered.length})`}
        subtitle="Clique em qualquer atleta para abrir o Perfil Completo com atributos, modificadores temporários, química e renovação contratual"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <th className="py-2.5 text-left">Jogador</th>
                <th className="py-2.5 text-center">Pos</th>
                <th className="py-2.5 text-center">Idade</th>
                <th className="py-2.5 text-center">OVR (Mod)</th>
                <th className="py-2.5 text-center">POT</th>
                <th className="py-2.5 text-left">Papel Contratual</th>
                <th className="py-2.5 text-center">Satisfação</th>
                <th className="py-2.5 text-center w-24">Cond / Fad</th>
                <th className="py-2.5 text-center">Quím</th>
                <th className="py-2.5 text-right">Valor / Salário</th>
                <th className="py-2.5 text-right">Mercado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {filtered.map((p) => {
                const baseOvr = calculateBaseOverall(p);
                const mods = getPlayerTemporaryModifiers(p);
                const isStarter = starterSet.has(p.id);
                const chem = chemReport.playerScores[p.id];

                return (
                  <tr
                    key={p.id}
                    onClick={() => navigate('player_profile', p.id)}
                    className="hover:bg-slate-800/45 cursor-pointer transition-colors"
                  >
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-2">
                        {isStarter && (
                          <span
                            className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"
                            title="Titular atual"
                          />
                        )}
                        <div>
                          <div className="font-bold text-white flex items-center gap-1.5">
                            {p.fullName}
                            {p.injury && (
                              <span
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-bold"
                                title={`${p.injury.type} (${p.injury.remainingDays}d)`}
                              >
                                <HeartPulse className="w-3 h-3" /> {p.injury.remainingDays}d
                              </span>
                            )}
                            {p.contract.requestedTransfer && (
                              <span className="px-1.5 py-0.5 rounded bg-rose-600/30 text-rose-200 text-[10px] font-bold">
                                Pediu saída
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {p.nationality} • {p.personality} • {p.careerStats.seasonMatches}J / {p.careerStats.seasonGoals}G / {p.careerStats.seasonAssists}A
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <PositionBadge position={p.primaryPosition} size="xs" />
                        {p.secondaryPosition && (
                          <span className="text-[9px] text-slate-500">{p.secondaryPosition}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 text-center font-mono text-slate-200 tabular-nums">{p.age}</td>
                    <td className="py-3 text-center">
                      <OverallBadge base={baseOvr} delta={mods.overallDelta} />
                    </td>
                    <td className="py-3 text-center">
                      <span className="inline-flex items-center gap-0.5 font-mono font-bold text-sky-300 tabular-nums">
                        {p.potential}
                        {p.potential - baseOvr >= 6 && <Sparkles className="w-3 h-3 text-amber-300" />}
                      </span>
                    </td>
                    <td className="py-3">
                      <RoleBadge role={p.contract.role} />
                    </td>
                    <td className="py-3 text-center">
                      <DissatisfactionBadge level={p.contract.dissatisfaction} />
                    </td>
                    <td className="py-3 px-2">
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-slate-400">
                          <span>Cond {p.conditional.condicionamento}</span>
                          <span className={p.conditional.fadiga >= 65 ? 'text-rose-400 font-bold' : ''}>
                            Fad {p.conditional.fadiga}
                          </span>
                        </div>
                        <ProgressBar value={100 - p.conditional.fadiga} height="h-1.5" />
                      </div>
                    </td>
                    <td className="py-3 text-center font-mono font-bold text-emerald-300 tabular-nums">
                      {chem !== undefined ? `${chem}%` : `${p.chemistry.tacticalFamiliarity}%`}
                    </td>
                    <td className="py-3 text-right tabular-nums">
                      <div className="font-bold text-white">{formatCurrency(p.marketValue)}</div>
                      <div className="text-[11px] text-slate-400">{formatCurrency(p.contract.salary)}/mês</div>
                    </td>
                    <td
                      className="py-3 pl-3 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => setPlayerListing(p.id, !p.isTransferListed, p.isLoanListed)}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                          p.isTransferListed
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-white'
                        }`}
                        title="Colocar ou remover da lista de transferências"
                      >
                        <Tag className="w-3 h-3" />
                        {p.isTransferListed ? 'À venda' : 'Listar'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
};
