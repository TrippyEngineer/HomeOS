# Jarvis for Home — PRD

## Original Problem Statement
Build an AI-powered household orchestration agent ("Jarvis for Home") that reduces cognitive load for urban Indian households. POC pivot: a WhatsApp-style group chat (web app) where multiple family members from the same household sign in with individual accounts and chat naturally. An AI agent (Jarvis) silently observes the group chat, extracts grocery intents, accumulates a shared cart, and lets the decision-maker check out via Swiggy Instamart (MOCKED in this POC). Built to test the core hypothesis: can family chat → automated grocery ordering work as a wedge.

## Core Architecture
- **Backend**: FastAPI + MongoDB + JWT auth + Claude Sonnet 4.5 via Emergent Universal LLM Key (`emergentintegrations` lib).
- **Frontend**: React + Tailwind + Shadcn UI. WhatsApp-inspired group chat as the index route.
- **Real-time**: Polling every 3.5s for new messages.
- **Auth**: JWT (HS256), 7-day expiry. bcrypt password hashing. `/api/auth/register`, `/api/auth/login`, `/api/auth/join`.
- **Multi-user households**: invite-code based. Invite code rotatable. Each user gets a stable bubble color.

## What's Been Implemented (Feb 2026)

### Auth & Households
- Register (creates a new home + 8-char invite code)
- Join existing home via invite code
- Login / logout / persistent JWT token
- `/api/household` returns household + members
- `/api/household/rotate-invite` regenerates invite code

### Group Chat (centerpiece)
- `/api/chat` POST: saves user message, runs Jarvis decision LLM, returns user + (maybe) Jarvis reply + (maybe) cart proposal
- `/api/chat/history` GET: full message history for household
- `/api/chat/since?after=<iso>` GET: polling for new messages
- WhatsApp-style UI: own messages right (light sage bubble, double-tick), others left (white, sender color), Jarvis (terracotta-tinted bubble with sparkle icon), system messages centered pills, cart_proposal special card with "Review & order" CTA
- Sender colors stable per user
- Date separators
- Members + invite dialog accessible from chat header

### Jarvis AI Agent (Claude Sonnet 4.5)
- Returns structured JSON: `{should_reply, reply, extracted_items}`
- Stays silent for casual chat; replies on @jarvis, questions, recipe links, or explicit needs
- Extracts grocery items from EVERY message silently (Hindi/Indian English understood: "khatam", "running low", "kal X laana hai")
- Receives full household context (family members, pantry stock, low items, today's plan, last 12 messages)

### Cart & Swiggy (MOCKED)
- `/api/cart` GET: current draft cart for household (1 active draft per home)
- `/api/cart/item` POST / PUT / DELETE: manual cart management
- `/api/cart/clear` DELETE
- `/api/cart/from-chat` POST: force Jarvis to scan recent chat and rebuild items
- `/api/cart/{id}/checkout` POST: **MOCKED** Swiggy Instamart checkout. Returns order_id (SWGY-XXXX), subtotal, delivery fee (₹29 if subtotal<500, else free), ETA (15-35 min). Posts a system message in the chat. Clearly labeled `mocked: True`.
- Auto cart proposal: when draft cart hits ≥4 items, Jarvis posts a `cart_proposal` message linking to /app/cart

### Supporting features (kept from initial build)
- Family member profiles (CRUD with diets/allergies/preferences)
- Pantry tracker (CRUD + low-stock detection)
- Weekly meal plan + AI-generated 7-day plan
- Cook handover notes (AI) with WhatsApp share intent
- Smart grocery list endpoint
- Overview dashboard

## Endpoints Summary
```
POST   /api/auth/register
POST   /api/auth/join
POST   /api/auth/login
GET    /api/auth/me
GET    /api/household
POST   /api/household/rotate-invite

GET    /api/chat/history
GET    /api/chat/since?after=ISO
POST   /api/chat               { content }
DELETE /api/chat/history

GET    /api/cart
GET    /api/cart/all
POST   /api/cart/item
PUT    /api/cart/item/{id}
DELETE /api/cart/item/{id}
DELETE /api/cart/clear
POST   /api/cart/from-chat
POST   /api/cart/{id}/checkout   ← MOCKED Swiggy

GET    /api/family               (CRUD: POST/PUT/DELETE)
GET    /api/pantry               (CRUD + /pantry/low)
GET    /api/mealplan/week        ; /mealplan/today ; PUT /mealplan/meal
POST   /api/ai/generate-weekly-plan
POST   /api/ai/cook-instructions
```

## What's Mocked
- **Swiggy Instamart checkout**: pricing lookup hardcoded for ~20 common items; otherwise random realistic prices. Order IDs are random hex. Delivery fee logic real. **CLEARLY LABELED in UI** with banner + confirmation copy.

## P0 (deferred / next phase)
- Real Swiggy MCP integration (waiting on credentials + Builder Club access)
- Instagram link → recipe ingestion (currently relies on LLM seeing URL; needs actual reel/post scraping)
- WebSocket / SSE instead of polling
- Push notifications (PWA)
- WhatsApp Business API surface (longer term per discussion notes)

## P1 (later)
- Voice messages (OpenAI Whisper)
- Inventory auto-decrement when orders arrive
- Cook coordination with auto-WhatsApp sharing
- Recurring orders / saved baskets

## Test Credentials
See `/app/memory/test_credentials.md`
