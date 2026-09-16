# Hosting Storage Room App

The application defaults to TCP port **5432**. Cloudflare clients still connect over normal HTTPS/443; `5432` is only the local origin port between `cloudflared` and the app.

## Temporary hosting from a Mac with Cloudflare Tunnel

For a short local test you can still run the app and `cloudflared` manually. For the current Podman setup, however, the repository also includes a small macOS helper that starts **both Compose services** and keeps the Mac itself awake while still allowing the display to switch off.

First configure a named Cloudflare Tunnel token in `.env`:

```text
CLOUDFLARE_TUNNEL_TOKEN=...
COOKIE_SECURE=1
```

Then run:

```bash
scripts/mac-stack-up.sh
```

The helper does four things:

1. starts the Podman machine if necessary;
2. runs `podman compose --profile tunnel up -d --build`;
3. starts the app and `cloudflared` containers with `restart: unless-stopped`;
4. starts `caffeinate -i -s` in the background so macOS may turn the display off without entering idle system sleep.

Check the stack with:

```bash
scripts/mac-stack-status.sh
```

Stop everything and release the keep-awake assertion with:

```bash
scripts/mac-stack-down.sh
```

This is appropriate for temporary hosting from a powered Mac. Physically closing a MacBook lid can still force sleep depending on the hardware/clamshell setup; a laptop is therefore not a replacement for the planned Pi/Proxmox host.

If you prefer a one-off Quick Tunnel instead of the Compose tunnel service, start only the app with:

```bash
podman compose up -d --build
cloudflared tunnel --url http://127.0.0.1:5432
```

In that case you can separately run `caffeinate -i -s` to prevent idle system sleep.

## Container deployment

The repository includes a `Containerfile` and `compose.yaml`.

Create local environment configuration:

```bash
cp .env.example .env
```

Set a strong `ADMIN_PASSWORD` before the first start, then run:

```bash
docker compose up -d --build
```

With Podman Compose, use the same stack directly:

```bash
podman compose up -d --build
```

The repository's `./data` directory is bind-mounted to `/data`, so an existing `data/storage-room.db` is used directly by the container. This makes upgrades and backups straightforward.

### Cloudflare Tunnel in the same compose stack

Create a named Cloudflare Tunnel and put its token in `.env`:

```text
CLOUDFLARE_TUNNEL_TOKEN=...
```

Start the optional profile:

```bash
docker compose --profile tunnel up -d --build
# or
podman compose --profile tunnel up -d --build
```

Configure the tunnel's public hostname in Cloudflare to use this service URL:

```text
http://storage-room-app:5432
```

Do not commit `.env` or a tunnel token.

## Proxmox / small home server

A small x86 mini PC with Proxmox is a good long-term host for this application plus home automation and other services. A clean split is:

```text
Proxmox
├── Home Assistant OS VM
├── Debian LXC or small Debian VM
│   ├── Storage Room App container
│   ├── cloudflared container
│   └── other small web services
└── optional additional VMs/LXCs
```

Keep Home Assistant OS in its own VM instead of installing unrelated services inside Home Assistant. Run Storage Room App in a separate Debian LXC/VM. This keeps updates, backups and failures isolated.

The app itself has very low server-side requirements: static files, a small Python HTTP service and SQLite. The SVG room and shelf visualizations are rendered in the client browser, so the host does not need a GPU.

## Backups

At minimum back up `storage-room.db`. SQLite uses WAL mode, so for a consistent online backup prefer SQLite's backup command/API or stop the application briefly before copying all database files. A simple low-traffic maintenance backup can be:

```bash
podman compose stop storage-room-app
cp data/storage-room.db data/storage-room.db.backup
podman compose start storage-room-app

# Docker Compose users can substitute `docker compose` for `podman compose`.
```

For Proxmox, also use scheduled VM/LXC snapshots/backups, but keep an application/database backup as a second layer.
