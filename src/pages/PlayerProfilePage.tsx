import React, { useMemo, useState } from 'react';
import { useGame } from '../store/GameContext';
import { ContractRole, TrainingType } from '../types/game';
import {
  formatCurrency,
  formatDateBR,
  POSITION_LABELS,
  ROLE_DESCRIPTIONS,
  TRAINING_DESCRIPTIONS,
} from '../engine/constants';
import { calculateBaseOverall, getPlayerTemporaryModifiers } from '../engine/overall';
import { calculatePairChemistry } from '../engine/chemistry';
import { getPlayerAgePhase } from '../engine/development';
import {
  AttributeValue,
  ClubBadge,
  DissatisfactionBadge,
  Modal,
  OverallBadge,
  Panel,
  PositionBadge,
  ProgressBar,
  RoleBadge,
} from '../components/UI';
import {
  AlertTriangle,
  ArrowLeft,
  FileSignature,
  Gavel,
  HeartPulse,
  Sparkles,
  Tag,
  TrendingUp,
  Users,
} from 'lucide-react';

const ROLES: ContractRole[] = ['Titular fixo', 'Titular rotativo', 'Volátil', 'Reserva', 'Jovem promessa'];
const INDIVIDUAL_FOCUSES: TrainingType[] = ['Técnico', 'Físico', 'Tático', 'Mental', 'Finalização', 'Defensivo'];

