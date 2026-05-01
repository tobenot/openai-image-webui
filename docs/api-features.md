# OpenAI Images API — Features Reference

This app is a thin BYOK frontend over the OpenAI Images API. Anything the API itself supports is potentially usable here. The UI exposes the most common controls (model, size, n, response format, concurrency, input images, mask); everything else can be passed through the **Advanced JSON** field on the generation panel and is forwarded as-is to the request body / form.

This document lists the parameters and capabilities you can take advantage of. It applies to the official OpenAI endpoint and to any OpenAI-compatible relay (e.g. LaoZhang) that mirrors the same surface.

> Endpoints actually called by this app:
> ```
> POST {baseUrl}/images/generations    (text → image)
> POST {baseUrl}/images/edits          (image(s) + prompt → image, multipart/form-data)
> ```
> Which one is used depends on whether the user uploaded any input images.

---

## Model list and type filters

`GET /v1/models` normally returns model IDs, not a reliable capability manifest. Official OpenAI accounts may only expose a small set of true Images API models, while OpenAI-compatible relays can expose many more image providers behind the same `/v1` shape.

Because the response is usually just IDs, this app uses a conservative name-based classifier for the model suggestions:

- **Image generation**: `gpt-image`, `dall-e`, `flux`, `sora-image`, `gemini-flash-image`, `nano-banana`, `seedream`, `imagen`, `midjourney`, `stable-diffusion` / `sd3`, etc.
- **Image editing**: names containing `edit`, `inpaint`, `outpaint`, `variation`, `controlnet`, `seededit`, etc.
- **Image-related**: broader names containing `image`, `img`, `photo`, `picture`, `vision`, or `visual`.
- **Video**: `sora`, `video`, `kling`, `runway`, `pika`, `luma`, etc.
- **Other**: everything else.

The filter is only for convenience. It does not guarantee that a model works with `POST /images/generations`; the upstream endpoint is still the source of truth. If a model is misclassified or missing from a category, type it manually.

---

## Already exposed in the UI

| UI field            | Request field     | Notes                                                                 |
| ------------------- | ----------------- | --------------------------------------------------------------------- |
| Base URL            | (endpoint prefix) | Any OpenAI-compatible `/v1` base.                                     |
| API Key             | `Authorization`   | Sent as `Bearer <key>`.                                               |
| Model               | `model`           | Free text. **Fetch models** loads `GET /v1/models` suggestions and lets you filter them by inferred type. |
| Prompt              | `prompt`          | Required.                                                             |
| Size                | `size`            | E.g. `1024x1024`, `1792x1024`, `1024x1792`.                           |
| Response format     | `response_format` | `url` or `b64_json`.                                                   |
| **Input images**    | `image` (multipart) | Upload one or more reference images to enter edit mode (request auto-switches to `/images/edits`). |
| **Mask**            | `mask` (multipart) | Optional inpainting mask; must be PNG and match the first image's size. |
| Concurrency         | (client-side)     | How many tasks run in parallel; does not map to a request field.      |
| Count               | (client-side)     | The app issues N independent requests with `n: 1` each.               |

When any input image is attached, the request is sent as `multipart/form-data` to `/images/edits` instead of as JSON to `/images/generations`. All of the fields above (prompt, size, response_format, Advanced JSON passthroughs) still apply — they become form parts instead of JSON keys.

### Input image preprocessing

The frontend validates and (when needed) downscales images before upload to avoid upstream 400/413 errors:

- Accepted MIME types: `image/png`, `image/jpeg`, `image/webp`.
- When the selected model is `dall-e-2`, only `image/png` is accepted and the image must be square.
- Any file larger than 8 MB or with a side longer than 2048 px is re-encoded via canvas to a 2048-px longest-side version. PNG stays PNG to preserve alpha; JPEG/WebP stay in format at quality 0.92.
- Mask must match the first image's width/height exactly; otherwise the UI rejects it before sending.

---

## Available via Advanced JSON (not yet in the UI)

These are documented OpenAI Images parameters. Drop them into the **Advanced JSON** field; they get merged into the request body and override defaults.

