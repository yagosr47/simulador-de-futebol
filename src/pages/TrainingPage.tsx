import React, { useState } from 'react';
import { useGame } from '../store/GameContext';
import { TrainingIntensity, TrainingType } from '../types/game';
import { formatCurrency, TRAINING_DESCRIPTIONS } from '../engine/constants';
import { TrainingSessionResult } from '../engine/training';
import { calculateBaseOverall } from '../engine/overall';
import { Panel, PositionBadge, ProgressBar } from '../components/UI';
import { Dumbbell, Flame, HeartPulse, Play, Star, Trash2, UserPlus, Sparkles } from 'lucide-react';

const ALL_TRAINING_TYPES: TrainingType[] = [
  'Individual',
  'Coletivo',
  'Físico',
  'Técnico',
  'Tático',
  'Mental',
  'Finalização',
  'Defensivo',
  'Recuperação Física',
];

const INDIVIDUAL_OPTIONS: TrainingType[] = ['Técnico', 'Físico', 'Tático', 'Mental', 'Finalização', 'Defensivo'];

export const TrainingPage: React.FC = () => {
  const {
    state,
    userClub,
    userPlayers,
    runTrainingSession,
    setPlayerIndividualTraining,
    hireCoach,
    fireCoach,
    navigate,
  } = useGame();

  const [selectedType, setSelectedType] = useState<TrainingType>(userClub.trainingSchedule.collectiveFocus);
  const [intensity, setIntensity] = useState<TrainingIntensity>(userClub.trainingSchedule.intensity);
  const [lastResult, setLastResult] = useState<TrainingSessionResult | null>(null);

  const healthyPlayers = userPlayers.filter((p) => !p.injury);
  const avgFatigue = Math.round(
    healthyPlayers.reduce((a, p) => a + p.conditional.fadiga, 0) / Math.max(1, healthyPlayers.length),
  );
  const avgCond = Math.round(
    healthyPlayers.reduce((a, p) => a + p.conditional.condicionamento, 0) / Math.max(1, healthyPlayers.length),
  );
  const avgCoachQuality =
    userClub.coaches.length > 0
      ? Math.round(userClub.coaches.reduce((a, c) => a + c.quality, 0) / userClub.coaches.length)
      : 0;

  const selectedSpec = TRAINING_DESCRIPTIONS[selectedType];
  const intMult = intensity === 'Intenso' ? 1.55 : intensity === 'Leve' ? 0.6 : 1.0;
  const projectedFatigue =
    selectedType === 'Recuperação Física' ? selectedSpec.fatigueBase : Math.round(selectedSpec.fatigueBase * intMult);
  const projectedRiskPct = (
    selectedSpec.injuryBase *
    (intensity === 'Intenso' ? 1.85 : intensity === 'Leve' ? 0.5 : 1) *
    100
  ).toFixed(1);

  const handleRun = () => {
    const res = runTrainingSession(selectedType, intensity);
    if (res) setLastResult(res);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">Centro de Treinamento</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Cada sessão consome tempo de calendário e afeta evolução, química, condicionamento, fadiga e risco de lesão.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3.5 py-2 rounded-xl bg-[#0e1525] border border-slate-800 text-xs">
            <span className="text-slate-400">Fadiga Média: </span>
            <span className={`font-black font-mono ${avgFatigue >= 60 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {avgFatigue}%
            </span>
          </div>
          <div className="px-3.5 py-2 rounded-xl bg-[#0e1525] border border-slate-800 text-xs">
            <span className="text-slate-400">Condição Média: </span>
            <span className="font-black font-mono text-sky-300">{avgCond}%</span>
          </div>
        </div>
      </div>

      {/* Painel de Seleção de Sessão */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Panel
          title="Escolher Tipo de Treinamento (9 Modalidades)"
          subtitle="Treinamentos intensos aceleram a evolução mas aumentam fadiga e risco de lesão"
          className="lg:col-span-8"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-5">
            {ALL_TRAINING_TYPES.map((type) => {
              const info = TRAINING_DESCRIPTIONS[type];
              const active = selectedType === type;
              return (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    active
                      ? 'bg-emerald-500/15 border-emerald-400/70 shadow-md'
                      : 'bg-[#0a101d] border-slate-800 hover:border-slate-600'
                  }`}
                >
                  <p className="text-xs font-bold text-white flex items-center justify-between">
                    {info.label}
                    {type === 'Recuperação Física' && <HeartPulse className="w-3.5 h-3.5 text-emerald-400" />}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{info.targetSummary}</p>
                </button>
              );
            })}
          </div>

          <div className="p-4 rounded-2xl bg-[#0a101d] border border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1 max-w-md">
              <p className="text-xs font-bold text-emerald-300">{selectedSpec.label}</p>
              <p className="text-xs text-slate-300">{selectedSpec.description}</p>
              <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px]">
                <span className={projectedFatigue > 0 ? 'text-amber-300' : 'text-emerald-400'}>
                  Fadiga estimada: <strong>{projectedFatigue > 0 ? `+${projectedFatigue}` : projectedFatigue}</strong>
                </span>
                <span className="text-rose-300">
                  Risco base de lesão: <strong>{projectedRiskPct}%</strong>
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="flex rounded-xl bg-slate-900 border border-slate-700 p-1">
                {(['Leve', 'Moderado', 'Intenso'] as TrainingIntensity[]).map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => setIntensity(lvl)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 ${
                      intensity === lvl
                        ? lvl === 'Intenso'
                          ? 'bg-rose-600 text-white'
                          : lvl === 'Moderado'
                            ? 'bg-amber-600 text-white'
                            : 'bg-emerald-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {lvl === 'Intenso' && <Flame className="w-3 h-3" />}
                    {lvl}
                  </button>
                ))}
              </div>

              <button
                onClick={handleRun}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-xs font-black text-white shadow-lg flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4 fill-current" />
                Executar Sessão (Consome 1 Dia)
              </button>
            </div>
          </div>

          {/* Resultado da última sessão */}
          {lastResult && (
            <div className="mt-4 p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" /> Relatório da Sessão Recente
                </p>
                <span className="text-[11px] text-slate-300">{lastResult.summary}</span>
              </div>
              {lastResult.attributeGains.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {lastResult.attributeGains.map((g, idx) => (
                    <span
                      key={`${g.playerId}-${idx}`}
                      className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-[11px] text-emerald-200 font-semibold"
                    >
                      {g.playerName}: +1 {g.attribute} ({g.newValue})
                    </span>
                  ))}
                </div>
              )}
              {lastResult.injuredPlayers.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {lastResult.injuredPlayers.map((inj) => (
                    <span
                      key={inj.playerId}
                      className="px-2.5 py-1 rounded-lg bg-rose-500/20 border border-rose-500/40 text-[11px] text-rose-200 font-semibold"
                    >
                      Lesão: {inj.playerName} — {inj.injuryType} ({inj.days}d)
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </Panel>

        {/* Comissão Técnica Atual */}
        <Panel
          title={`Comissão Técnica (${userClub.coaches.length})`}
          subtitle={`Qualidade média: ${avgCoachQuality} • Infraestrutura CT Nível ${userClub.stadium.infrastructureLevel}`}
          className="lg:col-span-4"
        >
          <div className="space-y-2.5">
            {userClub.coaches.map((c) => (
              <div
                key={c.id}
                className="p-3 rounded-xl bg-[#0a101d] border border-slate-800 flex items-start justify-between gap-2"
              >
                <div>
                  <p className="text-xs font-bold text-white flex items-center gap-1.5">
                    {c.name}
                    <span className="text-amber-400 inline-flex items-center text-[10px]">
                      <Star className="w-3 h-3 fill-current mr-0.5" />
                      {c.level}
                    </span>
                  </p>
                  <p className="text-[11px] text-emerald-400 font-medium">{c.specialty}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Qualidade {c.quality} • Desenv. {c.developmentAbility} • {formatCurrency(c.monthlySalary)}/mês
                  </p>
                </div>
                {userClub.coaches.length > 1 && (
                  <button
                    onClick={() => fireCoach(c.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10"
                    title="Demitir treinador"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Treinamento Individual por Atleta + Mercado de Treinadores */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Panel
          title="Planejamento Individual do Elenco"
          subtitle="Configura o atributo-alvo quando você executa Treinamento Individual"
          className="lg:col-span-7"
        >
          <div className="max-h-[400px] overflow-y-auto divide-y divide-slate-800/70">
            {userPlayers.map((p) => (
              <div key={p.id} className="py-2.5 flex flex-wrap items-center justify-between gap-3">
                <div
                  onClick={() => navigate('player_profile', p.id)}
                  className="flex items-center gap-2.5 cursor-pointer min-w-[180px]"
                >
                  <PositionBadge position={p.primaryPosition} size="xs" />
                  <div>
                    <p className="text-xs font-bold text-white hover:text-emerald-300">
                      {p.shortName}{' '}
                      <span className="text-[10px] font-mono text-slate-400">
                        ({p.age}a • OVR {calculateBaseOverall(p)} / POT {p.potential})
                      </span>
                    </p>
                    <div className="flex items-center gap-2 mt-1 w-40">
                      <ProgressBar value={p.developmentProgress} color="sky" height="h-1" />
                      <span className="text-[10px] text-slate-400 font-mono">{p.developmentProgress}%</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`text-[11px] font-mono font-bold ${
                      p.injury
                        ? 'text-rose-400'
                        : p.conditional.fadiga >= 65
                          ? 'text-amber-300'
                          : 'text-emerald-400'
                    }`}
                  >
                    {p.injury ? 'Lesionado' : `Fadiga ${p.conditional.fadiga}%`}
                  </span>

                  <select
                    value={p.individualTrainingFocus ?? 'Técnico'}
                    onChange={(e) => setPlayerIndividualTraining(p.id, e.target.value as TrainingType)}
                    className="px-2.5 py-1.5 rounded-lg bg-[#0a101d] border border-slate-700 text-xs text-slate-100"
                  >
                    {INDIVIDUAL_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          title="Contratar Treinadores Especialistas"
          subtitle="Especialistas elevam a taxa de evolução na área correspondente"
          className="lg:col-span-5"
        >
          <div className="space-y-2.5 max-h-[400px] overflow-y-auto pr-1">
            {state.availableCoaches.map((c) => (
              <div
                key={c.id}
                className="p-3 rounded-xl bg-[#0a101d] border border-slate-800 flex items-center justify-between gap-3"
              >
                <div>
                  <p className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Dumbbell className="w-3.5 h-3.5 text-emerald-400" />
                    {c.name}
                    <span className="text-amber-400 text-[10px] font-bold">{'★'.repeat(c.level)}</span>
                  </p>
                  <p className="text-[11px] text-sky-300">{c.specialty}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Qual {c.quality} • Desenv {c.developmentAbility} • Sal {formatCurrency(c.monthlySalary)}/mês
                  </p>
                </div>
                <button
                  onClick={() => hireCoach(c.id)}
                  className="shrink-0 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/40 text-[11px] font-bold flex items-center gap-1 transition-colors"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  {formatCurrency(c.hiringFee)}
                </button>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
};
