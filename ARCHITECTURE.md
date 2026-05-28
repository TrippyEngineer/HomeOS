# HomeOS — System Architecture

> A WhatsApp-style group chat for households where an AI agent silently extracts grocery intents from family conversation, auto-builds a shared cart, parses Instagram recipe reels, and triggers Swiggy Instamart orders.

**Status:** End-to-end working POC. FastAPI + MongoDB backend. React frontend. AI via Claude Sonnet (Anthropic, primary) with automatic Grok (xAI) fallback. Real-time chat over Server-Sent Events. Swiggy checkout runs in demo mode pending partner OAuth credentials; direct MAPI integration via session cookies is implemented and functional within session windows.

---

## 1. High-level architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Browser / PWA                               │
│                                                                     │
│   Landing · Auth · Chat · Cart · Overview · Meals · Pantry · Cook  │
│                     React 19 + Tailwind + Shadcn UI                 │
└────────────────────┬──────────────────────────────┬────────────────┘
                     │ HTTPS + JWT Bearer            │ EventSource (SSE)
                     │ REST JSON                     │ ?token=<jwt>
                     ▼                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    FastAPI Backend  :8000                           │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                   API Router (/api/*)                       │   │
│  │  auth · household · family · pantry · meal_plan · cook ·   │   │
│  │  chat · cart · recipes · swiggy                             │   │
│  └───────────────────────────┬─────────────────────────────────┘   │
│                               │                                     │
│  ┌────────────────────────────▼────────────────────────────────┐   │
│  │               Chat Orchestrator (per message)               │   │
│  │                                                             │   │
│  │   1. InstagramAgent  ── detects IG URL → scrape → recipe   │   │
│  │   2. ChatAgent       ── Jarvis reply + grocery extraction   │   │
│  │   3. CartProposerAgent ── auto-proposes cart at ≥4 items    │   │
│  └───────────┬──────────────────────────────────┬─────────────┘   │
│               │                                  │                  │
│  ┌────────────▼──────────┐   ┌───────────────────▼──────────────┐ │
│  │  llm_call()           │   │  Broadcaster (in-memory SSE)     │ │
│  │                       │   │  household_id → [Queue, ...]     │ │
│  │  Claude (primary)     │   │  heartbeat every 20s             │ │
│  │       ↓ on any error  │   └──────────────────────────────────┘ │
│  │  Grok (fallback)      │                                         │
│  └───────────────────────┘                                         │
└───────┬───────────────────────────────────────────────────┬────────┘
        │                                                   │
        ▼                                                   ▼
┌────────────────────┐    ┌──────────────┐    ┌────────────────────────┐
│  MongoDB           │    │  Anthropic   │    │  Swiggy Instamart      │
│                    │    │  Claude API  │    │                        │
│  users             │    │  (primary)   │    │  SwiggyMAPIClient      │
│  households        │    │              │    │  → /api/instamart/     │
│  family_members    │    └──────────────┘    │    search/suggest-     │
│  pantry            │    ┌──────────────┐    │    items/v2            │
│  meal_plans        │    │  xAI Grok    │    │  → /mapi/instamart/    │
│  chat_messages     │    │  (fallback)  │    │    cart/add            │
│  carts             │    │  OpenAI-     │    │  → /mapi/instamart/    │
│  recipes           │    │  compatible  │    │    order/place         │
│  swiggy_tokens     │    └──────────────┘    │                        │
└───���────────────────┘                        │  OAuth MCP (pending    │
                                              │  partner credentials)  │
                          ┌──────────────┐    └────────────────────────┘
                          │  Instagram   │
                          │  (public)    │
                          │  instaloader │
                          │  + embed     │
                          │  fallback    │
                          └──────────────┘
```

---

## 2. Components

### 2.1 Frontend

- **Stack:** React 19, React Router 7, Tailwind CSS 3, Shadcn UI, Axios, lucide-react
- **Design system:** Display font = `Fraunces` (variable serif), body = `Figtree`, mono = `JetBrains Mono`. Color palette: warm base `#F5F1EA` + deep sage `#3B5A3F` + terracotta `#C0512A` + saffron `#E89A36` + near-black ink `#1A1F1B`
- **Auth:** JWT persisted in `localStorage.homeos_token`. `AuthContext` rehydrates on mount via `GET /api/auth/me`. Axios interceptor attaches `Authorization: Bearer <token>` on every request; 401 responses purge token and redirect to `/login`
- **Real-time:** `ChatPage` opens `EventSource(/api/chat/stream?token=...)` on mount. JWT passed as query param because `EventSource` cannot set custom headers. Automatic polling fallback (`GET /api/chat/since?after=<iso>` every 4s) if SSE errors
- **Routes:** `/` landing · `/login` · `/register` · `/app` (chat) · `/app/cart` · `/app/overview` · `/app/meals` · `/app/pantry` · `/app/cook` · `/app/family`
- **Mobile-first:** sidebar collapses to top + bottom nav on mobile. Chat uses `100dvh`. `env(safe-area-inset-*)` handles iOS notch
- **Swiggy connect UI** (`CartPage.jsx`): full connect/disconnect flow with `SwiggyConnectBanner` and `SwiggyTokenModal`. Detects connection status from `GET /api/swiggy/status` and switches checkout button label accordingly

### 2.2 Backend

- **Stack:** Python 3.11, FastAPI, Motor (async MongoDB), PyJWT, bcrypt, sse-starlette, anthropic SDK, openai SDK (for Grok), instaloader, httpx
- **Process model:** single uvicorn process. `uvicorn server:app --reload --port 8000` for dev
- **Routes:** all prefixed `/api`. No route versioning in POC — `/api/v2` planned for production
- **Auth:** JWT HS256, 7-day expiry. `JWT_SECRET` from env — raises `ValueError` at startup if unset. Passwords hashed with bcrypt (cost 12). Token payload: `{user_id, household_id, exp, iat}`
- **Multi-tenancy:** every MongoDB collection is keyed by `household_id`. All queries hard-filter by it

### 2.3 LLM abstraction

All AI calls flow through a single `llm_call(system, prompt, max_tokens)` function:

```python
async def llm_call(system: str, prompt: str, max_tokens: int = 1024) -> str:
    # 1. Try Claude (Anthropic)
    if ANTHROPIC_KEY:
        try:
            resp = await _anthropic_client.messages.create(...)
            return resp.content[0].text
        except Exception as e:
            logger.warning(f"Claude failed ({e}), falling back to Grok")
    # 2. Fallback: Grok (xAI, OpenAI-compatible)
    if _grok_client:
        resp = await _grok_client.chat.completions.create(...)
        return resp.choices[0].message.content
    # 3. Neither available
    raise RuntimeError("No LLM configured — set ANTHROPIC_API_KEY or XAI_API_KEY")
```

**Six call sites:** (a) Jarvis chat decision, (b) grocery intent extraction, (c) Instagram caption → recipe, (d) weekly meal plan, (e) cook handover notes, (f) cart-from-chat smart builder.

Model and fallback model are both configurable via env vars (`LLM_MODEL`, `GROK_MODEL`). Zero code changes to switch models.

### 2.4 Database (MongoDB)

Single database (`homeos`), nine collections. All documents use a UUIDv4 string `id` field (separate from MongoDB's `_id`, which is excluded from all API responses).

| Collection | Key fields |
|---|---|
| `users` | id, name, email (unique), password_hash, household_id, color, created_at |
| `households` | id, name, invite_code (8-char hex, rotatable), owner_id, created_at |
| `family_members` | id, household_id, name, role, diet, allergies[], preferences |
| `pantry` | id, household_id, name, qty, unit, category, low_threshold, updated_at |
| `meal_plans` | id, household_id, date (YYYY-MM-DD), breakfast/lunch/dinner objects |
| `chat_messages` | id, household_id, sender_id, sender_name, sender_color, role, content, created_at + role-specific fields (cart_id, recipe_id, recipe_title, ingredients_count) |
| `carts` | id, household_id, status (draft/ordered), items[], swiggy_order_id, estimated_total, eta_minutes, mocked (bool) |
| `recipes` | id, household_id, title, ingredients[], steps[], thumbnail, source_url, source_owner, created_at |
| `swiggy_tokens` | household_id, access_token (cookie string or OAuth token), saved_at |

### 2.5 Chat orchestration

Three agents run sequentially per inbound user message in `send_chat`:

**1. InstagramAgent** (`_process_instagram_link`)
- Regex-detects Instagram URLs in message content
- Dual-tier scrape: `instaloader` anonymous fetch (primary) → public embed page HTML parse (fallback)
- LLM extracts `{is_recipe, title, cuisine, servings, ingredients[], steps[], summary}` as strict JSON
- Persists to `recipes`, adds ingredients to draft cart, posts `role="recipe"` chat card
- Fail-soft: if both tiers fail, posts a friendly message asking user to paste the recipe text

**2. ChatAgent** (`_run_jarvis`)
- Single LLM call with full household context: family profiles, pantry state, low-stock items, today's meal plan, last 10 chat messages
- Returns strict JSON: `{should_reply: bool, reply: str, extracted_items: [{name, qty}]}`
- Extracted items are added to the draft cart silently. Reply posted only if `should_reply=true`
- Understands Hinglish naturally ("khatam ho gaya", "kal laana", "thoda sa")

**3. CartProposerAgent**
- Triggers when draft cart reaches ≥4 items
- Posts a `role="cart_proposal"` message with a deep link to `/app/cart`
- Idempotent: won't spam — one proposal per threshold crossing

After each agent step, the new message is `await broadcaster.publish(household_id, message)` — delivered to all SSE subscribers for that household in real time.

### 2.6 Real-time channel

- **Transport:** Server-Sent Events (`text/event-stream`) via `sse-starlette`. Chosen over WebSockets — works through any HTTP proxy without `Upgrade` configuration
- **Broadcaster:** in-memory `Dict[household_id, Set[asyncio.Queue]]` in `broadcaster.py`. Each connected client owns one queue (capacity 200; oldest message dropped on overflow)
- **Heartbeat:** server emits a `ping` event every 20s of idle to keep reverse proxies from closing the connection
- **Auth:** JWT passed as `?token=...` query param (EventSource API does not support custom headers). Validated server-side before subscribing
- **Failure mode:** frontend falls back to polling `GET /api/chat/since?after=<iso>` every 4s automatically on SSE error

### 2.7 Instagram ingestion

- **Primary:** `instaloader` anonymous fetch — extracts full caption, thumbnail URL, video URL. Works for ~70% of public posts outside rate-limit windows
- **Fallback:** plain HTTPS scrape of `https://www.instagram.com/p/{shortcode}/embed/captioned/` — parses `og:description` (caption) and `og:image` (thumbnail). Works on a much wider IP range
- **LLM extraction:** Claude returns structured recipe JSON with ingredients and steps. Non-recipe posts (`is_recipe: false`) are silently ignored
- **Fail-soft:** pipeline never raises — any failure posts a friendly "couldn't read that reel" message

### 2.8 Swiggy Instamart integration

Three-tier checkout cascade:

```
POST /api/cart/{id}/checkout
         │
         ├─ swiggy_token stored?
         │         │
         │    YES   └─► SwiggyMAPIClient(cookie_string)
         │               │
         │               ├─ GET /api/instamart/search/suggest-items/v2?query=...
         │               ├─ POST /mapi/instamart/cart/add
         │               ├─ POST /mapi/instamart/order/place (COD)
         │               │
         │           success → real order, mocked=False
         │           failure → falls through ↓
         │
         └─ Mock fallback
              _mock_swiggy_price() lookup
              Fake SWGY-XXXX order ID
              Random 15–35 min ETA
              ₹29 delivery fee under ₹500
              mocked=True
```

**Cookie-based mode:** User pastes their browser session cookies (copied from Chrome DevTools → Network → Request Headers → `cookie:`). The cookie string must include `tid` (auth JWT, ~40 min TTL) and `aws-waf-token` (~1 hr TTL). Backend uses these verbatim in HTTPS requests to Swiggy's internal MAPI.

**Known limitation:** AWS WAF detects Python's TLS fingerprint and returns empty `202 Accepted` responses after the WAF token expires. This limits the cookie-based approach to ~30–60 min sessions. The production fix is Swiggy Partner OAuth credentials.

**OAuth mode:** When `SWIGGY_CLIENT_ID` + `SWIGGY_CLIENT_SECRET` are set, `GET /api/swiggy/auth` redirects to Swiggy OAuth, callback exchanges code for token, and `SwiggyMCPClient` uses the Bearer token against `mcp.swiggy.com`. This is the correct production path.

---

## 3. Environment & secrets

| Variable | File | Required | Notes |
|---|---|---|---|
| `MONGO_URL` | `backend/.env` | Yes | MongoDB connection string |
| `DB_NAME` | `backend/.env` | Yes | Database name |
| `JWT_SECRET` | `backend/.env` | **Yes** | HS256 signing key — startup fails without it |
| `ANTHROPIC_API_KEY` | `backend/.env` | Yes | Claude API key (primary LLM) |
| `XAI_API_KEY` | `backend/.env` | No | Grok API key (automatic fallback) |
| `LLM_MODEL` | `backend/.env` | No | Claude model (default: `claude-sonnet-4-5-20250929`) |
| `GROK_MODEL` | `backend/.env` | No | Grok model (default: `grok-3-mini`) |
| `SWIGGY_CLIENT_ID` | `backend/.env` | No | Swiggy partner OAuth client ID |
| `SWIGGY_CLIENT_SECRET` | `backend/.env` | No | Swiggy partner OAuth secret |
| `CORS_ORIGINS` | `backend/.env` | No | Comma-separated origins (default: `*`) |
| `REACT_APP_BACKEND_URL` | `frontend/.env` | Yes | Backend base URL |

No secrets are hardcoded in source. All values loaded via `os.environ.get()` (Python) or `process.env.REACT_APP_*` (React). See `.env.example` for annotated template.

---

## 4. Local dev runbook

```bash
# 1. MongoDB
docker run -d --name homeos-mongo -p 27017:27017 mongo:7

# 2. Backend
cp .env.example backend/.env
# → fill in JWT_SECRET and ANTHROPIC_API_KEY
pip install -r backend/requirements.txt
cd backend && uvicorn server:app --reload --port 8000

# 3. Frontend (Linux/Mac)
cp .env.example frontend/.env  # already has REACT_APP_BACKEND_URL=http://localhost:8000
cd frontend && yarn install && yarn start

# 3. Frontend (WSL — run from Linux FS to avoid EPERM on node_modules)
cp -r frontend ~/frontend_homeos
cd ~/frontend_homeos
echo "REACT_APP_BACKEND_URL=http://localhost:8000" > .env
yarn install && yarn start

# Smoke tests
curl http://localhost:8000/api/          # {"app":"HomeOS","status":"ok"}
curl http://localhost:3000               # React app
```

---

## 5. REST API reference

All routes are prefixed `/api`. Authentication is `Authorization: Bearer <jwt>` unless marked public.

### Auth (public)

| Method | Path | Body |
|---|---|---|
| POST | `/auth/register` | `{name, email, password, household_name?}` |
| POST | `/auth/join` | `{name, email, password, invite_code}` |
| POST | `/auth/login` | `{email, password}` |
| GET | `/auth/me` | — (auth required) |

### Household

| Method | Path | Notes |
|---|---|---|
| GET | `/household` | Returns `{household, members[]}` |
| POST | `/household/rotate-invite` | Regenerates 8-char invite code |

### Chat

| Method | Path | Notes |
|---|---|---|
| GET | `/chat/history?limit=200` | Full history, oldest first |
| GET | `/chat/since?after=<iso>` | Polling fallback |
| GET | `/chat/stream?token=<jwt>` | **SSE** real-time stream |
| POST | `/chat` | `{content}` — sends message, runs orchestrator |
| DELETE | `/chat/history` | Clears household chat |

### Cart

| Method | Path | Notes |
|---|---|---|
| GET | `/cart` | Active draft cart |
| GET | `/cart/all` | History (last 20) |
| POST | `/cart/item` | Manual add `{name, qty}` |
| PUT | `/cart/item/{id}` | Edit item |
| DELETE | `/cart/item/{id}` | Remove item |
| DELETE | `/cart/clear` | Empty cart |
| POST | `/cart/from-chat` | Rebuild draft from recent messages (LLM) |
| POST | `/cart/{id}/checkout` | Place order — real Swiggy or demo mode |

### Swiggy

| Method | Path | Notes |
|---|---|---|
| GET | `/swiggy/status` | `{connected, client_configured, message}` |
| POST | `/swiggy/set-token` | `{token}` — save browser cookie string |
| GET | `/swiggy/auth` | Redirect to Swiggy OAuth (requires `SWIGGY_CLIENT_ID`) |
| GET | `/swiggy/callback` | OAuth callback — exchanges code, stores token |
| DELETE | `/swiggy/disconnect` | Remove stored token |

### Recipes

| Method | Path | Notes |
|---|---|---|
| GET | `/recipes` | Last 50 recipes |
| GET | `/recipes/{id}` | Full recipe with ingredients + steps |

### Family / Pantry / Meals / Cook

Standard CRUD endpoints. See `server.py` sections "Family", "Pantry", "Meal plan" for full signatures. Key AI endpoints:

| Method | Path | Notes |
|---|---|---|
| POST | `/ai/generate-weekly-plan` | Generates 7-day meal plan (LLM) |
| POST | `/ai/cook-instructions` | Generates cook handover note for today (LLM) |

---

## 6. Roadmap

### P0 — Next sprint
- Swiggy Partner API credentials → real orders end-to-end
- Item-level price preview before checkout
- WhatsApp Business API surface (replace web chat)

### P1 — Quarter 1
- Recurring "Saturday cart" auto-fill from past order history
- Voice message support (Whisper transcription)
- Recipe ledger page with search and filtering
- Pantry auto-decrement when Swiggy order delivers
- PWA push notifications (service worker)

### P2 — Quarter 2
- Multi-household management (manage parents' home remotely)
- Cook handover via WhatsApp deep-link (one tap)
- Multi-vendor routing: Blinkit / Zepto / BigBasket fallback
- Elderly parent simplified interface

---

*Last updated: May 2026*
