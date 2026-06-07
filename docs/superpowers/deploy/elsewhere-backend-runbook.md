# Deploy: Elsewhere backend → the_litterbox

Stack: `~/apps/elsewhere` (postgres + api + cloudflared + pipeline). Pattern matches
grave-goods (Docker Compose + Cloudflare Tunnel, rsync from the Mac). Run from the
repo root on the Mac. Replace `LITTERBOX` with the box's ssh host alias.

## 1. Sync code to the box

```bash
rsync -av --delete \
  server/ db/ scripts/ docker-compose.yml Dockerfile.api Dockerfile.pipeline \
  --exclude node_modules --exclude '__pycache__' \
  LITTERBOX:~/apps/elsewhere/
```

(Copy each top-level path; `server/node_modules` is excluded — the image installs deps.)

## 2. Create the secrets file on the box (first time only)

```bash
ssh LITTERBOX
cd ~/apps/elsewhere
cp .env.example .env   # if you rsynced it; otherwise create .env
# edit .env: set a strong POSTGRES_PASSWORD, CORS_ORIGINS (the Pages origin),
# and TUNNEL_TOKEN from the Cloudflare tunnel for this app.
```

## 3. Bring up Postgres + API + tunnel

```bash
docker compose up -d postgres api cloudflared
```

## 4. Apply the schema

```bash
docker compose exec -T postgres psql -U elsewhere -d elsewhere < ~/apps/elsewhere/db/schema.sql
```

## 5. Populate the data (run the pipeline once)

```bash
docker compose run --rm pipeline
```

Expect the coverage line and `wrote N metros to Postgres`.

## 6. Wire the Cloudflare Tunnel hostname

In the Cloudflare dashboard → the tunnel for this app → Published application routes:
add a public hostname (e.g. `data.<your-domain>`) → service `http://api:8080`.

## 7. Verify

```bash
curl -s https://data.<your-domain>/api/health   # -> {"ok":true,"count":...,"updated_at":...}
curl -s https://data.<your-domain>/api/metros | head -c 200
```

## 8. Schedule the daily refresh (host cron on the box)

```bash
crontab -e
# daily at 04:30 — refresh gov data into Postgres
30 4 * * * cd ~/apps/elsewhere && /usr/bin/docker compose run --rm pipeline >> ~/apps/elsewhere/pipeline.log 2>&1
```

## Update later (code change)

Re-run step 1 (rsync), then `docker compose up -d --build api` (and re-run the
pipeline if the script changed). Schema changes: re-run step 4 (idempotent).
