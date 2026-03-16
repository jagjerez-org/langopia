"""
Local XTTS v2 server for development (no RunPod, no API key needed).

Exposes the same XTTS v2 model as an HTTP endpoint.
Accepts JSON {text, language} and returns JSON {audio_base64, sample_rate, language}.

Usage:
    pip install TTS fastapi uvicorn torch torchaudio
    python local_server.py

Set LOCAL_TTS_URL=http://localhost:8020/tts in your .env
"""

import os
import uuid
import base64

import torch
import torchaudio
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

device = "cuda" if torch.cuda.is_available() else "cpu"

SUPPORTED_LANGS = [
    "en", "es", "fr", "de", "it", "pt", "pl", "tr", "ru",
    "nl", "cs", "ar", "zh-cn", "ja", "ko", "hu", "hi",
]

print(f"Loading XTTS v2 on {device}...")
from TTS.api import TTS  # noqa: E402

tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(device)
print("XTTS v2 loaded!")

# Default speaker reference
DEFAULT_REF = "/tmp/default_speaker.wav"
if not os.path.exists(DEFAULT_REF):
    silence = torch.zeros(1, 22050)
    torchaudio.save(DEFAULT_REF, silence, 22050)

app = FastAPI(title="XTTS v2 Local Server")


class TTSRequest(BaseModel):
    text: str
    language: str = "en"


class TTSResponse(BaseModel):
    audio_base64: str
    sample_rate: int
    language: str


@app.post("/tts", response_model=TTSResponse)
def synthesize(req: TTSRequest):
    lang = req.language.lower().strip()
    if lang == "zh":
        lang = "zh-cn"
    if lang not in SUPPORTED_LANGS:
        raise HTTPException(400, f"Unsupported language '{lang}'. Supported: {SUPPORTED_LANGS}")

    uid = uuid.uuid4().hex[:8]
    output_path = f"/tmp/xtts_out_{uid}.wav"

    try:
        tts.tts_to_file(
            text=req.text,
            speaker_wav=DEFAULT_REF,
            language=lang,
            file_path=output_path,
        )
        with open(output_path, "rb") as f:
            audio_b64 = base64.b64encode(f.read()).decode("utf-8")

        return TTSResponse(audio_base64=audio_b64, sample_rate=24000, language=lang)
    finally:
        if os.path.exists(output_path):
            os.remove(output_path)


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", "8020"))
    print(f"Starting XTTS v2 local server on port {port}...")
    uvicorn.run(app, host="0.0.0.0", port=port)
