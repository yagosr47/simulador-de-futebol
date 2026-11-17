import React from 'react';
import { GameProvider, useGame } from './store/GameContext';
import { Layout } from './components/Layout';
import { ClubSelectorModal } from './components/ClubSelectorModal';
import { DashboardPage } from './pages/DashboardPage';
import { SquadPage } from './pages/SquadPage';
import { PlayerProfilePage } from './pages/PlayerProfilePage';
import { TrainingPage } from './pages/TrainingPage';
import { TacticsPage } from './pages/TacticsPage';
import { MatchPage } from './pages/MatchPage';
import { CalendarPage } from './pages/CalendarPage';
import { TransfersPage } from './pages/TransfersPage';
import { AuctionsPage } from './pages/AuctionsPage';
import { Stadium3DPage } from './pages/Stadium3DPage';
import { InfirmaryPage } from './pages/InfirmaryPage';
import { FinancesPage } from './pages/FinancesPage';
import { CompetitionsPage } from './pages/CompetitionsPage';
import { HistoryPage } from './pages/HistoryPage';

const PageRouter: React.FC = () => {
  const { activePage } = useGame();

  switch (activePage) {
    case 'dashboard':
      return <DashboardPage />;
    case 'squad':
      return <SquadPage />;
    case 'player_profile':
      return <PlayerProfilePage />;
    case 'training':
      return <TrainingPage />;
    case 'tactics':
      return <TacticsPage />;
    case 'matches':
      return <MatchPage />;
    case 'calendar':
      return <CalendarPage />;
    case 'transfers':
      return <TransfersPage />;
    case 'auctions':
      return <AuctionsPage />;
    case 'stadium':
      return <Stadium3DPage />;
    case 'infirmary':
      return <InfirmaryPage />;
    case 'finances':
      return <FinancesPage />;
    case 'competitions':
      return <CompetitionsPage />;
    case 'history':
      return <HistoryPage />;
    default:
      return <DashboardPage />;
  }
};

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error?.message || 'Erro inesperado na interface.' };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#070b14] text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-[#0e1525] border border-rose-500/40 rounded-2xl p-6 space-y-4 text-center">
            <h1 className="text-lg font-black text-white">Ops! Ocorreu um erro de renderização</h1>
            <p className="text-xs text-slate-400">{this.state.message}</p>
            <button
              onClick={() => {
                this.setState({ hasError: false, message: '' });
                window.location.reload();
              }}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white"
            >
              Recarregar Simulador
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function App() {
  return (
    <AppErrorBoundary>
      <GameProvider>
        <Layout>
          <PageRouter />
        </Layout>
        <ClubSelectorModal />
      </GameProvider>
    </AppErrorBoundary>
  );
}

export default App;
