import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Club } from '../types/game';
import { Sun, Sunset, Moon, Camera, RotateCcw } from 'lucide-react';

type TimeOfDay = 'day' | 'dusk' | 'night';
type CameraPreset = 'geral' | 'gramado' | 'vip' | 'aerea' | 'placar';

interface Stadium3DViewerProps {
  club: Club;
  occupancyPct: number;
}

function createPitchTexture(pitchQuality: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 640;
  const ctx = canvas.getContext('2d')!;

  const vivid = Math.max(0.75, Math.min(1.08, pitchQuality / 88));
  const stripeCount = 16;
  const stripeW = canvas.width / stripeCount;

  for (let i = 0; i < stripeCount; i++) {
    const g1 = Math.round(130 * vivid);
    const g2 = Math.round(150 * vivid);
    ctx.fillStyle = i % 2 === 0 ? `rgb(24, ${g1}, 58)` : `rgb(30, ${g2}, 68)`;
    ctx.fillRect(i * stripeW, 0, stripeW + 1, canvas.height);
  }

  // Linhas oficiais do gramado
  ctx.strokeStyle = 'rgba(255,255,255,0.92)';
  ctx.lineWidth = 5;
  const pad = 42;
  const w = canvas.width - pad * 2;
  const h = canvas.height - pad * 2;

  ctx.strokeRect(pad, pad, w, h);

  // Linha do meio-campo
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2, pad);
  ctx.lineTo(canvas.width / 2, pad + h);
  ctx.stroke();

  // Círculo central
  ctx.beginPath();
  ctx.arc(canvas.width / 2, canvas.height / 2, 74, 0, Math.PI * 2);
  ctx.stroke();

  // Ponto central
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(canvas.width / 2, canvas.height / 2, 6, 0, Math.PI * 2);
  ctx.fill();

  // Grandes áreas e pequenas áreas
  const boxW = 132;
  const boxH = 310;
  const smallW = 48;
  const smallH = 148;
  ctx.strokeRect(pad, canvas.height / 2 - boxH / 2, boxW, boxH);
  ctx.strokeRect(pad, canvas.height / 2 - smallH / 2, smallW, smallH);
  ctx.strokeRect(pad + w - boxW, canvas.height / 2 - boxH / 2, boxW, boxH);
  ctx.strokeRect(pad + w - smallW, canvas.height / 2 - smallH / 2, smallW, smallH);

  // Meia-lua
  ctx.beginPath();
  ctx.arc(pad + 96, canvas.height / 2, 64, -0.68, 0.68);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(pad + w - 96, canvas.height / 2, 64, Math.PI - 0.68, Math.PI + 0.68);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 8;
  return texture;
}

