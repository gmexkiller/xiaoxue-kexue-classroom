import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  createBasicLights,
  disposeObject,
  getObjectDiagnostics,
  loadGLTF,
  loadHDRI,
  loadTextureSet,
  resetCamera,
} from '../../js/three-utils/index.js';

const ASSET_ROOT = '../../assets/';
const canvas = document.querySelector('#viewport');
const topStatus = document.querySelector('#top-status');
const eventLog = document.querySelector('#event-log');
const modelSelect = document.querySelector('#model-select');
const scaleRange = document.querySelector('#scale-range');
const scaleValue = document.querySelector('#scale-value');
const autoRotateButton = document.querySelector('#auto-rotate');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x080d11);

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 3;
controls.maxDistance = 42;
controls.maxPolarAngle = Math.PI * 0.48;

resetCamera(camera, controls);

const lights = createBasicLights();
scene.add(lights.group);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(42, 42),
  new THREE.MeshStandardMaterial({ color: 0x1a282e, roughness: 0.92, metalness: 0.04 }),
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
floor.name = 'ClassroomFloor';
scene.add(floor);

const grid = new THREE.GridHelper(42, 42, 0x2a4a52, 0x172930);
grid.position.y = 0.006;
grid.material.transparent = true;
grid.material.opacity = 0.34;
scene.add(grid);

const modelDefinitions = {
  mountainside: {
    label: 'Mountainside',
    url: `${ASSET_ROOT}models/mountainside/mountainside_1k.gltf`,
    position: new THREE.Vector3(0, 0, -1.1),
    targetHeight: 5.2,
  },
  rock_04: {
    label: 'Rock 04',
    url: `${ASSET_ROOT}models/rock_04/rock_04_1k.gltf`,
    position: new THREE.Vector3(3.4, 0, 1.4),
    targetHeight: 1.8,
  },
  WoodenTable_01: {
    label: 'Wooden Table 01',
    url: `${ASSET_ROOT}models/WoodenTable_01/WoodenTable_01_1k.gltf`,
    position: new THREE.Vector3(-3.3, 0, 1.7),
    targetHeight: 2.1,
  },
};

const loadedModels = new Map();
let selectedModel = 'mountainside';
let autoRotate = false;
let startTime = performance.now();
let completedLoads = 0;
let frames = 0;
let fpsWindowStart = performance.now();

const state = {
  webgl2: renderer.capabilities.isWebGL2,
  hdri: false,
  pbr: false,
  models: {},
  timings: {},
  errors: [],
};
window.__threeTestState = state;

function log(message, tone = '') {
  const line = document.createElement('div');
  line.textContent = `[${new Date().toLocaleTimeString('zh-CN', { hour12: false })}] ${message}`;
  if (tone) line.className = tone;
  eventLog.append(line);
  eventLog.scrollTop = eventLog.scrollHeight;
}

function setMetric(id, value, tone = '') {
  const node = document.querySelector(`#${id}`);
  node.textContent = value;
  node.className = tone;
}

function setTopStatus(value, tone = '') {
  topStatus.textContent = value;
  topStatus.className = `top-status ${tone}`;
}

function prepareModel(root, definition) {
  const wrapper = new THREE.Group();
  wrapper.name = definition.label;
  wrapper.add(root);

  const diagnostics = getObjectDiagnostics(wrapper);
  const uniformScale = definition.targetHeight / Math.max(diagnostics.size.y, 0.001);
  wrapper.scale.setScalar(uniformScale);
  wrapper.position.copy(definition.position);
  wrapper.userData.baseScale = uniformScale;
  wrapper.userData.userScale = 1;
  wrapper.userData.baseRotation = 0;
  wrapper.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;
    if (Array.isArray(child.material)) {
      child.material.forEach((material) => { material.envMapIntensity = 0.85; });
    } else if (child.material) {
      child.material.envMapIntensity = 0.85;
    }
  });
  alignModelToFloor(wrapper);
  return { wrapper, sourceDiagnostics: diagnostics };
}

