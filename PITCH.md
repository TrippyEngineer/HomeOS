# HomeOS — The AI Brain for the Indian Home

> *Less deciding. More living.*

---

## The Problem

Running an Indian household is a full-time job nobody applied for.

The average urban Indian household makes **30–40 micro-decisions every day** around food, groceries, and domestic coordination — most of which fall on one person. Usually the woman of the house, or the most "responsible" member of a joint family.

### What this looks like in practice

**The grocery problem**
- Someone finishes the dal. Nobody writes it down. Three days later: "why isn't there dal?"
- The person who orders groceries must mentally track 60+ items across multiple family members, a cook communicating in Hinglish, and a pantry nobody has inventoried in months
- Swiggy Instamart is open. The cart is empty. You stare at it trying to remember what's needed

**The cook coordination problem**
- The cook arrives at 7am. Nobody has left instructions
- A last-minute WhatsApp is sent. The cook misses half of it, gets confused about quantities for three family members with different dietary restrictions
- Result: wrong meal prepared, food wasted, family unhappy

**The family communication problem**
- "Buy milk" gets sent to the family WhatsApp group
- Someone buys skimmed, someone else already bought full-fat
- The family chat is a mix of grocery requests, life updates, and forwarded memes — impossible to act on programmatically

### The scale of this

| Metric | Number |
|---|---|
| Urban Indian households managing this daily | 300M+ |
| Monthly food waste from poor pantry awareness | ₹8,000–12,000 crore |
| Daily time spent by primary household manager | 2–3 hours |
| Quick commerce market growth (YoY) | 80% |
| Swiggy Instamart + Blinkit + Zepto monthly GMV | ₹6,000+ crore |

---

## The Solution: HomeOS

**HomeOS is the AI orchestration layer for the Indian home.**

It lives where Indian families already communicate — a group chat — and silently observes, learns, and acts. No new app to learn. No forms to fill. Just talk the way you always do.

### How it works

```
Family member types in group chat:
  "Kal dal khatam ho gayi, aur chawal bhi almost over hai"
                     ↓
     HomeOS silently extracts: toor dal + rice → adds to cart
                     ↓
     When cart hits 4+ items → "Ready to order? 6 items, ~₹820"
                     ↓
     One tap → Swiggy Instamart order placed
```

**The cook flow**
```
Today's meal plan (AI-generated, respects family diets + allergies)
                     ↓
     HomeOS generates cook handover at 6am:
     "Breakfast: Poha for 4. Rohan is dairy-free — skip curd.
      Lunch: Dal makhani + rice. Garlic is on the second shelf."
                     ↓
     Shared via WhatsApp in one tap
```

**The Instagram recipe flow**
```
Family member shares Instagram reel of "Maa ke hath ki rajma"
                     ↓
     HomeOS extracts: 14 ingredients + cooking steps
                     ↓
     Ingredients added to cart + recipe saved to household library
```

---

## Why Now

Three forces converging in 2025:

**1. WhatsApp is universal**
Indian families already use it for household coordination. We don't need to change behaviour — we plug into it.

**2. Quick commerce is mainstream**
Swiggy Instamart and Blinkit now cover 500+ cities. The fulfilment infrastructure exists. The missing piece is intent capture.

**3. LLMs understand Hinglish and Indian household context natively**
Claude and Grok can parse "khatam ho gaya", understand that "dal" means toor dal in a North Indian home, and know that a diabetic family member shouldn't be getting rice. This wasn't possible 18 months ago.

---

## Product

### Phase 0 — POC (shipped)

A WhatsApp-style web group chat where:

- Multiple family members sign in with individual accounts under one household
- HomeOS (Jarvis AI) silently observes every message and extracts grocery needs in real time
- Grocery items accumulate in a shared draft cart across all family members
- Cart auto-proposed at 4+ items with one-tap Swiggy Instamart checkout
- Instagram recipe reels → ingredient extraction → cart in one step
- AI-generated weekly meal plans (respects individual diets, allergies, preferences)
- Cook handover notes generated daily and shareable via WhatsApp

**Status: Working end-to-end. Fully functional POC running locally. Ready for pilot households.**

### Phase 1 — WhatsApp Native

- Replace web chat with WhatsApp Business API integration
- HomeOS lives inside the family's actual group chat
- Zero onboarding friction — no new app, no link to click

### Phase 2 — Household OS

