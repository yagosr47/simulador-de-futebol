import {
  Club,
  ClubPhilosophy,
  CoachSpecialty,
  CoachStaff,
  ContractRole,
  FormationName,
  GameState,
  MedicalSpecialty,
  MedicalStaff,
  Player,
  PlayerPersonality,
  PlayStyle,
  Position,
  SponsorshipDeal,
} from '../types/game';
import { addDays, clamp, NATIONALITY_LANGUAGES, ROLE_EXPECTED_START_RATIO } from './constants';
import { autoSelectBestLineup, calculateBaseOverall } from './overall';
import { calculateFairMonthlySalary, calculateMarketValue } from './development';
import { generateCupCompetition, generateLeagueCompetition, rebuildCalendarEvents } from './calendar';
import { createPlayerAuction } from './auctions';
import { generateInjury } from './infirmary';

// PRNG determinístico opcional para testes reproduzíveis
export function createSeededRng(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export interface ClubPreset {
  id: string;
  name: string;
  shortName: string;
  city: string;
  primaryColor: string;
  secondaryColor: string;
  reputation: number;
  popularity: number;
  balance: number;
  transferBudget: number;
  philosophy: ClubPhilosophy;
  formation: FormationName;
  playStyle: PlayStyle;
  stadiumName: string;
  stadiumCapacity: number;
  standsLevel: number;
  roofLevel: number;
  lightingLevel: number;
  vipLevel: number;
  infraLevel: number;
  modLevel: number;
  managerName: string;
  titles: { league: number; cup: number; continental: number };
}

export const CLUB_PRESETS: ClubPreset[] = [
  {
    id: 'rubro-rio',
    name: 'Atlético Guanabara FC',
    shortName: 'GUA',
    city: 'Rio de Janeiro',
    primaryColor: '#dc2626',
    secondaryColor: '#111827',
    reputation: 86,
    popularity: 94,
    balance: 62_000_000,
    transferBudget: 36_000_000,
    philosophy: 'Galácticos',
    formation: '4-2-3-1',
    playStyle: 'Posse de Bola',
    stadiumName: 'Arena Baía Imperial',
    stadiumCapacity: 58000,
    standsLevel: 4,
    roofLevel: 3,
    lightingLevel: 3,
    vipLevel: 3,
    infraLevel: 4,
    modLevel: 3,
    managerName: 'Filipe Moura',
    titles: { league: 7, cup: 4, continental: 3 },
  },
  {
    id: 'palestra-sp',
    name: 'Sociedade Esportiva Palestra',
    shortName: 'PAL',
    city: 'São Paulo',
    primaryColor: '#059669',
    secondaryColor: '#f8fafc',
    reputation: 87,
    popularity: 90,
    balance: 68_000_000,
    transferBudget: 40_000_000,
    philosophy: 'Equilibrado',
    formation: '4-3-3',
    playStyle: 'Pressão Alta',
    stadiumName: 'Estádio Parque Esmeralda',
    stadiumCapacity: 46000,
    standsLevel: 3,
    roofLevel: 3,
    lightingLevel: 4,
    vipLevel: 3,
    infraLevel: 4,
    modLevel: 4,
    managerName: 'Abelardo Tavares',
    titles: { league: 10, cup: 4, continental: 3 },
  },
  {
    id: 'soberano-sp',
    name: 'Tricolor Paulista FC',
    shortName: 'TRI',
    city: 'São Paulo',
    primaryColor: '#ef4444',
    secondaryColor: '#ffffff',
    reputation: 82,
    popularity: 88,
    balance: 44_000_000,
    transferBudget: 24_000_000,
    philosophy: 'Equilibrado',
    formation: '4-2-3-1',
    playStyle: 'Tático Equilibrado',
    stadiumName: 'Estádio Morumbi Sul',
    stadiumCapacity: 54000,
    standsLevel: 4,
    roofLevel: 2,
    lightingLevel: 3,
    vipLevel: 2,
    infraLevel: 3,
    modLevel: 2,
    managerName: 'Luis Cabrera',
    titles: { league: 6, cup: 2, continental: 3 },
  },
  {
    id: 'estrela-rio',
    name: 'Estrela Solitária FC',
    shortName: 'EST',
    city: 'Rio de Janeiro',
    primaryColor: '#1f2937',
    secondaryColor: '#f8fafc',
    reputation: 83,
    popularity: 81,
    balance: 54_000_000,
    transferBudget: 32_000_000,
    philosophy: 'Ataque Total',
    formation: '4-3-3',
    playStyle: 'Contra-Ataque',
    stadiumName: 'Arena Engenho Novo',
    stadiumCapacity: 44000,
    standsLevel: 3,
    roofLevel: 2,
    lightingLevel: 3,
    vipLevel: 2,
    infraLevel: 3,
    modLevel: 3,
    managerName: 'Artur Monteiro',
    titles: { league: 3, cup: 1, continental: 1 },
  },
  {
    id: 'galo-mg',
    name: 'Clube Atlético Mineiro Sul',
    shortName: 'AMS',
    city: 'Belo Horizonte',
    primaryColor: '#0f172a',
    secondaryColor: '#e2e8f0',
    reputation: 81,
    popularity: 83,
    balance: 42_000_000,
    transferBudget: 25_000_000,
    philosophy: 'Ataque Total',
    formation: '3-4-3',
    playStyle: 'Pressão Alta',
    stadiumName: 'Arena Serra Dourada',
    stadiumCapacity: 46000,
    standsLevel: 3,
    roofLevel: 3,
    lightingLevel: 3,
    vipLevel: 3,
    infraLevel: 3,
    modLevel: 3,
    managerName: 'Gabriel Ferraz',
    titles: { league: 3, cup: 2, continental: 1 },
  },
  {
    id: 'celeste-mg',
    name: 'Cruzeiro Real Celeste',
    shortName: 'CRC',
    city: 'Belo Horizonte',
    primaryColor: '#2563eb',
    secondaryColor: '#ffffff',
    reputation: 80,
    popularity: 84,
    balance: 46_000_000,
    transferBudget: 27_000_000,
    philosophy: 'Equilibrado',
    formation: '4-3-3',
    playStyle: 'Posse de Bola',
    stadiumName: 'Estádio Pampulha Real',
    stadiumCapacity: 52000,
    standsLevel: 4,
    roofLevel: 2,
    lightingLevel: 3,
    vipLevel: 2,
    infraLevel: 3,
    modLevel: 2,
    managerName: 'Leonardo Jardim',
    titles: { league: 4, cup: 6, continental: 2 },
  },
  {
    id: 'colorado-rs',
    name: 'Internacional dos Pampas',
    shortName: 'INP',
    city: 'Porto Alegre',
    primaryColor: '#b91c1c',
    secondaryColor: '#ffffff',
    reputation: 80,
    popularity: 82,
    balance: 39_000_000,
    transferBudget: 22_000_000,
    philosophy: 'Equilibrado',
    formation: '4-2-3-1',
    playStyle: 'Posse de Bola',
    stadiumName: 'Arena Beira Lago',
    stadiumCapacity: 48000,
    standsLevel: 3,
    roofLevel: 3,
    lightingLevel: 3,
    vipLevel: 2,
    infraLevel: 3,
    modLevel: 3,
    managerName: 'Roger Machado',
    titles: { league: 3, cup: 1, continental: 2 },
  },
  {
    id: 'imortal-rs',
    name: 'Grêmio Tricolor Gaúcho',
    shortName: 'GTG',
    city: 'Porto Alegre',
    primaryColor: '#0284c7',
    secondaryColor: '#0f172a',
    reputation: 79,
    popularity: 83,
    balance: 36_000_000,
    transferBudget: 20_000_000,
    philosophy: 'Retranca Tática',
    formation: '4-4-2',
    playStyle: 'Contra-Ataque',
    stadiumName: 'Arena do Guaíba',
    stadiumCapacity: 50000,
    standsLevel: 4,
    roofLevel: 3,
    lightingLevel: 3,
    vipLevel: 2,
    infraLevel: 3,
    modLevel: 3,
    managerName: 'Gustavo Quinteros',
    titles: { league: 2, cup: 5, continental: 3 },
  },
  {
    id: 'timao-sp',
    name: 'Sport Club Alvinegro',
    shortName: 'SCA',
    city: 'São Paulo',
    primaryColor: '#18181b',
    secondaryColor: '#fafafa',
    reputation: 80,
    popularity: 92,
    balance: 38_000_000,
    transferBudget: 21_000_000,
    philosophy: 'Galácticos',
    formation: '4-1-4-1',
    playStyle: 'Contra-Ataque',
    stadiumName: 'Arena Leste Paulista',
    stadiumCapacity: 49000,
    standsLevel: 3,
    roofLevel: 3,
    lightingLevel: 4,
    vipLevel: 3,
    infraLevel: 3,
    modLevel: 3,
    managerName: 'Ramón Díaz',
    titles: { league: 7, cup: 3, continental: 1 },
  },
  {
    id: 'tricolor-ba',
    name: 'Esporte Clube Baía Azul',
    shortName: 'BAA',
    city: 'Salvador',
    primaryColor: '#1d4ed8',
    secondaryColor: '#dc2626',
    reputation: 77,
    popularity: 80,
    balance: 48_000_000,
    transferBudget: 28_000_000,
    philosophy: 'Base e Jovens',
    formation: '4-3-3',
    playStyle: 'Posse de Bola',
    stadiumName: 'Arena Fonte do Sol',
    stadiumCapacity: 44000,
    standsLevel: 3,
    roofLevel: 2,
    lightingLevel: 3,
    vipLevel: 2,
    infraLevel: 3,
    modLevel: 3,
    managerName: 'Rogério Ceni',
    titles: { league: 2, cup: 0, continental: 0 },
  },
  {
    id: 'leao-ce',
    name: 'Fortaleza do Nordeste EC',
    shortName: 'FNE',
    city: 'Fortaleza',
    primaryColor: '#2563eb',
    secondaryColor: '#ef4444',
    reputation: 77,
    popularity: 78,
    balance: 34_000_000,
    transferBudget: 19_000_000,
    philosophy: 'Equilibrado',
    formation: '3-5-2',
    playStyle: 'Contra-Ataque',
    stadiumName: 'Arena Castelão Norte',
    stadiumCapacity: 46000,
    standsLevel: 3,
    roofLevel: 2,
    lightingLevel: 2,
    vipLevel: 2,
    infraLevel: 3,
    modLevel: 2,
    managerName: 'Juan Vojvoda',
    titles: { league: 0, cup: 1, continental: 0 },
  },
  {
    id: 'furacao-pr',
    name: 'Atlético Araucária PR',
    shortName: 'AAP',
    city: 'Curitiba',
    primaryColor: '#991b1b',
    secondaryColor: '#111827',
    reputation: 76,
    popularity: 73,
    balance: 35_000_000,
    transferBudget: 19_500_000,
    philosophy: 'Base e Jovens',
    formation: '4-2-3-1',
    playStyle: 'Pressão Alta',
    stadiumName: 'Arena dos Pinheiros',
    stadiumCapacity: 41000,
    standsLevel: 3,
    roofLevel: 3,
    lightingLevel: 3,
    vipLevel: 2,
    infraLevel: 4,
    modLevel: 3,
    managerName: 'Maurício Barbieri',
    titles: { league: 1, cup: 1, continental: 2 },
  },
  {
    id: 'praiano-sp',
    name: 'Santos Litoral FC',
    shortName: 'SLF',
    city: 'Santos',
    primaryColor: '#f8fafc',
    secondaryColor: '#0f172a',
    reputation: 76,
    popularity: 81,
    balance: 30_000_000,
    transferBudget: 16_500_000,
    philosophy: 'Base e Jovens',
    formation: '4-3-3',
    playStyle: 'Ataque Total' as unknown as PlayStyle,
    stadiumName: 'Vila Oceânica',
    stadiumCapacity: 26000,
    standsLevel: 2,
    roofLevel: 1,
    lightingLevel: 2,
    vipLevel: 1,
    infraLevel: 3,
    modLevel: 2,
    managerName: 'Pedro Caixinha',
    titles: { league: 8, cup: 1, continental: 3 },
  },
  {
    id: 'colina-rio',
    name: 'Almirante da Colina CR',
    shortName: 'ACC',
    city: 'Rio de Janeiro',
    primaryColor: '#111827',
    secondaryColor: '#f8fafc',
    reputation: 74,
    popularity: 79,
    balance: 27_000_000,
    transferBudget: 14_500_000,
    philosophy: 'Equilibrado',
    formation: '4-4-2',
    playStyle: 'Jogo Direto',
    stadiumName: 'Estádio São Januário Sul',
    stadiumCapacity: 28000,
    standsLevel: 2,
    roofLevel: 1,
    lightingLevel: 2,
    vipLevel: 1,
    infraLevel: 2,
    modLevel: 2,
    managerName: 'Fábio Carille',
    titles: { league: 4, cup: 1, continental: 1 },
  },
  {
    id: 'triangulo-mg',
    name: 'Uberlândia Real EC',
    shortName: 'URE',
    city: 'Uberlândia',
    primaryColor: '#16a34a',
    secondaryColor: '#facc15',
    reputation: 71,
    popularity: 70,
    balance: 26_000_000,
    transferBudget: 15_000_000,
    philosophy: 'Base e Jovens',
    formation: '4-2-3-1',
    playStyle: 'Tático Equilibrado',
    stadiumName: 'Estádio Parque do Sabiá',
    stadiumCapacity: 32000,
    standsLevel: 2,
    roofLevel: 1,
    lightingLevel: 2,
    vipLevel: 1,
    infraLevel: 2,
    modLevel: 2,
    managerName: 'Thiago Oliveira',
    titles: { league: 0, cup: 0, continental: 0 },
  },
  {
    id: 'serra-sp',
    name: 'Bragança Paulista FC',
    shortName: 'BPF',
    city: 'Bragança Paulista',
    primaryColor: '#e11d48',
    secondaryColor: '#f8fafc',
    reputation: 73,
    popularity: 66,
    balance: 37_000_000,
    transferBudget: 21_000_000,
    philosophy: 'Base e Jovens',
    formation: '4-3-3',
    playStyle: 'Pressão Alta',
    stadiumName: 'Estádio Nabi Arena',
    stadiumCapacity: 22000,
    standsLevel: 2,
    roofLevel: 1,
    lightingLevel: 2,
    vipLevel: 1,
    infraLevel: 4,
    modLevel: 2,
    managerName: 'Fernando Seabra',
    titles: { league: 0, cup: 0, continental: 0 },
  },
];

// Corrigir playStyle do praiano-sp para tipo válido
CLUB_PRESETS[12].playStyle = 'Posse de Bola';

const FIRST_NAMES_BR = [
  'Gabriel', 'Lucas', 'Matheus', 'Pedro', 'Rafael', 'Bruno', 'Felipe', 'Gustavo', 'Vinícius', 'Rodrigo',
  'Eduardo', 'Thiago', 'Danilo', 'Igor', 'Caio', 'André', 'Diego', 'Henrique', 'Leonardo', 'Murilo',
  'Cauã', 'João Pedro', 'Luiz Henrique', 'Marcos', 'Renan', 'Samuel', 'Vitor', 'Yuri', 'Breno', 'César',
  'Everton', 'Gerson', 'Luan', 'Paulinho', 'Rony', 'Sérgio', 'Wesley', 'Zé Rafael', 'Fábio', 'Weverton',
];
const LAST_NAMES_BR = [
  'Silva', 'Santos', 'Barbosa', 'Oliveira', 'Pereira', 'Costa', 'Almeida', 'Ferreira', 'Rocha', 'Ribeiro',
  'Carvalho', 'Gomes', 'Martins', 'Araújo', 'Mendes', 'Teixeira', 'Nunes', 'Moreira', 'Cardoso', 'Melo',
  'Freitas', 'Dias', 'Monteiro', 'Castro', 'Duarte', 'Pinto', 'Azevedo', 'Machado', 'Batista', 'Nogueira',
  'Guimarães', 'Cavalcanti', 'Soares', 'Correia', 'Vieira', 'Lopes', 'Campos', 'Borges', 'Ramos', 'Tavares',
];
const FOREIGN_NAMES: { nat: string; first: string[]; last: string[] }[] = [
  {
    nat: 'Argentina',
    first: ['Mateo', 'Julián', 'Enzo', 'Lautaro', 'Franco', 'Thiago', 'Nicolás', 'Agustín', 'Lucas', 'Emiliano'],
    last: ['Almada', 'Gómez', 'Fernández', 'Martínez', 'Romero', 'Sosa', 'Paredes', 'Acuña', 'López', 'Díaz'],
  },
  {
    nat: 'Uruguai',
    first: ['Federico', 'Darwin', 'Giorgian', 'Nicolás', 'Sebastián', 'Facundo', 'Rodrigo', 'Mathías'],
    last: ['Valverde', 'De la Cruz', 'Pellistri', 'Bentancur', 'Giménez', 'Arrascaeta', 'Canobbio', 'Viña'],
  },
  {
    nat: 'Colômbia',
    first: ['James', 'Luis', 'Richard', 'Jhon', 'Rafael', 'Mateo', 'Daniel', 'Yerry'],
    last: ['Ríos', 'Arias', 'Borré', 'Mina', 'Muñoz', 'Castaño', 'Durán', 'Quintero'],
  },
  {
    nat: 'Portugal',
    first: ['Diogo', 'João', 'Rafael', 'Gonçalo', 'Bruno', 'Vitinha', 'Pedro'],
    last: ['Mendes', 'Ferreira', 'Silva', 'Neves', 'Guedes', 'Neto', 'Costa'],
  },
  {
    nat: 'Paraguai',
    first: ['Gustavo', 'Miguel', 'Ángel', 'Julio', 'Ramón'],
    last: ['Gómez', 'Almirón', 'Romero', 'Enciso', 'Sosa'],
  },
  {
    nat: 'Equador',
    first: ['Moisés', 'Piero', 'Gonzalo', 'Kendry', 'Enner'],
    last: ['Caicedo', 'Hincapié', 'Plata', 'Páez', 'Valencia'],
  },
];

const SQUAD_BLUEPRINT: { pos: Position; sec?: Position; starter: boolean; ageBand: 'young' | 'prime' | 'vet' }[] = [
  { pos: 'GOL', starter: true, ageBand: 'prime' },
  { pos: 'GOL', starter: false, ageBand: 'young' },
  { pos: 'ZAG', starter: true, ageBand: 'prime' },
  { pos: 'ZAG', starter: true, ageBand: 'vet' },
  { pos: 'ZAG', sec: 'VOL', starter: false, ageBand: 'prime' },
  { pos: 'ZAG', starter: false, ageBand: 'young' },
  { pos: 'LD', sec: 'PD', starter: true, ageBand: 'prime' },
  { pos: 'LD', sec: 'LE', starter: false, ageBand: 'young' },
  { pos: 'LE', sec: 'PE', starter: true, ageBand: 'prime' },
  { pos: 'LE', starter: false, ageBand: 'vet' },
  { pos: 'VOL', sec: 'ZAG', starter: true, ageBand: 'prime' },
  { pos: 'VOL', sec: 'MC', starter: false, ageBand: 'young' },
  { pos: 'MC', sec: 'VOL', starter: true, ageBand: 'prime' },
  { pos: 'MC', sec: 'MEI', starter: true, ageBand: 'young' },
  { pos: 'MC', starter: false, ageBand: 'vet' },
  { pos: 'MEI', sec: 'PD', starter: true, ageBand: 'prime' },
  { pos: 'MEI', sec: 'MC', starter: false, ageBand: 'young' },
  { pos: 'PD', sec: 'PE', starter: true, ageBand: 'prime' },
  { pos: 'PD', sec: 'ATA', starter: false, ageBand: 'young' },
  { pos: 'PE', sec: 'PD', starter: true, ageBand: 'prime' },
  { pos: 'ATA', sec: 'PD', starter: true, ageBand: 'prime' },
  { pos: 'ATA', starter: false, ageBand: 'young' },
];

const PERSONALITIES: PlayerPersonality[] = [
  'Profissional',
  'Ambicioso',
  'Leal',
  'Líder Nato',
  'Temperamental',
  'Mercenário',
  'Resiliente',
  'Acomodado',
];

const PLAY_STYLES: PlayStyle[] = [
  'Posse de Bola',
  'Contra-Ataque',
  'Pressão Alta',
  'Jogo Direto',
  'Tático Equilibrado',
];

function generatePlayer(
  club: ClubPreset,
  slot: (typeof SQUAD_BLUEPRINT)[number],
  index: number,
  season: number,
  currentDate: string,
  rng: () => number,
): Player {
  const isForeign = rng() < 0.24;
  let fullName = '';
  let shortName = '';
  let nationality = 'Brasil';

  if (isForeign) {
    const group = FOREIGN_NAMES[Math.floor(rng() * FOREIGN_NAMES.length)];
    nationality = group.nat;
    const f = group.first[Math.floor(rng() * group.first.length)];
    const l = group.last[Math.floor(rng() * group.last.length)];
    fullName = `${f} ${l}`;
    shortName = `${f} ${l}`;
  } else {
    const f = FIRST_NAMES_BR[Math.floor(rng() * FIRST_NAMES_BR.length)];
    const l1 = LAST_NAMES_BR[Math.floor(rng() * LAST_NAMES_BR.length)];
    const l2 = LAST_NAMES_BR[Math.floor(rng() * LAST_NAMES_BR.length)];
    fullName = l1 === l2 ? `${f} ${l1}` : `${f} ${l1} ${l2}`;
    shortName = `${f} ${l1}`;
  }

  const age =
    slot.ageBand === 'young'
      ? 18 + Math.floor(rng() * 5) // 18-22
      : slot.ageBand === 'prime'
        ? 23 + Math.floor(rng() * 7) // 23-29
        : 30 + Math.floor(rng() * 6); // 30-35

  const peakAge = clamp(25 + Math.floor(rng() * 5), 25, 30);

  // Nível base vinculado à reputação do clube + titularidade
  const tierBase = club.reputation - (slot.starter ? 4 : 11) + (rng() * 8 - 3);
  const agePenalty = age <= 20 ? -5 : age >= 33 ? -3 : 0;
  const targetOvr = clamp(Math.round(tierBase + agePenalty), 58, 89);

  const potential =
    age <= 21
      ? clamp(targetOvr + 7 + Math.floor(rng() * 14), targetOvr + 4, 94)
      : age <= 25
        ? clamp(targetOvr + 2 + Math.floor(rng() * 7), targetOvr, 92)
        : targetOvr;

  const r = (boost: number) => clamp(Math.round(targetOvr + boost + (rng() * 12 - 6)), 28, 96);
  const pos = slot.pos;
  const isGK = pos === 'GOL';
  const isCB = pos === 'ZAG';
  const isFB = pos === 'LD' || pos === 'LE';
  const isDM = pos === 'VOL';
  const isCM = pos === 'MC';
  const isAM = pos === 'MEI';
  const isW = pos === 'PD' || pos === 'PE';
  const isST = pos === 'ATA';

  const role: ContractRole = slot.starter
    ? rng() < 0.72
      ? 'Titular fixo'
      : 'Titular rotativo'
    : age <= 21
      ? 'Jovem promessa'
      : rng() < 0.45
        ? 'Volátil'
        : 'Reserva';

  const yearsRemaining = 1 + Math.floor(rng() * 4);
  const prevMatches = Math.max(0, (age - 18) * 26 + Math.floor(rng() * 20));
  const prevGoals = isGK
    ? 0
    : isST
      ? Math.round(prevMatches * (0.28 + rng() * 0.2))
      : isW || isAM
        ? Math.round(prevMatches * (0.14 + rng() * 0.12))
        : Math.round(prevMatches * (0.03 + rng() * 0.05));
  const prevAssists = isGK
    ? 0
    : isAM || isW || isCM
      ? Math.round(prevMatches * (0.13 + rng() * 0.1))
      : Math.round(prevMatches * (0.04 + rng() * 0.05));

  const id = `p-${club.id}-${index}`;

  const player: Player = {
    id,
    fullName,
    shortName,
    age,
    nationality,
    language: NATIONALITY_LANGUAGES[nationality] ?? 'Português',
    primaryPosition: pos,
    secondaryPosition: slot.sec,
    heightCm: isGK ? 188 + Math.floor(rng() * 9) : isCB ? 183 + Math.floor(rng() * 9) : 169 + Math.floor(rng() * 17),
    weightKg: isGK || isCB ? 78 + Math.floor(rng() * 12) : 65 + Math.floor(rng() * 16),
    dominantFoot:
      pos === 'LE' ? 'Esquerdo' : rng() < 0.7 ? 'Direito' : rng() < 0.92 ? 'Esquerdo' : 'Ambidestro',
    potential,
    peakAge,
    marketValue: 1_000_000,
    personality: PERSONALITIES[Math.floor(rng() * PERSONALITIES.length)],
    clubId: club.id,
    isTransferListed: !slot.starter && rng() < 0.16,
    isLoanListed: !slot.starter && age <= 22 && rng() < 0.25,
    technical: {
      finalizacao: r(isST ? 7 : isW || isAM ? 3 : isGK ? -38 : isCB ? -18 : -8),
      passeCurto: r(isCM || isAM || isDM ? 6 : isGK ? -16 : 0),
      passeLongo: r(isCM || isDM ? 5 : isCB ? 1 : isGK ? -10 : -4),
      cruzamento: r(isFB || isW ? 7 : isAM ? 2 : isGK ? -35 : -10),
      drible: r(isW || isAM ? 7 : isST ? 2 : isGK ? -35 : isCB ? -14 : -2),
      controleBola: r(isAM || isW || isCM || isST ? 5 : isGK ? -24 : -2),
      marcacao: r(isCB || isDM ? 7 : isFB ? 4 : isGK ? -35 : isST || isW ? -22 : -6),
      desarme: r(isCB || isDM ? 7 : isFB ? 5 : isGK ? -35 : isST || isW ? -22 : -5),
      cabeceio: r(isCB || isST ? 6 : isDM ? 1 : isGK ? -28 : -8),
      posicionamento: r(isST || isCB || isGK ? 5 : 2),
      tecnica: r(isAM || isW || isCM ? 5 : isGK ? -20 : 0),
      bolaParada: r(isAM || isCM ? 5 : isGK ? -30 : -8),
      reflexos: isGK ? r(7) : r(-38),
      defesaGoleiro: isGK ? r(7) : r(-40),
      jogoAereo: isGK ? r(5) : r(-35),
    },
    physical: {
      velocidade: r(isW || isFB ? 7 : isST ? 4 : isGK ? -20 : age >= 32 ? -8 : 0),
      aceleracao: r(isW || isFB || isST ? 6 : isGK ? -18 : age >= 32 ? -8 : 0),
      forca: r(isCB || isST || isDM ? 6 : isW ? -6 : 0),
      resistencia: r(isFB || isCM || isDM ? 6 : isGK ? -14 : age >= 32 ? -6 : 2),
      agilidade: r(isW || isAM || isGK ? 5 : isCB ? -6 : 1),
      equilibrio: r(isAM || isW || isST ? 4 : 0),
      impulsao: r(isCB || isST || isGK ? 6 : -2),
    },
    mental: {
      inteligenciaTatica: r(isDM || isCM || isCB ? 5 : age >= 29 ? 6 : 0),
      visaoJogo: r(isAM || isCM ? 7 : isDM ? 3 : isGK ? -16 : -4),
      concentracao: r(isGK || isCB ? 5 : age >= 28 ? 4 : 0),
      decisao: r(isCM || isAM || isDM ? 4 : 1),
      determinacao: r(4),
      lideranca: r(age >= 29 ? 8 : -5),
      trabalhoEquipe: r(isDM || isCM || isFB ? 5 : 1),
      antecipacao: r(isCB || isDM || isGK ? 6 : 1),
      compostura: r(isST || isAM || isGK ? 5 : 1),
    },
    conditional: {
      condicionamento: clamp(Math.round(78 + rng() * 18), 70, 98),
      fadiga: clamp(Math.round(6 + rng() * 18), 4, 28),
      ritmoJogo: clamp(Math.round(66 + rng() * 24), 58, 95),
      moral: clamp(Math.round(68 + rng() * 22), 60, 94),
      confianca: clamp(Math.round(66 + rng() * 24), 58, 94),
      formaRecente: clamp(Math.round(62 + rng() * 22), 55, 88),
    },
    contract: {
      salary: 50_000,
      yearsRemaining,
      endDate: addDays(currentDate, yearsRemaining * 365),
      role,
      releaseClause: 10_000_000,
      expectedStartRatio: ROLE_EXPECTED_START_RATIO[role],
      recentTeamMatchesConsidered: 0,
      recentPlayerStarts: 0,
      recentPlayerAppearances: 0,
      dissatisfaction: 'Satisfeito',
      dissatisfactionPoints: 0,
      requestedTransfer: false,
      requestedRenegotiation: false,
    },
    chemistry: {
      tacticalFamiliarity: clamp(Math.round(64 + rng() * 26), 58, 92),
      playStyle: rng() < 0.55 ? club.playStyle : PLAY_STYLES[Math.floor(rng() * PLAY_STYLES.length)],
      daysAtClub: 120 + Math.floor(rng() * 900),
      matchesWithTeammates: {},
      relationships: {},
    },
    careerStats: {
      matches: prevMatches,
      starts: Math.round(prevMatches * 0.8),
      goals: prevGoals,
      assists: prevAssists,
      cleanSheets: isGK ? Math.round(prevMatches * 0.35) : 0,
      yellowCards: Math.round(prevMatches * 0.14),
      redCards: Math.round(prevMatches * 0.01),
      minutesPlayed: prevMatches * 76,
      averageRating: Number((6.4 + (targetOvr - 65) * 0.035).toFixed(2)),
      seasonMatches: 0,
      seasonStarts: 0,
      seasonGoals: 0,
      seasonAssists: 0,
      seasonYellowCards: 0,
      seasonRedCards: 0,
      seasonRatingSum: 0,
      seasonRatingCount: 0,
    },
    clubHistory: [
      {
        clubId: club.id,
        clubName: club.name,
        seasonStart: Math.max(2020, season - Math.floor(rng() * 4)),
        matches: Math.min(prevMatches, 85),
        goals: Math.min(prevGoals, 28),
        assists: Math.min(prevAssists, 20),
        avgRating: Number((6.5 + (targetOvr - 68) * 0.03).toFixed(2)),
      },
    ],
    injury: null,
    injuryProne: 4 + Math.floor(rng() * 13),
    injuryHistoryCount: age >= 28 ? Math.floor(rng() * 3) : Math.floor(rng() * 2),
    overplayStress: Math.floor(rng() * 15),
    developmentProgress: Math.floor(rng() * 60),
    returnToPlaySharpness: 100,
  };

  // Ajusta potencial, valor e salário coerentes com o overall real gerado
  const actualOvr = calculateBaseOverall(player);
  if (age <= 21) {
    player.potential = clamp(Math.max(player.potential, actualOvr + 6 + Math.floor(rng() * 8)), actualOvr + 5, 95);
  } else if (age <= 25) {
    player.potential = clamp(Math.max(player.potential, actualOvr + 2), actualOvr, 93);
  } else {
    player.potential = Math.max(player.potential, actualOvr);
  }
  player.marketValue = calculateMarketValue(player);
  player.contract.salary = calculateFairMonthlySalary(player);
  player.contract.releaseClause = Math.round(player.marketValue * 2.1);
  if (player.isTransferListed) {
    player.askingPrice = Math.round((player.marketValue * 0.92) / 50_000) * 50_000;
  }

  return player;
}

export function generateAvailableSponsors(): SponsorshipDeal[] {
  return [
    {
      id: 'sp-regional-1',
      sponsorName: 'Banco Cerrado Digital',
      tier: 'Regional',
      monthlyIncome: 1_200_000,
      titleBonus: 2_500_000,
      durationMonths: 12,
      monthsRemaining: 12,
      minReputation: 50,
    },
    {
      id: 'sp-regional-2',
      sponsorName: 'Energia Sul Brasil',
      tier: 'Regional',
      monthlyIncome: 1_650_000,
      titleBonus: 3_500_000,
      durationMonths: 12,
      monthsRemaining: 12,
      minReputation: 65,
    },
    {
      id: 'sp-nacional-1',
      sponsorName: 'Aérea Cruzeiro Linhas',
      tier: 'Nacional',
      monthlyIncome: 2_450_000,
      titleBonus: 5_500_000,
      durationMonths: 18,
      monthsRemaining: 18,
      minReputation: 72,
    },
    {
      id: 'sp-nacional-2',
      sponsorName: 'NorteTech Telecom',
      tier: 'Nacional',
      monthlyIncome: 3_100_000,
      titleBonus: 6_500_000,
      durationMonths: 18,
      monthsRemaining: 18,
      minReputation: 76,
    },
    {
      id: 'sp-continental-1',
      sponsorName: 'Aurum Motors América',
      tier: 'Continental',
      monthlyIncome: 4_200_000,
      titleBonus: 9_000_000,
      durationMonths: 24,
      monthsRemaining: 24,
      minReputation: 80,
    },
    {
      id: 'sp-global-1',
      sponsorName: 'Apex Global Airways',
      tier: 'Global',
      monthlyIncome: 5_600_000,
      titleBonus: 14_000_000,
      durationMonths: 24,
      monthsRemaining: 24,
      minReputation: 85,
    },
  ];
}

export function generateCoachPool(rng: () => number): CoachStaff[] {
  const specialties: CoachSpecialty[] = [
    'Desenvolvimento Juvenil',
    'Preparação Física',
    'Tática e Posicionamento',
    'Técnica e Finalização',
    'Organização Defensiva',
    'Psicologia e Liderança',
  ];
  const names = [
    'Carlos Alberto Parreira Jr.', 'Cláudio Caçapa', 'Maurício Copertino', 'Sidnei Lobo',
    'Paulo Paixão', 'Fábio Mahseredjian', 'Alexandre Mendes', 'Eduardo Barros',
    'Ricardo Colbachini', 'Vitor Castanheira', 'João Martins', 'Emiliano Díaz',
    'Matheus Bacchi', 'Lucas Silvestre', 'Lúcio Flávio', 'César Sampaio',
  ];

  return names.map((name, idx) => {
    const level = clamp(2 + Math.floor(rng() * 4), 2, 5);
    const quality = clamp(56 + level * 8 + Math.floor(rng() * 8), 60, 96);
    const dev = clamp(54 + level * 8 + Math.floor(rng() * 10), 58, 97);
    const salary = Math.round((45_000 + level * 42_000 + rng() * 25_000) / 5_000) * 5_000;
    return {
      id: `coach-pool-${idx}`,
      name,
      age: 35 + Math.floor(rng() * 26),
      nationality: idx % 4 === 0 ? 'Portugal' : idx % 5 === 0 ? 'Argentina' : 'Brasil',
      level,
      quality,
      developmentAbility: dev,
      specialty: specialties[idx % specialties.length],
      monthlySalary: salary,
      hiringFee: salary * 4,
    };
  });
}

export function generateMedicalPool(rng: () => number): MedicalStaff[] {
  const specialties: MedicalSpecialty[] = [
    'Fisioterapia Esportiva',
    'Ortopedia e Trauma',
    'Prevenção e Fisiologia',
    'Reabilitação Muscular',
  ];
  const names = [
    'Dr. Rodrigo Lasmar', 'Dr. Gustavo Magliocca', 'Dr. Márcio Tannure', 'Dra. Ana Paula Simões',
    'Dr. Joaquim Grava', 'Dr. José Sanchez', 'Dra. Camila Mendes', 'Dr. Fernando Pimenta',
    'Dr. Henrique Jones', 'Dra. Luciana Braga', 'Dr. Ricardo Galotti', 'Dr. André Pedrinelli',
  ];

  return names.map((name, idx) => {
    const level = clamp(2 + Math.floor(rng() * 4), 2, 5);
    const quality = clamp(58 + level * 8 + Math.floor(rng() * 7), 62, 96);
    const salary = Math.round((35_000 + level * 32_000 + rng() * 18_000) / 5_000) * 5_000;
    return {
      id: `med-pool-${idx}`,
      name,
      age: 33 + Math.floor(rng() * 25),
      level,
      quality,
      recoveryBonus: 6 + level * 4 + Math.floor(rng() * 4),
      preventionBonus: 4 + level * 3 + Math.floor(rng() * 3),
      specialty: specialties[idx % specialties.length],
      monthlySalary: salary,
      hiringFee: salary * 3,
    };
  });
}

export function createNewGameState(
  userClubId = 'palestra-sp',
  managerName = 'Você (Treinador)',
  seed = 202601,
): GameState {
  const rng = createSeededRng(seed);
  const season = 2026;
  const currentDate = `${season}-01-05`;
  const sponsors = generateAvailableSponsors();
  const coachPool = generateCoachPool(rng);
  const medPool = generateMedicalPool(rng);

  const clubs: Record<string, Club> = {};
  const players: Record<string, Player> = {};

  CLUB_PRESETS.forEach((preset, cIdx) => {
    const isUser = preset.id === userClubId;
    const clubSponsor =
      [...sponsors]
        .filter((s) => s.minReputation <= preset.reputation)
        .sort((a, b) => b.monthlyIncome - a.monthlyIncome)[0] ?? sponsors[0];

    const initialCoaches: CoachStaff[] = [
      {
        id: `c-${preset.id}-1`,
        name: `Auxiliar ${preset.shortName} Tático`,
        age: 42,
        nationality: 'Brasil',
        level: preset.reputation >= 82 ? 4 : 3,
        quality: clamp(preset.reputation - 4, 64, 90),
        developmentAbility: clamp(preset.reputation - 3, 65, 91),
        specialty: 'Tática e Posicionamento',
        monthlySalary: 140_000,
        hiringFee: 500_000,
      },
      {
        id: `c-${preset.id}-2`,
        name: `Preparador ${preset.shortName} Físico`,
        age: 39,
        nationality: 'Brasil',
        level: preset.reputation >= 80 ? 4 : 3,
        quality: clamp(preset.reputation - 5, 62, 88),
        developmentAbility: clamp(preset.reputation - 6, 62, 88),
        specialty: 'Preparação Física',
        monthlySalary: 115_000,
        hiringFee: 400_000,
      },
    ];

    const initialMed: MedicalStaff[] = [
      {
        id: `m-${preset.id}-1`,
        name: `Dr. Chefe Médico ${preset.shortName}`,
        age: 46,
        level: preset.reputation >= 82 ? 4 : 3,
        quality: clamp(preset.reputation - 3, 66, 92),
        recoveryBonus: preset.reputation >= 82 ? 18 : 13,
        preventionBonus: preset.reputation >= 82 ? 14 : 10,
        specialty: 'Fisioterapia Esportiva',
        monthlySalary: 110_000,
        hiringFee: 350_000,
      },
    ];

    const club: Club = {
      id: preset.id,
      name: preset.name,
      shortName: preset.shortName,
      primaryColor: preset.primaryColor,
      secondaryColor: preset.secondaryColor,
      city: preset.city,
      reputation: preset.reputation,
      popularity: preset.popularity,
      philosophy: preset.philosophy,
      isUserClub: isUser,
      managerName: isUser ? managerName : preset.managerName,
      managerConfidence: 82,
      stadium: {
        name: preset.stadiumName,
        capacity: preset.stadiumCapacity,
        standsLevel: preset.standsLevel,
        roofLevel: preset.roofLevel,
        lightingLevel: preset.lightingLevel,
        vipLevel: preset.vipLevel,
        infrastructureLevel: preset.infraLevel,
        modernizationLevel: preset.modLevel,
        pitchQuality: 72 + preset.infraLevel * 6,
        ticketPrice: preset.reputation >= 82 ? 75 : 58,
        vipTicketPrice: preset.reputation >= 82 ? 290 : 210,
        maintenanceMonthlyCost: 340_000 + preset.standsLevel * 95_000 + preset.vipLevel * 55_000,
        homeFactorBonus: clamp(preset.standsLevel + preset.roofLevel + preset.lightingLevel, 4, 15),
        activeConstructions: [],
        lastAttendance: Math.round(preset.stadiumCapacity * 0.74),
        lastRevenue: Math.round(preset.stadiumCapacity * 0.74 * 68),
        recordAttendance: Math.round(preset.stadiumCapacity * 0.94),
      },
      tactics: {
        formation: preset.formation,
        mentality: preset.philosophy === 'Ataque Total' ? 'Ofensiva' : preset.philosophy === 'Retranca Tática' ? 'Defensiva' : 'Equilibrada',
        pressing: preset.playStyle === 'Pressão Alta' ? 'Alta' : 'Média',
        passingStyle: preset.playStyle === 'Posse de Bola' ? 'Curto' : preset.playStyle === 'Jogo Direto' ? 'Direto' : 'Misto',
        tempo: preset.playStyle === 'Contra-Ataque' ? 'Rápido' : 'Controlado',
        defensiveLine: preset.playStyle === 'Pressão Alta' ? 'Adiantada' : 'Padrão',
        playStyle: preset.playStyle,
        startingXI: [],
        bench: [],
      },
      finances: {
        balance: preset.balance,
        transferBudget: preset.transferBudget,
        wageBudgetMonthly: Math.round(preset.balance * 0.12),
        sponsorship: { ...clubSponsor },
        loans: [],
        transactions: [
          {
            id: `init-tx-${preset.id}`,
            date: `${season}-01-01`,
            type: 'receita',
            category: 'Patrocínio',
            description: `Aporte inicial da temporada — ${clubSponsor.sponsorName}`,
            amount: clubSponsor.monthlyIncome,
          },
        ],
      },
      coaches: initialCoaches,
      medicalStaff: initialMed,
      objectives: [
        {
          id: `obj-league-${preset.id}`,
          title: preset.reputation >= 82 ? 'Título ou G-3 da Série A' : preset.reputation >= 76 ? 'Vaga Continental (Top 6)' : 'Permanência tranquila (Top 10)',
          description: 'Terminar a Série A Nacional dentro da meta estipulada pela diretoria.',
          targetType: 'league_position',
          targetValue: preset.reputation >= 82 ? 3 : preset.reputation >= 76 ? 6 : 10,
          reward: 8_000_000,
        },
        {
          id: `obj-fin-${preset.id}`,
          title: 'Saúde Financeira',
          description: 'Manter o saldo positivo ao fim da temporada com gestão responsável.',
          targetType: 'finance_balance',
          targetValue: 10_000_000,
          reward: 3_000_000,
        },
      ],
      recentForm: ['V', 'E', 'V'].slice(0, (cIdx % 3) + 1) as ('V' | 'E' | 'D')[],
      trainingSchedule: {
        collectiveFocus: 'Coletivo',
        intensity: 'Moderado',
        sessionsThisWeek: 0,
      },
      titlesCount: { ...preset.titles },
    };

    const clubPlayers: Player[] = SQUAD_BLUEPRINT.map((slot, idx) =>
      generatePlayer(preset, slot, idx, season, currentDate, rng),
    );

    // Gera química inicial (partidas juntos & relacionamentos) entre companheiros do mesmo clube
    for (const pA of clubPlayers) {
      for (const pB of clubPlayers) {
        if (pA.id === pB.id) continue;
        pA.chemistry.matchesWithTeammates[pB.id] = Math.floor(rng() * 14) + 3;
        pA.chemistry.relationships[pB.id] = Math.floor(rng() * 14) + 2;
      }
      players[pA.id] = pA;
    }

    // Seleciona melhor escalação inicial
    const lineup = autoSelectBestLineup(club, clubPlayers);
    club.tactics.startingXI = lineup.startingXI;
    club.tactics.bench = lineup.bench;

    clubs[club.id] = club;
  });

  // No clube do usuário, cria 1 jogador com lesão leve na enfermaria e 1 reserva com insatisfação moderada
  // para demonstrar imediatamente Enfermaria + Modificadores Temporários (ex: 82 (-3)) em ação real!
  const userClub = clubs[userClubId];
  const userBench = userClub.tactics.bench.map((id) => players[id]).filter(Boolean);
  if (userBench[0]) {
    const injuredP = userBench[0];
    const inj = generateInjury(injuredP, 'Treinamento', currentDate, userClub.medicalStaff, rng);
    inj.severity = 'Leve';
    inj.totalDays = 9;
    inj.remainingDays = 9;
    inj.type = 'Estiramento Muscular Grau I';
    players[injuredP.id] = {
      ...injuredP,
      injury: inj,
      injuryHistoryCount: injuredP.injuryHistoryCount + 1,
    };
  }
  if (userBench[1]) {
    const unhappyP = userBench[1];
    players[unhappyP.id] = {
      ...unhappyP,
      conditional: {
        ...unhappyP.conditional,
        moral: 44,
        confianca: 48,
      },
      contract: {
        ...unhappyP.contract,
        role: 'Titular fixo',
        expectedStartRatio: ROLE_EXPECTED_START_RATIO['Titular fixo'],
        recentTeamMatchesConsidered: 4,
        recentPlayerStarts: 1,
        recentPlayerAppearances: 2,
        dissatisfaction: 'Moderada',
        dissatisfactionPoints: 52,
        requestedRenegotiation: true,
        lastComplaintDate: currentDate,
      },
    };
  }

  // Competições da temporada
  const allClubIds = Object.keys(clubs);
  const top8ClubIds = [...Object.values(clubs)]
    .sort((a, b) => b.reputation - a.reputation)
    .slice(0, 8)
    .map((c) => c.id);
  if (!top8ClubIds.includes(userClubId)) {
    top8ClubIds[7] = userClubId; // Garante o clube do usuário na Continental se desejar competir em todas as frentes
  }

  const league = generateLeagueCompetition(allClubIds, season);
  const cup = generateCupCompetition(allClubIds, season, 'Copa Nacional', 'Copa', `${season}-03-11`);
  const continental = generateCupCompetition(
    top8ClubIds,
    season,
    'Copa Continental',
    'Continental',
    `${season}-04-15`,
  );

  // Leilões iniciais interessantes com lances já ativos de clubes IA
  const auctionCandidates = Object.values(players)
    .filter((p) => p.clubId !== userClubId && calculateBaseOverall(p) >= 76)
    .sort((a, b) => b.potential - a.potential)
    .slice(0, 20);

  const initialAuctions = [];
  for (let i = 0; i < 4 && i < auctionCandidates.length; i++) {
    const p = auctionCandidates[i * 4] ?? auctionCandidates[i];
    const seller = clubs[p.clubId];
    if (!seller) continue;
    const auc = createPlayerAuction(p, seller, currentDate, 4 + i);
    // Adiciona 1 lance inicial de um clube concorrente
    const rival = Object.values(clubs).find((c) => !c.isUserClub && c.id !== seller.id && c.finances.transferBudget > auc.minimumPrice);
    if (rival) {
      auc.bids.push({
        id: `init-bid-${i}`,
        clubId: rival.id,
        clubName: rival.name,
        fee: auc.minimumPrice,
        offeredSalary: Math.round((p.contract.salary * 1.12) / 5_000) * 5_000,
        promisedRole: 'Titular rotativo',
        timestampDate: currentDate,
        projectScore: 72,
      });
    }
    initialAuctions.push(auc);
  }

  // Próximo jogo do usuário
  const nextUserFixture = league.fixtures.find(
    (f) => f.homeClubId === userClubId || f.awayClubId === userClubId,
  );

  const baseState: GameState = {
    version: 1,
    careerStarted: true,
    season,
    currentDate,
    userClubId,
    clubs,
    players,
    competitions: [league, cup, continental],
    transferOffers: [],
    pendingFutureTransfers: [],
    auctions: initialAuctions,
    availableCoaches: coachPool,
    availableMedicalStaff: medPool,
    availableSponsors: sponsors,
    calendarEvents: [],
    news: [
      {
        id: 'welcome-1',
        date: currentDate,
        category: 'Partida',
        title: `Bem-vindo ao comando do ${userClub.name}!`,
        body: `A temporada ${season} começou e a janela de transferências está ABERTA até 28/02. Organize seu elenco, ajuste táticas, comande treinos, acompanhe leilões e expanda o ${userClub.stadium.name}!`,
        read: false,
        actionPage: 'tactics',
        severity: 'success',
      },
      ...(userBench[1]
        ? [
            {
              id: 'welcome-unhappy',
              date: currentDate,
              category: 'Elenco' as const,
              title: `${userBench[1].shortName} cobra mais minutos em campo`,
              body: `Contratado como "Titular fixo", ${userBench[1].fullName} está com insatisfação moderada (-3 nos atributos mentais). Dê minutos a ele ou renegocie o papel no contrato.`,
              read: false,
              actionPage: 'player_profile' as const,
              relatedId: userBench[1].id,
              severity: 'warning' as const,
            },
          ]
        : []),
      ...(userBench[0]
        ? [
            {
              id: 'welcome-inj',
              date: currentDate,
              category: 'Médico' as const,
              title: `Boletim da Enfermaria: ${userBench[0].shortName}`,
              body: `${userBench[0].fullName} sofreu Estiramento Muscular Grau I no início da pré-temporada e está em tratamento no departamento médico (9 dias estimados).`,
              read: false,
              actionPage: 'infirmary' as const,
              severity: 'info' as const,
            },
          ]
        : []),
    ],
    seasonHistory: [],
    milestones: [
      {
        id: 'ms-init',
        date: currentDate,
        season,
        title: `Início da Era ${managerName}`,
        description: `Assumiu a gestão esportiva e financeira do ${userClub.name}.`,
        category: 'Técnico',
      },
    ],
    clubRecords: {
      biggestWin: null,
      recordSigning: null,
      recordSale: null,
      highestAttendance: {
        attendance: userClub.stadium.recordAttendance,
        opponent: 'Clássico Anterior',
        date: `${season - 1}-11-10`,
      },
    },
    activeMatchId: nextUserFixture?.id ?? null,
    selectedPlayerId: userClub.tactics.startingXI[9] ?? userClub.tactics.startingXI[0] ?? null,
  };

  return {
    ...baseState,
    calendarEvents: rebuildCalendarEvents(baseState),
  };
}
