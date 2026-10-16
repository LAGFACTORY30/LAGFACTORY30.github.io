import * as THREE from 'three';

const canvas = document.querySelector('#game-canvas');
const menu = document.querySelector('#menu');
const briefing = document.querySelector('#briefing');
const hud = document.querySelector('#hud');
const gameOver = document.querySelector('#game-over');
const errorPanel = document.querySelector('#error-panel');
const $ = (id) => document.getElementById(id);

let renderer, scene, camera, clock;
let running = false, started = false, paused = false, gameEnded = false;
let yaw = 0, pitch = 0, health = 100, kills = 0, wave = 1, spawnTimer = 0;
let ammo = 12, reserve = 60, rifleAmmo = 30, rifleReserve = 120, weapon = 1;
let reloading = false, reloadTimer = 0, shotCooldown = 0, hurtCooldown = 0;
let toastTimer = 0, damageFlashTimer = 0, muzzleTimer = 0, recoil = 0;
let walkTime = 0, bob = 0, moveX = 0, moveZ = 0, sprinting = false;

const keys = new Set();
const zombies = [];
const bullets = [];
const worldColliders = [];
const raycaster = new THREE.Raycaster();
const clockDelta = new THREE.Vector2();
const tempVec = new THREE.Vector3();
const tempVec2 = new THREE.Vector3();
const sceneBounds = 82;
const isCoarse = matchMedia('(pointer: coarse)').matches;

function showError(message) {
  errorPanel.classList.remove('hidden');
  errorPanel.textContent = 'GAME ERROR\n' + String(message);
}

window.addEventListener('error', e =>
  showError(e.message || e.error || 'Unknown JavaScript error')
);

window.addEventListener('unhandledrejection', e =>
  showError(e.reason || 'Module loading failed')
);

try {
  init();
} catch (e) {
  showError(e.stack || e.message);
}

function init() {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !isCoarse,
    powerPreference: 'high-performance'
  });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = !isCoarse;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x111a1d);
  scene.fog = new THREE.FogExp2(0x111a1d, 0.0125);

  camera = new THREE.PerspectiveCamera(
    74,
    window.innerWidth / window.innerHeight,
    0.1,
    240
  );

  camera.position.set(0, 1.72, 8);
  clock = new THREE.Clock();

  buildWorld();
  buildWeapon();
  bindEvents();
  animate();
}

function mat(color, roughness = 0.9, metalness = 0) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness
  });
}

const materials = {
  asphalt: mat(0x242a29),
  concrete: mat(0x454b47),
  darkConcrete: mat(0x2c3431),
  brick: mat(0x4d3e36),

  glass: new THREE.MeshStandardMaterial({
    color: 0x202e30,
    roughness: 0.25,
    metalness: 0.3
  }),

  metal: mat(0x343b3b, 0.5, 0.55),
  rust: mat(0x70452f, 0.75, 0.2),
  yellow: mat(0xb18a3f),

  blood: new THREE.MeshStandardMaterial({
    color: 0x551b16,
    roughness: 0.9
  }),

  zombieSkin: mat(0x6c8068),
  zombieDark: mat(0x303b34),
  cloth: mat(0x3a4038),

  windowGlow: new THREE.MeshBasicMaterial({
    color: 0x8a6941
  })
};

function addBox(
  parent, x, y, z,
  sx, sy, sz,
  material, cast = true, receive = true
) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(sx, sy, sz),
    material
  );

  mesh.position.set(x, y, z);
  mesh.castShadow = cast && !isCoarse;
  mesh.receiveShadow = receive && !isCoarse;

  parent.add(mesh);
  return mesh;
}

function addCylinder(
  parent, x, y, z,
  rt, rb, h,
  material, segments = 8
) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(rt, rb, h, segments),
    material
  );

  mesh.position.set(x, y, z);
  mesh.castShadow = !isCoarse;

  parent.add(mesh);
  return mesh;
}

