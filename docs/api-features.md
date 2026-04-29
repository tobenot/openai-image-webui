# OpenAI Images API — Features Reference

This app is a thin BYOK frontend over the OpenAI Images API. Anything the API itself supports is potentially usable here. The UI exposes the most common controls (model, size, n, response format, concurrency); everything else can be passed through the **Advanced JSON** field on the generation panel and is forwarded as-is to the request body.

This document lists the parameters and capabilities you can take advantage of. It applies to the official OpenAI endpoint and to any OpenAI-compatible relay (e.g. LaoZhang) that mirrors the same surface.

> Endpoint actually called by this app:
> ```
> POST {baseUrl}/images/generations
> ```

---

## Already exposed in the UI

| UI field            | Request field     | Notes                                                                 |
| ------------------- | ----------------- | --------------------------------------------------------------------- |
| Base URL            | (endpoint prefix) | Any OpenAI-compatible `/v1` base.                                     |
| API Key             | `Authorization`   | Sent as `Bearer <key>`.                                               |
| Model               | `model`           | Free text. **Fetch models** button populates suggestions from `GET /v1/models`. |
| Prompt              | `prompt`          | Required.                                                             |
| Size                | `size`            | E.g. `1024x1024`, `1792x1024`, `1024x1792`.                           |
| Response format     | `response_format` | `url` or `b64_json`.                                                   |
| Concurrency         | (client-side)     | How many tasks run in parallel; does not map to a request field.      |
| Count               | (client-side)     | The app issues N independent requests with `n: 1` each.               |

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

- `POST /v1/images/edits` — image editing with mask. Would need a multipart/form-data uploader; not implemented.
- `POST /v1/images/variations` — variations from a source image. Same reason.

If you need these, file an issue or a PR. They are deliberately out of scope for the current "text → image" flow.

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
