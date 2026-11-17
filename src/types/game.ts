export type Position = 'GOL' | 'ZAG' | 'LD' | 'LE' | 'VOL' | 'MC' | 'MEI' | 'PD' | 'PE' | 'ATA';

export type PositionGroup = 'GOL' | 'DEF' | 'MEI' | 'ATA';

export type DominantFoot = 'Direito' | 'Esquerdo' | 'Ambidestro';

export type PlayerPersonality =
  | 'Profissional'
  | 'Ambicioso'
  | 'Leal'
  | 'Líder Nato'
  | 'Temperamental'
  | 'Mercenário'
  | 'Resiliente'
  | 'Acomodado';

export type PlayStyle =
  | 'Posse de Bola'
  | 'Contra-Ataque'
  | 'Pressão Alta'
  | 'Jogo Direto'
  | 'Tático Equilibrado';

export type ContractRole =
  | 'Titular fixo'
  | 'Titular rotativo'
  | 'Volátil'
  | 'Reserva'
  | 'Jovem promessa';

export type DissatisfactionLevel = 'Satisfeito' | 'Leve' | 'Moderada' | 'Elevada';

export interface TechnicalAttributes {
  finalizacao: number;
  passeCurto: number;
  passeLongo: number;
  cruzamento: number;
  drible: number;
  controleBola: number;
  marcacao: number;
  desarme: number;
  cabeceio: number;
  posicionamento: number;
  tecnica: number;
  bolaParada: number;
  // Goleiro especializados
  reflexos: number;
  defesaGoleiro: number;
  jogoAereo: number;
}

export interface PhysicalAttributes {
  velocidade: number;
  aceleracao: number;
  forca: number;
  resistencia: number;
  agilidade: number;
  equilibrio: number;
  impulsao: number;
}

export interface MentalAttributes {
  inteligenciaTatica: number;
  visaoJogo: number;
  concentracao: number;
  decisao: number;
  determinacao: number;
  lideranca: number;
  trabalhoEquipe: number;
  antecipacao: number;
  compostura: number;
}

export interface ConditionalAttributes {
  condicionamento: number; // 0-100
  fadiga: number; // 0-100 (quanto maior, mais cansado)
  ritmoJogo: number; // 0-100
  moral: number; // 0-100
  confianca: number; // 0-100
  formaRecente: number; // 0-100
}

export interface ClubHistoryEntry {
  clubId: string;
  clubName: string;
  seasonStart: number;
  seasonEnd?: number;
  matches: number;
  goals: number;
  assists: number;
  avgRating: number;
}

export interface PlayerCareerStats {
  matches: number;
  starts: number;
  goals: number;
  assists: number;
  cleanSheets: number;
  yellowCards: number;
  redCards: number;
  minutesPlayed: number;
  averageRating: number;
  seasonMatches: number;
  seasonStarts: number;
  seasonGoals: number;
  seasonAssists: number;
  seasonYellowCards: number;
  seasonRedCards: number;
  seasonRatingSum: number;
  seasonRatingCount: number;
}

export interface PlayerInjury {
  id: string;
  type: string;
  severity: 'Leve' | 'Moderada' | 'Grave' | 'Muito Grave';
  totalDays: number;
  remainingDays: number;
  stage: 'Aguda' | 'Tratamento' | 'Fisioterapia' | 'Transição Física';
  treatmentProgress: number; // 0-100
  cause: 'Partida' | 'Treinamento' | 'Sobrecarga Física';
  incurredDate: string; // YYYY-MM-DD
}

export interface PlayerContract {
  salary: number; // salário mensal em R$
  yearsRemaining: number;
  endDate: string; // YYYY-MM-DD
  role: ContractRole;
  releaseClause: number;
  expectedStartRatio: number; // 0..1 baseado no papel
  recentTeamMatchesConsidered: number;
  recentPlayerStarts: number;
  recentPlayerAppearances: number;
  dissatisfaction: DissatisfactionLevel;
  dissatisfactionPoints: number; // 0-100
  requestedTransfer: boolean;
  requestedRenegotiation: boolean;
  lastComplaintDate?: string;
}

