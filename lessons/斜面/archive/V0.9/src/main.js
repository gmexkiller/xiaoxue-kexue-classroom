import * as THREE from '../../../vendor/three/three.module.js';
import { OrbitControls } from '../../../vendor/three/addons/controls/OrbitControls.js';

const RAMP_KEYS = ['lift', 'short', 'medium', 'long'];
const RAMP_NAMES = { lift: '直接提起', short: '短斜面', medium: '中斜面', long: '长斜面' };
const ROUTE_NAMES = { straight: '直上', zigzag: '曲折', winding: '盘绕' };
const ROUTE_TEXT = {
  straight: '直上路线较直接。观察实物测试：遥控货车能否顺利上山？',
  zigzag: '曲折路线增加转向与行进距离。观察各段坡道、转弯处与固定方式。',
  winding: '盘绕路线绕山前进。讨论它换来了什么，也检查路宽、转弯和稳固性。',
};

const state = {
  phase: 'context', ramp: 'lift', route: 'straight', overlay: false,
  groups: [{ name: '第1组', values: { lift: null, short: null, medium: null, long: null } }],
  groupIndex: 0, draft: null, revealed: { context: false, evidence: false, routes: false },
  animationStart: null, animationDuration: 2600,
};

const $ = (id) => document.getElementById(id);
const elements = {
  phaseEyebrow: $('phaseEyebrow'), phaseTitle: $('phaseTitle'), phaseSubtitle: $('phaseSubtitle'),
  controlHeading: $('controlHeading'), rampControls: $('rampControls'), routeControls: $('routeControls'),
  leftStatus: $('leftStatus'), stageContext: $('stageContext'), stageTag: $('stageTag'), stageCaption: $('stageCaption'),
  animateButton: $('animateButton'), overlayButton: $('overlayButton'), resetViewButton: $('resetViewButton'),
  discussionHeading: $('discussionHeading'), questionNum: $('questionNum'), questionTitle: $('questionTitle'),
  questionBody: $('questionBody'), dataPanel: $('dataPanel'), routePrompt: $('routePrompt'),
  revealButton: $('revealButton'), revealBox: $('revealBox'), groupSelect: $('groupSelect'), forceChart: $('forceChart'),
  dataDialog: $('dataDialog'), dataRows: $('dataRows'), dataValidation: $('dataValidation'),
};

let renderer, scene, camera, controls, rampScene, mountainScene, cargo, routeMeshes = {}, rampMeshes = {}, sceneReady = false;
let defaultTarget = new THREE.Vector3(0, 1.4, 0);
const clock = new THREE.Clock();

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
  box(group, 8.8, .28, 2.25, orange, -.1, 1.96, -2.73);
  box(group, 2.35, 1.72, 2.55, orange, 5.38, 1.8, -2.7);
  box(group, 1.05, .67, .08, 0x9ccbd1, 5.78, 2.22, -1.38, .14);
  box(group, 1.48, .28, 2.35, dark, 5.33, .78, -2.72);
  box(group, 8.7, .22, 2.3, dark, -.1, .84, -2.72);
  for (const x of [-2.55, 2.75, 5.45]) {
    cylinder(group, .63, .28, 0x18252b, x, .58, -1.3, 'z');
    cylinder(group, .63, .28, 0x18252b, x, .58, -4.1, 'z');
    cylinder(group, .32, .3, 0xb9c4bf, x, .58, -1.3, 'z');
  }
  spriteLabel(group, '同一货车平台高度', -.2, 3.28, -3.15, '#a8f0df', 3.15);
}

const rampDefinitions = {
  short: { x: -2.55, start: 1.0, color: 0xd39068 },
  medium: { x: 0, start: 2.6, color: 0x8fb5a8 },
  long: { x: 2.55, start: 4.35, color: 0x60cbbb },
};
const rampEnd = -1.46, cargoHeight = .54, deckHeight = 2.43;

