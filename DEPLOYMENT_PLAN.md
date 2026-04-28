# Deployment Plan — `allocation-agent-workflow-service`

This document proposes how to host the
[`allocation-agent-workflow-service`](https://github.com/IamJasonBian/allocation-agent-workflow-service)
Celery pipeline on **Render**, informed by reading
[`tests/test_apply_node.py`](https://github.com/IamJasonBian/allocation-agent-workflow-service/blob/main/tests/test_apply_node.py).

> Status: planning only. No infra committed yet.

---

## What the test tells us

`tests/test_apply_node.py` pins the subprocess contract for
`allocation_agent.tasks.apply._run_node_agent`:

| Test | What it asserts |
|---|---|
| `test_node_timeout` | `subprocess.TimeoutExpired` → `status="error"`, message contains `"timed out"` |
| `test_node_empty_stdout` | empty stdout → `status="error"`, message contains `"empty"` |
| `test_node_non_json_stdout` | non-JSON stdout → `status="error"`, message contains `"non-json"` |
| `test_node_valid_json` | well-formed JSON line → fields parsed into the result schema |

Implication for deployment: the worker container **must ship both Python
and Node**, because the Python task shells out to a Node agent via
`subprocess.run`. This rules out Render's Python-only auto-detected
runtime; we need a Dockerfile.

---

## Target architecture on Render

| Component | Render primitive | Notes |
|---|---|---|
| Celery worker(s) — `select`, `apply`, `feedback` | **Background Worker** | One service per queue (or one worker with `-Q select,apply,feedback`). Built from a multi-stage Dockerfile that includes Python 3.11 (via `uv`) **and** Node. |
| Celery beat (if scheduled tasks are added) | **Background Worker** | Single replica only. |
| Redis broker | **Render Key Value** (managed Redis) | Paid plan recommended. Free tier is 25 MB / ephemeral — OK for dev, not prod. Alternative: self-host Redis as a **Private Service**. |
| Flower dashboard | **Web Service** | Login/password via Flower's built-in `--basic-auth=$FLOWER_USER:$FLOWER_PASS`. No reverse proxy needed. |
| Public API (FastAPI/Flask, when added) | **Web Service** | Public, no auth — per current scope. |
| Feedback store | **Postgres** (recommended) or persistent disk + SQLite | SQLite + multiple worker replicas will corrupt. Move to Render Postgres now to avoid a later migration. |

### Network topology

```
                        ┌──────────────────────────┐
   Internet ──HTTPS────▶│  Web Service: API        │── public, open
                        │  (FastAPI / Flask)       │
                        └────────────┬─────────────┘
                                     │ enqueue
                                     ▼
                        ┌──────────────────────────┐
                        │  Render Key Value (Redis)│
                        └────────────┬─────────────┘
                                     │ broker
                ┌────────────────────┼────────────────────┐
                ▼                    ▼                    ▼
        ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
        │ Worker:     │      │ Worker:     │      │ Worker:     │
        │ select      │      │ apply       │      │ feedback    │
        │ (py+node)   │      │ (py+node)   │      │ (py+node)   │
        └─────────────┘      └──────┬──────┘      └──────┬──────┘
                                    │ subprocess         │
                                    ▼                    ▼
                            ┌──────────────┐     ┌──────────────┐
                            │ node_agent/  │     │ Render       │
                            │ (in-image)   │     │ Postgres     │
                            └──────────────┘     └──────────────┘

   Internet ──HTTPS──▶ Web Service: Flower (basic auth) ──▶ Redis
```

---

## Auth model (per current scope)

- **Dashboard (Flower)**: HTTP Basic Auth via Flower's built-in flag.
  Single shared `FLOWER_USER` / `FLOWER_PASS` env vars on the Web
  Service. Acceptable over Render's HTTPS for an MVP; not session-based,
  so don't reuse the password elsewhere.
- **API endpoints**: open. No auth, no rate-limiting yet. Revisit before
  any non-trivial usage.

---

## Dockerfile sketch (worker + Flower share this image)

```dockerfile
FROM python:3.11-slim AS base

# Node for the apply subprocess
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates gnupg \
 && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
 && apt-get install -y nodejs \
 && rm -rf /var/lib/apt/lists/*

# uv for Python deps
RUN pip install --no-cache-dir uv

WORKDIR /app
COPY pyproject.toml uv.lock* ./
RUN uv sync --frozen --no-dev

COPY src/ ./src/
COPY node_agent/ ./node_agent/
RUN cd node_agent && npm ci --omit=dev

ENV PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/src

# Default command overridden per Render service
CMD ["uv", "run", "celery", "-A", "allocation_agent.celery_app", "worker", "-Q", "select,apply,feedback", "--loglevel=info"]
```

---

## `render.yaml` sketch

```yaml
services:
  - type: worker
    name: allocation-worker
    runtime: docker
    dockerfilePath: ./Dockerfile
    plan: standard
    envVars:
      - key: REDIS_URL
        fromService: { type: keyvalue, name: allocation-redis, property: connectionString }
      - key: DATABASE_URL
        fromDatabase: { name: allocation-db, property: connectionString }
    dockerCommand: uv run celery -A allocation_agent.celery_app worker -Q select,apply,feedback --loglevel=info

  - type: web
    name: allocation-flower
    runtime: docker
    dockerfilePath: ./Dockerfile
    plan: starter
    envVars:
      - key: REDIS_URL
        fromService: { type: keyvalue, name: allocation-redis, property: connectionString }
      - key: FLOWER_USER
        sync: false
      - key: FLOWER_PASS
        sync: false
    dockerCommand: uv run celery -A allocation_agent.celery_app flower --port=$PORT --basic-auth=$FLOWER_USER:$FLOWER_PASS

databases:
  - name: allocation-db
    plan: basic-256mb

keyValue:
  - name: allocation-redis
    plan: starter
    ipAllowList: []
```

---

## Tradeoffs and alternatives

- **Render** — simplest path; one platform; managed Redis + Postgres; no
  scale-to-zero on workers, so you pay while idle. Recommended for now.
- **Fly.io** — cheaper for bursty workloads (machines scale to zero),
  slightly more ops overhead.
- **Railway** — similar UX to Render, integrated Redis.
- **AWS ECS Fargate Spot** — cheapest at scale, much more setup.

## Future considerations (not in this PR)

- Browser-agent phase will likely need Chromium + 1–2 GB RAM per
  worker → Render Standard plan minimum.
- Replace Flower basic auth with proper SSO before opening the
  dashboard to non-engineers.
- Add API auth (API keys or OAuth) before exposing endpoints beyond
  trusted callers.
- Wire CI to build the Docker image and run `pytest tests/` (including
  `test_apply_node.py`) on every PR.
