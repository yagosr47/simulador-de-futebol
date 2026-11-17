import React, { useMemo } from 'react';
import { useGame } from '../store/GameContext';
import { calculateTeamStrength, getPlayerTemporaryModifiers } from '../engine/overall';
import { sortStandings } from '../engine/calendar';
import { formatCurrency, formatDateBR, isTransferWindowOpen } from '../engine/constants';
import { calculateMatchdayBoxOffice } from '../engine/stadium';
import { getClubMonthlyFinancialSummary } from '../engine/economy';
import { ClubBadge, Panel, ProgressBar, StatCard } from '../components/UI';
import {
  Trophy,
  Wallet,
  HeartPulse,
  Users,
  PlayCircle,
  Sparkles,
  AlertTriangle,
  ArrowRight,
  Building2,
  Gavel,
  CheckCheck,
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const {
    state,
    userClub,
    userPlayers,
    navigate,
    advanceToNextMatch,
    markAllNewsRead,
    markNewsRead,
  } = useGame();

  const teamStrength = useMemo(() => calculateTeamStrength(userClub, state.players), [userClub, state.players]);
  const finSummary = useMemo(() => getClubMonthlyFinancialSummary(userClub, userPlayers), [userClub, userPlayers]);

  const league = state.competitions.find((c) => c.type === 'Liga');
  const sortedStandings = useMemo(() => (league ? sortStandings(league.standings) : []), [league]);
  const userPos = sortedStandings.findIndex((s) => s.clubId === userClub.id) + 1;
  const userStanding = sortedStandings[userPos - 1];

  const nextFixture = useMemo(() => {
    const allUpcoming = state.competitions
      .flatMap((c) => c.fixtures)
      .filter((f) => !f.played && (f.homeClubId === userClub.id || f.awayClubId === userClub.id))
      .sort((a, b) => a.date.localeCompare(b.date));
    return allUpcoming[0] ?? null;
  }, [state.competitions, userClub.id]);

  const injuredPlayers = userPlayers.filter((p) => p.injury);
  const unhappyPlayers = userPlayers.filter(
    (p) => p.contract.dissatisfaction === 'Moderada' || p.contract.dissatisfaction === 'Elevada',
  );
  const activeAuctions = state.auctions.filter((a) => a.status === 'Ativo');
  const winInfo = isTransferWindowOpen(state.currentDate);

  const nextHomeClub = nextFixture ? state.clubs[nextFixture.homeClubId] : null;
  const nextAwayClub = nextFixture ? state.clubs[nextFixture.awayClubId] : null;
  const boxOfficePreview =
    nextFixture && nextHomeClub && nextAwayClub
      ? calculateMatchdayBoxOffice(nextHomeClub, nextAwayClub, nextFixture.importance)
      : null;

  return (
    <div className="space-y-6">
      {/* Header do Clube */}
      <div className="rounded-3xl bg-gradient-to-r from-[#0e1a2e] via-[#10182b] to-[#0a1622] border border-slate-800/90 p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-4">
          <ClubBadge club={userClub} size="lg" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-white">{userClub.name}</h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                Força Geral {teamStrength.overall}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {userClub.city} • {userClub.stadium.name} ({userClub.stadium.capacity.toLocaleString('pt-BR')} lugares) •
              Filosofia: <span className="text-slate-200 font-medium">{userClub.philosophy}</span>
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[11px] text-slate-400">Forma recente:</span>
              {userClub.recentForm.length === 0 ? (
                <span className="text-[11px] text-slate-500">Início de temporada</span>
              ) : (
                userClub.recentForm.map((r, i) => (
                  <span
                    key={i}
                    className={`w-5 h-5 rounded-md text-[10px] font-black flex items-center justify-center ${
                      r === 'V'
                        ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40'
                        : r === 'E'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    }`}
                  >
                    {r}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => navigate('tactics')}
            className="px-4 py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-100 transition-colors"
          >
            Ajustar Táticas
          </button>
          <button
            onClick={() => navigate('training')}
            className="px-4 py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-100 transition-colors"
          >
            Treinar Elenco
          </button>
          <button
            onClick={advanceToNextMatch}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-xs font-black text-white shadow-lg shadow-emerald-950/50 flex items-center gap-2"
          >
            <PlayCircle className="w-4 h-4" />
            Ir para Próxima Partida
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Posição na Série A"
          value={userPos > 0 ? `${userPos}º Lugar` : '-'}
          sub={userStanding ? `${userStanding.points} pts • ${userStanding.won}V ${userStanding.drawn}E ${userStanding.lost}D` : 'Sem jogos'}
          icon={<Trophy className="w-5 h-5" />}
          accent="amber"
          onClick={() => navigate('competitions')}
        />
        <StatCard
          label="Caixa & Orçamento"
          value={formatCurrency(userClub.finances.balance)}
          sub={`Verba transferências: ${formatCurrency(userClub.finances.transferBudget)}`}
          icon={<Wallet className="w-5 h-5" />}
          accent={userClub.finances.balance < 0 ? 'rose' : 'emerald'}
          onClick={() => navigate('finances')}
        />
        <StatCard
          label="Química & Moral"
          value={`${teamStrength.chemistryScore}% / ${teamStrength.moraleScore}%`}
          sub={`Titulares ${teamStrength.startersRating} • Reservas ${teamStrength.benchRating}`}
          icon={<Users className="w-5 h-5" />}
          accent="sky"
          onClick={() => navigate('tactics')}
        />
        <StatCard
          label="Alertas do Elenco"
          value={`${injuredPlayers.length} lesões • ${unhappyPlayers.length} insatisfeitos`}
          sub={`${activeAuctions.length} leilões ativos • ${winInfo.open ? 'Mercado Aberto' : 'Mercado Fechado'}`}
          icon={<HeartPulse className="w-5 h-5" />}
          accent={injuredPlayers.length > 0 || unhappyPlayers.length > 0 ? 'rose' : 'indigo'}
          onClick={() => navigate(injuredPlayers.length > 0 ? 'infirmary' : 'squad')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Coluna esquerda (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Próxima Partida */}
          <Panel
            title="Próximo Compromisso"
            subtitle={nextFixture ? `${nextFixture.competitionName} • ${nextFixture.roundName}` : 'Temporada finalizada'}
            right={
              nextFixture && (
                <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-xs font-bold text-emerald-300 tabular-nums">
                  {formatDateBR(nextFixture.date)}
                </span>
              )
            }
          >
            {nextFixture && nextHomeClub && nextAwayClub ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-[#0a101d] border border-slate-800">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <ClubBadge club={nextHomeClub} size="md" />
                    <div className="min-w-0">
                      <p className="text-sm font-black text-white truncate">{nextHomeClub.name}</p>
                      <p className="text-[11px] text-slate-400">
                        Mandante • Força {calculateTeamStrength(nextHomeClub, state.players).overall}
                      </p>
                    </div>
                  </div>
                  <div className="px-3 py-1 rounded-xl bg-slate-800 text-xs font-black text-slate-300">VS</div>
                  <div className="flex items-center justify-end gap-3 flex-1 min-w-0 text-right">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-white truncate">{nextAwayClub.name}</p>
                      <p className="text-[11px] text-slate-400">
                        Visitante • Força {calculateTeamStrength(nextAwayClub, state.players).overall}
                      </p>
                    </div>
                    <ClubBadge club={nextAwayClub} size="md" />
                  </div>
                </div>

                {boxOfficePreview && (
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800">
                      <p className="text-[10px] uppercase text-slate-400 font-semibold">Estádio</p>
                      <p className="text-xs font-bold text-slate-100 truncate mt-0.5">{nextHomeClub.stadium.name}</p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800">
                      <p className="text-[10px] uppercase text-slate-400 font-semibold">Público Estimado</p>
                      <p className="text-xs font-bold text-sky-300 tabular-nums mt-0.5">
                        {boxOfficePreview.attendance.toLocaleString('pt-BR')} ({boxOfficePreview.occupancyPct}%)
                      </p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800">
                      <p className="text-[10px] uppercase text-slate-400 font-semibold">Bilheteria Prevista</p>
                      <p className="text-xs font-bold text-emerald-400 tabular-nums mt-0.5">
                        {formatCurrency(boxOfficePreview.totalRevenue)}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between gap-3 pt-1">
                  <button
                    onClick={() => navigate('calendar')}
                    className="text-xs font-semibold text-slate-400 hover:text-white flex items-center gap-1"
                  >
                    Ver calendário completo <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() =>
                      nextFixture.date === state.currentDate ? navigate('matches') : advanceToNextMatch()
                    }
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white flex items-center gap-1.5"
                  >
                    <PlayCircle className="w-4 h-4" />
                    {nextFixture.date === state.currentDate ? 'Entrar na Partida Hoje' : 'Avançar até o Jogo'}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400">Todas as partidas da temporada foram concluídas. Avance para 01/01 para iniciar a nova temporada.</p>
            )}
          </Panel>

          {/* Caixa de Entrada / Notícias Interligadas */}
          <Panel
            title="Central de Notícias e Alertas"
            subtitle="Reclamações contratuais, propostas de transferência, leilões, obras e boletim médico"
            right={
              <button
                onClick={markAllNewsRead}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-300"
              >
                <CheckCheck className="w-3.5 h-3.5" /> Marcar lidas
              </button>
            }
          >
            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
              {state.news.slice(0, 15).map((item) => {
                const borderStyle =
                  item.severity === 'danger'
                    ? 'border-rose-500/40 bg-rose-950/20'
                    : item.severity === 'warning'
                      ? 'border-amber-500/40 bg-amber-950/20'
                      : item.severity === 'success'
                        ? 'border-emerald-500/35 bg-emerald-950/15'
                        : 'border-slate-800 bg-[#0b1120]';

                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      markNewsRead(item.id);
                      if (item.actionPage) navigate(item.actionPage, item.relatedId);
                    }}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer hover:border-slate-500 ${borderStyle}`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        {!item.read && <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />}
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                          {item.category}
                        </span>
                        <h3 className="text-xs font-bold text-white">{item.title}</h3>
                      </div>
                      <span className="text-[10px] text-slate-400 tabular-nums shrink-0">{formatDateBR(item.date)}</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">{item.body}</p>
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>

        {/* Coluna direita (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Raio-X da Força Coletiva */}
          <Panel
            title="Força Coletiva da Equipe"
            subtitle="Calculada por titulares, reservas, química, tática, condição e organização"
            right={
              <span className="text-lg font-black text-emerald-400 font-mono tabular-nums">{teamStrength.overall}</span>
            }
          >
            <div className="space-y-3">
              {[
                ['Titulares (Efetivo)', teamStrength.startersRating],
                ['Qualidade dos Reservas', teamStrength.benchRating],
                ['Química entre Jogadores', teamStrength.chemistryScore],
                ['Entrosamento Tático', teamStrength.cohesionScore],
                ['Compatibilidade Tática', teamStrength.tacticalCompatibility],
                ['Organização Defensiva', teamStrength.defensiveOrganization],
                ['Organização Ofensiva', teamStrength.offensiveOrganization],
                ['Condicionamento & Frescor', teamStrength.fitnessScore],
              ].map(([label, val]) => (
                <div key={String(label)}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300">{label}</span>
                    <span className="font-mono font-bold text-slate-100 tabular-nums">{val}</span>
                  </div>
                  <ProgressBar value={Number(val)} height="h-1.5" />
                </div>
              ))}
            </div>
          </Panel>

          {/* Mini Tabela da Série A */}
          <Panel
            title="Série A Nacional — Topo"
            right={
              <button
                onClick={() => navigate('competitions')}
                className="text-xs font-semibold text-emerald-400 hover:text-emerald-300"
              >
                Tabela Completa
              </button>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-800 text-[10px] uppercase">
                    <th className="py-1.5 text-left">#</th>
                    <th className="py-1.5 text-left">Clube</th>
                    <th className="py-1.5 text-center">J</th>
                    <th className="py-1.5 text-center">SG</th>
                    <th className="py-1.5 text-right">PTS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {sortedStandings.slice(0, 6).map((st, idx) => {
                    const c = state.clubs[st.clubId];
                    const isUser = st.clubId === userClub.id;
                    return (
                      <tr key={st.clubId} className={isUser ? 'bg-emerald-500/10 font-bold' : ''}>
                        <td className="py-2 pr-2 font-mono text-slate-400">{idx + 1}</td>
                        <td className="py-2 flex items-center gap-2">
                          <ClubBadge club={c} size="xs" />
                          <span className={`truncate ${isUser ? 'text-emerald-300' : 'text-slate-200'}`}>
                            {c?.name}
                          </span>
                        </td>
                        <td className="py-2 text-center tabular-nums text-slate-400">{st.played}</td>
                        <td className="py-2 text-center tabular-nums text-slate-300">{st.goalsFor - st.goalsAgainst}</td>
                        <td className="py-2 text-right font-mono font-black text-white tabular-nums">{st.points}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>

          {/* Atalhos Rápidos / Status */}
          <Panel title="Pulso de Gestão">
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/70 border border-slate-800">
                <span className="flex items-center gap-2 text-slate-300">
                  <Sparkles className="w-4 h-4 text-emerald-400" /> Saldo Mensal Projetado
                </span>
                <span
                  className={`font-bold tabular-nums ${
                    finSummary.projectedMonthlyNet >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {finSummary.projectedMonthlyNet >= 0 ? '+' : ''}
                  {formatCurrency(finSummary.projectedMonthlyNet)}
                </span>
              </div>

              <div
                onClick={() => navigate('stadium')}
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/70 border border-slate-800 cursor-pointer hover:border-slate-600"
              >
                <span className="flex items-center gap-2 text-slate-300">
                  <Building2 className="w-4 h-4 text-sky-400" /> Obras no Estádio 3D
                </span>
                <span className="font-bold text-sky-300">
                  {userClub.stadium.activeConstructions.length > 0
                    ? `${userClub.stadium.activeConstructions.length} em andamento`
                    : 'Nenhuma obra ativa'}
                </span>
              </div>

              <div
                onClick={() => navigate('auctions')}
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/70 border border-slate-800 cursor-pointer hover:border-slate-600"
              >
                <span className="flex items-center gap-2 text-slate-300">
                  <Gavel className="w-4 h-4 text-amber-400" /> Mercado de Leilões
                </span>
                <span className="font-bold text-amber-300">{activeAuctions.length} atletas disputados</span>
              </div>

              {unhappyPlayers.length > 0 && (
                <div
                  onClick={() => navigate('player_profile', unhappyPlayers[0].id)}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-amber-950/30 border border-amber-500/40 cursor-pointer hover:border-amber-400"
                >
                  <span className="flex items-center gap-2 text-amber-200">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    {unhappyPlayers[0].shortName} ({unhappyPlayers[0].contract.dissatisfaction})
                  </span>
                  <span className="font-mono font-bold text-rose-400">
                    {getPlayerTemporaryModifiers(unhappyPlayers[0]).mentalDelta} mentais
                  </span>
                </div>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
};
