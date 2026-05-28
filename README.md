# HomeOS

**AI household orchestration for Indian families.**

A WhatsApp-style group chat where family members talk the way they always do — HomeOS silently listens, extracts grocery needs in Hinglish, builds a shared cart, parses Instagram recipe reels, generates weekly meal plans, and triggers Swiggy Instamart orders.

**Status:** Fully functional end-to-end POC. Swiggy checkout runs in demo mode pending partner API credentials.

---

## What it does

| Feature | Description |
|---|---|
| **Group chat** | Multiple family members in one household, each with a stable bubble color (WhatsApp-style) |
| **Jarvis AI** | Observes every message, understands Hinglish ("khatam ho gaya", "kal laana"), silently extracts grocery intent |
| **Smart cart** | Auto-proposed when 4+ items accumulate; manually editable; one-tap Swiggy Instamart checkout |
| **Instagram recipes** | Paste a reel URL → HomeOS extracts ingredients + steps → adds to cart |
| **Weekly meal plan** | AI-generated 7-day plan respecting family diets, allergies, and preferences |
| **Cook handover** | WhatsApp-ready daily instructions with quantities, locations, and dietary notes |
| **Pantry tracker** | Stock levels with low-item alerts |
| **Family profiles** | Roles, diets, allergies — Jarvis personalises every suggestion around them |

---

## Quick start

### Prerequisites

