import { MedicalStaff, Player, PlayerInjury } from '../types/game';
import { clamp, INJURY_CATALOG } from './constants';

export function getMedicalDepartmentBonuses(staff: MedicalStaff[]): {
  recoverySpeedMultiplier: number; // ex: 1.00 .. 1.65
  injuryRiskReduction: number; // ex: 0.00 .. 0.40
  avgQuality: number;
} {
  if (staff.length === 0) {
    return { recoverySpeedMultiplier: 1.0, injuryRiskReduction: 0, avgQuality: 45 };
  }
  const avgQuality = Math.round(staff.reduce((a, m) => a + m.quality, 0) / staff.length);
  const recoveryPct = Math.min(60, staff.reduce((a, m) => a + m.recoveryBonus, 0));
  const preventPct = Math.min(40, staff.reduce((a, m) => a + m.preventionBonus, 0));

  return {
    recoverySpeedMultiplier: Number((1 + recoveryPct / 100).toFixed(2)),
    injuryRiskReduction: Number((preventPct / 100).toFixed(2)),
    avgQuality,
  };
}

export function generateInjury(
  player: Player,
  cause: PlayerInjury['cause'],
  currentDate: string,
  medicalStaff: MedicalStaff[],
  rng: () => number = Math.random,
): PlayerInjury {
  // Fadiga alta e propensão aumentam chance de lesão mais grave
  const severityRoll =
    rng() + (player.conditional.fadiga > 75 ? 0.14 : 0) + (player.injuryProne > 14 ? 0.1 : 0);

  let pool = INJURY_CATALOG.filter((i) => i.severity === 'Leve');
  if (severityRoll > 0.96) {
    pool = INJURY_CATALOG.filter((i) => i.severity === 'Muito Grave');
  } else if (severityRoll > 0.82) {
    pool = INJURY_CATALOG.filter((i) => i.severity === 'Grave');
  } else if (severityRoll > 0.48) {
    pool = INJURY_CATALOG.filter((i) => i.severity === 'Moderada');
  }

  const chosen = pool[Math.floor(rng() * pool.length)] ?? INJURY_CATALOG[0];
  const { recoverySpeedMultiplier } = getMedicalDepartmentBonuses(medicalStaff);

  const rawDays = Math.round(chosen.minDays + rng() * (chosen.maxDays - chosen.minDays));
  const adjustedDays = Math.max(3, Math.round(rawDays / (0.85 + recoverySpeedMultiplier * 0.15)));

  return {
    id: `inj-${player.id}-${currentDate}-${Math.floor(rng() * 10000)}`,
    type: chosen.type,
    severity: chosen.severity,
    totalDays: adjustedDays,
    remainingDays: adjustedDays,
    stage: 'Aguda',
    treatmentProgress: 0,
    cause,
    incurredDate: currentDate,
  };
}

export function computeInjuryRiskForPlayer(
  player: Player,
  baseRisk: number,
  medicalStaff: MedicalStaff[],
  infraLevel: number,
): number {
  const { injuryRiskReduction } = getMedicalDepartmentBonuses(medicalStaff);
  const fatigueFactor = 1 + Math.pow(player.conditional.fadiga / 55, 2) * 0.85;
  const proneFactor = 0.75 + (player.injuryProne / 20) * 0.6;
  const historyFactor = 1 + Math.min(player.injuryHistoryCount * 0.06, 0.35);
  const infraFactor = Math.max(0.75, 1.05 - infraLevel * 0.05);
  const returnPenalty = player.returnToPlaySharpness < 70 ? 1.35 : 1.0;

  return clamp(
    baseRisk * fatigueFactor * proneFactor * historyFactor * infraFactor * returnPenalty * (1 - injuryRiskReduction),
    0.0005,
    0.35,
  );
}

export function advanceDailyMedicalRecovery(
  player: Player,
  medicalStaff: MedicalStaff[],
): { player: Player; recoveredToday: boolean } {
  if (!player.injury) {
    // Recuperação gradual de retorno (returnToPlaySharpness) e fadiga natural diária
    const newSharpness = player.returnToPlaySharpness < 100 ? clamp(player.returnToPlaySharpness + 5, 0, 100) : 100;
    const newFatigue = clamp(player.conditional.fadiga - 6, 0, 100);
    const newCond = clamp(player.conditional.condicionamento + 1, 40, 100);
    return {
      player: {
        ...player,
        returnToPlaySharpness: newSharpness,
        conditional: {
          ...player.conditional,
          fadiga: newFatigue,
          condicionamento: newCond,
        },
      },
      recoveredToday: false,
    };
  }

  const { recoverySpeedMultiplier } = getMedicalDepartmentBonuses(medicalStaff);
  const hasOrtho = medicalStaff.some((m) => m.specialty === 'Ortopedia e Trauma');
  const hasMuscle = medicalStaff.some((m) => m.specialty === 'Reabilitação Muscular');

  let dailyProgressDays = 1 * (0.85 + recoverySpeedMultiplier * 0.2);
  if ((player.injury.severity === 'Grave' || player.injury.severity === 'Muito Grave') && hasOrtho) {
    dailyProgressDays += 0.18;
  }
  if (player.injury.severity === 'Leve' && hasMuscle) {
    dailyProgressDays += 0.15;
  }

  const nextRemaining = Math.max(0, Number((player.injury.remainingDays - dailyProgressDays).toFixed(2)));
  const progressPct = clamp(
    Math.round(((player.injury.totalDays - nextRemaining) / Math.max(1, player.injury.totalDays)) * 100),
    0,
    100,
  );

  if (nextRemaining <= 0) {
    // Alta médica com retorno gradual (condicionamento reduzido conforme gravidade)
    const sharpnessAfter =
      player.injury.severity === 'Muito Grave'
        ? 45
        : player.injury.severity === 'Grave'
          ? 58
          : player.injury.severity === 'Moderada'
            ? 70
            : 82;

    return {
      player: {
        ...player,
        injury: null,
        returnToPlaySharpness: sharpnessAfter,
        conditional: {
          ...player.conditional,
          condicionamento: clamp(player.conditional.condicionamento - 10, 48, 88),
          fadiga: clamp(player.conditional.fadiga - 20, 5, 50),
          ritmoJogo: clamp(player.conditional.ritmoJogo - 18, 35, 80),
          moral: clamp(player.conditional.moral + 6, 10, 100),
        },
      },
      recoveredToday: true,
    };
  }

  const stage: PlayerInjury['stage'] =
    progressPct < 25
      ? 'Aguda'
      : progressPct < 60
        ? 'Tratamento'
        : progressPct < 85
          ? 'Fisioterapia'
          : 'Transição Física';

  return {
    player: {
      ...player,
      injury: {
        ...player.injury,
        remainingDays: Math.ceil(nextRemaining),
        stage,
        treatmentProgress: progressPct,
      },
      conditional: {
        ...player.conditional,
        fadiga: clamp(player.conditional.fadiga - 4, 0, 100),
      },
    },
    recoveredToday: false,
  };
}
