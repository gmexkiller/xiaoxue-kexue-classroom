import * as THREE from '../../../vendor/three/three.module.js';
import { OrbitControls } from '../../../vendor/three/addons/controls/OrbitControls.js';
import { GLTFLoader } from '../../../vendor/three/addons/loaders/GLTFLoader.js';
import soilGroundUrl from '../../../assets/textures/ambientcg/soil-ground/Ground054_1K-JPG_Color.jpg';
import rockSurfaceUrl from '../../../assets/textures/ambientcg/rock/Rock029_1K-JPG_Color.jpg';

const MOUNTAINSIDE_GLTF = '__INLINE_MOUNTAINSIDE_GLTF__';

const RAMP_KEYS = ['lift', 'short', 'medium', 'long'];
const RAMP_NAMES = { lift: '直接提起', short: '短斜面', medium: '中斜面', long: '长斜面' };
const STORAGE_KEY = 'hulala-incline-class-data-v1';
const blankGroup = index => ({ name: `第${index + 1}组`, included: true, values: { lift: null, short: null, medium: null, long: null } });
function loadSessionGroups() {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (!saved) return Array.from({ length: 6 }, (_, index) => blankGroup(index));
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > 40) throw new Error('小组记录格式无效');
    return parsed.map((group, index) => {
      if (typeof group.name !== 'string' || !group.values || typeof group.values !== 'object') throw new Error('小组记录格式无效');
      const values = {};
      for (const key of RAMP_KEYS) {
        const value = group.values[key];
        if (value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0)) throw new Error('测量值格式无效');
        values[key] = value;
      }
      return { name: group.name.trim() || `第${index + 1}组`, included: group.included !== false, values };
    });
  } catch (error) {
    console.warn('本次课堂记录无法恢复，已显示空白记录。', error);
    return Array.from({ length: 6 }, (_, index) => blankGroup(index));
  }
}
function saveSessionGroups(groups) {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(groups)); }
  catch (error) { console.warn('当前浏览器未能临时保存课堂数据。', error); }
}

const state = {
  phase: 'context', ramp: 'lift', methodsShown: false, chartOpen: false, drawing: false, routePaused: false, routeSegments: [],
  groups: loadSessionGroups(),
  groupIndex: 0, dataView: 'single', draft: null, revealed: { context: false, evidence: false, routes: false },
  animationStart: null, animationDuration: 3800, problemShown: false, designHintsShown: false,
};

const $ = (id) => document.getElementById(id);
const elements = {
  phaseEyebrow: $('phaseEyebrow'), phaseTitle: $('phaseTitle'), phaseSubtitle: $('phaseSubtitle'),
  controlHeading: $('controlHeading'), rampControls: $('rampControls'), routeControls: $('routeControls'),
  leftStatus: $('leftStatus'), stageContext: $('stageContext'), stageTag: $('stageTag'), stageCaption: $('stageCaption'),
  animateButton: $('animateButton'), resetViewButton: $('resetViewButton'), showMethodsButton: $('showMethodsButton'), methodChoices: $('methodChoices'), contextWait: $('contextWait'),
  drawingSurface: $('drawingSurface'), drawRouteButton: $('drawRouteButton'), pauseRouteButton: $('pauseRouteButton'), finishRouteButton: $('finishRouteButton'), clearRouteButton: $('clearRouteButton'), routeToolNote: $('routeToolNote'),
  chartScreen: $('chartScreen'), smallClassChart: $('smallClassChart'), largeClassChart: $('largeClassChart'),
  expandChartButton: $('expandChartButton'), closeChartButton: $('closeChartButton'), largeRevealButton: $('largeRevealButton'), largeRevealBox: $('largeRevealBox'),
  discussionHeading: $('discussionHeading'), questionNum: $('questionNum'), questionTitle: $('questionTitle'),
  questionBody: $('questionBody'), dataPanel: $('dataPanel'), routePrompt: $('routePrompt'), extensionPanel: $('extensionPanel'),
  revealButton: $('revealButton'), revealBox: $('revealBox'), groupSelect: $('groupSelect'), forceChart: $('forceChart'),
  singleGroupView: $('singleGroupView'), classView: $('classView'), classSummary: $('classSummary'),
  singleDataEmpty: $('singleDataEmpty'), singleDataFoot: $('singleDataFoot'), classDataEmpty: $('classDataEmpty'),
  classDataFoot: $('classDataFoot'),
  dataDialog: $('dataDialog'), dataRows: $('dataRows'), dataValidation: $('dataValidation'),
};

let renderer, scene, camera, controls, rampScene, mountainScene, cargo, sunLight, hemisphereLight, fillLight, terrainSurface, studentRouteMesh, mountainTruck, homeLabel, rampMeshes = {}, rampStructures = {}, rampLabels = {}, sceneReady = false;
let defaultTarget = new THREE.Vector3(0, 1.4, 0);

function material(hex, roughness = 0.75, metalness = 0) {
  return new THREE.MeshStandardMaterial({ color: hex, roughness, metalness });
}
function box(parent, w, h, d, color, x, y, z, roughness = 0.75, metalness = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material(color, roughness, metalness));
  mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function cylinder(parent, r, depth, color, x, y, z, axis = 'z') {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, depth, 24), material(color, 0.7));
  if (axis === 'z') mesh.rotation.x = Math.PI / 2;
  else if (axis === 'x') mesh.rotation.z = Math.PI / 2;
  mesh.position.set(x, y, z); mesh.castShadow = true; parent.add(mesh); return mesh;
}
function spriteLabel(parent, text, x, y, z, color = '#f0f8f5', width = 2.15) {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#071d26dd'; ctx.beginPath(); ctx.roundRect(7, 7, 498, 114, 17); ctx.fill();
  ctx.strokeStyle = '#74c7bf'; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = color; ctx.font = 'bold 49px "Microsoft YaHei", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 65);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  sprite.position.set(x, y, z); sprite.scale.set(width, width * .25, 1); parent.add(sprite); return sprite;
}
function line(parent, points, hex, radius = .045) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, radius, 8, false), new THREE.MeshBasicMaterial({ color: hex }));
  parent.add(mesh); return mesh;
}

function createTruck(group) {
  // 货车车厢与平台共用同一装货高度；车轮和车头只承载情境，不参与测力。
  const orange = 0xe7924e, dark = 0x24343a;
  box(group, 8.8, .26, 2.55, 0x8c5841, -.1, 2.32, -2.7);
  box(group, 8.8, .23, .18, 0xe6a566, -.1, 2.46, -3.94);
  box(group, 8.8, .76, .16, orange, -.1, 2.86, -3.98);
  box(group, 8.8, .07, .23, 0xf4c487, -.1, 3.27, -3.98);
  box(group, 8.8, .28, 2.25, orange, -.1, 1.96, -2.73);
  box(group, 2.35, 1.72, 2.55, orange, 5.38, 1.8, -2.7);
  box(group, 1.05, .67, .08, 0x9ccbd1, 5.78, 2.22, -1.38, .14);
  box(group, .08, .78, 1.35, 0x9ccbd1, 6.57, 2.19, -2.73, .14);
  box(group, .12, .2, 1.7, 0x34474c, 6.63, 1.39, -2.73);
  for (const z of [-3.46, -1.99]) box(group, .15, .19, .28, 0xffe6b2, 6.69, 1.65, z);
  box(group, 1.48, .28, 2.35, dark, 5.33, .78, -2.72);
  box(group, 8.7, .22, 2.3, dark, -.1, .84, -2.72);
  for (const x of [-2.55, 2.75, 5.45]) {
    cylinder(group, .63, .28, 0x18252b, x, .58, -1.3, 'z');
    cylinder(group, .63, .28, 0x18252b, x, .58, -4.1, 'z');
    cylinder(group, .32, .3, 0xb9c4bf, x, .58, -1.3, 'z');
  }
  spriteLabel(group, '胡拉拉搬家公司', 5.35, 3.9, -2.75, '#fff4e8', 3.3);
  spriteLabel(group, '同一货车平台高度', -.2, 3.33, -3.15, '#a8f0df', 3.3);
}

