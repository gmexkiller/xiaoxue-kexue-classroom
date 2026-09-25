# 小学科学交互教学平台

面向小学科学课堂的交互课件项目。教学流程以真实实验和学生思考为中心，数字场景用于呈现问题、观察结构与组织讨论。

## 课堂课件

- [斜面 · 胡拉拉搬家公司](lessons/斜面/output/斜面_胡拉拉课堂版.html)
- [风的成因](lessons/风的成因/output/风的成因_小胡老师课堂版.html)
- [微观之间](lessons/微观之间/output/微观之间_小胡老师课堂版.html)

项目主页：<https://gmexkiller.github.io/xiaoxue-kexue-classroom/>

## 本地开发

- `AGENTS.md`：课程开发与科学教学规范。
- `template/`：通用前端基础模板。
- `lessons/`：各课程源码与离线课堂成品。
- `assets/`、`vendor/`：本地 3D 资源与运行库。
- `reference-ui/`：课堂界面参考案例。

《斜面》课堂版可在 `lessons/斜面/` 目录使用 `npm install` 与 `npm run build` 构建；生成页面保存在对应 `output/` 目录，可离线打开。

## 发布范围

GitHub Pages 从仓库根目录发布静态文件。公共版本包含课程代码、课堂成品和已登记许可证的本地资源。原始教材、教案、工作日志、课程标准和实验室规程保留在本地，不随公开仓库发布。测试截图、浏览器缓存与 `node_modules` 也不纳入提交。
