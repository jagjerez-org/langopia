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
import subprocess

import torch
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

device = "cuda" if torch.cuda.is_available() else "cpu"

SUPPORTED_LANGS = [
    "en", "es", "fr", "de", "it", "pt", "pl", "tr", "ru",
    "nl", "cs", "ar", "zh-cn", "ja", "ko", "hu", "hi",
]

# Built-in XTTS v2 speaker used when no custom speaker_wav is provided.
DEFAULT_SPEAKER = "Ana Florence"

print(f"Loading XTTS v2 on {device}...")
from TTS.api import TTS  # noqa: E402

tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(device)
print("XTTS v2 loaded!")

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
    wav_path = f"/tmp/xtts_out_{uid}.wav"
    mp3_path = f"/tmp/xtts_out_{uid}.mp3"

    try:
        # Use built-in XTTS speaker (no speaker_wav needed)
        tts.tts_to_file(
            text=req.text,
            speaker=DEFAULT_SPEAKER,
            language=lang,
            file_path=wav_path,
        )

        # Convert WAV → MP3 so the stored content-type matches the data
        subprocess.run(
            ["ffmpeg", "-y", "-i", wav_path, "-codec:a", "libmp3lame", "-b:a", "128k", mp3_path],
            check=True,
            capture_output=True,
        )

        with open(mp3_path, "rb") as f:
            audio_b64 = base64.b64encode(f.read()).decode("utf-8")

        return TTSResponse(audio_base64=audio_b64, sample_rate=24000, language=lang)
    finally:
        for p in [wav_path, mp3_path]:
            if os.path.exists(p):
                os.remove(p)


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", "8020"))
    print(f"Starting XTTS v2 local server on port {port}...")
    uvicorn.run(app, host="0.0.0.0", port=port)
