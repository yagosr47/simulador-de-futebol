import { CoachStaff, Player } from '../types/game';
import { clamp } from './constants';
import { calculateBaseOverall } from './overall';

export type AgePhase = 'Promessa' | 'Em Evolução' | 'Auge' | 'Experiente' | 'Declínio';

export function getPlayerAgePhase(player: Player): AgePhase {
  if (player.age <= 20) return 'Promessa';
  if (player.age < player.peakAge - 1) return 'Em Evolução';
  if (player.age <= player.peakAge + 2) return 'Auge';
  if (player.age <= player.peakAge + 4) return 'Experiente';
  return 'Declínio';
}

export function calculateMarketValue(player: Player): number {
  const ovr = calculateBaseOverall(player);
  const potentialGap = Math.max(0, player.potential - ovr);

  // Curva exponencial realista de valor de mercado em R$
  const baseByOvr = Math.pow(Math.max(ovr - 45, 5), 2.55) * 420;

  // Fator idade (jovens com potencial valem muito; veteranos caem)
  let ageFactor = 1.0;
  if (player.age <= 20) ageFactor = 1.38;
  else if (player.age <= 23) ageFactor = 1.25;
  else if (player.age <= 27) ageFactor = 1.1;
  else if (player.age <= 30) ageFactor = 0.85;
  else if (player.age <= 33) ageFactor = 0.55;
  else ageFactor = 0.3;

  // Bônus de potencial (maior para jovens)
  const potentialBonus = player.age <= 24 ? 1 + potentialGap * 0.045 : 1 + potentialGap * 0.012;

  // Duração de contrato (contrato curto desvaloriza passe)
  const contractFactor =
    player.contract.yearsRemaining <= 1 ? 0.72 : player.contract.yearsRemaining === 2 ? 0.92 : 1.05;

  // Fator forma e lesão
  const formFactor = 0.9 + (player.conditional.formaRecente / 100) * 0.2;
  const injuryPenalty = player.injury ? 0.86 : 1.0;

  const raw = baseByOvr * ageFactor * potentialBonus * contractFactor * formFactor * injuryPenalty;
  return Math.max(250_000, Math.round(raw / 50_000) * 50_000);
}

export function calculateFairMonthlySalary(player: Player): number {
  const ovr = calculateBaseOverall(player);
  const base = Math.pow(Math.max(ovr - 48, 4), 2.25) * 52;
  const ageMod = player.age <= 20 ? 0.65 : player.age >= 32 ? 0.9 : 1.05;
  return Math.max(15_000, Math.round((base * ageMod) / 5_000) * 5_000);
}

/**
 * Aplica evolução/declínio mensal (ou pós-treino acumulado) realista:
 * - Jovens evoluem mais rápido, mas potencial NÃO garante chegar ao teto
 * - Adultos têm evolução lenta e estabilidade
 * - Veteranos sofrem risco de declínio físico (mas podem ganhar mental)
 * - Lesões e excesso de jogos (overplayStress) prejudicam desenvolvimento
 */