function buildWorld() {
  scene.add(
    new THREE.HemisphereLight(0x9daeb7, 0x20201b, 1.15)
  );

  const moon = new THREE.DirectionalLight(0xb2c3d2, 2.0);
  moon.position.set(-22, 38, 16);
  moon.castShadow = !isCoarse;
  moon.shadow.mapSize.set(1024, 1024);
  moon.shadow.camera.left = -50;
  moon.shadow.camera.right = 50;
  moon.shadow.camera.top = 50;
  moon.shadow.camera.bottom = -50;

  scene.add(moon);

  const orangeLight = new THREE.PointLight(
    0xe66c37, 24, 24, 2
  );

  orangeLight.position.set(-7, 4, -9);
  scene.add(orangeLight);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(220, 220),
    materials.asphalt
  );

  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.08;
  ground.receiveShadow = !isCoarse;
  scene.add(ground);

  // Road markings.
  for (let z = -82; z < 82; z += 9) {
    addBox(
      scene, 0, 0.005, z,
      0.12, 0.012, 3.2,
      mat(0x8b8a72), false, false
    );
  }

  for (let side of [-1, 1]) {
    addBox(
      scene, side * 5.2, 0.01, 0,
      0.13, 0.015, 170,
      mat(0x716c5d), false, false
    );
  }

  // Abandoned buildings.
  for (let side of [-1, 1]) {
    for (let i = 0; i < 12; i++) {
      const z = -72 + i * 13 + (Math.random() * 2 - 1);
      const width = 8 + Math.random() * 5;
      const depth = 9 + Math.random() * 5;
      const height = 11 + Math.random() * 22;
      const x = side * (10.5 + width * 0.5);

      const building = new THREE.Group();
      building.position.set(x, 0, z);

      const facades = [
        materials.concrete,
        materials.darkConcrete,
        materials.brick
      ];

      const facade =
        facades[Math.floor(Math.random() * facades.length)];

      addBox(
        building, 0, height / 2, 0,
        width, height, depth, facade
      );

      addBox(
        building, 0, height + 0.18, 0,
        width + 0.35, 0.36, depth + 0.35,
        materials.darkConcrete
      );

      const rows = Math.max(2, Math.floor(height / 3.1));
      const cols = Math.max(2, Math.floor(width / 2.2));

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const wx = -width / 2 + (c + 0.5) * width / cols;
          const wy = 2.0 + r * 2.8;

          if (wy > height - 1) continue;

          const windowMat =
            Math.random() > 0.86
              ? materials.windowGlow
              : materials.glass;

          addBox(
            building,
            wx, wy, depth / 2 + 0.02,
            width / cols * 0.55, 1.15, 0.06,
            windowMat, false, false
          );
        }
      }

      scene.add(building);

      worldColliders.push({
        x,
        z,
        hx: width / 2 + 0.6,
        hz: depth / 2 + 0.6
      });
    }
  }

  // Rubble scattered across the street.
  for (let i = 0; i < 28; i++) {
    const x = (Math.random() * 2 - 1) * 18;
    const z = (Math.random() * 2 - 1) * 76;

    if (Math.abs(x) < 5 && Math.random() > 0.15) continue;

    const rubble = new THREE.Group();
    rubble.position.set(x, 0, z);

    for (let j = 0; j < 4 + Math.floor(Math.random() * 5); j++) {
      const size = 0.25 + Math.random() * 0.8;

      const piece = addBox(
        rubble,
        (Math.random() - 0.5) * 2,
        size * 0.35,
        (Math.random() - 0.5) * 2,
        size, size * 0.7, size,
        j % 2 ? materials.concrete : materials.brick
      );

      piece.rotation.set(
        Math.random() * 0.4,
        Math.random() * Math.PI,
        Math.random() * 0.4
      );
    }

    scene.add(rubble);
  }

  // Wrecked vehicles.
  for (let i = 0; i < 7; i++) {
    const z = -58 + i * 18;
    const x = (i % 2 ? -1 : 1) * (7.5 + Math.random() * 2);

    const car = new THREE.Group();
    car.position.set(x, 0.55, z);
    car.rotation.y = (Math.random() - 0.5) * 0.18;

    addBox(
      car, 0, 0.15, 0,
      3.4, 0.8, 5.7,
      mat(0x303a39, 0.55, 0.25)
    );

    addBox(
      car, 0, 0.78, -0.25,
      2.65, 0.75, 2.7,
      materials.glass
    );

    addBox(
      car, 0, 1.15, -2.15,
      2.9, 0.12, 0.15,
      materials.rust
    );

    for (const wx of [-1.65, 1.65]) {
      for (const wz of [-1.8, 1.8]) {
        const wheel = addCylinder(
          car, wx, -0.12, wz,
          0.43, 0.43, 0.25,
          mat(0x151817), 10
        );

        wheel.rotation.z = Math.PI / 2;
      }
    }

    scene.add(car);

    worldColliders.push({
      x, z, hx: 2.2, hz: 3.1
    });
  }

  // Street barriers.
  for (let i = 0; i < 5; i++) {
    const z = -15 + i * 9;

    const barrier = addBox(
      scene,
      (i % 2 ? -1 : 1) * 6.2,
      0.6, z,
      2.2, 1.2, 0.35,
      materials.yellow
    );

    barrier.rotation.y = (i % 2 ? -0.2 : 0.2);
  }

  // Distant ruined skyline.
  for (let i = 0; i < 32; i++) {
    const side = i % 2 ? -1 : 1;
    const x = side * (36 + Math.random() * 38);
    const z = -90 + Math.random() * 180;
    const h = 15 + Math.random() * 45;

    addBox(
      scene,
      x, h / 2, z,
      7 + Math.random() * 9,
      h,
      8 + Math.random() * 10,
      mat(0x1a2324),
      false, false
    );
  }

  // Floating dust.
  const particlePositions = [];

  for (let i = 0; i < 360; i++) {
    particlePositions.push(
      (Math.random() - 0.5) * 85,
      0.2 + Math.random() * 3.5,
      (Math.random() - 0.5) * 150
    );
  }

  const particleGeo = new THREE.BufferGeometry();

  particleGeo.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(particlePositions, 3)
  );

  const dust = new THREE.Points(
    particleGeo,
    new THREE.PointsMaterial({
      color: 0x9ba6a0,
      size: 0.055,
      transparent: true,
      opacity: 0.32
    })
  );

  scene.add(dust);
}

