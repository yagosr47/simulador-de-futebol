import {
  Club,
  CoachStaff,
  Player,
  TrainingIntensity,
  TrainingType,
} from '../types/game';
import { clamp, TRAINING_DESCRIPTIONS } from './constants';
import { calculateBaseOverall } from './overall';
import { calculateMarketValue } from './development';
import { computeInjuryRiskForPlayer, generateInjury } from './infirmary';

export interface TrainingSessionResult {
  updatedPlayers: Record<string, Player>;
  attributeGains: { playerId: string; playerName: string; attribute: string; newValue: number }[];
  injuredPlayers: { playerId: string; playerName: string; injuryType: string; days: number }[];
  avgFatigueDelta: number;
  chemistryGain: number;
  summary: string;
}

function getCoachBonusForTraining(coaches: CoachStaff[], type: TrainingType): number {
  if (coaches.length === 0) return 0.75;
  const avgQuality = coaches.reduce((a, c) => a + c.quality, 0) / coaches.length;
  const avgDev = coaches.reduce((a, c) => a + c.developmentAbility, 0) / coaches.length;
  let specialtyBoost = 0;

  for (const c of coaches) {
    if (type === 'Físico' && c.specialty === 'Preparação Física') specialtyBoost += 0.16;
    if ((type === 'Tático' || type === 'Coletivo') && c.specialty === 'Tática e Posicionamento') specialtyBoost += 0.16;
    if ((type === 'Técnico' || type === 'Finalização') && c.specialty === 'Técnica e Finalização') specialtyBoost += 0.16;
    if (type === 'Defensivo' && c.specialty === 'Organização Defensiva') specialtyBoost += 0.16;
    if (type === 'Mental' && c.specialty === 'Psicologia e Liderança') specialtyBoost += 0.16;
    if (type === 'Individual' && c.specialty === 'Desenvolvimento Juvenil') specialtyBoost += 0.14;
  }

  return clamp((avgQuality * 0.5 + avgDev * 0.5) / 72 + Math.min(specialtyBoost, 0.35), 0.7, 1.7);
}

const INTENSITY_MULTIPLIERS: Record<TrainingIntensity, { gain: number; fatigue: number; injury: number }> = {
  Leve: { gain: 0.72, fatigue: 0.6, injury: 0.5 },
  Moderado: { gain: 1.0, fatigue: 1.0, injury: 1.0 },
  Intenso: { gain: 1.45, fatigue: 1.55, injury: 1.85 },
};

