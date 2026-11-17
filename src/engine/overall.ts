import {
  Club,
  ConditionalAttributes,
  MentalAttributes,
  PhysicalAttributes,
  Player,
  Position,
  TeamStrengthBreakdown,
  TechnicalAttributes,
  TemporaryModifiers,
} from '../types/game';
import { clamp, FORMATIONS, POSITION_GROUPS } from './constants';
import { calculateSquadChemistry } from './chemistry';

export function getPlayerTemporaryModifiers(player: Player): TemporaryModifiers {
  let technicalDelta = 0;
  let physicalDelta = 0;
  let mentalDelta = 0;
  let conditionalDelta = 0;
  const reasons: string[] = [];

  // 1. Insatisfação contratual (Seção 8)
  if (player.contract.dissatisfaction === 'Elevada') {
    mentalDelta -= 5;
    conditionalDelta -= 5;
    reasons.push('Insatisfação contratual elevada (-5 Mentais/Condicionais)');
  } else if (player.contract.dissatisfaction === 'Moderada') {
    mentalDelta -= 3;
    conditionalDelta -= 1;
    reasons.push('Insatisfação contratual moderada (-3 Mentais)');
  } else if (player.contract.dissatisfaction === 'Leve') {
    mentalDelta -= 1;
    reasons.push('Leve descontentamento com minutagem (-1 Mentais)');
  }

  // 2. Moral baixa ou muito alta
  if (player.conditional.moral < 35) {
    technicalDelta -= 2;
    mentalDelta -= 2;
    reasons.push('Moral muito baixa (-2 Técnicos/Mentais)');
  } else if (player.conditional.moral < 50) {
    technicalDelta -= 1;
    mentalDelta -= 1;
    reasons.push('Moral baixa (-1 Técnicos/Mentais)');
  } else if (
    player.conditional.moral >= 88 &&
    player.conditional.confianca >= 82 &&
    player.contract.dissatisfaction === 'Satisfeito'
  ) {
    mentalDelta += 2;
    technicalDelta += 1;
    reasons.push('Confiança e moral em alta (+2 Mentais, +1 Técnicos)');
  }

  // 3. Fadiga severa / retorno de lesão
  if (player.conditional.fadiga >= 80) {
    physicalDelta -= 4;
    conditionalDelta -= 3;
    reasons.push('Fadiga extrema (-4 Físicos)');
  } else if (player.conditional.fadiga >= 65) {
    physicalDelta -= 2;
    reasons.push('Desgaste físico elevado (-2 Físicos)');
  }

  if (player.returnToPlaySharpness < 75 && !player.injury) {
    physicalDelta -= 2;
    technicalDelta -= 1;
    reasons.push('Retorno gradual de lesão (-2 Físicos, -1 Técnicos)');
  }

  // Delta aproximado no overall para exibição
  const overallDelta = Math.round(technicalDelta * 0.4 + physicalDelta * 0.28 + mentalDelta * 0.32);

  return {
    technicalDelta,
    physicalDelta,
    mentalDelta,
    conditionalDelta,
    overallDelta,
    reasons,
  };
}

export function getEffectiveTechnical(player: Player): TechnicalAttributes {
  const { technicalDelta } = getPlayerTemporaryModifiers(player);
  const t = player.technical;
  const adj = (v: number) => clamp(v + technicalDelta, 1, 99);
  return {
    finalizacao: adj(t.finalizacao),
    passeCurto: adj(t.passeCurto),
    passeLongo: adj(t.passeLongo),
    cruzamento: adj(t.cruzamento),
    drible: adj(t.drible),
    controleBola: adj(t.controleBola),
    marcacao: adj(t.marcacao),
    desarme: adj(t.desarme),
    cabeceio: adj(t.cabeceio),
    posicionamento: adj(t.posicionamento),
    tecnica: adj(t.tecnica),
    bolaParada: adj(t.bolaParada),
    reflexos: adj(t.reflexos),
    defesaGoleiro: adj(t.defesaGoleiro),
    jogoAereo: adj(t.jogoAereo),
  };
}

export function getEffectivePhysical(player: Player): PhysicalAttributes {
  const { physicalDelta } = getPlayerTemporaryModifiers(player);
  const p = player.physical;
  const adj = (v: number) => clamp(v + physicalDelta, 1, 99);
  return {
    velocidade: adj(p.velocidade),
    aceleracao: adj(p.aceleracao),
    forca: adj(p.forca),
    resistencia: adj(p.resistencia),
    agilidade: adj(p.agilidade),
    equilibrio: adj(p.equilibrio),
    impulsao: adj(p.impulsao),
  };
}