function createRampScene() {
  const group = new THREE.Group(); group.name = '搬货上车';
  const ground = box(group, 23, .18, 18, 0x314a46, 0, -.16, 1.3, 1);
  ground.castShadow = false;
  for (let x = -9; x < 10; x += 2) box(group, .035, .012, 17, 0x4d6963, x, -.055, 1.4);
  createTruck(group);
  const liftMarker = line(group, [[-4.2, .25, 1.4],[-4.2, 2.65, 1.4],[-4.2, 2.65, -1.7]], 0xf2a45d, .055);
  rampMeshes.lift = liftMarker;
  spriteLabel(group, '直接提起', -4.25, .65, 2.2, '#ffc793', 1.8);
  for (const [key, def] of Object.entries(rampDefinitions)) {
    const lengthZ = def.start - rampEnd;
    const length = Math.hypot(lengthZ, deckHeight);
    const ramp = box(group, 1.78, .16, length, def.color, def.x, deckHeight / 2, (def.start + rampEnd) / 2);
    ramp.rotation.x = Math.atan2(deckHeight, lengthZ);
    for (const side of [-.82, .82]) {
      const rail = box(group, .07, .10, length, 0x597572, def.x + side, deckHeight / 2 + .12, (def.start + rampEnd) / 2);
      rail.rotation.x = ramp.rotation.x;
    }
    rampMeshes[key] = ramp;
    spriteLabel(group, RAMP_NAMES[key], def.x, .57, def.start + .56, '#f2fcf8', 1.72);
  }
  cargo = new THREE.Group();
  box(cargo, .76, .76, .76, 0xbf8b56, 0, .38, 0);
  box(cargo, .78, .06, .08, 0xeac599, 0, .79, 0);
  box(cargo, .08, .06, .78, 0xeac599, 0, .79, 0);
  group.add(cargo);
  return group;
}

const mountainHeight = (x, z) => {
  const r = Math.sqrt(x * x + z * z) / 7.8;
  return 5.25 * Math.pow(Math.max(0, 1 - r), 1.35);
};
const startAngle = Math.atan2(6, -5);
function routePoint(type, t) {
  const r = 7.8 * (1 - t) + .45 * t;
  let angle = startAngle;
  if (type === 'zigzag') angle += .45 * Math.sin(5 * Math.PI * t) * Math.sin(Math.PI * t);
  if (type === 'winding') angle += Math.PI * 1.8 * t;
  const x = Math.cos(angle) * r, z = Math.sin(angle) * r;
  return new THREE.Vector3(x, mountainHeight(x, z) + .10, z);
}
function makeRoad(type, color) {
  const count = 160, width = .32;
  const positions = [], indices = [];
  for (let i = 0; i <= count; i++) {
    const t = i / count, p = routePoint(type, t);
    const a = routePoint(type, Math.max(0, t - .003));
    const b = routePoint(type, Math.min(1, t + .003));
    const tangent = b.clone().sub(a).normalize();
    const side = new THREE.Vector3(-tangent.z, 0, tangent.x).multiplyScalar(width);
    positions.push(p.x + side.x, p.y, p.z + side.z, p.x - side.x, p.y, p.z - side.z);
    if (i < count) { const k = 2 * i; indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, depthTest: true, transparent: true, opacity: .98 }));
  mesh.renderOrder = 4;
  return mesh;
}
function createMountainScene() {
  const group = new THREE.Group(); group.name = '货车上山';
  const terrain = new THREE.PlaneGeometry(19, 19, 98, 98); terrain.rotateX(-Math.PI / 2);
  const position = terrain.attributes.position, colors = [];
  const low = new THREE.Color(0x456b50), mid = new THREE.Color(0x6b9060), high = new THREE.Color(0xa4ab79);
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), z = position.getZ(i), y = mountainHeight(x, z);
    position.setY(i, y);
    const c = y > 3.6 ? mid.clone().lerp(high, (y - 3.6) / 1.7) : low.clone().lerp(mid, y / 3.6);
    colors.push(c.r, c.g, c.b);
  }
  terrain.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); terrain.computeVertexNormals();
  const surface = new THREE.Mesh(terrain, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }));
  surface.receiveShadow = true; group.add(surface);
  const base = box(group, 19.2, .42, 19.2, 0x32493e, 0, -.28, 0, 1); base.castShadow = false;
  for (const [type, color] of [['straight',0xf3ad69],['zigzag',0x75cddd],['winding',0x78dcc4]]) {
    routeMeshes[type] = makeRoad(type, color); group.add(routeMeshes[type]);
  }
  const start = routePoint('straight', 0), top = routePoint('straight', 1);
  spriteLabel(group, '出发', start.x - .7, start.y + .75, start.z, '#f5ddaa', 1.4);
  spriteLabel(group, '山顶目的地', top.x, top.y + .75, top.z, '#effdf8', 2.0);
  const car = new THREE.Group();
  box(car, 1.0, .38, .66, 0xe7924e, 0, .46, 0);
  box(car, .36, .4, .62, 0xf2b56d, .24, .82, 0);
  for (const x of [-.3,.3]) for (const z of [-.32,.32]) cylinder(car,.16,.1,0x253437,x,.23,z,'z');
  car.position.set(start.x, start.y, start.z); group.add(car);
  group.userData.truck = car;
  return group;
}