export function processMonthlyDevelopment(
  player: Player,
  coaches: CoachStaff[],
  infraLevel: number,
  rng: () => number = Math.random,
): { player: Player; summary?: string } {
  const currentOvr = calculateBaseOverall(player);
  const gapToPotential = player.potential - currentOvr;
  const phase = getPlayerAgePhase(player);

  const avgCoachDev =
    coaches.length > 0
      ? coaches.reduce((a, c) => a + c.developmentAbility, 0) / coaches.length
      : 60;
  const youthCoachBonus = coaches.some((c) => c.specialty === 'Desenvolvimento Juvenil') ? 1.15 : 1.0;
  const infraFactor = 0.88 + infraLevel * 0.05;

  // Fator de personalidade / determinação
  const determinationFactor = 0.75 + (player.mental.determinacao / 100) * 0.45;
  const personalityMod =
    player.personality === 'Profissional' || player.personality === 'Resiliente'
      ? 1.15
      : player.personality === 'Ambicioso'
        ? 1.08
        : player.personality === 'Acomodado'
          ? 0.72
          : player.personality === 'Temperamental'
            ? 0.9
            : 1.0;

  // Penalidades por lesão, sobrecarga e insatisfação
  const injuryPenalty = player.injury ? 0.25 : Math.max(0.65, 1 - player.injuryHistoryCount * 0.04);
  const overplayPenalty = player.overplayStress > 65 ? 0.72 : 1.0;
  const moralePenalty = player.conditional.moral < 45 ? 0.78 : 1.0;

  // Potencial NÃO é garantido: estagnação natural se não houver ritmo/determinação/sorte
  const matchSharpnessMod = player.careerStats.seasonMatches > 0 ? 1.1 : 0.82;

  let nextTechnical = { ...player.technical };
  let nextPhysical = { ...player.physical };
  let nextMental = { ...player.mental };
  let devProgress = player.developmentProgress;
  let summary: string | undefined;

  if (phase === 'Promessa' || phase === 'Em Evolução') {
    if (gapToPotential > 0) {
      const ageMultiplier = phase === 'Promessa' ? 1.35 : 0.85;
      const gainPoints =
        (avgCoachDev / 70) *
        youthCoachBonus *
        infraFactor *
        determinationFactor *
        personalityMod *
        injuryPenalty *
        overplayPenalty *
        moralePenalty *
        matchSharpnessMod *
        ageMultiplier *
        (16 + rng() * 14);

      devProgress += gainPoints;

      if (devProgress >= 100) {
        devProgress -= 100;
        // Sobe atributos relevantes aleatoriamente, respeitando teto do potencial
        const techKeys = Object.keys(nextTechnical) as (keyof typeof nextTechnical)[];
        const physKeys = Object.keys(nextPhysical) as (keyof typeof nextPhysical)[];
        const mentKeys = Object.keys(nextMental) as (keyof typeof nextMental)[];

        const tk = techKeys[Math.floor(rng() * techKeys.length)];
        const pk = physKeys[Math.floor(rng() * physKeys.length)];
        const mk = mentKeys[Math.floor(rng() * mentKeys.length)];

        nextTechnical[tk] = clamp(nextTechnical[tk] + 1, 1, 99);
        if (rng() < 0.7) nextPhysical[pk] = clamp(nextPhysical[pk] + 1, 1, 99);
        if (rng() < 0.75) nextMental[mk] = clamp(nextMental[mk] + 1, 1, 99);

        summary = `${player.shortName} evoluiu tecnicamente e fisicamente nos treinos.`;
      }
    }
  } else if (phase === 'Auge') {
    // Adultos: estabilidade com leve chance de ganho mental
    if (gapToPotential > 0 && rng() < 0.28 * determinationFactor * injuryPenalty) {
      const mentKeys = Object.keys(nextMental) as (keyof typeof nextMental)[];
      const mk = mentKeys[Math.floor(rng() * mentKeys.length)];
      nextMental[mk] = clamp(nextMental[mk] + 1, 1, 99);
    }
  } else if (phase === 'Experiente' || phase === 'Declínio') {
    // Veteranos: declínio físico progressivo, possível ganho de experiência/liderança
    const declineChance = phase === 'Declínio' ? 0.58 : 0.24;
    const physicalProtection = player.personality === 'Profissional' ? 0.75 : 1.0;
    if (rng() < declineChance * physicalProtection) {
      const declineKeys: (keyof typeof nextPhysical)[] = [
        'velocidade',
        'aceleracao',
        'resistencia',
        'agilidade',
        'impulsao',
      ];
      const dk = declineKeys[Math.floor(rng() * declineKeys.length)];
      nextPhysical[dk] = clamp(nextPhysical[dk] - 1, 30, 99);
      if (phase === 'Declínio' && rng() < 0.45) {
        const dk2 = declineKeys[Math.floor(rng() * declineKeys.length)];
        nextPhysical[dk2] = clamp(nextPhysical[dk2] - 1, 30, 99);
      }
      summary = `${player.shortName} apresentou sinais de declínio físico pela idade.`;
    }
    if (rng() < 0.22) {
      nextMental.inteligenciaTatica = clamp(nextMental.inteligenciaTatica + 1, 1, 99);
      nextMental.lideranca = clamp(nextMental.lideranca + 1, 1, 99);
    }
  }

  // Sobrecarga grave pode reduzir ligeiramente potencial efetivo em jovens
  let updatedPotential = player.potential;
  if (player.age <= 23 && (player.overplayStress > 85 || player.injuryHistoryCount >= 4) && rng() < 0.2) {
    updatedPotential = Math.max(currentOvr, player.potential - 1);
  }

  const nextPlayer: Player = {
    ...player,
    potential: updatedPotential,
    technical: nextTechnical,
    physical: nextPhysical,
    mental: nextMental,
    developmentProgress: Math.round(devProgress),
    overplayStress: clamp(player.overplayStress - 10, 0, 100),
  };

  nextPlayer.marketValue = calculateMarketValue(nextPlayer);

  return { player: nextPlayer, summary };
}
