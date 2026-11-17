import {
  Club,
  Stadium,
  StadiumConstruction,
  StadiumUpgradeCategory,
} from '../types/game';
import { addDays, clamp, STADIUM_UPGRADES } from './constants';

export function getStadiumCategoryLevel(stadium: Stadium, category: StadiumUpgradeCategory): number {
  switch (category) {
    case 'arquibancadas':
      return stadium.standsLevel;
    case 'cobertura':
      return stadium.roofLevel;
    case 'iluminacao':
      return stadium.lightingLevel;
    case 'vip':
      return stadium.vipLevel;
    case 'infraestrutura':
      return stadium.infrastructureLevel;
    case 'modernizacao':
      return stadium.modernizationLevel;
  }
}

export function getNextUpgradeOffer(stadium: Stadium, category: StadiumUpgradeCategory): {
  canUpgrade: boolean;
  currentLevel: number;
  maxLevel: number;
  nextLevel: number;
  cost: number;
  days: number;
  capacityAdded: number;
  homeFactorAdded: number;
  maintenanceAdd: number;
  inProgress: boolean;
  name: string;
  description: string;
} {
  const spec = STADIUM_UPGRADES.find((s) => s.category === category)!;
  const currentLevel = getStadiumCategoryLevel(stadium, category);
  const inProgress = stadium.activeConstructions.some((c) => c.category === category);
  const nextLevel = currentLevel + 1;
  const canUpgrade = !inProgress && currentLevel < spec.maxLevel;

  const scale = Math.pow(spec.costMultiplier, Math.max(0, currentLevel));
  const cost = Math.round((spec.baseCost * scale) / 100_000) * 100_000;
  const days = Math.round(spec.baseDays + currentLevel * 10);

  return {
    canUpgrade,
    currentLevel,
    maxLevel: spec.maxLevel,
    nextLevel,
    cost,
    days,
    capacityAdded: spec.capacityPerLevel,
    homeFactorAdded: spec.homeFactorPerLevel,
    maintenanceAdd: spec.maintenanceAdd,
    inProgress,
    name: spec.name,
    description: spec.description,
  };
}

export function createStadiumConstruction(
  stadium: Stadium,
  category: StadiumUpgradeCategory,
  currentDate: string,
): StadiumConstruction | null {
  const offer = getNextUpgradeOffer(stadium, category);
  if (!offer.canUpgrade) return null;

  return {
    id: `const-${category}-${offer.nextLevel}-${currentDate}`,
    category,
    name: `${offer.name} (Nível ${offer.nextLevel})`,
    targetLevel: offer.nextLevel,
    cost: offer.cost,
    totalDays: offer.days,
    remainingDays: offer.days,
    startDate: currentDate,
    estimatedEndDate: addDays(currentDate, offer.days),
    capacityAdded: offer.capacityAdded,
    benefitDescription: offer.description,
  };
}

export function advanceStadiumConstructions(stadium: Stadium): {
  stadium: Stadium;
  completed: StadiumConstruction[];
} {
  if (stadium.activeConstructions.length === 0) {
    return { stadium, completed: [] };
  }

  let nextStadium = { ...stadium };
  const remaining: StadiumConstruction[] = [];
  const completed: StadiumConstruction[] = [];

  for (const c of stadium.activeConstructions) {
    const rem = c.remainingDays - 1;
    if (rem <= 0) {
      completed.push(c);
      const spec = STADIUM_UPGRADES.find((s) => s.category === c.category)!;
      nextStadium.capacity += c.capacityAdded;
      nextStadium.homeFactorBonus = clamp(nextStadium.homeFactorBonus + spec.homeFactorPerLevel, 0, 18);
      nextStadium.maintenanceMonthlyCost += spec.maintenanceAdd;
      if (c.category === 'arquibancadas') nextStadium.standsLevel = c.targetLevel;
      if (c.category === 'cobertura') nextStadium.roofLevel = c.targetLevel;
      if (c.category === 'iluminacao') nextStadium.lightingLevel = c.targetLevel;
      if (c.category === 'vip') nextStadium.vipLevel = c.targetLevel;
      if (c.category === 'infraestrutura') {
        nextStadium.infrastructureLevel = c.targetLevel;
        nextStadium.pitchQuality = clamp(nextStadium.pitchQuality + 7, 65, 100);
      }
      if (c.category === 'modernizacao') nextStadium.modernizationLevel = c.targetLevel;
    } else {
      remaining.push({ ...c, remainingDays: rem });
    }
  }

  nextStadium.activeConstructions = remaining;
  return { stadium: nextStadium, completed };
}

