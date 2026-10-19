
import * as THREE from 'three';

// JORDAN'S APOCALYPSE Z — 3D campaign
// Initialization is at the very bottom of this file.

const $ = (id) => document.getElementById(id);
const canvas = $('game-canvas');
const menu = $('menu');
const briefing = $('briefing');
const hud = $('hud');
const gameOver = $('game-over');
const errorPanel = $('error-panel');

let renderer, scene, camera, clock;
let worldReady = false;
let started = false;
let paused = false;
let gameEnded = false;
let yaw = 0;
let pitch = 0;
let health = 100;
let kills = 0;
let wave = 1;
let ammo = 12;
let reserve = 60;
let rifleAmmo = 30;
let rifleReserve = 120;
let weapon = 1;
let reloadTimer = 0;
let shotCooldown = 0;
let spawnTimer = 1.5;
let hurtCooldown = 0;
let toastTimer = 0;
let damageTimer = 0;
let recoil = 0;
let nightVision = false;
let moonLight = null;
let ambientLight = null;
let elapsed = 0;
let moveX = 0;
let moveZ = 0;
let joystickPointer = null;
let lookPointer = null;
let lastLookX = 0;
let lastLookY = 0;

const keys = new Set();
const zombies = [];
const colliders = [];
const raycaster = new THREE.Raycaster();
const sceneBounds = 82;
const isCoarse = matchMedia('(pointer: coarse)').matches;

function showError(error) {
  const message = error && (error.stack || error.message)
    ? (error.stack || error.message)
    : String(error);

  console.error(message);

  if (errorPanel) {
    errorPanel.classList.remove('hidden');
    errorPanel.textContent = 'GAME ERROR\n' + message;
  }
}

window.addEventListener('error', (event) => {
  showError(event.error || event.message || 'Unknown JavaScript error');
});

window.addEventListener('unhandledrejection', (event) => {
  showError(event.reason || 'Module loading failed');
});

function makeMaterial(color, roughness = 0.9, metalness = 0) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness
  });
}

// Materials must exist before init() calls buildWorld().
const materials = {
  asphalt: makeMaterial(0x202726),
  concrete: makeMaterial(0x454b47),
  darkConcrete: makeMaterial(0x29312f),
  brick: makeMaterial(0x493a33),
  glass: makeMaterial(0x17272a, 0.25, 0.25),
  metal: makeMaterial(0x343b3b, 0.48, 0.6),
  rust: makeMaterial(0x70452f, 0.8, 0.15),
  yellow: makeMaterial(0x8b7138),
  blood: makeMaterial(0x4d1714),
  zombieSkin: makeMaterial(0x6b8067),
  zombieDark: makeMaterial(0x303b34),
  cloth: makeMaterial(0x343b34),
  windowGlow: new THREE.MeshBasicMaterial({
    color: 0x9b6738
  })
};

const weaponRoot = new THREE.Group();

function addBox(
  parent, x, y, z,
  sx, sy, sz, mat,
  cast = true, receive = true
) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(sx, sy, sz),
    mat
  );

  mesh.position.set(x, y, z);
  mesh.castShadow = cast && !isCoarse;
  mesh.receiveShadow = receive && !isCoarse;
  parent.add(mesh);

  return mesh;
}

function addCylinder(
  parent, x, y, z,
  radiusTop, radiusBottom, height,
  mat, segments = 10
) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(
      radiusTop, radiusBottom, height, segments
    ),
    mat
  );

  mesh.position.set(x, y, z);
  mesh.castShadow = !isCoarse;
  parent.add(mesh);

  return mesh;
}

