# 项目设计方案：OpenAI Image WebUI

## 1. 项目基本信息

### GitHub 仓库名

```txt
openai-image-webui
```

### 项目名称

```txt
OpenAI Image WebUI
```

### GitHub Description

```txt
A pure frontend image generation WebUI for OpenAI-compatible Images APIs. Bring your own API key and endpoint.
```

### 中文简介

```txt
纯前端 BYOK AI 生图 WebUI，兼容 OpenAI Images API，支持自定义 API Key、Base URL、模型和并发任务，可部署到 GitHub Pages。
```

### 项目定位

这是一个纯前端 AI 生图网页应用。

用户自己填写：

```txt
API Base URL
API Key
Model
Prompt
```

前端直接请求 OpenAI 兼容的 Images API：

```txt
POST {baseUrl}/images/generations
```

项目不绑定任何具体 API 服务商。

---

## 2. 核心目标

### 必须支持

- 纯前端运行，无后端
- 可部署到 GitHub Pages
- 用户自带 API Key
- 用户自定义 API Base URL
- 用户自定义模型名
- 兼容 OpenAI Images API
- 支持文生图
- 支持多任务并行生图
- 支持图片预览
- 支持图片下载
- 支持复制图片 URL
- 支持本地保存配置

### 第一版不做

- 登录系统
- 服务端代理
- 服务端保存历史
- 账户体系
- 图生图
- 图片编辑
- 多用户管理

---

## 3. 技术栈

```txt
React
TypeScript
Vite
Tailwind CSS
localStorage
GitHub Pages
```

推荐初始化方式：

```bash
npm create vite@latest openai-image-webui -- --template react-ts
cd openai-image-webui
npm install
```

安装 Tailwind：

```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

安装 GitHub Pages 部署工具：

```bash
npm install -D gh-pages
```

---

## 4. 页面结构

整体采用单页应用。

```txt
OpenAI Image WebUI
├── Header
├── Settings Panel
│   ├── API Base URL
│   ├── API Key
│   ├── Model
│   ├── Response Format
│   └── Concurrency
├── Generation Panel
│   ├── Prompt
│   ├── Image Count
│   ├── Size
│   ├── Advanced JSON Params
│   └── Generate Button
├── Task Queue
│   ├── Pending Tasks
│   ├── Running Tasks
│   ├── Success Tasks
│   └── Failed Tasks
└── Image Preview Modal
```

桌面端布局：

```txt
┌──────────────────────────────────────────────┐
│ Header                                       │
├───────────────┬──────────────────────────────┤
│ Settings      │ Generation Form              │
│               │ Task Queue / Image Gallery   │
└───────────────┴──────────────────────────────┘
```

移动端布局：

```txt
Header
Settings
Generation Form
Task Queue
Image Gallery
```

---

## 5. 功能模块设计

## 5.1 Header

显示：

```txt
OpenAI Image WebUI
Pure frontend BYOK image generation for OpenAI-compatible APIs.
```

右侧放：

```txt
GitHub 链接
清空任务按钮
```

---

## 5.2 Settings Panel

### 字段

```txt
API Base URL
API Key
Model
Response Format
Concurrency
```

### 默认值

```ts
{
  baseUrl: "",
  apiKey: "",
  model: "gpt-image-1",
  responseFormat: "url",
  concurrency: 3
}
```

### API Base URL 示例

用户可以填写：

```txt
https://api.openai.com/v1
https://api.example.com/v1
https://your-proxy.example.com/v1
```

最终请求地址会拼成：

```txt
{baseUrl}/images/generations
```

### API Key 存储

API Key 只保存到浏览器 localStorage。

页面提示文案：

```txt
API Key is stored only in your browser localStorage.
```

中文：

```txt
API Key 仅保存在当前浏览器 localStorage 中。
```

---

## 5.3 Generation Panel

### 字段

```txt
Prompt
Image Count
Size
Advanced JSON Params
```

### 默认值

```ts
{
  prompt: "",
  count: 1,
  size: "1024x1024",
  advancedJson: ""
}
```

### Size 支持

使用输入框加快捷选项。

快捷选项：

```txt
1024x1024
1024x1792
1792x1024
512x512
```

但不限制用户自定义。

### Advanced JSON Params

用于兼容不同 OpenAI-compatible 服务商的额外参数。

示例：

```json
{
  "quality": "high",
  "style": "vivid"
}
```

最终请求体会合并成：

```json
{
  "model": "gpt-image-1",
  "prompt": "A cat",
  "n": 1,
  "size": "1024x1024",
  "response_format": "url",
  "quality": "high",
  "style": "vivid"
}
```

---

## 5.4 Task Queue

每次点击生成，根据 `Image Count` 创建多个任务。

例如：

```txt
prompt: A cyberpunk cat
count: 4
concurrency: 2
```

系统创建：

```txt
Task 1 pending
Task 2 pending
Task 3 pending
Task 4 pending
```

然后并发执行：

```txt
Task 1 running
Task 2 running
Task 3 pending
Task 4 pending
```

完成后继续调度下一个任务。

---

## 5.5 Task Card

每个任务卡片显示：

```txt
状态
Prompt
模型
尺寸
生成耗时
图片结果
错误信息
```

按钮：

```txt
预览
下载
复制图片 URL
复制 Prompt
重新生成
删除
```

状态类型：

```txt
pending
running
success
error
cancelled
```

---

## 6. 数据结构设计

创建文件：

```txt
src/types/index.ts
```

内容：

```ts
export type ImageTaskStatus =
  | "pending"
  | "running"
  | "success"
  | "error"
  | "cancelled";

