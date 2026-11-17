import {
  ContractRole,
  FormationName,
  Position,
  PositionGroup,
  StadiumUpgradeCategory,
  TrainingType,
} from '../types/game';

export const POSITIONS: Position[] = ['GOL', 'ZAG', 'LD', 'LE', 'VOL', 'MC', 'MEI', 'PD', 'PE', 'ATA'];

export const POSITION_LABELS: Record<Position, string> = {
  GOL: 'Goleiro',
  ZAG: 'Zagueiro',
  LD: 'Lateral Direito',
  LE: 'Lateral Esquerdo',
  VOL: 'Volante',
  MC: 'Meio-Campista',
  MEI: 'Meia-Atacante',
  PD: 'Ponta Direita',
  PE: 'Ponta Esquerda',
  ATA: 'Atacante',
};

export const POSITION_GROUPS: Record<Position, PositionGroup> = {
  GOL: 'GOL',
  ZAG: 'DEF',
  LD: 'DEF',
  LE: 'DEF',
  VOL: 'MEI',
  MC: 'MEI',
  MEI: 'MEI',
  PD: 'ATA',
  PE: 'ATA',
  ATA: 'ATA',
};

export interface FormationSlot {
  slotIndex: number;
  position: Position;
  label: string;
  x: number; // 0..100 horizontal (esquerda -> direita)
  y: number; // 0..100 vertical (0 = ataque topo, 100 = gol base)
  links: number[]; // índices de slots adjacentes para química
}

