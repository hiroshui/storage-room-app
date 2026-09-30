FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HOST=0.0.0.0 \
    PORT=5432 \
    STORAGE_ROOM_DB=/data/storage-room.db

RUN useradd --system --uid 10001 --create-home --home-dir /app storage-room
WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py ./
COPY static ./static
COPY templates ./templates

RUN mkdir -p /data && chown -R storage-room:storage-room /app /data
USER storage-room

EXPOSE 5432
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:5432/api/health', timeout=2).read()" || exit 1

CMD ["python", "app.py"]
