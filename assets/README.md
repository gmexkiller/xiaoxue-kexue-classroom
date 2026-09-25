# 3D 素材基础环境

本目录用于存放可离线使用的小学科学 3D 课件素材。当前素材包优先控制在 1K 纹理和轻量 glTF 范围内，避免影响学校电脑上的课堂流畅度。

## 目录约定

- `models/`：本地 glTF 模型及其 `.bin`、纹理文件。每个模型独立一个目录，保持 glTF 的相对路径不变。
- `textures/`：可平铺的 PBR 纹理。ambientCG 素材保留 `Color`、`NormalGL`、`Roughness` 等原始地图名。
- `hdri/`：HDRI 环境光，当前使用 1K `.hdr`，适合作为 Three.js 的环境光或反射环境。
- `icons/`：预留给 CC0 图标；当前没有额外下载图标包，避免把游戏化图标混入科学课堂界面。
- `licenses/`：来源、作者、许可证和用途登记。所有外部素材都必须先登记再进入课程。

## Three.js 使用约定

课程运行时只能引用项目内的相对路径，例如：

```js
const hdrPath = './assets/hdri/polyhaven_studio_small_03_1k.hdr';
const modelPath = './assets/models/mountainside/mountainside_1k.gltf';
const soilColor = './assets/textures/ambientcg/soil-ground/Ground054_1K-JPG_Color.jpg';
```

使用 `GLTFLoader` 时不要改动模型目录内部的相对文件结构。ambientCG 的法线贴图优先使用 `NormalGL`；`NormalDX` 仅在运行时明确需要 DirectX 法线约定时使用。玻璃和水目前只是材质参考素材，透明、折射和水面运动应由课程代码按教学目标实现，不应把纹理本身误认为真实物理模拟。

Three.js、`GLTFLoader`、HDR 加载器等运行依赖不在本次素材包中。未来课程需要时，应将固定版本的运行库放入项目内的本地 `vendor/` 或课程自己的 `js/` 目录，不能在课堂运行时从 CDN 加载。

详细来源和许可证见 [`licenses/ASSET_LICENSES.md`](licenses/ASSET_LICENSES.md)。未下载的候选资源和原因见 [`ASSET_DOWNLOAD_PLAN.md`](ASSET_DOWNLOAD_PLAN.md)。
