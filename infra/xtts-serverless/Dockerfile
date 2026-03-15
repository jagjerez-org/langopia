FROM nvidia/cuda:12.1.0-cudnn8-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
ENV HF_HOME=/cache
# Accept Coqui TOS
ENV COQUI_TOS_AGREED=1

# System deps
RUN apt-get update && apt-get install -y \
    python3 python3-pip python3-venv git ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Python deps — install TTS (Coqui XTTS v2) + RunPod SDK
RUN pip3 install --no-cache-dir \
    "transformers>=4.33.0,<4.41.0" \
    TTS \
    runpod \
    torchaudio

WORKDIR /app

# Pre-download XTTS v2 model during build so cold starts are fast
RUN python3 -c "from TTS.api import TTS; TTS('tts_models/multilingual/multi-dataset/xtts_v2')" || true

COPY infra/xtts-serverless/handler.py /app/handler.py

CMD ["python3", "handler.py"]