export function executeTrainingSession(
  club: Club,
  allPlayers: Record<string, Player>,
  sessionType: TrainingType,
  intensity: TrainingIntensity,
  currentDate: string,
  rng: () => number = Math.random,
): TrainingSessionResult {
  const clubPlayers = Object.values(allPlayers).filter((p) => p.clubId === club.id);
  const updatedPlayers: Record<string, Player> = { ...allPlayers };
  const attributeGains: TrainingSessionResult['attributeGains'] = [];
  const injuredPlayers: TrainingSessionResult['injuredPlayers'] = [];

  const intMod = INTENSITY_MULTIPLIERS[intensity];
  const infraBonus = 1 + (club.stadium.infrastructureLevel - 1) * 0.06;

  let totalFatigueDelta = 0;
  let activeCount = 0;
  let chemistryGain = 0;

  for (const original of clubPlayers) {
    if (original.injury) continue; // Lesionados ficam na enfermaria
    activeCount++;

    const effectiveType: TrainingType =
      sessionType === 'Individual' ? original.individualTrainingFocus ?? 'Técnico' : sessionType;

    const spec = TRAINING_DESCRIPTIONS[effectiveType];
    const coachFactor = getCoachBonusForTraining(club.coaches, effectiveType);

    const p: Player = {
      ...original,
      technical: { ...original.technical },
      physical: { ...original.physical },
      mental: { ...original.mental },
      conditional: { ...original.conditional },
      chemistry: { ...original.chemistry },
    };

    // Fadiga e condicionamento
    let fatigueDelta = Math.round(spec.fatigueBase * (spec.fatigueBase > 0 ? intMod.fatigue : 1));
    if (effectiveType === 'Recuperação Física') {
      p.conditional.fadiga = clamp(p.conditional.fadiga + fatigueDelta, 0, 100);
      p.conditional.condicionamento = clamp(p.conditional.condicionamento + 10, 40, 100);
      p.returnToPlaySharpness = clamp(p.returnToPlaySharpness + 12, 0, 100);
      p.overplayStress = clamp(p.overplayStress - 14, 0, 100);
      p.conditional.moral = clamp(p.conditional.moral + 2, 10, 100);
      totalFatigueDelta += fatigueDelta;
      updatedPlayers[p.id] = p;
      continue;
    }

    // Resistência atenua parte da fadiga
    const staminaBuffer = 1 - ((p.physical.resistencia - 50) / 100) * 0.28;
    fatigueDelta = Math.max(2, Math.round(fatigueDelta * clamp(staminaBuffer, 0.72, 1.2)));
    p.conditional.fadiga = clamp(p.conditional.fadiga + fatigueDelta, 0, 100);
    p.conditional.condicionamento = clamp(p.conditional.condicionamento + (effectiveType === 'Físico' ? 4 : 2), 40, 100);
    p.conditional.ritmoJogo = clamp(p.conditional.ritmoJogo + (effectiveType === 'Coletivo' ? 4 : 1), 30, 100);
    totalFatigueDelta += fatigueDelta;

    if (intensity === 'Intenso' && p.conditional.fadiga > 68) {
      p.overplayStress = clamp(p.overplayStress + 7, 0, 100);
    }

    // Risco de lesão no treino
    const injuryProb = computeInjuryRiskForPlayer(
      p,
      spec.injuryBase * intMod.injury,
      club.medicalStaff,
      club.stadium.infrastructureLevel,
    );
    if (rng() < injuryProb) {
      const inj = generateInjury(p, 'Treinamento', currentDate, club.medicalStaff, rng);
      p.injury = inj;
      p.injuryHistoryCount += 1;
      p.conditional.moral = clamp(p.conditional.moral - 8, 10, 100);
      injuredPlayers.push({
        playerId: p.id,
        playerName: p.shortName,
        injuryType: inj.type,
        days: inj.totalDays,
      });
      updatedPlayers[p.id] = p;
      continue;
    }

    // Química e entrosamento
    if (effectiveType === 'Coletivo' || effectiveType === 'Tático') {
      const tacGain = effectiveType === 'Tático' ? 4 : 3;
      p.chemistry.tacticalFamiliarity = clamp(p.chemistry.tacticalFamiliarity + tacGain, 20, 100);
      chemistryGain += 1;
      // Fortalece relação com companheiros de equipe
      if (effectiveType === 'Coletivo') {
        const rels = { ...p.chemistry.relationships };
        for (const mate of clubPlayers) {
          if (mate.id !== p.id && !mate.injury) {
            rels[mate.id] = clamp(Number(((rels[mate.id] ?? 5) + 0.4).toFixed(1)), -20, 30);
          }
        }
        p.chemistry.relationships = rels;
      }
    }

    if (effectiveType === 'Mental') {
      p.conditional.moral = clamp(p.conditional.moral + 3, 10, 100);
      p.conditional.confianca = clamp(p.conditional.confianca + 3, 10, 100);
    }

    // Cálculo de evolução de atributos (respeitando idade, potencial e determinação)
    const curOvr = calculateBaseOverall(p);
    const hasHeadroom = curOvr < p.potential;
    const ageFactor = p.age <= 21 ? 1.45 : p.age <= 25 ? 1.05 : p.age <= 29 ? 0.65 : 0.3;
    const detFactor = 0.75 + (p.mental.determinacao / 100) * 0.45;
    const roleBonus = p.contract.role === 'Jovem promessa' ? 1.15 : 1.0;

    const progressGain =
      (hasHeadroom ? 24 : 9) * coachFactor * intMod.gain * infraBonus * ageFactor * detFactor * roleBonus;

    p.developmentProgress += Math.round(progressGain);

    if (p.developmentProgress >= 100) {
      p.developmentProgress -= 100;
      const picked = pickAttributeForTraining(p, effectiveType, rng);
      if (picked && picked.current < 99 && (hasHeadroom || rng() < 0.3)) {
        const nextVal = clamp(picked.current + 1, 1, 99);
        picked.apply(p, nextVal);
        attributeGains.push({
          playerId: p.id,
          playerName: p.shortName,
          attribute: picked.label,
          newValue: nextVal,
        });
      }
    }

    p.marketValue = calculateMarketValue(p);
    updatedPlayers[p.id] = p;
  }

  const avgFatigueDelta = activeCount > 0 ? Math.round(totalFatigueDelta / activeCount) : 0;
  const summary =
    sessionType === 'Recuperação Física'
      ? `Sessão regenerativa concluída. Fadiga média reduzida em ${Math.abs(avgFatigueDelta)} pontos.`
      : `Treino ${TRAINING_DESCRIPTIONS[sessionType].label} (${intensity}) concluído: ${attributeGains.length} evoluções de atributo${
          injuredPlayers.length > 0 ? ` e ${injuredPlayers.length} lesão(ões) registrada(s)` : ''
        }.`;

  return {
    updatedPlayers,
    attributeGains,
    injuredPlayers,
    avgFatigueDelta,
    chemistryGain: activeCount > 0 ? Math.round((chemistryGain / activeCount) * 4) : 0,
    summary,
  };
}

