# 本地 Three.js 3D 开发指南

本文件是后续小学科学 3D 课件开发前的基础设施说明。课程仍必须先依据教材、教案和实验目标确定科学模型，再调用本地资源；本文件不替代课程教学确认。

## 固定版本

- Three.js：`0.186.0`（r186）
- 核心文件：`vendor/three/three.module.js`
- 扩展模块：`vendor/three/addons/`
- 许可证：MIT，见 `vendor/three/LICENSE.txt`
- 版本记录：`vendor/three/VERSION.md`

当前锁定 r186 是为了让课程之间共享同一套 API。升级 Three.js 时，应整体替换核心文件和 addons，并重新运行 `tools/3d-test/`，不要只替换其中一个模块。

## 本地目录

```text
vendor/three/
├── three.module.js
├── addons/
│   ├── controls/OrbitControls.js
│   ├── loaders/GLTFLoader.js
│   ├── loaders/HDRLoader.js
│   ├── loaders/RGBELoader.js
│   ├── loaders/DRACOLoader.js
│   ├── postprocessing/
│   └── shaders/
├── LICENSE.txt
└── VERSION.md

js/three-utils/index.js
assets/
├── models/
├── textures/
└── hdri/
```

## 页面导入方式

离线 HTML 使用 import map 把裸模块名映射到本地文件：

```html
<script type="importmap">
{
  "imports": {
    "three": "../../vendor/three/three.module.js",
    "three/addons/": "../../vendor/three/addons/"
  }
}
</script>
<script type="module" src="./main.js"></script>
```

课程文件所在目录不同，需按文件相对位置调整 `../../` 层级。运行时不能写入 CDN URL、在线字体 URL 或外部素材 URL。

## 公共工具

`js/three-utils/index.js` 只封装稳定、重复度高的基础能力：

```js
import {
  createBasicLights,
  loadGLTF,
  loadHDRI,
  loadTextureSet,
  resetCamera,
  disposeObject,
} from '../../js/three-utils/index.js';
```

- `loadGLTF(url, options)`：加载 glTF/GLB。`options.dracoDecoderPath` 只有在模型使用 Draco 时才传入；当前素材不需要。
- `loadHDRI(url, renderer)`：加载本地 HDR，并通过 PMREM 生成适合 PBR 环境反射的环境贴图。
- `loadTextureSet(urls, options)`：按需加载 `color`、`normal`、`roughness`、`metalness`、`ao`、`displacement` 地图；颜色图自动使用 sRGB 色彩空间。
- `createBasicLights(options)`：返回半球光、主方向光和辅助方向光，并默认配置阴影。
- `resetCamera(camera, controls, preset)`：恢复相机和 OrbitControls 目标。
- `disposeObject(object)`：切换或销毁场景时释放几何体、材质和纹理。

科学课程的特殊动画、粒子、流体、空气轨迹和教学状态不要塞进这个公共工具，避免基础设施被具体课程绑死。

## 模型加载

```js
const gltf = await loadGLTF('./assets/models/mountainside/mountainside_1k.gltf');
scene.add(gltf.scene);
```

模型目录内的 `.gltf`、`.bin` 和纹理相对路径必须保持不变。加载后应统一检查：

- `Box3` 包围盒尺寸和中心点；
- 真实场景中的比例；
- `castShadow` / `receiveShadow`；
- 材质是否有缺图或法线方向错误；
- 三角形数量和 draw calls。

优先使用 glTF/GLB。当前 Poly Haven 模型为 glTF 多文件结构，后续如要合并成 GLB，必须重新验证材质、法线、动画和许可证记录。

## HDRI 加载

```js
const environment = await loadHDRI(
  './assets/hdri/polyhaven_studio_small_03_1k.hdr',
  renderer,
);
scene.environment = environment;
```

HDRI 主要用于环境反射和柔和环境光，不应完全取代课程需要的方向性主光源。大多数课堂场景仍应保留方向光和阴影。

Three.js r186 中 `RGBELoader` 已是兼容别名，公共工具使用 `HDRLoader`，避免弃用提示。`RGBELoader.js` 仍保留在 vendor 中供旧代码兼容。

## PBR 纹理

```js
const maps = await loadTextureSet({
  color: './assets/textures/ambientcg/soil-ground/Ground054_1K-JPG_Color.jpg',
  normal: './assets/textures/ambientcg/soil-ground/Ground054_1K-JPG_NormalGL.jpg',
  roughness: './assets/textures/ambientcg/soil-ground/Ground054_1K-JPG_Roughness.jpg',
});

const material = new THREE.MeshStandardMaterial({
  map: maps.color,
  normalMap: maps.normal,
  roughnessMap: maps.roughness,
  roughness: 0.85,
});
```