export function getEffectiveMental(player: Player): MentalAttributes {
  const { mentalDelta } = getPlayerTemporaryModifiers(player);
  const m = player.mental;
  const adj = (v: number) => clamp(v + mentalDelta, 1, 99);
  return {
    inteligenciaTatica: adj(m.inteligenciaTatica),
    visaoJogo: adj(m.visaoJogo),
    concentracao: adj(m.concentracao),
    decisao: adj(m.decisao),
    determinacao: adj(m.determinacao),
    lideranca: adj(m.lideranca),
    trabalhoEquipe: adj(m.trabalhoEquipe),
    antecipacao: adj(m.antecipacao),
    compostura: adj(m.compostura),
  };
}

export function getEffectiveConditional(player: Player): ConditionalAttributes {
  const { conditionalDelta } = getPlayerTemporaryModifiers(player);
  const c = player.conditional;
  return {
    condicionamento: clamp(c.condicionamento + conditionalDelta, 1, 100),
    fadiga: c.fadiga,
    ritmoJogo: clamp(c.ritmoJogo + conditionalDelta, 1, 100),
    moral: c.moral,
    confianca: clamp(c.confianca + conditionalDelta, 1, 100),
    formaRecente: clamp(c.formaRecente + conditionalDelta, 1, 100),
  };
}

function computePositionScore(
  pos: Position,
  t: TechnicalAttributes,
  p: PhysicalAttributes,
  m: MentalAttributes,
): number {
  switch (pos) {
    case 'GOL':
      return (
        t.reflexos * 0.24 +
        t.defesaGoleiro * 0.24 +
        t.posicionamento * 0.16 +
        t.jogoAereo * 0.12 +
        p.agilidade * 0.08 +
        m.concentracao * 0.08 +
        m.decisao * 0.04 +
        m.compostura * 0.04
      );
    case 'ZAG':
      return (
        t.marcacao * 0.2 +
        t.desarme * 0.19 +
        t.posicionamento * 0.14 +
        t.cabeceio * 0.11 +
        p.forca * 0.11 +
        p.impulsao * 0.06 +
        m.antecipacao * 0.08 +
        m.concentracao * 0.06 +
        p.velocidade * 0.05
      );
    case 'LD':
    case 'LE':
      return (
        t.desarme * 0.14 +
        t.marcacao * 0.13 +
        t.cruzamento * 0.13 +
        p.velocidade * 0.12 +
        p.resistencia * 0.11 +
        p.aceleracao * 0.09 +
        t.passeCurto * 0.08 +
        t.posicionamento * 0.08 +
        m.inteligenciaTatica * 0.07 +
        m.trabalhoEquipe * 0.05
      );
    case 'VOL':
      return (
        t.desarme * 0.15 +
        t.marcacao * 0.14 +
        t.passeCurto * 0.13 +
        t.posicionamento * 0.11 +
        m.inteligenciaTatica * 0.11 +
        m.antecipacao * 0.09 +
        p.resistencia * 0.09 +
        p.forca * 0.08 +
        m.decisao * 0.05 +
        t.passeLongo * 0.05
      );
    case 'MC':
      return (
        t.passeCurto * 0.17 +
        t.passeLongo * 0.11 +
        m.visaoJogo * 0.14 +
        t.tecnica * 0.11 +
        t.controleBola * 0.11 +
        m.inteligenciaTatica * 0.1 +
        m.decisao * 0.08 +
        p.resistencia * 0.08 +
        m.trabalhoEquipe * 0.05 +
        t.desarme * 0.05
      );
    case 'MEI':
      return (
        m.visaoJogo * 0.16 +
        t.passeCurto * 0.14 +
        t.tecnica * 0.13 +
        t.controleBola * 0.12 +
        t.drible * 0.11 +
        t.finalizacao * 0.09 +
        m.inteligenciaTatica * 0.09 +
        m.decisao * 0.06 +
        p.agilidade * 0.05 +
        m.compostura * 0.05
      );
    case 'PD':
    case 'PE':
      return (
        p.velocidade * 0.15 +
        p.aceleracao * 0.13 +
        t.drible * 0.15 +
        t.cruzamento * 0.12 +
        t.controleBola * 0.1 +
        t.finalizacao * 0.1 +
        p.agilidade * 0.08 +
        t.tecnica * 0.07 +
        t.posicionamento * 0.05 +
        m.decisao * 0.05
      );
    case 'ATA':
      return (
        t.finalizacao * 0.24 +
        t.posicionamento * 0.14 +
        t.controleBola * 0.11 +
        p.velocidade * 0.1 +
        p.aceleracao * 0.08 +
        t.cabeceio * 0.08 +
        m.compostura * 0.08 +
        t.drible * 0.06 +
        p.forca * 0.06 +
        m.decisao * 0.05
      );
  }
}

