
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
const bulletTracers = [];
const bloodParticles = [];
const corpses = [];
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
  scene.fog = new THREE.FogExp2(0x111a1d, 0.0105);

  ambientLight = new THREE.HemisphereLight(0xa9bbc2, 0x171915, 1.05);
  scene.add(ambientLight);

  const moon = new THREE.DirectionalLight(0xb7c7d2, 2.15);
  moonLight = moon;
  moon.position.set(-22, 38, 16);
  moon.castShadow = !isCoarse;
  moon.shadow.mapSize.set(1024, 1024);
  moon.shadow.camera.left = -48;
  moon.shadow.camera.right = 48;
  moon.shadow.camera.top = 48;
  moon.shadow.camera.bottom = -48;
  scene.add(moon);

  const fireLight = new THREE.PointLight(0xe66c37, 24, 28, 2);
  fireLight.position.set(-7, 2.2, -9);
  scene.add(fireLight);

  for (const lamp of [{x:5.7,z:-27},{x:-5.7,z:18},{x:5.7,z:61}]) {
    const glow = new THREE.PointLight(0xb9c8c3, 4.5, 16, 2);
    glow.position.set(lamp.x, 5.0, lamp.z); scene.add(glow);
    addCylinder(scene, lamp.x, 2.5, lamp.z, 0.06, 0.09, 5.0, materials.metal, 8);
    addBox(scene, lamp.x, 5.08, lamp.z, 0.52, 0.11, 0.24, materials.metal, false, false);
    const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.36,0.035,0.14), new THREE.MeshBasicMaterial({color:0xd8dfc9}));
    bulb.position.set(lamp.x,4.99,lamp.z); scene.add(bulb);
  }

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

let muzzleFlash = null;
let muzzleLight = null;
let muzzleTimer = 0;

