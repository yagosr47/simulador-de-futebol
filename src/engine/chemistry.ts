import { Club, Player } from '../types/game';
import { clamp, FORMATIONS, POSITION_GROUPS } from './constants';

export interface PairChemistryResult {
  score: number; // 0-100
  label: 'Excelente' | 'Forte' | 'Moderada' | 'Fraca';
  factors: {
    timeTogether: number;
    positionCompat: number;
    languageNat: number;
    playStyle: number;
    tactical: number;
    relationship: number;
  };
}

export interface SquadChemistryReport {
  overallChemistry: number; // 0-100
  passingBonus: number; // multiplicador ex: 0.90..1.14
  movementBonus: number;
  positioningBonus: number;
  collectivePlayBonus: number;
  links: {
    slotA: number;
    slotB: number;
    playerAId: string;
    playerBId: string;
    score: number;
  }[];
  playerScores: Record<string, number>;
}

export function calculatePairChemistry(a: Player, b: Player, clubStyle?: string): PairChemistryResult {
  // 1. Tempo jogando juntos (partidas + tempo no clube)
  const matchesTogether = Math.max(
    a.chemistry.matchesWithTeammates[b.id] ?? 0,
    b.chemistry.matchesWithTeammates[a.id] ?? 0,
  );
  const sharedClubTime = Math.min(a.chemistry.daysAtClub, b.chemistry.daysAtClub);
  const timeTogether = clamp(Math.round(matchesTogether * 1.8 + Math.min(sharedClubTime / 18, 20)), 0, 32);

  // 2. Compatibilidade de posições (linhas adjacentes ou mesma zona)
  const gA = POSITION_GROUPS[a.primaryPosition];
  const gB = POSITION_GROUPS[b.primaryPosition];
  let positionCompat = 8;
  if (gA === gB) positionCompat = 14;
  else if (
    (gA === 'GOL' && gB === 'DEF') ||
    (gA === 'DEF' && gB === 'GOL') ||
    (gA === 'DEF' && gB === 'MEI') ||
    (gA === 'MEI' && gB === 'DEF') ||
    (gA === 'MEI' && gB === 'ATA') ||
    (gA === 'ATA' && gB === 'MEI')
  ) {
    positionCompat = 13;
  }

  // 3. Nacionalidade e idioma
  let languageNat = 2;
  if (a.nationality === b.nationality) languageNat = 16;
  else if (a.language === b.language) languageNat = 11;

  // 4. Estilos de jogo
  let playStyle = 6;
  if (a.chemistry.playStyle === b.chemistry.playStyle) playStyle = 14;
  else if (clubStyle && (a.chemistry.playStyle === clubStyle || b.chemistry.playStyle === clubStyle)) {
    playStyle = 10;
  }

  // 5. Entrosamento tático médio
  const avgTac = (a.chemistry.tacticalFamiliarity + b.chemistry.tacticalFamiliarity) / 2;
  const tactical = Math.round((avgTac / 100) * 14);

  // 6. Relação entre companheiros
  const rel = a.chemistry.relationships[b.id] ?? b.chemistry.relationships[a.id] ?? 4;
  const relationship = clamp(Math.round(rel * 0.65), -15, 16);

  const score = clamp(timeTogether + positionCompat + languageNat + playStyle + tactical + relationship, 10, 100);
  const label: PairChemistryResult['label'] =
    score >= 80 ? 'Excelente' : score >= 62 ? 'Forte' : score >= 44 ? 'Moderada' : 'Fraca';

  return {
    score,
    label,
    factors: {
      timeTogether,
      positionCompat,
      languageNat,
      playStyle,
      tactical,
      relationship,
    },
  };
}

export function calculateSquadChemistry(
  club: Club,
  playersMap: Record<string, Player>,
  customXI?: string[],
): SquadChemistryReport {
  const slots = FORMATIONS[club.tactics.formation];
  const xi = customXI ?? club.tactics.startingXI;

  const links: SquadChemistryReport['links'] = [];
  const seenPairs = new Set<string>();
  const playerLinkSums: Record<string, { sum: number; count: number }> = {};

  for (const slot of slots) {
    const pAId = xi[slot.slotIndex];
    const pA = pAId ? playersMap[pAId] : undefined;
    if (!pA) continue;

    for (const neighborIdx of slot.links) {
      const pBId = xi[neighborIdx];
      const pB = pBId ? playersMap[pBId] : undefined;
      if (!pB || pAId === pBId) continue;

      const pairKey = [slot.slotIndex, neighborIdx].sort((x, y) => x - y).join('-');
      if (seenPairs.has(pairKey)) continue;
      seenPairs.add(pairKey);

      const pair = calculatePairChemistry(pA, pB, club.tactics.playStyle);
      links.push({
        slotA: slot.slotIndex,
        slotB: neighborIdx,
        playerAId: pAId,
        playerBId: pBId,
        score: pair.score,
      });

      if (!playerLinkSums[pAId]) playerLinkSums[pAId] = { sum: 0, count: 0 };
      if (!playerLinkSums[pBId]) playerLinkSums[pBId] = { sum: 0, count: 0 };
      playerLinkSums[pAId].sum += pair.score;
      playerLinkSums[pAId].count += 1;
      playerLinkSums[pBId].sum += pair.score;
      playerLinkSums[pBId].count += 1;
    }
  }

  const playerScores: Record<string, number> = {};
  for (const pid of xi) {
    const entry = playerLinkSums[pid];
    playerScores[pid] = entry && entry.count > 0 ? Math.round(entry.sum / entry.count) : 50;
  }

  const overallChemistry =
    links.length > 0 ? Math.round(links.reduce((acc, l) => acc + l.score, 0) / links.length) : 50;

  // Química influencia passes, movimentação, posicionamento e jogadas coletivas
  const centered = (overallChemistry - 60) / 100; // -0.5 a +0.4
  return {
    overallChemistry,
    passingBonus: Number((1 + centered * 0.3).toFixed(3)),
    movementBonus: Number((1 + centered * 0.28).toFixed(3)),
    positioningBonus: Number((1 + centered * 0.25).toFixed(3)),
    collectivePlayBonus: Number((1 + centered * 0.35).toFixed(3)),
    links,
    playerScores,
  };
}

export function updateChemistryAfterMatch(
  playedIds: string[],
  players: Record<string, Player>,
  won: boolean,
  drawn: boolean,
): Record<string, Player> {
  const updated = { ...players };
  const relDelta = won ? 1.6 : drawn ? 0.5 : -0.6;

  for (let i = 0; i < playedIds.length; i++) {
    const idA = playedIds[i];
    const pA = updated[idA];
    if (!pA) continue;
    const matchesMap = { ...pA.chemistry.matchesWithTeammates };
    const relMap = { ...pA.chemistry.relationships };

    for (let j = 0; j < playedIds.length; j++) {
      if (i === j) continue;
      const idB = playedIds[j];
      matchesMap[idB] = (matchesMap[idB] ?? 0) + 1;
      relMap[idB] = clamp(Number(((relMap[idB] ?? 5) + relDelta).toFixed(1)), -20, 30);
    }

    updated[idA] = {
      ...pA,
      chemistry: {
        ...pA.chemistry,
        tacticalFamiliarity: clamp(pA.chemistry.tacticalFamiliarity + (won ? 2 : 1), 20, 100),
        matchesWithTeammates: matchesMap,
        relationships: relMap,
      },
    };
  }
  return updated;
}
