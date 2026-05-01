# 图片作为输入 —— 标准方案调研（中间文档）

> 目标：在当前这个“纯前端、BYOK、直连 OpenAI 兼容 `/v1` 端点”的项目里，把**图片当作输入**接进来。
> 本文只做方案收敛，不做最终实现。实现阶段按本文 §6 的“推荐路线”推进即可。

当前项目状态（事实）：
- 入口只有一条：`POST {baseUrl}/images/generations`，`Content-Type: application/json`，body 里 `model / prompt / n / size / response_format / ...extraParams`。见 `src/api/openaiImages.ts`。
- UI 只有 Prompt + Size + Count + Advanced JSON + Response format。见 `src/components/GenerationPanel.tsx`、`src/types/index.ts` 的 `GenerateFormState`。
- `docs/api-features.md` 已经明确写了：`/v1/images/edits` 和 `/v1/images/variations` **当前不调**，原因就是"需要 multipart/form-data 上传器"。
- 没有任何 File/Blob/FormData 代码路径；`imageCache.ts / download.ts` 只做结果侧的缓存与下载。

所以本次要加的是**一条新的请求路径 + 一个上传 UI**，不是小参数调整。

---

## 1. "图片作为输入" 在 OpenAI 生态里其实是三件不同的事

用户说"把图片当输入"通常混着讲，但在 OpenAI API 语义里是三种独立能力，端点、请求格式、产出都不一样。必须先分清楚，才能决定我们要做哪一种。

### 1.1 图片编辑 / 参考图生图（Image Edits）—— **本项目的目标**
- 端点：`POST /v1/images/edits`
- Content-Type：`multipart/form-data`（**不是 JSON**）
- 主要字段：
  - `image`：一张或多张源图（file part）。`dall-e-2` 要求 PNG、<4MB、方图；`gpt-image-1` / `gpt-image-2` 放宽了格式与数量（支持多图参考）。
  - `prompt`：文本指令，必填。
  - `mask`（可选）：同尺寸 PNG，透明区域 = 可编辑区域（inpainting）。不传 mask 时，`dall-e-2` 走"image 自身的透明通道"；`gpt-image-1/2` 可以无 mask 直接做整图改写 / 多图融合 / 参考风格。
  - `model`、`n`、`size`、`response_format`、`quality`、`background`、`output_format`、`output_compression`、`user` 等与 generations 基本对齐。
- 响应结构：`{ data: [{ url } | { b64_json }] }`，**和 generations 完全一致**。
- 产出：**图片**。这是本项目最贴合的语义。

### 1.2 图片变体（Image Variations）
- 端点：`POST /v1/images/variations`
- 同样是 `multipart/form-data`，只要 `image`，**没有 prompt**。
- 仅 `dall-e-2` 支持，`gpt-image-1/2` 没有这个独立端点（语义被 edits 吸收了）。
- 产出：图片。地位：锦上添花，**不是重点**。

### 1.3 图片理解 / 视觉输入（Vision input）
- 端点：Chat Completions `POST /v1/chat/completions` 或 Responses `POST /v1/responses`。
- JSON body，消息内容是多模态数组：
  ```json
  {
    "role": "user",
    "content": [
      { "type": "text", "text": "描述这张图" },
      { "type": "image_url", "image_url": { "url": "https://..." } }
    ]
  }
  ```
  或 base64 data URL：`"url": "data:image/png;base64,..."`。
- 产出：**文本**（不是图片）。模型是 `gpt-4o` 类通用多模态模型，不是 `gpt-image-*`。
- 地位：和本项目"图片生成 WebUI"的定位**不在一条线**上，加了会让产品边界糊掉。**默认不做**。

### 结论
本项目要做的，几乎可以肯定只是 **1.1 Image Edits**。下文默认只讨论它。
1.2 可以顺手加（成本极低，共用同一个上传组件 + 不同端点即可）。
1.3 不做，除非明确想把产品改成"多模态工作台"。

---

## 2. `/v1/images/edits` 请求的标准形态

以 `gpt-image-1` / `gpt-image-2` 为准（它们是现在 OpenAI 主推、也是多数兼容中转站实际支持的版本；`dall-e-2` 的限制更硬，写兼容即可）。

### 请求
```
POST {baseUrl}/images/edits
Authorization: Bearer <API_KEY>
Content-Type: multipart/form-data; boundary=...

--boundary
Content-Disposition: form-data; name="model"

gpt-image-1
--boundary
Content-Disposition: form-data; name="prompt"

Make the cat wear sunglasses, keep the background.
--boundary
Content-Disposition: form-data; name="image"; filename="cat.png"
Content-Type: image/png

<binary>
--boundary
Content-Disposition: form-data; name="mask"; filename="mask.png"
Content-Type: image/png

<binary>
--boundary
Content-Disposition: form-data; name="size"

1024x1024
--boundary
Content-Disposition: form-data; name="n"

1
--boundary
Content-Disposition: form-data; name="response_format"

b64_json
--boundary--
```

