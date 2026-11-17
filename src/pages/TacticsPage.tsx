import React, { useMemo, useState } from 'react';
import { useGame } from '../store/GameContext';
import {
  DefensiveLine,
  FormationName,
  PassingStyle,
  PlayStyle,
  PressingIntensity,
  TacticalMentality,
  TempoStyle,
} from '../types/game';
import { FORMATIONS } from '../engine/constants';
import {
  calculateBaseOverall,
  calculateEffectiveOverall,
  calculateTeamStrength,
  getPlayerTemporaryModifiers,
  getPositionFitPenalty,
} from '../engine/overall';
import { calculateSquadChemistry } from '../engine/chemistry';
import { OverallBadge, Panel, PositionBadge, ProgressBar } from '../components/UI';
import { ArrowLeftRight, Sparkles, Wand2, HeartPulse } from 'lucide-react';

const FORMATION_NAMES: FormationName[] = ['4-3-3', '4-4-2', '4-2-3-1', '3-5-2', '5-3-2', '4-1-4-1', '3-4-3'];
const MENTALITIES: TacticalMentality[] = ['Ultradefensiva', 'Defensiva', 'Equilibrada', 'Ofensiva', 'Ultraofensiva'];
const PRESSINGS: PressingIntensity[] = ['Baixa', 'Média', 'Alta', 'Pressão Total'];
const PASSINGS: PassingStyle[] = ['Curto', 'Misto', 'Direto', 'Longo'];
const TEMPOS: TempoStyle[] = ['Lento', 'Controlado', 'Rápido'];
const DEF_LINES: DefensiveLine[] = ['Recuada', 'Padrão', 'Adiantada'];
const PLAY_STYLES: PlayStyle[] = [
  'Posse de Bola',
  'Contra-Ataque',
  'Pressão Alta',
  'Jogo Direto',
  'Tático Equilibrado',
];