function pickAttributeForTraining(
  player: Player,
  type: TrainingType,
  rng: () => number,
): { label: string; current: number; apply: (p: Player, val: number) => void } | null {
  type AttrOption = { label: string; current: number; apply: (p: Player, val: number) => void };
  let options: AttrOption[] = [];

  switch (type) {
    case 'Físico':
      options = [
        { label: 'Velocidade', current: player.physical.velocidade, apply: (p, v) => (p.physical.velocidade = v) },
        { label: 'Aceleração', current: player.physical.aceleracao, apply: (p, v) => (p.physical.aceleracao = v) },
        { label: 'Força', current: player.physical.forca, apply: (p, v) => (p.physical.forca = v) },
        { label: 'Resistência', current: player.physical.resistencia, apply: (p, v) => (p.physical.resistencia = v) },
        { label: 'Agilidade', current: player.physical.agilidade, apply: (p, v) => (p.physical.agilidade = v) },
        { label: 'Equilíbrio', current: player.physical.equilibrio, apply: (p, v) => (p.physical.equilibrio = v) },
        { label: 'Impulsão', current: player.physical.impulsao, apply: (p, v) => (p.physical.impulsao = v) },
      ];
      break;
    case 'Técnico':
      options = [
        { label: 'Passe Curto', current: player.technical.passeCurto, apply: (p, v) => (p.technical.passeCurto = v) },
        { label: 'Passe Longo', current: player.technical.passeLongo, apply: (p, v) => (p.technical.passeLongo = v) },
        { label: 'Drible', current: player.technical.drible, apply: (p, v) => (p.technical.drible = v) },
        { label: 'Controle de Bola', current: player.technical.controleBola, apply: (p, v) => (p.technical.controleBola = v) },
        { label: 'Cruzamento', current: player.technical.cruzamento, apply: (p, v) => (p.technical.cruzamento = v) },
        { label: 'Técnica', current: player.technical.tecnica, apply: (p, v) => (p.technical.tecnica = v) },
      ];
      break;
    case 'Tático':
      options = [
        { label: 'Inteligência Tática', current: player.mental.inteligenciaTatica, apply: (p, v) => (p.mental.inteligenciaTatica = v) },
        { label: 'Visão de Jogo', current: player.mental.visaoJogo, apply: (p, v) => (p.mental.visaoJogo = v) },
        { label: 'Posicionamento', current: player.technical.posicionamento, apply: (p, v) => (p.technical.posicionamento = v) },
        { label: 'Antecipação', current: player.mental.antecipacao, apply: (p, v) => (p.mental.antecipacao = v) },
        { label: 'Trabalho em Equipe', current: player.mental.trabalhoEquipe, apply: (p, v) => (p.mental.trabalhoEquipe = v) },
      ];
      break;
    case 'Mental':
      options = [
        { label: 'Concentração', current: player.mental.concentracao, apply: (p, v) => (p.mental.concentracao = v) },
        { label: 'Decisão', current: player.mental.decisao, apply: (p, v) => (p.mental.decisao = v) },
        { label: 'Determinação', current: player.mental.determinacao, apply: (p, v) => (p.mental.determinacao = v) },
        { label: 'Liderança', current: player.mental.lideranca, apply: (p, v) => (p.mental.lideranca = v) },
        { label: 'Compostura', current: player.mental.compostura, apply: (p, v) => (p.mental.compostura = v) },
      ];
      break;
    case 'Finalização':
      options =
        player.primaryPosition === 'GOL'
          ? [
              { label: 'Reflexos', current: player.technical.reflexos, apply: (p, v) => (p.technical.reflexos = v) },
              { label: 'Defesa (GOL)', current: player.technical.defesaGoleiro, apply: (p, v) => (p.technical.defesaGoleiro = v) },
              { label: 'Posicionamento', current: player.technical.posicionamento, apply: (p, v) => (p.technical.posicionamento = v) },
            ]
          : [
              { label: 'Finalização', current: player.technical.finalizacao, apply: (p, v) => (p.technical.finalizacao = v) },
              { label: 'Cabeceio', current: player.technical.cabeceio, apply: (p, v) => (p.technical.cabeceio = v) },
              { label: 'Bola Parada', current: player.technical.bolaParada, apply: (p, v) => (p.technical.bolaParada = v) },
              { label: 'Compostura', current: player.mental.compostura, apply: (p, v) => (p.mental.compostura = v) },
            ];
      break;
    case 'Defensivo':
      options =
        player.primaryPosition === 'GOL'
          ? [
              { label: 'Jogo Aéreo', current: player.technical.jogoAereo, apply: (p, v) => (p.technical.jogoAereo = v) },
              { label: 'Defesa (GOL)', current: player.technical.defesaGoleiro, apply: (p, v) => (p.technical.defesaGoleiro = v) },
              { label: 'Concentração', current: player.mental.concentracao, apply: (p, v) => (p.mental.concentracao = v) },
            ]
          : [
              { label: 'Marcação', current: player.technical.marcacao, apply: (p, v) => (p.technical.marcacao = v) },
              { label: 'Desarme', current: player.technical.desarme, apply: (p, v) => (p.technical.desarme = v) },
              { label: 'Antecipação', current: player.mental.antecipacao, apply: (p, v) => (p.mental.antecipacao = v) },
              { label: 'Posicionamento', current: player.technical.posicionamento, apply: (p, v) => (p.technical.posicionamento = v) },
              { label: 'Força', current: player.physical.forca, apply: (p, v) => (p.physical.forca = v) },
            ];
      break;
    case 'Coletivo':
    default:
      options = [
        { label: 'Passe Curto', current: player.technical.passeCurto, apply: (p, v) => (p.technical.passeCurto = v) },
        { label: 'Trabalho em Equipe', current: player.mental.trabalhoEquipe, apply: (p, v) => (p.mental.trabalhoEquipe = v) },
        { label: 'Visão de Jogo', current: player.mental.visaoJogo, apply: (p, v) => (p.mental.visaoJogo = v) },
        { label: 'Posicionamento', current: player.technical.posicionamento, apply: (p, v) => (p.technical.posicionamento = v) },
      ];
      break;
  }

  if (options.length === 0) return null;
  return options[Math.floor(rng() * options.length)];
}