function buildWorld() {
  scene.background = new THREE.Color(0x111a1d);
  scene.fog = new THREE.FogExp2(0x111a1d, 0.0125);

  ambientLight = new THREE.HemisphereLight(0x9eafb7, 0x171915, 1.35);
  scene.add(ambientLight);

  const moon = new THREE.DirectionalLight(0xb7c7d2, 1.8);
  moonLight = moon;
  moon.position.set(-22, 38, 16);
  moon.castShadow = !isCoarse;
  moon.shadow.mapSize.set(1024, 1024);
  moon.shadow.camera.left = -48;
  moon.shadow.camera.right = 48;
  moon.shadow.camera.top = 48;
  moon.shadow.camera.bottom = -48;
  scene.add(moon);

  const fireLight = new THREE.PointLight(
    0xe66c37, 20, 26, 2
  );
  fireLight.position.set(-7, 4, -9);
  scene.add(fireLight);

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
      scene, 0, 0.006, z,
      0.12, 0.012, 3.2,
      makeMaterial(0x777568), false, false
    );
  }

  for (const side of [-1, 1]) {
    addBox(
      scene, side * 5.2, 0.012, 0,
      0.13, 0.015, 170,
      makeMaterial(0x5e5d52), false, false
    );
  }

  // Ruined buildings along the road.
  for (const side of [-1, 1]) {
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
          const wy = 2 + r * 2.8;

          if (wy > height - 1) continue;

          const windowMat = Math.random() > 0.86
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

      colliders.push({
        x, z,
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

  // Wrecked cars.
  for (let i = 0; i < 7; i++) {
    const z = -58 + i * 18;
    const x = (i % 2 ? -1 : 1) * (7.5 + Math.random() * 2);

    const car = new THREE.Group();
    car.position.set(x, 0.55, z);
    car.rotation.y = (Math.random() - 0.5) * 0.18;

    addBox(
      car, 0, 0.15, 0,
      3.4, 0.8, 5.7,
      makeMaterial(0x303a39, 0.55, 0.25)
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
          makeMaterial(0x151817), 10
        );

        wheel.rotation.z = Math.PI / 2;
      }
    }

    scene.add(car);
    colliders.push({ x, z, hx: 2.2, hz: 3.1 });
  }

  // Road barriers.
  for (let i = 0; i < 5; i++) {
    const barrier = addBox(
      scene,
      (i % 2 ? -1 : 1) * 6.2,
      0.6,
      -15 + i * 9,
      2.2, 1.2, 0.35,
      materials.yellow
    );

    barrier.rotation.y = i % 2 ? -0.2 : 0.2;
  }

  // Distant skyline.
  for (let i = 0; i < 32; i++) {
    const side = i % 2 ? -1 : 1;
    const x = side * (36 + Math.random() * 38);
    const z = -90 + Math.random() * 180;
    const height = 15 + Math.random() * 45;

    addBox(
      scene,
      x, height / 2, z,
      7 + Math.random() * 9,
      height,
      8 + Math.random() * 10,
      makeMaterial(0x1a2324),
      false, false
    );
  }

  // Floating dust.
  const positions = [];

  for (let i = 0; i < 360; i++) {
    positions.push(
      (Math.random() - 0.5) * 85,
      0.2 + Math.random() * 3.5,
      (Math.random() - 0.5) * 150
    );
  }

  const dustGeometry = new THREE.BufferGeometry();

  dustGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3)
  );

  scene.add(new THREE.Points(
    dustGeometry,
    new THREE.PointsMaterial({
      color: 0x9ba6a0,
      size: 0.055,
      transparent: true,
      opacity: 0.32
    })
  ));
}

function buildWeapon() {
  camera.add(weaponRoot);
  weaponRoot.position.set(0.34, -0.29, -0.58);
  updateWeaponModel();
}