export type ImageResponseFormat = "url" | "b64_json";

export interface AppSettings {
  apiKey: string;
  baseUrl: string;
  model: string;
  responseFormat: ImageResponseFormat;
  concurrency: number;
}

export interface GenerateFormState {
  prompt: string;
  count: number;
  size: string;
  advancedJson: string;
}

export interface ImageTask {
  id: string;
  prompt: string;
  model: string;
  size: string;
  responseFormat: ImageResponseFormat;
  status: ImageTaskStatus;
  imageUrl?: string;
  b64Json?: string;
  error?: string;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  raw?: unknown;
}

export interface GenerateImageParams {
  apiKey: string;
  baseUrl: string;
  model: string;
  prompt: string;
  size?: string;
  responseFormat?: ImageResponseFormat;
  extraParams?: Record<string, unknown>;
  signal?: AbortSignal;
}
```

---

## 7. 目录结构

```txt
openai-image-webui/
├── public/
│   └── favicon.svg
├── src/
│   ├── api/
│   │   └── openaiImages.ts
│   ├── components/
│   │   ├── Header.tsx
│   │   ├── SettingsPanel.tsx
│   │   ├── GenerationPanel.tsx
│   │   ├── TaskQueue.tsx
│   │   ├── TaskCard.tsx
│   │   ├── ImagePreviewModal.tsx
│   │   └── Notice.tsx
│   ├── hooks/
│   │   ├── useLocalStorage.ts
│   │   ├── useSettings.ts
│   │   └── useImageTasks.ts
│   ├── lib/
│   │   ├── storage.ts
│   │   ├── parseAdvancedJson.ts
│   │   ├── download.ts
│   │   └── errors.ts
│   ├── types/
│   │   └── index.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── .env.example
├── README.md
├── LICENSE
├── package.json
├── vite.config.ts
├── tsconfig.json
└── index.html
```

---

## 8. localStorage 设计

统一使用项目前缀：

```txt
openai-image-webui:settings
openai-image-webui:tasks
```

`settings` 保存：

```ts
{
  apiKey: string;
  baseUrl: string;
  model: string;
  responseFormat: "url" | "b64_json";
  concurrency: number;
}
```

默认配置：

```ts
export const DEFAULT_SETTINGS = {
  apiKey: "",
  baseUrl: "",
  model: "gpt-image-1",
  responseFormat: "url",
  concurrency: 3,
};
```

---

## 9. API 调用模块

创建文件：

```txt
src/api/openaiImages.ts
```

代码：

```ts
import type { GenerateImageParams } from "../types";

