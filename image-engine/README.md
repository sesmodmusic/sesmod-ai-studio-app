# SESMOD AI IMAGE — first engine prototype

This folder contains the first self-hosted text-to-image API for SESMOD AI STUDIO.

## Model

Default model: `stabilityai/stable-diffusion-xl-base-1.0` (SDXL Base 1.0).
It is an open-weight model under the CreativeML OpenRAIL++-M license. Read and comply with the complete model license and use restrictions before offering generation commercially:
https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0

We start with SDXL because it is a practical baseline for a GPU notebook and can be run with Diffusers memory offload. It is not a model trained by SESMOD; SESMOD owns the application, workflow, and later any separately trained/fine-tuned components.

## Runtime

The first proof of concept is intended for a separate Kaggle GPU notebook so the existing ACE-Step music notebook is not interrupted. A Kaggle session is temporary and is not a production hosting solution.

In a fresh GPU notebook:

```bash
!pip install -r https://raw.githubusercontent.com/sesmodmusic/sesmod-ai-studio-app/main/image-engine/requirements.txt
```

Set a server-side secret before starting the API:

```python
import os, secrets
os.environ["SESMOD_IMAGE_API_KEY"] = secrets.token_urlsafe(32)
os.environ["SESMOD_ALLOWED_ORIGINS"] = "https://sesmodmusic.github.io"
```

Then run from a checkout of this repository:

```bash
uvicorn image-engine.app:app --host 0.0.0.0 --port 7861
```

For Kaggle, clone the repository and run from its root, or change into the `image-engine` folder and run `uvicorn app:app --host 0.0.0.0 --port 7861`.

## API

- `GET /health` reports model readiness.
- `POST /v1/images` accepts JSON: `prompt`, optional `negative_prompt`, `width`, `height`, `steps`, `guidance_scale`, and optional `seed`.
- Protected by `Authorization: Bearer <server secret>`.

The API returns a base64 PNG for the prototype. Do not place the secret in the public website. Before enabling public users, put a trusted server-side gateway (for example a Supabase Edge Function) in front of this API, verify the user's Supabase session, enforce per-user credit/rate limits, and store output in private/public Supabase Storage according to product policy.

## Initial limits

- One image per request.
- Default resolution 768×768; allowed range 512–1024, dimensions must be multiples of 8.
- One generation at a time; a second concurrent request receives HTTP 429.
- 25 default inference steps.

## Known limitations

- This is a prototype backend, not yet connected to the public website.
- No user billing, credits, persistent queue, image storage, moderation, or production GPU deployment is implemented yet.
- GPU availability and generation time depend on the Kaggle session.
- Commercial use requires reviewing the full model license and any applicable usage restrictions.