const rampDefinitions = {
  short: { x: -2.55, start: 1.0, color: 0xd39068 },
  medium: { x: 0, start: 2.6, color: 0x8fb5a8 },
  long: { x: 2.55, start: 4.35, color: 0x60cbbb },
};
const rampEnd = -1.46, deckHeight = 2.43;

function createRampScene() {
  const group = new THREE.Group(); group.name = '搬货上车';
  const ground = box(group, 23, .18, 18, 0x314a46, 0, -.16, 1.3, 1);
  ground.castShadow = false;
  for (let x = -9; x < 10; x += 2) box(group, .035, .012, 17, 0x4d6963, x, -.055, 1.4);
  box(group, 8.2, .018, .065, 0xefbd74, -.25, -.048, 5.25);
  spriteLabel(group, '胡拉拉装卸场', -6.1, 1.2, 3.9, '#ffd29b', 2.35);
  for (const x of [-6.4, -5.8, -5.2]) box(group, .34, .07, 1.9, 0xf4b76c, x, -.035, 2.15);
  createTruck(group);
  const liftMarker = line(group, [[-4.2, .25, 1.4],[-4.2, 2.65, 1.4],[-4.2, 2.65, -1.7]], 0xf2a45d, .055);
  rampMeshes.lift = liftMarker;
  rampLabels.lift = spriteLabel(group, '直接提起', -4.25, 2.67, 2.15, '#ffc793', 2.05);
  for (const [key, def] of Object.entries(rampDefinitions)) {
    const lengthZ = def.start - rampEnd;
    const length = Math.hypot(lengthZ, deckHeight);
    const ramp = box(group, 1.78, .16, length, def.color, def.x, deckHeight / 2, (def.start + rampEnd) / 2);
    rampStructures[key] = [ramp];
    ramp.rotation.x = Math.atan2(deckHeight, lengthZ);
    for (const side of [-.82, .82]) {
      const rail = box(group, .07, .10, length, 0x597572, def.x + side, deckHeight / 2 + .12, (def.start + rampEnd) / 2);
      rail.rotation.x = ramp.rotation.x;
      rampStructures[key].push(rail);
    }
    rampMeshes[key] = ramp;
    rampLabels[key] = spriteLabel(group, RAMP_NAMES[key], def.x, 1.96, def.start + .55, '#f2fcf8', 2.05);
  }
  cargo = new THREE.Group();
  box(cargo, 1.2, 1.16, 1.12, 0xbf8b56, 0, .58, 0);
  box(cargo, 1.21, .07, .09, 0xeac599, 0, 1.2, 0);
  box(cargo, .09, .07, 1.14, 0xeac599, 0, 1.2, 0);
  spriteLabel(group, '同一件货物', -4.45, 1.8, 2.05, '#ffe1b7', 2.25);
  group.add(cargo);
  return group;
}

