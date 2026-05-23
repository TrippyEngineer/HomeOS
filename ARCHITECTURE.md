# HomeOS — System Architecture

> A WhatsApp-style group chat for households where an AI agent (HomeOS) silently extracts grocery intents from family chatter, auto-builds a shared cart, parses Instagram recipe reels, and triggers Swiggy Instamart orders.

**POC status:** end-to-end working web app. Backend hosted on FastAPI + MongoDB. Frontend in React. AI inference via Claude Sonnet 4.5 (Anthropic) routed through Emergent's Universal LLM gateway. Real-time chat over Server-Sent Events. Swiggy checkout currently mocked — pending API access.

---

## 1. High-level diagram

```
                                ┌──────────────────────────────────┐
                                │           Frontend (React)        │
                                │  Landing · Auth · Chat · Cart ·   │
                                │  Overview · Meals · Pantry · Cook │
                                │  Family · Recipes                 │
                                └─────────────┬────────────────────┘
                            HTTPS │                 │ EventSource (SSE)
                            JWT   │                 │ ?token=...
                                  ▼                 ▼
                          ┌───────────────────────────────────────┐
                          │      FastAPI backend (port 8001)      │
                          │  ┌──────────────────────────────────┐ │
                          │  │  Auth · Household · Family ·     │ │
                          │  │  Pantry · MealPlan · Cook ·      │ │
                          │  │  Chat · Cart · Recipes           │ │
                          │  └────────────┬──────────────────┘   │
                          │               │                       │
                          │  ┌────────────▼────────────────────┐ │
                          │  │   Chat Orchestrator (agents)     │ │
                          │  │  1. InstagramAgent (instaloader  │ │
                          │  │     + embed scrape fallback)     │ │
                          │  │  2. ChatAgent (HomeOS reply +    │ │
                          │  │     grocery extractor)           │ │
                          │  │  3. CartProposerAgent (≥4 items) │ │
                          │  └────────────┬─────────────────────┘ │
                          │               │                       │
                          │  ┌────────────▼─────────────────────┐ │
                          │  │   Broadcaster (in-memory SSE)    │ │
                          │  │   household_id → [Queue,...]     │ │
                          │  └─────┬──────────────────────────┬─┘ │
                          └────────┼──────────────────────────┼───┘
                                   │                          │
                       ┌───────────▼──────────┐    ┌──────────▼────────┐
                       │  MongoDB (motor)     │    │  Emergent LLM     │
                       │  users · households  │    │  Gateway          │
                       │  family_members      │    │  → Claude         │
                       │  pantry · meal_plans │    │   Sonnet 4.5      │
                       │  chat_messages       │    │  (anthropic)      │
                       │  carts · recipes     │    │  via              │
                       └──────────────────────┘    │  emergentintegr.  │
                                                   └───────────────────┘
                       ┌───────────────────────┐
                       │  Instagram (public)   │
                       │   instaloader →       │
                       │   /embed/captioned/   │
                       │   og:image/desc       │
                       └───────────────────────┘
                       ┌───────────────────────┐
                       │  Swiggy Instamart     │  ← MOCKED today
                       │  MCP (pending)        │     swap-in one file
                       └───────────────────────┘
```

---

## 2. Components

### 2.1 Frontend
- **Stack:** React 19, React Router 7, Tailwind 3, Shadcn UI, Axios, lucide-react.
- **Font system:** display = `Fraunces` (variable serif), body = `Figtree`, mono = `JetBrains Mono`. Imported via Google Fonts at runtime.
- **Color system:** warm earthy base (`#F5F1EA`) + deep sage primary (`#3B5A3F`) + terracotta accent (`#C0512A`) + saffron highlight (`#E89A36`) + near-black ink (`#1A1F1B`). Defined in `tailwind.config.js` and CSS vars in `src/index.css`.
- **Auth state:** persisted in `localStorage.homeos_token`; `AuthContext` rehydrates on mount via `GET /api/auth/me`.
- **API client:** Axios instance with request interceptor that attaches `Authorization: Bearer <token>`; 401 responses purge token and redirect to login.
- **Real-time:** `ChatPage` opens an `EventSource(/api/chat/stream?token=...)` on mount. SSE is preferred; polling (`/api/chat/since`) is the automatic fallback if SSE errors.
- **Routing:** `/` landing · `/login` · `/register` (create or join via invite) · `/app` (default = ChatPage) · `/app/cart` · `/app/overview` · `/app/meals` · `/app/pantry` · `/app/cook` · `/app/family`.
- **Mobile responsive:** desktop sidebar collapses into top + bottom mobile nav with `env(safe-area-inset-*)` for iOS notch. Chat uses `100dvh` to respect mobile browser chrome.