function init3D() {
  try {
    const host = $('sceneHost');
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.45;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(renderer.domElement);
    scene = new THREE.Scene(); scene.background = new THREE.Color(0x16313b); scene.fog = new THREE.Fog(0x16313b, 22, 42);
    camera = new THREE.PerspectiveCamera(43, 1, .1, 100); camera.position.set(13, 9.3, 16.5);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = .075;
    controls.minDistance = 8; controls.maxDistance = 32;
    controls.maxPolarAngle = Math.PI * .47;
    controls.target.copy(defaultTarget); controls.update();
    scene.add(new THREE.HemisphereLight(0xd7f7f5, 0x607c6c, 2.1));
    const sun = new THREE.DirectionalLight(0xffe2b8, 2.65); sun.position.set(-8, 16, 10);
    sun.castShadow = true; sun.shadow.mapSize.set(1024,1024);
    sun.shadow.camera.left = -20; sun.shadow.camera.right = 20; sun.shadow.camera.top = 20; sun.shadow.camera.bottom = -20;
    sun.shadow.bias = -.00018; scene.add(sun);
    const fill = new THREE.DirectionalLight(0x79c6d0, 1.0); fill.position.set(8, 6, -10); scene.add(fill);
    rampScene = createRampScene(); mountainScene = createMountainScene(); scene.add(rampScene, mountainScene);
    sceneReady = true;
    new ResizeObserver(resizeScene).observe(host); resizeScene(); update3D();
    requestAnimationFrame(renderLoop);
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
  if (state.animationStart !== null && state.phase !== 'routes') {
    const t = Math.min(1, (performance.now() - state.animationStart) / state.animationDuration);
    const eased = t * t * (3 - 2 * t);
    updateCargo(eased);
    if (t >= 1) { state.animationStart = null; elements.animateButton.textContent = '重看路径'; }
  }
  controls.update(); renderer.render(scene, camera); clock.getDelta();
}
function updateCargo(t = 0) {
  if (!cargo) return;
  if (state.ramp === 'lift') {
    const rise = Math.min(1, t * 1.35);
    cargo.position.set(-4.22, deckHeight * rise, 1.42 - 3.0 * Math.max(0, (t - .74) / .26));
  } else {
    const ramp = rampDefinitions[state.ramp];
    cargo.position.set(ramp.x, deckHeight * t + .06, ramp.start + (rampEnd - ramp.start) * t);
  }
}
function resetCamera() {
  if (!sceneReady) return;
  if (state.phase === 'routes') { camera.position.set(13.5, 11.5, 14.8); controls.target.set(0, 2.0, 0); }
  else { camera.position.set(13, 9.3, 16.5); controls.target.set(.3, 1.3, .5); }
  controls.update();
}
function update3D() {
  if (!sceneReady) return;
  const onMountain = state.phase === 'routes';
  rampScene.visible = !onMountain; mountainScene.visible = onMountain;
  if (!onMountain) {
    state.animationStart = null; updateCargo(0);
    for (const [key, mesh] of Object.entries(rampMeshes)) {
      if (key === 'lift') { mesh.material.color.setHex(state.ramp === 'lift' ? 0xf2a45d : 0x547b81); continue; }
      mesh.material.emissive.setHex(state.ramp === key ? 0x365f55 : 0x000000);
      mesh.material.emissiveIntensity = state.ramp === key ? .7 : 0;
    }
  } else {
    for (const [key, mesh] of Object.entries(routeMeshes)) {
      mesh.visible = state.overlay || key === state.route;
      mesh.material.opacity = state.overlay && key !== state.route ? .45 : 1;
    }
  }
}

function selectedGroup() { return state.groups[state.groupIndex] || state.groups[0]; }
function formatForce(n) { return n === null ? '—' : `${Number(n.toFixed(2))} N`; }
function renderChart() {
  elements.groupSelect.replaceChildren();
  state.groups.forEach((group, i) => {
    const option = document.createElement('option'); option.value = String(i); option.textContent = group.name || `第${i+1}组`;
    elements.groupSelect.appendChild(option);
  });
  elements.groupSelect.value = String(state.groupIndex);
  const values = selectedGroup().values;
  const max = Math.max(0, ...Object.values(values).filter(v => v !== null));
  elements.forceChart.replaceChildren();
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
function evidenceText() {
  const v = selectedGroup().values;
  if (RAMP_KEYS.some(key => v[key] === null)) return '<strong>继续追问：</strong>这一组的数据还不完整。先补齐同一重物的四种测量，再比较。';
  const slopesLower = ['short','medium','long'].every(key => v[key] < v.lift);
  const ordered = v.short >= v.medium && v.medium >= v.long;
  if (slopesLower && ordered) return '<strong>从本组数据看：</strong>三个斜面的拉力都小于直接提起；斜面越长、坡度越缓，测得拉力越小。请指出表中的证据，同时注意走过的距离变长。';
  return '<strong>回看本组证据：</strong>这些测量值没有完整呈现“较缓时拉力较小”的趋势。请先核对是否用了同一重物、同一高度，并检查拉动方向、匀速程度和读数；不要改写数据。';
}
function renderReveal() {
  const visible = state.revealed[state.phase]; elements.revealBox.hidden = !visible;
  elements.revealButton.textContent = visible ? '收起研讨提示' : '学生表达后 · 揭示研讨提示';
  if (!visible) return;
  if (state.phase === 'context') elements.revealBox.innerHTML = '<strong>进入实物实验：</strong>同一件重物、同一目标高度，用直接提起和三种斜面分别测量。先记录，再判断哪种方式更省力。';
  else if (state.phase === 'evidence') elements.revealBox.innerHTML = evidenceText();
  else elements.revealBox.innerHTML = `<strong>${ROUTE_NAMES[state.route]}路线：</strong>${ROUTE_TEXT[state.route]}三条路线只是结构示意；请用小组实物测试结果说明选择。`;
}
function renderUI() {
  const routePhase = state.phase === 'routes', dataPhase = state.phase === 'evidence';
  for (const b of document.querySelectorAll('[data-phase]')) { b.classList.toggle('active', b.dataset.phase === state.phase); b.setAttribute('aria-pressed', String(b.dataset.phase === state.phase)); }
  for (const b of document.querySelectorAll('[data-ramp]')) { b.classList.toggle('active', b.dataset.ramp === state.ramp); b.setAttribute('aria-pressed', String(b.dataset.ramp === state.ramp)); }
  for (const b of document.querySelectorAll('[data-route]')) { b.classList.toggle('active', b.dataset.route === state.route); b.setAttribute('aria-pressed', String(b.dataset.route === state.route)); }
  elements.rampControls.hidden = routePhase; elements.routeControls.hidden = !routePhase;
  elements.dataPanel.hidden = !dataPhase; elements.routePrompt.hidden = !routePhase;
  elements.animateButton.hidden = routePhase; elements.overlayButton.hidden = !routePhase;
  elements.overlayButton.textContent = state.overlay ? '只看当前路线' : '叠加路线';
  if (routePhase) {
    elements.phaseEyebrow.textContent = '项目二 · 货车上山'; elements.phaseTitle.textContent = '怎样设计一条可通行的上山路线？';
    elements.phaseSubtitle.textContent = '先展示实物作品，再比较路线结构。';
    elements.controlHeading.textContent = '逐步比较路线'; elements.discussionHeading.textContent = '作品汇报与迁移';
    elements.questionNum.textContent = '问题 03'; elements.questionTitle.textContent = `${ROUTE_NAMES[state.route]}路线值得怎样检验？`;
    elements.questionBody.textContent = ROUTE_TEXT[state.route];
    elements.stageContext.textContent = '同一起点 · 同一目的地'; elements.stageTag.textContent = ROUTE_NAMES[state.route];
    elements.stageCaption.textContent = '路线形状为简化示意，请用实物测试检验通行。';
    elements.leftStatus.textContent = '山地示意 · 无虚构坡度或拉力'; $('footerStep').textContent = '03 / 上山路线迁移';
  } else {
    elements.phaseEyebrow.textContent = '项目一 · 货物搬上车';
    elements.phaseTitle.textContent = dataPhase ? '实验数据能告诉我们什么？' : '怎样把同一件货物搬上货车？';
    elements.phaseSubtitle.textContent = dataPhase ? '观察学生实测值，再讨论斜面结构。' : '先提出办法，再用真实实验检验。';
    elements.controlHeading.textContent = '比较搬运方式'; elements.discussionHeading.textContent = dataPhase ? '数据与证据' : '先想一想';
    elements.questionNum.textContent = dataPhase ? '问题 02' : '问题 01';
    elements.questionTitle.textContent = dataPhase ? '哪一种方式拉力更小？' : '不直接用力搬，能用什么办法？';
    elements.questionBody.textContent = dataPhase ? '先比较真实测量，再指认三种斜面结构。' : '观察货车平台与三块长短不同的木板。先预测哪一种办法可能更省力，并说出理由。';
    elements.stageContext.textContent = '同一重物 · 同一目标高度'; elements.stageTag.textContent = RAMP_NAMES[state.ramp];
    elements.stageCaption.textContent = dataPhase ? '数据来自学生测量；3D 只表现结构和搬运路径。' : '请先观察货车平台与三种斜面的结构。';
    elements.leftStatus.textContent = dataPhase ? '真实测量数据 · 不预设数值' : '结构示意 · 不显示测量结果';
    $('footerStep').textContent = dataPhase ? '02 / 真实数据研讨' : '01 / 情境与预测';
  }
  renderChart(); renderReveal(); update3D();
}

function openData() {
  state.draft = state.groups.map(group => ({ name: group.name, values: { ...group.values } }));
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
  if (!state.draft.some(g => RAMP_KEYS.some(key => g.values[key] !== null))) { elements.dataValidation.textContent = '请至少录入一项真实测量值。'; return; }
  state.groups = state.draft.map(g => ({ name: g.name.trim(), values: { ...g.values } }));
  state.groupIndex = Math.min(state.groupIndex, state.groups.length - 1);
  state.revealed.evidence = false; elements.dataDialog.close(); renderUI();
}

document.querySelectorAll('[data-phase]').forEach(b => b.addEventListener('click', () => {
  const previousRoute = state.phase === 'routes'; state.phase = b.dataset.phase;
  if (previousRoute !== (state.phase === 'routes')) resetCamera();
  renderUI();
}));
document.querySelectorAll('[data-ramp]').forEach(b => b.addEventListener('click', () => {
  state.ramp = b.dataset.ramp; state.animationStart = null; elements.animateButton.textContent = '观看路径'; renderUI();
}));
document.querySelectorAll('[data-route]').forEach(b => b.addEventListener('click', () => {
  state.route = b.dataset.route; state.revealed.routes = false; renderUI();
}));
elements.revealButton.addEventListener('click', () => { state.revealed[state.phase] = !state.revealed[state.phase]; renderReveal(); });
elements.animateButton.addEventListener('click', () => { if (!sceneReady) return; updateCargo(0); state.animationStart = performance.now(); elements.animateButton.textContent = '正在演示'; });
elements.overlayButton.addEventListener('click', () => { state.overlay = !state.overlay; renderUI(); });
elements.resetViewButton.addEventListener('click', resetCamera);
elements.groupSelect.addEventListener('change', () => { state.groupIndex = Number(elements.groupSelect.value); state.revealed.evidence = false; renderUI(); });
$('openDataButton').addEventListener('click', openData);
$('closeDataButton').addEventListener('click', () => elements.dataDialog.close());
$('addGroupButton').addEventListener('click', () => { state.draft.push({ name: `第${state.draft.length+1}组`, values: { lift: null, short: null, medium: null, long: null } }); renderDataRows(); });
$('saveDataButton').addEventListener('click', saveData);
$('fullscreenButton').addEventListener('click', async () => {
  if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen();
});
document.addEventListener('fullscreenchange', () => { $('fullscreenButton').textContent = document.fullscreenElement ? '退出全屏' : '全屏展示'; });

renderUI(); init3D();