export function calculateBaseOverall(player: Player, atPosition?: Position): number {
  const pos = atPosition ?? player.primaryPosition;
  return clamp(Math.round(computePositionScore(pos, player.technical, player.physical, player.mental)), 1, 99);
}

export function calculateEffectiveOverall(player: Player, atPosition?: Position): number {
  const pos = atPosition ?? player.primaryPosition;
  const score = computePositionScore(
    pos,
    getEffectiveTechnical(player),
    getEffectivePhysical(player),
    getEffectiveMental(player),
  );
  // Penalidade se jogar fora de posição natural
  const fitPenalty = getPositionFitPenalty(player, pos);
  return clamp(Math.round(score - fitPenalty), 1, 99);
}

export function getPositionFitPenalty(player: Player, slotPos: Position): number {
  if (player.primaryPosition === slotPos) return 0;
  if (player.secondaryPosition === slotPos) return 2;
  if (player.primaryPosition === 'GOL' || slotPos === 'GOL') return 32;
  if (POSITION_GROUPS[player.primaryPosition] === POSITION_GROUPS[slotPos]) return 5;
  return 12;
}

export function calculateTeamStrength(
  club: Club,
  playersMap: Record<string, Player>,
  customXI?: string[],
): TeamStrengthBreakdown {
  const slots = FORMATIONS[club.tactics.formation];
  const xiIds = customXI ?? club.tactics.startingXI;

  const starters: { player: Player; slotPos: Position; effOvr: number; fitPenalty: number }[] = [];
  for (let i = 0; i < slots.length; i++) {
    const pid = xiIds[i];
    const p = pid ? playersMap[pid] : undefined;
    if (!p) continue;
    const slotPos = slots[i].position;
    const fitPenalty = getPositionFitPenalty(p, slotPos);
    const effOvr = calculateEffectiveOverall(p, slotPos);
    starters.push({ player: p, slotPos, effOvr, fitPenalty });
  }

  const startersRating =
    starters.length > 0
      ? Math.round(starters.reduce((acc, s) => acc + s.effOvr, 0) / starters.length)
      : 55;

  // Qualidade dos reservas
  const benchPlayers = club.tactics.bench
    .map((id) => playersMap[id])
    .filter((p): p is Player => Boolean(p && !p.injury));
  const benchRating =
    benchPlayers.length > 0
      ? Math.round(
          benchPlayers
            .slice(0, 7)
            .reduce((acc, p) => acc + calculateEffectiveOverall(p), 0) / Math.min(7, benchPlayers.length),
        )
      : Math.max(45, startersRating - 12);

  // Química
  const chemReport = calculateSquadChemistry(club, playersMap, xiIds);
  const chemistryScore = chemReport.overallChemistry;

  // Entrosamento tático
  const cohesionScore =
    starters.length > 0
      ? Math.round(
          starters.reduce((acc, s) => acc + s.player.chemistry.tacticalFamiliarity, 0) / starters.length,
        )
      : 55;

  // Condicionamento e frescor físico
  const fitnessScore =
    starters.length > 0
      ? Math.round(
          starters.reduce((acc, s) => {
            const fresh = clamp(100 - s.player.conditional.fadiga, 10, 100);
            return acc + s.player.conditional.condicionamento * 0.45 + fresh * 0.55;
          }, 0) / starters.length,
        )
      : 65;

  // Moral
  const moraleScore =
    starters.length > 0
      ? Math.round(starters.reduce((acc, s) => acc + s.player.conditional.moral, 0) / starters.length)
      : 65;

  // Compatibilidade tática (encaixe de posições + estilo de jogo + coerência das instruções)
  const avgFitPenalty =
    starters.length > 0 ? starters.reduce((a, s) => a + s.fitPenalty, 0) / starters.length : 10;
  const styleMatchRatio =
    starters.length > 0
      ? starters.filter((s) => s.player.chemistry.playStyle === club.tactics.playStyle).length / starters.length
      : 0.4;

  let instructionSynergy = 78;
  if (club.tactics.playStyle === 'Posse de Bola' && club.tactics.passingStyle === 'Curto') instructionSynergy += 10;
  if (club.tactics.playStyle === 'Contra-Ataque' && club.tactics.tempo === 'Rápido') instructionSynergy += 10;
  if (club.tactics.playStyle === 'Pressão Alta' && (club.tactics.pressing === 'Alta' || club.tactics.pressing === 'Pressão Total'))
    instructionSynergy += 10;
  if (club.tactics.mentality === 'Ultradefensiva' && club.tactics.defensiveLine === 'Adiantada')
    instructionSynergy -= 15;
  if (club.tactics.mentality === 'Ultraofensiva' && club.tactics.defensiveLine === 'Recuada')
    instructionSynergy -= 12;

  const tacticalCompatibility = clamp(
    Math.round(instructionSynergy - avgFitPenalty * 2.4 + styleMatchRatio * 14),
    30,
    99,
  );

  // Organização defensiva e ofensiva
  const defenders = starters.filter(
    (s) => s.slotPos === 'GOL' || POSITION_GROUPS[s.slotPos] === 'DEF' || s.slotPos === 'VOL',
  );
  const attackers = starters.filter(
    (s) => POSITION_GROUPS[s.slotPos] === 'ATA' || s.slotPos === 'MEI' || s.slotPos === 'MC',
  );

  const defBase =
    defenders.length > 0
      ? defenders.reduce((a, s) => a + s.effOvr, 0) / defenders.length
      : startersRating - 4;
  const offBase =
    attackers.length > 0
      ? attackers.reduce((a, s) => a + s.effOvr, 0) / attackers.length
      : startersRating - 4;

  const defMentalityMod =
    club.tactics.mentality === 'Ultradefensiva'
      ? 5
      : club.tactics.mentality === 'Defensiva'
        ? 3
        : club.tactics.mentality === 'Ultraofensiva'
          ? -5
          : club.tactics.mentality === 'Ofensiva'
            ? -2
            : 0;
  const offMentalityMod = -defMentalityMod;

  const defensiveOrganization = clamp(
    Math.round(defBase * 0.65 + cohesionScore * 0.18 + chemistryScore * 0.17 + defMentalityMod),
    30,
    99,
  );
  const offensiveOrganization = clamp(
    Math.round(offBase * 0.65 + chemistryScore * 0.2 + tacticalCompatibility * 0.15 + offMentalityMod),
    30,
    99,
  );

  // Overall geral da equipe (NÃO é média simples!)
  const overall = clamp(
    Math.round(
      startersRating * 0.44 +
        benchRating * 0.08 +
        chemistryScore * 0.11 +
        cohesionScore * 0.07 +
        fitnessScore * 0.08 +
        moraleScore * 0.06 +
        tacticalCompatibility * 0.06 +
        defensiveOrganization * 0.05 +
        offensiveOrganization * 0.05,
    ),
    35,
    99,
  );

  return {
    overall,
    startersRating,
    benchRating,
    chemistryScore,
    cohesionScore,
    fitnessScore,
    moraleScore,
    tacticalCompatibility,
    defensiveOrganization,
    offensiveOrganization,
  };
}