function updateWeaponModel() {
  while (weaponRoot.children.length) {
    const child = weaponRoot.children[0];
    weaponRoot.remove(child);
    if (child.geometry) child.geometry.dispose();
    if (child.material && child.material !== materials.metal) {
      if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
      else child.material.dispose();
    }
  }
  const body = makeMaterial(weapon === 1 ? 0x252b2b : 0x343a36, 0.28, 0.72);
  const dark = makeMaterial(0x090c0c, 0.42, 0.25);
  const grip = makeMaterial(0x30281f, 0.9, 0.02);
  const edge = makeMaterial(0x59615c, 0.3, 0.8);
  const addPart = (x,y,z,sx,sy,sz,mat) => addBox(weaponRoot,x,y,z,sx,sy,sz,mat,false,false);
  const addTube = (x,y,z,radius,length,mat) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,length,12),mat);
    m.rotation.x=Math.PI/2; m.position.set(x,y,z); weaponRoot.add(m); return m;
  };
  if (weapon === 1) {
    // Pistol slide, barrel, sights, grip panels, trigger guard and trigger.
    addPart(0,0,0,0.19,0.14,0.43,body);
    addPart(0,0.015,-0.225,0.105,0.085,0.14,edge);
    addTube(0,0.015,-0.31,0.026,0.24,dark);
    addPart(0,-0.09,0.12,0.13,0.2,0.17,grip);
    addPart(0,-0.06,0.205,0.14,0.12,0.055,dark);
    addPart(-0.085,0.078,-0.1,0.035,0.025,0.06,dark);
    addPart(0.085,0.078,-0.1,0.035,0.025,0.06,dark);
    addPart(0,-0.07,-0.02,0.08,0.018,0.09,edge);
    addPart(0.015,-0.065,0.045,0.035,0.07,0.04,dark);
    addPart(-0.075,-0.07,0.1,0.012,0.13,0.11,edge);
    addPart(0.075,-0.07,0.1,0.012,0.13,0.11,edge);
  } else {
    // Rifle receiver, long barrel, gas tube, handguard, magazine, stock and sights.
    addPart(0,0,-0.03,0.23,0.18,0.48,body);
    addPart(0,0.01,-0.3,0.1,0.1,0.42,dark);
    addTube(0,0.015,-0.53,0.025,0.48,dark);
    addPart(0,0.09,-0.29,0.09,0.035,0.43,edge);
    addPart(0,-0.15,-0.02,0.15,0.23,0.19,grip);
    addPart(0,-0.15,0.19,0.13,0.22,0.23,dark);
    addPart(0,0.0,0.29,0.17,0.16,0.43,dark);
    addPart(0,0.045,0.49,0.14,0.1,0.13,grip);
    addPart(0,0.115,-0.13,0.045,0.04,0.1,dark);
    addPart(0,0.14,-0.12,0.026,0.035,0.06,edge);
    for(let i=0;i<5;i++) addPart(0.0,0.015,-0.18-i*0.065,0.245,0.012,0.012,edge);
    addPart(-0.13,0.025,-0.18,0.025,0.045,0.42,dark);
    addPart(0.13,0.025,-0.18,0.025,0.045,0.42,dark);
  }
  // First-person gloved hands and sleeves grip the weapon.
  const sleeve = makeMaterial(0x242c28,0.95,0.02);
  const glove = makeMaterial(0x171b19,0.9,0.05);
  const makeEllipsoid=(x,y,z,sx,sy,sz,mat)=>{
    const m=new THREE.Mesh(new THREE.SphereGeometry(1,12,9),mat);
    m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=false;weaponRoot.add(m);return m;
  };
  makeEllipsoid(0.19,-0.16,0.06,0.12,0.15,0.18,sleeve);
  makeEllipsoid(0.17,-0.105,-0.02,0.095,0.07,0.13,glove);
  makeEllipsoid(-0.17,-0.19,-0.27,0.105,0.12,0.16,sleeve);
  if(weapon===2) makeEllipsoid(-0.16,-0.11,-0.29,0.09,0.07,0.12,glove);
  // Flash lives at the barrel tip and is hidden except for a shot.
  muzzleFlash=new THREE.Mesh(new THREE.ConeGeometry(0.075,0.24,8),new THREE.MeshBasicMaterial({color:0xffc46b,transparent:true,opacity:0.96,blending:THREE.AdditiveBlending,depthWrite:false}));
  muzzleFlash.rotation.x=-Math.PI/2;
  muzzleFlash.position.set(0,0.015,weapon===1?-0.47:-0.79);
  muzzleFlash.visible=false;weaponRoot.add(muzzleFlash);
  if(muzzleLight){camera.remove(muzzleLight);}
  muzzleLight=new THREE.PointLight(0xffb35c,0,3,2);muzzleLight.position.copy(muzzleFlash.position);weaponRoot.add(muzzleLight);
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

function spawnBulletTrail(hitPoint = null) {
  // Use a small emissive cylinder instead of a 1px WebGL line (line width is
  // ignored by many browsers, including Chrome on some graphics drivers).
  const origin = new THREE.Vector3();
  camera.getWorldPosition(origin);
  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);
  const start = origin.clone().add(direction.clone().multiplyScalar(0.65));
  const end = hitPoint ? hitPoint.clone() : origin.clone().add(direction.multiplyScalar(32));
  const delta = end.clone().sub(start);
  const length = Math.min(delta.length(), 32);
  if (length < 0.2) return;
  const geometry = new THREE.CylinderGeometry(0.012, 0.012, length, 6, 1, true);
  const material = new THREE.MeshBasicMaterial({
    color: weapon === 1 ? 0xffc45b : 0xfff0b0,
    transparent: true,
    opacity: 0.95,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const tracer = new THREE.Mesh(geometry, material);
  tracer.position.copy(start).add(end).multiplyScalar(0.5);
  tracer.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
  tracer.renderOrder = 1000;
  scene.add(tracer);
  bulletTracers.push({ line: tracer, life: 0.085, maxLife: 0.085 });
}

function spawnBlood(position, count = 12) {
  for (let i = 0; i < count; i++) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.055 + Math.random() * 0.07, 7, 6), new THREE.MeshBasicMaterial({ color: Math.random() > 0.25 ? 0x861b18 : 0x4b1010 }));
    mesh.position.copy(position);
    scene.add(mesh);
    bloodParticles.push({ mesh, velocity: new THREE.Vector3((Math.random() - 0.5) * 3.2, 0.5 + Math.random() * 2.4, (Math.random() - 0.5) * 3.2), life: 1.0 + Math.random() * 0.8 });
  }
}

