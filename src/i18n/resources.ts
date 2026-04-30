export const LANGUAGE_STORAGE_KEY = "openai-image-webui:language";

export const SUPPORTED_LANGUAGES = ["en", "zh-CN"] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const resources = {
  en: {
    translation: {
      meta: {
        title: "OpenAI Image WebUI",
        description:
          "A pure frontend image generation WebUI for OpenAI-compatible Images APIs. Bring your own API key and endpoint.",
      },
      language: {
        label: "Language",
        options: {
          en: "English",
          "zh-CN": "简体中文",
        },
      },
      header: {
        badge: "Browser-only BYOK",
        title: "OpenAI Image WebUI",
        subtitle: "Pure frontend BYOK image generation for OpenAI-compatible APIs.",
        github: "GitHub",
        clearTasks: "Clear tasks",
      },
      settings: {
        title: "API Settings",
        subtitle: "Bring your own endpoint and key.",
        reset: "Reset",
        providerPresets: "Provider Presets",
        presetsNote:
          "Presets only fill the base URL, model, and response format. You still need to use your own API key.",
        apiBaseUrl: "API Base URL",
        apiKey: "API Key",
        model: "Model",
        responseFormat: "Response Format",
        concurrency: "Concurrency",
        apiKeyNotice: "Your API key is stored only in this browser.",
        presets: {
          openai: {
            description: "Official Images API",
          },
          laozhang: {
            description: "OpenAI-compatible relay (global)",
          },
          laozhangVip: {
            description: "Backup endpoint for overseas servers",
          },
        },
        models: {
          fetching: "Fetching…",
          fetchModels: "Fetch models",
          loaded:
            "Loaded {{total}} models ({{image}} image-related, {{shown}} shown). Classification is heuristic; you can still type any name manually.",
          idle:
            "For relay providers, click Fetch models to load the live list, or just type any model name.",
          optionWithOwner: "{{category}} · {{owner}}",
          filters: {
            image: "Image models",
            "image-generation": "Image generation",
            "image-editing": "Image editing",
            "image-related": "Image-related",
            video: "Video",
            other: "Other",
            all: "All models",
          },
        },
      },
      generation: {
        title: "Generate Images",
        subtitle: "Create queued image tasks from one prompt.",
        prompt: "Prompt",
        promptPlaceholder: "A cute cat wearing sunglasses, cinematic lighting",
        imageCount: "Image Count",
        size: "Size",
        advancedJsonParams: "Advanced JSON Params",
        generate: "Generate",
      },
      tasks: {
        title: "Tasks",
        stats:
          "Pending {{pending}} · Running {{running}} · Success {{success}} · Failed {{error}}",
        total: "{{count}} total",
        empty: "No tasks yet. Enter a prompt and generate your first image.",
        elapsed: "Elapsed: {{value}}",
        generating: "Generating...",
        noImageYet: "No image yet",
        previewGeneratedImage: "Preview generated image",
        fields: {
          model: "Model",
          size: "Size",
          format: "Format",
        },
        status: {
          pending: "pending",
          running: "running",
          success: "success",
          error: "error",
          cancelled: "cancelled",
        },
        actions: {
          preview: "Preview",
          download: "Download",
          copyImageUrl: "Copy image URL",
          copyPrompt: "Copy prompt",
          retry: "Retry",
          cancel: "Cancel",
          delete: "Delete",
        },
        messages: {
          imageUrlCopied: "Image URL copied.",
          promptCopied: "Prompt copied.",
          downloadStarted: "Download started.",
          taskCancelled: "Task cancelled.",
          taskInterrupted: "Task was interrupted by page reload.",
        },
      },
      preview: {
        closePreview: "Close preview",
        close: "Close",
        alt: "Preview",
      },
      notice: {
        cors:
          "If the same request works in curl/Postman but fails in browser, it is likely a CORS issue.",
      },
      errors: {
        unknown: "Unknown error.",
        requestFailed:
          "Request failed. Please check your API key, base URL, model, network, or CORS settings.",
        apiKeyRequired: "API Key is required.",
        apiBaseUrlRequired: "API Base URL is required.",
        modelRequired: "Model is required.",
        promptRequired: "Prompt is required.",
        apiKeyRequiredToFetchModels: "API Key is required to fetch models.",
        apiBaseUrlRequiredToFetchModels: "API Base URL is required to fetch models.",
        advancedJsonInvalid: "Advanced JSON Params is not valid JSON.",
        advancedJsonObject: "Advanced JSON Params must be a JSON object.",
      },
    },
  },
  "zh-CN": {
    translation: {
      meta: {
        title: "OpenAI 图片 WebUI",
        description: "纯前端 OpenAI 兼容图片生成 WebUI，自带 API Key 和端点即可使用。",
      },
      language: {
        label: "语言",
        options: {
          en: "English",
          "zh-CN": "简体中文",
        },
      },
      header: {
        badge: "纯浏览器 BYOK",
        title: "OpenAI 图片 WebUI",
        subtitle: "面向 OpenAI 兼容 API 的纯前端 BYOK 图片生成工具。",
        github: "GitHub",
        clearTasks: "清空任务",
      },
      settings: {
        title: "API 设置",
        subtitle: "填写你自己的接口地址和密钥。",
        reset: "重置",
        providerPresets: "服务商预设",
        presetsNote: "预设只会填充 Base URL、模型和响应格式，你仍然需要使用自己的 API Key。",
        apiBaseUrl: "API Base URL",
        apiKey: "API Key",
        model: "模型",
        responseFormat: "响应格式",
        concurrency: "并发数",
        apiKeyNotice: "你的 API Key 只会保存在当前浏览器中。",
        presets: {
          openai: {
            description: "官方 Images API",
          },
          laozhang: {
            description: "OpenAI 兼容中转（全球）",
          },
          laozhangVip: {
            description: "海外服务器备用端点",
          },
        },
        models: {
          fetching: "获取中…",
          fetchModels: "获取模型",
          loaded:
            "已加载 {{total}} 个模型（{{image}} 个图片相关，当前显示 {{shown}} 个）。分类基于启发式规则，你仍然可以手动输入任意模型名。",
          idle: "中转服务商可点击获取模型加载实时列表，也可以直接输入任意模型名。",
          optionWithOwner: "{{category}} · {{owner}}",
          filters: {
            image: "图片模型",
            "image-generation": "图片生成",
            "image-editing": "图片编辑",
            "image-related": "图片相关",
            video: "视频",
            other: "其他",
            all: "全部模型",
          },
        },
      },
      generation: {
        title: "生成图片",
        subtitle: "用一条提示词创建队列化图片任务。",
        prompt: "提示词",
        promptPlaceholder: "一只戴墨镜的可爱猫，电影感光照",
        imageCount: "图片数量",
        size: "尺寸",
        advancedJsonParams: "高级 JSON 参数",
        generate: "生成",
      },
      tasks: {
        title: "任务",
        stats: "待处理 {{pending}} · 运行中 {{running}} · 成功 {{success}} · 失败 {{error}}",
        total: "共 {{count}} 个",
        empty: "还没有任务。输入提示词并生成第一张图片。",
        elapsed: "耗时：{{value}}",
        generating: "生成中...",
        noImageYet: "暂无图片",
        previewGeneratedImage: "预览生成图片",
        fields: {
          model: "模型",
          size: "尺寸",
          format: "格式",
        },
        status: {
          pending: "待处理",
          running: "运行中",
          success: "成功",
          error: "失败",
          cancelled: "已取消",
        },
        actions: {
          preview: "预览",
          download: "下载",
          copyImageUrl: "复制图片 URL",
          copyPrompt: "复制提示词",
          retry: "重试",
          cancel: "取消",
          delete: "删除",
        },
        messages: {
          imageUrlCopied: "图片 URL 已复制。",
          promptCopied: "提示词已复制。",
          downloadStarted: "已开始下载。",
          taskCancelled: "任务已取消。",
          taskInterrupted: "任务因页面重新加载而中断。",
        },
      },
      preview: {
        closePreview: "关闭预览",
        close: "关闭",
        alt: "预览",
      },
      notice: {
        cors: "如果同一个请求在 curl/Postman 中可用但在浏览器中失败，通常是 CORS 问题。",
      },
      errors: {
        unknown: "未知错误。",
        requestFailed: "请求失败。请检查 API Key、Base URL、模型、网络或 CORS 设置。",
        apiKeyRequired: "请填写 API Key。",
        apiBaseUrlRequired: "请填写 API Base URL。",
        modelRequired: "请填写模型。",
        promptRequired: "请填写提示词。",
        apiKeyRequiredToFetchModels: "获取模型前请先填写 API Key。",
        apiBaseUrlRequiredToFetchModels: "获取模型前请先填写 API Base URL。",
        advancedJsonInvalid: "高级 JSON 参数不是有效的 JSON。",
        advancedJsonObject: "高级 JSON 参数必须是 JSON 对象。",
      },
    },
  },
} as const;
