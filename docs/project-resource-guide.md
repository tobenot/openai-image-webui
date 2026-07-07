# OpenAI Image WebUI — 项目资源文档

> 本文档面向**无技术背景**的读者，用于快速了解项目定位、功能、架构与使用方式，也可作为项目 Review 的参考材料。
>
> 仓库地址：[https://github.com/tobenot/openai-image-webui](https://github.com/tobenot/openai-image-webui)

---

## 1. 项目是什么

**OpenAI Image WebUI** 是一个在浏览器中运行的 AI 图片工具网页。

用户自行提供 API Key 和 API 地址，网页直接调用兼容 OpenAI 格式的图像接口，完成：

- 文字生成图片（文生图）
- 上传参考图生成或编辑图片（图生图 / 图片编辑）
- 上传图片进行视觉理解或文字提取（OCR / 识图）
- 批量按 Prompt 列表生成多张图
- 批量为美术资源文件 AI 重命名

**项目不托管任何 API Key，也不经过自己的服务器转发请求。** 所有配置和请求都在用户浏览器本地完成。

### 1.1 一句话定位

纯前端 BYOK（Bring Your Own Key）AI 生图 WebUI，兼容 OpenAI Images API，可部署到 GitHub Pages。

### 1.2 适用人群

| 人群 | 用途 |
| --- | --- |
| 个人创作者 | 用自有 API Key 快速生图、改图 |
| 游戏 / 美术团队 | 批量生图、批量重命名素材 |
| 开发者 | 作为 OpenAI 兼容接口的前端参考实现 |
| 项目 Reviewer | 通过本文档了解全貌，无需读代码 |

### 1.3 项目不做什么

- 不提供账号登录
- 不代管 API Key
- 不设后端代理（不帮用户转发请求）
- 不在服务端保存历史记录
- 不绑定特定 API 服务商（OpenAI、中转站均可）

---

## 2. 核心概念（非技术版）

### 2.1 BYOK（自带密钥）

用户自己在设置面板填写 API Key。Key 只存在当前浏览器的 localStorage 中，不会上传到 GitHub 或项目作者的服务器。

### 2.2 OpenAI 兼容 API

OpenAI 定义了一套 HTTP 接口规范（如 `POST /v1/images/generations`）。许多服务商（官方 OpenAI、老张 API 等中转站）都实现了相同或相近的接口。本项目按这套规范发请求，因此可对接多种服务商，只需改 Base URL 和模型名。

### 2.3 纯前端

整个应用就是 HTML + JavaScript，在浏览器里运行。没有 Node.js 后端、没有数据库服务器。可静态部署到 GitHub Pages 或任意静态托管。

### 2.4 任务队列

每次生成会创建一个「任务」，显示 pending → running → success/error 状态。用户可设置并发数，同时跑多个任务。

### 2.5 CORS

浏览器安全策略要求：API 服务商必须允许来自网页域名的跨域请求。若 curl/Postman 能通但网页报 `Failed to fetch`，通常是服务商未配置 CORS，不是本项目 bug。

---

## 3. 功能总览

### 3.1 四大工作模式

界面左侧有四个模式 Tab：

| 模式 | 英文名 | 作用 |
| --- | --- | --- |
| 生成 | generate | 文生图；上传参考图后自动切换为图生图/编辑 |
| 视觉 | vision | 上传图片，调用视觉模型提取文字或描述内容 |
| 批量 | batch | 按 Prompt 列表批量生图，支持批次导出 ZIP |
| 重命名 | rename | 批量上传美术资源，AI 生成文件名，下载重命名脚本或 ZIP |

### 3.2 设置面板

| 字段 | 说明 |
| --- | --- |
| API Base URL | 接口根地址，如 `https://api.openai.com/v1` |
| API Key | 用户密钥 |
| Image model | 生图模型，如 `gpt-image-1` |
| Vision model | 识图模型，如 `gpt-4.1-mini` |
| Response Format | 返回 `url` 或 `b64_json` |
| Concurrency | 同时运行的任务数 |
| Provider Presets | 快捷填入 OpenAI / 老张等预设地址 |

支持 **Fetch models** 按钮，从 `GET /v1/models` 拉取模型列表并按类型筛选。

### 3.3 生成模式（Generate）

- Prompt 文本输入
- 生成数量（Count）
- 尺寸（Size），带快捷选项
- Advanced JSON：透传额外 API 参数（如 `quality`、`style`）
- 参考图上传（0 张 = 文生图，≥1 张 = 图生图，走 `/images/edits`）
- 可选 Mask（局部重绘，须与源图同尺寸）

### 3.4 视觉模式（Vision）

- 上传一张或多张图片
- 输入分析 Prompt（默认中文描述 + 文字提取）
- Detail 级别：auto / low / high
- 结果以文本形式展示，支持复制和下载

### 3.5 批量模式（Batch）

- Prompt 列表：一行一条，支持 `#` 注释和文件导入（.txt / .md / .csv）
- 共享参考图、尺寸、Advanced JSON
- 每条 Prompt 可设置重复次数
- 批次 ID 追踪，支持「只重跑失败项」和「打包 ZIP 导出」
- ZIP 内含图片、`prompts.txt`、`manifest.json`

### 3.6 重命名模式（Rename）

面向游戏美术资源批量命名：

- **简洁模式**：`rock_mossy_dark_260521_a4f2.png`
- **描述模式**：`rock_boulder_large_scattered_on_hillside_260525_a4f2.png`
- 原图不上传服务器，仅发压缩缩略图给 AI
- 输出：重命名脚本（含一键还原）或重命名后的 ZIP 包

### 3.7 右侧输出区

| Tab | 作用 |
| --- | --- |
| Tasks | 任务队列，每张卡片显示状态、结果、耗时、费用估算 |
| Library | 图片库，浏览 IndexedDB 缓存的生成结果 |

任务卡片操作：预览、下载、复制 URL、复制 Prompt、复用参数、重试、取消、删除。

### 3.8 其他能力

- 中英文界面切换（i18next）
- Token 用量与费用估算（pricing.ts）
- 图片 IndexedDB 本地缓存（约 200MB 警戒线）
- 任务元数据 localStorage 持久化（最多 500 条）
- 调试信息：请求/响应详情可在任务卡片查看

---

## 4. 调用的 API 端点

```
POST {baseUrl}/images/generations    文生图（JSON）
POST {baseUrl}/images/edits          图生图/编辑（multipart/form-data）
POST {baseUrl}/responses             视觉分析/OCR（JSON，多模态输入）
GET  {baseUrl}/models                拉取模型列表（可选）
```

请求头统一为 `Authorization: Bearer <API_KEY>`。

详细参数说明见 [`api-features.md`](./api-features.md)。

---

## 5. 技术架构

### 5.1 技术栈

| 层级 | 技术 | 用途 |
| --- | --- | --- |
| 框架 | React 18 + TypeScript | UI 组件与类型安全 |
| 构建 | Vite 6 | 开发与打包 |
| 样式 | Tailwind CSS 3 | 响应式界面 |
| 国际化 | i18next + react-i18next | 中英文 |
| 存储 | localStorage + IndexedDB | 配置、任务元数据、图片缓存 |
| 打包导出 | JSZip | 批量 ZIP 下载 |
| 部署 | gh-pages | GitHub Pages 静态托管 |

**未使用** OpenAI 官方 JavaScript SDK，而是用原生 `fetch` 直连 REST API，以减小体积并支持自定义 Base URL。

### 5.2 目录结构

```
openai-image-webui/
├── public/                 静态资源（favicon 等）
├── src/
│   ├── api/                API 调用层
│   │   ├── openaiImages.ts   生图 / 编辑
│   │   ├── openaiVision.ts   视觉分析
│   │   └── openaiModels.ts   模型列表
│   ├── components/         React 组件
│   │   ├── Header.tsx
│   │   ├── SettingsPanel.tsx
│   │   ├── GenerationPanel.tsx
│   │   ├── VisionPanel.tsx
│   │   ├── BatchGenerationPanel.tsx
│   │   ├── BatchRenamePanel.tsx
│   │   ├── TaskQueue.tsx / TaskCard.tsx
│   │   ├── ImageLibrary.tsx
│   │   └── ImagePreviewModal.tsx
│   ├── hooks/
│   │   ├── useSettings.ts      设置读写
│   │   ├── useImageTasks.ts    任务队列与并发调度
│   │   └── useLocalStorage.ts
│   ├── lib/                工具函数
│   │   ├── storage.ts          localStorage 读写
│   │   ├── imageCache.ts       IndexedDB 图片缓存
│   │   ├── imageInput.ts       上传校验与降采样
│   │   ├── pricing.ts          费用估算
│   │   ├── batchExport.ts      批次 ZIP 导出
│   │   ├── batchRename.ts      重命名逻辑
│   │   └── promptList.ts       Prompt 列表解析
│   ├── i18n/               国际化资源
│   ├── types/index.ts      TypeScript 类型定义
│   ├── App.tsx             主布局与模式切换
│   └── main.tsx            入口
├── docs/                   项目文档（本文档所在目录）
├── README.md               快速上手
├── package.json
├── vite.config.ts
└── LICENSE                 MIT
```

### 5.3 数据流（生图）

```
用户填写 Prompt + 设置
        ↓
App.tsx 校验 → parseAdvancedJson
        ↓
useImageTasks.addTasks() 创建 N 个 pending 任务
        ↓
调度器按 concurrency 并发执行
        ↓
有参考图? → editImage() : generateImage()
        ↓
API 返回 url 或 b64_json
        ↓
IndexedDB 缓存图片 + 更新任务状态
        ↓
TaskCard / ImageLibrary 展示结果
```

### 5.4 本地存储设计

| 存储 | Key / 位置 | 内容 |
| --- | --- | --- |
| localStorage | `openai-image-webui:settings` | API 配置 |
| localStorage | `openai-image-webui:tasks` | 任务元数据（最多 500 条） |
| localStorage | `openai-image-webui:batch-prompts` | 批量 Prompt 文本 |
| localStorage | `openai-image-webui:language` | 界面语言 |
| IndexedDB | image cache | 生成图片二进制（200MB 警戒线） |

**不持久化**：上传的参考图 File 对象（仅内存）、进行中的 running 任务（刷新后标记为 cancelled）。

### 5.5 并发调度

`useImageTasks` 维护任务列表和 AbortController。调度逻辑：

1. 统计 running 数量
2. 若 running < concurrency，取 pending 任务启动
3. 完成后继续调度，直到队列清空

每个任务独立发 `n: 1` 请求（非服务端批量），便于单张重试和进度展示。

---

## 6. 界面布局

### 6.1 桌面端

```
┌──────────────────────────────────────────────────────────┐
│ Header（标题 / GitHub / 清空任务 / 语言切换）              │
├─────────────────┬────────────────────────────────────────┤
│ 左侧（固定）     │ 右侧（输出区）                          │
│                 │                                        │
│ API 设置        │ [Tasks] [Library]                       │
│ 模式 Tab        │                                        │
│ ├ 生成          │ 任务卡片列表 / 图片库网格                │
│ ├ 视觉          │                                        │
│ ├ 批量          │                                        │
│ └ 重命名        │                                        │
│                 │                                        │
│ 当前模式表单     │                                        │
│ CORS 提示       │                                        │
└─────────────────┴────────────────────────────────────────┘
```

### 6.2 移动端

左右栏变为上下堆叠：设置 → 模式表单 → 输出区。

---

## 7. 安全与隐私

| 项目 | 说明 |
| --- | --- |
| API Key | 仅存浏览器 localStorage，不经项目服务器 |
| 请求路径 | 浏览器直连用户配置的 API 地址 |
| 参考图 | 编辑/识图时随请求发给 API 服务商，不经过第三方 |
| 重命名模式 | 仅发压缩缩略图，原图保留本地 |
| 环境变量 | 不要把 Key 写入 `.env`（Vite 会打包进前端） |
| 公共设备 | 不建议在公共电脑上使用 |

---

## 8. 部署与运行

### 8.1 本地开发

```bash
git clone https://github.com/tobenot/openai-image-webui.git
cd openai-image-webui
npm install
npm run dev
```

### 8.2 构建

```bash
npm run build    # 输出到 dist/
npm run preview  # 本地预览构建结果
```

### 8.3 部署到 GitHub Pages

```bash
npm run deploy   # 等价于 build + gh-pages -d dist
```

`vite.config.ts` 中 `base: "/"` 表示部署在域名根路径。若部署到子路径需相应调整。

### 8.4 环境变量（可选）

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `VITE_DEFAULT_MODEL` | `gpt-image-1` | 默认生图模型 |
| `VITE_DEFAULT_VISION_MODEL` | `gpt-4.1-mini` | 默认视觉模型 |

**不要**在环境变量中放 API Key。

---

## 9. 服务商预设

| 预设 | Base URL | 默认生图模型 | 默认视觉模型 |
| --- | --- | --- | --- |
| OpenAI | `https://api.openai.com/v1` | `gpt-image-1` | `gpt-4.1-mini` |
| LaoZhang API | `https://api.laozhang.ai/v1` | `gpt-image-1` | `gpt-4.1-mini` |
| LaoZhang VIP | `https://api-vip.laozhang.ai/v1` | `gpt-image-1` | `gpt-4.1-mini` |

预设只填地址和默认模型，用户仍需自备 API Key。

---

## 10. 已知限制

| 限制 | 说明 |
| --- | --- |
| CORS | API 服务商须允许浏览器跨域，否则无法使用 |
| 刷新中断 | 进行中的任务刷新后变为 cancelled |
| 参考图不持久化 | 编辑/OCR 的 File 对象刷新后丢失，需重新上传 |
| 无断点续跑 | 批量任务关闭浏览器后不会自动恢复 |
| 无全局暂停 | 只能取消单个任务 |
| 无 variations 端点 | `/images/variations` 未实现 |
| 429 无退避 | 遇到限速直接报错，无自动重试 |
| 任务渲染上限 | TaskQueue 最多渲染 200 条（元数据可存 500 条） |

---

## 11. 文档索引

本仓库 `docs/` 目录下的专项文档：

| 文档 | 内容 |
| --- | --- |
| [project-resource-guide.md](./project-resource-guide.md) | **本文档**，项目全貌与 Review 参考 |
| [openai-image-webui-main-design.md](./openai-image-webui-main-design.md) | 初版设计方案（部分功能已扩展） |
| [api-features.md](./api-features.md) | API 参数与 Advanced JSON 参考 |
| [image-input-research.md](./image-input-research.md) | 图片输入能力调研记录 |
| [batch-generate.md](./batch-generate.md) | 批量生图功能设计 |
| [batch-image-rename.md](./batch-image-rename.md) | 批量重命名功能设计 |

根目录 [README.md](../README.md) 提供快速上手与安全说明。

---

## 12. 项目演进时间线

| 阶段 | 内容 |
| --- | --- |
| v0.1 基础 | 文生图、任务队列、并发、localStorage 配置 |
| 图片输入 | 参考图编辑、Mask、multipart 请求 |
| 视觉/OCR | Vision 面板，`/responses` 端点 |
| 模型列表 | Fetch models + 类型筛选 |
| 费用估算 | Token 用量与 per-image 费用展示 |
| 批量重命名 | AI 命名 + 脚本/ZIP 双通道输出 |
| 批量生图 | Prompt 列表驱动 + 批次 ZIP 导出 |
| 图片库 | IndexedDB 缓存、批量下载 |
| 国际化 | 中英文界面 |

---

## 13. Review 检查清单

供项目 Review 时逐项核对：

### 13.1 功能完整性

- [ ] 文生图：填写 Key / URL / Model / Prompt 后可生成图片
- [ ] 图生图：上传参考图后走 edits 端点
- [ ] 视觉分析：上传图片后可提取文字或描述
- [ ] 批量生图：多行 Prompt 可批量提交并导出 ZIP
- [ ] 批量重命名：可下载脚本或 ZIP，脚本含还原功能
- [ ] 任务管理：预览、下载、复制、重试、取消、删除均可用
- [ ] 设置持久化：刷新页面后 API 配置仍在

### 13.2 安全与合规

- [ ] API Key 不出现在代码仓库中
- [ ] 无后端代理，请求直连用户配置的端点
- [ ] README 和界面有 Key 安全提示
- [ ] MIT 许可证存在

### 13.3 用户体验

- [ ] 桌面与移动端布局可用
- [ ] 中英文切换正常
- [ ] 错误信息可读（含 CORS 提示）
- [ ] 空状态有引导文案

### 13.4 技术质量

- [ ] `npm run build` 无报错
- [ ] TypeScript 类型覆盖主要数据结构
- [ ] 无多余后端依赖
- [ ] 图片缓存有容量警告

### 13.5 文档

- [ ] README 覆盖安装、使用、安全、CORS
- [ ] docs/ 有设计文档与 API 参考
- [ ] 本文档可供非技术人员理解项目

---

## 14. 常见问题

**Q: 为什么不用 OpenAI 官方 SDK？**

SDK 在浏览器使用需 `dangerouslyAllowBrowser: true`，且不利于自定义 Base URL。本项目用 `fetch` 直连 REST，体积更小。

**Q: 我的 Key 会被上传到 GitHub 吗？**

不会。Key 只存在你浏览器的 localStorage。

**Q: curl 能通，网页报 Failed to fetch？**

通常是 API 服务商未配置 CORS。联系服务商或使用支持浏览器跨域的中转站。

**Q: 刷新后任务没了？**

任务元数据会保留，但 running 状态会变为 cancelled。参考图 File 对象不持久化。

**Q: 支持哪些图片格式？**

上传：PNG / JPEG / WebP。dall-e-2 仅 PNG 且须正方形。大于 8MB 或长边超 2048px 会自动降采样。

**Q: 费用怎么算？**

任务卡片展示估算费用，基于 `pricing.ts` 中的 OpenAI 官方定价表。中转站实际计费可能不同。

---

## 15. 许可证

MIT License。可自由使用、修改和分发，需保留版权声明。

---

*文档版本：2026-07-07 · 对应仓库 main 分支*