### 2.2 Backend
- **Stack:** Python 3.11, FastAPI 0.110, Motor (async MongoDB), PyJWT, bcrypt, sse-starlette, emergentintegrations, instaloader.
- **Process model:** single uvicorn process behind k8s ingress; bound to `0.0.0.0:8001` via supervisor.
- **Routes:** all prefixed with `/api`. See §5 for the full reference.
- **Auth:** JWT (HS256), 7-day expiry. `JWT_SECRET` env-only. Password hashed with bcrypt. Token contains `{user_id, household_id, exp, iat}`.
- **Multi-tenancy:** every collection is keyed by `household_id`; all queries filter by it.

### 2.3 Database (MongoDB)
Single database, eight collections. All documents have a UUIDv4 string `id` (separate from Mongo's `_id`).

| Collection | Key fields |
|---|---|
| `users` | id, name, email (unique), password_hash, household_id, color, created_at |
| `households` | id, name, invite_code (8-char hex, rotatable), owner_id, created_at |
| `family_members` | id, household_id, name, role, diet, allergies[], preferences |
| `pantry` | id, household_id, name, qty, unit, category, low_threshold, updated_at |
| `meal_plans` | id, household_id, date (YYYY-MM-DD), breakfast/lunch/dinner objects |
| `chat_messages` | id, household_id, sender_id, sender_name, sender_color, role, content, created_at + role-specific fields (cart_id, cart_items_count, recipe_id, recipe_title, recipe_thumbnail, ingredients_count, source_owner) |
| `carts` | id, household_id, status (draft/ordered), items[], swiggy_order_id, estimated_total, eta_minutes, mocked |
| `recipes` | id, household_id, title, ingredients[], steps[], thumbnail, source_url, source_owner, shared_by, created_at |

### 2.4 Orchestration layer
The chat pipeline lives in `/app/backend/orchestrator.py` (the contract) and is implemented inside `server.py` (`send_chat` + helpers). Three agents run per inbound user message:

1. **InstagramAgent** (`_process_instagram_link`) — regex-detects IG URLs, fetches caption via two-tier scrape (instaloader primary, public embed page secondary), runs Claude to extract structured recipe, persists to `recipes`, adds ingredients to draft cart, posts a `role="recipe"` chat card. Short-circuits if a recipe is found.
2. **ChatAgent** (`_run_jarvis`) — single Claude call with strict JSON output: `{should_reply, reply, extracted_items}`. Receives full household context (family, pantry, low items, today's meal plan, last 10 messages). Behavior rules (silent vs reply) live in the system prompt.
3. **CartProposerAgent** — when the draft cart grows to ≥4 items, posts a `role="cart_proposal"` message that links to `/app/cart`. Idempotent against item-count to avoid spam.

After each agent commits, the new chat message is `await broadcaster.publish(household_id, ...)`-ed to all SSE subscribers.

### 2.5 Real-time channel
- **Transport:** Server-Sent Events (`text/event-stream`) via `sse-starlette`. SSE chosen over WebSockets because it works through any HTTP proxy / k8s ingress without upgrade configuration.
- **Broadcaster:** in-memory `Dict[household_id, Set[asyncio.Queue]]` in `broadcaster.py`. Each connected client owns a queue (capacity 200, oldest dropped on overflow).
- **Heartbeat:** server emits a `ping` event every 20s of idle to keep proxies open.
- **Auth:** `EventSource` cannot set headers, so the JWT is passed as `?token=...` and validated server-side before subscribing.
- **Failure mode:** client falls back to 4s polling on `/api/chat/since?after=<iso>` automatically.

### 2.6 AI inference
- **Model:** `claude-sonnet-4-5-20250929` (Anthropic) via the Emergent Universal LLM Key gateway.
- **Library:** `emergentintegrations.llm.chat.LlmChat` — single client class for OpenAI/Anthropic/Gemini routing. New `LlmChat` instance per call (stateless; we manage history via MongoDB).
- **Use sites:** (a) ChatAgent silent-vs-reply decision, (b) Instagram caption → structured recipe, (c) weekly meal plan generation, (d) cook handover notes, (e) smart grocery list builder, (f) cart-from-chat refinement.
- **Cost / latency:** ~1.5–3s per call. Each user message in chat triggers exactly one decision call (plus one extra if it contains an IG link).
- **Key handling:** `EMERGENT_LLM_KEY` lives in `/app/backend/.env`. Loaded via `dotenv` at startup; read via `os.environ.get`. Never logged, never sent to the frontend.

### 2.7 Instagram ingestion
- **Primary:** `instaloader` anonymous fetch — extracts full caption + thumbnail + video URL. Works for ~70% of public posts when not rate-limited.
- **Fallback:** plain HTTP scrape of `https://www.instagram.com/p/{shortcode}/embed/captioned/` — parses `og:description` for caption, `og:image` for thumbnail. Slightly less data but works on a much wider IP range.
- **Recipe LLM extraction:** Claude returns `{is_recipe, title, cuisine, servings, ingredients[], steps[], summary}` strict JSON.
- **Fail-soft:** if both fetch tiers fail (private/deleted/blocked), HomeOS posts a friendly chat message inviting the user to paste the recipe text. The pipeline never crashes.

### 2.8 Swiggy Instamart (MOCKED)
- File `server.py` → `SWIGGY_PRICE_LOOKUP` dict + `_mock_swiggy_price()` returns realistic Instamart prices for ~20 common Indian staples; others get a plausible random price.
- `POST /api/cart/{id}/checkout` priced the cart, generates `SWGY-XXXX` order ID, applies ₹29 delivery fee under ₹500 (free above), random 15–35 min ETA.
- Response includes `mocked: true` flag. The system message posted to chat is suffixed `[MOCKED]`.
- **Swap plan:** drop a real Swiggy MCP client into one function; the contract is the same.

---

## 3. Environment & secrets

| Variable | Location | Purpose |
|---|---|---|
| `MONGO_URL` | `/app/backend/.env` | Mongo connection (defaults to local) |
| `DB_NAME` | `/app/backend/.env` | Database name |
| `CORS_ORIGINS` | `/app/backend/.env` | Comma-separated CORS allow-list, `*` in dev |
| `EMERGENT_LLM_KEY` | `/app/backend/.env` | Universal LLM key (sk-emergent-…) |
| `JWT_SECRET` | `/app/backend/.env` | JWT HS256 signing secret |
| `REACT_APP_BACKEND_URL` | `/app/frontend/.env` | Public preview URL for API calls |

✅ **No hardcoded keys in source.** All references are `os.environ.get(...)` (Python) or `process.env.REACT_APP_BACKEND_URL` (JS). Verified via `grep "sk-emergent" /app/{backend,frontend/src}` returning zero hits in code.

---

## 4. Local dev / runbook

```bash
# Backend
sudo supervisorctl restart backend
tail -f /var/log/supervisor/backend.err.log

# Frontend (hot-reload always on)
sudo supervisorctl restart frontend
tail -f /var/log/supervisor/frontend.err.log

# Smoke test
API_URL=$(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d '=' -f2)
curl "$API_URL/api/"   # → {"app":"HomeOS","status":"ok"}
```

---

## 5. REST API reference

> All routes are prefixed with `/api`. Auth is `Authorization: Bearer <jwt>` unless noted.

### Auth
| Method | Path | Body | Auth |
|---|---|---|---|
| POST | `/auth/register` | `{name,email,password,household_name?}` | – |
| POST | `/auth/join` | `{name,email,password,invite_code}` | – |
| POST | `/auth/login` | `{email,password}` | – |
| GET | `/auth/me` |  | ✓ |

### Household
| Method | Path | Notes |
|---|---|---|
| GET | `/household` | returns `{household, members[]}` |
| POST | `/household/rotate-invite` | regenerates invite code |

### Chat
| Method | Path | Notes |
|---|---|---|
| GET | `/chat/history?limit=200` | full history (oldest first) |
| GET | `/chat/since?after=<iso>` | polling fallback |
| GET | `/chat/stream?token=<jwt>` | **SSE** real-time stream |
| POST | `/chat` `{content}` | sends a message; runs orchestrator |
| DELETE | `/chat/history` | clears household chat |

### Cart
| Method | Path | Notes |
|---|---|---|
| GET | `/cart` | active draft cart |
| GET | `/cart/all` | history (limit 20) |
| POST | `/cart/item` | manual add |
| PUT | `/cart/item/{id}` | edit |
| DELETE | `/cart/item/{id}` | remove |
| DELETE | `/cart/clear` | empty cart |
| POST | `/cart/from-chat` | rebuild draft from recent chat (LLM) |
| POST | `/cart/{id}/checkout` | **MOCK Swiggy** order placement |

### Recipes
| Method | Path | Notes |
|---|---|---|
| GET | `/recipes` | last 50 |
| GET | `/recipes/{id}` | full recipe + ingredients + steps |

### Family / Pantry / Meals / Cook
Standard CRUD. See `/app/backend/server.py` § "Family", "Pantry", "Meal plan", and `POST /ai/generate-weekly-plan`, `POST /ai/cook-instructions`.

---

## 6. Roadmap

**P0 (next):**
- Real Swiggy Instamart MCP integration (waiting on access)
- Item-level price preview before checkout
- WhatsApp Business API surface

**P1:**
- Recurring "Saturday cart" auto-fill from past order ledger
- OpenAI Whisper voice messages
- Recipe ledger page with search
- Pantry auto-decrement when a Swiggy order delivers
- Push notifications (PWA + service worker)

**P2:**
- Multi-household admin (manage parents' home from your account)
- Cook handover via WhatsApp deep-link with one tap
- Multi-vendor: Blinkit / Zepto / BigBasket fallback routing

---

_Last updated: Feb 2026_
