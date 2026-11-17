import React, { useState } from 'react';
import { PageId } from '../types/game';
import { useGame } from '../store/GameContext';
import { formatCurrency, formatDateBR, isTransferWindowOpen } from '../engine/constants';
import { ClubBadge } from './UI';
import {
  LayoutDashboard,
  Users,
  UserCircle2,
  Dumbbell,
  Compass,
  PlayCircle,
  CalendarDays,
  ArrowLeftRight,
  Gavel,
  Building2,
  HeartPulse,
  Wallet,
  Trophy,
  BookOpen,
  FastForward,
  CalendarPlus,
  Download,
  RefreshCw,
  Menu,
  X,
  CheckCircle2,
  AlertTriangle,
  Info,
} from 'lucide-react';

interface NavItem {
  id: PageId;
  label: string;
  icon: React.ReactNode;
  badge?: number | string;
  badgeColor?: string;
}

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    state,
    userClub,
    userPlayers,
    activePage,
    navigate,
    advanceDays,
    advanceToNextMatch,
    openClubSelector,
    exportSave,
    toasts,
    dismissToast,
  } = useGame();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const injuredCount = userPlayers.filter((p) => p.injury).length;
  const unhappyCount = userPlayers.filter(
    (p) => p.contract.dissatisfaction === 'Moderada' || p.contract.dissatisfaction === 'Elevada',
  ).length;
  const pendingOffersCount = state.transferOffers.filter((o) => o.isIncomingToUser && o.status === 'Pendente').length;
  const activeAuctionsCount = state.auctions.filter((a) => a.status === 'Ativo').length;
  const unreadNewsCount = state.news.filter((n) => !n.read).length;

  const winInfo = isTransferWindowOpen(state.currentDate);

  const navItems: NavItem[] = [
    {
      id: 'dashboard',
      label: 'Painel Principal',
      icon: <LayoutDashboard className="w-4 h-4" />,
      badge: unreadNewsCount > 0 ? unreadNewsCount : undefined,
      badgeColor: 'bg-emerald-500/20 text-emerald-300',
    },
    {
      id: 'squad',
      label: 'Elenco',
      icon: <Users className="w-4 h-4" />,
      badge: unhappyCount > 0 ? `${unhappyCount}!` : undefined,
      badgeColor: 'bg-amber-500/25 text-amber-300',
    },
    { id: 'player_profile', label: 'Perfil do Jogador', icon: <UserCircle2 className="w-4 h-4" /> },
    { id: 'training', label: 'Treinamento', icon: <Dumbbell className="w-4 h-4" /> },
    { id: 'tactics', label: 'Táticas', icon: <Compass className="w-4 h-4" /> },
    { id: 'matches', label: 'Partidas', icon: <PlayCircle className="w-4 h-4" /> },
    { id: 'calendar', label: 'Calendário', icon: <CalendarDays className="w-4 h-4" /> },
    {
      id: 'transfers',
      label: 'Transferências',
      icon: <ArrowLeftRight className="w-4 h-4" />,
      badge: pendingOffersCount > 0 ? pendingOffersCount : undefined,
      badgeColor: 'bg-sky-500/25 text-sky-300',
    },
    {
      id: 'auctions',
      label: 'Leilões',
      icon: <Gavel className="w-4 h-4" />,
      badge: activeAuctionsCount > 0 ? activeAuctionsCount : undefined,
      badgeColor: 'bg-amber-500/20 text-amber-300',
    },
    { id: 'stadium', label: 'Estádio 3D', icon: <Building2 className="w-4 h-4" /> },
    {
      id: 'infirmary',
      label: 'Enfermaria',
      icon: <HeartPulse className="w-4 h-4" />,
      badge: injuredCount > 0 ? injuredCount : undefined,
      badgeColor: 'bg-rose-500/25 text-rose-300',
    },
    { id: 'finances', label: 'Finanças', icon: <Wallet className="w-4 h-4" /> },
    { id: 'competitions', label: 'Competições', icon: <Trophy className="w-4 h-4" /> },
    { id: 'history', label: 'Histórico do Clube', icon: <BookOpen className="w-4 h-4" /> },
  ];

  const handleDownloadSave = () => {
    const json = exportSave();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gestor-fc-${userClub.shortName.toLowerCase()}-${state.currentDate}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen flex bg-[#070b14] text-slate-100">
      {/* Sidebar Desktop */}
      <aside className="hidden lg:flex lg:flex-col w-64 shrink-0 bg-[#0b111f] border-r border-slate-800/90 sticky top-0 h-screen">
        <div className="p-4 border-b border-slate-800/80 flex items-center gap-3">
          <ClubBadge club={userClub} size="md" />
          <div className="min-w-0">
            <h1 className="text-sm font-black text-white truncate">{userClub.name}</h1>
            <p className="text-[11px] text-slate-400 truncate">
              {userClub.managerName} • T{state.season}
            </p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {navItems.map((item) => {
            const active = activePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.id)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  active
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/35 shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800/70 hover:text-white border border-transparent'
                }`}
              >
                <span className="flex items-center gap-2.5 truncate">
                  <span className={active ? 'text-emerald-400' : 'text-slate-400'}>{item.icon}</span>
                  <span className="truncate">{item.label}</span>
                </span>
                {item.badge !== undefined && (
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${item.badgeColor}`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-800/80 flex items-center gap-2">
          <button
            onClick={handleDownloadSave}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-[11px] font-semibold text-slate-300 transition-colors"
            title="Exportar save JSON"
          >
            <Download className="w-3.5 h-3.5" /> Backup
          </button>
          <button
            onClick={openClubSelector}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-[11px] font-semibold text-slate-300 transition-colors"
            title="Trocar de clube ou iniciar nova carreira"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Novo Clube
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="w-72 bg-[#0b111f] border-r border-slate-800 h-full flex flex-col">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <ClubBadge club={userClub} size="sm" />
                <span className="text-sm font-black text-white truncate">{userClub.name}</span>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="p-1.5 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    navigate(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold ${
                    activePage === item.id
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/35'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    {item.icon}
                    {item.label}
                  </span>
                  {item.badge !== undefined && (
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${item.badgeColor}`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>
          <div className="flex-1 bg-black/60" onClick={() => setMobileMenuOpen(false)} />
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 bg-[#0b111f]/95 backdrop-blur-md border-b border-slate-800/90 px-4 lg:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl bg-slate-800 text-slate-200"
              aria-label="Abrir menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-slate-100 tabular-nums">
                {formatDateBR(state.currentDate)}
              </div>
              <span
                className={`hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                  winInfo.open
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
                    : 'bg-slate-800/80 text-slate-400 border-slate-700'
                }`}
              >
                {winInfo.open ? 'Janela Aberta' : 'Janela Fechada'}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="hidden md:flex items-center gap-3 px-3.5 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs">
              <div>
                <span className="text-slate-400 mr-1.5">Caixa:</span>
                <span
                  className={`font-bold tabular-nums ${
                    userClub.finances.balance < 0 ? 'text-rose-400' : 'text-emerald-400'
                  }`}
                >
                  {formatCurrency(userClub.finances.balance)}
                </span>
              </div>
              <span className="text-slate-700">|</span>
              <div>
                <span className="text-slate-400 mr-1.5">Mercado:</span>
                <span className="font-bold text-sky-300 tabular-nums">
                  {formatCurrency(userClub.finances.transferBudget)}
                </span>
              </div>
            </div>

            <button
              onClick={() => advanceDays(1)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-100 transition-colors"
              title="Avançar 1 dia no calendário"
            >
              <CalendarPlus className="w-3.5 h-3.5 text-sky-400" />
              +1 Dia
            </button>
            <button
              onClick={advanceToNextMatch}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-xs font-black text-white shadow-md shadow-emerald-950/50 transition-all"
            >
              <FastForward className="w-3.5 h-3.5" />
              Próx. Jogo
            </button>
          </div>
        </header>

        {/* Page body */}
        <main className="flex-1 p-4 lg:p-6 max-w-[1520px] w-full mx-auto">{children}</main>
      </div>

      {/* Toast Container */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => {
          const style =
            t.type === 'success'
              ? 'bg-emerald-950/95 border-emerald-500/50 text-emerald-100'
              : t.type === 'warning'
                ? 'bg-amber-950/95 border-amber-500/50 text-amber-100'
                : t.type === 'danger'
                  ? 'bg-rose-950/95 border-rose-500/50 text-rose-100'
                  : 'bg-slate-900/95 border-sky-500/40 text-slate-100';
          return (
            <div
              key={t.id}
              onClick={() => dismissToast(t.id)}
              className={`pointer-events-auto cursor-pointer px-4 py-3 rounded-2xl border shadow-2xl flex items-start gap-2.5 text-xs font-medium backdrop-blur-md ${style}`}
            >
              {t.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : t.type === 'warning' || t.type === 'danger' ? (
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              ) : (
                <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              )}
              <span className="leading-relaxed">{t.text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