export const TacticsPage: React.FC = () => {
  const { state, userClub, userPlayers, updateTactics, autoPickLineup, navigate } = useGame();
  const [selectedSlot, setSelectedSlot] = useState<{ zone: 'xi' | 'bench' | 'res'; index: number; playerId: string } | null>(null);

  const slots = FORMATIONS[userClub.tactics.formation];
  const strength = useMemo(() => calculateTeamStrength(userClub, state.players), [userClub, state.players]);
  const chem = useMemo(() => calculateSquadChemistry(userClub, state.players), [userClub, state.players]);

  const xiSet = new Set(userClub.tactics.startingXI);
  const benchSet = new Set(userClub.tactics.bench);
  const reserves = userPlayers.filter((p) => !xiSet.has(p.id) && !benchSet.has(p.id));

  const handleSelectOrSwap = (zone: 'xi' | 'bench' | 'res', index: number, playerId: string) => {
    if (!selectedSlot) {
      setSelectedSlot({ zone, index, playerId });
      return;
    }

    if (selectedSlot.playerId === playerId) {
      setSelectedSlot(null);
      return;
    }

    const nextXI = [...userClub.tactics.startingXI];
    const nextBench = [...userClub.tactics.bench];

    const a = selectedSlot;
    const b = { zone, index, playerId };

    if (a.zone === 'xi' && b.zone === 'xi') {
      [nextXI[a.index], nextXI[b.index]] = [nextXI[b.index], nextXI[a.index]];
    } else if (a.zone === 'xi' && b.zone === 'bench') {
      nextXI[a.index] = b.playerId;
      nextBench[b.index] = a.playerId;
    } else if (a.zone === 'bench' && b.zone === 'xi') {
      nextXI[b.index] = a.playerId;
      nextBench[a.index] = b.playerId;
    } else if (a.zone === 'xi' && b.zone === 'res') {
      nextXI[a.index] = b.playerId;
    } else if (a.zone === 'res' && b.zone === 'xi') {
      nextXI[b.index] = a.playerId;
    } else if (a.zone === 'bench' && b.zone === 'res') {
      nextBench[a.index] = b.playerId;
    } else if (a.zone === 'res' && b.zone === 'bench') {
      nextBench[b.index] = a.playerId;
    } else if (a.zone === 'bench' && b.zone === 'bench') {
      [nextBench[a.index], nextBench[b.index]] = [nextBench[b.index], nextBench[a.index]];
    }

    updateTactics({ startingXI: nextXI, bench: nextBench });
    setSelectedSlot(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">Prancheta Tática & Química</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Clique em dois jogadores (campo, banco ou reservas) para trocar de lugar. Linhas no gramado mostram a química em tempo real.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={autoPickLineup}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition-colors"
          >
            <Wand2 className="w-4 h-4" /> Escalar Melhor XI
          </button>
        </div>
      </div>

      {/* Força da Equipe & Bônus de Química */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          ['Força Geral', strength.overall, 'text-emerald-400'],
          ['Titulares', strength.startersRating, 'text-white'],
          ['Química', `${strength.chemistryScore}%`, 'text-sky-300'],
          ['Compat. Tática', `${strength.tacticalCompatibility}%`, 'text-amber-300'],
          ['Org. Defensiva', strength.defensiveOrganization, 'text-indigo-300'],
          ['Org. Ofensiva', strength.offensiveOrganization, 'text-rose-300'],
        ].map(([label, val, cls]) => (
          <div key={String(label)} className="p-3.5 rounded-2xl bg-[#0e1525] border border-slate-800 text-center">
            <p className="text-[10px] font-bold uppercase text-slate-400">{label}</p>
            <p className={`text-xl font-black font-mono tabular-nums mt-0.5 ${cls}`}>{val}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Campo Interativo (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <Panel
            title={`Formação ${userClub.tactics.formation}`}
            subtitle={
              selectedSlot
                ? `Selecionado: ${state.players[selectedSlot.playerId]?.shortName} — clique em outro jogador para trocar`
                : 'Clique em um jogador para iniciar uma troca'
            }
            right={
              <div className="flex flex-wrap gap-1">
                {FORMATION_NAMES.map((fm) => (
                  <button
                    key={fm}
                    onClick={() => updateTactics({ formation: fm })}
                    className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                      userClub.tactics.formation === fm
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {fm}
                  </button>
                ))}
              </div>
            }
          >
            {/* Prancheta 2D */}
            <div className="relative w-full aspect-[4/5] sm:aspect-[16/14] rounded-2xl border-2 border-emerald-500/35 pitch-bg overflow-hidden select-none">
              {/* Marcações do campo */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                <rect x="4" y="4" width="92" height="92" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="0.4" />
                <line x1="4" y1="50" x2="96" y2="50" stroke="rgba(255,255,255,0.22)" strokeWidth="0.4" />
                <circle cx="50" cy="50" r="10" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="0.4" />
                <rect x="25" y="4" width="50" height="14" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="0.4" />
                <rect x="25" y="82" width="50" height="14" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="0.4" />

                {/* Linhas de química entre jogadores */}
                {chem.links.map((lk) => {
                  const sA = slots[lk.slotA];
                  const sB = slots[lk.slotB];
                  if (!sA || !sB) return null;
                  const stroke =
                    lk.score >= 76
                      ? 'rgba(52, 211, 153, 0.72)'
                      : lk.score >= 54
                        ? 'rgba(251, 191, 36, 0.58)'
                        : 'rgba(244, 63, 94, 0.65)';
                  return (
                    <line
                      key={`${lk.slotA}-${lk.slotB}`}
                      x1={sA.x}
                      y1={sA.y}
                      x2={sB.x}
                      y2={sB.y}
                      stroke={stroke}
                      strokeWidth={lk.score >= 76 ? '0.9' : '0.65'}
                      strokeDasharray={lk.score < 54 ? '1.6 1.2' : undefined}
                    />
                  );
                })}
              </svg>

              {/* Nós dos 11 Titulares */}
              {slots.map((slot) => {
                const pid = userClub.tactics.startingXI[slot.slotIndex];
                const p = pid ? state.players[pid] : undefined;
                if (!p) return null;
                const eff = calculateEffectiveOverall(p, slot.position);
                const fitPenalty = getPositionFitPenalty(p, slot.position);
                const mods = getPlayerTemporaryModifiers(p);
                const isSelected = selectedSlot?.playerId === p.id;
                const pChem = chem.playerScores[p.id] ?? 60;

                return (
                  <button
                    key={slot.slotIndex}
                    onClick={() => handleSelectOrSwap('xi', slot.slotIndex, p.id)}
                    style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group transition-transform ${
                      isSelected ? 'scale-110 z-20' : 'hover:scale-105 z-10'
                    }`}
                  >
                    <div
                      className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex flex-col items-center justify-center border-2 shadow-xl transition-all ${
                        isSelected
                          ? 'bg-emerald-500 border-white text-slate-950'
                          : p.injury
                            ? 'bg-rose-950 border-rose-400 text-rose-200'
                            : fitPenalty >= 5
                              ? 'bg-amber-950/90 border-amber-400 text-amber-100'
                              : 'bg-[#0b1324]/95 border-emerald-400/70 text-white'
                      }`}
                    >
                      <span className="text-[9px] font-black uppercase leading-none opacity-80">{slot.label}</span>
                      <span className="text-sm font-black font-mono leading-tight">
                        {eff}
                      </span>
                    </div>
                    <div className="mt-1 px-2 py-0.5 rounded-md bg-slate-950/90 border border-slate-700/80 text-[10px] font-bold text-white whitespace-nowrap max-w-[96px] truncate shadow">
                      {p.shortName}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5 text-[9px] font-mono">
                      <span className="px-1 rounded bg-slate-950/80 text-emerald-300">Q:{pChem}</span>
                      {mods.overallDelta !== 0 && (
                        <span
                          className={`px-1 rounded bg-slate-950/80 font-bold ${
                            mods.overallDelta < 0 ? 'text-rose-400' : 'text-emerald-400'
                          }`}
                        >
                          {mods.overallDelta > 0 ? `+${mods.overallDelta}` : mods.overallDelta}
                        </span>
                      )}
                      {p.injury && <HeartPulse className="w-3 h-3 text-rose-400" />}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Multiplicadores reais de química na partida */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4">
              {[
                ['Qualidade de Passe', chem.passingBonus],
                ['Movimentação', chem.movementBonus],
                ['Posicionamento', chem.positioningBonus],
                ['Jogadas Coletivas', chem.collectivePlayBonus],
              ].map(([label, mult]) => {
                const pct = Math.round((Number(mult) - 1) * 100);
                return (
                  <div key={String(label)} className="p-2.5 rounded-xl bg-[#0a101d] border border-slate-800 text-center">
                    <p className="text-[10px] text-slate-400">{label}</p>
                    <p
                      className={`text-xs font-mono font-black mt-0.5 ${
                        pct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {pct >= 0 ? `+${pct}%` : `${pct}%`}
                    </p>
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>

        {/* Instruções Táticas + Banco / Reservas (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <Panel title="Instruções Táticas da Equipe" subtitle="Alinhe o estilo com seus jogadores para maximizar compatibilidade">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Estilo de Jogo</label>
                <select
                  value={userClub.tactics.playStyle}
                  onChange={(e) => updateTactics({ playStyle: e.target.value as PlayStyle })}
                  className="w-full px-3 py-2 rounded-xl bg-[#0a101d] border border-slate-700 text-slate-100"
                >
                  {PLAY_STYLES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Mentalidade</label>
                <select
                  value={userClub.tactics.mentality}
                  onChange={(e) => updateTactics({ mentality: e.target.value as TacticalMentality })}
                  className="w-full px-3 py-2 rounded-xl bg-[#0a101d] border border-slate-700 text-slate-100"
                >
                  {MENTALITIES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Intensidade da Pressão</label>
                <select
                  value={userClub.tactics.pressing}
                  onChange={(e) => updateTactics({ pressing: e.target.value as PressingIntensity })}
                  className="w-full px-3 py-2 rounded-xl bg-[#0a101d] border border-slate-700 text-slate-100"
                >
                  {PRESSINGS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Estilo de Passe</label>
                <select
                  value={userClub.tactics.passingStyle}
                  onChange={(e) => updateTactics({ passingStyle: e.target.value as PassingStyle })}
                  className="w-full px-3 py-2 rounded-xl bg-[#0a101d] border border-slate-700 text-slate-100"
                >
                  {PASSINGS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Ritmo de Jogo</label>
                <select
                  value={userClub.tactics.tempo}
                  onChange={(e) => updateTactics({ tempo: e.target.value as TempoStyle })}
                  className="w-full px-3 py-2 rounded-xl bg-[#0a101d] border border-slate-700 text-slate-100"
                >
                  {TEMPOS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Linha Defensiva</label>
                <select
                  value={userClub.tactics.defensiveLine}
                  onChange={(e) => updateTactics({ defensiveLine: e.target.value as DefensiveLine })}
                  className="w-full px-3 py-2 rounded-xl bg-[#0a101d] border border-slate-700 text-slate-100"
                >
                  {DEF_LINES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> Compatibilidade Tática
                </span>
                <span className="font-mono font-bold text-emerald-300">{strength.tacticalCompatibility}%</span>
              </div>
              <ProgressBar value={strength.tacticalCompatibility} color="emerald" height="h-1.5" />
            </div>
          </Panel>

          {/* Banco de Reservas */}
          <Panel
            title={`Banco de Reservas (${userClub.tactics.bench.length})`}
            subtitle="Clique para trocar com qualquer titular"
          >
            <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
              {userClub.tactics.bench.map((pid, idx) => {
                const p = state.players[pid];
                if (!p) return null;
                const isSelected = selectedSlot?.playerId === p.id;
                const mods = getPlayerTemporaryModifiers(p);
                return (
                  <div
                    key={p.id}
                    onClick={() => handleSelectOrSwap('bench', idx, p.id)}
                    className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-emerald-500/20 border-emerald-400'
                        : 'bg-[#0a101d] border-slate-800 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <PositionBadge position={p.primaryPosition} size="xs" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white truncate flex items-center gap-1">
                          {p.shortName}
                          {p.injury && <HeartPulse className="w-3 h-3 text-rose-400" />}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          Fadiga {p.conditional.fadiga}% • {p.contract.role}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <OverallBadge base={calculateBaseOverall(p)} delta={mods.overallDelta} />
                      <ArrowLeftRight className="w-3.5 h-3.5 text-slate-500" />
                    </div>
                  </div>
                );
              })}

              {reserves.length > 0 && (
                <>
                  <p className="text-[10px] uppercase font-bold text-slate-500 pt-2">Fora dos Relacionados ({reserves.length})</p>
                  {reserves.map((p, idx) => {
                    const isSelected = selectedSlot?.playerId === p.id;
                    const mods = getPlayerTemporaryModifiers(p);
                    return (
                      <div
                        key={p.id}
                        onClick={() => handleSelectOrSwap('res', idx, p.id)}
                        className={`p-2 rounded-xl border flex items-center justify-between gap-2 cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-500/20 border-emerald-400'
                            : 'bg-[#090e1a] border-slate-800/70 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <PositionBadge position={p.primaryPosition} size="xs" />
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate('player_profile', p.id);
                            }}
                            className="text-xs text-slate-300 hover:text-white truncate"
                          >
                            {p.shortName} {p.injury ? `(Lesão ${p.injury.remainingDays}d)` : ''}
                          </span>
                        </div>
                        <OverallBadge base={calculateBaseOverall(p)} delta={mods.overallDelta} />
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
};