ambientCG 同时提供 `NormalDX` 和 `NormalGL` 时，Three.js 默认优先使用 `NormalGL`。颜色图使用 sRGB；法线、粗糙度、金属度、位移图保持数据纹理处理。

## 推荐课程目录

```text
lessons/<课程名>/
├── source/
├── output/
└── runtime/              # 课程特殊 JavaScript，可选

vendor/three/              # 项目统一运行库
js/three-utils/            # 项目统一基础加载工具
assets/                    # 项目共享素材
```

普通课程仍可保持单文件 HTML；只有需要真实 WebGL 3D 的课程，才引用本地 `vendor/three/`、`js/three-utils/` 和 `assets/`。不要复制一份 Three.js 到每个课程目录。

## 离线运行

浏览器通常不允许 `file://` 页面正常加载 ES Module、glTF、HDR 和纹理。课堂部署前应将项目放在本地静态服务器或学校内网静态服务器上运行，例如：

```powershell
python -m http.server 4173
```

HTML、JavaScript、Three.js、模型、纹理和 HDRI 全部从本地相对路径加载。运行时不需要互联网。

## 性能基线

- 优先 1K～2K 纹理；课堂远景通常 1K 已足够；
- HDRI 优先 1K～2K，避免把 8K HDRI 作为默认课堂资源；
- 控制场景总三角形、材质数量和实时阴影数量；
- 只给真正需要的对象开启投射阴影；
- 先观察 FPS、draw calls、三角形数量和加载耗时，再决定是否优化；
- 不要为了追求压缩而改变科学观察对象的形状或纹理可读性。

如果性能不足，按以下顺序考虑：减少场景对象 → 降低纹理分辨率 → 合并材质 → glTF 压缩 → Draco/Meshopt → 纹理压缩。优化后必须重新检查模型中心、法线、材质和课堂可见性。

### 当前实测结果（2026-09-22）

`tools/3d-test/` 在本机 Chromium/WebGL2 中同时加载 Mountainside、Rock 04、Wooden Table 01、1 个 HDRI 和 1 套 PBR 地面：

- 1366×768、1440×900、1920×1080 均约 160 FPS；
- 10 draw calls，约 532,846 triangles；
- 冷启动总加载约 0.96 秒，重复加载约 0.38 秒；
- HDRI 约 263 ms，PBR 纹理约 5 ms；
- Mountainside 约 153,472 triangles、7.04 MiB；
- 当前模型和纹理未出现丢失、法线错误或比例异常。

这组数据证明当前资产组合适合单个自然环境场景的实时课堂验证，但不等于所有学校电脑都能达到同样 FPS。若课程再叠加大量粒子、透明材质、后处理或多个山地模型，应先在目标教室电脑上复测。

### Mountainside 长期使用判断

结论：适合作为长期山地基础模型，但应按“单个主地形模型”使用。

理由：当前 1K 版本体积约 7.04 MiB，约 153k 三角形，纹理完整，山体体积和地形细节足够支撑远景、山谷和自然环境观察；在测试页与其他两个模型同场时仍保持流畅。限制是它不是低模模型，若同场复制多个、再叠加高密度空气粒子或后处理，建议先做 glTF 压缩、LOD 或减少副本，不建议现在直接改写原素材。

## 常见错误

| 现象 | 常见原因 | 检查方式 |
|---|---|---|
| 页面空白 | 直接双击 HTML | 使用本地静态服务器打开 |
| `Failed to resolve module specifier "three"` | 没有 import map 或路径层级错误 | 检查 `three` 和 `three/addons/` 映射 |
| 模型 404 | glTF 的 `.bin` 或纹理没有跟随目录 | 保持模型目录原始相对结构 |
| 模型发黑或反光异常 | 法线图错误、环境图未 PMREM 或色彩空间错误 | 使用 `NormalGL`、`loadHDRI()` 和 sRGB Color map |
| 贴图颜色不对 | 数据图错误地使用 sRGB | 只有 Color/BaseColor 使用 sRGB |
| FPS 下降 | 阴影、纹理、三角形或 draw calls 过多 | 查看测试页性能面板后再优化 |
| Draco 加载失败 | 缺少本地 decoder 或版本不匹配 | 暂时关闭 Draco，或补齐匹配 decoder 文件 |