const weaponRoot = new THREE.Group();

function buildWeapon() {
  camera.add(weaponRoot);
  scene.add(camera);

  weaponRoot.position.set(0.34, -0.29, -0.58);

  setWeaponModel();
}

function setWeaponModel() {
  while (weaponRoot.children.length) {
    const child = weaponRoot.children[0];
    weaponRoot.remove(child);
    child.geometry?.dispose();
  }

  const body = mat(
    weapon === 1 ? 0x252b2b : 0x343a36,
    0.35, 0.65
  );

  const dark = mat(0x0a0c0c, 0.5, 0.2);
  const grip = mat(0x30281f);

  if (weapon === 1) {
    // Pistol.
    addBox(weaponRoot, 0, 0, 0, 0.18, 0.15, 0.42, body);
    addBox(weaponRoot, 0, -0.095, 0.12, 0.13, 0.17, 0.14, grip);
    addBox(weaponRoot, 0, 0.035, -0.28, 0.075, 0.075, 0.32, dark);
    addBox(weaponRoot, 0, 0.085, -0.22, 0.045, 0.018, 0.16, body);
  } else {
    // Rifle.
    addBox(weaponRoot, 0, 0, -0.03, 0.22, 0.18, 0.5, body);
    addBox(weaponRoot, 0, -0.04, -0.38, 0.085, 0.085, 0.5, dark);
    addBox(weaponRoot, 0, 0.1, -0.16, 0.07, 0.035, 0.32, body);
    addBox(weaponRoot, 0, -0.11, 0.18, 0.15, 0.23, 0.2, grip);
    addBox(weaponRoot, 0, -0.04, 0.25, 0.12, 0.12, 0.32, dark);
    addBox(weaponRoot, -0.13, 0.03, -0.1, 0.035, 0.04, 0.42, dark);
  }

  weaponRoot.position.set(0.34, -0.29, -0.58);
}

function updateWeaponHud() {
  $('weapon-name').textContent =
    weapon === 1 ? 'M1911' : 'M4 CARBINE';

  $('ammo').textContent = weapon === 1 ? ammo : rifleAmmo;
  $('reserve').textContent = weapon === 1 ? reserve : rifleReserve;
}

function showToast(message, seconds = 2.1) {
  const el = $('toast');
  el.textContent = message;
  el.classList.add('visible');
  toastTimer = seconds;
}

function startGame() {
  menu.classList.add('hidden');
  briefing.classList.remove('hidden');
}

