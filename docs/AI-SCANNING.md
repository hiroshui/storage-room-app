# AI inventory scanning

Storage Room App can analyze a photo of a single shelf or an entire storage location and propose inventory items. The feature intentionally follows a review-first workflow:

1. Open **Shelves** and click the camera button on a shelf, or **Scan location** for the whole rack/cabinet.
2. Take or choose a photo.
3. The browser resizes it to at most 1600 px and compresses it before upload.
4. The server sends the image and storage context to the configured OpenAI vision model.
5. Review, edit, deselect, reassign shelves, and check duplicate warnings.
6. Click **Add selected items** to write the selected rows to SQLite.

Storage Room App does not persist uploaded scan photos. The image only exists in browser memory and in the outbound AI request. The OpenAI Responses API request is sent with `store: false`.

## OpenAI setup

ChatGPT subscriptions and API billing are separate. A ChatGPT Plus subscription does not itself include OpenAI API usage. You can use the same OpenAI account, but you must enable API billing separately.

1. Sign in at `https://platform.openai.com/` with your OpenAI account.
2. Open API billing and add payment details / prepaid credits if required for your account.
3. Open **API keys** in the platform dashboard and create a new secret key.
4. Copy the key immediately. OpenAI only shows a new secret key once.
5. Put it into the server-side `.env` file:

```env
AI_SCANNING_ENABLED=1
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5.6-luna
AI_IMAGE_DETAIL=high
```

Never commit `.env` or an API key to Git. `.env` is already ignored by this repository.

Restart the stack after changing `.env`:

```bash
podman compose down
podman compose up -d --build
```

Open **Settings → AI scan**. The status should change to **Configured**.

## Model selection

`gpt-5.6-luna` is the default because the inventory task is primarily visual classification and structured extraction rather than difficult reasoning. You can override `OPENAI_MODEL` with another vision-capable model available to your API project without changing application code.

## Security and permissions

- The API key exists only on the server/container and is never returned to the browser.
- Read-only users cannot run AI scans or import results.
- Kiosk mode disables scanning even for an otherwise writable account.
- Room permissions are checked server-side before an image is sent to the AI provider.
- Every detected item must be reviewed before database insertion.

## Whole-location scans

A whole-location scan asks the model to map visible items to the location's existing shelf names. This is convenient, but less deterministic than scanning one shelf at a time. For the highest accuracy, use the shelf camera button and take a relatively straight, well-lit photo.

## Environment variables

- `AI_SCANNING_ENABLED` — `1`/`0`, default `1`
- `OPENAI_API_KEY` — secret API key; empty disables scanning
- `OPENAI_MODEL` — model ID, default `gpt-5.6-luna`
- `OPENAI_BASE_URL` — default `https://api.openai.com/v1`; useful for testing/proxies
- `AI_IMAGE_DETAIL` — `low`, `auto`, or `high`; default `high`
- `AI_TIMEOUT` — outbound API timeout in seconds, default `60`
- `AI_MAX_IMAGE_BYTES` — maximum compressed image bytes accepted by the backend, default 6 MiB

## HEIC / HEIF photos

Many iPhones store photos as HEIC/HEIF. Chromium-based browsers cannot reliably decode those files for a canvas preview. The app therefore uploads HEIC/HEIF to the local Storage Room server and converts it to a normalized JPEG before sending it to the configured AI provider. The container installs Pillow and pillow-heif for this conversion.

If you run the application directly without the container, install the image dependencies first:

```bash
python3 -m pip install -r requirements.txt
```