export function autoSelectBestLineup(
  club: Club,
  clubPlayers: Player[],
): { startingXI: string[]; bench: string[] } {
  const slots = FORMATIONS[club.tactics.formation];
  const available = clubPlayers.filter((p) => !p.injury);
  const used = new Set<string>();
  const startingXI: string[] = [];

  for (const slot of slots) {
    let bestPlayer: Player | null = null;
    let bestScore = -999;

    for (const p of available) {
      if (used.has(p.id)) continue;
      const eff = calculateEffectiveOverall(p, slot.position);
      // Preferência leve para jogadores descansados
      const fatiguePenalty = p.conditional.fadiga > 70 ? (p.conditional.fadiga - 65) * 0.25 : 0;
      const score = eff - fatiguePenalty;
      if (score > bestScore) {
        bestScore = score;
        bestPlayer = p;
      }
    }

    if (bestPlayer) {
      used.add(bestPlayer.id);
      startingXI.push(bestPlayer.id);
    } else {
      // Fallback caso haja muitos lesionados
      const fallback = clubPlayers.find((p) => !used.has(p.id));
      if (fallback) {
        used.add(fallback.id);
        startingXI.push(fallback.id);
      }
    }
  }

  const remaining = available
    .filter((p) => !used.has(p.id))
    .sort((a, b) => calculateEffectiveOverall(b) - calculateEffectiveOverall(a));
  const bench = remaining.slice(0, 9).map((p) => p.id);

  return { startingXI, bench };
}