function updateCombatEffects(delta) {
  for (let i = bulletTracers.length - 1; i >= 0; i--) {
    const tracer = bulletTracers[i];
    tracer.life -= delta;
    tracer.line.material.opacity = Math.max(0, tracer.life / tracer.maxLife);
    if (tracer.life <= 0) {
      scene.remove(tracer.line); tracer.line.geometry.dispose(); tracer.line.material.dispose(); bulletTracers.splice(i, 1);
    }
  }
  for (let i = bloodParticles.length - 1; i >= 0; i--) {
    const particle = bloodParticles[i];
    particle.life -= delta; particle.velocity.y -= 5.8 * delta; particle.mesh.position.addScaledVector(particle.velocity, delta);
    if (particle.mesh.position.y < 0.035) {
      particle.mesh.position.y = 0.035; particle.velocity.y *= -0.18; particle.velocity.x *= 0.55; particle.velocity.z *= 0.55;
    }
    if (particle.life <= 0) {
      scene.remove(particle.mesh); particle.mesh.geometry.dispose(); particle.mesh.material.dispose(); bloodParticles.splice(i, 1);
    }
  }
  for (let i = corpses.length - 1; i >= 0; i--) {
    const corpse = corpses[i]; corpse.life -= delta;
    corpse.group.rotation.x = corpse.fallX * Math.min(1, corpse.age / 0.28);
    corpse.group.rotation.z = corpse.fallZ * Math.min(1, corpse.age / 0.28);
    corpse.group.position.y = Math.max(0, corpse.group.position.y - delta * 0.25); corpse.age += delta;
    if (corpse.life <= 0) { scene.remove(corpse.group); corpses.splice(i, 1); }
  }
}