const rawMountainHeight = (x, z) => {
  const r = Math.sqrt(x * x + z * z) / 7.8;
  const mountain = Math.max(0, 1 - r);
  const main = 5.15 * Math.pow(mountain, 1.42);
  const ridge = r < 1 ? (.48 * Math.sin(5 * Math.atan2(z, x) + 4 * r) + .18 * Math.sin(x * 2.5 + z * 1.7)) * Math.sin(Math.PI * r) : 0;
  const folds = (.12 * Math.sin(x * 1.65 - z * 2.1) + .045 * Math.sin(x * 6.3 + z * 4.9)) * mountain;
  const sideHillA = 2.15 * Math.exp(-(((x + 3.7) / 2.7) ** 2 + ((z + 3.8) / 2.9) ** 2) * 1.25);
  const sideHillB = 1.82 * Math.exp(-(((x - 5.0) / 2.6) ** 2 + ((z + 3.1) / 2.7) ** 2) * 1.3);
  const backSpur = .95 * Math.exp(-(((x + 3.6) / 2.2) ** 2 + ((z + 2.2) / 2.7) ** 2));
  return Math.max(0, main + ridge + folds + sideHillA + sideHillB + backSpur);
};
// A gently blended summit terrace is part of the same height field used by rendering and route projection.
const HOME_SITE = { x: .35, z: -.45, radiusX: 1.04, radiusZ: 1.12 };
const HOME_LEVEL = rawMountainHeight(HOME_SITE.x, HOME_SITE.z);
function mountainHeight(x, z) {
  const natural = rawMountainHeight(x, z);
  const distance = Math.hypot((x - HOME_SITE.x) / HOME_SITE.radiusX, (z - HOME_SITE.z) / HOME_SITE.radiusZ);
  const blend = Math.max(0, Math.min(1, (distance - .86) / .79));
  const smooth = blend * blend * (3 - 2 * blend);
  return HOME_LEVEL * (1 - smooth) + natural * smooth;
}
function addMountainsideOutcrops(group) {
  new GLTFLoader().parse(MOUNTAINSIDE_GLTF, '', gltf => {
    const original = gltf.scene;
    original.traverse(object => { if (object.isMesh) { object.castShadow = true; object.receiveShadow = true; } });
    original.scale.setScalar(.33); original.rotation.y = -.4; original.position.set(4.45, -1.68, -4.35);
    const opposite = original.clone();
    opposite.scale.setScalar(.29); opposite.rotation.y = .52; opposite.position.set(-5.5, -1.52, -5.5);
    group.add(original, opposite);
    group.userData.mountainsideLoaded = true;
    $('sceneHost').dataset.mountainside = 'loaded';
  }, error => console.warn('本地 Mountainside 岩层未能载入，保留山地路线示意。', error));
}
function createMountainScene() {
  const group = new THREE.Group(); group.name = '货车上山';
  const terrain = new THREE.PlaneGeometry(19, 19, 156, 156); terrain.rotateX(-Math.PI / 2);
  const position = terrain.attributes.position, colors = [];
  const low = new THREE.Color(0x355c4f), mid = new THREE.Color(0x71965f), high = new THREE.Color(0xb9a678), rockColor = new THREE.Color(0x909788);
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), z = position.getZ(i), y = mountainHeight(x, z);
    position.setY(i, y);
    const c = y > 3.6 ? mid.clone().lerp(high, Math.min(1, (y - 3.6) / 1.7)) : low.clone().lerp(mid, Math.max(0, y / 3.6));
    const steepness = Math.hypot(mountainHeight(x + .13, z) - y, mountainHeight(x, z + .13) - y) / .13;
    const rocky = Math.max(0, Math.min(.55, (steepness - .7) * .4)) * Math.max(0, Math.min(1, (y - 1.8) / 1.7));
    c.lerp(rockColor, rocky);
    c.multiplyScalar(.91 + .08 * Math.sin(x * 2.1 + z * 1.6) + .035 * Math.sin(x * 5.3 - z * 3.4));
    colors.push(c.r, c.g, c.b);
  }
  terrain.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); terrain.computeVertexNormals();
  const groundTexture = new THREE.TextureLoader().load(soilGroundUrl);
  groundTexture.colorSpace = THREE.SRGBColorSpace; groundTexture.wrapS = groundTexture.wrapT = THREE.RepeatWrapping;
  groundTexture.repeat.set(3.5, 3.5); groundTexture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  const surface = new THREE.Mesh(terrain, new THREE.MeshStandardMaterial({ bumpMap: groundTexture, bumpScale: .11, vertexColors: true, roughness: 1, side: THREE.DoubleSide }));
  surface.receiveShadow = true; group.add(surface); terrainSurface = surface;
  const rockyGeometry = terrain.clone();
  const rockyPositions = rockyGeometry.attributes.position;
  const rockyColors = [];
  const smooth = (min, max, value) => { const t = Math.max(0, Math.min(1, (value - min) / (max - min))); return t * t * (3 - 2 * t); };
  for (let i = 0; i < rockyPositions.count; i++) {
    const x = rockyPositions.getX(i), y = rockyPositions.getY(i), z = rockyPositions.getZ(i);
    const slope = Math.hypot(mountainHeight(x + .18, z) - y, mountainHeight(x, z + .18) - y) / .18;
    const patch = Math.sin(x * 1.25 - z * 1.05) + .3 * Math.sin(x * 3.1 + z * 2.2);
    const region = Math.max(smooth(.6, 2.5, x), .48 * smooth(2.8, 5.2, -z));
    const opacity = .78 * region * smooth(1.4, 3.3, y) * smooth(.58, 1.3, slope) * smooth(-.05, .75, patch);
    rockyPositions.setY(i, y + .036);
    rockyColors.push(1, 1, 1, opacity);
  }
  rockyGeometry.setAttribute('color', new THREE.Float32BufferAttribute(rockyColors, 4));
  const rockyTexture = new THREE.TextureLoader().load(rockSurfaceUrl);
  rockyTexture.colorSpace = THREE.SRGBColorSpace; rockyTexture.wrapS = rockyTexture.wrapT = THREE.RepeatWrapping;
  rockyTexture.repeat.set(3.2, 3.2); rockyTexture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  const rockySurface = new THREE.Mesh(rockyGeometry, new THREE.MeshStandardMaterial({ map: rockyTexture, color: 0xc5c5b9, vertexColors: true, transparent: true, depthWrite: false, roughness: 1, side: THREE.DoubleSide }));
  rockySurface.receiveShadow = true; group.add(rockySurface);
  const base = box(group, 19.2, .42, 19.2, 0x32493e, 0, -.28, 0, 1); base.castShadow = false;
  addMountainsideOutcrops(group);
  const stoneMaterial = material(0x8f8e78, 1);
  for (const [x, z, size] of [[-7.2,-2.8,.47],[-4.7,-6.2,.35],[5.9,-3.5,.53],[7.4,1.4,.38],[-7.5,2.1,.31]]) {
    const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(size, 0), stoneMaterial);
    rock.scale.set(1.4, .8, 1); rock.position.set(x, mountainHeight(x, z) + size * .28, z);
    rock.rotation.set(.18, x * .4, .12); rock.castShadow = true; rock.receiveShadow = true; group.add(rock);
  }
  const treeTrunk = material(0x554c3b, 1), treeCrown = [material(0x3a6049, 1), material(0x4c6b4d, 1), material(0x5b7252, 1)];
  const canopyShape = new THREE.SphereGeometry(1, 10, 8);
  let planted = 0;
  for (let i = 0; i < 95 && planted < 24; i++) {
    const x = Math.sin(i * 29.37) * 7.8, z = Math.sin(i * 11.79 + 1.4) * 7.3;
    if (Math.abs(x) > 8.3 || Math.abs(z) > 8.1 || (x * x + z * z) < 8) continue;
    if (Math.hypot(x, z) < 1.45 || Math.hypot(x + 5, z - 6) < 1.5) continue;
    const height = .38 + .45 * (.5 + .5 * Math.sin(i * 3.1));
    const groundY = mountainHeight(x, z);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.035, .065, height * .42, 7), treeTrunk);
    trunk.position.set(x, groundY + height * .21, z); trunk.castShadow = true; group.add(trunk);
    for (const [dx, dy, dz, scale] of [[0,.42,0,.45],[.24,.46,.12,.31],[-.17,.57,-.11,.29]]) {
      const crown = new THREE.Mesh(canopyShape, treeCrown[(i + Math.round(dy * 10)) % treeCrown.length]);
      crown.scale.set(height * scale, height * scale * .76, height * scale * .86);
      crown.position.set(x + dx * height, groundY + dy * height, z + dz * height);
      crown.castShadow = true; crown.receiveShadow = true; group.add(crown);
    }
    planted++;
  }
  const start = new THREE.Vector3(-5, mountainHeight(-5, 6) + .12, 6);
  spriteLabel(group, '出发', start.x - .7, start.y + .75, start.z, '#f5ddaa', 1.4);
  const foundation = box(group, 1.38, .11, 1.24, 0x8b918c, HOME_SITE.x, HOME_LEVEL + .02, HOME_SITE.z, 1);
  foundation.castShadow = true;
  const arrival = new THREE.Mesh(new THREE.CircleGeometry(.32, 28), new THREE.MeshStandardMaterial({ color: 0x9c9a87, roughness: 1, transparent: true, opacity: .8, side: THREE.DoubleSide }));
  arrival.rotation.x = -Math.PI / 2; arrival.scale.set(1.12, .9, 1);
  arrival.position.set(HOME_SITE.x, HOME_LEVEL + .02, HOME_SITE.z + .9); arrival.receiveShadow = true; group.add(arrival);
  const home = new THREE.Group(); home.position.set(HOME_SITE.x, HOME_LEVEL + .037, HOME_SITE.z);
  box(home, 1.28, .98, 1.12, 0xd4c3a4, 0, .53, 0);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.02, .65, 4), material(0x675d50, .96));
  roof.rotation.y = Math.PI / 4; roof.position.y = 1.34; roof.castShadow = true; home.add(roof);
  box(home, .28, .58, .025, 0x584a3f, .14, .32, .575);
  box(home, .24, .26, .03, 0x88b0b4, -.35, .74, .576, .24);
  home.scale.setScalar(.83); group.add(home);
  homeLabel = spriteLabel(group, '客户新家', HOME_SITE.x, HOME_LEVEL + 1.85, HOME_SITE.z, '#effdf8', 2.1);
  const car = new THREE.Group();
  box(car, 1.0, .38, .66, 0xe7924e, 0, .46, 0);
  box(car, .36, .4, .62, 0xf2b56d, .24, .82, 0);
  for (const x of [-.3,.3]) for (const z of [-.32,.32]) cylinder(car,.16,.1,0x253437,x,.23,z,'z');
  car.position.set(start.x, start.y, start.z); group.add(car);
  mountainTruck = car;
  return group;
}