function createScoreboardTexture(club: Club, occupancyPct: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 192;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#070b14';
  ctx.fillRect(0, 0, 512, 192);

  // Moldura luminosa
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 6;
  ctx.strokeRect(6, 6, 500, 180);

  // Faixa superior
  ctx.fillStyle = club.primaryColor || '#10b981';
  ctx.fillRect(10, 10, 492, 42);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(club.stadium.name.toUpperCase(), 256, 39);

  ctx.fillStyle = '#34d399';
  ctx.font = 'bold 30px monospace';
  ctx.fillText(`${club.shortName}  •  CAP. ${club.stadium.capacity.toLocaleString('pt-BR')}`, 256, 102);

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 20px Inter, sans-serif';
  ctx.fillText(`OCUPAÇÃO PREVISTA: ${occupancyPct}%  |  FATOR CASA +${club.stadium.homeFactorBonus}`, 256, 148);

  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

export const Stadium3DViewer: React.FC<Stadium3DViewerProps> = ({ club, occupancyPct }) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('night');
  const [webglError, setWebglError] = useState<string | null>(null);

  const applyCameraPreset = (preset: CameraPreset) => {
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;
    if (!cam || !ctrl) return;
    if (preset === 'geral') {
      cam.position.set(58, 38, 58);
      ctrl.target.set(0, 3, 0);
    } else if (preset === 'gramado') {
      cam.position.set(-24, 5.5, 16);
      ctrl.target.set(8, 3, 0);
    } else if (preset === 'vip') {
      cam.position.set(0, 18, 34);
      ctrl.target.set(0, 2, -6);
    } else if (preset === 'aerea') {
      cam.position.set(0, 86, 12);
      ctrl.target.set(0, 0, 0);
    } else if (preset === 'placar') {
      cam.position.set(-16, 22, 34);
      ctrl.target.set(36, 14, 0);
    }
    ctrl.update();
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    } catch {
      setWebglError('WebGL não disponível neste dispositivo.');
      return;
    }

    const width = container.clientWidth || 720;
    const height = container.clientHeight || 420;
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const skyColors: Record<TimeOfDay, number> = {
      day: 0x38bdf8,
      dusk: 0x312e81,
      night: 0x060b16,
    };
    scene.background = new THREE.Color(skyColors[timeOfDay]);
    scene.fog = new THREE.FogExp2(skyColors[timeOfDay], timeOfDay === 'night' ? 0.0045 : 0.003);

    const camera = new THREE.PerspectiveCamera(46, width / height, 0.5, 450);
    camera.position.set(58, 38, 58);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.minDistance = 18;
    controls.maxDistance = 135;
    controls.target.set(0, 3, 0);
    controlsRef.current = controls;

    const st = club.stadium;

    // Iluminação ambiente + direcional
    const ambientIntensity = timeOfDay === 'day' ? 1.15 : timeOfDay === 'dusk' ? 0.65 : 0.32;
    scene.add(new THREE.AmbientLight(timeOfDay === 'dusk' ? 0xfda4af : 0xdbeafe, ambientIntensity));

    const sunLight = new THREE.DirectionalLight(
      timeOfDay === 'day' ? 0xfffbeb : timeOfDay === 'dusk' ? 0xfb923c : 0x93c5fd,
      timeOfDay === 'day' ? 1.5 : timeOfDay === 'dusk' ? 1.0 : 0.45,
    );
    sunLight.position.set(45, 70, 35);
    sunLight.castShadow = true;
    scene.add(sunLight);

    // Terreno externo e esplanada da arena
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(260, 260),
      new THREE.MeshStandardMaterial({ color: timeOfDay === 'night' ? 0x0a111f : 0x1e293b, roughness: 0.95 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.35;
    ground.receiveShadow = true;
    scene.add(ground);

    // Anel / esplanada da infraestrutura ao redor do estádio
    const plazaRadius = 56 + st.infrastructureLevel * 2.2;
    const plaza = new THREE.Mesh(
      new THREE.CylinderGeometry(plazaRadius, plazaRadius + 3, 0.4, 48),
      new THREE.MeshStandardMaterial({ color: 0x263248, roughness: 0.85 }),
    );
    plaza.position.y = -0.15;
    plaza.receiveShadow = true;
    scene.add(plaza);

    // Pista ao redor do gramado
    const track = new THREE.Mesh(
      new THREE.BoxGeometry(58, 0.25, 38),
      new THREE.MeshStandardMaterial({ color: 0x0f2922, roughness: 0.9 }),
    );
    track.position.y = -0.02;
    scene.add(track);

    // Gramado oficial com textura
    const pitchTex = createPitchTexture(st.pitchQuality);
    const pitch = new THREE.Mesh(
      new THREE.PlaneGeometry(48, 30),
      new THREE.MeshStandardMaterial({ map: pitchTex, roughness: 0.85 }),
    );
    pitch.rotation.x = -Math.PI / 2;
    pitch.position.y = 0.12;
    pitch.receiveShadow = true;
    scene.add(pitch);

    // Traves nos dois gols
    const goalMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.3, roughness: 0.3 });
    const netMat = new THREE.MeshBasicMaterial({ color: 0xe2e8f0, wireframe: true, transparent: true, opacity: 0.4 });
    [-22.2, 22.2].forEach((gx) => {
      const group = new THREE.Group();
      const post1 = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 2.3), goalMat);
      post1.position.set(gx, 1.25, -2.8);
      const post2 = post1.clone();
      post2.position.z = 2.8;
      const crossbar = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 5.7), goalMat);
      crossbar.rotation.x = Math.PI / 2;
      crossbar.position.set(gx, 2.38, 0);
      const net = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.3, 5.6), netMat);
      net.position.set(gx + (gx < 0 ? -0.7 : 0.7), 1.25, 0);
      group.add(post1, post2, crossbar, net);
      scene.add(group);
    });

    // Cores do clube
    const clubColor = new THREE.Color(club.primaryColor || '#10b981');
    const secColor = new THREE.Color(club.secondaryColor || '#f8fafc');
    const concreteMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.82 });
    const seatPrimaryMat = new THREE.MeshStandardMaterial({ color: clubColor, roughness: 0.65 });
    const seatAccentMat = new THREE.MeshStandardMaterial({ color: secColor, roughness: 0.65 });

    // Arquibancadas (4 lados, com anéis escalando de 1 a 5 conforme standsLevel)
    const tiers = st.standsLevel;
    const crowdPositions: { x: number; y: number; z: number }[] = [];

    const buildStand = (
      length: number,
      distFromCenter: number,
      isHorizontal: boolean,
      sign: number,
      tierCount: number,
    ) => {
      const stepsPerTier = 4;
      for (let t = 0; t < tierCount; t++) {
        for (let s = 0; s < stepsPerTier; s++) {
          const stepIdx = t * stepsPerTier + s;
          const h = 1.1 + stepIdx * 0.85;
          const offset = distFromCenter + stepIdx * 1.15;
          const depth = 1.2;

          const geo = isHorizontal
            ? new THREE.BoxGeometry(length + stepIdx * 0.6, h, depth)
            : new THREE.BoxGeometry(depth, h, length + stepIdx * 0.6);

          const mat = s === 0 ? concreteMat : stepIdx % 3 === 0 ? seatAccentMat : seatPrimaryMat;
          const mesh = new THREE.Mesh(geo, mat);
          mesh.castShadow = true;
          mesh.receiveShadow = true;

          if (isHorizontal) {
            mesh.position.set(0, h / 2, sign * offset);
          } else {
            mesh.position.set(sign * offset, h / 2, 0);
          }
          scene.add(mesh);

          // Registra posições potenciais de torcedores no topo de cada degrau
          const countAlong = Math.floor(length / 1.4);
          for (let k = 0; k < countAlong; k++) {
            const along = -length / 2 + 1 + (k / Math.max(1, countAlong - 1)) * (length - 2);
            if (isHorizontal) {
              crowdPositions.push({ x: along, y: h + 0.32, z: sign * offset });
            } else {
              crowdPositions.push({ x: sign * offset, y: h + 0.32, z: along });
            }
          }
        }
      }

      // Fachada externa da arquibancada
      const outerOffset = distFromCenter + tierCount * stepsPerTier * 1.15 + 0.8;
      const wallH = 1.6 + tierCount * stepsPerTier * 0.85;
      const wallGeo = isHorizontal
        ? new THREE.BoxGeometry(length + tierCount * 3.2, wallH, 1.6)
        : new THREE.BoxGeometry(1.6, wallH, length + tierCount * 3.2);
      const wall = new THREE.Mesh(
        wallGeo,
        new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7, metalness: 0.2 }),
      );
      wall.position.set(isHorizontal ? 0 : sign * outerOffset, wallH / 2, isHorizontal ? sign * outerOffset : 0);
      scene.add(wall);
    };

    buildStand(50, 19.5, true, 1, tiers); // Sul (Principal)
    buildStand(50, 19.5, true, -1, tiers); // Norte (Oposta)
    buildStand(32, 29.5, false, 1, Math.max(1, tiers - (tiers > 3 ? 0 : 1))); // Leste
    buildStand(32, 29.5, false, -1, Math.max(1, tiers - (tiers > 3 ? 0 : 1))); // Oeste

    // Torcida animada (InstancedMesh) proporcional à ocupação!
    const totalCrowdCount = Math.floor(crowdPositions.length * Math.max(0.12, occupancyPct / 100));
    let crowdMesh: THREE.InstancedMesh | null = null;
    if (totalCrowdCount > 0) {
      const personGeo = new THREE.BoxGeometry(0.45, 0.65, 0.45);
      const personMat = new THREE.MeshStandardMaterial({ roughness: 0.6 });
      crowdMesh = new THREE.InstancedMesh(personGeo, personMat, totalCrowdCount);
      const dummy = new THREE.Object3D();
      const palette = [clubColor, secColor, new THREE.Color('#f8fafc'), new THREE.Color('#facc15'), new THREE.Color('#38bdf8')];

      for (let i = 0; i < totalCrowdCount; i++) {
        const idx = Math.floor((i / totalCrowdCount) * crowdPositions.length);
        const pos = crowdPositions[idx];
        dummy.position.set(
          pos.x + (Math.sin(i * 12.9) * 0.25),
          pos.y,
          pos.z + (Math.cos(i * 7.3) * 0.25),
        );
        dummy.updateMatrix();
        crowdMesh.setMatrixAt(i, dummy.matrix);
        crowdMesh.setColorAt(i, palette[i % palette.length]);
      }
      crowdMesh.instanceMatrix.needsUpdate = true;
      if (crowdMesh.instanceColor) crowdMesh.instanceColor.needsUpdate = true;
      scene.add(crowdMesh);
    }

    // Setores VIP (Camarotes de vidro iluminados na arquibancada principal e oposta)
    if (st.vipLevel > 0) {
      const vipY = 2.4 + tiers * 4 * 0.85 * 0.55;
      const vipDist = 19.5 + tiers * 4 * 1.15 * 0.62;
      const vipWidth = Math.min(48, 16 + st.vipLevel * 8);
      const vipGlass = new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xf59e0b,
        emissiveIntensity: timeOfDay === 'day' ? 0.35 : 0.95,
        roughness: 0.2,
        metalness: 0.6,
      });

      const vipMain = new THREE.Mesh(new THREE.BoxGeometry(vipWidth, 2.2, 2.6), vipGlass);
      vipMain.position.set(0, vipY, vipDist);
      scene.add(vipMain);

      if (st.vipLevel >= 3) {
        const vipOpp = vipMain.clone();
        vipOpp.position.set(0, vipY, -vipDist);
        scene.add(vipOpp);
      }
    }

    // Cobertura do estádio (roofLevel 0..4)
    if (st.roofLevel > 0) {
      const roofY = 3.5 + tiers * 4 * 0.85;
      const roofDepth = 4 + tiers * 2.2;
      const roofMat = new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        metalness: 0.45,
        roughness: 0.4,
        side: THREE.DoubleSide,
      });
      const rimMat = new THREE.MeshStandardMaterial({
        color: clubColor,
        emissive: clubColor,
        emissiveIntensity: timeOfDay === 'night' ? 0.7 : 0.2,
      });

      const addRoofSide = (w: number, d: number, x: number, z: number, rotX = 0, rotZ = 0) => {
        const roof = new THREE.Mesh(new THREE.BoxGeometry(w, 0.55, d), roofMat);
        roof.position.set(x, roofY, z);
        roof.rotation.x = rotX;
        roof.rotation.z = rotZ;
        scene.add(roof);

        const rim = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, 0.45), rimMat);
        rim.position.set(x, roofY - 0.35, z + (z > 0 ? -d / 2 : d / 2));
        scene.add(rim);
      };

      const sideDist = 19.5 + tiers * 2.2;
      // Nível 1: Sul | Nível 2: Sul + Norte | Nível 3: + Leste | Nível 4: 360° completo
      addRoofSide(54, roofDepth, 0, sideDist, 0.08, 0);
      if (st.roofLevel >= 2) {
        addRoofSide(54, roofDepth, 0, -sideDist, -0.08, 0);
      }
      if (st.roofLevel >= 3) {
        const endDist = 29.5 + tiers * 2.1;
        const rEast = new THREE.Mesh(new THREE.BoxGeometry(roofDepth, 0.55, 42), roofMat);
        rEast.position.set(endDist, roofY, 0);
        scene.add(rEast);
      }
      if (st.roofLevel >= 4) {
        const endDist = 29.5 + tiers * 2.1;
        const rWest = new THREE.Mesh(new THREE.BoxGeometry(roofDepth, 0.55, 42), roofMat);
        rWest.position.set(-endDist, roofY, 0);
        scene.add(rWest);
      }
    }

    // 4 Torres de Iluminação LED (lightingLevel 1..4)
    const towerHeight = 20 + st.lightingLevel * 4.5 + tiers * 1.8;
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.7, roughness: 0.35 });
    const lampMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xe0f2fe,
      emissiveIntensity: timeOfDay === 'day' ? 0.25 : 1.4 + st.lightingLevel * 0.3,
    });

    const cornerX = 33 + tiers * 2.2;
    const cornerZ = 24 + tiers * 2.2;
    const corners: [number, number][] = [
      [cornerX, cornerZ],
      [-cornerX, cornerZ],
      [cornerX, -cornerZ],
      [-cornerX, -cornerZ],
    ];

    corners.forEach(([cx, cz]) => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.8, towerHeight, 8), poleMat);
      pole.position.set(cx, towerHeight / 2, cz);
      scene.add(pole);

      const headW = 3.2 + st.lightingLevel * 0.8;
      const headH = 2.0 + st.lightingLevel * 0.45;
      const head = new THREE.Mesh(new THREE.BoxGeometry(headW, headH, 0.7), lampMat);
      head.position.set(cx, towerHeight, cz);
      head.lookAt(0, 0, 0);
      scene.add(head);

      if (timeOfDay !== 'day') {
        const flood = new THREE.PointLight(0xe0f2fe, 140 + st.lightingLevel * 65, 130, 1.5);
        flood.position.set(cx * 0.88, towerHeight - 1, cz * 0.88);
        scene.add(flood);
      }
    });

    // Placar Eletrônico 4K (modernizationLevel 1..4)
    const sbTex = createScoreboardTexture(club, occupancyPct);
    const sbW = 14 + st.modernizationLevel * 2.4;
    const sbH = 5.2 + st.modernizationLevel * 0.7;
    const sbY = 6.5 + tiers * 3.1;
    const sbDist = 30.5 + tiers * 4.4;

    const sbFrame = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, sbH + 0.8, sbW + 0.8),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.6, roughness: 0.3 }),
    );
    sbFrame.position.set(sbDist, sbY, 0);
    scene.add(sbFrame);

    const sbScreen = new THREE.Mesh(
      new THREE.PlaneGeometry(sbW, sbH),
      new THREE.MeshBasicMaterial({ map: sbTex }),
    );
    sbScreen.position.set(sbDist - 0.62, sbY, 0);
    sbScreen.rotation.y = -Math.PI / 2;
    scene.add(sbScreen);

    if (st.modernizationLevel >= 3) {
      const sbFrame2 = sbFrame.clone();
      sbFrame2.position.set(-sbDist, sbY, 0);
      scene.add(sbFrame2);
      const sbScreen2 = new THREE.Mesh(
        new THREE.PlaneGeometry(sbW, sbH),
        new THREE.MeshBasicMaterial({ map: sbTex }),
      );
      sbScreen2.position.set(-sbDist + 0.62, sbY, 0);
      sbScreen2.rotation.y = Math.PI / 2;
      scene.add(sbScreen2);
    }

    // Prédios auxiliares / CT de infraestrutura ao redor
    const buildingMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.65 });
    for (let b = 0; b < st.infrastructureLevel; b++) {
      const angle = (b / Math.max(1, st.infrastructureLevel)) * Math.PI * 1.4 + 0.5;
      const dist = plazaRadius - 7;
      const bld = new THREE.Mesh(new THREE.BoxGeometry(8, 3.5 + b * 0.8, 5.5), buildingMat);
      bld.position.set(Math.cos(angle) * dist, (3.5 + b * 0.8) / 2, Math.sin(angle) * dist);
      bld.lookAt(0, 2, 0);
      scene.add(bld);
    }

    // Guindaste animado se houver obra em andamento!
    let craneArm: THREE.Group | null = null;
    if (st.activeConstructions.length > 0) {
      const craneMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.4, roughness: 0.5 });
      const craneBase = new THREE.Mesh(new THREE.BoxGeometry(1.6, 30, 1.6), craneMat);
      craneBase.position.set(cornerX + 9, 15, 0);
      scene.add(craneBase);

      craneArm = new THREE.Group();
      craneArm.position.set(cornerX + 9, 29.5, 0);
      const boom = new THREE.Mesh(new THREE.BoxGeometry(22, 1.2, 1.2), craneMat);
      boom.position.set(-7, 0, 0);
      craneArm.add(boom);
      scene.add(craneArm);
    }

    // Resize listener
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 720;
      const h = container.clientHeight || 420;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Loop de animação
    let rafId = 0;
    const clock = new THREE.Clock();
    const animate = () => {
      rafId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      if (crowdMesh) {
        crowdMesh.position.y = Math.sin(t * 4.2) * 0.06;
      }
      if (craneArm) {
        craneArm.rotation.y = Math.sin(t * 0.35) * 0.5;
      }
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleResize);
      controls.dispose();
      renderer.dispose();
      pitchTex.dispose();
      sbTex.dispose();
    };
  }, [club, occupancyPct, timeOfDay]);

  if (webglError) {
    return (
      <div className="h-[420px] rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center p-6 text-center">
        <div>
          <p className="text-sm font-bold text-slate-200">{club.stadium.name}</p>
          <p className="text-xs text-slate-400 mt-1">{webglError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative rounded-2xl overflow-hidden border border-slate-700/80 bg-[#060b16] shadow-2xl">
      <div ref={mountRef} className="w-full h-[410px] sm:h-[470px] cursor-grab active:cursor-grabbing" />

      {/* Overlay superior: título & iluminação */}
      <div className="absolute top-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="pointer-events-auto px-3.5 py-2 rounded-xl bg-slate-950/80 backdrop-blur-md border border-slate-700/80">
          <p className="text-xs font-black text-white">{club.stadium.name}</p>
          <p className="text-[11px] text-emerald-300 tabular-nums">
            {club.stadium.capacity.toLocaleString('pt-BR')} lugares • Ocupação {occupancyPct}%
            {club.stadium.activeConstructions.length > 0 && ' • Em Obras'}
          </p>
        </div>

        <div className="pointer-events-auto flex items-center gap-1 p-1 rounded-xl bg-slate-950/80 backdrop-blur-md border border-slate-700/80">
          <button
            onClick={() => setTimeOfDay('day')}
            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors ${
              timeOfDay === 'day' ? 'bg-sky-500/25 text-sky-200' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sun className="w-3.5 h-3.5" /> Dia
          </button>
          <button
            onClick={() => setTimeOfDay('dusk')}
            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors ${
              timeOfDay === 'dusk' ? 'bg-amber-500/25 text-amber-200' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sunset className="w-3.5 h-3.5" /> Tarde
          </button>
          <button
            onClick={() => setTimeOfDay('night')}
            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors ${
              timeOfDay === 'night' ? 'bg-indigo-500/30 text-indigo-200' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Moon className="w-3.5 h-3.5" /> Noite
          </button>
        </div>
      </div>

      {/* Overlay inferior: presets de câmera */}
      <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="pointer-events-auto flex flex-wrap items-center gap-1.5 p-1.5 rounded-xl bg-slate-950/80 backdrop-blur-md border border-slate-700/80">
          <span className="text-[10px] font-bold uppercase text-slate-400 px-1.5 flex items-center gap-1">
            <Camera className="w-3 h-3" /> Câmera:
          </span>
          {(
            [
              ['geral', 'Geral'],
              ['gramado', 'Gramado'],
              ['vip', 'VIP'],
              ['placar', 'Placar 4K'],
              ['aerea', 'Aérea'],
            ] as [CameraPreset, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => applyCameraPreset(id)}
              className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-emerald-600/80 text-[11px] font-semibold text-slate-200 hover:text-white transition-colors"
            >
              {label}
            </button>
          ))}
        </div>

        <button
          onClick={() => applyCameraPreset('geral')}
          className="pointer-events-auto px-2.5 py-1.5 rounded-xl bg-slate-950/80 border border-slate-700/80 text-[11px] text-slate-300 hover:text-white flex items-center gap-1"
          title="Arraste para girar • Scroll para zoom"
        >
          <RotateCcw className="w-3 h-3" /> Resetar Vista
        </button>
      </div>
    </div>
  );
};
