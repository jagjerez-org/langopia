"""
RunPod Serverless handler for Coqui XTTS v2 TTS.

Input:
  {
    "input": {
      "text": "Hello world",
      "language": "en",
      "speaker_wav_base64": "<optional base64 WAV for voice cloning>"
    }
  }

Output:
  {
    "audio_base64": "<base64 encoded WAV>",
    "sample_rate": 24000,
    "language": "en"
  }
"""

import os
import uuid
import base64
import io
import torch
import torchaudio
import runpod

device = "cuda" if torch.cuda.is_available() else "cpu"

SUPPORTED_LANGS = [
    "en", "es", "fr", "de", "it", "pt", "pl", "tr", "ru",
    "nl", "cs", "ar", "zh-cn", "ja", "ko", "hu", "hi",
]

# Default speaker reference (built-in)
DEFAULT_SPEAKER_WAV = None

print(f"Loading XTTS v2 on {device}...")
from TTS.api import TTS
tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(device)
print("XTTS v2 loaded!")

# Generate a short default reference clip for when no speaker_wav is provided
DEFAULT_REF = "/tmp/default_speaker.wav"
if not os.path.exists(DEFAULT_REF):
    # Use the built-in speaker embedding via tts_to_file with a dummy reference
    # XTTS v2 requires a reference audio — we'll create a minimal one
    import numpy as np
    sr = 22050
    # 1 second of silence as fallback (XTTS will use its default voice characteristics)
    silence = torch.zeros(1, sr)
    torchaudio.save(DEFAULT_REF, silence, sr)


def handler(event):
    inp = event.get("input", {})
    text = inp.get("text")
    language = inp.get("language", "en")
    speaker_b64 = inp.get("speaker_wav_base64")

    if not text:
        return {"error": "Missing 'text' field"}

    # Normalize language code
    lang = language.lower().strip()
    if lang == "zh":
        lang = "zh-cn"

    if lang not in SUPPORTED_LANGS:
        return {"error": f"Unsupported language '{lang}'. Supported: {SUPPORTED_LANGS}"}

    uid = uuid.uuid4().hex[:8]
    ref_path = None
    output_path = f"/tmp/out_{uid}.wav"

    try:
        # Handle speaker reference
        if speaker_b64:
            ref_path = f"/tmp/ref_{uid}.wav"
            with open(ref_path, "wb") as f:
                f.write(base64.b64decode(speaker_b64))
        else:
            ref_path = DEFAULT_REF

        # Generate speech with XTTS v2
        tts.tts_to_file(
            text=text,
            speaker_wav=ref_path,
            language=lang,
            file_path=output_path,
        )

        # Read and encode output
        with open(output_path, "rb") as f:
            audio_b64 = base64.b64encode(f.read()).decode("utf-8")

        return {
            "audio_base64": audio_b64,
            "sample_rate": 24000,
            "language": lang,
        }

    except Exception as e:
        return {"error": str(e)}

    finally:
        if speaker_b64 and ref_path and os.path.exists(ref_path):
            os.remove(ref_path)
        if os.path.exists(output_path):
            os.remove(output_path)


runpod.serverless.start({"handler": handler})