### 多参考图（`gpt-image-1` / `gpt-image-2`）
同一个 `image` 字段多次出现，或写成 `image[]`。不同中转站行为有差异，**浏览器端最稳的做法是"多次 `formData.append('image', file)'"**，让浏览器自动生成重复 parts。

### 响应
和 generations 对齐：
```json
{ "data": [ { "url": "https://..." } ] }
// 或
{ "data": [ { "b64_json": "iVBORw0KG..." } ] }
```

这意味着**结果侧的缓存、预览、下载逻辑（`imageCache.ts`、`TaskCard.tsx` 等）可以零改动复用**。

### 硬约束 / 踩坑点（必须在 UI 和校验里处理）
1. **不能用 JSON**。浏览器 `fetch` 发 `FormData` 时 **不要手动设置 `Content-Type`**，让浏览器自动加带 `boundary` 的头，否则服务端会 400。
2. **`dall-e-2` 的 image 必须是 PNG、方图、<4MB**。前端要么只允许 PNG，要么在模型是 dall-e-2 时做强校验。`gpt-image-1/2` 放宽，但建议统一限制单图 ≤ 25MB，且前端做降采样兜底（见 §4）。
3. **mask 必须与 image 同尺寸**、PNG、带 alpha。不匹配服务器会直接报错。
4. **`response_format` 在 `gpt-image-1/2` 上有时会被忽略**（部分中转站默认只返回 b64_json）。客户端 `getOpenAiImageItem` 已经同时处理 `url` 和 `b64_json`，保持这种容忍即可。
5. **CORS**：edits 端点和 generations 是同一个 host，项目 README 已经提示过 CORS 问题，无新增风险。但 multipart 的预检可能比 JSON 多一次 OPTIONS，体感上"第一次慢"属于正常。
6. **部分中转站（如老张、VIP 中转）对 edits 的支持滞后于 generations**。需要在 UI 里给出明确的失败提示，不要让用户以为是自己 prompt 写错了。

---

## 3. 这件事"容易做吗"？—— 改造复杂度评估

结论：**中等偏小，量级大概是一个下午**。没有架构性的坎。

分模块看：

| 模块 | 改动量 | 说明 |
| --- | --- | --- |
| `src/api/openaiImages.ts` | 新增一个 `editImage()` 同级函数 | 走 FormData 版本，复用现有的 debug / error / 响应解析（`getOpenAiImageItem` 可以直接复用）。generations 路径保持不动。 |
| `src/types/index.ts` | `GenerateFormState` 加 `inputImages: File[]`、`maskImage?: File`；`GenerateImageParams` 加对应字段；新增 `RequestMode = "generate" \| "edit"` | 纯类型层。 |
| `src/components/GenerationPanel.tsx` | 加一个"参考图 / 编辑图"上传区（拖拽 + 点击，多图，缩略图，删除，可选 mask 槽位） | 最大头在这里，但都是标准 React 文件上传 UI，没有什么技术风险。 |
| `src/hooks/useImageTasks.ts` | 分发逻辑：`inputImages.length === 0 ? generateImage() : editImage()` | 改动很小，二选一。 |
| `src/lib/`（新文件 `imageInput.ts`） | 前端图片预处理：读文件 → 校验类型/大小 → 可选降采样到 size 上限 → 输出 File/Blob | 新增文件，约 50–100 行。 |
| `docs/api-features.md` | 把"不调 edits"这一行去掉，补 edits 字段说明 | 文档改几行。 |
| `README.md` | Usage 流程里加"可选：上传参考图/mask" | 两三行。 |

**不需要改的**：
- 结果缓存、预览、下载、复制、i18n 的结果面板文案 —— edits 的响应结构和 generations 相同。
- 模型抓取 (`openaiModels.ts`) —— 已经有 `edit / inpaint / variation` 的启发式分类，用户切到编辑模型时自然能看到。
- 并发调度 —— `useImageTasks.ts` 的并发是与端点无关的 task runner。

**会有一点性能/体验代价**：
- base64 上传比 URL 上传慢。对 10MB 的 PNG，encode + 上传体积变 ~13MB。所以我们走 **FormData + 原始二进制**，不走 data URL，避免这个开销。
- 浏览器端解码大图做预览会卡一帧，用 `URL.createObjectURL(file)` + `<img>` 预览即可，不要走 FileReader→base64→dataURL。

