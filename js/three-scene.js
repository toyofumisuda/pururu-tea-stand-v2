// タピオカドリンクの3Dシーン（画像やモデルファイルを使わず、コードだけで組み立てる）
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// 味ごとの色。liquid＝ドリンク、syrup＝底のシロップ（タピオカが沈んでいる層）
export const FLAVORS = {
  milk:   { liquid: '#C29469', syrup: '#8B5A3A', syrupO: 0.38 },
  matcha: { liquid: '#A3BA78', syrup: '#5E7A3A', syrupO: 0.4 },
  berry:  { liquid: '#EDB7B5', syrup: '#D25F6A', syrupO: 0.6 },
  kokuto: { liquid: '#D6B796', syrup: '#3E200F', syrupO: 0.86 },
};

export function canUseWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) {
    return false;
  }
}

// 端末に合わせて、粒の数と描画の細かさを決める
export function detectQuality() {
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const small = Math.min(window.screen.width, window.screen.height) < 768 || coarse;
  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 4;
  const low = cores <= 4 || memory <= 3;
  const dpr = window.devicePixelRatio || 1;
  return {
    pearls: low ? 20 : small ? 24 : 30,
    dpr: Math.min(dpr, low ? 1 : small ? 1.5 : 2),
    antialias: !small,
    seg: low ? 32 : small ? 40 : 64,
    sphereSeg: low ? 10 : 16,
  };
}

// カップの寸法
const H = 3.2;          // 高さ
const RB = 0.82;        // 底の半径
const RT = 1.08;        // 口の半径
const LIQ_TOP = 2.55;   // ドリンクの水面
const PEARL_R = 0.15;
const rIn = (y) => RB + (RT - RB) * (y / H) - 0.05; // 高さ y でのカップ内側の半径

function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// タピオカ粒を、底から順に層になるように並べる
function pearlSpots(max) {
  const spots = [];
  const rand = seeded(7);
  const layers = [0.2, 0.46, 0.72, 0.98, 1.22];
  layers.forEach((y, li) => {
    let ring = rIn(y) - PEARL_R - 0.03;
    while (ring > 0.12) {
      const n = Math.max(1, Math.floor((2 * Math.PI * ring) / (PEARL_R * 2.12)));
      const offset = li * 0.37 + ring;
      for (let i = 0; i < n; i++) {
        const a = offset + (i / n) * Math.PI * 2;
        spots.push({
          x: Math.cos(a) * ring,
          y: y + (rand() - 0.5) * 0.05,
          z: Math.sin(a) * ring,
          ph: rand() * Math.PI * 2,
          sp: 0.7 + rand() * 0.6,
          outer: ring > rIn(y) - 0.3,
        });
      }
      ring -= PEARL_R * 2.05;
    }
  });
  // 外側（カップ越しに見える位置）を優先して、下の層から使う
  spots.sort((a, b) => (Math.round(a.y * 4) - Math.round(b.y * 4)) || (b.outer - a.outer));
  return spots.slice(0, max);
}

function shadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, 'rgba(91,59,42,0.42)');
  grad.addColorStop(0.45, 'rgba(91,59,42,0.16)');
  grad.addColorStop(1, 'rgba(91,59,42,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createDrinkScene(canvas, opts = {}) {
  const q = opts.quality || detectQuality();
  const extraPearls = 10;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: q.antialias,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(q.dpr);
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
  const CAM_Z = 13;
  camera.position.set(0, 1.1, CAM_Z);
  camera.lookAt(0, 0.15, 0);

  // ふんわりした光：空からの柔らかい光＋暖色の主光＋ピンクの逆光
  scene.add(new THREE.HemisphereLight(0xfff6ea, 0xd9c2a3, 0.7));
  const key = new THREE.DirectionalLight(0xffe6c8, 1.7);
  key.position.set(3.5, 6, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffd2cc, 0.9);
  rim.position.set(-4, 3, -4);
  scene.add(rim);

  // 入れ子：place（位置）> tilt（傾き）> spin（回転）> content（カップ一式）
  const place = new THREE.Group();
  const tilt = new THREE.Group();
  const spin = new THREE.Group();
  const content = new THREE.Group();
  content.position.y = -1.75;
  scene.add(place);
  place.add(tilt);
  tilt.add(spin);
  spin.add(content);

  // 床に落ちるやわらかい影
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(4.2, 4.2),
    new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -1.76;
  shadow.renderOrder = 0;
  place.add(shadow);

  // ---- ドリンク ----
  const liquidMat = new THREE.MeshStandardMaterial({ color: FLAVORS.milk.liquid, roughness: 0.38, metalness: 0 });
  const syrupMat = new THREE.MeshStandardMaterial({
    color: FLAVORS.milk.syrup, roughness: 0.25, transparent: true, opacity: FLAVORS.milk.syrupO, depthWrite: false,
  });
  const liquid = new THREE.Mesh(new THREE.BufferGeometry(), liquidMat);
  const syrup = new THREE.Mesh(new THREE.BufferGeometry(), syrupMat);
  syrup.renderOrder = 1;
  content.add(liquid, syrup);

  let boundary = 0.84;      // シロップ層とドリンクの境目
  let boundaryTarget = 0.84;
  function buildLiquid(b) {
    liquid.geometry.dispose();
    syrup.geometry.dispose();
    liquid.geometry = new THREE.CylinderGeometry(rIn(LIQ_TOP), rIn(b), LIQ_TOP - b, q.seg);
    liquid.position.y = (LIQ_TOP + b) / 2;
    syrup.geometry = new THREE.CylinderGeometry(rIn(b), rIn(0.05), b - 0.05, q.seg, 1, true);
    syrup.position.y = (b + 0.05) / 2;
  }
  buildLiquid(boundary);

  // ---- タピオカ粒 ----
  const spots = pearlSpots(q.pearls + extraPearls);
  const pearlMat = new THREE.MeshPhysicalMaterial({
    color: 0x2a1810, roughness: 0.22, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.15, sheen: 0.4, sheenColor: 0x7a4a33,
    transparent: true, opacity: 1, // シロップ層より後に描いて、粒がカップ越しにはっきり見えるようにする
  });
  const pearls = new THREE.InstancedMesh(
    new THREE.SphereGeometry(PEARL_R, q.sphereSeg, Math.round(q.sphereSeg * 0.75)),
    pearlMat,
    spots.length
  );
  pearls.count = Math.min(q.pearls, spots.length);
  pearls.renderOrder = 2;
  content.add(pearls);

  // ---- トッピング ----
  const foam = new THREE.Mesh(
    new THREE.CylinderGeometry(rIn(2.95), rIn(LIQ_TOP - 0.02), 0.4, q.seg),
    new THREE.MeshStandardMaterial({ color: 0xfff3e0, roughness: 0.92 })
  );
  foam.position.y = LIQ_TOP + 0.18;
  foam.scale.y = 0.001;
  foam.visible = false;
  content.add(foam);

  const rand = seeded(42);
  const nataMat = new THREE.MeshPhysicalMaterial({ color: 0xfffaf0, roughness: 0.15, transparent: true, opacity: 0.85, clearcoat: 1 });
  const nata = new THREE.Group();
  for (let i = 0; i < 9; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.17, 0.17), nataMat);
    const a = (i / 9) * Math.PI * 2 + 0.2;
    const r = rIn(0.5) - 0.12;
    m.position.set(Math.cos(a) * r, 0.25 + rand() * 0.5, Math.sin(a) * r);
    m.rotation.set(rand() * 3, rand() * 3, rand() * 3);
    nata.add(m);
  }
  nata.visible = false;
  content.add(nata);

  const azukiMat = new THREE.MeshStandardMaterial({ color: 0x6e2a26, roughness: 0.4 });
  const azuki = new THREE.Group();
  const azukiGeo = new THREE.SphereGeometry(0.075, 10, 8);
  for (let i = 0; i < 16; i++) {
    const m = new THREE.Mesh(azukiGeo, azukiMat);
    const a = (i / 16) * Math.PI * 2;
    const y = 0.15 + rand() * 0.6;
    const r = rIn(y) - 0.08;
    m.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
    m.scale.set(1, 0.8, 1.15);
    azuki.add(m);
  }
  azuki.visible = false;
  content.add(azuki);

  // ---- 氷 ----
  const iceMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.55, clearcoat: 1, depthWrite: false,
  });
  const ice = [];
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), iceMat);
    const a = (i / 6) * Math.PI * 2 + 0.4;
    const r = i % 2 ? 0.42 : 0.18;
    m.userData = { x: Math.cos(a) * r, z: Math.sin(a) * r, ph: rand() * 6, rot: [rand() * 0.6, rand() * 3, rand() * 0.6] };
    m.position.set(m.userData.x, LIQ_TOP + 0.02, m.userData.z);
    m.rotation.set(...m.userData.rot);
    m.renderOrder = 2;
    m.visible = false;
    content.add(m);
    ice.push(m);
  }

  // ---- カップ・ふた・ストロー ----
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.26,
    clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.5, side: THREE.DoubleSide, depthWrite: false,
  });
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(RT, RB, H, q.seg, 1, true), glassMat);
  cup.position.y = H / 2;
  cup.renderOrder = 3;
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(RB, q.seg), glassMat);
  bottom.rotation.x = -Math.PI / 2;
  bottom.position.y = 0.01;
  bottom.renderOrder = 3;
  content.add(cup, bottom);

  const lid = new THREE.Mesh(
    new THREE.SphereGeometry(RT + 0.03, q.seg, 14, 0, Math.PI * 2, 0, Math.PI * 0.42),
    glassMat
  );
  lid.scale.y = 0.48;
  lid.position.y = H;
  lid.renderOrder = 4;
  const rimRing = new THREE.Mesh(
    new THREE.TorusGeometry(RT + 0.03, 0.055, 10, q.seg),
    new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.2, transparent: true, opacity: 0.75, clearcoat: 1 })
  );
  rimRing.rotation.x = Math.PI / 2;
  rimRing.position.y = H;
  content.add(lid, rimRing);

  const strawMat = new THREE.MeshPhysicalMaterial({
    color: 0xc88e8c, roughness: 0.3, metalness: 0, transparent: true, opacity: 0.92, clearcoat: 0.6,
  });
  const straw = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 4.7, 28, 1, true), strawMat);
  straw.position.set(0.2, 2.45, 0.05);
  straw.rotation.z = -0.2;
  content.add(straw);

  // ---- 状態と、滑らかに近づける目標値 ----
  const state = {
    liquid: new THREE.Color(FLAVORS.milk.liquid),
    syrup: new THREE.Color(FLAVORS.milk.syrup),
    syrupO: FLAVORS.milk.syrupO,
  };
  const target = {
    flavor: 'milk',
    sweet: 0.6,
    pose: { fx: 0, fy: 0, scale: 1, turn: 0 },
    tiltX: 0, tiltZ: 0,
    ice: 0,
    toppings: { pearl: false, foam: false, nata: false, azuki: false },
  };
  const cur = { fx: 0, fy: 0, scale: opts.startScale ?? 0.6, turn: 0, tiltX: 0, tiltZ: 0, foam: 0 };
  const WHITE = new THREE.Color('#FFF6EA');
  const tmpColor = new THREE.Color();
  let spinBase = opts.startAngle ?? -0.6;

  function liquidGoal() {
    const f = FLAVORS[target.flavor];
    const paler = 0.22 * (1 - target.sweet / 1.2); // 甘さ控えめほど、色を淡く
    return tmpColor.set(f.liquid).lerp(WHITE, paler);
  }

  let width = 1;
  let height = 1;
  function resize() {
    width = canvas.clientWidth || 1;
    height = canvas.clientHeight || 1;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  const dummy = new THREE.Object3D();
  const clock = new THREE.Clock();
  let elapsed = 0;

  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    elapsed += dt;
    const k = 1 - Math.exp(-dt * 4);
    const kSlow = 1 - Math.exp(-dt * 2.6);

    // 位置と大きさ（画面の割合 → 3D空間の距離）
    const visH = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * CAM_Z;
    const visW = visH * camera.aspect;
    const p = target.pose;
    cur.fx += (p.fx - cur.fx) * kSlow;
    cur.fy += (p.fy - cur.fy) * kSlow;
    cur.scale += (p.scale - cur.scale) * kSlow;
    cur.turn += (p.turn - cur.turn) * kSlow;
    place.position.set(cur.fx * visW, cur.fy * visH, 0);
    const fit = Math.min(1, camera.aspect / 0.62); // 縦長の画面では少し小さく
    place.scale.setScalar(cur.scale * (0.72 + 0.28 * fit));

    // 自動回転＋スクロールでの回転、指やマウスでの傾き
    spinBase += dt * (opts.spinSpeed ?? 0.32);
    spin.rotation.y = spinBase + cur.turn;
    cur.tiltX += (target.tiltX - cur.tiltX) * k;
    cur.tiltZ += (target.tiltZ - cur.tiltZ) * k;
    tilt.rotation.x = cur.tiltX + Math.sin(elapsed * 0.8) * 0.025;
    tilt.rotation.z = cur.tiltZ + Math.cos(elapsed * 0.6) * 0.02;

    // 味と甘さの色
    state.liquid.lerp(liquidGoal(), k);
    liquidMat.color.copy(state.liquid);
    const f = FLAVORS[target.flavor];
    state.syrup.lerp(tmpColor.set(f.syrup), k);
    syrupMat.color.copy(state.syrup);
    const syrupGoal = f.syrupO * (0.45 + 0.55 * (target.sweet / 1.2));
    state.syrupO += (syrupGoal - state.syrupO) * k;
    syrupMat.opacity = state.syrupO;

    // タピオカ増量のときは、シロップ層を少し高く
    if (Math.abs(boundaryTarget - boundary) > 0.002) {
      boundary += (boundaryTarget - boundary) * k;
      buildLiquid(boundary);
    }

    // タピオカ粒のふわふわ
    for (let i = 0; i < pearls.count; i++) {
      const s = spots[i];
      const t = elapsed * s.sp + s.ph;
      dummy.position.set(s.x + Math.sin(t * 0.7) * 0.012, s.y + Math.sin(t) * 0.028, s.z + Math.cos(t * 0.8) * 0.012);
      dummy.rotation.set(t * 0.2, t * 0.3, 0);
      dummy.updateMatrix();
      pearls.setMatrixAt(i, dummy.matrix);
    }
    pearls.instanceMatrix.needsUpdate = true;

    // 氷はぷかぷか
    ice.forEach((m, i) => {
      const u = m.userData;
      m.position.y = LIQ_TOP + 0.06 + 0.34 * cur.foam + Math.sin(elapsed * 1.3 + u.ph) * 0.03;
      m.rotation.y = u.rot[1] + Math.sin(elapsed * 0.5 + i) * 0.1;
    });

    // チーズフォームは、ぷるんと出てくる
    const foamGoal = target.toppings.foam ? 1 : 0;
    cur.foam += (foamGoal - cur.foam) * (1 - Math.exp(-dt * 7));
    foam.visible = cur.foam > 0.01;
    foam.scale.y = Math.max(0.001, cur.foam);
    foam.position.y = LIQ_TOP - 0.02 + 0.2 * cur.foam;

    renderer.render(scene, camera);
  }

  // 画面に見えている間だけ描く
  let onScreen = true;
  let running = false;
  function update() {
    const should = onScreen && !document.hidden;
    if (should === running) return;
    running = should;
    if (running) clock.getDelta();
    renderer.setAnimationLoop(running ? frame : null);
  }
  const io = new IntersectionObserver((entries) => {
    onScreen = entries[0].isIntersecting;
    update();
  }, { rootMargin: '80px' });
  io.observe(canvas);
  document.addEventListener('visibilitychange', update);
  update();

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    renderer.setAnimationLoop(null);
    if (opts.onFail) opts.onFail();
  });

  function applyIce(level) {
    const n = [0, 2, 4, 6][level] ?? 0;
    ice.forEach((m, i) => { m.visible = i < n; });
  }

  return {
    setFlavor(key) {
      if (FLAVORS[key]) target.flavor = key;
    },
    setPose(pose) {
      Object.assign(target.pose, pose);
    },
    setPointer(nx, ny) {
      target.tiltX = ny * 0.16;
      target.tiltZ = -nx * 0.16;
    },
    setSweetness(v) {
      target.sweet = Math.max(0, Math.min(1.2, v));
    },
    setIce(level) {
      target.ice = level;
      applyIce(level);
    },
    setToppings(t) {
      Object.assign(target.toppings, t);
      pearls.count = Math.min(spots.length, q.pearls + (target.toppings.pearl ? extraPearls : 0));
      boundaryTarget = target.toppings.pearl ? 1.0 : 0.84;
      nata.visible = !!target.toppings.nata;
      azuki.visible = !!target.toppings.azuki;
    },
    resize,
  };
}