export const FORMATIONS: Record<FormationName, FormationSlot[]> = {
  '4-3-3': [
    { slotIndex: 0, position: 'GOL', label: 'GOL', x: 50, y: 90, links: [2, 3] },
    { slotIndex: 1, position: 'LE', label: 'LE', x: 14, y: 72, links: [2, 5, 8] },
    { slotIndex: 2, position: 'ZAG', label: 'ZAG', x: 37, y: 76, links: [0, 1, 3, 6] },
    { slotIndex: 3, position: 'ZAG', label: 'ZAG', x: 63, y: 76, links: [0, 2, 4, 6] },
    { slotIndex: 4, position: 'LD', label: 'LD', x: 86, y: 72, links: [3, 7, 10] },
    { slotIndex: 5, position: 'MC', label: 'MC', x: 28, y: 50, links: [1, 6, 8, 9] },
    { slotIndex: 6, position: 'VOL', label: 'VOL', x: 50, y: 57, links: [2, 3, 5, 7] },
    { slotIndex: 7, position: 'MC', label: 'MC', x: 72, y: 50, links: [4, 6, 9, 10] },
    { slotIndex: 8, position: 'PE', label: 'PE', x: 18, y: 24, links: [1, 5, 9] },
    { slotIndex: 9, position: 'ATA', label: 'ATA', x: 50, y: 17, links: [5, 7, 8, 10] },
    { slotIndex: 10, position: 'PD', label: 'PD', x: 82, y: 24, links: [4, 7, 9] },
  ],
  '4-4-2': [
    { slotIndex: 0, position: 'GOL', label: 'GOL', x: 50, y: 90, links: [2, 3] },
    { slotIndex: 1, position: 'LE', label: 'LE', x: 14, y: 73, links: [2, 5] },
    { slotIndex: 2, position: 'ZAG', label: 'ZAG', x: 37, y: 76, links: [0, 1, 3, 6] },
    { slotIndex: 3, position: 'ZAG', label: 'ZAG', x: 63, y: 76, links: [0, 2, 4, 7] },
    { slotIndex: 4, position: 'LD', label: 'LD', x: 86, y: 73, links: [3, 8] },
    { slotIndex: 5, position: 'PE', label: 'ME', x: 16, y: 48, links: [1, 6, 9] },
    { slotIndex: 6, position: 'VOL', label: 'VOL', x: 39, y: 52, links: [2, 5, 7, 9] },
    { slotIndex: 7, position: 'MC', label: 'MC', x: 61, y: 52, links: [3, 6, 8, 10] },
    { slotIndex: 8, position: 'PD', label: 'MD', x: 84, y: 48, links: [4, 7, 10] },
    { slotIndex: 9, position: 'ATA', label: 'ATA', x: 38, y: 20, links: [5, 6, 10] },
    { slotIndex: 10, position: 'ATA', label: 'ATA', x: 62, y: 20, links: [7, 8, 9] },
  ],
  '4-2-3-1': [
    { slotIndex: 0, position: 'GOL', label: 'GOL', x: 50, y: 90, links: [2, 3] },
    { slotIndex: 1, position: 'LE', label: 'LE', x: 14, y: 74, links: [2, 5, 7] },
    { slotIndex: 2, position: 'ZAG', label: 'ZAG', x: 37, y: 77, links: [0, 1, 3, 5] },
    { slotIndex: 3, position: 'ZAG', label: 'ZAG', x: 63, y: 77, links: [0, 2, 4, 6] },
    { slotIndex: 4, position: 'LD', label: 'LD', x: 86, y: 74, links: [3, 6, 9] },
    { slotIndex: 5, position: 'VOL', label: 'VOL', x: 38, y: 58, links: [1, 2, 6, 8] },
    { slotIndex: 6, position: 'MC', label: 'MC', x: 62, y: 58, links: [3, 4, 5, 8] },
    { slotIndex: 7, position: 'PE', label: 'PE', x: 18, y: 36, links: [1, 8, 10] },
    { slotIndex: 8, position: 'MEI', label: 'MEI', x: 50, y: 37, links: [5, 6, 7, 9, 10] },
    { slotIndex: 9, position: 'PD', label: 'PD', x: 82, y: 36, links: [4, 8, 10] },
    { slotIndex: 10, position: 'ATA', label: 'ATA', x: 50, y: 16, links: [7, 8, 9] },
  ],
  '3-5-2': [
    { slotIndex: 0, position: 'GOL', label: 'GOL', x: 50, y: 90, links: [1, 2, 3] },
    { slotIndex: 1, position: 'ZAG', label: 'ZAG', x: 24, y: 75, links: [0, 2, 4, 5] },
    { slotIndex: 2, position: 'ZAG', label: 'ZAG', x: 50, y: 77, links: [0, 1, 3, 6] },
    { slotIndex: 3, position: 'ZAG', label: 'ZAG', x: 76, y: 75, links: [0, 2, 7, 8] },
    { slotIndex: 4, position: 'LE', label: 'ALA E', x: 12, y: 50, links: [1, 5, 9] },
    { slotIndex: 5, position: 'MC', label: 'MC', x: 34, y: 50, links: [1, 4, 6, 9] },
    { slotIndex: 6, position: 'VOL', label: 'VOL', x: 50, y: 57, links: [2, 5, 7] },
    { slotIndex: 7, position: 'MEI', label: 'MEI', x: 66, y: 47, links: [3, 6, 8, 10] },
    { slotIndex: 8, position: 'LD', label: 'ALA D', x: 88, y: 50, links: [3, 7, 10] },
    { slotIndex: 9, position: 'ATA', label: 'ATA', x: 38, y: 20, links: [4, 5, 10] },
    { slotIndex: 10, position: 'ATA', label: 'ATA', x: 62, y: 20, links: [7, 8, 9] },
  ],
  '5-3-2': [
    { slotIndex: 0, position: 'GOL', label: 'GOL', x: 50, y: 90, links: [2, 3, 4] },
    { slotIndex: 1, position: 'LE', label: 'LE', x: 12, y: 67, links: [2, 6] },
    { slotIndex: 2, position: 'ZAG', label: 'ZAG', x: 31, y: 76, links: [0, 1, 3, 6] },
    { slotIndex: 3, position: 'ZAG', label: 'ZAG', x: 50, y: 78, links: [0, 2, 4, 7] },
    { slotIndex: 4, position: 'ZAG', label: 'ZAG', x: 69, y: 76, links: [0, 3, 5, 8] },
    { slotIndex: 5, position: 'LD', label: 'LD', x: 88, y: 67, links: [4, 8] },
    { slotIndex: 6, position: 'MC', label: 'MC', x: 30, y: 49, links: [1, 2, 7, 9] },
    { slotIndex: 7, position: 'VOL', label: 'VOL', x: 50, y: 54, links: [3, 6, 8] },
    { slotIndex: 8, position: 'MC', label: 'MC', x: 70, y: 49, links: [4, 5, 7, 10] },
    { slotIndex: 9, position: 'ATA', label: 'ATA', x: 38, y: 21, links: [6, 10] },
    { slotIndex: 10, position: 'ATA', label: 'ATA', x: 62, y: 21, links: [8, 9] },
  ],
  '4-1-4-1': [
    { slotIndex: 0, position: 'GOL', label: 'GOL', x: 50, y: 90, links: [2, 3] },
    { slotIndex: 1, position: 'LE', label: 'LE', x: 14, y: 74, links: [2, 6] },
    { slotIndex: 2, position: 'ZAG', label: 'ZAG', x: 37, y: 77, links: [0, 1, 3, 5] },
    { slotIndex: 3, position: 'ZAG', label: 'ZAG', x: 63, y: 77, links: [0, 2, 4, 5] },
    { slotIndex: 4, position: 'LD', label: 'LD', x: 86, y: 74, links: [3, 9] },
    { slotIndex: 5, position: 'VOL', label: 'VOL', x: 50, y: 61, links: [2, 3, 7, 8] },
    { slotIndex: 6, position: 'PE', label: 'ME', x: 15, y: 42, links: [1, 7, 10] },
    { slotIndex: 7, position: 'MC', label: 'MC', x: 38, y: 44, links: [5, 6, 8, 10] },
    { slotIndex: 8, position: 'MEI', label: 'MEI', x: 62, y: 44, links: [5, 7, 9, 10] },
    { slotIndex: 9, position: 'PD', label: 'MD', x: 85, y: 42, links: [4, 8, 10] },
    { slotIndex: 10, position: 'ATA', label: 'ATA', x: 50, y: 18, links: [6, 7, 8, 9] },
  ],
  '3-4-3': [
    { slotIndex: 0, position: 'GOL', label: 'GOL', x: 50, y: 90, links: [1, 2, 3] },
    { slotIndex: 1, position: 'ZAG', label: 'ZAG', x: 24, y: 75, links: [0, 2, 4, 5] },
    { slotIndex: 2, position: 'ZAG', label: 'ZAG', x: 50, y: 77, links: [0, 1, 3, 5, 6] },
    { slotIndex: 3, position: 'ZAG', label: 'ZAG', x: 76, y: 75, links: [0, 2, 6, 7] },
    { slotIndex: 4, position: 'LE', label: 'ALA E', x: 13, y: 49, links: [1, 5, 8] },
    { slotIndex: 5, position: 'VOL', label: 'VOL', x: 38, y: 51, links: [1, 2, 4, 6, 9] },
    { slotIndex: 6, position: 'MC', label: 'MC', x: 62, y: 51, links: [2, 3, 5, 7, 9] },
    { slotIndex: 7, position: 'LD', label: 'ALA D', x: 87, y: 49, links: [3, 6, 10] },
    { slotIndex: 8, position: 'PE', label: 'PE', x: 20, y: 23, links: [4, 5, 9] },
    { slotIndex: 9, position: 'ATA', label: 'ATA', x: 50, y: 17, links: [5, 6, 8, 10] },
    { slotIndex: 10, position: 'PD', label: 'PD', x: 80, y: 23, links: [6, 7, 9] },
  ],
};