export const PlayerProfilePage: React.FC = () => {
  const {
    state,
    userClub,
    userPlayers,
    navigate,
    renegotiateContract,
    setPlayerListing,
    setPlayerIndividualTraining,
    putPlayerInAuction,
  } = useGame();

  const player =
    (state.selectedPlayerId ? state.players[state.selectedPlayerId] : null) ??
    userPlayers[0] ??
    Object.values(state.players)[0];

  const [showRenewModal, setShowRenewModal] = useState(false);
  const [offerSalary, setOfferSalary] = useState(player ? Math.round(player.contract.salary * 1.15) : 100_000);
  const [offerYears, setOfferYears] = useState(3);
  const [offerRole, setOfferRole] = useState<ContractRole>(player?.contract.role ?? 'Titular rotativo');
  const [renewFeedback, setRenewFeedback] = useState<string | null>(null);

  const [showAuctionModal, setShowAuctionModal] = useState(false);
  const [auctionMinPrice, setAuctionMinPrice] = useState(player ? Math.round(player.marketValue * 0.9) : 1_000_000);
  const [auctionDays, setAuctionDays] = useState(5);

  const club = player ? state.clubs[player.clubId] : undefined;
  const isUserPlayer = player?.clubId === userClub.id;

  const teammatesChemistry = useMemo(() => {
    if (!player) return [];
    const mates = Object.values(state.players).filter((p) => p.clubId === player.clubId && p.id !== player.id);
    return mates
      .map((m) => ({
        mate: m,
        chem: calculatePairChemistry(player, m, club?.tactics.playStyle),
      }))
      .sort((a, b) => b.chem.score - a.chem.score)
      .slice(0, 6);
  }, [player, state.players, club]);

  if (!player) return null;

  const baseOvr = calculateBaseOverall(player);
  const mods = getPlayerTemporaryModifiers(player);
  const agePhase = getPlayerAgePhase(player);

  const openRenewal = () => {
    setOfferSalary(Math.round((player.contract.salary * 1.15) / 5_000) * 5_000);
    setOfferYears(3);
    setOfferRole(player.contract.role);
    setRenewFeedback(null);
    setShowRenewModal(true);
  };

  const handleRenewSubmit = () => {
    const res = renegotiateContract(player.id, {
      salary: offerSalary,
      years: offerYears,
      role: offerRole,
    });
    setRenewFeedback(res.reason);
    if (!res.accepted && res.counterOffer) {
      setOfferSalary(res.counterOffer.salary);
      setOfferYears(res.counterOffer.years);
      setOfferRole(res.counterOffer.role);
    }
    if (res.accepted) {
      window.setTimeout(() => setShowRenewModal(false), 1200);
    }
  };

  return (
    <div className="space-y-6">
      {/* Seletor rápido + Voltar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={() => navigate('squad')}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar para o Elenco
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Trocar atleta:</span>
          <select
            value={player.id}
            onChange={(e) => navigate('player_profile', e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-[#0e1525] border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500"
          >
            {userPlayers.map((up) => (
              <option key={up.id} value={up.id}>
                {up.shortName} ({up.primaryPosition} • OVR {calculateBaseOverall(up)})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Cabeçalho do Atleta */}
      <div className="rounded-3xl bg-gradient-to-br from-[#111c33] via-[#0e1525] to-[#0a1322] border border-slate-800 p-6 shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex items-start gap-4">
            <ClubBadge club={club} size="lg" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-black text-white">{player.fullName}</h1>
                <PositionBadge position={player.primaryPosition} />
                {player.secondaryPosition && (
                  <span className="text-xs text-slate-400">Sec: {player.secondaryPosition}</span>
                )}
                <DissatisfactionBadge level={player.contract.dissatisfaction} />
              </div>
              <p className="text-xs text-slate-300 mt-1.5">
                {POSITION_LABELS[player.primaryPosition]} • {player.age} anos ({agePhase}, auge aos {player.peakAge}) •{' '}
                {player.nationality} ({player.language}) • {player.heightCm} cm / {player.weightKg} kg • Pé{' '}
                {player.dominantFoot}
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-2.5">
                <RoleBadge role={player.contract.role} />
                <span className="px-2.5 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-[11px] text-slate-200">
                  Personalidade: <strong>{player.personality}</strong>
                </span>
                <span className="px-2.5 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-[11px] text-slate-200">
                  Estilo: <strong>{player.chemistry.playStyle}</strong>
                </span>
                {player.injury && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-rose-500/20 border border-rose-500/40 text-[11px] font-bold text-rose-300">
                    <HeartPulse className="w-3.5 h-3.5" /> {player.injury.type} ({player.injury.remainingDays}d)
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">Overall</p>
              <OverallBadge base={baseOvr} delta={mods.overallDelta} size="lg" />
            </div>
            <div className="text-center px-3 py-1.5 rounded-xl bg-sky-500/15 border border-sky-500/35">
              <p className="text-[10px] font-bold uppercase text-sky-300">Potencial</p>
              <p className="text-xl font-black font-mono text-sky-200 tabular-nums">{player.potential}</p>
            </div>
          </div>
        </div>

        {/* Modificadores Temporários Ativos */}
        {mods.reasons.length > 0 && (
          <div className="mt-4 p-3.5 rounded-2xl bg-amber-950/25 border border-amber-500/35 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-bold text-amber-200">Modificadores Temporários Ativos (Reversíveis)</p>
                <p className="text-amber-100/80 mt-0.5">{mods.reasons.join(' • ')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-mono font-bold">
              {mods.technicalDelta !== 0 && (
                <span className={mods.technicalDelta < 0 ? 'text-rose-400' : 'text-emerald-400'}>
                  Téc {mods.technicalDelta > 0 ? `+${mods.technicalDelta}` : mods.technicalDelta}
                </span>
              )}
              {mods.physicalDelta !== 0 && (
                <span className={mods.physicalDelta < 0 ? 'text-rose-400' : 'text-emerald-400'}>
                  Fís {mods.physicalDelta > 0 ? `+${mods.physicalDelta}` : mods.physicalDelta}
                </span>
              )}
              {mods.mentalDelta !== 0 && (
                <span className={mods.mentalDelta < 0 ? 'text-rose-400' : 'text-emerald-400'}>
                  Ment {mods.mentalDelta > 0 ? `+${mods.mentalDelta}` : mods.mentalDelta}
                </span>
              )}
              {mods.conditionalDelta !== 0 && (
                <span className={mods.conditionalDelta < 0 ? 'text-rose-400' : 'text-emerald-400'}>
                  Cond {mods.conditionalDelta > 0 ? `+${mods.conditionalDelta}` : mods.conditionalDelta}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Ações do gestor */}
        {isUserPlayer && (
          <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-wrap items-center gap-2.5">
            <button
              onClick={openRenewal}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition-colors"
            >
              <FileSignature className="w-4 h-4" />
              Renegociar Contrato / Papel
            </button>
            <button
              onClick={() => setPlayerListing(player.id, !player.isTransferListed, player.isLoanListed)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-bold transition-colors ${
                player.isTransferListed
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-200'
                  : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              {player.isTransferListed ? 'Remover da Lista de Venda' : 'Listar para Transferência'}
            </button>
            <button
              onClick={() => setPlayerListing(player.id, player.isTransferListed, !player.isLoanListed)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-bold transition-colors ${
                player.isLoanListed
                  ? 'bg-sky-500/20 border-sky-500/50 text-sky-200'
                  : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
              }`}
            >
              {player.isLoanListed ? 'Remover de Empréstimo' : 'Disponibilizar Empréstimo'}
            </button>
            <button
              onClick={() => {
                setAuctionMinPrice(Math.round((player.marketValue * 0.9) / 50_000) * 50_000);
                setShowAuctionModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600/20 hover:bg-amber-600/35 border border-amber-500/40 text-xs font-bold text-amber-300 transition-colors"
            >
              <Gavel className="w-3.5 h-3.5" />
              Leiloar Atleta
            </button>

            <div className="ml-auto flex items-center gap-2">
              <span className="text-[11px] text-slate-400">Foco Individual:</span>
              <select
                value={player.individualTrainingFocus ?? 'Técnico'}
                onChange={(e) => setPlayerIndividualTraining(player.id, e.target.value as TrainingType)}
                className="px-2.5 py-1.5 rounded-lg bg-[#0a101d] border border-slate-700 text-xs text-slate-100"
              >
                {INDIVIDUAL_FOCUSES.map((f) => (
                  <option key={f} value={f}>
                    {TRAINING_DESCRIPTIONS[f].label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Blocos de Atributos (Técnicos, Físicos, Mentais, Condicionais) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        <Panel title="Atributos Técnicos" subtitle={mods.technicalDelta !== 0 ? `Modificador: ${mods.technicalDelta}` : undefined}>
          <div className="divide-y divide-slate-800/60">
            <AttributeValue label="Finalização" base={player.technical.finalizacao} delta={mods.technicalDelta} showBar />
            <AttributeValue label="Passe Curto" base={player.technical.passeCurto} delta={mods.technicalDelta} showBar />
            <AttributeValue label="Passe Longo" base={player.technical.passeLongo} delta={mods.technicalDelta} showBar />
            <AttributeValue label="Cruzamento" base={player.technical.cruzamento} delta={mods.technicalDelta} showBar />
            <AttributeValue label="Drible" base={player.technical.drible} delta={mods.technicalDelta} showBar />
            <AttributeValue label="Controle de Bola" base={player.technical.controleBola} delta={mods.technicalDelta} showBar />
            <AttributeValue label="Marcação" base={player.technical.marcacao} delta={mods.technicalDelta} showBar />
            <AttributeValue label="Desarme" base={player.technical.desarme} delta={mods.technicalDelta} showBar />
            <AttributeValue label="Cabeceio" base={player.technical.cabeceio} delta={mods.technicalDelta} showBar />
            <AttributeValue label="Posicionamento" base={player.technical.posicionamento} delta={mods.technicalDelta} showBar />
            <AttributeValue label="Técnica" base={player.technical.tecnica} delta={mods.technicalDelta} showBar />
            <AttributeValue label="Bola Parada" base={player.technical.bolaParada} delta={mods.technicalDelta} showBar />
            {player.primaryPosition === 'GOL' && (
              <>
                <AttributeValue label="Reflexos (GOL)" base={player.technical.reflexos} delta={mods.technicalDelta} showBar />
                <AttributeValue label="Defesa (GOL)" base={player.technical.defesaGoleiro} delta={mods.technicalDelta} showBar />
                <AttributeValue label="Jogo Aéreo (GOL)" base={player.technical.jogoAereo} delta={mods.technicalDelta} showBar />
              </>
            )}
          </div>
        </Panel>

        <Panel title="Atributos Físicos" subtitle={mods.physicalDelta !== 0 ? `Modificador: ${mods.physicalDelta}` : undefined}>
          <div className="divide-y divide-slate-800/60">
            <AttributeValue label="Velocidade" base={player.physical.velocidade} delta={mods.physicalDelta} showBar />
            <AttributeValue label="Aceleração" base={player.physical.aceleracao} delta={mods.physicalDelta} showBar />
            <AttributeValue label="Força" base={player.physical.forca} delta={mods.physicalDelta} showBar />
            <AttributeValue label="Resistência" base={player.physical.resistencia} delta={mods.physicalDelta} showBar />
            <AttributeValue label="Agilidade" base={player.physical.agilidade} delta={mods.physicalDelta} showBar />
            <AttributeValue label="Equilíbrio" base={player.physical.equilibrio} delta={mods.physicalDelta} showBar />
            <AttributeValue label="Impulsão" base={player.physical.impulsao} delta={mods.physicalDelta} showBar />
          </div>

          <div className="mt-5 pt-4 border-t border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> Progresso de Evolução
              </span>
              <span className="font-mono font-bold text-emerald-300">{player.developmentProgress}%</span>
            </div>
            <ProgressBar value={player.developmentProgress} color="emerald" />
            <p className="text-[11px] text-slate-400">
              Fase: <strong className="text-slate-200">{agePhase}</strong> • Sobrecarga:{' '}
              <strong className={player.overplayStress > 65 ? 'text-rose-400' : 'text-slate-200'}>
                {player.overplayStress}%
              </strong>
            </p>
          </div>
        </Panel>

        <Panel title="Atributos Mentais" subtitle={mods.mentalDelta !== 0 ? `Modificador: ${mods.mentalDelta}` : undefined}>
          <div className="divide-y divide-slate-800/60">
            <AttributeValue label="Inteligência Tática" base={player.mental.inteligenciaTatica} delta={mods.mentalDelta} showBar />
            <AttributeValue label="Visão de Jogo" base={player.mental.visaoJogo} delta={mods.mentalDelta} showBar />
            <AttributeValue label="Concentração" base={player.mental.concentracao} delta={mods.mentalDelta} showBar />
            <AttributeValue label="Decisão" base={player.mental.decisao} delta={mods.mentalDelta} showBar />
            <AttributeValue label="Determinação" base={player.mental.determinacao} delta={mods.mentalDelta} showBar />
            <AttributeValue label="Liderança" base={player.mental.lideranca} delta={mods.mentalDelta} showBar />
            <AttributeValue label="Trabalho em Equipe" base={player.mental.trabalhoEquipe} delta={mods.mentalDelta} showBar />
            <AttributeValue label="Antecipação" base={player.mental.antecipacao} delta={mods.mentalDelta} showBar />
            <AttributeValue label="Compostura" base={player.mental.compostura} delta={mods.mentalDelta} showBar />
          </div>
        </Panel>

        <Panel title="Condicionais & Contrato" subtitle={mods.conditionalDelta !== 0 ? `Modificador: ${mods.conditionalDelta}` : undefined}>
          <div className="divide-y divide-slate-800/60 mb-4">
            <AttributeValue label="Condicionamento" base={player.conditional.condicionamento} delta={mods.conditionalDelta} showBar />
            <div className="flex items-center justify-between py-1">
              <span className="text-xs text-slate-300">Fadiga</span>
              <span className={`font-mono font-bold text-xs ${player.conditional.fadiga >= 65 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {player.conditional.fadiga}%
              </span>
            </div>
            <AttributeValue label="Ritmo de Jogo" base={player.conditional.ritmoJogo} delta={mods.conditionalDelta} showBar />
            <AttributeValue label="Moral" base={player.conditional.moral} delta={0} showBar />
            <AttributeValue label="Confiança" base={player.conditional.confianca} delta={mods.conditionalDelta} showBar />
            <AttributeValue label="Forma Recente" base={player.conditional.formaRecente} delta={mods.conditionalDelta} showBar />
          </div>

          <div className="p-3 rounded-xl bg-[#0a101d] border border-slate-800 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Valor de Mercado</span>
              <span className="font-bold text-white tabular-nums">{formatCurrency(player.marketValue)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Salário Mensal</span>
              <span className="font-bold text-emerald-400 tabular-nums">{formatCurrency(player.contract.salary)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Fim do Contrato</span>
              <span className="font-bold text-slate-200 tabular-nums">{formatDateBR(player.contract.endDate)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Multa Rescisória</span>
              <span className="font-bold text-slate-300 tabular-nums">{formatCurrency(player.contract.releaseClause)}</span>
            </div>
            <p className="text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
              {ROLE_DESCRIPTIONS[player.contract.role]}
            </p>
          </div>
        </Panel>
      </div>

      {/* Química, Estatísticas e Histórico */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Panel
          title="Química e Entrosamento com Companheiros"
          subtitle={`Entrosamento tático: ${player.chemistry.tacticalFamiliarity}% • ${player.chemistry.daysAtClub} dias no clube`}
          className="lg:col-span-5"
        >
          <div className="space-y-2.5">
            {teammatesChemistry.map(({ mate, chem }) => (
              <div
                key={mate.id}
                onClick={() => navigate('player_profile', mate.id)}
                className="p-2.5 rounded-xl bg-[#0a101d] border border-slate-800 hover:border-slate-600 cursor-pointer flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <PositionBadge position={mate.primaryPosition} size="xs" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">{mate.shortName}</p>
                    <p className="text-[10px] text-slate-400">
                      {player.chemistry.matchesWithTeammates[mate.id] ?? 0} jogos juntos •{' '}
                      {mate.language === player.language ? 'Mesmo idioma' : mate.nationality}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span
                    className={`font-mono font-black text-xs ${
                      chem.score >= 78 ? 'text-emerald-400' : chem.score >= 58 ? 'text-amber-300' : 'text-rose-400'
                    }`}
                  >
                    {chem.score}%
                  </span>
                  <p className="text-[10px] text-slate-400">{chem.label}</p>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Estatísticas da Carreira & Histórico de Clubes" className="lg:col-span-7">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <div className="p-3 rounded-xl bg-[#0a101d] border border-slate-800 text-center">
              <p className="text-[10px] uppercase text-slate-400">Jogos (Temp / Carr)</p>
              <p className="text-base font-black text-white font-mono mt-0.5">
                {player.careerStats.seasonMatches} / {player.careerStats.matches}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-[#0a101d] border border-slate-800 text-center">
              <p className="text-[10px] uppercase text-slate-400">Gols</p>
              <p className="text-base font-black text-emerald-400 font-mono mt-0.5">
                {player.careerStats.seasonGoals} / {player.careerStats.goals}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-[#0a101d] border border-slate-800 text-center">
              <p className="text-[10px] uppercase text-slate-400">Assistências</p>
              <p className="text-base font-black text-sky-400 font-mono mt-0.5">
                {player.careerStats.seasonAssists} / {player.careerStats.assists}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-[#0a101d] border border-slate-800 text-center">
              <p className="text-[10px] uppercase text-slate-400">Nota Média</p>
              <p className="text-base font-black text-amber-300 font-mono mt-0.5">
                {player.careerStats.averageRating.toFixed(2)}
              </p>
            </div>
          </div>

          <h3 className="text-xs font-bold uppercase text-slate-400 mb-2 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" /> Histórico de Clubes
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] uppercase text-slate-400 border-b border-slate-800">
                  <th className="py-2 text-left">Clube</th>
                  <th className="py-2 text-center">Período</th>
                  <th className="py-2 text-center">Jogos</th>
                  <th className="py-2 text-center">Gols</th>
                  <th className="py-2 text-center">Assist.</th>
                  <th className="py-2 text-right">Nota</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {player.clubHistory.map((h, i) => (
                  <tr key={`${h.clubId}-${i}`}>
                    <td className="py-2 font-semibold text-slate-200">{h.clubName}</td>
                    <td className="py-2 text-center text-slate-400 font-mono">
                      {h.seasonStart}–{h.seasonEnd ?? 'Atual'}
                    </td>
                    <td className="py-2 text-center font-mono">{h.matches}</td>
                    <td className="py-2 text-center font-mono text-emerald-400">{h.goals}</td>
                    <td className="py-2 text-center font-mono text-sky-400">{h.assists}</td>
                    <td className="py-2 text-right font-mono text-amber-300">{h.avgRating.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      {/* Modal de Renegociação Contratual */}
      <Modal
        open={showRenewModal}
        onClose={() => setShowRenewModal(false)}
        title={`Renegociar Contrato — ${player.fullName}`}
        subtitle={`Papel atual: ${player.contract.role} • Salário atual: ${formatCurrency(player.contract.salary)}/mês`}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Papel no Elenco</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ROLES.map((role) => (
                <button
                  key={role}
                  onClick={() => setOfferRole(role)}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    offerRole === role
                      ? 'bg-emerald-500/15 border-emerald-400 text-white'
                      : 'bg-[#0a101d] border-slate-800 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  <p className="text-xs font-bold">{role}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{ROLE_DESCRIPTIONS[role]}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Salário Mensal (R$)</label>
              <input
                type="number"
                step={5000}
                min={15000}
                value={offerSalary}
                onChange={(e) => setOfferSalary(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-[#0a101d] border border-slate-700 text-sm text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Duração (Anos)</label>
              <select
                value={offerYears}
                onChange={(e) => setOfferYears(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-[#0a101d] border border-slate-700 text-sm text-white"
              >
                {[1, 2, 3, 4, 5].map((y) => (
                  <option key={y} value={y}>
                    {y} {y === 1 ? 'ano' : 'anos'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {renewFeedback && (
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200">
              {renewFeedback}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setShowRenewModal(false)}
              className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-bold text-slate-300"
            >
              Cancelar
            </button>
            <button
              onClick={handleRenewSubmit}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" /> Enviar Proposta
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal de Leiloar Atleta */}
      <Modal
        open={showAuctionModal}
        onClose={() => setShowAuctionModal(false)}
        title={`Abrir Leilão por ${player.fullName}`}
        subtitle={`Valor de mercado estimado: ${formatCurrency(player.marketValue)}`}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Lance Mínimo (R$)</label>
              <input
                type="number"
                step={100000}
                min={200000}
                value={auctionMinPrice}
                onChange={(e) => setAuctionMinPrice(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-[#0a101d] border border-slate-700 text-sm text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Prazo do Leilão (Dias)</label>
              <select
                value={auctionDays}
                onChange={(e) => setAuctionDays(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-[#0a101d] border border-slate-700 text-sm text-white"
              >
                {[3, 4, 5, 6, 7].map((d) => (
                  <option key={d} value={d}>
                    {d} dias
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-xs text-slate-400">
            Clubes interessados disputarão {player.shortName} enviando lances crescentes até o prazo de encerramento.
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowAuctionModal(false)}
              className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-bold text-slate-300"
            >
              Cancelar
            </button>
            <button
              onClick={() => {
                putPlayerInAuction(player.id, auctionMinPrice, auctionDays);
                setShowAuctionModal(false);
                navigate('auctions');
              }}
              className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-xs font-bold text-white"
            >
              Confirmar Leilão
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
