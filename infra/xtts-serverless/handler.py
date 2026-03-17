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
    "audio_base64": "<base64 encoded MP3>",
    "sample_rate": 24000,
    "language": "en"
  }
"""

import os
import uuid
import base64
import subprocess
import torch
import runpod

# PyTorch 2.6+ defaults weights_only=True which breaks XTTS model loading.
# Patch torch.load to allow unsafe deserialization (trusted model source).
_original_torch_load = torch.load
torch.load = lambda *args, **kwargs: _original_torch_load(
    *args, **{**kwargs, "weights_only": False}
)

# torchaudio.set_audio_backend() removed in torchaudio >= 2.1
# soundfile is installed as a dependency — torchaudio auto-detects it
import torchaudio

device = "cuda" if torch.cuda.is_available() else "cpu"

SUPPORTED_LANGS = [
    "en", "es", "fr", "de", "it", "pt", "pl", "tr", "ru",
    "nl", "cs", "ar", "zh-cn", "ja", "ko", "hu", "hi",
]

# Built-in XTTS v2 speaker used when no custom speaker_wav is provided.
# "Ana Florence" is a multilingual female speaker bundled with the model.
DEFAULT_SPEAKER = "Ana Florence"

print(f"Loading XTTS v2 on {device}...")
from TTS.api import TTS
tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(device)
print("XTTS v2 loaded!")


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
    wav_path = f"/tmp/out_{uid}.wav"
    mp3_path = f"/tmp/out_{uid}.mp3"

    try:
        # Generate speech with XTTS v2
        if speaker_b64:
            ref_path = f"/tmp/ref_{uid}.wav"
            with open(ref_path, "wb") as f:
                f.write(base64.b64decode(speaker_b64))
            tts.tts_to_file(
                text=text,
                speaker_wav=ref_path,
                language=lang,
                file_path=wav_path,
            )
        else:
            # Use built-in XTTS speaker (no speaker_wav needed)
            tts.tts_to_file(
                text=text,
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

        return {
            "audio_base64": audio_b64,
            "sample_rate": 24000,
            "language": lang,
        }

    except Exception as e:
        return {"error": str(e)}

    finally:
        for p in [ref_path, wav_path, mp3_path]:
            if p and os.path.exists(p):
                os.remove(p)


runpod.serverless.start({"handler": handler})