export interface PlayerChemistryData {
  tacticalFamiliarity: number; // 0-100
  playStyle: PlayStyle;
  daysAtClub: number;
  matchesWithTeammates: Record<string, number>; // playerId -> partidas juntos
  relationships: Record<string, number>; // playerId -> -20..+30 afinidade
}

export interface TemporaryModifiers {
  technicalDelta: number;
  physicalDelta: number;
  mentalDelta: number;
  conditionalDelta: number;
  overallDelta: number;
  reasons: string[];
}

export interface Player {
  id: string;
  fullName: string;
  shortName: string;
  age: number;
  nationality: string;
  language: string;
  primaryPosition: Position;
  secondaryPosition?: Position;
  heightCm: number;
  weightKg: number;
  dominantFoot: DominantFoot;
  potential: number; // 1-99
  peakAge: number; // 24-31
  marketValue: number; // em R$
  personality: PlayerPersonality;
  clubId: string;
  loanedFromClubId?: string;
  loanEndDate?: string;
  isTransferListed: boolean;
  isLoanListed: boolean;
  askingPrice?: number;
  technical: TechnicalAttributes;
  physical: PhysicalAttributes;
  mental: MentalAttributes;
  conditional: ConditionalAttributes;
  contract: PlayerContract;
  chemistry: PlayerChemistryData;
  careerStats: PlayerCareerStats;
  clubHistory: ClubHistoryEntry[];
  injury: PlayerInjury | null;
  injuryProne: number; // 1-20
  injuryHistoryCount: number;
  overplayStress: number; // 0-100
  developmentProgress: number; // 0-100 acumulador de evolução
  individualTrainingFocus?: TrainingType;
  returnToPlaySharpness: number; // 0-100 após lesão
  preferredPositionBonus?: Position;
}

export type TrainingType =
  | 'Individual'
  | 'Coletivo'
  | 'Físico'
  | 'Técnico'
  | 'Tático'
  | 'Mental'
  | 'Finalização'
  | 'Defensivo'
  | 'Recuperação Física';

export type TrainingIntensity = 'Leve' | 'Moderado' | 'Intenso';

export type CoachSpecialty =
  | 'Desenvolvimento Juvenil'
  | 'Preparação Física'
  | 'Tática e Posicionamento'
  | 'Técnica e Finalização'
  | 'Organização Defensiva'
  | 'Psicologia e Liderança';

export interface CoachStaff {
  id: string;
  name: string;
  age: number;
  nationality: string;
  level: number; // 1-5 estrelas
  quality: number; // 40-99
  developmentAbility: number; // 40-99
  specialty: CoachSpecialty;
  monthlySalary: number;
  hiringFee: number;
  isHeadCoach?: boolean;
}

export type MedicalSpecialty =
  | 'Fisioterapia Esportiva'
  | 'Ortopedia e Trauma'
  | 'Prevenção e Fisiologia'
  | 'Reabilitação Muscular';

export interface MedicalStaff {
  id: string;
  name: string;
  age: number;
  level: number; // 1-5
  quality: number; // 40-99
  recoveryBonus: number; // percentual de aceleração 5-35%
  preventionBonus: number; // percentual de redução de risco 5-30%
  specialty: MedicalSpecialty;
  monthlySalary: number;
  hiringFee: number;
}

export type FormationName =
  | '4-3-3'
  | '4-4-2'
  | '4-2-3-1'
  | '3-5-2'
  | '5-3-2'
  | '4-1-4-1'
  | '3-4-3';

export type TacticalMentality = 'Ultradefensiva' | 'Defensiva' | 'Equilibrada' | 'Ofensiva' | 'Ultraofensiva';
export type PressingIntensity = 'Baixa' | 'Média' | 'Alta' | 'Pressão Total';
export type PassingStyle = 'Curto' | 'Misto' | 'Direto' | 'Longo';
export type TempoStyle = 'Lento' | 'Controlado' | 'Rápido';
export type DefensiveLine = 'Recuada' | 'Padrão' | 'Adiantada';

