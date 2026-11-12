import base64
import io
import os
import threading
from typing import Literal, Optional

import torch
from diffusers import StableDiffusionXLPipeline
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from PIL import Image

MODEL_ID = os.getenv("SESMOD_IMAGE_MODEL", "stabilityai/stable-diffusion-xl-base-1.0")
API_KEY = os.getenv("SESMOD_IMAGE_API_KEY", "")
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "SESMOD_ALLOWED_ORIGINS",
        "https://sesmodmusic.github.io"
    ).split(",")
    if origin.strip()
]

app = FastAPI(title="SESMOD AI IMAGE", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)

pipeline = None
generation_lock = threading.Lock()


class GenerateRequest(BaseModel):
    prompt: str = Field(min_length=3, max_length=1800)
    negative_prompt: str = Field(default="blurry, low quality, distorted, watermark, text artifacts", max_length=800)
    width: int = Field(default=768, ge=512, le=1024)
    height: int = Field(default=768, ge=512, le=1024)
    steps: int = Field(default=25, ge=10, le=35)
    guidance_scale: float = Field(default=6.5, ge=1.0, le=12.0)
    seed: Optional[int] = Field(default=None, ge=0, le=2**32 - 1)


@app.on_event("startup")
def load_model():
    global pipeline
    if not torch.cuda.is_available():
        raise RuntimeError("SESMOD AI IMAGE için CUDA destekli GPU gerekli.")

    dtype = torch.float16
    pipeline = StableDiffusionXLPipeline.from_pretrained(
        MODEL_ID,
        torch_dtype=dtype,
        variant="fp16",
        use_safetensors=True,
    )
    # T4 gibi sınırlı VRAM'li GPU'larda bellek taşmasını azaltır.
    pipeline.enable_model_cpu_offload()
    pipeline.enable_vae_slicing()
    pipeline.enable_vae_tiling()


@app.get("/health")
def health():
    return {
        "service": "SESMOD AI IMAGE",
        "status": "ready" if pipeline is not None else "loading",
        "model": MODEL_ID,
        "gpu": torch.cuda.get_device_name(0) if torch.cuda.is_available() else None,
    }


@app.post("/v1/images")
def generate_image(
    body: GenerateRequest,
    authorization: Optional[str] = Header(default=None),
):
    if not API_KEY:
        raise HTTPException(status_code=503, detail="Sunucu API anahtarı yapılandırılmamış.")
    if authorization != f"Bearer {API_KEY}":
        raise HTTPException(status_code=401, detail="Yetkisiz istek.")
    if pipeline is None:
        raise HTTPException(status_code=503, detail="Model henüz hazır değil.")
    if body.width % 8 or body.height % 8:
        raise HTTPException(status_code=422, detail="Genişlik ve yükseklik 8'in katı olmalı.")

    if not generation_lock.acquire(blocking=False):
        raise HTTPException(status_code=429, detail="Üretim kuyruğu dolu. Biraz sonra tekrar dene.")

    try:
        generator = None
        if body.seed is not None:
            generator = torch.Generator(device="cuda").manual_seed(body.seed)

        with torch.inference_mode():
            result = pipeline(
                prompt=body.prompt,
                negative_prompt=body.negative_prompt,
                width=body.width,
                height=body.height,
                num_inference_steps=body.steps,
                guidance_scale=body.guidance_scale,
                generator=generator,
            )

        image: Image.Image = result.images[0]
        buffer = io.BytesIO()
        image.save(buffer, format="PNG", optimize=True)
        encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
        return {
            "status": "completed",
            "model": MODEL_ID,
            "seed": body.seed,
            "width": image.width,
            "height": image.height,
            "mime_type": "image/png",
            "image_base64": encoded,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Görsel üretimi başarısız: {type(exc).__name__}")
    finally:
        generation_lock.release()