export async function generateImage(params: GenerateImageParams) {
  const {
    apiKey,
    baseUrl,
    model,
    prompt,
    size,
    responseFormat = "url",
    extraParams = {},
    signal,
  } = params;

  if (!apiKey.trim()) {
    throw new Error("API Key is required.");
  }

  if (!baseUrl.trim()) {
    throw new Error("API Base URL is required.");
  }

  if (!model.trim()) {
    throw new Error("Model is required.");
  }

  if (!prompt.trim()) {
    throw new Error("Prompt is required.");
  }

  const endpoint = `${baseUrl.replace(/\/$/, "")}/images/generations`;

  const body = {
    model,
    prompt,
    n: 1,
    ...(size ? { size } : {}),
    ...(responseFormat ? { response_format: responseFormat } : {}),
    ...extraParams,
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed with status ${res.status}`);
  }

  const data = await res.json();
  const item = data?.data?.[0];

  if (!item) {
    throw new Error("No image data returned.");
  }

  if (item.url) {
    return {
      imageUrl: item.url as string,
      raw: data,
    };
  }

  if (item.b64_json) {
    return {
      imageUrl: `data:image/png;base64,${item.b64_json}`,
      b64Json: item.b64_json as string,
      raw: data,
    };
  }

  throw new Error("Unsupported image response format.");
}
```

---

## 10. Advanced JSON 解析

创建文件：

```txt
src/lib/parseAdvancedJson.ts
```

代码：

```ts
export function parseAdvancedJson(text: string): Record<string, unknown> {
  if (!text.trim()) {
    return {};
  }

  let value: unknown;

  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("Advanced JSON Params is not valid JSON.");
  }

  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new Error("Advanced JSON Params must be a JSON object.");
  }

  return value as Record<string, unknown>;
}
```

---

## 11. 并发任务 Hook 设计

创建文件：

```txt
src/hooks/useImageTasks.ts
```

核心职责：

```txt
创建任务
启动任务
控制最大并发数
更新任务状态
删除任务
重新生成任务
清空任务
```

接口设计：

```ts
export function useImageTasks() {
  return {
    tasks,
    addTasks,
    retryTask,
    removeTask,
    clearTasks,
  };
}
```

核心逻辑：

```txt
1. 用户点击 Generate
2. addTasks 创建 N 个 pending task
3. 调度器检查 running 数量
4. 如果 running < concurrency，启动 pending task
5. task 成功后变 success
6. task 失败后变 error
7. task 结束后继续启动下一个 pending task
```

---

## 12. 错误处理

需要处理以下错误：

### 缺少 API Key

```txt
API Key is required.
```

### 缺少 Base URL

```txt
API Base URL is required.
```

### 缺少模型

```txt
Model is required.
```

### 缺少 Prompt

```txt
Prompt is required.
```

### JSON 参数错误

```txt
Advanced JSON Params is not valid JSON.
```

### CORS 或网络错误

浏览器通常只会抛出：

```txt
Failed to fetch
```

页面显示：

```txt
Request failed. Please check your API key, base URL, model, network, or CORS settings.
```

中文提示：

```txt
请求失败。请检查 API Key、Base URL、模型名称、网络或 CORS 设置。
```

补充说明：

```txt
If the same request works in curl/Postman but fails in browser, it is likely a CORS issue.
```

---

## 13. UI 文案

### Header

```txt
OpenAI Image WebUI
```

副标题：

```txt
Pure frontend BYOK image generation for OpenAI-compatible APIs.
```

### Settings Panel

标题：

```txt
API Settings
```

字段：

```txt
API Base URL
API Key
Model
Response Format
Concurrency
```

安全提示：

```txt
Your API key is stored only in this browser.
```

### Generation Panel

标题：

```txt
Generate Images
```

字段：

```txt
Prompt
Image Count
Size
Advanced JSON Params
```

按钮：

```txt
Generate
```

### Task Queue

标题：

```txt
Tasks
```

空状态：

```txt
No tasks yet. Enter a prompt and generate your first image.
```

---

## 14. GitHub Pages 配置

`vite.config.ts`：

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/openai-image-webui/",
});
```

`package.json` scripts：

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "predeploy": "npm run build",
    "deploy": "gh-pages -d dist"
  }
}
```

部署命令：

```bash
npm run deploy
```

---

## 15. package.json

```json
{
  "name": "openai-image-webui",
  "version": "0.1.0",
  "description": "A pure frontend image generation WebUI for OpenAI-compatible Images APIs. Bring your own API key and endpoint.",
  "private": false,
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "predeploy": "npm run build",
    "deploy": "gh-pages -d dist"
  },
  "keywords": [
    "openai",
    "openai-compatible",
    "image-generation",
    "ai-image-generator",
    "byok",
    "react",
    "vite",
    "typescript",
    "github-pages"
  ],
  "license": "MIT",
  "dependencies": {
    "@vitejs/plugin-react": "latest",
    "vite": "latest",
    "typescript": "latest",
    "react": "latest",
    "react-dom": "latest"
  },
  "devDependencies": {
    "gh-pages": "latest",
    "tailwindcss": "latest",
    "postcss": "latest",
    "autoprefixer": "latest"
  }
}
```

---

## 16. .env.example