function deploy() {
  briefing.classList.add('hidden');
  hud.classList.remove('hidden');

  started = true;
  running = true;
  paused = false;
  gameEnded = false;

  health = 100;
  kills = 0;
  wave = 1;

  ammo = 12;
  reserve = 60;
  rifleAmmo = 30;
  rifleReserve = 120;

  zombies.splice(0).forEach(z => scene.remove(z.group));

  camera.position.set(0, 1.72, 8);
  yaw = 0;
  pitch = 0;

  $('health-text').textContent = '100';
  $('health-fill').style.width = '100%';
  $('wave').textContent = '1';

  updateWeaponHud();

  spawnTimer = 1.4;

  showToast('RADIO: Signal detected. Stay alive.', 3.2);

  if (!isCoarse && canvas.requestPointerLock) {
    canvas.requestPointerLock();
  }
}

function bindEvents() {
  window.addEventListener('resize', onResize);

  $('start-button').addEventListener('click', startGame);
  $('deploy-button').addEventListener('click', deploy);

  $('retry-button').addEventListener('click', () => {
    gameOver.classList.add('hidden');
    deploy();
  });

  document.addEventListener('pointerlockchange', () => {
    if (!started || gameEnded) return;

    paused = document.pointerLockElement !== canvas && !isCoarse;

    $('pause-label').classList.toggle('hidden', !paused);
  });

  document.addEventListener('mousemove', e => {
    if (!started || paused || gameEnded) return;

    if (document.pointerLockElement === canvas) {
      yaw -= e.movementX * 0.0022;
      pitch -= e.movementY * 0.0022;

      pitch = THREE.MathUtils.clamp(pitch, -1.25, 1.25);
    }
  });

  document.addEventListener('keydown', e => {
    keys.add(e.code);

    if (
      ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']
      .includes(e.code)
    ) {
      e.preventDefault();
    }

    if (e.code === 'Escape' && started && !gameEnded) {
      paused = true;
    }

    if (e.code === 'KeyR') reload();
    if (e.code === 'Digit1') switchWeapon(1);
    if (e.code === 'Digit2') switchWeapon(2);
  });

  document.addEventListener('keyup', e => keys.delete(e.code));

  canvas.addEventListener('click', () => {
    if (!started || gameEnded) return;

    if (paused && !isCoarse) {
      canvas.requestPointerLock?.();
      return;
    }

    if (!isCoarse && document.pointerLockElement !== canvas) {
      canvas.requestPointerLock?.();
    } else {
      shoot();
    }
  });

  document.addEventListener('mousedown', e => {
    if (
      e.button === 0 &&
      started &&
      !paused &&
      !gameEnded &&
      document.pointerLockElement === canvas
    ) {
      shoot();
    }
  });

  $('mobile-fire').addEventListener('pointerdown', e => {
    e.preventDefault();
    shoot();
  });

  $('mobile-reload').addEventListener('pointerdown', e => {
    e.preventDefault();
    reload();
  });

  // Touch movement joystick.
  const zone = $('stick-zone');
  const knob = $('stick-knob');

  let stickId = null;

  zone.addEventListener('pointerdown', e => {
    stickId = e.pointerId;
    zone.setPointerCapture(stickId);
    updateStick(e);
  });

  zone.addEventListener('pointermove', e => {
    if (e.pointerId === stickId) updateStick(e);
  });

  const stopStick = e => {
    if (e.pointerId === stickId) {
      stickId = null;
      moveX = moveZ = 0;
      knob.style.transform = 'translate(0,0)';
    }
  };

  zone.addEventListener('pointerup', stopStick);
  zone.addEventListener('pointercancel', stopStick);

  function updateStick(e) {
    const r = zone.getBoundingClientRect();

    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);

    const max = 35;
    const len = Math.hypot(dx, dy);
    const scale = len > max ? max / len : 1;

    knob.style.transform =
      `translate(${dx * scale}px, ${dy * scale}px)`;

    moveX = dx * scale / max;
    moveZ = dy * scale / max;
  }

  // Touchscreen camera controls.
  let lookPointer = null;
  let lastX = 0;
  let lastY = 0;

  canvas.addEventListener('pointerdown', e => {
    if (!isCoarse || !started || e.clientX < window.innerWidth * 0.38) {
      return;
    }

    lookPointer = e.pointerId;
    lastX = e.clientX;
    lastY = e.clientY;

    canvas.setPointerCapture(lookPointer);
  });

  canvas.addEventListener('pointermove', e => {
    if (!isCoarse || e.pointerId !== lookPointer) return;

    yaw -= (e.clientX - lastX) * 0.004;
    pitch -= (e.clientY - lastY) * 0.004;

    pitch = THREE.MathUtils.clamp(pitch, -1.2, 1.2);

    lastX = e.clientX;
    lastY = e.clientY;
  });

  canvas.addEventListener('pointerup', e => {
    if (e.pointerId === lookPointer) lookPointer = null;
  });
}function onResize() {
  if (!renderer || !camera) return;

  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function switchWeapon(which) {
  if (!started || which === weapon) return;

  weapon = which;
  reloading = false;

  setWeaponModel();
  updateWeaponHud();

  showToast(
    weapon === 1 ? 'M1911 EQUIPPED' : 'M4 CARBINE EQUIPPED',
    1.2
  );
}

function reload() {
  if (!started || paused || reloading) return;

  const current = weapon === 1 ? ammo : rifleAmmo;
  const reserveNow = weapon === 1 ? reserve : rifleReserve;
  const cap = weapon === 1 ? 12 : 30;

  if (current >= cap || reserveNow <= 0) {
    showToast(
      reserveNow <= 0 ? 'NO AMMO IN RESERVE' : 'MAGAZINE FULL',
      1
    );
    return;
  }

  reloading = true;
  reloadTimer = weapon === 1 ? 1.25 : 1.65;

  showToast('RELOADING...', 0.9);
}

function finishReload() {
  const cap = weapon === 1 ? 12 : 30;

  if (weapon === 1) {
    const n = Math.min(cap - ammo, reserve);
    ammo += n;
    reserve -= n;
  } else {
    const n = Math.min(cap - rifleAmmo, rifleReserve);
    rifleAmmo += n;
    rifleReserve -= n;
  }

  reloading = false;
  updateWeaponHud();
}

function shoot() {
  if (
    !started ||
    paused ||
    gameEnded ||
    reloading ||
    shotCooldown > 0
  ) {
    return;
  }

  const current = weapon === 1 ? ammo : rifleAmmo;

  if (current <= 0) {
    showToast('EMPTY — PRESS R TO RELOAD', 1.1);
    return;
  }

  if (weapon === 1) ammo--;
  else rifleAmmo--;

  updateWeaponHud();

  shotCooldown = weapon === 1 ? 0.28 : 0.105;
  recoil = Math.min(
    recoil + (weapon === 1 ? 0.12 : 0.065),
    0.28
  );

  muzzleTimer = 0.06;

  if (weapon === 1) {
    playTone(115, 0.08, 'sawtooth', 0.08);
  } else {
    playTone(155, 0.055, 'square', 0.045);
  }

  raycaster.setFromCamera(
    new THREE.Vector2(
      (Math.random() - 0.5) * 0.012,
      (Math.random() - 0.5) * 0.012
    ),
    camera
  );

  const targets = [];

  zombies.forEach(z => {
    z.group.traverse(o => {
      if (o.isMesh) targets.push(o);
    });
  });

  const hits = raycaster.intersectObjects(targets, false);

  if (hits.length) {
    let object = hits[0].object;

    while (object && !object.userData.zombieRef) {
      object = object.parent;
    }

    if (object?.userData.zombieRef) {
      damageZombie(
        object.userData.zombieRef,
        weapon === 1 ? 48 : 27
      );
    }
  }
}

function damageZombie(z, damage) {
  if (!z || z.dead) return;

  z.hp -= damage;
  z.flash = 0.12;

  $('hit-marker').classList.remove('show');
  void $('hit-marker').offsetWidth;
  $('hit-marker').classList.add('show');

  if (z.hp <= 0) {
    z.dead = true;
    kills++;

    scene.remove(z.group);

    const idx = zombies.indexOf(z);
    if (idx >= 0) zombies.splice(idx, 1);

    if (kills === 5) {
      showToast('WEAPON UNLOCKED: M4 CARBINE [2]', 3);
    }

    if (kills > 0 && kills % 8 === 0) {
      wave++;

      $('wave').textContent = String(wave);

      reserve += 12;
      rifleReserve += 30;

      updateWeaponHud();

      showToast(
        `WAVE ${wave} INCOMING\nAMMO CACHE SECURED`,
        2.8
      );
    }

    if (kills >= 18) {
      $('objective').textContent =
        'Hold the street — extraction signal charging';
    } else {
      $('objective').textContent =
        `Eliminate infected · ${kills}/18`;
    }

    playTone(420, 0.055, 'sine', 0.035);
  }
}

function spawnZombie() {
  const group = new THREE.Group();

  const spawnSide = Math.random() < 0.5 ? -1 : 1;
  const x = spawnSide * (7 + Math.random() * 10);
  const z = camera.position.z - (24 + Math.random() * 35);

  group.position.set(x, 0, z);
  group.rotation.y = Math.PI;

  const skin = materials.zombieSkin.clone();
  const cloth = materials.zombieDark.clone();

  const torso = addBox(
    group, 0, 1.12, 0,
    0.58, 0.72, 0.34,
    cloth
  );

  const head = addBox(
    group, 0, 1.72, -0.015,
    0.34, 0.36, 0.32,
    skin
  );

  const jaw = addBox(
    group, 0, 1.58, -0.19,
    0.23, 0.09, 0.08,
    materials.blood
  );

  const eyeMat = new THREE.MeshBasicMaterial({
    color: 0xe4a35b
  });

  addBox(
    group, -0.085, 1.76, -0.18,
    0.045, 0.035, 0.018,
    eyeMat, false, false
  );

  addBox(
    group, 0.085, 1.76, -0.18,
    0.045, 0.035, 0.018,
    eyeMat, false, false
  );

  const armL = addBox(
    group, -0.42, 1.12, -0.02,
    0.19, 0.68, 0.2, skin
  );

  armL.rotation.z = -0.22;

  const armR = addBox(
    group, 0.42, 1.12, -0.02,
    0.19, 0.68, 0.2, skin
  );

  armR.rotation.z = 0.22;

  const legL = addBox(
    group, -0.17, 0.48, 0.02,
    0.21, 0.62, 0.24, cloth
  );

  const legR = addBox(
    group, 0.17, 0.48, 0.02,
    0.21, 0.62, 0.24, cloth
  );

  [torso, head, jaw, armL, armR, legL, legR].forEach(m => {
    m.userData.zombieRef = null;
    m.castShadow = !isCoarse;
  });

  const zombie = {
    group,
    hp: 100,
    speed: 1.0 + Math.random() * 0.45 + wave * 0.055,
    attack: 0,
    flash: 0,
    dead: false,
    phase: Math.random() * 4,
    parts: { torso, head, armL, armR, legL, legR }
  };

  group.traverse(o => {
    if (o.isMesh) o.userData.zombieRef = zombie;
  });

  scene.add(group);
  zombies.push(zombie);
}

function hurtPlayer(amount) {
  if (hurtCooldown > 0 || gameEnded) return;

  health = Math.max(0, health - amount);
  hurtCooldown = 0.55;

  $('health-text').textContent = String(health);
  $('health-fill').style.width = `${health}%`;

  $('damage-flash').style.opacity = '0.95';
  damageFlashTimer = 0.22;

  playTone(72, 0.18, 'sawtooth', 0.06);

  if (health <= 0) endGame();
}

function endGame() {
  gameEnded = true;
  running = false;

  document.exitPointerLock?.();

  $('final-stats').textContent =
    `INFECTED ELIMINATED: ${kills}  ·  WAVE REACHED: ${wave}`;

  gameOver.classList.remove('hidden');
}

function playTone(freq, duration, type = 'sine', volume = 0.04) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;

    if (!AudioCtx) return;

    const ctx = playTone.ctx || (playTone.ctx = new AudioCtx());

    if (ctx.state === 'suspended') ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);

    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      ctx.currentTime + duration
    );

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (_) {}
}