function init3D() {
  try {
    const host = $('sceneHost');
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.45;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
    host.appendChild(renderer.domElement);
    scene = new THREE.Scene(); scene.background = new THREE.Color(0x16313b); scene.fog = new THREE.Fog(0x16313b, 22, 42);
    camera = new THREE.PerspectiveCamera(43, 1, .1, 100); camera.position.set(11.8, 8.8, 15.0);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = .075;
    controls.minDistance = 8; controls.maxDistance = 32;
    controls.maxPolarAngle = Math.PI * .47;
    controls.target.copy(defaultTarget); controls.update();
    hemisphereLight = new THREE.HemisphereLight(0xd7f7f5, 0x607c6c, 2.1); scene.add(hemisphereLight);
    sunLight = new THREE.DirectionalLight(0xffe2b8, 2.65); sunLight.position.set(-8, 16, 10);
    sunLight.castShadow = true; sunLight.shadow.mapSize.set(2048,2048);
    sunLight.shadow.camera.left = -20; sunLight.shadow.camera.right = 20; sunLight.shadow.camera.top = 20; sunLight.shadow.camera.bottom = -20;
    sunLight.shadow.bias = -.00018; sunLight.shadow.normalBias = .015; scene.add(sunLight);
    fillLight = new THREE.DirectionalLight(0x79c6d0, 1.0); fillLight.position.set(8, 6, -10); scene.add(fillLight);
    rampScene = createRampScene(); mountainScene = createMountainScene(); scene.add(rampScene, mountainScene);
    sceneReady = true;
    new ResizeObserver(resizeScene).observe(host); resizeScene(); update3D();
    requestAnimationFrame(renderLoop);
    playProblem();
  } catch (error) {
    console.error('3D 场景初始化失败', error);
    $('sceneFallback').hidden = false;
  }
}
function resizeScene() {
  if (!renderer) return;
  const host = $('sceneHost'), w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight);
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}
function renderLoop() {
  requestAnimationFrame(renderLoop);
  if (state.animationStart !== null) {
    const t = Math.min(1, (performance.now() - state.animationStart) / state.animationDuration);
    $('sceneHost').dataset.animationProgress = t.toFixed(3);
    if (state.phase === 'routes') {
      const travel = Math.max(0, Math.min(1, (t - .31) / .51));
      const progress = .52 * (1 - Math.pow(1 - travel, 2.4));
      positionMountainTruck(progress);
      const focus = t >= .14 && t <= .31 ? Math.sin(Math.PI * (t - .14) / .17) : 0;
      controls.target.set(0, 2 + .8 * focus, 0);
      homeLabel.scale.set(2.1 * (1 + .13 * focus), .525 * (1 + .13 * focus), 1);
      elements.stageTag.textContent = t < .14 ? '山脚货车已装货' : t < .31 ? '目标：山顶客户新家' : t < .65 ? '尝试直接上山' : '陡坡前减速停下';
    } else {
      let rise = 0, wobble = 0;
      if (t >= .12 && t < .43) {
        const lift = (t - .12) / .31;
        rise = .62 * (1 - Math.pow(1 - lift, 3));
      } else if (t >= .43 && t < .65) {
        rise = .62; wobble = .018 * Math.sin((t - .43) * 58);
      } else if (t >= .65 && t < .91) {
        const lower = (t - .65) / .26;
        rise = .62 * (1 - lower * lower * (3 - 2 * lower));
      }
      cargo.position.set(-4.22 + wobble, rise, 1.42);
      $('sceneHost').dataset.cargoLift = rise.toFixed(3);
      elements.stageTag.textContent = t < .12 ? '货物在装卸区' : t < .65 ? '尝试直接搬运 · 遇到困难' : '仍未到达货车平台';
    }
    if (t >= 1) { state.animationStart = null; state.problemShown = true; renderUI(); }
  }
  controls.update();
  if (state.phase === 'routes' && (state.drawing || state.routePaused)) {
    const anchor = routeEndPoint().clone().project(camera);
    elements.drawingSurface.dataset.anchorScreen = `${((anchor.x + 1) / 2).toFixed(4)},${((1 - anchor.y) / 2).toFixed(4)}`;
  }
  renderer.render(scene, camera);
}
function resetCargo() { if (cargo) cargo.position.set(-4.22, 0, 1.42); }
function mountainTravelPoint(progress) {
  const x = -5 + 5 * progress + .14 * Math.sin(Math.PI * progress / .52);
  const z = 6 - 6 * progress;
  return new THREE.Vector3(x, mountainHeight(x, z) - .06, z);
}
function positionMountainTruck(progress, immediate = false) {
  const point = mountainTravelPoint(progress);
  const before = mountainTravelPoint(Math.max(0, progress - .006));
  const after = mountainTravelPoint(Math.min(.52, progress + .006));
  const direction = after.sub(before).normalize();
  const yaw = Math.atan2(-direction.z, direction.x);
  const pitch = Math.max(-.14, Math.min(.14, Math.atan2(direction.y, Math.hypot(direction.x, direction.z))));
  const target = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw)
    .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), pitch));
  mountainTruck.position.copy(point);
  mountainTruck.quaternion.slerp(target, immediate ? 1 : .23);
  const forward = new THREE.Vector3(1, 0, 0).applyQuaternion(mountainTruck.quaternion);
  const horizontalDirection = direction.clone().setY(0).normalize();
  $('sceneHost').dataset.truckAlignment = String(Number(forward.setY(0).normalize().dot(horizontalDirection).toFixed(3)));
  $('sceneHost').dataset.truckPitch = String(Number(pitch.toFixed(3)));
  $('sceneHost').dataset.truckPosition = `${point.x.toFixed(3)},${point.y.toFixed(3)},${point.z.toFixed(3)}`;
}
function playProblem() {
  if (!sceneReady) return;
  state.problemShown = false;
  state.animationDuration = state.phase === 'routes' ? 4800 : 3800;
  state.animationStart = performance.now();
  if (state.phase === 'routes') {
    resetCamera(); positionMountainTruck(0, true);
  } else resetCargo();
  renderUI();
}
function resetCamera() {
  if (!sceneReady) return;
  if (state.phase === 'routes') { camera.position.set(10.8, 9.5, 12.3); controls.target.set(0, 2.0, 0); }
  else { camera.position.set(11.8, 8.8, 15.0); controls.target.set(.3, 1.3, .5); }
  controls.update();
}
function update3D() {
  if (!sceneReady) return;
  const onMountain = state.phase === 'routes';
  rampScene.visible = !onMountain; mountainScene.visible = onMountain;
  hemisphereLight.intensity = onMountain ? 1.25 : 2.1;
  sunLight.intensity = onMountain ? 3.0 : 2.65;
  fillLight.intensity = onMountain ? .55 : 1.0;
  if (!onMountain) {
    const show = state.phase === 'evidence' || state.methodsShown;
    rampMeshes.lift.visible = show;
    for (const [key, meshes] of Object.entries(rampStructures)) for (const mesh of meshes) mesh.visible = show;
    for (const [key, label] of Object.entries(rampLabels)) label.visible = show && state.ramp === key;
    for (const [key, mesh] of Object.entries(rampMeshes)) {
      if (key === 'lift') { mesh.material.color.setHex(state.ramp === 'lift' ? 0xf2a45d : 0x547b81); continue; }
      mesh.material.emissive.setHex(state.ramp === key ? 0x365f55 : 0x000000);
      mesh.material.emissiveIntensity = state.ramp === key ? .7 : 0;
    }
  }
}