```env
VITE_APP_NAME=OpenAI Image WebUI
VITE_DEFAULT_MODEL=gpt-image-1
```

不要放 API Key。

README 中必须写：

```txt
Do not put your API key in .env files.
Vite environment variables are exposed to frontend bundles.
```

---

## 17. README 模板

```md
# OpenAI Image WebUI

A pure frontend image generation WebUI for OpenAI-compatible Images APIs.

Bring your own API key and endpoint.

## Features

- Pure frontend, no backend required
- Deployable on GitHub Pages
- Bring your own API key
- Bring your own API endpoint
- Compatible with OpenAI Images API
- Supports custom model names
- Supports parallel image generation tasks
- Supports URL and base64 image responses
- Supports image preview, download, and copy
- Stores settings locally in your browser

## Quick Start

```bash
git clone https://github.com/yourname/openai-image-webui.git
cd openai-image-webui
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Deploy to GitHub Pages

```bash
npm run deploy
```

## Usage

1. Open the app
2. Enter your API Base URL
3. Enter your API Key
4. Enter the model name
5. Write a prompt
6. Click Generate

## API Format

This app calls:

```txt
POST {baseUrl}/images/generations
```

Example request body:

```json
{
  "model": "gpt-image-1",
  "prompt": "A cute cat wearing sunglasses",
  "n": 1,
  "size": "1024x1024",
  "response_format": "url"
}
```

Supported response formats:

```json
{
  "data": [
    {
      "url": "https://example.com/image.png"
    }
  ]
}
```

or:

```json
{
  "data": [
    {
      "b64_json": "..."
    }
  ]
}
```

## Security Notice

Your API key is stored only in your browser localStorage.

This project does not include, upload, or proxy your API key. Requests are sent directly from your browser to the API endpoint you configure.

Do not use this app on public devices. Do not commit your API key to GitHub.

## CORS Notice

This is a pure frontend application. It directly calls the configured API endpoint from the browser.

The API provider must allow CORS requests.

If the same request works in curl/Postman but fails in this app with `Failed to fetch`, it is likely a CORS issue.

## License

MIT
```

---

## 18. 开发顺序

### Step 1：初始化项目

```bash
npm create vite@latest openai-image-webui -- --template react-ts
cd openai-image-webui
npm install
npm install -D tailwindcss postcss autoprefixer gh-pages
npx tailwindcss init -p
```

完成：

```txt
基础 React 页面
Tailwind 可用
GitHub Pages 配置可用
```

---

### Step 2：实现设置保存

完成：

```txt
API Base URL 输入框
API Key 输入框
Model 输入框
Response Format 选择
Concurrency 选择
localStorage 保存和读取
```

---

### Step 3：实现单张生图

完成：

```txt
generateImage API 函数
Prompt 输入
点击 Generate
展示一张图片
展示错误信息
```

---

### Step 4：实现任务队列

完成：

```txt
ImageTask 数据结构
创建多个 pending task
running/success/error 状态
任务卡片展示
```

---

### Step 5：实现并发控制

完成：

```txt
concurrency 参数
最多同时执行 N 个任务
任务完成后自动启动下一个 pending task
```

---

### Step 6：完善图片操作

完成：

```txt
图片预览
下载图片
复制图片 URL
复制 Prompt
删除任务
重新生成
清空任务
```

---

### Step 7：完善文档和部署

完成：

```txt
README
LICENSE
GitHub Pages 部署
CORS Notice
Security Notice
```

---

## 19. 第一版验收标准

第一版完成后，应该满足：

```txt
用户可以打开 GitHub Pages 页面
用户可以填写 API Base URL
用户可以填写 API Key
用户可以填写模型名
用户可以输入 Prompt
用户可以选择生成数量
用户可以设置并发数量
用户可以同时生成多张图片
用户可以看到每个任务的状态
用户可以预览生成结果
用户可以下载图片
用户可以复制图片 URL
用户刷新页面后配置仍然存在
```

---

## 20. 最终定稿

项目按以下方案执行：

```txt
Repository:
openai-image-webui

Project Name:
OpenAI Image WebUI

Description:
A pure frontend image generation WebUI for OpenAI-compatible Images APIs. Bring your own API key and endpoint.

Tech Stack:
React + TypeScript + Vite + Tailwind CSS

Deploy:
GitHub Pages

Storage:
localStorage

API:
POST {baseUrl}/images/generations

Core Feature:
Browser-only BYOK image generation with parallel task queue.
```