function resolveCollision(pos) {
  pos.x = THREE.MathUtils.clamp(pos.x, -sceneBounds, sceneBounds);
  pos.z = THREE.MathUtils.clamp(pos.z, -sceneBounds, sceneBounds);

  for (const c of worldColliders) {
    if (
      Math.abs(pos.x - c.x) < c.hx + 0.35 &&
      Math.abs(pos.z - c.z) < c.hz + 0.35
    ) {
      const dx = pos.x - c.x;
      const dz = pos.z - c.z;

      if (Math.abs(dx) / c.hx > Math.abs(dz) / c.hz) {
        pos.x =
          c.x + Math.sign(dx || 1) * (c.hx + 0.36);
      } else {
        pos.z =
          c.z + Math.sign(dz || 1) * (c.hz + 0.36);
      }
    }
  }
}

function updatePlayer(dt) {
  const forward =
    (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) -
    (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) -
    moveZ;

  const strafe =
    (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) -
    (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) +
    moveX;

  const f = THREE.MathUtils.clamp(forward, -1, 1);
  const s = THREE.MathUtils.clamp(strafe, -1, 1);

  const length = Math.hypot(f, s) || 1;

  sprinting =
    keys.has('ShiftLeft') || keys.has('ShiftRight');

  const speed = sprinting ? 8.1 : 5.2;

  const dx =
    (Math.sin(yaw) * f + Math.cos(yaw) * s) *
    speed * dt / length;

  const dz =
    (-Math.cos(yaw) * f + Math.sin(yaw) * s) *
    speed * dt / length;

  const next = camera.position.clone();

  next.x += dx;
  next.z += dz;

  resolveCollision(next);

  camera.position.x = next.x;
  camera.position.z = next.z;

  const moving = Math.abs(f) + Math.abs(s) > 0.1;

  walkTime += dt * (sprinting ? 12 : 8) * (moving ? 1 : 0);

  bob = moving
    ? Math.sin(walkTime) * 0.018
    : THREE.MathUtils.lerp(bob, 0, dt * 6);

  camera.position.y = 1.72 + bob;

  camera.rotation.order = 'YXZ';
  camera.rotation.y = yaw;
  camera.rotation.x = pitch;

  recoil = Math.max(0, recoil - dt * 0.75);

  weaponRoot.position.y =
    -0.29 + Math.sin(walkTime) * 0.012 * (moving ? 1 : 0)
    - recoil * 0.24;

  weaponRoot.position.x =
    0.34 + Math.cos(walkTime * 0.5) * 0.009 * (moving ? 1 : 0);

  weaponRoot.rotation.x =
    -recoil * 0.55 +
    (reloading ? Math.sin((1.65 - reloadTimer) * 4) * 0.3 : 0);
}