export interface MatchdayAttendanceForecast {
  attendance: number;
  occupancyPct: number;
  regularTicketsSold: number;
  vipTicketsSold: number;
  regularRevenue: number;
  vipRevenue: number;
  totalRevenue: number;
  homeAtmosphereBonus: number; // 0..12 impacto real na partida
}

/**
 * Calcula público e receita de bilheteria levando em conta:
 * - Capacidade do estádio
 * - Preço dos ingressos (elasticidade realista)
 * - Popularidade do clube
 * - Importância da partida (1-10)
 * - Qualidade/reputação do adversário
 * - Desempenho recente (forma)
 * - Cobertura & modernização
 */
export function calculateMatchdayBoxOffice(
  homeClub: Club,
  awayClub: Club,
  matchImportance: number, // 1..10
): MatchdayAttendanceForecast {
  const st = homeClub.stadium;
  const capacity = st.capacity;

  // Fator forma recente (-0.12 a +0.14)
  const formScore = homeClub.recentForm.reduce((acc, r) => acc + (r === 'V' ? 1 : r === 'E' ? 0.2 : -0.8), 0);
  const formFactor = clamp(formScore * 0.03, -0.14, 0.15);

  // Demanda base por popularidade, adversário e importância
  const popularityFactor = 0.34 + (homeClub.popularity / 100) * 0.44;
  const opponentFactor = ((awayClub.reputation - 55) / 45) * 0.22;
  const importanceFactor = ((matchImportance - 4) / 6) * 0.25;
  const comfortFactor = st.roofLevel * 0.025 + st.modernizationLevel * 0.02 + st.lightingLevel * 0.01;

  // Elasticidade de preço (preço ideal ~ R$ 55-95 dependendo da reputação/modernização)
  const fairPrice = 48 + homeClub.reputation * 0.45 + st.modernizationLevel * 7;
  const priceRatio = st.ticketPrice / fairPrice;
  const priceElasticity =
    priceRatio <= 1 ? 1 + (1 - priceRatio) * 0.28 : Math.max(0.22, 1 - Math.pow(priceRatio - 1, 1.35) * 0.95);

  const occupancy = clamp(
    (popularityFactor + opponentFactor + importanceFactor + formFactor + comfortFactor) * priceElasticity,
    0.15,
    0.99,
  );

  // Setor VIP corresponde a ~4% + 3% por nível VIP da capacidade
  const vipShare = st.vipLevel > 0 ? Math.min(0.18, 0.03 + st.vipLevel * 0.035) : 0;
  const vipCapacity = Math.round(capacity * vipShare);
  const regularCapacity = capacity - vipCapacity;

  const regularTicketsSold = Math.round(regularCapacity * occupancy);
  const vipPriceFair = fairPrice * 3.8;
  const vipElasticity = clamp(vipPriceFair / Math.max(80, st.vipTicketPrice), 0.3, 1.15);
  const vipOccupancy = clamp(occupancy * vipElasticity * (0.85 + matchImportance * 0.025), 0.15, 1);
  const vipTicketsSold = Math.round(vipCapacity * vipOccupancy);

  const attendance = regularTicketsSold + vipTicketsSold;
  const occupancyPct = Math.round((attendance / Math.max(1, capacity)) * 100);
  const regularRevenue = regularTicketsSold * st.ticketPrice;
  const vipRevenue = vipTicketsSold * st.vipTicketPrice;
  const totalRevenue = regularRevenue + vipRevenue;

  // A torcida + estrutura influenciam diretamente o fator casa!
  const crowdPressure = (attendance / 60_000) * 4.5 + (occupancyPct / 100) * 4.0;
  const homeAtmosphereBonus = Number(clamp(crowdPressure + st.homeFactorBonus * 0.35, 1, 14).toFixed(1));

  return {
    attendance,
    occupancyPct,
    regularTicketsSold,
    vipTicketsSold,
    regularRevenue,
    vipRevenue,
    totalRevenue,
    homeAtmosphereBonus,
  };
}