- Voice message support (grocery requests by voice)
- Inventory auto-decrement when Swiggy orders deliver
- Pantry camera integration (CV-based stock detection)
- Multi-household management (managing parents' home remotely)
- Elderly parent simplified interface

### Phase 3 — Platform

- Multi-vendor routing: Blinkit / Zepto / BigBasket fallback
- Cook marketplace integration (Urban Company, local networks)
- Household data insights for FMCG brands (anonymised, opt-in)
- B2B: property managers, PGs, hostels, corporate cafeterias

---

## Technical Architecture

```
WhatsApp / Web Chat
        ↓
   HomeOS Backend (FastAPI + MongoDB)
        ├── Chat Orchestrator
        │     ├── InstagramAgent    → recipe extraction from reels
        │     ├── ChatAgent         → Jarvis AI (Hinglish-native)
        │     └── CartProposerAgent → auto-proposes at 4+ items
        ├── LLM Stack
        │     ├── Claude Sonnet (Anthropic) — primary
        │     └── Grok (xAI) — automatic fallback
        ├── Swiggy Integration
        │     ├── SwiggyMAPIClient  → cookie-based (demo)
        │     └── SwiggyMCPClient   → OAuth (production)
        └── SSE Broadcaster → real-time to all household members
        ↓
   React Frontend (web, mobile-responsive PWA)
```

**AI Stack**
- **Primary:** Claude Sonnet (Anthropic) — household context, Hinglish, dietary reasoning
- **Fallback:** Grok (xAI) — automatic failover, zero code change required
- **Abstraction:** single `llm_call()` function — model swap is one env variable

**No vendor lock-in by design.** The LLM abstraction makes switching or A/B testing models trivial.

**Infrastructure**
- FastAPI + Motor (async MongoDB) backend
- JWT auth with bcrypt — multi-user, multi-household
- Real-time via Server-Sent Events (SSE)
- Swiggy Instamart via official MCP/OAuth (partner credentials pending)

---

## Business Model

### Phase 0–1: Free (build trust + household data)
- Free for all households during pilot phase
- Monetisation secondary to proving the core behaviour loop

### Phase 1–2: Freemium SaaS

| Tier | Price | Features |
|---|---|---|
| Free | ₹0 | 1 household, basic cart + AI |
| HomeOS Pro | ₹299/month | Meal planning, cook notes, recipe library, Swiggy auto-order |
| HomeOS Family | ₹499/month | Up to 3 homes, elderly parent dashboard, priority support |

### Phase 3: Platform + B2B

- **FMCG data:** anonymised purchase pattern insights sold to brands (opt-in)
- **Commerce commission:** per-order referral revenue from Swiggy/Blinkit
- **B2B SaaS:** HomeOS for PGs, co-living, corporate cafeterias (₹5,000–50,000/month)

### Unit economics (target)

| Metric | Target |
|---|---|
| CAC | ₹200–400 (WhatsApp referral-driven) |
| LTV | ₹12,000+ (3-year household subscription) |
| Gross margin | 75%+ |

---

## Market Opportunity

| Segment | TAM |
|---|---|
| Urban Indian households (monthly grocery spend >₹5,000) | 80M households |
| Quick commerce addressable market by 2027 | ₹45,000 crore |
| Household SaaS at ₹299/month × 10M households | ₹36,000 crore ARR |
| FMCG household data market | ₹8,000 crore |

**Beachhead:** 500K dual-income urban households in Tier 1 cities (Delhi, Mumbai, Bangalore) who already use Swiggy Instamart weekly and have a WhatsApp family group.

---

## Traction

| Milestone | Status |
|---|---|
| Full-stack POC shipped | ✅ Done |
| Claude + Grok dual-LLM stack | ✅ Done |
| Swiggy Instamart API integration (search + checkout flow) | ✅ Done (pending partner OAuth for production) |
| Instagram recipe extraction | ✅ Done |
| Weekly meal plan + cook handover | ✅ Done |
| Hinglish intent extraction validated | ✅ Tested with real inputs |
| Pilot household conversations | In progress |

---

## Why Us

**Abhinav Goyal — Founder**

- Shipped the entire POC end-to-end solo in under a week
- Deep understanding of the Indian household dynamic — this is a personal pain point
- Engineering-first: the AI pipeline, Swiggy integration, and multi-agent architecture are all working code, not slides

**Unfair advantages**

- **WhatsApp-native UX** — no app download, no behaviour change required
- **Cook is a first-class user** — unique to the Indian market; no competitor has built for this
- **Hinglish-native AI** — tested with real household inputs; Claude understands Indian context out of the box
- **Dual-LLM resilience** — Claude primary + Grok fallback means no single point of AI failure

---

## The Ask

**Seeking:** ₹1.5 crore seed / $180K

| Allocation | % | Purpose |
|---|---|---|
| Engineering | 40% | WhatsApp Business API integration, mobile app |
| Pilot acquisition | 30% | First 500 household pilots |
| Operations | 20% | Cook network partnerships, customer success |
| Legal + infra | 10% | Compliance, cloud infrastructure |

**18-month milestones**

| Month | Milestone |
|---|---|
| 3 | WhatsApp native, 100 pilot households, Swiggy partner credentials |
| 6 | 1,000 active households, first ₹1L MRR |
| 12 | 10,000 households, Swiggy referral revenue, B2B pilots |
| 18 | Series A readiness, 50,000 households |

---

## The Vision

Every Indian household — whether a nuclear family in Gurgaon, a joint family in Pune, or a student in a Bangalore PG — deserves a home that runs itself.

HomeOS is not a grocery app. It is not a meal planner. It is the operating system for the home — the connective tissue between the family, the cook, the pantry, and the market.

The home is the largest under-automated environment in most people's lives. We are here to change that.

---

*HomeOS — built in India, for Indian homes.*

**Contact:** abhinavgoyal2355@gmail.com
**Demo:** http://localhost:3000 *(live POC — request a demo session)*
**Repo:** https://github.com/TrippyEngineer/HomeOS