export const ROLE_EXPECTED_START_RATIO: Record<ContractRole, number> = {
  'Titular fixo': 0.82,
  'Titular rotativo': 0.55,
  Volátil: 0.35,
  Reserva: 0.15,
  'Jovem promessa': 0.22,
};

export const ROLE_DESCRIPTIONS: Record<ContractRole, string> = {
  'Titular fixo': 'Espera ser titular na grande maioria dos jogos. Fica muito insatisfeito no banco.',
  'Titular rotativo': 'Espera jogar regularmente, aceitando rodízio em algumas partidas.',
  Volátil: 'Alterna entre titular e reserva conforme forma física, desempenho e tática.',
  Reserva: 'Aceita participação reduzida e entrar no segundo tempo sem reclamar.',
  'Jovem promessa': 'Valoriza treinos, evolução técnica e oportunidades graduais no time principal.',
};

export const NATIONALITY_LANGUAGES: Record<string, string> = {
  Brasil: 'Português',
  Portugal: 'Português',
  Argentina: 'Espanhol',
  Uruguai: 'Espanhol',
  Colômbia: 'Espanhol',
  Chile: 'Espanhol',
  Paraguai: 'Espanhol',
  Equador: 'Espanhol',
  Espanha: 'Espanhol',
  França: 'Francês',
  Inglaterra: 'Inglês',
  Alemanha: 'Alemão',
  Itália: 'Italiano',
  Holanda: 'Holandês',
  Japão: 'Japonês',
  Nigéria: 'Inglês',
};