let audioContext = null;
function playGunshot() {
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    if(audioContext.state === 'suspended') audioContext.resume();
    const now=audioContext.currentTime;
    const noiseBuffer=audioContext.createBuffer(1,Math.floor(audioContext.sampleRate*0.22),audioContext.sampleRate);
    const data=noiseBuffer.getChannelData(0);
    for(let i=0;i<data.length;i++) data[i]=(Math.random()*2-1)*Math.pow(1-i/data.length,2.2);
    const noise=audioContext.createBufferSource();noise.buffer=noiseBuffer;
    const filter=audioContext.createBiquadFilter();filter.type='lowpass';filter.frequency.value=weapon===1?1800:1250;
    const gain=audioContext.createGain();gain.gain.setValueAtTime(weapon===1?0.8:0.62,now);gain.gain.exponentialRampToValueAtTime(0.001,now+0.19);
    noise.connect(filter);filter.connect(gain);gain.connect(audioContext.destination);noise.start(now);noise.stop(now+0.22);
    const thump=audioContext.createOscillator();thump.type='sine';thump.frequency.setValueAtTime(weapon===1?115:85,now);thump.frequency.exponentialRampToValueAtTime(35,now+0.11);
    const thumpGain=audioContext.createGain();thumpGain.gain.setValueAtTime(0.32,now);thumpGain.gain.exponentialRampToValueAtTime(0.001,now+0.12);
    thump.connect(thumpGain);thumpGain.connect(audioContext.destination);thump.start(now);thump.stop(now+0.13);
  } catch (_) { playTone(weapon===1?115:155,0.08,'sawtooth',0.08); }
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
  spawnBulletTrail(hits.length ? hits[0].point : null);

  if (hits.length && hits[0].object.userData.zombieRef) {
    spawnBlood(hits[0].point, weapon === 1 ? 9 : 13);
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

    const deathPoint = zombie.group.position.clone().add(new THREE.Vector3(0, 1.05, 0));
    spawnBlood(deathPoint, 22);
    zombie.group.rotation.order = 'ZYX';
    corpses.push({ group: zombie.group, life: 18, age: 0, fallX: (Math.random() > 0.5 ? 1 : -1) * (1.05 + Math.random() * 0.4), fallZ: (Math.random() > 0.5 ? 1 : -1) * (0.85 + Math.random() * 0.45), startY: zombie.group.position.y });

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

  // Procedural infected: rounded forms, layered torn clothing, pale skin,
  // damaged face and jointed limbs instead of a single blocky figure.
  const skin = new THREE.MeshStandardMaterial({ color: Math.random() > 0.5 ? 0x788675 : 0x8a8873, roughness: 0.98 });
  const bruisedSkin = new THREE.MeshStandardMaterial({ color: 0x514d43, roughness: 1 });
  const cloth = new THREE.MeshStandardMaterial({ color: [0x252d2b, 0x39352f, 0x343d32, 0x44322d][Math.floor(Math.random()*4)], roughness: 1 });
  const tornCloth = new THREE.MeshStandardMaterial({ color: 0x171e1c, roughness: 1 });
  const wound = new THREE.MeshStandardMaterial({ color: 0x451311, roughness: 1 });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xe6b57b });
  const makeSphere = (parent, pos, scale, mat, seg=12) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, seg, Math.max(7, seg-3)), mat);
    m.position.set(...pos); m.scale.set(...scale); m.castShadow = !isCoarse; m.receiveShadow = !isCoarse; parent.add(m); return m;
  };
  const makeLimb = (parent, x, y, z, radius, length, mat) => {
    const pivot = new THREE.Group(); pivot.position.set(x,y,z); parent.add(pivot);
    const limb = new THREE.Mesh(new THREE.CapsuleGeometry(radius, Math.max(0.12,length-radius*2), 4, 7), mat);
    limb.position.y = -length/2; limb.castShadow = !isCoarse; limb.receiveShadow = !isCoarse; pivot.add(limb);
    return pivot;
  };

  // Torso, hunched shoulders and a ragged outer layer.
  makeSphere(group, [0,1.13,0], [0.34,0.48,0.22], cloth, 14);
  makeSphere(group, [0,1.31,-0.015], [0.37,0.23,0.235], cloth, 12);
  makeSphere(group, [0.08,1.1,-0.205], [0.12,0.25,0.025], tornCloth, 9);
  makeSphere(group, [-0.12,0.93,-0.21], [0.09,0.2,0.024], bruisedSkin, 9);
  makeSphere(group, [0,1.68,-0.015], [0.205,0.245,0.19], skin, 14);
  makeSphere(group, [0,1.57,-0.13], [0.15,0.105,0.095], bruisedSkin, 12);
  makeSphere(group, [0,1.55,-0.207], [0.095,0.035,0.018], wound, 10);
  makeSphere(group, [-0.075,1.72,-0.18], [0.028,0.022,0.012], eyeMat, 8);
  makeSphere(group, [0.075,1.72,-0.18], [0.028,0.022,0.012], eyeMat, 8);
  makeSphere(group, [-0.12,1.65,-0.16], [0.045,0.06,0.018], wound, 8);
  makeSphere(group, [0.13,1.77,-0.13], [0.035,0.045,0.018], bruisedSkin, 8);

  const armL = makeLimb(group, -0.34, 1.37, -0.015, 0.095, 0.62, skin);
  const armR = makeLimb(group, 0.34, 1.37, -0.015, 0.095, 0.62, skin);
  armL.rotation.z = -0.42; armR.rotation.z = 0.42;
  makeSphere(armL, [0,-0.57,-0.01], [0.105,0.12,0.09], skin, 9);
  makeSphere(armR, [0,-0.57,-0.01], [0.105,0.12,0.09], skin, 9);

  const legL = makeLimb(group, -0.15, 0.75, 0.015, 0.115, 0.67, cloth);
  const legR = makeLimb(group, 0.15, 0.75, 0.015, 0.115, 0.67, cloth);
  makeSphere(legL, [0,-0.61,-0.035], [0.13,0.09,0.22], tornCloth, 9);
  makeSphere(legR, [0,-0.61,-0.035], [0.13,0.09,0.22], tornCloth, 9);

  const zombie = {
    group, hp: 100,
    speed: 0.82 + Math.random() * 0.42 + wave * 0.045,
    attack: 0, dead: false, phase: Math.random() * 4,
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
  const speed = sprinting ? 7.0 : 4.15;

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
    (moving ? Math.sin(elapsed * (sprinting ? 12 : 7)) * (sprinting ? 0.035 : 0.014) : 0) +
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
  updateCombatEffects(delta);

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
