# Three.js 本地 3D 基础测试页

这是技术验证工具，不是教学课件。它会使用项目现有素材检查：

- Three.js 场景、PerspectiveCamera 和 WebGLRenderer；
- OrbitControls 拖动旋转、滚轮缩放和视角重置；
- Poly Haven HDRI 环境光；
- Mountainside、Rock 04、Wooden Table 01 三个本地 glTF 模型；
- ambientCG Ground054 的 Color、NormalGL、Roughness、Displacement PBR 地面样本；
- 阴影、环境光、主光源、模型旋转、缩放和 resize 自适应；
- 首屏加载耗时、FPS、draw calls 和三角形数量。

## 运行

由于浏览器会限制 `file://` 页面加载 ES Module 和 glTF 资源，请从项目根目录启动本地静态服务器：

```powershell
python -m http.server 4173
```

然后打开：

`http://127.0.0.1:4173/tools/3d-test/`

页面不访问 CDN、在线字体或外部素材。浏览器控制台应无影响运行的错误；Three.js r186 中旧 `RGBELoader` 的弃用提示已通过工具默认使用 `HDRLoader` 避免。

## 操作

- 拖动画布：OrbitControls 旋转视角；
- 滚轮：缩放；
- 选择模型后拖动缩放条：调整该模型比例；
- `自动旋转`：旋转当前选中模型；
- `重置视角`：恢复相机位置和观察目标；
- `重置场景`：恢复模型缩放和旋转。

## 判断标准

模型状态显示三角形数量，加载日志显示耗时。若状态为 `OK`，且控制台无 404、贴图解析错误或 WebGL 错误，则表示本地资源链路通过基础验证。

## 2026-09-22 实测基线

- 浏览器：Chromium，WebGL2；
- 1366×768：约 160 FPS、10 draw calls、532,846 triangles；
- 1440×900：约 160 FPS、10 draw calls、532,846 triangles；
- 1920×1080：约 160 FPS、10 draw calls、532,846 triangles；
- 首次冷启动总加载：约 0.96 秒；重复加载约 0.38 秒；
- HDRI：约 263 ms；PBR 地面纹理：约 5 ms；
- Mountainside：约 355 ms、153,472 triangles；
- Rock 04：约 357 ms、107,390 triangles；
- Wooden Table 01：约 347 ms、952 triangles；
- 控制台：无 JavaScript 错误、无资源 404；Windows 图形驱动可能输出一次 shader 浮点精度提示，不影响渲染。