const routeRaycaster = new THREE.Raycaster();
const routePointer = new THREE.Vector2();
let routeGestureActive = false, routePointerId = null;
const ROUTE_NOTE = '从山脚货车旁起笔。可暂停绘制、转动山体，再从上一段终点附近继续；实物搭建与遥控货车测试仍由学生完成。';
function routeStartPoint() {
  const foot = mountainTravelPoint(0);
  return new THREE.Vector3(foot.x, mountainHeight(foot.x, foot.z) + .17, foot.z);
}
function routeEndPoint() {
  const lastSegment = state.routeSegments.at(-1);
  return lastSegment?.at(-1) || routeStartPoint();
}
function routePointCount() { return state.routeSegments.reduce((sum, segment) => sum + segment.length, 0); }
function pointOnTerrain(event) {
  if (!sceneReady || !terrainSurface) return null;
  const rect = renderer.domElement.getBoundingClientRect();
  routePointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
  routeRaycaster.setFromCamera(routePointer, camera);
  const hit = routeRaycaster.intersectObject(terrainSurface, false)[0];
  if (!hit || Math.abs(hit.point.x) > 9.3 || Math.abs(hit.point.z) > 9.3) return null;
  return new THREE.Vector3(hit.point.x, mountainHeight(hit.point.x, hit.point.z) + .17, hit.point.z);
}
function lightlySmoothedRoute(points) {
  return points.map((current, i) => {
    if (i === 0 || i === points.length - 1) return current;
    const previous = points[i - 1], next = points[i + 1];
    const a = new THREE.Vector2(current.x - previous.x, current.z - previous.z).normalize();
    const b = new THREE.Vector2(next.x - current.x, next.z - current.z).normalize();
    if (a.dot(b) < .72) return current; // Keep deliberate turns in the student's route.
    const candidate = new THREE.Vector2(.14 * previous.x + .72 * current.x + .14 * next.x, .14 * previous.z + .72 * current.z + .14 * next.z);
    const adjustment = candidate.sub(new THREE.Vector2(current.x, current.z)).clampLength(0, .1);
    return new THREE.Vector3(current.x + adjustment.x, 0, current.z + adjustment.y);
  });
}
function rebuildStudentRoute(finished = false) {
  elements.drawingSurface.dataset.points = String(routePointCount());
  elements.drawingSurface.dataset.segments = String(state.routeSegments.length);
  elements.drawingSurface.dataset.smoothed = String(finished && routePointCount() > 2);
  if (studentRouteMesh) { mountainScene.remove(studentRouteMesh); studentRouteMesh.geometry.dispose(); studentRouteMesh.material.dispose(); studentRouteMesh = null; }
  if (!state.routeSegments.some(segment => segment.length > 1)) return;
  const vertices = [], indices = [];
  let stepIndex = 0;
  for (const segment of state.routeSegments) {
    if (segment.length < 2) continue;
    const points = finished ? lightlySmoothedRoute(segment) : segment;
    const firstStepIndex = stepIndex;
    for (let i = 1; i < points.length; i++) {
      const previous = points[i - 1], current = points[i];
      const distance = Math.hypot(current.x - previous.x, current.z - previous.z);
      const steps = Math.max(1, Math.ceil(distance / .12));
      for (let j = i === 1 ? 0 : 1; j <= steps; j++) {
        const t = j / steps, x = previous.x + (current.x - previous.x) * t, z = previous.z + (current.z - previous.z) * t;
        const dx = current.x - previous.x, dz = current.z - previous.z, length = Math.hypot(dx, dz) || 1;
        const sideX = -dz / length * .115, sideZ = dx / length * .115;
        for (const sign of [-1, 1]) vertices.push(x + sideX * sign, mountainHeight(x + sideX * sign, z + sideZ * sign) + .095, z + sideZ * sign);
        if (stepIndex > firstStepIndex) { const n = stepIndex * 2; indices.push(n - 2, n - 1, n, n - 1, n + 1, n); }
        stepIndex++;
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
  studentRouteMesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0xffd28b, side: THREE.DoubleSide, depthTest: true }));
  studentRouteMesh.renderOrder = 5; mountainScene.add(studentRouteMesh);
}
function addRoutePoint(event, first = false) {
  const point = pointOnTerrain(event);
  if (!point) return false;
  const anchor = routeEndPoint();
  if (first) {
    if (Math.hypot(point.x - anchor.x, point.z - anchor.z) > .9) {
      elements.routeToolNote.textContent = state.routeSegments.length ? '请从上一段终点附近继续绘制。' : '请从山脚货车旁开始绘制。';
      return false;
    }
    state.routeSegments.push([anchor]);
    elements.routeToolNote.textContent = ROUTE_NOTE;
  }
  const segment = state.routeSegments.at(-1);
  if (!segment) return false;
  const previous = segment.at(-1);
  const distance = Math.hypot(point.x - previous.x, point.z - previous.z);
  if (distance > 1.15) return false;
  if (distance >= .09) segment.push(point);
  rebuildStudentRoute();
  return true;
}