- Python 3.11+
- Node.js 18+ and Yarn
- MongoDB (local or Docker)
- An [Anthropic API key](https://console.anthropic.com/settings/keys) *(xAI/Grok key optional — used as automatic fallback)*

### 1. Start MongoDB

```bash
docker run -d --name homeos-mongo -p 27017:27017 mongo:7
# Web UI (optional):
docker run -d --name mongo-express -p 8081:8081 \
  -e ME_CONFIG_MONGODB_SERVER=host.docker.internal \
  mongo-express
# → http://localhost:8081
```

### 2. Backend

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp ../.env.example .env
# Open .env and fill in:
#   JWT_SECRET      — python3 -c "import secrets; print(secrets.token_hex(32))"
#   ANTHROPIC_API_KEY — from https://console.anthropic.com/settings/keys
#   XAI_API_KEY     — optional, from https://console.x.ai (Grok fallback)

# Start
uvicorn server:app --reload --port 8000
```

Smoke test:
```bash
curl http://localhost:8000/api/
# → {"app":"HomeOS","status":"ok"}
```

### 3. Frontend

> **WSL/Windows users:** Run `yarn` from a Linux filesystem path (`~/frontend_homeos/`), not from `/mnt/d/` — Windows filesystems block `chmod` on `node_modules`.

```bash
# Linux/Mac
cd frontend
echo "REACT_APP_BACKEND_URL=http://localhost:8000" > .env
yarn install && yarn start

# WSL (Windows)
cp -r /mnt/d/path/to/HomeOS/frontend ~/frontend_homeos
cd ~/frontend_homeos
echo "REACT_APP_BACKEND_URL=http://localhost:8000" > .env
yarn install && yarn start
```

App opens at **http://localhost:3000**

---

## Environment variables

All secrets live in env files. **Never hardcode keys in source.**

### Backend (`backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `MONGO_URL` | Yes | MongoDB connection string (default: `mongodb://localhost:27017`) |
| `DB_NAME` | Yes | Database name (default: `homeos`) |
| `JWT_SECRET` | **Yes** | JWT signing secret — app refuses to start without it |
| `ANTHROPIC_API_KEY` | Yes | Claude API key — primary LLM for all AI features |
| `XAI_API_KEY` | No | xAI Grok key — automatic fallback if Claude fails |
| `LLM_MODEL` | No | Claude model override (default: `claude-sonnet-4-5-20250929`) |
| `GROK_MODEL` | No | Grok model override (default: `grok-3-mini`) |
| `SWIGGY_CLIENT_ID` | No | Swiggy Partner OAuth ID — enables real Instamart orders |
| `SWIGGY_CLIENT_SECRET` | No | Swiggy Partner OAuth secret |
| `CORS_ORIGINS` | No | Comma-separated allowed origins (default: `*` in dev) |

### Frontend (`frontend/.env`)

| Variable | Required | Description |
|---|---|---|
| `REACT_APP_BACKEND_URL` | Yes | Backend base URL (e.g. `http://localhost:8000`) |

See [`.env.example`](.env.example) for a fully annotated template with comments.

> The backend raises `ValueError` at startup if `JWT_SECRET` is missing.
> If both `ANTHROPIC_API_KEY` and `XAI_API_KEY` are absent, AI endpoints return HTTP 500 but auth, chat, and cart still work.

---

## Project structure

```
HomeOS/
├── backend/
│   ├── server.py           # FastAPI app — all routes, LLM pipeline, orchestration
│   ├── orchestrator.py     # Agent pipeline contract (Instagram → Chat → CartProposer)
│   ├── broadcaster.py      # In-memory SSE pub/sub (household_id → asyncio.Queue[])
│   ├── swiggy_mcp.py       # Swiggy Instamart client (cookie-based MAPI + OAuth MCP)
│   ├── requirements.txt
│   ├── .env                # git-ignored — copy from .env.example
│   └── tests/
│       └── test_jarvis_home.py
├── frontend/
│   ├── src/
│   │   ├── lib/api.js      # Axios client — reads REACT_APP_BACKEND_URL
│   │   └── pages/          # ChatPage, CartPage, OverviewPage, MealsPage, ...
│   ├── .env                # git-ignored — set REACT_APP_BACKEND_URL
│   └── package.json
├── .env.example            # Safe-to-commit template for all env vars
├── ARCHITECTURE.md         # Full system design, data model, API reference
���── PITCH.md                # Investor pitch deck in markdown
```

---

## Key source locations

| What | File | Notes |
|---|---|---|
| LLM abstraction (`llm_call`) | `backend/server.py:74` | Claude primary, Grok fallback, single call site |
| Jarvis chat agent | `backend/server.py` | `_run_jarvis()` — extracts items + decides reply |
| Instagram recipe extractor | `backend/server.py` | `_process_instagram_link()` — dual-tier scrape + LLM |
| Cart-from-chat builder | `backend/server.py` | `POST /cart/from-chat` |
| Weekly meal plan generator | `backend/server.py` | `POST /ai/generate-weekly-plan` |
| Cook handover notes | `backend/server.py` | `POST /ai/cook-instructions` |
| Swiggy MAPI client | `backend/swiggy_mcp.py` | `SwiggyMAPIClient` — cookie auth + real search |
| Checkout endpoint | `backend/server.py` | `POST /cart/{id}/checkout` — real or demo mode |
| API client (frontend) | `frontend/src/lib/api.js` | Axios + JWT interceptor |
| Cart + Swiggy connect UI | `frontend/src/pages/CartPage.jsx` | Full connect/disconnect/checkout flow |

---

## AI stack

HomeOS uses a two-model LLM stack with automatic failover:

```
User message
     │
     ▼
llm_call(system, prompt)
     │
     ├─► Claude Sonnet (Anthropic) ─── primary
     │         HTTP 200 → return
     │         Any error →
     └─► Grok (xAI, OpenAI-compatible) ─── automatic fallback
               Returns or raises RuntimeError
```

Both models are configured entirely via environment variables. Swapping models requires no code changes.

---

## Swiggy integration

HomeOS supports two modes for Swiggy Instamart checkout:

| Mode | How | Status |
|---|---|---|
| **Demo mode** | Mock prices, fake order ID, no real order | Always available |
| **Cookie mode** | User pastes browser session cookies; HomeOS calls Swiggy's MAPI directly | Works within ~30 min session window; blocked by AWS WAF on longer sessions |
| **OAuth mode** | Swiggy Partner credentials (`SWIGGY_CLIENT_ID` + `SWIGGY_CLIENT_SECRET`) | Production path — apply at [partner.swiggy.com](https://partner.swiggy.com) |

The checkout endpoint automatically selects the best available mode. All three share the same response contract — the UI shows a `[DEMO]` badge only in demo mode.

---

## Running tests

```bash
cd backend
# Ensure backend is running on localhost:8000
pytest tests/test_jarvis_home.py -v
```

---

## Tech stack

| Layer | Technology |
|---|---|
| Backend | Python 3.11, FastAPI, Motor (async MongoDB), PyJWT, bcrypt |
| AI — primary | Anthropic Claude via `anthropic` SDK (`AsyncAnthropic`) |
| AI — fallback | xAI Grok via `openai` SDK (OpenAI-compatible endpoint) |
| Real-time | Server-Sent Events (`sse-starlette`), 4s polling fallback |
| Frontend | React 19, React Router 7, Tailwind CSS 3, Shadcn UI, Axios |
| Database | MongoDB 7 (Motor async driver) |
| Auth | JWT HS256, 7-day expiry, bcrypt password hashing |
| Build | craco (React), uvicorn (Python ASGI) |

---

## Further reading

- [ARCHITECTURE.md](ARCHITECTURE.md) — component diagram, data model, full API reference, SSE design
- [PITCH.md](PITCH.md) — problem, market, solution, business model, ask
- [.env.example](.env.example) — annotated environment variable reference
