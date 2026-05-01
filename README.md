# OpenAI Image WebUI

A pure frontend image generation WebUI for OpenAI-compatible Images APIs.

Bring your own API key and endpoint.

## Features

- Pure frontend, no backend required
- Deployable on GitHub Pages
- Bring your own API key
- Bring your own API endpoint
- Compatible with OpenAI Images API
- Supports custom model names, with on-demand model list fetching and type filtering from `GET /v1/models`
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

1. Open the app.
2. Choose a provider preset, or enter your API Base URL manually.
3. Enter your API Key.
4. Enter the model name.
5. Write a prompt.
6. Choose image count, size, response format, and concurrency.
7. Click Generate.

## Provider Presets

The app includes quick presets for common OpenAI-compatible Images API providers:

| Provider | Base URL | Default model |
| --- | --- | --- |
| OpenAI | `https://api.openai.com/v1` | `gpt-image-1` |
| LaoZhang API | `https://api.laozhang.ai/v1` | `gpt-image-1` |
| LaoZhang VIP | `https://api-vip.laozhang.ai/v1` | `gpt-image-1` |

Presets only fill the base URL, default model, and response format. You still need to bring your own API key. Any OpenAI-compatible relay (LaoZhang is just one example) works the same way — point the base URL at it and go. Use the **Fetch models** button next to the Model field to load the live model list from whichever endpoint you configured.

For a full list of OpenAI Images API parameters that can be used with this app (including ones not exposed in the UI, passed via the Advanced JSON field), see [`docs/api-features.md`](./docs/api-features.md).

## Why direct fetch instead of the OpenAI SDK?

The official OpenAI JavaScript SDK can target browsers only when `dangerouslyAllowBrowser: true` is set, because browser-side usage can expose API credentials. This project is already a pure frontend BYOK tool, so it uses a small direct `fetch` wrapper against the OpenAI-compatible REST endpoint. That keeps the bundle smaller, avoids SDK-specific browser warnings, and works with custom base URLs such as relay providers.

## API Format


This app calls one of two endpoints, depending on whether any input images are attached:

```txt
POST {baseUrl}/images/generations     # text → image, JSON body
POST {baseUrl}/images/edits           # image(s) + prompt → image, multipart/form-data
```

Example generation request body:

```json
{
  "model": "gpt-image-1",
  "prompt": "A cute cat wearing sunglasses",
  "n": 1,
  "size": "1024x1024",
  "response_format": "url"
}
```

Edit requests are sent as `multipart/form-data` with the same logical fields plus one or more `image` parts and an optional `mask` part. The response shape is identical to generations.

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

Do not put your API key in `.env` files.

Vite environment variables are exposed to frontend bundles.

Do not use this app on public devices. Do not commit your API key to GitHub.

## CORS Notice

This is a pure frontend application. It directly calls the configured API endpoint from the browser.

The API provider must allow CORS requests.

If the same request works in curl/Postman but fails in this app with `Failed to fetch`, it is likely a CORS issue.

## License

MIT