function selectedGroup() { return state.groups[state.groupIndex] || state.groups[0]; }
function formatForce(n) { return n === null ? '—' : `${Number(n.toFixed(2))} N`; }
function classStatistics() {
  return Object.fromEntries(RAMP_KEYS.map(key => {
    const participants = state.groups.filter(group => group.included && group.values[key] !== null);
    const mean = participants.length ? participants.reduce((sum, group) => sum + group.values[key], 0) / participants.length : null;
    return [key, { mean, count: participants.length }];
  }));
}
const SVG_NS = 'http://www.w3.org/2000/svg';
function svgNode(name, attrs = {}, content = null) {
  const el = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
  if (content !== null) el.textContent = content;
  return el;
}
function drawClassChart(host, large, stats) {
  host.replaceChildren();
  const w = large ? 1000 : 320, h = large ? 510 : 215;
  const left = large ? 76 : 35, right = large ? 30 : 8, top = large ? 51 : 25, bottom = large ? 87 : 49;
  const plotW = w - left - right, plotH = h - top - bottom;
  const allValues = state.groups.flatMap(group => RAMP_KEYS.map(key => group.values[key]).filter(value => value !== null));
  const highest = Math.max(0, ...allValues);
  const axisMax = highest === 0 ? 1 : Math.max(.1, Number((highest * 1.12).toPrecision(2)));
  const ceiling = Math.max(axisMax, highest);
  const y = value => top + plotH * (1 - value / ceiling);
  const svg = svgNode('svg', { viewBox: `0 0 ${w} ${h}`, role: 'img', 'aria-label': '全班平均拉力柱状图及各小组平均拉力数据点', preserveAspectRatio: 'xMidYMid meet' });
  for (const ratio of [0, .5, 1]) {
    const yy = y(ceiling * ratio);
    svg.appendChild(svgNode('line', { x1: left, y1: yy, x2: w - right, y2: yy, stroke: ratio === 0 ? '#9bb6ba' : '#45636b', 'stroke-width': ratio === 0 ? 1.6 : 1 }));
    svg.appendChild(svgNode('text', { x: left - 7, y: yy + (large ? 5 : 3), 'text-anchor': 'end', fill: '#c7dcda', 'font-size': large ? 17 : 9 }, Number((ceiling * ratio).toFixed(2)).toString()));
  }
  svg.appendChild(svgNode('text', { x: left, y: large ? 20 : 11, fill: '#d9efeb', 'font-size': large ? 17 : 9, 'font-weight': '700' }, '平均拉力（N）'));
  RAMP_KEYS.forEach((key, column) => {
    const cx = left + plotW * (column + .5) / 4;
    const { mean, count } = stats[key];
    if (mean !== null) {
      const barW = large ? 96 : 39, topY = y(mean);
      svg.appendChild(svgNode('rect', { x: cx - barW / 2, y: topY, width: barW, height: Math.max(1, top + plotH - topY), rx: large ? 7 : 3, fill: key === 'lift' ? '#d7945c' : '#60bfb0', opacity: '.85' }));
      svg.appendChild(svgNode('text', { x: cx, y: top - (large ? 9 : 3), 'text-anchor': 'middle', fill: '#ffffff', 'font-size': large ? 18 : 10, 'font-weight': '700' }, `${large ? '均 ' : ''}${Number(mean.toFixed(2))}`));
    }
    state.groups.forEach((group, index) => {
      const value = group.values[key];
      if (value === null) return;
      const offset = (index - (state.groups.length - 1) / 2) * (large ? 13 : 4.4);
      const dot = svgNode('circle', { cx: cx + offset, cy: y(value), r: large ? 7 : 3.7, fill: group.included ? '#f7fcf7' : '#162d37', stroke: group.included ? '#203e45' : '#f5c98e', 'stroke-width': large ? 2.4 : 1.5 });
      dot.appendChild(svgNode('title', {}, `${group.name}：${formatForce(value)}${group.included ? '' : '；未参与全班平均'}`));
      svg.appendChild(dot);
    });
    svg.appendChild(svgNode('text', { x: cx, y: h - (large ? 44 : 23), 'text-anchor': 'middle', fill: '#e6f4f0', 'font-size': large ? 21 : 10, 'font-weight': '700' }, RAMP_NAMES[key]));
    svg.appendChild(svgNode('text', { x: cx, y: h - (large ? 17 : 7), 'text-anchor': 'middle', fill: '#a8c3c3', 'font-size': large ? 17 : 9 }, `${count}组参与`));
  });
  host.appendChild(svg);
}
function renderChart() {
  elements.groupSelect.replaceChildren();
  state.groups.forEach((group, i) => {
    const option = document.createElement('option'); option.value = String(i); option.textContent = group.name || `第${i+1}组`;
    elements.groupSelect.appendChild(option);
  });
  elements.groupSelect.value = String(state.groupIndex);
  const values = selectedGroup().values;
  const hasData = RAMP_KEYS.some(key => values[key] !== null);
  elements.singleDataEmpty.hidden = hasData; elements.forceChart.hidden = !hasData; elements.singleDataFoot.hidden = !hasData;
  const max = Math.max(0, ...Object.values(values).filter(v => v !== null));
  elements.forceChart.replaceChildren();
  if (!hasData) return;
  for (const key of RAMP_KEYS) {
    const row = document.createElement('div'); row.className = `bar-item${state.ramp === key ? ' selected' : ''}`;
    const label = document.createElement('span'); label.className = 'bar-label'; label.textContent = RAMP_NAMES[key];
    const track = document.createElement('div'); track.className = 'bar-track';
    const fill = document.createElement('div'); fill.className = 'bar-fill';
    fill.style.width = values[key] === null || max === 0 ? '0%' : `${100 * values[key] / max}%`;
    track.appendChild(fill);
    const value = document.createElement('span'); value.className = 'bar-value'; value.textContent = formatForce(values[key]);
    row.append(label,track,value); elements.forceChart.appendChild(row);
  }
}
function renderClassView() {
  const hasData = state.groups.some(group => RAMP_KEYS.some(key => group.values[key] !== null));
  elements.classDataEmpty.hidden = hasData;
  elements.smallClassChart.hidden = !hasData; elements.expandChartButton.hidden = !hasData;
  elements.classSummary.hidden = !hasData; elements.classDataFoot.hidden = !hasData;
  elements.largeClassChart.replaceChildren(); elements.smallClassChart.replaceChildren();
  if (!hasData) return;
  const stats = classStatistics();
  drawClassChart(elements.smallClassChart, false, stats);
  drawClassChart(elements.largeClassChart, true, stats);
  const excluded = state.groups.filter(group => !group.included && RAMP_KEYS.some(key => group.values[key] !== null)).length;
  elements.classSummary.textContent = `柱形为各项已录入且条件可比的小组平均值。${excluded ? `${excluded}组未参与全班平均，仍保留数据点。` : '圆点显示各组真实记录。'}`;
}
function evidenceText() {
  if (state.dataView === 'class') {
    const stats = classStatistics();
    if (RAMP_KEYS.some(key => stats[key].mean === null)) return '<strong>目前的发现：</strong>有些类别尚无可比数据。请依据已有记录提出发现，并继续补充真实测量。';
    const gentleTrend = stats.short.mean >= stats.medium.mean && stats.medium.mean >= stats.long.mean;
    const rampLower = ['short','medium','long'].every(key => stats[key].mean < stats.lift.mean);
    if (gentleTrend && rampLower) return '<strong>从本班已录入的实验数据看：</strong>在同规格重物、相同提升高度和相同测量方法等条件下，使用斜面时的平均拉力较小；较平缓的斜面通常需要较小拉力，同时搬运距离更长。请结合各组数据点讨论差异。';
    return '<strong>从本班已录入的数据看：</strong>不同方法的平均拉力有差异，但本次结果未完整呈现预期趋势。请保留数据，检查各组条件、测量操作与记录，再讨论可能的原因。';
  }
  const v = selectedGroup().values;
  if (RAMP_KEYS.some(key => v[key] === null)) return '<strong>继续追问：</strong>这一组的数据还不完整。先补齐同一重物的四种测量，再比较。';
  const slopesLower = ['short','medium','long'].every(key => v[key] < v.lift);
  const ordered = v.short >= v.medium && v.medium >= v.long;
  if (slopesLower && ordered) return '<strong>从本组本次数据看：</strong>三种斜面的拉力都小于直接提起，且由短至长没有增大。这支持我们继续讨论“较缓时可能更省力”；请与其他小组比较，并注意行进距离变长。';
  return '<strong>回看本组证据：</strong>本次测量没有完整呈现预期趋势。请核对是否使用同一重物和高度，并检查拉动方向、匀速程度与读数；保留原始数据。';
}
function renderReveal() {
  if (state.phase === 'routes') {
    elements.revealButton.textContent = state.designHintsShown ? '隐藏设计提示' : '显示设计提示';
    elements.routePrompt.hidden = !state.designHintsShown;
    elements.revealBox.hidden = true;
    elements.largeRevealBox.hidden = true;
    return;
  }
  const visible = state.revealed[state.phase]; elements.revealBox.hidden = !visible;
  elements.revealButton.textContent = visible ? '收起研讨提示' : state.phase === 'evidence' ? '揭示我们的发现' : '学生表达后 · 揭示研讨提示';
  elements.largeRevealBox.hidden = !visible;
  elements.largeRevealButton.textContent = visible ? '收起我们的发现' : '揭示我们的发现';
  elements.largeRevealBox.innerHTML = visible && state.phase === 'evidence' ? evidenceText() : '';
  if (!visible) return;
  if (state.phase === 'context') elements.revealBox.innerHTML = '<strong>进入实物实验：</strong>同一件重物、同一目标高度，用直接提起和三种斜面分别测量。先记录，再判断哪种方式更省力。';
  else if (state.phase === 'evidence') elements.revealBox.innerHTML = evidenceText();
}
function renderUI() {
  const routePhase = state.phase === 'routes', dataPhase = state.phase === 'evidence';
  const classData = dataPhase && state.dataView === 'class';
  for (const b of document.querySelectorAll('[data-phase]')) { b.classList.toggle('active', b.dataset.phase === state.phase); b.setAttribute('aria-pressed', String(b.dataset.phase === state.phase)); }
  for (const b of document.querySelectorAll('[data-ramp]')) { b.classList.toggle('active', b.dataset.ramp === state.ramp); b.setAttribute('aria-pressed', String(b.dataset.ramp === state.ramp)); }
  elements.rampControls.hidden = routePhase; elements.routeControls.hidden = !routePhase;
  elements.methodChoices.hidden = state.phase === 'context' && !state.methodsShown;
  elements.contextWait.hidden = state.phase !== 'context' || state.methodsShown;
  elements.showMethodsButton.hidden = state.phase !== 'context' || state.methodsShown || !state.problemShown;
  elements.drawRouteButton.hidden = state.drawing || !state.problemShown;
  elements.drawRouteButton.textContent = state.routePaused ? '继续绘制路线' : state.routeSegments.length ? '继续绘制路线' : '开始绘制路线';
  elements.pauseRouteButton.hidden = !state.drawing;
  elements.finishRouteButton.hidden = !(state.drawing || state.routePaused);
  elements.drawingSurface.hidden = !state.drawing;
  elements.chartScreen.hidden = !state.chartOpen;
  document.querySelector('.workspace').classList.toggle('chart-open', state.chartOpen);
  if (controls) controls.enabled = !state.drawing && state.animationStart === null;
  elements.dataPanel.hidden = !dataPhase; elements.routePrompt.hidden = true; elements.extensionPanel.hidden = !routePhase || !state.designHintsShown;
  elements.revealButton.hidden = (routePhase || state.phase === 'context') && !state.problemShown;
  elements.singleGroupView.hidden = state.dataView !== 'single'; elements.classView.hidden = state.dataView !== 'class';
  elements.questionNum.hidden = classData; elements.questionTitle.hidden = classData; elements.questionBody.hidden = classData;
  document.querySelector('.discussion').classList.toggle('class-view-active', classData);
  document.querySelector('.discussion').classList.toggle('route-phase', routePhase);
  for (const button of document.querySelectorAll('[data-data-view]')) {
    const active = button.dataset.dataView === state.dataView;
    button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active));
  }
  elements.animateButton.hidden = dataPhase;
  if (routePhase) {
    elements.phaseEyebrow.textContent = '项目二 · 货车上山'; elements.phaseTitle.textContent = '货车怎样才能到达山顶客户家？';
    elements.phaseSubtitle.textContent = '提出路线想法，先做实物设计与测试，再展示学生方案。';
    elements.controlHeading.textContent = '展示学生方案'; elements.discussionHeading.textContent = '作品汇报与研讨';
    elements.questionNum.textContent = '问题 03'; elements.questionTitle.textContent = state.problemShown ? '直接上山太困难，怎样设计一条货车可以通行的路线？' : '货车要把货物送到哪里？';
    elements.questionBody.textContent = state.problemShown ? '先让学生提出想法，用木板、高台和遥控货车搭建、测试并汇报自己的方案。' : '观察山脚货车与山顶客户新家，看看送货时遇到什么困难。';
    elements.stageContext.textContent = '山脚货车 · 山顶客户新家'; elements.stageTag.textContent = state.problemShown ? '学生设计上山路线' : '送货途中';
    elements.stageCaption.textContent = state.drawing ? '画路线 · 单指或鼠标拖动；可暂停并调整视角。' : state.routePaused ? '调整视角 · 转动山体后，从上一段终点附近继续。' : '实物测试后，在山体上展示学生方案。';
    elements.leftStatus.textContent = '学生方案示意 · 不判断通行'; $('footerStep').textContent = '03 / 山路挑战';
  } else {
    elements.phaseEyebrow.textContent = '项目一 · 货物搬上车';
    elements.phaseTitle.textContent = dataPhase ? '实验数据能告诉我们什么？' : '怎样把同一件货物搬上货车？';
    elements.phaseSubtitle.textContent = dataPhase ? '六组真实平均值是全班讨论的证据。' : '先看搬货难题，再提出办法和开展真实实验。';
    elements.controlHeading.textContent = '比较搬运方式'; elements.discussionHeading.textContent = classData ? '全班真实数据' : dataPhase ? '数据与证据' : '先想一想';
    elements.questionNum.textContent = dataPhase ? '问题 02' : '问题 01';
    elements.questionTitle.textContent = dataPhase ? '全班实验数据说明了什么？' : state.problemShown ? '这么重的货物，怎样更轻松地搬上货车？' : '货物怎样搬上货车？';
    elements.questionBody.textContent = dataPhase ? '先观察柱形和各组数据点，指出共同点与差异；学生表达后再揭示发现。' : state.problemShown ? '请学生先提出办法并预测，随后用真实实验检验。' : '先观察同一件货物直接搬运时遇到的困难。';
    elements.stageContext.textContent = '同一重物 · 同一目标高度'; elements.stageTag.textContent = RAMP_NAMES[state.ramp];
    elements.stageCaption.textContent = dataPhase ? '数据来自学生测量；3D 仅表现结构。' : state.methodsShown ? '按学生提出的办法展示结构，再开展真实实验。' : '情境动画只提出问题，不显示测量结果。';
    elements.leftStatus.textContent = dataPhase ? '真实测量数据 · 不预设数值' : '结构示意 · 不显示测量结果';
    $('footerStep').textContent = dataPhase ? '02 / 数据找规律' : '01 / 搬货难题';
  }
  renderChart(); renderClassView(); renderReveal(); update3D();
}