export interface TacticalSetup {
  formation: FormationName;
  mentality: TacticalMentality;
  pressing: PressingIntensity;
  passingStyle: PassingStyle;
  tempo: TempoStyle;
  defensiveLine: DefensiveLine;
  playStyle: PlayStyle;
  startingXI: string[]; // 11 player IDs alinhados aos slots da formação
  bench: string[]; // até 9 reservas
}

export interface TeamStrengthBreakdown {
  overall: number;
  startersRating: number;
  benchRating: number;
  chemistryScore: number;
  cohesionScore: number;
  fitnessScore: number;
  moraleScore: number;
  tacticalCompatibility: number;
  defensiveOrganization: number;
  offensiveOrganization: number;
}

export type StadiumUpgradeCategory =
  | 'arquibancadas'
  | 'cobertura'
  | 'iluminacao'
  | 'vip'
  | 'infraestrutura'
  | 'modernizacao';

export interface StadiumConstruction {
  id: string;
  category: StadiumUpgradeCategory;
  name: string;
  targetLevel: number;
  cost: number;
  totalDays: number;
  remainingDays: number;
  startDate: string;
  estimatedEndDate: string;
  capacityAdded: number;
  benefitDescription: string;
}

export interface Stadium {
  name: string;
  capacity: number;
  standsLevel: number; // 1-5
  roofLevel: number; // 0-4
  lightingLevel: number; // 1-4
  vipLevel: number; // 0-4
  infrastructureLevel: number; // 1-5
  modernizationLevel: number; // 1-4
  pitchQuality: number; // 60-100
  ticketPrice: number; // R$ 20 - R$ 250
  vipTicketPrice: number; // R$ 120 - R$ 800
  maintenanceMonthlyCost: number;
  homeFactorBonus: number; // 0 - 15
  activeConstructions: StadiumConstruction[];
  lastAttendance: number;
  lastRevenue: number;
  recordAttendance: number;
}

export type ClubPhilosophy =
  | 'Base e Jovens'
  | 'Galácticos'
  | 'Equilibrado'
  | 'Retranca Tática'
  | 'Ataque Total';

export interface SponsorshipDeal {
  id: string;
  sponsorName: string;
  tier: 'Regional' | 'Nacional' | 'Continental' | 'Global';
  monthlyIncome: number;
  titleBonus: number;
  durationMonths: number;
  monthsRemaining: number;
  minReputation: number;
}

export interface BankLoan {
  id: string;
  bankName: string;
  principal: number;
  remainingAmount: number;
  monthlyPayment: number;
  interestRate: number; // % anual
  monthsRemaining: number;
}

export interface FinancialTransaction {
  id: string;
  date: string;
  type: 'receita' | 'despesa';
  category:
    | 'Bilheteria'
    | 'Salários'
    | 'Transferências'
    | 'Empréstimos'
    | 'Patrocínio'
    | 'Premiação'
    | 'Estádio'
    | 'Departamento Médico'
    | 'Funcionários'
    | 'Manutenção';
  description: string;
  amount: number;
}

export interface ClubFinances {
  balance: number;
  transferBudget: number;
  wageBudgetMonthly: number;
  sponsorship: SponsorshipDeal;
  loans: BankLoan[];
  transactions: FinancialTransaction[];
}

export interface ClubObjective {
  id: string;
  title: string;
  description: string;
  targetType: 'league_position' | 'cup_round' | 'finance_balance' | 'youth_minutes' | 'stadium_level';
  targetValue: number;
  reward: number;
  completed?: boolean;
}

