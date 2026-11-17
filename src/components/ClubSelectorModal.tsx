import React, { useState } from 'react';
import { CLUB_PRESETS } from '../engine/worldGenerator';
import { useGame } from '../store/GameContext';
import { ClubBadge } from './UI';
import { formatCurrency } from '../engine/constants';
import { Trophy, Users, Wallet, Building2, Play, Upload, X } from 'lucide-react';

export const ClubSelectorModal: React.FC = () => {
  const { showClubSelect, closeClubSelector, startNewCareer, importSave, state } = useGame();
  const [selectedId, setSelectedId] = useState<string>(state.userClubId || 'palestra-sp');
  const [managerName, setManagerName] = useState<string>(state.clubs[state.userClubId]?.managerName || 'Treinador Gestor');

  if (!showClubSelect) return null;

  const selected = CLUB_PRESETS.find((c) => c.id === selectedId) ?? CLUB_PRESETS[0];

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        importSave(reader.result);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#050811]/95 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-5xl bg-[#0d1424] border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden my-auto">
        <div className="px-6 py-5 bg-gradient-to-r from-emerald-950/80 via-[#0d1424] to-indigo-950/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold uppercase tracking-wider mb-1.5">
              Gestor FC Pro • Temporada 2026
            </div>
            <h1 className="text-2xl font-black text-white">Escolha Seu Clube para Administrar</h1>
            <p className="text-xs text-slate-400 mt-1">
              Controle finanças, mercado, leilões, treinamentos, táticas, enfermaria e estádio 3D em um simulador totalmente interligado.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 cursor-pointer transition-colors">
              <Upload className="w-4 h-4 text-sky-400" />
              Importar Save
              <input type="file" accept=".json" className="hidden" onChange={handleImportFile} />
            </label>
            <button
              onClick={closeClubSelector}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors"
              title="Continuar carreira atual"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
          {/* Lista de clubes */}
          <div className="lg:col-span-7 p-5 max-h-[58vh] overflow-y-auto border-b lg:border-b-0 lg:border-r border-slate-800">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {CLUB_PRESETS.map((c) => {
                const active = c.id === selectedId;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={`p-3 rounded-2xl border text-left transition-all flex items-center gap-3 ${
                      active
                        ? 'bg-emerald-500/15 border-emerald-400/70 shadow-md shadow-emerald-950/40'
                        : 'bg-[#111a2e] border-slate-800 hover:border-slate-600'
                    }`}
                  >
                    <ClubBadge club={c} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-white truncate">{c.name}</p>
                      <p className="text-[11px] text-slate-400 truncate">{c.city} • {c.philosophy}</p>
                      <div className="flex items-center gap-2 mt-1 text-[10px] font-semibold">
                        <span className="text-amber-300">Rep {c.reputation}</span>
                        <span className="text-slate-600">•</span>
                        <span className="text-emerald-400">{formatCurrency(c.transferBudget)}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Detalhes do clube selecionado */}
          <div className="lg:col-span-5 p-6 flex flex-col justify-between bg-[#0a101d]">
            <div>
              <div className="flex items-center gap-4 mb-5">
                <ClubBadge club={selected} size="lg" />
                <div>
                  <h2 className="text-lg font-black text-white">{selected.name}</h2>
                  <p className="text-xs text-slate-400">{selected.city} • Estilo: {selected.playStyle}</p>
                  <p className="text-xs text-emerald-400 font-semibold mt-0.5">Filosofia: {selected.philosophy}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="p-3 rounded-xl bg-[#111a2e] border border-slate-800">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                    <Wallet className="w-3.5 h-3.5 text-emerald-400" /> Caixa / Mercado
                  </div>
                  <p className="text-sm font-bold text-white mt-1 tabular-nums">{formatCurrency(selected.balance)}</p>
                  <p className="text-[11px] text-emerald-400 tabular-nums">Verba: {formatCurrency(selected.transferBudget)}</p>
                </div>
                <div className="p-3 rounded-xl bg-[#111a2e] border border-slate-800">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                    <Building2 className="w-3.5 h-3.5 text-sky-400" /> Estádio
                  </div>
                  <p className="text-xs font-bold text-white mt-1 truncate">{selected.stadiumName}</p>
                  <p className="text-[11px] text-sky-300 tabular-nums">{selected.stadiumCapacity.toLocaleString('pt-BR')} lugares</p>
                </div>
                <div className="p-3 rounded-xl bg-[#111a2e] border border-slate-800">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                    <Trophy className="w-3.5 h-3.5 text-amber-400" /> Sala de Troféus
                  </div>
                  <p className="text-xs font-bold text-white mt-1">
                    {selected.titles.league} Ligas • {selected.titles.cup} Copas • {selected.titles.continental} Cont.
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-[#111a2e] border border-slate-800">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                    <Users className="w-3.5 h-3.5 text-indigo-400" /> Popularidade
                  </div>
                  <p className="text-sm font-bold text-white mt-1 tabular-nums">{selected.popularity}/100</p>
                  <p className="text-[11px] text-slate-400">Reputação {selected.reputation}</p>
                </div>
              </div>

              <div className="mb-5">
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Nome do Gestor / Treinador
                </label>
                <input
                  type="text"
                  value={managerName}
                  onChange={(e) => setManagerName(e.target.value)}
                  placeholder="Digite seu nome..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#111a2e] border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <button
              onClick={() => startNewCareer(selected.id, managerName)}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-black text-sm tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/40 transition-all"
            >
              <Play className="w-4 h-4 fill-current" />
              Assumir o {selected.name}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
