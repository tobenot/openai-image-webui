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
| LaoZhang API | `https://api.laozhang.ai/v1` | `gpt-4o-image` |

Presets only fill the base URL, default model, and response format. You still need to bring your own API key, and relay providers may change model names over time, so check the provider dashboard for the latest supported model list.

## Why direct fetch instead of the OpenAI SDK?

The official OpenAI JavaScript SDK can target browsers only when `dangerouslyAllowBrowser: true` is set, because browser-side usage can expose API credentials. This project is already a pure frontend BYOK tool, so it uses a small direct `fetch` wrapper against the OpenAI-compatible REST endpoint. That keeps the bundle smaller, avoids SDK-specific browser warnings, and works with custom base URLs such as relay providers.

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

Do not put your API key in `.env` files.

Vite environment variables are exposed to frontend bundles.

Do not use this app on public devices. Do not commit your API key to GitHub.

## CORS Notice

This is a pure frontend application. It directly calls the configured API endpoint from the browser.

The API provider must allow CORS requests.

If the same request works in curl/Postman but fails in this app with `Failed to fetch`, it is likely a CORS issue.

## License

MIT