---

## 4. 前端预处理策略（避免踩 API 硬限制）

在发出去之前，本地做这三步：

1. **类型白名单**：`image/png`、`image/jpeg`、`image/webp`。其他直接拒。
   - 选用 `dall-e-2` 模型时，进一步只允许 `image/png`。
2. **尺寸 / 体积上限**：单图 `> 8MB` 或任一边 `> 2048px` 时，**自动走 canvas 降采样**到长边 2048，重编码为 PNG（保留 alpha）或 JPEG。降采样结果直接替换用户给的 File。
3. **mask 与 image 一致性**：选 mask 时，当场用 Image 解码拿 naturalWidth/Height，和第一张 image 对比，不一致就 reject 并提示用户"mask 必须与源图同尺寸"。

以上三步都是纯前端、无新依赖（Canvas API 即可）。

---

## 5. UI 流（最小可用版本）

Generation 面板从上到下：

```
[Prompt                                          ]
[参考图 / 编辑图]  [+ 上传] [拖拽虚线框]
  └─ [缩略图 x] [缩略图 x] [缩略图 x]
  (可选) Mask [+ 选择]  [缩略图 x]
[Count] [Size]
[Advanced JSON]
[Generate]
```

交互要点：
- 有图 → 按钮文本自动切成 **"Edit"**，请求走 `/images/edits`。
- 无图 → 和现在一模一样，走 `/images/generations`，体验零退化。
- 多图参考只在模型看起来支持时生效（启发式：模型名包含 `gpt-image` / `edit` / `flux-kontext` / `seededit` 等），否则只发第一张并给出非阻塞提示。这个判断放客户端是"尽量帮用户避免报错"，不是硬门禁，upstream 才是真相。

---

## 6. 推荐路线（执行顺序）

按依赖顺序拆成 6 步，每步都可独立跑通、独立 commit：

1. **类型层**：`RequestMode`、`inputImages`、`maskImage` 进 `types/index.ts`，`GenerateFormState` 默认值更新。
2. **前端工具**：新建 `src/lib/imageInput.ts`（类型/大小校验、canvas 降采样、尺寸一致性检查）。
3. **API 层**：`src/api/openaiImages.ts` 新增 `editImage()`，和 `generateImage()` 共用一套 debug/响应解析。**不改** `generateImage()` 的签名。
4. **hook 分发**：`useImageTasks.ts` 根据 `inputImages.length` 决定调哪一个。task 记录里存一份 `mode`，便于调试。
5. **UI**：`GenerationPanel.tsx` 加上传区；按钮文案按 `mode` 切换。
6. **文档**：`docs/api-features.md` 把 edits 从"未实现"里移出来并补表；`README.md` Usage 补一行。

每一步都不破坏现有 `/images/generations` 路径。出问题随时可回滚单步。

---

## 7. 明确不做 / 推迟做的

- **Image Variations (`/v1/images/variations`)**：实现成本极低，但只有 `dall-e-2` 支持，价值低。**推迟**，放到 UI 稳定后单独加一个"无 prompt，仅变体"的开关。
- **Vision 输入（Chat/Responses API）**：产品定位不同，**不做**。如果真的要做，应该是另一个独立页面/独立工具，不与图片生成混装。
- **服务端代理以绕过 CORS**：保持纯前端定位。中转站不支持 CORS 是中转站的事，我们只给出清晰的错误信息。
- **拖放多图自动 mosaic / 拼接**：`gpt-image-1/2` 自己就支持多参考图，前端不要再画蛇添足。

---

## 8. 验收标准（Definition of Done）

- [ ] 不上传任何图片时，`/images/generations` 行为与当前完全一致（回归）。
- [ ] 上传 1 张 PNG + Prompt，能成功打到 `/images/edits` 并拿到图片，预览 / 下载 / 复制 / 缓存路径全部可用。
- [ ] 上传 1 张 image + 1 张 mask 时，mask 尺寸不一致会被前端拦截，错误信息准确。
- [ ] 上传 2 张图（多参考）时，请求体里 `image` part 出现两次；在 `gpt-image-1/2` 上能正常返回。
- [ ] 单图 > 8MB 或 > 2048px 时，前端自动降采样，不会触发 upstream 400 / 413。
- [ ] 切换到 `dall-e-2` 并上传非 PNG，前端直接拒绝，不会发请求。
- [ ] Advanced JSON 仍然生效（`quality` / `background` / `output_format` 等），合并到 FormData 字段。
- [ ] README / api-features.md 同步更新，`/images/edits` 不再标"未实现"。
