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
            "Loaded {{total}} models ({{image}} image, {{shown}} shown). Models are grouped as image/non-image; you can still type any name manually.",
          idle:
            "For relay providers, click Fetch models to load the live list, or just type any model name.",
          optionWithOwner: "{{category}} · {{owner}}",
          filters: {
            image: "Image",
            "non-image": "Non-image",
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
        size: "Size (width x height)",
        sizePlaceholder: "For example: 1024x1536",
        resolutionSlider: "Direct resolution sliders",
        widthPixels: "Width (px)",
        heightPixels: "Height (px)",
        currentSize: "Current size: {{size}}",
        currentRatioAuto: "Auto ratio: {{ratio}}",
        sizeStepHint: "Slider step: {{step}}px.",
        sizeCompatibility: {
          free: "Free WxH mode: the selected size is sent as-is for OpenAI-compatible relay models.",
          openaiFixed: "OpenAI fixed-size mode: requests are automatically mapped to the closest supported size to avoid API rejection.",
          gptImage2: "GPT Image 2 mode: requests are normalized to 16px multiples and capped to the supported aspect-ratio range.",
          geminiAspect: "Nano Banana / Gemini mode: the closest supported aspect ratio is sent as aspect_ratio and appended to the prompt as --ar for fallback; size is kept for OpenAI-compatible relays.",
        },
        commonSizes: "Compatible sizes",
        commonSizesHint: "Grouped by aspect ratio. For model-specific APIs, submission may normalize to the nearest supported option.",
        recentSizes: "Recent sizes",
        recentSizesEmpty: "No recent sizes yet. Pick a preset or enter one manually.",
        recommendedSize: "Suggested size: {{size}}",
        refImageSize: "Reference image resolution",
        refImageSizeHint: "Use this image's native resolution for pixel-perfect editing.",

        quality: {
          "1k": "1K",
          "2k": "2K",
          "4k": "4K",
        },
        advancedJsonParams: "Advanced JSON Params",
        generate: "Generate",
        edit: "Edit",
        inputImages: {
          title: "Input images (optional)",
          hint: "Upload to enable edit mode. With images, requests go to /images/edits.",
          addButton: "Add image",
          addMaskButton: "Add mask",
          mask: "Mask (optional)",
          maskHint: "Same size as the first image. Transparent areas are editable.",
          remove: "Remove",
          size: "{{width}}×{{height}}",
          editModeBadge: "Edit mode",
          dropHere: "Drop images here",
          multipleImagesWarning:
            "The selected model may not support multiple reference images; only the first one could be honoured.",
        },
      },

      workspace: {
        tabs: {
          tasks: "Tasks",
          library: "Image Library",
        },
      },
      library: {
        title: "Image Library",
        subtitle: "Browse generated images from browser storage without stretching the task queue.",
        loading: "Loading...",
        empty: "No cached images yet. Generated images will appear here after caching.",
        loadMore: "Load more",
        previewImage: "Preview image",
        unknownPrompt: "Untitled image",
        unknownModel: "Unknown model",
        deleteConfirm: "Delete this cached image? This will remove it from the image library.",
        messages: {
          promptCopied: "Prompt copied.",
          downloadStarted: "Download started.",
          imageDeleted: "Cached image deleted.",
          cacheCleared: "Image cache cleared.",
          loadFailed: "Failed to load image library.",
        },
      },
      tasks: {
        title: "Tasks",

        stats:
          "Pending {{pending}} · Running {{running}} · Success {{success}} · Failed {{error}}",
        total: "{{count}} total",
        showingRecent: "Showing the latest {{shown}} tasks. {{hidden}} older tasks are hidden; generated images stay in the Image Library.",
        empty: "No tasks yet. Enter a prompt and generate your first image.",

        elapsed: "Elapsed: {{value}}",
        generating: "Generating...",
        noImageYet: "No image yet",
        restoringCachedImage: "Restoring cached image...",
        previewGeneratedImage: "Preview generated image",
        debugDetails: "Debug details",

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
          copyDebug: "Copy debug JSON",
          deleteImageCache: "Delete image cache",
          retry: "Retry",
          cancel: "Cancel",
          delete: "Delete",
        },
        cache: {
          title: "Image cache",
          summary: "{{count}} images · {{size}}",
          warning: "Cache is over 200 MB. Consider clearing old images.",
          clear: "Clear cache",
          clearConfirm: "Clear all cached images? Task records will stay, but images may disappear from history.",
          cachedBadge: "cached",
        },
        messages: {

          imageUrlCopied: "Image URL copied.",
          promptCopied: "Prompt copied.",
          debugCopied: "Debug JSON copied.",
          downloadStarted: "Download started.",
          imageCacheDeleted: "Image cache deleted.",
          taskCancelled: "Task cancelled.",
          taskInterrupted: "Task was interrupted by page reload.",
          editInputsDropped:
            "Input images were released from memory. Please re-upload to retry this edit.",
          inputImageInvalid: "Invalid input image: {{reason}}",
          maskMismatch:
            "Mask dimensions do not match the first image. They must be identical.",
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
            "已加载 {{total}} 个模型（{{image}} 个 image，当前显示 {{shown}} 个）。模型仅按 image / 非image 粗分，你仍然可以手动输入任意模型名。",
          idle: "中转服务商可点击获取模型加载实时列表，也可以直接输入任意模型名。",
          optionWithOwner: "{{category}} · {{owner}}",
          filters: {
            image: "image",
            "non-image": "非image",
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
        size: "尺寸（宽 x 高）",
        sizePlaceholder: "例如：1024x1536",
        resolutionSlider: "直接调节分辨率",
        widthPixels: "宽度（px）",
        heightPixels: "高度（px）",
        currentSize: "当前尺寸：{{size}}",
        currentRatioAuto: "自动比例：{{ratio}}",
        sizeStepHint: "滑条步进：{{step}}px。",
        sizeCompatibility: {
          free: "自由 WxH 模式：按所选尺寸直接发送，适合各种 OpenAI 兼容中转模型。",
          openaiFixed: "OpenAI 固定尺寸模式：提交时会自动映射到最接近的官方支持尺寸，避免接口拒绝。",
          gptImage2: "GPT Image 2 模式：提交时会规范到 16px 倍数，并限制到模型支持的宽高比范围。",
          geminiAspect: "Nano Banana / Gemini 模式：提交时会发送最接近的 aspect_ratio，并在提示词末尾追加 --ar 保底；同时保留 size 以兼容 OpenAI 中转。",
        },
        commonSizes: "兼容尺寸",
        commonSizesHint: "按比例分组；模型有固定规则时，提交会自动规范到最近的支持项。",
        recentSizes: "最近使用",

        recentSizesEmpty: "还没有最近使用的尺寸。你可以先点一个预设，或手动输入。",
        recommendedSize: "建议尺寸：{{size}}",
        refImageSize: "参考图原始分辨率",
        refImageSizeHint: "使用参考图的原始分辨率，精确修图。",
        quality: {
          "1k": "1K",
          "2k": "2K",
          "4k": "4K",
        },
        advancedJsonParams: "高级 JSON 参数",
        generate: "开始生成",
        edit: "开始编辑",
        inputImages: {
          title: "输入图片（可选）",
          hint: "上传图片后会自动切换为编辑模式（调用 /images/edits）。",
          addButton: "添加图片",
          addMaskButton: "添加 Mask",
          mask: "Mask（可选）",
          maskHint: "尺寸必须与首张图一致，透明区域会被编辑。",
          remove: "移除",
          size: "{{width}}×{{height}}",
          editModeBadge: "当前：编辑模式",
          dropHere: "拖拽图片到此处",
          multipleImagesWarning:
            "当前模型可能不支持多参考图，实际只有第一张会被使用。",
        },
      },

      workspace: {
        tabs: {
          tasks: "任务",
          library: "图片库",
        },
      },
      library: {
        title: "图片库",
        subtitle: "从浏览器本地存储浏览历史生成图，不再把任务队列无限拉长。",
        loading: "加载中...",
        empty: "还没有缓存图片。生成成功并缓存后会显示在这里。",
        loadMore: "加载更多",
        previewImage: "预览图片",
        unknownPrompt: "未命名图片",
        unknownModel: "未知模型",
        deleteConfirm: "确定删除这张缓存图片吗？它会从图片库中移除。",
        messages: {
          promptCopied: "提示词已复制。",
          downloadStarted: "已开始下载。",
          imageDeleted: "缓存图片已删除。",
          cacheCleared: "图片缓存已清空。",
          loadFailed: "图片库加载失败。",
        },
      },
      tasks: {
        title: "任务",

        stats: "待处理 {{pending}} · 运行中 {{running}} · 成功 {{success}} · 失败 {{error}}",
        total: "共 {{count}} 个",
        showingRecent: "当前只显示最近 {{shown}} 个任务，已隐藏 {{hidden}} 个更早任务；生成图片仍保留在图片库。",
        empty: "还没有任务。输入提示词并生成第一张图片。",

        elapsed: "耗时：{{value}}",
        generating: "生成中...",
        noImageYet: "暂无图片",
        restoringCachedImage: "正在恢复缓存图片...",
        previewGeneratedImage: "预览生成图片",
        debugDetails: "调试详情",

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
          copyDebug: "复制调试 JSON",
          deleteImageCache: "删除图片缓存",
          retry: "重试",
          cancel: "取消",
          delete: "删除",
        },
        cache: {
          title: "图片缓存",
          summary: "{{count}} 张 · {{size}}",
          warning: "缓存已超过 200MB，建议清理旧图片。",
          clear: "清空缓存",
          clearConfirm: "确定清空所有缓存图片吗？任务记录会保留，但历史图片可能不再显示。",
          cachedBadge: "已缓存",
        },
        messages: {

          imageUrlCopied: "图片 URL 已复制。",
          promptCopied: "提示词已复制。",
          debugCopied: "调试 JSON 已复制。",
          downloadStarted: "已开始下载。",
          imageCacheDeleted: "图片缓存已删除。",
          taskCancelled: "任务已取消。",
          taskInterrupted: "任务因页面重新加载而中断。",
          editInputsDropped: "输入图片已从内存释放，请重新上传后再重试编辑任务。",
          inputImageInvalid: "输入图片不合法：{{reason}}",
          maskMismatch: "Mask 尺寸与首张图不一致，两者尺寸必须完全相同。",
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