### `quality`
- Type: `string`
- Values: `"standard"` | `"hd"` (DALL·E 3 / `gpt-image-1`-class models)
- Higher quality costs more and takes longer.
```json
{ "quality": "hd" }
```

### `style`
- Type: `string`
- Values: `"vivid"` | `"natural"` (DALL·E 3)
- `vivid` pushes saturated, dramatic results; `natural` is more muted/realistic.
```json
{ "style": "natural" }
```

### `n`
- Type: `integer`
- The OpenAI API accepts `n` for asking the server to return multiple images in one response. **This app currently always sends `n: 1`** and instead issues multiple parallel requests (better progress feedback per image, easier retry). If you specifically want server-side batching, override it:
```json
{ "n": 4 }
```
Note: with this override, only the first image of each response is currently consumed by the UI. Prefer the Count field unless you have a reason.

### `user`
- Type: `string`
- An opaque end-user identifier OpenAI uses for abuse monitoring. Recommended in production multi-tenant setups.
```json
{ "user": "user_8f3a..." }
```

### `background` (gpt-image-1)
- Type: `string`
- Values: `"transparent"` | `"opaque"` | `"auto"`
- Transparent only works when the output format supports alpha (PNG / WebP).
```json
{ "background": "transparent", "output_format": "png" }
```

### `output_format` (gpt-image-1)
- Type: `string`
- Values: `"png"` | `"jpeg"` | `"webp"`
- Combine with `output_compression` for lossy formats.
```json
{ "output_format": "webp", "output_compression": 80 }
```

### `moderation` (gpt-image-1)
- Type: `string`
- Values: `"auto"` | `"low"`
- `low` relaxes content filtering where the policy allows.

### Other passthrough fields
Anything else the upstream supports (e.g. provider-specific `seed`, `negative_prompt`, `guidance_scale` on Flux/SD-style models served through a relay) can also be added here. The app does not validate; the upstream returns the error if a field is unsupported.

---

## Endpoints this app does not call

These exist on the OpenAI Images surface but are not wired up in the UI:

- `POST /v1/images/variations` — variations from a source image (no prompt). Only `dall-e-2` supports it; `gpt-image-1/2` subsumes the semantics into edits. Not implemented.

If you need variations, file an issue or a PR.

### Edit-mode caveats

- Input File blobs live **only in memory** — they are not persisted into localStorage. Reloading the page drops them; queued edit tasks that hadn't started will be marked cancelled.
- Retrying a finished edit task requires re-uploading the original images. The UI surfaces a clear message (`editInputsDropped`) when this happens.
- Not every OpenAI-compatible relay keeps pace with OpenAI on `/images/edits`. If a relay returns 404 / "not implemented" for edits while `/images/generations` works, that is a relay-side gap.

---

## Streaming

The Images endpoint is **not** a streaming endpoint (unlike Chat Completions). The app waits for the full JSON response per task. The Concurrency slider is what makes the UX feel responsive when generating many images.

---

## Rate limits

Limits are imposed by the upstream, not by this app. Reference figures:

- **OpenAI** — limits depend on tier; see the OpenAI dashboard.
- **LaoZhang** (example relay) — 3000 RPM, 1,000,000 TPM, 100 concurrent per key.

The Concurrency slider in this app is capped at a small number on purpose; even with very generous upstream limits, browser-side connection limits and CORS preflights make huge fan-outs unproductive.

---

## Authentication

Standard `Authorization: Bearer <API_KEY>` header. No other auth schemes are supported. The key never leaves the browser except in the request to the configured base URL.

---

## Errors

The app surfaces the upstream `error.message` field when the response is non-2xx. Common cases:

| HTTP | Typical `code`            | Meaning                                          |
| ---- | ------------------------- | ------------------------------------------------ |
| 400  | `invalid_request_error`   | Bad parameter — check Advanced JSON spelling.    |
| 401  | `invalid_api_key`         | Wrong / expired key.                             |
| 404  | `model_not_found`         | The model name is not available on this endpoint.|
| 429  | `rate_limit_exceeded` / `insufficient_quota` | Slow down or top up.            |
| 500  | `server_error`            | Upstream issue — retry with backoff.             |

If the request works in `curl` but fails here with `Failed to fetch`, it is almost always a **CORS** problem on the upstream, not a bug in the app.
