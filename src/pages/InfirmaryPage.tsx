import React from 'react';
import { useGame } from '../store/GameContext';
import { computeInjuryRiskForPlayer, getMedicalDepartmentBonuses } from '../engine/infirmary';
import { formatCurrency, formatDateBR } from '../engine/constants';
import { Panel, PositionBadge, ProgressBar, StatCard } from '../components/UI';
import { Activity, AlertTriangle, HeartPulse, ShieldCheck, Stethoscope, Trash2, UserPlus, Zap } from 'lucide-react';

export const InfirmaryPage: React.FC = () => {
  const {
    state,
    userClub,
    userPlayers,
    hireMedicalStaff,
    fireMedicalStaff,
    applyRehabProtocol,
    navigate,
  } = useGame();

  const injured = userPlayers.filter((p) => p.injury);
  const returning = userPlayers.filter((p) => !p.injury && p.returnToPlaySharpness < 95);
  const highRisk = userPlayers
    .filter((p) => !p.injury)
    .map((p) => ({
      player: p,
      riskPct: Math.round(
        computeInjuryRiskForPlayer(p, 0.03, userClub.medicalStaff, userClub.stadium.infrastructureLevel) * 1000,
      ) / 10,
    }))
    .filter((x) => x.player.conditional.fadiga >= 45 || x.riskPct >= 5)
    .sort((a, b) => b.riskPct - a.riskPct)
    .slice(0, 6);

  const medBonuses = getMedicalDepartmentBonuses(userClub.medicalStaff);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">Enfermaria & Departamento Médico</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Acompanhe lesões, estágios clínicos, retorno gradual de condicionamento e contrate especialistas médicos.
          </p>
        </div>
      </div>

      {/* KPIs do Departamento Médico */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Atletas Lesionados"
          value={injured.length}
          sub={injured.length === 0 ? 'Departamento médico zerado!' : 'Em tratamento ativo'}
          icon={<HeartPulse className="w-5 h-5" />}
          accent={injured.length > 0 ? 'rose' : 'emerald'}
        />
        <StatCard
          label="Velocidade de Recuperação"
          value={`${Math.round((medBonuses.recoverySpeedMultiplier - 1) * 100)}%+`}
          sub={`Qualidade médica média: ${medBonuses.avgQuality}/99`}
          icon={<Activity className="w-5 h-5" />}
          accent="sky"
        />
        <StatCard
          label="Prevenção de Lesões"
          value={`-${Math.round(medBonuses.injuryRiskReduction * 100)}%`}
          sub={`Infraestrutura CT Nv ${userClub.stadium.infrastructureLevel}`}
          icon={<ShieldCheck className="w-5 h-5" />}
          accent="emerald"
        />
        <StatCard
          label="Retorno Gradual"
          value={returning.length}
          sub="Em transição de condicionamento"
          icon={<Stethoscope className="w-5 h-5" />}
          accent="amber"
        />
      </div>

      {/* Lista de Jogadores Lesionados */}
      <Panel
        title={`Pacientes na Enfermaria (${injured.length})`}
        subtitle="Evolução diária automática acelerada pela equipe médica"
      >
        {injured.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-400 space-y-2">
            <ShieldCheck className="w-10 h-10 text-emerald-400 mx-auto" />
            <p className="text-sm font-bold text-white">Nenhum jogador lesionado no momento!</p>
            <p>Continue equilibrando intensidade de treinos e sessões de recuperação física.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {injured.map((p) => {
              const inj = p.injury!;
              const sevColor =
                inj.severity === 'Muito Grave' || inj.severity === 'Grave'
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  : inj.severity === 'Moderada'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-sky-500/20 text-sky-300 border-sky-500/40';

              return (
                <div
                  key={p.id}
                  className="p-4 rounded-2xl bg-[#0a101d] border border-rose-500/30 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <PositionBadge position={p.primaryPosition} />
                      <div>
                        <button
                          onClick={() => navigate('player_profile', p.id)}
                          className="text-sm font-black text-white hover:text-emerald-300"
                        >
                          {p.fullName}
                        </button>
                        <p className="text-xs text-rose-300 font-semibold">{inj.type}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${sevColor}`}>
                      {inj.severity}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-[11px]">
                    <div className="p-2 rounded-lg bg-slate-900/80">
                      <p className="text-slate-400">Estágio Atual</p>
                      <p className="font-bold text-white mt-0.5">{inj.stage}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-900/80">
                      <p className="text-slate-400">Previsão</p>
                      <p className="font-mono font-bold text-amber-300 mt-0.5">{inj.remainingDays} dia(s)</p>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-900/80">
                      <p className="text-slate-400">Origem</p>
                      <p className="font-bold text-slate-200 mt-0.5">{inj.cause}</p>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-slate-400">Evolução do Tratamento</span>
                      <span className="font-mono font-bold text-emerald-400">{inj.treatmentProgress}%</span>
                    </div>
                    <ProgressBar value={inj.treatmentProgress} color="emerald" />
                    <p className="text-[10px] text-slate-500 mt-1">
                      Ocorrida em {formatDateBR(inj.incurredDate)} • Total estimado: {inj.totalDays} dias
                    </p>
                  </div>

                  <div className="pt-1 flex justify-end">
                    <button
                      onClick={() => applyRehabProtocol(p.id)}
                      className="px-3 py-1.5 rounded-xl bg-sky-600/20 hover:bg-sky-600 text-sky-300 hover:text-white border border-sky-500/40 text-xs font-bold flex items-center gap-1.5 transition-colors"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      Reabilitação Intensiva (-28% dias • R$ 180 mil)
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      {/* Monitor de Retorno Gradual + Risco de Lesão */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel
          title="Retorno Gradual (Transição Física)"
          subtitle="Jogadores liberados recentemente recuperam condicionamento aos poucos"
        >
          {returning.length === 0 ? (
            <p className="text-xs text-slate-400 py-4">Todos os jogadores liberados já estão 100% em forma clínica.</p>
          ) : (
            <div className="space-y-2.5">
              {returning.map((p) => (
                <div key={p.id} className="p-3 rounded-xl bg-[#0a101d] border border-slate-800 space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="font-bold text-white">{p.fullName}</span>
                    <span className="font-mono text-amber-300 font-bold">
                      Prontidão {p.returnToPlaySharpness}%
                    </span>
                  </div>
                  <ProgressBar value={p.returnToPlaySharpness} color="amber" height="h-1.5" />
                  <p className="text-[10px] text-slate-400">
                    Condicionamento {p.conditional.condicionamento}% • Evite sobrecarregar 90 minutos imediatamente.
                  </p>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel
          title="Alerta Preventivo de Fadiga e Risco"
          subtitle="Atletas saudáveis com maior risco de lesão muscular"
        >
          {highRisk.length === 0 ? (
            <p className="text-xs text-emerald-400 py-4">Elenco descansado com baixo risco de lesão!</p>
          ) : (
            <div className="space-y-2">
              {highRisk.map(({ player: p, riskPct }) => (
                <div
                  key={p.id}
                  onClick={() => navigate('player_profile', p.id)}
                  className="p-2.5 rounded-xl bg-[#0a101d] border border-slate-800 hover:border-amber-500/50 cursor-pointer flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <div>
                      <p className="font-bold text-white">{p.shortName}</p>
                      <p className="text-[10px] text-slate-400">
                        Fadiga {p.conditional.fadiga}% • Histórico: {p.injuryHistoryCount} lesões
                      </p>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-rose-400">Risco {riskPct}%</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* Equipe Médica + Contratação */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Panel
          title={`Equipe Médica Atual (${userClub.medicalStaff.length})`}
          subtitle="Acelera recuperação e reduz drasticamente lesões em treinos e jogos"
          className="lg:col-span-5"
        >
          <div className="space-y-2.5">
            {userClub.medicalStaff.map((m) => (
              <div
                key={m.id}
                className="p-3 rounded-xl bg-[#0a101d] border border-slate-800 flex items-start justify-between gap-2"
              >
                <div>
                  <p className="text-xs font-bold text-white">
                    {m.name} <span className="text-amber-400 text-[10px]">{'★'.repeat(m.level)}</span>
                  </p>
                  <p className="text-[11px] text-emerald-400 font-medium">{m.specialty}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Recuperação +{m.recoveryBonus}% • Prevenção -{m.preventionBonus}% •{' '}
                    {formatCurrency(m.monthlySalary)}/mês
                  </p>
                </div>
                {userClub.medicalStaff.length > 1 && (
                  <button
                    onClick={() => fireMedicalStaff(m.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10"
                    title="Desligar profissional"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          title="Contratar Médicos e Fisioterapeutas"
          subtitle="Profissionais especializados em ortopedia, reabilitação muscular e fisiologia"
          className="lg:col-span-7"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[340px] overflow-y-auto pr-1">
            {state.availableMedicalStaff.map((m) => (
              <div
                key={m.id}
                className="p-3 rounded-xl bg-[#0a101d] border border-slate-800 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate">
                    {m.name} <span className="text-amber-400 text-[10px]">{'★'.repeat(m.level)}</span>
                  </p>
                  <p className="text-[11px] text-sky-300 truncate">{m.specialty}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Rec +{m.recoveryBonus}% • Prev -{m.preventionBonus}% • {formatCurrency(m.monthlySalary)}/mês
                  </p>
                </div>
                <button
                  onClick={() => hireMedicalStaff(m.id)}
                  className="shrink-0 px-2.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/40 text-[11px] font-bold flex items-center gap-1"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  {formatCurrency(m.hiringFee)}
                </button>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
};
