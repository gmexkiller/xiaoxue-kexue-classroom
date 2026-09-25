# Three.js 本地运行库

- 版本：`0.186.0`（r186）
- 来源：[npm three@0.186.0](https://www.npmjs.com/package/three/v/0.186.0)
- 上游仓库：[mrdoob/three.js](https://github.com/mrdoob/three.js)
- License：MIT，许可证原文见同目录 `LICENSE.txt`
- 固定日期：2026-09-22

## 已配置模块

- `three.module.js`
- `addons/controls/OrbitControls.js`
- `addons/loaders/GLTFLoader.js`
- `addons/loaders/HDRLoader.js`
- `addons/loaders/RGBELoader.js`
- `addons/loaders/DRACOLoader.js`
- `addons/postprocessing/EffectComposer.js`
- `addons/postprocessing/Pass.js`
- `addons/postprocessing/RenderPass.js`
- `addons/postprocessing/OutputPass.js`
- `addons/postprocessing/ShaderPass.js`
- `addons/postprocessing/UnrealBloomPass.js`
- `addons/shaders/CopyShader.js`
- `addons/shaders/LuminosityHighPassShader.js`

Three.js r186 中 `RGBELoader` 已经是指向 `HDRLoader` 的兼容别名，并会输出弃用提示。公共工具默认使用 `HDRLoader`，同时保留 `RGBELoader.js` 供旧代码兼容。

DRACO 解码器二进制没有默认加入，因为当前项目模型未使用 Draco 压缩。只有课程确实使用 Draco 模型时，才把匹配版本的 decoder 文件放入本地目录并在课程中配置 `DRACOLoader`。