export interface Club {
  id: string;
  name: string;
  shortName: string;
  primaryColor: string;
  secondaryColor: string;
  city: string;
  reputation: number; // 40-98
  popularity: number; // 40-100 (base de torcida)
  philosophy: ClubPhilosophy;
  isUserClub: boolean;
  managerName: string;
  managerConfidence: number; // 0-100
  stadium: Stadium;
  tactics: TacticalSetup;
  finances: ClubFinances;
  coaches: CoachStaff[];
  medicalStaff: MedicalStaff[];
  objectives: ClubObjective[];
  recentForm: ('V' | 'E' | 'D')[];
  trainingSchedule: {
    collectiveFocus: TrainingType;
    intensity: TrainingIntensity;
    lastTrainedDate?: string;
    sessionsThisWeek: number;
  };
  titlesCount: {
    league: number;
    cup: number;
    continental: number;
  };
}

export type CompetitionType = 'Liga' | 'Copa' | 'Continental';

export interface MatchEvent {
  minute: number;
  type:
    | 'ataque_perigoso'
    | 'passe_profundidade'
    | 'cruzamento'
    | 'finalizacao'
    | 'defesa'
    | 'gol'
    | 'falta'
    | 'cartao_amarelo'
    | 'cartao_vermelho'
    | 'escanteio'
    | 'impedimento'
    | 'contra_ataque'
    | 'lesao'
    | 'substituicao'
    | 'inicio'
    | 'intervalo'
    | 'fim';
  teamSide: 'home' | 'away' | 'neutral';
  playerId?: string;
  playerName?: string;
  assistPlayerId?: string;
  assistPlayerName?: string;
  text: string;
  importance: 'low' | 'medium' | 'high' | 'critical';
}

export interface MatchStats {
  homePossession: number;
  awayPossession: number;
  homeShots: number;
  awayShots: number;
  homeShotsOnTarget: number;
  awayShotsOnTarget: number;
  homeXG: number;
  awayXG: number;
  homeSaves: number;
  awaySaves: number;
  homeFouls: number;
  awayFouls: number;
  homeYellowCards: number;
  awayYellowCards: number;
  homeRedCards: number;
  awayRedCards: number;
  homeCorners: number;
  awayCorners: number;
  homeOffsides: number;
  awayOffsides: number;
}

export interface MatchPlayerPerformance {
  playerId: string;
  playerName: string;
  position: Position;
  goals: number;
  assists: number;
  saves: number;
  yellowCard: boolean;
  redCard: boolean;
  injured: boolean;
  substitutedOutMinute?: number;
  substitutedInMinute?: number;
  minutesPlayed: number;
  staminaEnd: number;
  rating: number;
}

export interface MatchFixture {
  id: string;
  competitionId: string;
  competitionName: string;
  competitionType: CompetitionType;
  roundName: string;
  roundNumber: number;
  date: string; // YYYY-MM-DD
  homeClubId: string;
  awayClubId: string;
  played: boolean;
  homeGoals: number;
  awayGoals: number;
  importance: number; // 1-10
  attendance?: number;
  ticketRevenue?: number;
  events: MatchEvent[];
  stats?: MatchStats;
  homePerformances?: MatchPlayerPerformance[];
  awayPerformances?: MatchPlayerPerformance[];
  manOfTheMatch?: { playerId: string; playerName: string; rating: number; clubId: string };
}

