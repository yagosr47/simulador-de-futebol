import React from 'react';
import { useGame } from '../store/GameContext';
import { formatCurrency, formatDateBR } from '../engine/constants';
import { ClubBadge, Panel, PositionBadge, StatCard } from '../components/UI';
import { Award, BookOpen, Crown, Medal, Trophy, Users } from 'lucide-react';

export const HistoryPage: React.FC = () => {
  const { state, userClub, userPlayers, navigate } = useGame();

  const hallScorers = [...userPlayers]
    .sort((a, b) => b.careerStats.goals - a.careerStats.goals)
    .slice(0, 5);
  const hallApps = [...userPlayers]
    .sort((a, b) => b.careerStats.matches - a.careerStats.matches)
    .slice(0, 5);

  const rec = state.clubRecords;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <ClubBadge club={userClub} size="lg" />
        <div>
          <h1 className="text-2xl font-black text-white">Histórico & Memória — {userClub.name}</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Sala de troféus, campanhas por temporada, recordes históricos, linha do tempo e ídolos do elenco.
          </p>
        </div>
      </div>

      {/* Sala de Troféus */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Títulos da Série A"
          value={userClub.titlesCount.league}
          sub="Campeonato Nacional"
          icon={<Trophy className="w-5 h-5" />}
          accent="amber"
        />
        <StatCard
          label="Títulos da Copa Nacional"
          value={userClub.titlesCount.cup}
          sub="Torneio Eliminatório"
          icon={<Medal className="w-5 h-5" />}
          accent="sky"
        />
        <StatCard
          label="Títulos Continentais"
          value={userClub.titlesCount.continental}
          sub="Glória Internacional"
          icon={<Crown className="w-5 h-5" />}
          accent="emerald"
        />
      </div>

      {/* Recordes do Clube */}
      <Panel title="Recordes Históricos da Gestão">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 text-xs">
          <div className="p-4 rounded-2xl bg-[#0a101d] border border-slate-800">
            <p className="text-[10px] uppercase font-bold text-slate-400">Maior Vitória</p>
            {rec.biggestWin ? (
              <>
                <p className="text-lg font-black font-mono text-emerald-400 mt-1">{rec.biggestWin.score}</p>
                <p className="text-slate-300 mt-0.5">
                  vs {rec.biggestWin.opponent} ({formatDateBR(rec.biggestWin.date)})
                </p>
              </>
            ) : (
              <p className="text-slate-500 mt-1">Aguardando primeira vitória</p>
            )}
          </div>

          <div className="p-4 rounded-2xl bg-[#0a101d] border border-slate-800">
            <p className="text-[10px] uppercase font-bold text-slate-400">Contratação Recorde</p>
            {rec.recordSigning ? (
              <>
                <p className="text-lg font-black font-mono text-sky-300 mt-1">
                  {formatCurrency(rec.recordSigning.fee)}
                </p>
                <p className="text-slate-300 mt-0.5">
                  {rec.recordSigning.playerName} ({formatDateBR(rec.recordSigning.date)})
                </p>
              </>
            ) : (
              <p className="text-slate-500 mt-1">Nenhuma contratação registrada</p>
            )}
          </div>

          <div className="p-4 rounded-2xl bg-[#0a101d] border border-slate-800">
            <p className="text-[10px] uppercase font-bold text-slate-400">Venda Recorde</p>
            {rec.recordSale ? (
              <>
                <p className="text-lg font-black font-mono text-amber-300 mt-1">
                  {formatCurrency(rec.recordSale.fee)}
                </p>
                <p className="text-slate-300 mt-0.5">
                  {rec.recordSale.playerName} ({formatDateBR(rec.recordSale.date)})
                </p>
              </>
            ) : (
              <p className="text-slate-500 mt-1">Nenhuma venda registrada</p>
            )}
          </div>

          <div className="p-4 rounded-2xl bg-[#0a101d] border border-slate-800">
            <p className="text-[10px] uppercase font-bold text-slate-400">Maior Público no Estádio</p>
            {rec.highestAttendance ? (
              <>
                <p className="text-lg font-black font-mono text-indigo-300 mt-1">
                  {rec.highestAttendance.attendance.toLocaleString('pt-BR')}
                </p>
                <p className="text-slate-300 mt-0.5">
                  {rec.highestAttendance.opponent} ({formatDateBR(rec.highestAttendance.date)})
                </p>
              </>
            ) : (
              <p className="text-slate-500 mt-1">-</p>
            )}
          </div>
        </div>
      </Panel>

      {/* Histórico por Temporada */}
      <Panel title="Campanhas por Temporada" subtitle="Registrado automaticamente ao fim de cada ano esportivo">
        {state.seasonHistory.length === 0 ? (
          <p className="text-xs text-slate-400 py-4">
            Temporada {state.season} em andamento. Ao virar o calendário para {state.season + 1}, o resumo completo será arquivado aqui.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] uppercase text-slate-400 border-b border-slate-800">
                  <th className="py-2 text-left">Temp.</th>
                  <th className="py-2 text-center">Série A</th>
                  <th className="py-2 text-center">Campanha</th>
                  <th className="py-2 text-center">Copa</th>
                  <th className="py-2 text-center">Continental</th>
                  <th className="py-2 text-left">Artilheiro do Clube</th>
                  <th className="py-2 text-right">Campeão da Liga</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {state.seasonHistory.map((sh) => (
                  <tr key={sh.season}>
                    <td className="py-2.5 font-mono font-bold text-white">{sh.season}</td>
                    <td className="py-2.5 text-center font-mono font-bold text-emerald-400">
                      {sh.leaguePosition}º ({sh.leaguePoints} pts)
                    </td>
                    <td className="py-2.5 text-center font-mono text-slate-300">
                      {sh.won}V {sh.drawn}E {sh.lost}D ({sh.goalsFor}:{sh.goalsAgainst})
                    </td>
                    <td className="py-2.5 text-center text-slate-200">{sh.cupResult}</td>
                    <td className="py-2.5 text-center text-slate-200">{sh.continentalResult}</td>
                    <td className="py-2.5 text-slate-200">
                      {sh.topScorerName} ({sh.topScorerGoals}G)
                    </td>
                    <td className="py-2.5 text-right text-amber-300 font-semibold">{sh.championLeagueName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Hall da Fama & Linha do Tempo */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Panel title="Linha do Tempo de Marcos" className="lg:col-span-6">
          <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
            {state.milestones.map((m) => (
              <div key={m.id} className="p-3.5 rounded-xl bg-[#0a101d] border border-slate-800 flex items-start gap-3">
                <BookOpen className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-amber-300">
                      {m.category}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">{formatDateBR(m.date)}</span>
                  </div>
                  <p className="text-xs font-bold text-white mt-1">{m.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{m.description}</p>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Ídolos e Líderes do Plantel Atual" className="lg:col-span-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <h3 className="text-[11px] font-bold uppercase text-emerald-400 mb-2 flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5" /> Maiores Artilheiros (Carreira)
              </h3>
              <div className="space-y-1.5">
                {hallScorers.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => navigate('player_profile', p.id)}
                    className="p-2 rounded-lg bg-[#0a101d] border border-slate-800 hover:border-slate-600 cursor-pointer flex items-center justify-between text-xs"
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <PositionBadge position={p.primaryPosition} size="xs" />
                      <span className="text-slate-200 truncate">{p.shortName}</span>
                    </span>
                    <span className="font-mono font-bold text-emerald-400">{p.careerStats.goals}G</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-[11px] font-bold uppercase text-sky-400 mb-2 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" /> Mais Partidas Disputadas
              </h3>
              <div className="space-y-1.5">
                {hallApps.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => navigate('player_profile', p.id)}
                    className="p-2 rounded-lg bg-[#0a101d] border border-slate-800 hover:border-slate-600 cursor-pointer flex items-center justify-between text-xs"
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <PositionBadge position={p.primaryPosition} size="xs" />
                      <span className="text-slate-200 truncate">{p.shortName}</span>
                    </span>
                    <span className="font-mono font-bold text-sky-300">{p.careerStats.matches}J</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
};