function openData() {
  state.draft = state.groups.map(group => ({ name: group.name, included: group.included, values: { ...group.values } }));
  elements.dataValidation.textContent = ''; renderDataRows(); elements.dataDialog.showModal();
}
function renderDataRows() {
  elements.dataRows.replaceChildren();
  state.draft.forEach((group, index) => {
    const tr = document.createElement('tr');
    const nameCell = document.createElement('td');
    const name = document.createElement('input'); name.className = 'group-name'; name.setAttribute('aria-label', `第${index+1}组名称`);
    name.value = group.name; name.addEventListener('input', () => { group.name = name.value; }); nameCell.appendChild(name); tr.appendChild(nameCell);
    for (const key of RAMP_KEYS) {
      const td = document.createElement('td'), input = document.createElement('input');
      input.type = 'number'; input.min = '0'; input.step = 'any'; input.inputMode = 'decimal'; input.placeholder = 'N';
      input.setAttribute('aria-label', `${group.name || `第${index+1}组`}${RAMP_NAMES[key]}平均拉力`);
      input.value = group.values[key] === null ? '' : String(group.values[key]);
      input.addEventListener('input', () => { group.values[key] = input.value.trim() === '' ? null : Number(input.value); });
      td.appendChild(input); tr.appendChild(td);
    }
    const includeCell = document.createElement('td'), includeLabel = document.createElement('label'), include = document.createElement('input');
    include.type = 'checkbox'; include.checked = group.included !== false; include.setAttribute('aria-label', `${group.name || `第${index+1}组`}参与全班平均`);
    include.addEventListener('change', () => { group.included = include.checked; });
    includeLabel.append(include, document.createTextNode(' 参与')); includeCell.appendChild(includeLabel); tr.appendChild(includeCell);
    const actionCell = document.createElement('td'), remove = document.createElement('button');
    remove.type = 'button'; remove.className = 'remove-group'; remove.textContent = '移除'; remove.disabled = state.draft.length <= 1;
    remove.addEventListener('click', () => { state.draft.splice(index, 1); renderDataRows(); });
    actionCell.appendChild(remove); tr.appendChild(actionCell); elements.dataRows.appendChild(tr);
  });
}
function saveData() {
  for (const [index, group] of state.draft.entries()) {
    if (!group.name.trim()) { elements.dataValidation.textContent = `请填写第${index+1}组名称。`; return; }
    for (const key of RAMP_KEYS) {
      const value = group.values[key];
      if (value !== null && (!Number.isFinite(value) || value < 0)) { elements.dataValidation.textContent = `${group.name}的${RAMP_NAMES[key]}拉力需为非负数。`; return; }
    }
  }
  state.groups = state.draft.map(g => ({ name: g.name.trim(), included: g.included !== false, values: { ...g.values } }));
  state.groupIndex = Math.min(state.groupIndex, state.groups.length - 1);
  saveSessionGroups(state.groups);
  state.revealed.evidence = false; elements.dataDialog.close(); renderUI();
}