export const INJURY_CATALOG: {
  type: string;
  severity: 'Leve' | 'Moderada' | 'Grave' | 'Muito Grave';
  minDays: number;
  maxDays: number;
}[] = [
  { type: 'Contusão na Panturrilha', severity: 'Leve', minDays: 4, maxDays: 9 },
  { type: 'Estiramento Muscular Grau I', severity: 'Leve', minDays: 7, maxDays: 14 },
  { type: 'Entorse Leve no Tornozelo', severity: 'Leve', minDays: 6, maxDays: 12 },
  { type: 'Lesão no Posterior da Coxa', severity: 'Moderada', minDays: 16, maxDays: 28 },
  { type: 'Lesão no Adutor', severity: 'Moderada', minDays: 14, maxDays: 25 },
  { type: 'Luxação no Ombro', severity: 'Moderada', minDays: 18, maxDays: 32 },
  { type: 'Fratura no Metatarso', severity: 'Grave', minDays: 40, maxDays: 65 },
  { type: 'Ruptura Parcial de Menisco', severity: 'Grave', minDays: 38, maxDays: 60 },
  { type: 'Ruptura de Ligamento Cruzado (LCA)', severity: 'Muito Grave', minDays: 95, maxDays: 140 },
];

export interface StadiumUpgradeSpec {
  category: StadiumUpgradeCategory;
  name: string;
  maxLevel: number;
  baseCost: number;
  costMultiplier: number;
  baseDays: number;
  capacityPerLevel: number;
  homeFactorPerLevel: number;
  maintenanceAdd: number;
  description: string;
}

export const STADIUM_UPGRADES: StadiumUpgradeSpec[] = [
  {
    category: 'arquibancadas',
    name: 'Expansão das Arquibancadas',
    maxLevel: 5,
    baseCost: 8_500_000,
    costMultiplier: 1.55,
    baseDays: 35,
    capacityPerLevel: 11000,
    homeFactorPerLevel: 2,
    maintenanceAdd: 85_000,
    description: 'Constrói novos anéis de arquibancada, aumentando fortemente a capacidade e a pressão da torcida.',
  },
  {
    category: 'cobertura',
    name: 'Cobertura Acústica',
    maxLevel: 4,
    baseCost: 5_200_000,
    costMultiplier: 1.45,
    baseDays: 28,
    capacityPerLevel: 1500,
    homeFactorPerLevel: 2,
    maintenanceAdd: 45_000,
    description: 'Cobre setores do estádio, amplifica o som da torcida e eleva a ocupação em dias de chuva.',
  },
  {
    category: 'iluminacao',
    name: 'Sistema de Iluminação LED',
    maxLevel: 4,
    baseCost: 3_400_000,
    costMultiplier: 1.4,
    baseDays: 18,
    capacityPerLevel: 0,
    homeFactorPerLevel: 1,
    maintenanceAdd: 30_000,
    description: 'Torres de LED de padrão internacional para jogos noturnos, transmissões e atmosfera.',
  },
  {
    category: 'vip',
    name: 'Setores VIP e Camarotes',
    maxLevel: 4,
    baseCost: 6_800_000,
    costMultiplier: 1.5,
    baseDays: 30,
    capacityPerLevel: 2200,
    homeFactorPerLevel: 1,
    maintenanceAdd: 60_000,
    description: 'Camarotes de vidro e áreas corporativas que multiplicam a receita de bilheteria.',
  },
  {
    category: 'infraestrutura',
    name: 'Infraestrutura e Gramado',
    maxLevel: 5,
    baseCost: 4_500_000,
    costMultiplier: 1.4,
    baseDays: 24,
    capacityPerLevel: 800,
    homeFactorPerLevel: 1,
    maintenanceAdd: 50_000,
    description: 'Gramado híbrido, vestiários modernos e acessos rápidos que reduzem lesões e melhoram o jogo.',
  },
  {
    category: 'modernizacao',
    name: 'Modernização e Placar 4K',
    maxLevel: 4,
    baseCost: 4_900_000,
    costMultiplier: 1.45,
    baseDays: 22,
    capacityPerLevel: 500,
    homeFactorPerLevel: 1,
    maintenanceAdd: 40_000,
    description: 'Telões eletrônicos em alta definição, Wi-Fi de arena e experiência premium que elevam popularidade.',
  },
];

export const TRAINING_DESCRIPTIONS: Record<
  TrainingType,
  { label: string; description: string; targetSummary: string; fatigueBase: number; injuryBase: number }