export interface LeagueStanding {
  clubId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

export interface Competition {
  id: string;
  name: string;
  type: CompetitionType;
  season: number;
  standings: LeagueStanding[];
  fixtures: MatchFixture[];
  championClubId?: string;
  prizeChampion: number;
  prizeRunnerUp: number;
  prizeParticipation: number;
}

export type TransferOfferType = 'Compra' | 'Empréstimo' | 'Pré-Acordo Futuro';

export interface TransferOffer {
  id: string;
  playerId: string;
  fromClubId: string;
  toClubId: string; // clube atual do jogador
  type: TransferOfferType;
  fee: number;
  offeredSalary: number;
  contractYears: number;
  promisedRole: ContractRole;
  createdDate: string;
  effectiveDate?: string; // se pré-acordo para próxima janela
  status: 'Pendente' | 'Contraproposta' | 'Aceita Clube' | 'Concluída' | 'Recusada';
  counterFee?: number;
  playerFeedback?: string;
  isIncomingToUser: boolean;
}

export interface PendingFutureTransfer {
  id: string;
  playerId: string;
  fromClubId: string;
  toClubId: string;
  fee: number;
  salary: number;
  contractYears: number;
  role: ContractRole;
  effectiveDate: string;
}

export interface AuctionBid {
  id: string;
  clubId: string;
  clubName: string;
  fee: number;
  offeredSalary: number;
  promisedRole: ContractRole;
  timestampDate: string;
  projectScore: number; // calculado pela IA do jogador
}

export interface PlayerAuction {
  id: string;
  playerId: string;
  sellerClubId: string;
  minimumPrice: number;
  reservePrice: number;
  startDate: string;
  deadlineDate: string;
  bids: AuctionBid[];
  status: 'Ativo' | 'Encerrado' | 'Cancelado';
  winnerClubId?: string;
  winningReason?: string;
}

export type CalendarEventType =
  | 'partida'
  | 'janela_abertura'
  | 'janela_fechamento'
  | 'treinamento'
  | 'recuperacao'
  | 'especial'
  | 'final'
  | 'contrato'
  | 'obra'
  | 'leilao';

export interface CalendarEvent {
  id: string;
  date: string; // YYYY-MM-DD
  type: CalendarEventType;
  title: string;
  description: string;
  relatedId?: string;
  badge?: string;
}

export interface NewsMessage {
  id: string;
  date: string;
  category: 'Partida' | 'Mercado' | 'Elenco' | 'Leilão' | 'Estádio' | 'Médico' | 'Finanças' | 'Clubes IA';
  title: string;
  body: string;
  read: boolean;
  actionPage?: PageId;
  relatedId?: string;
  severity?: 'info' | 'success' | 'warning' | 'danger';
}

export interface SeasonHistoryEntry {
  season: number;
  leaguePosition: number;
  leaguePoints: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  cupResult: string;
  continentalResult: string;
  topScorerName: string;
  topScorerGoals: number;
  totalRevenue: number;
  championLeagueName: string;
}

export interface ClubMilestone {
  id: string;
  date: string;
  season: number;
  title: string;
  description: string;
  category: 'Título' | 'Transferência' | 'Estádio' | 'Recorde' | 'Técnico';
}

export interface ClubRecords {
  biggestWin: { score: string; opponent: string; date: string } | null;
  recordSigning: { playerName: string; fee: number; date: string } | null;
  recordSale: { playerName: string; fee: number; date: string } | null;
  highestAttendance: { attendance: number; opponent: string; date: string } | null;
}

export type PageId =
  | 'dashboard'
  | 'squad'
  | 'player_profile'
  | 'training'
  | 'tactics'
  | 'matches'
  | 'calendar'
  | 'transfers'
  | 'auctions'
  | 'stadium'
  | 'infirmary'
  | 'finances'
  | 'competitions'
  | 'history';

export interface GameState {
  version: number;
  careerStarted: boolean;
  season: number;
  currentDate: string; // YYYY-MM-DD
  userClubId: string;
  clubs: Record<string, Club>;
  players: Record<string, Player>;
  competitions: Competition[];
  transferOffers: TransferOffer[];
  pendingFutureTransfers: PendingFutureTransfer[];
  auctions: PlayerAuction[];
  availableCoaches: CoachStaff[];
  availableMedicalStaff: MedicalStaff[];
  availableSponsors: SponsorshipDeal[];
  calendarEvents: CalendarEvent[];
  news: NewsMessage[];
  seasonHistory: SeasonHistoryEntry[];
  milestones: ClubMilestone[];
  clubRecords: ClubRecords;
  activeMatchId: string | null;
  selectedPlayerId: string | null;
}