function updateWeaponModel() {
  while (weaponRoot.children.length) {
    const child = weaponRoot.children[0];
    weaponRoot.remove(child);

    if (child.geometry) child.geometry.dispose();
  }

  const body = makeMaterial(
    weapon === 1 ? 0x252b2b : 0x343a36,
    0.35, 0.65
  );

  const dark = makeMaterial(0x0a0c0c, 0.5, 0.2);
  const grip = makeMaterial(0x30281f);

  if (weapon === 1) {
    addBox(weaponRoot, 0, 0, 0, 0.18, 0.15, 0.42, body);
    addBox(weaponRoot, 0, -0.095, 0.12, 0.13, 0.17, 0.14, grip);
    addBox(weaponRoot, 0, 0.035, -0.28, 0.075, 0.075, 0.32, dark);
    addBox(weaponRoot, 0, 0.085, -0.22, 0.045, 0.018, 0.16, body);
  } else {
    addBox(weaponRoot, 0, 0, -0.03, 0.22, 0.18, 0.5, body);
    addBox(weaponRoot, 0, -0.04, -0.38, 0.085, 0.085, 0.5, dark);
    addBox(weaponRoot, 0, 0.1, -0.16, 0.07, 0.035, 0.32, body);
    addBox(weaponRoot, 0, -0.11, 0.18, 0.15, 0.23, 0.2, grip);
    addBox(weaponRoot, 0, -0.04, 0.25, 0.12, 0.12, 0.32, dark);
    addBox(weaponRoot, -0.13, 0.03, -0.1, 0.035, 0.04, 0.42, dark);
  }
}

function updateWeaponHud() {
  $('weapon-name').textContent = weapon === 1 ? 'M1911' : 'M4 CARBINE';
  $('ammo').textContent = String(weapon === 1 ? ammo : rifleAmmo);
  $('reserve').textContent = String(weapon === 1 ? reserve : rifleReserve);
}

function setNightVision(enabled) {
  nightVision = enabled;
  const root = $('game-root');
  const button = $('night-vision-button');
  root.classList.toggle('night-vision', nightVision);
  button.setAttribute('aria-pressed', String(nightVision));
  button.textContent = nightVision ? '☾ NIGHT VISION: ON' : '☾ NIGHT VISION: OFF';

  if (scene && scene.fog) {
    scene.background.set(nightVision ? 0x172c17 : 0x111a1d);
    scene.fog.color.set(nightVision ? 0x172c17 : 0x111a1d);
    scene.fog.density = nightVision ? 0.006 : 0.0125;
  }
  if (ambientLight) ambientLight.intensity = nightVision ? 2.2 : 1.35;
  if (moonLight) moonLight.intensity = nightVision ? 2.4 : 1.8;
}

function toggleNightVision() {
  setNightVision(!nightVision);
  showToast(nightVision ? 'NIGHT VISION ENABLED' : 'NIGHT VISION DISABLED', 1.5);
}

function showToast(message, seconds = 2.1) {
  const toast = $('toast');
  toast.textContent = message;
  toast.classList.add('visible');
  toastTimer = seconds;
}

function startGame() {
  menu.classList.add('hidden');
  briefing.classList.remove('hidden');
}

function deploy() {
  if (!worldReady) {
    showError(new Error('The 3D world has not finished initializing. Check the error message above and reload the page.'));
    return;
  }

  briefing.classList.add('hidden');
  gameOver.classList.add('hidden');
  hud.classList.remove('hidden');

  started = true;
  paused = false;
  gameEnded = false;

  health = 100;
  kills = 0;
  wave = 1;
  ammo = 12;
  reserve = 60;
  rifleAmmo = 30;
  rifleReserve = 120;

  reloadTimer = 0;
  shotCooldown = 0;
  spawnTimer = 1.2;

  for (const zombie of zombies) {
    scene.remove(zombie.group);
  }
  zombies.length = 0;

  camera.position.set(0, 1.72, 8);
  yaw = 0;
  pitch = 0;

  $('health-text').textContent = '100';
  $('health-fill').style.width = '100%';
  $('wave').textContent = '1';
  $('objective').textContent = 'Eliminate infected · 0/18';
  $('pause-label').classList.add('hidden');

  updateWeaponHud();
  setNightVision(false);
  showToast('RADIO: Signal detected. Stay alive.', 3.2);

  if (!isCoarse && canvas.requestPointerLock) {
    try {
      canvas.requestPointerLock();
    } catch (_) {
      // Pointer lock may be blocked by browser settings.
    }
  }
}