> = {
  Individual: {
    label: 'Treinamento Individual',
    description: 'Sessões personalizadas voltadas ao foco individual configurado em cada atleta.',
    targetSummary: 'Foco específico por jogador + Desenvolvimento',
    fatigueBase: 7,
    injuryBase: 0.012,
  },
  Coletivo: {
    label: 'Treinamento Coletivo',
    description: 'Jogos-treino em campo reduzido que aumentam química, entrosamento e ritmo de jogo.',
    targetSummary: 'Química, Entrosamento Tático, Trabalho em Equipe',
    fatigueBase: 9,
    injuryBase: 0.016,
  },
  Físico: {
    label: 'Treinamento Físico',
    description: 'Potência muscular, sprints e resistência aeróbica de alta carga.',
    targetSummary: 'Velocidade, Aceleração, Força, Resistência, Agilidade',
    fatigueBase: 14,
    injuryBase: 0.03,
  },
  Técnico: {
    label: 'Treinamento Técnico',
    description: 'Fundamentos com bola: passes sob pressão, domínio orientado e dribles curtos.',
    targetSummary: 'Passe Curto/Longo, Drible, Controle de Bola, Técnica',
    fatigueBase: 8,
    injuryBase: 0.014,
  },
  Tático: {
    label: 'Treinamento Tático',
    description: 'Compactação de linhas, transições ofensivas/defensivas e leitura de espaço.',
    targetSummary: 'Inteligência Tática, Visão, Posicionamento, Entrosamento',
    fatigueBase: 6,
    injuryBase: 0.008,
  },
  Mental: {
    label: 'Treinamento Mental',
    description: 'Tomada de decisão sob pressão, foco competitivo, liderança e confiança.',
    targetSummary: 'Concentração, Decisão, Compostura, Determinação, Moral',
    fatigueBase: 4,
    injuryBase: 0.004,
  },
  Finalização: {
    label: 'Treinamento de Finalização',
    description: 'Chutes de média distância, bola parada, cabeceio e duelo contra os goleiros.',
    targetSummary: 'Finalização, Cabeceio, Bola Parada, Reflexos (GOL)',
    fatigueBase: 9,
    injuryBase: 0.017,
  },
  Defensivo: {
    label: 'Treinamento Defensivo',
    description: 'Cobertura defensiva, botes limpos, bola aérea e organização da última linha.',
    targetSummary: 'Marcação, Desarme, Antecipação, Jogo Aéreo (GOL)',
    fatigueBase: 10,
    injuryBase: 0.02,
  },
  'Recuperação Física': {
    label: 'Recuperação Física',
    description: 'Regenerativo, crioterapia e soltura muscular para zerar fadiga e prevenir lesões.',
    targetSummary: 'Reduz Fadiga (-22), Eleva Condicionamento (+12), Baixo Risco',
    fatigueBase: -22,
    injuryBase: 0.001,
  },
};

// Utilitários de data YYYY-MM-DD em UTC para evitar problemas de fuso horário
export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function diffDays(startStr: string, endStr: string): number {
  const [y1, m1, d1] = startStr.split('-').map(Number);
  const [y2, m2, d2] = endStr.split('-').map(Number);
  const t1 = Date.UTC(y1, m1 - 1, d1);
  const t2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((t2 - t1) / 86_400_000);
}

export function formatDateBR(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

export function formatCurrency(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000) {
    return `${sign}R$ ${(abs / 1_000_000).toFixed(2).replace('.', ',')} mi`;
  }
  if (abs >= 1_000) {
    return `${sign}R$ ${Math.round(abs).toLocaleString('pt-BR')}`;
  }
  return `${sign}R$ ${Math.round(abs)}`;
}

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function isTransferWindowOpen(dateStr: string): {
  open: boolean;
  label: string;
  nextOpenDate: string;
  closeDate: string;
} {
  const [year, month] = dateStr.split('-').map(Number);
  // Janela 1: Janeiro e Fevereiro (01-01 a 02-28)
  // Janela 2: Julho e Agosto (07-01 a 08-31)
  if (month === 1 || month === 2) {
    return {
      open: true,
      label: 'Janela de Início de Temporada (Aberta)',
      nextOpenDate: `${year}-07-01`,
      closeDate: `${year}-02-28`,
    };
  }
  if (month === 7 || month === 8) {
    return {
      open: true,
      label: 'Janela de Meio de Temporada (Aberta)',
      nextOpenDate: `${year + 1}-01-01`,
      closeDate: `${year}-08-31`,
    };
  }
  const nextOpen = month < 7 ? `${year}-07-01` : `${year + 1}-01-01`;
  return {
    open: false,
    label: 'Janela Fechada (Apenas Pré-Acordos Futuros)',
    nextOpenDate: nextOpen,
    closeDate: nextOpen,
  };
}