document.querySelectorAll('[data-phase]').forEach(b => b.addEventListener('click', () => {
  const previousRoute = state.phase === 'routes'; state.phase = b.dataset.phase;
  state.chartOpen = false; state.drawing = false; state.routePaused = false; state.animationStart = null; state.problemShown = false;
  if (state.phase === 'context') state.methodsShown = false;
  if (state.phase === 'routes') state.designHintsShown = false;
  if (previousRoute !== (state.phase === 'routes')) resetCamera();
  renderUI();
  if (state.phase !== 'evidence') playProblem();
}));
document.querySelectorAll('[data-ramp]').forEach(b => b.addEventListener('click', () => {
  state.ramp = b.dataset.ramp; renderUI();
}));
elements.revealButton.addEventListener('click', () => {
  if (state.phase === 'routes') { state.designHintsShown = !state.designHintsShown; renderUI(); }
  else { state.revealed[state.phase] = !state.revealed[state.phase]; renderReveal(); }
});
elements.largeRevealButton.addEventListener('click', () => { state.revealed.evidence = !state.revealed.evidence; renderReveal(); });
elements.animateButton.addEventListener('click', playProblem);
elements.showMethodsButton.addEventListener('click', () => { state.methodsShown = true; renderUI(); });
elements.resetViewButton.addEventListener('click', resetCamera);
elements.expandChartButton.addEventListener('click', () => { state.chartOpen = true; state.revealed.evidence = false; renderUI(); });
elements.closeChartButton.addEventListener('click', () => { state.chartOpen = false; renderUI(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && state.chartOpen) { state.chartOpen = false; renderUI(); } });
elements.drawRouteButton.addEventListener('click', () => {
  if (!sceneReady) return;
  positionMountainTruck(0, true);
  if (!state.routePaused && !state.routeSegments.length) resetCamera();
  state.drawing = true; state.routePaused = false; routeGestureActive = false; routePointerId = null;
  elements.routeToolNote.textContent = ROUTE_NOTE;
  renderUI();
});
elements.pauseRouteButton.addEventListener('click', () => {
  endRouteGesture(); state.drawing = false; state.routePaused = true; renderUI();
});
elements.finishRouteButton.addEventListener('click', () => {
  endRouteGesture(); state.drawing = false; state.routePaused = false; rebuildStudentRoute(true);
  const offset = camera.position.clone().sub(controls.target);
  if (offset.length() < 22) camera.position.copy(controls.target).add(offset.setLength(22));
  controls.update(); renderUI();
});
elements.clearRouteButton.addEventListener('click', () => {
  endRouteGesture(); state.routeSegments = []; elements.routeToolNote.textContent = ROUTE_NOTE;
  if (state.phase === 'routes') positionMountainTruck(0, true);
  rebuildStudentRoute(); renderUI();
});
function endRouteGesture() {
  routeGestureActive = false; routePointerId = null;
  if (state.routeSegments.at(-1)?.length === 1) state.routeSegments.pop();
  rebuildStudentRoute();
}
elements.drawingSurface.addEventListener('pointerdown', event => {
  if (!state.drawing || event.button > 0 || event.isPrimary === false || routeGestureActive) return;
  routeGestureActive = addRoutePoint(event, true);
  if (routeGestureActive) { routePointerId = event.pointerId; elements.drawingSurface.setPointerCapture(event.pointerId); }
  event.preventDefault();
});
elements.drawingSurface.addEventListener('pointermove', event => {
  if (!routeGestureActive || !state.drawing || event.pointerId !== routePointerId) return;
  addRoutePoint(event); event.preventDefault();
});
for (const type of ['pointerup', 'pointercancel']) elements.drawingSurface.addEventListener(type, event => {
  if (event.pointerId === routePointerId) endRouteGesture();
});
elements.groupSelect.addEventListener('change', () => { state.groupIndex = Number(elements.groupSelect.value); state.revealed.evidence = false; renderUI(); });
document.querySelectorAll('[data-data-view]').forEach(button => button.addEventListener('click', () => {
  state.dataView = button.dataset.dataView; state.revealed.evidence = false; renderUI();
}));
$('openDataButton').addEventListener('click', openData);
$('closeDataButton').addEventListener('click', () => elements.dataDialog.close());
$('addGroupButton').addEventListener('click', () => { state.draft.push(blankGroup(state.draft.length)); renderDataRows(); });
$('saveDataButton').addEventListener('click', saveData);
$('fullscreenButton').addEventListener('click', async () => {
  if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen();
});
document.addEventListener('fullscreenchange', () => { $('fullscreenButton').textContent = document.fullscreenElement ? '退出全屏' : '全屏展示'; });

renderUI(); init3D();