function bindEvents() {
  window.addEventListener('resize', onResize);

  $('start-button').addEventListener('click', startGame);
  $('deploy-button').addEventListener('click', deploy);
  $('retry-button').addEventListener('click', deploy);
  $('mobile-reload').addEventListener('click', reload);
  $('night-vision-button').addEventListener('click', toggleNightVision);

  $('mobile-fire').addEventListener('pointerdown', (event) => {
    event.preventDefault();
    shoot();
  });

  document.addEventListener('pointerlockchange', () => {
    if (!started || gameEnded || isCoarse) return;

    paused = document.pointerLockElement !== canvas;
    $('pause-label').classList.toggle('hidden', !paused);
  });

  document.addEventListener('mousemove', (event) => {
    if (
      !started ||
      paused ||
      gameEnded ||
      document.pointerLockElement !== canvas
    ) return;

    yaw -= event.movementX * 0.0022;
    pitch -= event.movementY * 0.0022;
    pitch = THREE.MathUtils.clamp(pitch, -1.25, 1.25);
  });

  document.addEventListener('keydown', (event) => {
    keys.add(event.code);

    if ([
      'Space',
      'ArrowUp',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight'
    ].includes(event.code)) {
      event.preventDefault();
    }

    if (event.code === 'KeyR') reload();
    if (event.code === 'Digit1') switchWeapon(1);
    if (event.code === 'Digit2') switchWeapon(2);

    if (event.code === 'Escape' && started && !gameEnded && !isCoarse) {
      paused = document.pointerLockElement !== canvas;
      $('pause-label').classList.toggle('hidden', !paused);
    }
  });

  document.addEventListener('keyup', (event) => {
    keys.delete(event.code);
  });

  canvas.addEventListener('click', () => {
    if (!started || gameEnded) return;

    if (!isCoarse && document.pointerLockElement !== canvas) {
      try {
        canvas.requestPointerLock?.();
      } catch (_) {
        // Pointer lock is optional.
      }
    } else if (isCoarse) {
      shoot();
    }
  });

  document.addEventListener('mousedown', (event) => {
    if (
      event.button === 0 &&
      started &&
      !paused &&
      !gameEnded &&
      document.pointerLockElement === canvas
    ) {
      shoot();
    }
  });

  // Touch movement stick.
  const stick = $('stick-zone');
  const knob = $('stick-knob');

  stick.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    joystickPointer = event.pointerId;
    stick.setPointerCapture(joystickPointer);
    updateJoystick(event);
  });

  stick.addEventListener('pointermove', (event) => {
    if (event.pointerId === joystickPointer) updateJoystick(event);
  });

  const releaseStick = (event) => {
    if (event.pointerId !== joystickPointer) return;

    joystickPointer = null;
    moveX = 0;
    moveZ = 0;
    knob.style.transform = 'translate(-50%, -50%)';
  };

  stick.addEventListener('pointerup', releaseStick);
  stick.addEventListener('pointercancel', releaseStick);

  // Touch look controls.
  canvas.addEventListener('pointerdown', (event) => {
    if (!isCoarse || !started || event.clientX < window.innerWidth * 0.38) {
      return;
    }

    lookPointer = event.pointerId;
    lastLookX = event.clientX;
    lastLookY = event.clientY;
    canvas.setPointerCapture(lookPointer);
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!isCoarse || event.pointerId !== lookPointer) return;

    yaw -= (event.clientX - lastLookX) * 0.004;
    pitch -= (event.clientY - lastLookY) * 0.004;
    pitch = THREE.MathUtils.clamp(pitch, -1.2, 1.2);

    lastLookX = event.clientX;
    lastLookY = event.clientY;
  });

  canvas.addEventListener('pointerup', (event) => {
    if (event.pointerId === lookPointer) lookPointer = null;
  });
}