function alignModelToFloor(wrapper) {
  const box = new THREE.Box3().setFromObject(wrapper);
  wrapper.position.y -= box.min.y;
}

function updateSelectedScale() {
  const entry = loadedModels.get(selectedModel);
  if (!entry) return;
  const multiplier = Number(scaleRange.value);
  entry.wrapper.scale.setScalar(entry.wrapper.userData.baseScale * multiplier);
  entry.wrapper.userData.userScale = multiplier;
  alignModelToFloor(entry.wrapper);
  scaleValue.textContent = `${multiplier.toFixed(2)}×`;
}

function resetScene() {
  loadedModels.forEach((entry) => {
    entry.wrapper.scale.setScalar(entry.wrapper.userData.baseScale);
    entry.wrapper.userData.userScale = 1;
    entry.wrapper.rotation.y = entry.wrapper.userData.baseRotation;
    alignModelToFloor(entry.wrapper);
  });
  scaleRange.value = '1';
  updateSelectedScale();
  log('Scene transforms reset');
}

function updateDiagnostics() {
  const info = renderer.info;
  setMetric('fps', `${Math.round((frames * 1000) / Math.max(performance.now() - fpsWindowStart, 1))}`);
  setMetric('draw-calls', `${info.render.calls}`);
  setMetric('triangles', `${info.render.triangles.toLocaleString('en-US')}`);
}

async function loadEnvironment() {
  const started = performance.now();
  const hdriUrl = `${ASSET_ROOT}hdri/polyhaven_kloofendal_48d_partly_cloudy_puresky_1k.hdr`;
  try {
    const environment = await loadHDRI(hdriUrl, renderer);
    scene.environment = environment;
    state.hdri = true;
    state.timings.hdri = performance.now() - started;
    setMetric('hdri-status', `OK ${state.timings.hdri.toFixed(0)} ms`, 'good');
    log(`HDRI loaded in ${state.timings.hdri.toFixed(0)} ms`);
  } catch (error) {
    state.errors.push(`HDRI: ${error.message}`);
    setMetric('hdri-status', 'ERROR', 'bad');
    log(`HDRI failed: ${error.message}`, 'bad');
  }
}

async function loadPbrSample() {
  const started = performance.now();
  const base = `${ASSET_ROOT}textures/ambientcg/soil-ground/Ground054_1K-JPG_`;
  try {
    const maps = await loadTextureSet({
      color: `${base}Color.jpg`,
      normal: `${base}NormalGL.jpg`,
      roughness: `${base}Roughness.jpg`,
      displacement: `${base}Displacement.jpg`,
    }, { repeat: [3, 3] });
    const sample = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.16, 2.2, 32, 2, 32),
      new THREE.MeshStandardMaterial({
        map: maps.color,
        normalMap: maps.normal,
        roughnessMap: maps.roughness,
        displacementMap: maps.displacement,
        displacementScale: 0.035,
        roughness: 0.9,
        metalness: 0,
      }),
    );
    sample.position.set(3.5, 0.12, -1.9);
    sample.castShadow = true;
    sample.receiveShadow = true;
    sample.name = 'PBRGroundSample';
    scene.add(sample);
    state.pbr = true;
    state.timings.pbr = performance.now() - started;
    setMetric('pbr-status', `OK ${state.timings.pbr.toFixed(0)} ms`, 'good');
    setMetric('diag-pbr', 'Ground054 OK', 'good');
    log(`PBR maps loaded in ${state.timings.pbr.toFixed(0)} ms`);
  } catch (error) {
    state.errors.push(`PBR: ${error.message}`);
    setMetric('pbr-status', 'ERROR', 'bad');
    setMetric('diag-pbr', 'ERROR', 'bad');
    log(`PBR failed: ${error.message}`, 'bad');
  }
}

