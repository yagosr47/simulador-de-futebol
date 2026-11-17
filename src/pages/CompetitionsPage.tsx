import React, { useMemo, useState } from 'react';
import { useGame } from '../store/GameContext';
import { sortStandings } from '../engine/calendar';
import { formatCurrency, formatDateBR } from '../engine/constants';
import { ClubBadge, Panel } from '../components/UI';
import { Award, Trophy } from 'lucide-react';

export const CompetitionsPage: React.FC = () => {
  const { state, userClub, navigate } = useGame();
  const [selectedCompId, setSelectedCompId] = useState(state.competitions[0]?.id ?? '');
  const [selectedRound, setSelectedRound] = useState(1);

  const comp = state.competitions.find((c) => c.id === selectedCompId) ?? state.competitions[0];

  const sortedStandings = useMemo(
    () => (comp && comp.type === 'Liga' ? sortStandings(comp.standings) : []),
    [comp],
  );

  // Líderes estatísticos globais da temporada
  const allPlayers = useMemo(() => Object.values(state.players), [state.players]);
  const topScorers = useMemo(
    () =>
      [...allPlayers]
        .filter((p) => p.careerStats.seasonGoals > 0)
        .sort((a, b) => b.careerStats.seasonGoals - a.careerStats.seasonGoals)
        .slice(0, 8),
    [allPlayers],
  );
  const topAssisters = useMemo(
    () =>
      [...allPlayers]
        .filter((p) => p.careerStats.seasonAssists > 0)
        .sort((a, b) => b.careerStats.seasonAssists - a.careerStats.seasonAssists)
        .slice(0, 8),
    [allPlayers],
  );

  if (!comp) return null;

  const roundNumbers = Array.from(new Set(comp.fixtures.map((f) => f.roundNumber))).sort((a, b) => a - b);
  const roundFixtures = comp.fixtures.filter((f) => f.roundNumber === selectedRound);

  // Agrupamento de fases para Copas
  const knockoutRounds =
    comp.type !== 'Liga'
      ? roundNumbers.map((rn) => ({
          roundNumber: rn,
          name: comp.fixtures.find((f) => f.roundNumber === rn)?.roundName ?? `Fase ${rn}`,
          fixtures: comp.fixtures.filter((f) => f.roundNumber === rn),
        }))
      : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">Competições — Temporada {state.season}</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Classificação, chaves de mata-mata, artilharia, premiações e acompanhamento dos clubes da IA.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {state.competitions.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                setSelectedCompId(c.id);
                setSelectedRound(1);
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors ${
                comp.id === c.id
                  ? 'bg-emerald-600 text-white'
                  : 'bg-[#0e1525] border border-slate-800 text-slate-300 hover:border-slate-600'
              }`}
            >
              <Trophy className="w-3.5 h-3.5 text-amber-300" />
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Info de Premiação e Campeão */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-[#0e1525] border border-slate-800">
          <p className="text-[10px] uppercase font-bold text-amber-400">Premiação Campeão</p>
          <p className="text-lg font-black font-mono text-white mt-0.5">{formatCurrency(comp.prizeChampion)}</p>
        </div>
        <div className="p-4 rounded-2xl bg-[#0e1525] border border-slate-800">
          <p className="text-[10px] uppercase font-bold text-slate-400">Premiação Vice-Campeão</p>
          <p className="text-lg font-black font-mono text-slate-200 mt-0.5">{formatCurrency(comp.prizeRunnerUp)}</p>
        </div>
        <div className="p-4 rounded-2xl bg-[#0e1525] border border-slate-800">
          <p className="text-[10px] uppercase font-bold text-emerald-400">Status do Torneio</p>
          <p className="text-sm font-black text-white mt-1">
            {comp.championClubId
              ? `Campeão: ${state.clubs[comp.championClubId]?.name}`
              : `${comp.fixtures.filter((f) => f.played).length}/${comp.fixtures.length} jogos realizados`}
          </p>
        </div>
      </div>

      {/* LIGA: CLASSIFICAÇÃO COMPLETA + RODADAS */}
      {comp.type === 'Liga' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <Panel
            title="Classificação Geral — Série A Nacional"
            subtitle="Top 6: Copa Continental • 13º–16º: Zona de Alerta"
            className="lg:col-span-8"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] uppercase text-slate-400 border-b border-slate-800">
                    <th className="py-2 text-left">#</th>
                    <th className="py-2 text-left">Clube / Técnico / Filosofia</th>
                    <th className="py-2 text-center">J</th>
                    <th className="py-2 text-center">V</th>
                    <th className="py-2 text-center">E</th>
                    <th className="py-2 text-center">D</th>
                    <th className="py-2 text-center">GP</th>
                    <th className="py-2 text-center">GC</th>
                    <th className="py-2 text-center">SG</th>
                    <th className="py-2 text-right">PTS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {sortedStandings.map((st, idx) => {
                    const c = state.clubs[st.clubId];
                    const isUser = st.clubId === userClub.id;
                    const zoneColor =
                      idx < 6
                        ? 'border-l-2 border-l-emerald-500'
                        : idx >= sortedStandings.length - 4
                          ? 'border-l-2 border-l-rose-500'
                          : '';
                    return (
                      <tr key={st.clubId} className={`${zoneColor} ${isUser ? 'bg-emerald-500/15' : 'hover:bg-slate-800/35'}`}>
                        <td className="py-2.5 pl-2 font-mono font-bold text-slate-400">{idx + 1}</td>
                        <td className="py-2.5">
                          <div className="flex items-center gap-2.5">
                            <ClubBadge club={c} size="xs" />
                            <div>
                              <p className={`font-bold ${isUser ? 'text-emerald-300' : 'text-white'}`}>{c?.name}</p>
                              <p className="text-[10px] text-slate-400">
                                Téc: {c?.managerName} • {c?.philosophy}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 text-center font-mono text-slate-300">{st.played}</td>
                        <td className="py-2.5 text-center font-mono text-emerald-400">{st.won}</td>
                        <td className="py-2.5 text-center font-mono text-amber-300">{st.drawn}</td>
                        <td className="py-2.5 text-center font-mono text-rose-400">{st.lost}</td>
                        <td className="py-2.5 text-center font-mono text-slate-300">{st.goalsFor}</td>
                        <td className="py-2.5 text-center font-mono text-slate-300">{st.goalsAgainst}</td>
                        <td className="py-2.5 text-center font-mono text-slate-200">{st.goalsFor - st.goalsAgainst}</td>
                        <td className="py-2.5 pr-2 text-right font-mono font-black text-white">{st.points}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel
            title={`Jogos da Rodada ${selectedRound}`}
            right={
              <select
                value={selectedRound}
                onChange={(e) => setSelectedRound(Number(e.target.value))}
                className="px-2.5 py-1 rounded-lg bg-[#0a101d] border border-slate-700 text-xs text-white"
              >
                {roundNumbers.map((rn) => (
                  <option key={rn} value={rn}>
                    Rodada {rn}
                  </option>
                ))}
              </select>
            }
            className="lg:col-span-4"
          >
            <div className="space-y-2">
              {roundFixtures.map((f) => {
                const hc = state.clubs[f.homeClubId];
                const ac = state.clubs[f.awayClubId];
                const involvesUser = f.homeClubId === userClub.id || f.awayClubId === userClub.id;
                return (
                  <div
                    key={f.id}
                    className={`p-3 rounded-xl border text-xs ${
                      involvesUser ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-[#0a101d] border-slate-800'
                    }`}
                  >
                    <p className="text-[10px] text-slate-400 mb-1">{formatDateBR(f.date)}</p>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-200 truncate flex-1">{hc?.shortName}</span>
                      <span className="px-2.5 py-0.5 rounded bg-slate-900 font-mono font-black text-white">
                        {f.played ? `${f.homeGoals} - ${f.awayGoals}` : 'vs'}
                      </span>
                      <span className="font-bold text-slate-200 truncate flex-1 text-right">{ac?.shortName}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>
      )}

      {/* COPA / CONTINENTAL: CHAVEAMENTO MATA-MATA */}
      {comp.type !== 'Liga' && (
        <Panel title={`Chaveamento — ${comp.name}`} subtitle="Fases eliminatórias avançam automaticamente ao encerrar cada rodada">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {knockoutRounds.map((kr) => (
              <div key={kr.roundNumber} className="space-y-2.5">
                <h3 className="text-xs font-black uppercase text-amber-300 border-b border-slate-800 pb-1.5">
                  {kr.name}
                </h3>
                {kr.fixtures.map((f) => {
                  const hc = state.clubs[f.homeClubId];
                  const ac = state.clubs[f.awayClubId];
                  const involvesUser = f.homeClubId === userClub.id || f.awayClubId === userClub.id;
                  return (
                    <div
                      key={f.id}
                      className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                        involvesUser ? 'bg-emerald-500/15 border-emerald-500/50' : 'bg-[#0a101d] border-slate-800'
                      }`}
                    >
                      <p className="text-[10px] text-slate-400">{formatDateBR(f.date)}</p>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 font-bold text-white">
                          <ClubBadge club={hc} size="xs" /> {hc?.shortName}
                        </span>
                        <span className="font-mono font-black text-emerald-400">
                          {f.played ? f.homeGoals : '-'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 font-bold text-white">
                          <ClubBadge club={ac} size="xs" /> {ac?.shortName}
                        </span>
                        <span className="font-mono font-black text-emerald-400">
                          {f.played ? f.awayGoals : '-'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Artilharia e Garçons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Panel title="Artilheiros da Temporada">
          {topScorers.length === 0 ? (
            <p className="text-xs text-slate-400">Jogue as primeiras rodadas para acompanhar a artilharia.</p>
          ) : (
            <div className="space-y-2">
              {topScorers.map((p, i) => (
                <div
                  key={p.id}
                  onClick={() => navigate('player_profile', p.id)}
                  className="p-2.5 rounded-xl bg-[#0a101d] border border-slate-800 hover:border-slate-600 cursor-pointer flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono font-bold text-slate-400 w-5">{i + 1}.</span>
                    <ClubBadge club={state.clubs[p.clubId]} size="xs" />
                    <div>
                      <p className="font-bold text-white">{p.fullName}</p>
                      <p className="text-[10px] text-slate-400">{state.clubs[p.clubId]?.name}</p>
                    </div>
                  </div>
                  <span className="font-mono font-black text-emerald-400 flex items-center gap-1">
                    <Award className="w-3.5 h-3.5" /> {p.careerStats.seasonGoals} gols
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Líderes em Assistências">
          {topAssisters.length === 0 ? (
            <p className="text-xs text-slate-400">Jogue as primeiras rodadas para acompanhar os líderes de assistências.</p>
          ) : (
            <div className="space-y-2">
              {topAssisters.map((p, i) => (
                <div
                  key={p.id}
                  onClick={() => navigate('player_profile', p.id)}
                  className="p-2.5 rounded-xl bg-[#0a101d] border border-slate-800 hover:border-slate-600 cursor-pointer flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono font-bold text-slate-400 w-5">{i + 1}.</span>
                    <ClubBadge club={state.clubs[p.clubId]} size="xs" />
                    <div>
                      <p className="font-bold text-white">{p.fullName}</p>
                      <p className="text-[10px] text-slate-400">{state.clubs[p.clubId]?.name}</p>
                    </div>
                  </div>
                  <span className="font-mono font-black text-sky-400">{p.careerStats.seasonAssists} assist.</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
};