function updateJoystick(event) {
  const rect = $('stick-zone').getBoundingClientRect();
  const dx = event.clientX - (rect.left + rect.width / 2);
  const dy = event.clientY - (rect.top + rect.height / 2);
  const max = 35;
  const length = Math.hypot(dx, dy) || 1;
  const scale = Math.min(1, max / length);
  const nx = dx * scale;
  const ny = dy * scale;

  $('stick-knob').style.transform =
    `translate(calc(-50% + ${nx}px), calc(-50% + ${ny}px))`;

  moveX = nx / max;
  moveZ = ny / max;
}

function onResize() {
  if (!renderer || !camera) return;

  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function switchWeapon(which) {
  if (!started || paused || which === weapon) return;

  weapon = which;
  reloadTimer = 0;
  updateWeaponModel();
  updateWeaponHud();

  showToast(
    weapon === 1 ? 'M1911 EQUIPPED' : 'M4 CARBINE EQUIPPED',
    1.2
  );
}

function reload() {
  if (!started || paused || gameEnded || reloadTimer > 0) return;

  const current = weapon === 1 ? ammo : rifleAmmo;
  const available = weapon === 1 ? reserve : rifleReserve;
  const capacity = weapon === 1 ? 12 : 30;

  if (current >= capacity || available <= 0) {
    showToast(
      available <= 0 ? 'NO AMMO IN RESERVE' : 'MAGAZINE FULL',
      1
    );
    return;
  }

  reloadTimer = weapon === 1 ? 1.25 : 1.65;
  showToast('RELOADING...', 0.9);
}

function finishReload() {
  if (weapon === 1) {
    const amount = Math.min(12 - ammo, reserve);
    ammo += amount;
    reserve -= amount;
  } else {
    const amount = Math.min(30 - rifleAmmo, rifleReserve);
    rifleAmmo += amount;
    rifleReserve -= amount;
  }

  updateWeaponHud();
}

function shoot() {
  if (
    !started ||
    paused ||
    gameEnded ||
    reloadTimer > 0 ||
    shotCooldown > 0
  ) return;

  const currentAmmo = weapon === 1 ? ammo : rifleAmmo;

  if (currentAmmo <= 0) {
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

  playTone(
    weapon === 1 ? 115 : 155,
    weapon === 1 ? 0.08 : 0.055,
    weapon === 1 ? 'sawtooth' : 'square',
    weapon === 1 ? 0.08 : 0.045
  );

  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);

  const targets = [];

  for (const zombie of zombies) {
    zombie.group.traverse((object) => {
      if (object.isMesh) targets.push(object);
    });
  }

  const hits = raycaster.intersectObjects(targets, false);

  if (hits.length && hits[0].object.userData.zombieRef) {
    damageZombie(
      hits[0].object.userData.zombieRef,
      weapon === 1 ? 48 : 27
    );
  }
}

function damageZombie(zombie, damage) {
  if (!zombie || zombie.dead) return;

  zombie.hp -= damage;

  const marker = $('hit-marker');
  marker.style.opacity = '1';
  setTimeout(() => {
    marker.style.opacity = '0';
  }, 110);

  if (zombie.hp <= 0) {
    zombie.dead = true;
    kills++;

    scene.remove(zombie.group);

    const index = zombies.indexOf(zombie);
    if (index >= 0) zombies.splice(index, 1);

    if (kills === 5) {
      showToast('WEAPON READY: M4 CARBINE [2]', 2.5);
    }

    if (kills > 0 && kills % 8 === 0) {
      wave++;
      $('wave').textContent = String(wave);
      reserve += 12;
      rifleReserve += 30;
      updateWeaponHud();
      showToast(`WAVE ${wave} INCOMING — AMMO CACHE SECURED`, 2.8);
    }

    $('objective').textContent = kills >= 18
      ? 'Hold the street — extraction signal charging'
      : `Eliminate infected · ${kills}/18`;

    if (kills >= 18) {
      showToast('OBJECTIVE UPDATED: HOLD YOUR POSITION', 3);
    }

    playTone(420, 0.055, 'sine', 0.035);
  }
}

function spawnZombie() {
  const group = new THREE.Group();
  const x = (Math.random() < 0.5 ? -1 : 1) * (7 + Math.random() * 10);
  const z = camera.position.z - (24 + Math.random() * 35);
  group.position.set(x, 0, z);

  const skin = materials.zombieSkin;
  const cloth = materials.zombieDark;

  addBox(group, 0, 1.12, 0, 0.58, 0.72, 0.34, cloth);
  addBox(group, 0, 1.72, -0.015, 0.34, 0.36, 0.32, skin);
  addBox(group, 0, 1.58, -0.19, 0.23, 0.09, 0.08, materials.blood);

  const eyes = new THREE.MeshBasicMaterial({ color: 0xe4a35b });

  addBox(
    group, -0.085, 1.76, -0.18,
    0.045, 0.035, 0.018, eyes, false, false
  );

  addBox(
    group, 0.085, 1.76, -0.18,
    0.045, 0.035, 0.018, eyes, false, false
  );

  const armL = addBox(
    group, -0.42, 1.12, -0.02,
    0.19, 0.68, 0.2, skin
  );

  const armR = addBox(
    group, 0.42, 1.12, -0.02,
    0.19, 0.68, 0.2, skin
  );

  armL.rotation.z = -0.22;
  armR.rotation.z = 0.22;

  const legL = addBox(
    group, -0.17, 0.48, 0.02,
    0.21, 0.62, 0.24, cloth
  );

  const legR = addBox(
    group, 0.17, 0.48, 0.02,
    0.21, 0.62, 0.24, cloth
  );

  const zombie = {
    group,
    hp: 100,
    speed: 1 + Math.random() * 0.45 + wave * 0.055,
    attack: 0,
    dead: false,
    phase: Math.random() * 4,
    parts: { armL, armR, legL, legR }
  };

  group.traverse((object) => {
    if (object.isMesh) object.userData.zombieRef = zombie;
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
  $('damage-flash').style.background = 'rgba(145, 10, 7, 0.8)';
  damageTimer = 0.22;

  playTone(72, 0.18, 'sawtooth', 0.06);

  if (health <= 0) endGame();
}

function endGame() {
  gameEnded = true;
  started = false;

  if (document.pointerLockElement) {
    document.exitPointerLock();
  }

  $('final-stats').textContent =
    `INFECTED ELIMINATED: ${kills} · WAVE REACHED: ${wave}`;

  gameOver.classList.remove('hidden');
}

function playTone(frequency, duration, type = 'sine', volume = 0.04) {
  try {
    const AudioContextClass =
      window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) return;

    const context = playTone.context ||
      (playTone.context = new AudioContextClass());

    if (context.state === 'suspended') context.resume();

    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(
      frequency,
      context.currentTime
    );

    gain.gain.setValueAtTime(volume, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      context.currentTime + duration
    );

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration);
  } catch (_) {
    // Audio is optional; the game should still run.
  }
}

function resolveCollision(position) {
  position.x = THREE.MathUtils.clamp(
    position.x, -sceneBounds, sceneBounds
  );

  position.z = THREE.MathUtils.clamp(
    position.z, -sceneBounds, sceneBounds
  );

  for (const collider of colliders) {
    if (
      Math.abs(position.x - collider.x) < collider.hx + 0.35 &&
      Math.abs(position.z - collider.z) < collider.hz + 0.35
    ) {
      const dx = position.x - collider.x;
      const dz = position.z - collider.z;

      if (
        Math.abs(dx) / collider.hx >
        Math.abs(dz) / collider.hz
      ) {
        position.x = collider.x +
          Math.sign(dx || 1) * (collider.hx + 0.36);
      } else {
        position.z = collider.z +
          Math.sign(dz || 1) * (collider.hz + 0.36);
      }
    }
  }
}

function updatePlayer(delta) {
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
  const sprinting = keys.has('ShiftLeft') || keys.has('ShiftRight');
  const speed = sprinting ? 8.1 : 5.2;

  const dx =
    (Math.sin(yaw) * f + Math.cos(yaw) * s) *
    speed * delta / length;

  const dz =
    (-Math.cos(yaw) * f + Math.sin(yaw) * s) *
    speed * delta / length;

  const next = camera.position.clone();
  next.x += dx;
  next.z += dz;

  resolveCollision(next);

  camera.position.x = next.x;
  camera.position.z = next.z;
  camera.rotation.order = 'YXZ';
  camera.rotation.y = yaw;
  camera.rotation.x = pitch;

  elapsed += delta;

  const moving = Math.abs(f) + Math.abs(s) > 0.1;

  weaponRoot.position.y = -0.29 +
    (moving ? Math.sin(elapsed * (sprinting ? 13 : 8)) * 0.018 : 0) +
    recoil;

  recoil = Math.max(0, recoil - delta * 0.65);
}

function updateZombies(delta) {
  for (const zombie of [...zombies]) {
    const dx = camera.position.x - zombie.group.position.x;
    const dz = camera.position.z - zombie.group.position.z;
    const distance = Math.hypot(dx, dz) || 1;

    zombie.group.rotation.y = Math.atan2(dx, dz) + Math.PI;

    if (distance > 1.45) {
      zombie.group.position.x += dx / distance * zombie.speed * delta;
      zombie.group.position.z += dz / distance * zombie.speed * delta;
    } else {
      zombie.attack -= delta;

      if (zombie.attack <= 0) {
        zombie.attack = 0.8;
        hurtPlayer(7 + Math.floor(wave / 3));
      }
    }

    zombie.phase += delta * 5;
    zombie.parts.armL.rotation.x = Math.sin(zombie.phase) * 0.16;
    zombie.parts.armR.rotation.x = -Math.sin(zombie.phase) * 0.16;
    zombie.parts.legL.rotation.x = Math.sin(zombie.phase) * 0.18;
    zombie.parts.legR.rotation.x = -Math.sin(zombie.phase) * 0.18;
  }
}

function updateTimers(delta) {
  shotCooldown = Math.max(0, shotCooldown - delta);
  hurtCooldown = Math.max(0, hurtCooldown - delta);

  if (reloadTimer > 0) {
    reloadTimer -= delta;
    if (reloadTimer <= 0) finishReload();
  }

  if (toastTimer > 0) {
    toastTimer -= delta;
    if (toastTimer <= 0) $('toast').classList.remove('visible');
  }

  if (damageTimer > 0) {
    damageTimer -= delta;

    if (damageTimer <= 0) {
      $('damage-flash').style.background = 'rgba(145, 10, 7, 0)';
    }
  }

  if (started && !paused && !gameEnded) {
    spawnTimer -= delta;

    if (spawnTimer <= 0) {
      if (zombies.length < Math.min(7 + wave, 18)) {
        spawnZombie();
      }

      spawnTimer =
        Math.max(0.85, 2.8 - wave * 0.08) +
        Math.random() * 1.2;
    }
  }
}

function animate() {
  requestAnimationFrame(animate);

  const delta = Math.min(clock.getDelta(), 0.05);
  updateTimers(delta);

  if (started && !paused && !gameEnded) {
    updatePlayer(delta);
    updateZombies(delta);
  }

  renderer.render(scene, camera);
}

function init() {
  if (!canvas) {
    throw new Error('Missing #game-canvas element in index.html');
  }

  // Wire up the menu and briefing buttons before WebGL/world setup.
  // If rendering fails, the UI still responds and shows an error message.
  bindEvents();

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

  camera = new THREE.PerspectiveCamera(
    74,
    window.innerWidth / window.innerHeight,
    0.1,
    240
  );

  camera.position.set(0, 1.72, 8);

  // Add camera to scene so its attached first-person weapon renders.
  scene.add(camera);

  clock = new THREE.Clock();

  buildWorld();
  buildWeapon();
  worldReady = true;
  animate();
}

// IMPORTANT FIX:
// Call init() only after the materials, scene objects, and functions exist.
try {
  init();
} catch (error) {
  showError(error);
}