async function loadModel(id) {
  const definition = modelDefinitions[id];
  const started = performance.now();
  try {
    const gltf = await loadGLTF(definition.url);
    const prepared = prepareModel(gltf.scene, definition);
    scene.add(prepared.wrapper);
    const diagnostics = getObjectDiagnostics(prepared.wrapper);
    const entry = {
      ...prepared,
      diagnostics,
      loadMs: performance.now() - started,
    };
    loadedModels.set(id, entry);
    state.models[id] = {
      loadMs: entry.loadMs,
      meshes: diagnostics.meshes,
      triangles: Math.round(diagnostics.triangles),
      size: diagnostics.size.toArray().map((value) => Number(value.toFixed(3))),
      center: diagnostics.center.toArray().map((value) => Number(value.toFixed(3))),
    };
    setMetric(`diag-${id}`, `${Math.round(diagnostics.triangles).toLocaleString('en-US')} tris`, 'good');
    log(`${definition.label} loaded in ${entry.loadMs.toFixed(0)} ms · ${Math.round(diagnostics.triangles).toLocaleString('en-US')} triangles`);
  } catch (error) {
    state.errors.push(`${id}: ${error.message}`);
    setMetric(`diag-${id}`, 'ERROR', 'bad');
    log(`${definition.label} failed: ${error.message}`, 'bad');
  } finally {
    completedLoads += 1;
  }
}

function setupInteractions() {
  modelSelect.addEventListener('change', () => {
    selectedModel = modelSelect.value;
    const entry = loadedModels.get(selectedModel);
    scaleRange.value = `${entry?.wrapper.userData.userScale ?? 1}`;
    updateSelectedScale();
  });
  scaleRange.addEventListener('input', updateSelectedScale);
  document.querySelector('#reset-view').addEventListener('click', () => {
    resetCamera(camera, controls);
    log('Camera reset');
  });
  document.querySelector('#reset-scene').addEventListener('click', resetScene);
  autoRotateButton.addEventListener('click', () => {
    autoRotate = !autoRotate;
    autoRotateButton.setAttribute('aria-pressed', `${autoRotate}`);
    log(`Auto rotation ${autoRotate ? 'enabled' : 'disabled'}`);
  });
}

function resize() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (!width || !height) return;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

function render(now) {
  requestAnimationFrame(render);
  if (autoRotate) {
    const selected = loadedModels.get(selectedModel);
    if (selected) selected.wrapper.rotation.y += 0.0025;
  }
  controls.update();
  renderer.render(scene, camera);
  frames += 1;
  if (now - fpsWindowStart > 1000) {
    updateDiagnostics();
    frames = 0;
    fpsWindowStart = now;
  }
}

async function boot() {
  setupInteractions();
  resize();
  window.addEventListener('resize', resize);
  setMetric('webgl-status', renderer.capabilities.isWebGL2 ? 'WebGL2 OK' : 'WebGL OK', 'good');
  log(`Renderer ready · ${renderer.capabilities.isWebGL2 ? 'WebGL2' : 'WebGL'}`);
  render(performance.now());

  await Promise.all([loadEnvironment(), loadPbrSample(), ...Object.keys(modelDefinitions).map(loadModel)]);
  const total = performance.now() - startTime;
  state.totalLoadMs = total;
  setMetric('load-total', `${total.toFixed(0)} ms`);
  setTopStatus(state.errors.length ? 'CHECK ERRORS' : 'READY / OFFLINE', state.errors.length ? 'bad' : 'good');
  log(state.errors.length ? `Completed with ${state.errors.length} error(s)` : `All checks completed in ${total.toFixed(0)} ms`);
  window.__threeTestState = state;
}

boot().catch((error) => {
  state.errors.push(`boot: ${error.message}`);
  setTopStatus('BOOT ERROR', 'bad');
  log(`Boot failed: ${error.message}`, 'bad');
});
