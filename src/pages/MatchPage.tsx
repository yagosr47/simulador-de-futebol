import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../store/GameContext';
import { MatchFixture, TacticalMentality, TacticalSetup } from '../types/game';
import {
  createLiveMatchSession,
  finalizeSessionToFixture,
  LiveMatchSession,
  makeLiveSubstitution,
  simulateMatchInstant,
  stepLiveMatchMinute,
  updateLiveTactics,
} from '../engine/matchEngine';
import { calculateTeamStrength } from '../engine/overall';
import { calculateMatchdayBoxOffice } from '../engine/stadium';
import { formatCurrency, formatDateBR } from '../engine/constants';
import { ClubBadge, Panel, PositionBadge, ProgressBar } from '../components/UI';
import {
  FastForward,
  Pause,
  Play,
  SkipForward,
  Zap,
  Users,
  BarChart3,
  Award,
  ArrowLeftRight,
  Sliders,
} from 'lucide-react';

export const MatchPage: React.FC = () => {
  const { state, userClub, commitCompletedMatch, advanceToNextMatch, navigate } = useGame();

  const [session, setSession] = useState<LiveMatchSession | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<1 | 2 | 4 | 8>(2);
  const [completedReport, setCompletedReport] = useState<MatchFixture | null>(null);
  const [subOutId, setSubOutId] = useState<string>('');
  const [subInId, setSubInId] = useState<string>('');
  const commentaryEndRef = useRef<HTMLDivElement | null>(null);

  // Próxima partida pendente do usuário
  const nextFixture = useMemo(() => {
    const all = state.competitions
      .flatMap((c) => c.fixtures)
      .filter((f) => !f.played && (f.homeClubId === userClub.id || f.awayClubId === userClub.id))
      .sort((a, b) => a.date.localeCompare(b.date));
    return all[0] ?? null;
  }, [state.competitions, userClub.id]);

  // Histórico recente de jogos do usuário
  const recentMatches = useMemo(() => {
    return state.competitions
      .flatMap((c) => c.fixtures)
      .filter((f) => f.played && (f.homeClubId === userClub.id || f.awayClubId === userClub.id))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 8);
  }, [state.competitions, userClub.id]);

  const homeClub = nextFixture ? state.clubs[nextFixture.homeClubId] : null;
  const awayClub = nextFixture ? state.clubs[nextFixture.awayClubId] : null;
  const isMatchDay = Boolean(nextFixture && nextFixture.date === state.currentDate);

  // Loop de tempo real durante a partida ao vivo
  useEffect(() => {
    if (!isPlaying || !session || session.finished || !homeClub || !awayClub) return;

    const intervalMs = speed === 1 ? 650 : speed === 2 ? 320 : speed === 4 ? 140 : 55;
    const timer = window.setInterval(() => {
      setSession((prev) => {
        if (!prev || prev.finished) return prev;
        const next = stepLiveMatchMinute(prev, homeClub, awayClub, state.players, state.currentDate);
        if (next.finished) {
          setIsPlaying(false);
        }
        return next;
      });
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [isPlaying, session, speed, homeClub, awayClub, state.players, state.currentDate]);

  // Auto-scroll da narração
  useEffect(() => {
    commentaryEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [session?.events.length]);

  const startLiveMatch = () => {
    if (!nextFixture || !homeClub || !awayClub) return;
    setCompletedReport(null);
    const live = createLiveMatchSession(nextFixture, homeClub, awayClub, state.players);
    setSession(live);
    setIsPlaying(true);
  };

  const simulateDirect = () => {
    if (!nextFixture || !homeClub || !awayClub) return;
    if (session && !session.finished) {
      let cur = session;
      while (!cur.finished) {
        cur = stepLiveMatchMinute(cur, homeClub, awayClub, state.players, state.currentDate);
      }
      setSession(cur);
      setIsPlaying(false);
      return;
    }

    const { fixture: done, session: finalSess } = simulateMatchInstant(
      nextFixture,
      homeClub,
      awayClub,
      state.players,
      state.currentDate,
    );
    commitCompletedMatch(done, finalSess.newInjuries);
    setCompletedReport(done);
    setSession(null);
    setIsPlaying(false);
  };

  const finishAndSaveLiveMatch = () => {
    if (!session || !session.finished || !nextFixture) return;
    const done = finalizeSessionToFixture(nextFixture, session, state.players);
    commitCompletedMatch(done, session.newInjuries);
    setCompletedReport(done);
    setSession(null);
  };

  const userSide: 'home' | 'away' = nextFixture?.homeClubId === userClub.id ? 'home' : 'away';
  const userLiveTeam = session ? (userSide === 'home' ? session.home : session.away) : null;

  const handleMakeSub = () => {
    if (!session || !subOutId || !subInId) return;
    setSession((prev) => (prev ? makeLiveSubstitution(prev, userSide, subOutId, subInId, state.players) : prev));
    setSubOutId('');
    setSubInId('');
  };

  const handleLiveTacticChange = (
    mentality: TacticalMentality,
    pressing: TacticalSetup['pressing'],
    tempo: TacticalSetup['tempo'],
  ) => {
    setSession((prev) => (prev ? updateLiveTactics(prev, userSide, mentality, pressing, tempo) : prev));
  };

  const boxForecast =
    nextFixture && homeClub && awayClub
      ? calculateMatchdayBoxOffice(homeClub, awayClub, nextFixture.importance)
      : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">Central de Partidas & Narração ao Vivo</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Acompanhe minuto a minuto com ajustes táticos e substituições ao vivo ou simule diretamente o resultado.
          </p>
        </div>
      </div>

      {/* MODO 1: PARTIDA AO VIVO EM ANDAMENTO */}
      {session && homeClub && awayClub && nextFixture && (
        <div className="space-y-5">
          {/* Placar Eletrônico ao Vivo */}
          <div className="rounded-3xl bg-gradient-to-br from-[#0e1b30] via-[#0b1322] to-[#08151d] border border-emerald-500/35 p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-4">
              <span className="font-bold uppercase text-emerald-300">
                {nextFixture.competitionName} • {nextFixture.roundName}
              </span>
              <span>
                {homeClub.stadium.name} • {session.attendance.toLocaleString('pt-BR')} torcedores • {session.weather}
              </span>
            </div>

            <div className="grid grid-cols-3 items-center gap-4">
              <div className="flex items-center gap-3">
                <ClubBadge club={homeClub} size="lg" />
                <div className="min-w-0">
                  <p className="text-sm sm:text-lg font-black text-white truncate">{homeClub.name}</p>
                  <p className="text-[11px] text-slate-400">
                    {session.home.tactics.formation} • {session.home.tactics.mentality}
                  </p>
                </div>
              </div>

              <div className="text-center">
                <div className="inline-flex items-center gap-4 px-5 py-2.5 rounded-2xl bg-slate-950/90 border border-slate-700">
                  <span className="text-3xl sm:text-5xl font-black font-mono text-white tabular-nums">
                    {session.homeGoals}
                  </span>
                  <span className="text-xl font-black text-slate-500">:</span>
                  <span className="text-3xl sm:text-5xl font-black font-mono text-white tabular-nums">
                    {session.awayGoals}
                  </span>
                </div>
                <div className="mt-2">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-black font-mono ${
                      session.finished
                        ? 'bg-slate-700 text-slate-200'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse'
                    }`}
                  >
                    {session.finished ? 'ENCERRADO' : `${session.minute}' AO VIVO`}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 text-right">
                <div className="min-w-0">
                  <p className="text-sm sm:text-lg font-black text-white truncate">{awayClub.name}</p>
                  <p className="text-[11px] text-slate-400">
                    {session.away.tactics.formation} • {session.away.tactics.mentality}
                  </p>
                </div>
                <ClubBadge club={awayClub} size="lg" />
              </div>
            </div>

            {/* Barra de Momentum */}
            <div className="mt-5">
              <div className="flex justify-between text-[10px] uppercase font-bold text-slate-400 mb-1">
                <span>Pressão {homeClub.shortName}</span>
                <span>Momentum da Partida</span>
                <span>Pressão {awayClub.shortName}</span>
              </div>
              <div className="h-2.5 rounded-full bg-slate-900 overflow-hidden flex border border-slate-800">
                <div
                  className="bg-emerald-500 transition-all duration-300"
                  style={{ width: `${Math.round((session.momentum + 100) / 2)}%` }}
                />
                <div className="bg-sky-500 flex-1 transition-all duration-300" />
              </div>
            </div>

            {/* Controles de Velocidade e Ação */}
            <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {!session.finished ? (
                  <>
                    <button
                      onClick={() => setIsPlaying((p) => !p)}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-black text-white flex items-center gap-1.5"
                    >
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                      {isPlaying ? 'Pausar' : 'Continuar'}
                    </button>
                    <div className="flex rounded-xl bg-slate-900 border border-slate-700 p-1">
                      {([1, 2, 4, 8] as const).map((sp) => (
                        <button
                          key={sp}
                          onClick={() => setSpeed(sp)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                            speed === sp ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {sp}x
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={simulateDirect}
                      className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 flex items-center gap-1.5"
                    >
                      <SkipForward className="w-3.5 h-3.5" /> Pular para o Final
                    </button>
                  </>
                ) : (
                  <button
                    onClick={finishAndSaveLiveMatch}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-xs font-black text-white shadow-lg flex items-center gap-2"
                  >
                    <Award className="w-4 h-4" /> Confirmar Resultado & Ver Súmula
                  </button>
                )}
              </div>

              <div className="text-xs text-slate-400">
                Bilheteria do jogo:{' '}
                <span className="font-bold text-emerald-400 tabular-nums">{formatCurrency(session.ticketRevenue)}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Narração ao Vivo (7 cols) */}
            <Panel
              title="Narração ao Vivo"
              subtitle="Acontecimentos dinâmicos em tempo real"
              className="lg:col-span-7"
            >
              <div className="space-y-2 max-h-[450px] overflow-y-auto pr-1">
                {session.events.map((ev, idx) => {
                  const isGoal = ev.type === 'gol';
                  const isCard = ev.type === 'cartao_vermelho' || ev.type === 'cartao_amarelo';
                  const isSave = ev.type === 'defesa';
                  const isInjury = ev.type === 'lesao';

                  const style = isGoal
                    ? 'bg-emerald-500/20 border-emerald-400/70 text-emerald-50 font-bold'
                    : ev.type === 'cartao_vermelho'
                      ? 'bg-rose-500/20 border-rose-400/70 text-rose-100 font-bold'
                      : isInjury
                        ? 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                        : isCard
                          ? 'bg-amber-500/15 border-amber-500/40 text-amber-100'
                          : isSave
                            ? 'bg-sky-500/15 border-sky-500/35 text-sky-100'
                            : 'bg-[#0a101d] border-slate-800/80 text-slate-300';

                  return (
                    <div key={idx} className={`p-3 rounded-xl border text-xs flex items-start gap-3 ${style}`}>
                      <span className="font-mono font-black text-[11px] px-2 py-0.5 rounded bg-slate-950/70 text-slate-200 shrink-0 tabular-nums">
                        {ev.minute}'
                      </span>
                      <p className="leading-relaxed">{ev.text}</p>
                    </div>
                  );
                })}
                <div ref={commentaryEndRef} />
              </div>
            </Panel>

            {/* Estatísticas + Controles ao Vivo (5 cols) */}
            <div className="lg:col-span-5 space-y-5">
              <Panel title="Estatísticas em Tempo Real">
                <div className="space-y-3 text-xs">
                  {[
                    ['Posse de Bola', `${session.stats.homePossession}%`, `${session.stats.awayPossession}%`, session.stats.homePossession, session.stats.awayPossession],
                    ['Finalizações', session.stats.homeShots, session.stats.awayShots, session.stats.homeShots, session.stats.awayShots],
                    ['No Alvo', session.stats.homeShotsOnTarget, session.stats.awayShotsOnTarget, session.stats.homeShotsOnTarget, session.stats.awayShotsOnTarget],
                    ['Gols Esperados (xG)', session.stats.homeXG.toFixed(2), session.stats.awayXG.toFixed(2), session.stats.homeXG, session.stats.awayXG],
                    ['Defesas do Goleiro', session.stats.homeSaves, session.stats.awaySaves, session.stats.homeSaves, session.stats.awaySaves],
                    ['Escanteios', session.stats.homeCorners, session.stats.awayCorners, session.stats.homeCorners, session.stats.awayCorners],
                    ['Faltas', session.stats.homeFouls, session.stats.awayFouls, session.stats.homeFouls, session.stats.awayFouls],
                    ['Impedimentos', session.stats.homeOffsides, session.stats.awayOffsides, session.stats.homeOffsides, session.stats.awayOffsides],
                    ['Cartões (Am / Vm)', `${session.stats.homeYellowCards} / ${session.stats.homeRedCards}`, `${session.stats.awayYellowCards} / ${session.stats.awayRedCards}`, session.stats.homeYellowCards + session.stats.homeRedCards, session.stats.awayYellowCards + session.stats.awayRedCards],
                  ].map(([label, hDisp, aDisp, hVal, aVal]) => {
                    const sum = Number(hVal) + Number(aVal);
                    const pct = sum > 0 ? Math.round((Number(hVal) / sum) * 100) : 50;
                    return (
                      <div key={String(label)}>
                        <div className="flex justify-between font-mono font-bold mb-1">
                          <span className="text-emerald-300">{hDisp}</span>
                          <span className="font-sans text-[11px] font-semibold text-slate-400">{label}</span>
                          <span className="text-sky-300">{aDisp}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden flex">
                          <div className="bg-emerald-500" style={{ width: `${pct}%` }} />
                          <div className="bg-sky-500 flex-1" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Panel>

              {/* Ajustes Táticos & Substituições durante a partida */}
              {!session.finished && userLiveTeam && (
                <Panel
                  title="Banco Técnico ao Vivo"
                  subtitle={`Substituições usadas: ${userLiveTeam.subsUsed}/5`}
                >
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <label className="text-[10px] text-slate-400 flex items-center gap-1 mb-1">
                          <Sliders className="w-3 h-3" /> Mentalidade
                        </label>
                        <select
                          value={userLiveTeam.tactics.mentality}
                          onChange={(e) =>
                            handleLiveTacticChange(
                              e.target.value as TacticalMentality,
                              userLiveTeam.tactics.pressing,
                              userLiveTeam.tactics.tempo,
                            )
                          }
                          className="w-full px-2 py-1.5 rounded-lg bg-[#0a101d] border border-slate-700 text-[11px]"
                        >
                          {(['Ultradefensiva', 'Defensiva', 'Equilibrada', 'Ofensiva', 'Ultraofensiva'] as TacticalMentality[]).map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-1">Pressão</label>
                        <select
                          value={userLiveTeam.tactics.pressing}
                          onChange={(e) =>
                            handleLiveTacticChange(
                              userLiveTeam.tactics.mentality,
                              e.target.value as TacticalSetup['pressing'],
                              userLiveTeam.tactics.tempo,
                            )
                          }
                          className="w-full px-2 py-1.5 rounded-lg bg-[#0a101d] border border-slate-700 text-[11px]"
                        >
                          {(['Baixa', 'Média', 'Alta', 'Pressão Total'] as TacticalSetup['pressing'][]).map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-1">Ritmo</label>
                        <select
                          value={userLiveTeam.tactics.tempo}
                          onChange={(e) =>
                            handleLiveTacticChange(
                              userLiveTeam.tactics.mentality,
                              userLiveTeam.tactics.pressing,
                              e.target.value as TacticalSetup['tempo'],
                            )
                          }
                          className="w-full px-2 py-1.5 rounded-lg bg-[#0a101d] border border-slate-700 text-[11px]"
                        >
                          {(['Lento', 'Controlado', 'Rápido'] as TacticalSetup['tempo'][]).map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {userLiveTeam.subsUsed < 5 && userLiveTeam.benchIds.length > 0 && (
                      <div className="p-3 rounded-xl bg-[#0a101d] border border-slate-800 space-y-2">
                        <p className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                          <ArrowLeftRight className="w-3.5 h-3.5 text-emerald-400" /> Fazer Substituição
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <select
                            value={subOutId}
                            onChange={(e) => setSubOutId(e.target.value)}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-100"
                          >
                            <option value="">Quem sai...</option>
                            {userLiveTeam.onPitchIds
                              .filter((id) => id && !userLiveTeam.redCards.has(id))
                              .map((id) => {
                                const p = state.players[id];
                                if (!p) return null;
                                return (
                                  <option key={id} value={id}>
                                    {p.shortName} ({p.primaryPosition}) • Vig {Math.round(userLiveTeam.stamina[id] ?? 70)}%
                                  </option>
                                );
                              })}
                          </select>
                          <select
                            value={subInId}
                            onChange={(e) => setSubInId(e.target.value)}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-100"
                          >
                            <option value="">Quem entra...</option>
                            {userLiveTeam.benchIds.map((id) => {
                              const p = state.players[id];
                              if (!p) return null;
                              return (
                                <option key={id} value={id}>
                                  {p.shortName} ({p.primaryPosition})
                                </option>
                              );
                            })}
                          </select>
                        </div>
                        <button
                          onClick={handleMakeSub}
                          disabled={!subOutId || !subInId}
                          className="w-full py-1.5 rounded-lg bg-emerald-600 disabled:bg-slate-800 disabled:text-slate-500 hover:bg-emerald-500 text-xs font-bold text-white"
                        >
                          Confirmar Substituição
                        </button>
                      </div>
                    )}

                    {/* Condição em campo */}
                    <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                      {userLiveTeam.onPitchIds.map((pid) => {
                        const p = state.players[pid];
                        if (!p) return null;
                        const stam = Math.round(userLiveTeam.stamina[pid] ?? 75);
                        return (
                          <div key={pid} className="flex items-center gap-2 text-[11px]">
                            <PositionBadge position={p.primaryPosition} size="xs" />
                            <span className="truncate flex-1 text-slate-200">
                              {p.shortName}
                              {userLiveTeam.yellowCards.has(pid) && ' 🟨'}
                              {userLiveTeam.redCards.has(pid) && ' 🟥'}
                            </span>
                            <div className="w-20">
                              <ProgressBar value={stam} height="h-1.5" />
                            </div>
                            <span className="font-mono text-[10px] w-7 text-right text-slate-400">{stam}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </Panel>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODO 2: PRÉ-JOGO (quando nenhuma sessão está ativa) */}
      {!session && nextFixture && homeClub && awayClub && (
        <Panel
          title={`Próxima Partida — ${nextFixture.competitionName} (${nextFixture.roundName})`}
          subtitle={isMatchDay ? 'HOJE É DIA DE JOGO!' : `Agendada para ${formatDateBR(nextFixture.date)}`}
          right={
            <span className="px-3 py-1 rounded-xl bg-slate-800 text-xs font-bold text-emerald-300">
              Importância {nextFixture.importance}/10
            </span>
          }
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            <div className="lg:col-span-8 space-y-4">
              <div className="p-5 rounded-2xl bg-[#0a101d] border border-slate-800 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <ClubBadge club={homeClub} size="lg" />
                  <div>
                    <p className="text-base font-black text-white">{homeClub.name}</p>
                    <p className="text-xs text-slate-400">
                      Força {calculateTeamStrength(homeClub, state.players).overall} • {homeClub.tactics.formation}
                    </p>
                  </div>
                </div>
                <span className="text-lg font-black text-slate-500">VS</span>
                <div className="flex items-center gap-3 text-right">
                  <div>
                    <p className="text-base font-black text-white">{awayClub.name}</p>
                    <p className="text-xs text-slate-400">
                      Força {calculateTeamStrength(awayClub, state.players).overall} • {awayClub.tactics.formation}
                    </p>
                  </div>
                  <ClubBadge club={awayClub} size="lg" />
                </div>
              </div>

              {boxForecast && (
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800">
                    <p className="text-slate-400 text-[10px] uppercase">Estádio</p>
                    <p className="font-bold text-white mt-0.5">{homeClub.stadium.name}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800">
                    <p className="text-slate-400 text-[10px] uppercase">Público Esperado</p>
                    <p className="font-bold text-sky-300 tabular-nums mt-0.5">
                      {boxForecast.attendance.toLocaleString('pt-BR')} ({boxForecast.occupancyPct}%)
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800">
                    <p className="text-slate-400 text-[10px] uppercase">Renda / Fator Casa</p>
                    <p className="font-bold text-emerald-400 tabular-nums mt-0.5">
                      {formatCurrency(boxForecast.totalRevenue)} (+{boxForecast.homeAtmosphereBonus})
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="lg:col-span-4 flex flex-col gap-2.5">
              {isMatchDay ? (
                <>
                  <button
                    onClick={startLiveMatch}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-sm font-black text-white shadow-lg flex items-center justify-center gap-2"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    Jogar Partida ao Vivo
                  </button>
                  <button
                    onClick={simulateDirect}
                    className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 flex items-center justify-center gap-2"
                  >
                    <Zap className="w-4 h-4 text-amber-400" />
                    Simular Resultado Direto
                  </button>
                </>
              ) : (
                <button
                  onClick={advanceToNextMatch}
                  className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm font-black text-white shadow-lg flex items-center justify-center gap-2"
                >
                  <FastForward className="w-4 h-4" />
                  Avançar até o Dia do Jogo ({formatDateBR(nextFixture.date)})
                </button>
              )}
              <button
                onClick={() => navigate('tactics')}
                className="w-full py-2.5 rounded-xl bg-[#0a101d] hover:bg-slate-800 border border-slate-700 text-xs font-bold text-slate-300 flex items-center justify-center gap-2"
              >
                <Users className="w-4 h-4" />
                Revisar Escalação e Táticas
              </button>
            </div>
          </div>
        </Panel>
      )}

      {/* MODO 3: RELATÓRIO PÓS-JOGO (ou partida clicada do histórico) */}
      {completedReport && !session && (
        <Panel
          title={`Súmula e Estatísticas — ${completedReport.competitionName} (${completedReport.roundName})`}
          subtitle={`${formatDateBR(completedReport.date)} • Público: ${(completedReport.attendance ?? 0).toLocaleString('pt-BR')} • Bilheteria: ${formatCurrency(completedReport.ticketRevenue ?? 0)}`}
          right={
            completedReport.manOfTheMatch && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-xs font-bold text-amber-300">
                <Award className="w-3.5 h-3.5" /> Craque: {completedReport.manOfTheMatch.playerName} (
                {completedReport.manOfTheMatch.rating.toFixed(1)})
              </span>
            )
          }
        >
          <div className="space-y-5">
            <div className="p-4 rounded-2xl bg-[#0a101d] border border-slate-800 flex items-center justify-around text-center">
              <div className="flex items-center gap-3">
                <ClubBadge club={state.clubs[completedReport.homeClubId]} size="md" />
                <span className="font-black text-white">{state.clubs[completedReport.homeClubId]?.name}</span>
              </div>
              <div className="text-3xl font-black font-mono text-emerald-400">
                {completedReport.homeGoals} x {completedReport.awayGoals}
              </div>
              <div className="flex items-center gap-3">
                <span className="font-black text-white">{state.clubs[completedReport.awayClubId]?.name}</span>
                <ClubBadge club={state.clubs[completedReport.awayClubId]} size="md" />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div>
                <h3 className="text-xs font-bold uppercase text-slate-400 mb-2 flex items-center gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5" /> Notas — {state.clubs[completedReport.homeClubId]?.shortName}
                </h3>
                <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                  {completedReport.homePerformances?.map((pf) => (
                    <div
                      key={pf.playerId}
                      className="px-3 py-1.5 rounded-lg bg-[#0a101d] flex items-center justify-between text-xs"
                    >
                      <span className="flex items-center gap-2">
                        <PositionBadge position={pf.position} size="xs" />
                        <span className="text-slate-200 font-medium">{pf.playerName}</span>
                        {pf.goals > 0 && <span className="text-emerald-400 font-bold">⚽x{pf.goals}</span>}
                        {pf.assists > 0 && <span className="text-sky-400 font-bold">🅰x{pf.assists}</span>}
                        {pf.yellowCard && <span>🟨</span>}
                        {pf.redCard && <span>🟥</span>}
                      </span>
                      <span className="font-mono font-black text-amber-300">{pf.rating.toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase text-slate-400 mb-2 flex items-center gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5" /> Notas — {state.clubs[completedReport.awayClubId]?.shortName}
                </h3>
                <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                  {completedReport.awayPerformances?.map((pf) => (
                    <div
                      key={pf.playerId}
                      className="px-3 py-1.5 rounded-lg bg-[#0a101d] flex items-center justify-between text-xs"
                    >
                      <span className="flex items-center gap-2">
                        <PositionBadge position={pf.position} size="xs" />
                        <span className="text-slate-200 font-medium">{pf.playerName}</span>
                        {pf.goals > 0 && <span className="text-emerald-400 font-bold">⚽x{pf.goals}</span>}
                        {pf.assists > 0 && <span className="text-sky-400 font-bold">🅰x{pf.assists}</span>}
                        {pf.yellowCard && <span>🟨</span>}
                        {pf.redCard && <span>🟥</span>}
                      </span>
                      <span className="font-mono font-black text-amber-300">{pf.rating.toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold uppercase text-slate-400 mb-2">Principais Lances da Narração</h3>
              <div className="space-y-1.5 max-h-52 overflow-y-auto">
                {completedReport.events
                  .filter((e) => e.importance === 'high' || e.importance === 'critical')
                  .map((e, i) => (
                    <div key={i} className="p-2.5 rounded-lg bg-[#0a101d] border border-slate-800 text-xs flex gap-2">
                      <span className="font-mono font-bold text-emerald-400">{e.minute}'</span>
                      <span className="text-slate-200">{e.text}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </Panel>
      )}

      {/* Últimas Partidas Realizadas */}
      {recentMatches.length > 0 && !session && (
        <Panel title="Partidas Recentes" subtitle="Clique para rever a súmula, notas e narração">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {recentMatches.map((m) => {
              const hc = state.clubs[m.homeClubId];
              const ac = state.clubs[m.awayClubId];
              return (
                <button
                  key={m.id}
                  onClick={() => setCompletedReport(m)}
                  className="p-3 rounded-xl bg-[#0a101d] border border-slate-800 hover:border-emerald-500/50 flex items-center justify-between gap-2 text-left transition-colors"
                >
                  <div>
                    <p className="text-[10px] text-slate-400">
                      {formatDateBR(m.date)} • {m.competitionName} ({m.roundName})
                    </p>
                    <p className="text-xs font-bold text-white mt-0.5">
                      {hc?.shortName} {m.homeGoals} x {m.awayGoals} {ac?.shortName}
                    </p>
                  </div>
                  <span className="text-[11px] font-semibold text-emerald-400">Ver Súmula</span>
                </button>
              );
            })}
          </div>
        </Panel>
      )}
    </div>
  );
};
