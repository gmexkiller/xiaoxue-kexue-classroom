import * as THREE from 'three';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';

const PBR_COLOR_KEYS = new Set(['color', 'map', 'baseColor']);

function loadWith(loader, url) {
  return loader.loadAsync(url);
}

/**
 * Load a glTF/GLB asset. Draco is opt-in because decoder files add weight.
 */
export async function loadGLTF(url, options = {}) {
  const loader = new GLTFLoader(options.manager);
  let dracoLoader;

  if (options.dracoDecoderPath) {
    dracoLoader = new DRACOLoader(options.manager);
    dracoLoader.setDecoderPath(options.dracoDecoderPath);
    loader.setDRACOLoader(dracoLoader);
  }

  try {
    return await loadWith(loader, url);
  } finally {
    dracoLoader?.dispose();
  }
}

/**
 * Load an HDR environment and prefilter it for physically based materials.
 * The source HDR texture is disposed after PMREM conversion.
 */
export async function loadHDRI(url, renderer) {
  const loader = new HDRLoader();
  const source = await loadWith(loader, url);
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();
  const environment = pmremGenerator.fromEquirectangular(source).texture;
  source.dispose();
  pmremGenerator.dispose();
  return environment;
}

/**
 * Load only the maps supplied in a PBR texture set.
 * `color`, `normal`, `roughness`, `metalness`, `ao`, and `displacement` are supported.
 */
export async function loadTextureSet(textureUrls, options = {}) {
  const loader = new THREE.TextureLoader(options.manager);
  const entries = Object.entries(textureUrls).filter(([, url]) => typeof url === 'string' && url.length > 0);
  const loaded = await Promise.all(entries.map(async ([key, url]) => {
    const texture = await loadWith(loader, url);
    if (PBR_COLOR_KEYS.has(key)) {
      texture.colorSpace = THREE.SRGBColorSpace;
    }
    if (Array.isArray(options.repeat)) {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(options.repeat[0], options.repeat[1]);
    }
    texture.needsUpdate = true;
    return [key, texture];
  }));
  return Object.fromEntries(loaded);
}

/**
 * Create a small, reusable classroom-scene light rig.
 */
export function createBasicLights(options = {}) {
  const group = new THREE.Group();
  group.name = 'BasicLightRig';

  const hemisphere = new THREE.HemisphereLight(
    options.skyColor ?? 0x9bc8d8,
    options.groundColor ?? 0x182126,
    options.hemisphereIntensity ?? 1.15,
  );
  hemisphere.name = 'HemisphereLight';

  const key = new THREE.DirectionalLight(
    options.keyColor ?? 0xffe3b0,
    options.keyIntensity ?? 3.2,
  );
  key.name = 'KeyLight';
  key.position.copy(options.keyPosition ?? new THREE.Vector3(6, 10, 5));
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 0.1;
  key.shadow.camera.far = 40;
  key.shadow.camera.left = -15;
  key.shadow.camera.right = 15;
  key.shadow.camera.top = 15;
  key.shadow.camera.bottom = -15;
  key.shadow.bias = -0.0004;

  const fill = new THREE.DirectionalLight(
    options.fillColor ?? 0x83c7de,
    options.fillIntensity ?? 0.75,
  );
  fill.name = 'FillLight';
  fill.position.copy(options.fillPosition ?? new THREE.Vector3(-7, 5, -4));

  group.add(hemisphere, key, fill);
  return { group, hemisphere, key, fill };
}

export function resetCamera(camera, controls, preset = {}) {
  camera.position.copy(preset.position ?? new THREE.Vector3(10, 7, 12));
  camera.fov = preset.fov ?? 42;
  camera.updateProjectionMatrix();
  controls.target.copy(preset.target ?? new THREE.Vector3(0, 1.4, 0));
  controls.update();
}

function disposeMaterial(material) {
  const textureKeys = [
    'map',
    'normalMap',
    'roughnessMap',
    'metalnessMap',
    'aoMap',
    'displacementMap',
    'alphaMap',
    'emissiveMap',
    'clearcoatMap',
    'clearcoatNormalMap',
    'clearcoatRoughnessMap',
  ];
  for (const key of textureKeys) {
    material[key]?.dispose();
  }
  material.dispose();
}

export function disposeObject(object) {
  object.traverse((child) => {
    if (!child.isMesh) return;
    child.geometry?.dispose();
    if (Array.isArray(child.material)) {
      child.material.forEach(disposeMaterial);
    } else if (child.material) {
      disposeMaterial(child.material);
    }
  });
  object.parent?.remove(object);
}

export function getObjectDiagnostics(object) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  let meshes = 0;
  let triangles = 0;
  object.traverse((child) => {
    if (!child.isMesh) return;
    meshes += 1;
    const index = child.geometry.getIndex();
    triangles += index ? index.count / 3 : child.geometry.attributes.position.count / 3;
  });
  return { box, size, center, meshes, triangles };
}