function updateZombies(dt) {
  spawnTimer -= dt;

  const maxZombies = Math.min(12, 4 + wave * 2);

  if (spawnTimer <= 0 && zombies.length < maxZombies) {
    spawnZombie();
    spawnTimer = Math.max(0.85, 2.5 - wave * 0.12);
  }

  for (const z of [...zombies]) {
    const dx = camera.position.x - z.group.position.x;
    const dz = camera.position.z - z.group.position.z;

    const distance = Math.hypot(dx, dz);

    z.phase += dt * 7;

    z.parts.armL.rotation.x = Math.sin(z.phase) * 0.35;
    z.parts.armR.rotation.x = -Math.sin(z.phase) * 0.35;
    z.parts.legL.rotation.x = -Math.sin(z.phase) * 0.3;
    z.parts.legR.rotation.x = Math.sin(z.phase) * 0.3;

    if (z.flash > 0) {
      z.flash -= dt;

      z.parts.torso.material.emissive = new THREE.Color(0x7a1710);

      z.parts.torso.material.emissiveIntensity =
        z.flash > 0 ? 0.8 : 0;
    } else {
      z.parts.torso.material.emissiveIntensity = 0;
    }

    z.group.rotation.y = Math.atan2(dx, dz);

    if (distance > 1.45) {
      const step = z.speed * dt;

      z.group.position.x += dx / distance * step;
      z.group.position.z += dz / distance * step;
    } else {
      z.attack += dt;

      if (z.attack > 0.9) {
        z.attack = 0;
        hurtPlayer(8 + Math.min(wave, 5));
      }
    }
  }
}

function update(dt) {
  if (!started || paused || gameEnded) return;

  shotCooldown = Math.max(0, shotCooldown - dt);
  hurtCooldown = Math.max(0, hurtCooldown - dt);

  if (toastTimer > 0) {
    toastTimer -= dt;

    if (toastTimer <= 0) {
      $('toast').classList.remove('visible');
    }
  }

  if (damageFlashTimer > 0) {
    damageFlashTimer -= dt;

    if (damageFlashTimer <= 0) {
      $('damage-flash').style.opacity = '0';
    }
  }

  if (muzzleTimer > 0) muzzleTimer -= dt;

  if (reloading) {
    reloadTimer -= dt;

    if (reloadTimer <= 0) finishReload();
  }

  updatePlayer(dt);
  updateZombies(dt);
}

function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.04);

  update(dt);
  renderer.render(scene, camera);
}
