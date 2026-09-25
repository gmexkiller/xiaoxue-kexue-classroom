# 后续素材下载计划

本文件只记录本轮没有下载、但后续可能有价值的候选，不代表这些资源已经存在于项目中。

## 暂未下载

| 目标 | 推荐资源 | 下载页 | 推荐格式 / 分辨率 | 目标目录 | 暂未下载原因 |
|---|---|---|---|---|---|
| 树木 | Poly Haven `Tree Small 02` | https://polyhaven.com/a/tree_small_02 | glTF，优先 1K | `assets/models/tree_small_02/` | 1K 版本的几何二进制约 95 MB，单个树木对课堂网页过重；优先程序化低模树或后续按课程需要手动加入 |
| 低模自然组件 | Kenney Nature Kit | https://kenney.nl/assets/nature-kit | glTF/OBJ 或资源包内的轻量模型 | `assets/models/kenney-nature/` | 本轮已有山地、岩石和实验桌，继续下载会扩大基础包；该页面明确为 CC0，后续可按需选择单个组件 |
| 通用课堂图标 | Kenney Game Icons 或 UI Pack | https://kenney.nl/assets/game-icons；https://kenney.nl/assets/ui-pack | SVG/PNG，优先单色小图标 | `assets/icons/` | 当前界面图标可用内联 SVG/CSS，暂不引入游戏化图标风格；如需外部图标，先从页面挑选并单独登记 |
| 实验器材 | 轻量 CC0 模型或课程内程序化建模 | 先从 Poly Haven / Kenney 官方页面筛选 | glTF/GLB，1K，低至中等面数 | `assets/models/lab-equipment/` | 本轮未确认到同时满足“器材语义清晰、轻量、授权可再分发”的单个模型；后续按具体实验需要选择，避免素材先行替代教学设计 |
| 真正的玻璃与液态水 | ambientCG 相关材质或课程内材质参数 | https://ambientcg.com/ | PBR 1K JPG；透明/折射由 Three.js 材质实现 | `assets/textures/` | 本轮加入了玻璃反射和冰/水相关参考材质，但没有把它们冒充为完整透明玻璃或动态海洋材质；后续按课程现象验证 |

## 使用前检查

新增资源前必须确认：来源页面、作者、许可证、是否允许再分发、下载日期、目标分辨率、预计文件大小，以及是否真的服务某个科学观察任务。确认后更新 `assets/licenses/ASSET_LICENSES.md`。

## 离线运行要求

资源下载完成后复制到项目本地目录，课程只使用相对路径。Three.js、`GLTFLoader`、HDR 加载器等运行依赖也应在课程需要时以固定版本放入本地 `vendor/` 或课程 `js/`，不能让课堂运行依赖 CDN、在线字体、在线贴图或运行时 `fetch()` 外部 URL。
