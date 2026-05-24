"""
Jarvis for Home - Backend
WhatsApp-style group chat for households + AI agent + Swiggy Instamart checkout.
"""
import os
import re
import json
import uuid
import asyncio
import secrets
import random
import logging
from pathlib import Path
from datetime import datetime, timezone, timedelta, date
from typing import Optional, List

import jwt
import bcrypt
import instaloader
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Query, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
from sse_starlette.sse import EventSourceResponse

import anthropic
from openai import AsyncOpenAI
from fastapi.responses import RedirectResponse

from broadcaster import broadcaster
from orchestrator import orchestrator, AgentResult
from swiggy_mcp import SwiggyMAPIClient, SwiggyMCPClient, build_auth_url, exchange_code_for_token

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ.get("JWT_SECRET")
if not JWT_SECRET:
    raise ValueError("JWT_SECRET is required — set it in backend/.env")
JWT_ALG = "HS256"
JWT_EXP_HOURS = 24 * 7
ANTHROPIC_KEY = os.environ.get("ANTHROPIC_API_KEY")
XAI_KEY = os.environ.get("XAI_API_KEY")
LLM_MODEL = os.environ.get("LLM_MODEL", "claude-sonnet-4-5-20250929")
GROK_MODEL = os.environ.get("GROK_MODEL", "grok-3-mini")
SWIGGY_CLIENT_ID = os.environ.get("SWIGGY_CLIENT_ID", "")
SWIGGY_REDIRECT_URI = os.environ.get("SWIGGY_REDIRECT_URI", "http://localhost:8000/api/swiggy/callback")

# Stable colors assigned to users in a household for chat bubbles (WhatsApp-style)
USER_COLORS = [
    "#D97757", "#546E58", "#9B6A3F", "#6A8A6F", "#A45D7D",
    "#3F7C9B", "#B97A3C", "#7C5BA6", "#3F8F7C", "#C46B45",
]

HOMEOS_ID = "homeos-bot"
JARVIS_ID = HOMEOS_ID  # backwards-compat alias used in older code paths

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]
app = FastAPI(title="HomeOS API")
api = APIRouter(prefix="/api")
security = HTTPBearer()
_anthropic_client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_KEY)
_grok_client = AsyncOpenAI(api_key=XAI_KEY, base_url="https://api.x.ai/v1") if XAI_KEY else None


async def llm_call(system: str, prompt: str, max_tokens: int = 1024) -> str:
    """
    Call Claude (primary). Falls back to Grok if Claude fails or is unconfigured.
    Raises RuntimeError only if both fail.
    """
    if ANTHROPIC_KEY:
        try:
            resp = await _anthropic_client.messages.create(
                model=LLM_MODEL,
                max_tokens=max_tokens,
                system=system,
                messages=[{"role": "user", "content": prompt}],
            )
            return resp.content[0].text
        except Exception as e:
            logger.warning(f"Claude failed ({e}), falling back to Grok")

    if _grok_client:
        resp = await _grok_client.chat.completions.create(
            model=GROK_MODEL,
            max_tokens=max_tokens,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": prompt},
            ],
        )
        return resp.choices[0].message.content

    raise RuntimeError("No LLM available — set ANTHROPIC_API_KEY or XAI_API_KEY in backend/.env")


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def gen_invite_code():
    return secrets.token_hex(4).upper()


def strip_id(d):
    if d:
        d.pop("_id", None)
    return d


# -------- Models --------
class RegisterReq(BaseModel):
    name: str
    email: EmailStr
    password: str
    household_name: Optional[str] = "My Home"


class JoinReq(BaseModel):
    name: str
    email: EmailStr
    password: str
    invite_code: str


class LoginReq(BaseModel):
    email: EmailStr
    password: str


class FamilyMember(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    role: str = "member"
    diet: str = "vegetarian"
    allergies: List[str] = []
    preferences: str = ""


class FamilyMemberCreate(BaseModel):
    name: str
    role: str = "member"
    diet: str = "vegetarian"
    allergies: List[str] = []
    preferences: str = ""


class PantryItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    qty: float = 1
    unit: str = "kg"
    category: str = "staple"
    low_threshold: float = 0.5
    updated_at: str = Field(default_factory=now_iso)


class PantryItemCreate(BaseModel):
    name: str
    qty: float = 1
    unit: str = "kg"
    category: str = "staple"
    low_threshold: float = 0.5


class PantryItemUpdate(BaseModel):
    name: Optional[str] = None
    qty: Optional[float] = None
    unit: Optional[str] = None
    category: Optional[str] = None
    low_threshold: Optional[float] = None


class Meal(BaseModel):
    name: str = ""
    recipe: str = ""
    ingredients: List[str] = []
    notes: str = ""


class MealUpdate(BaseModel):
    day: str
    slot: str
    meal: Meal


class ChatReq(BaseModel):
    content: str


class CartItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    qty: str = "1 unit"
    note: str = ""
    source: str = "manual"  # chat | jarvis | manual
    added_by: str = ""  # user name


class CartItemUpdate(BaseModel):
    name: Optional[str] = None
    qty: Optional[str] = None
    note: Optional[str] = None


# -------- Auth --------
def hash_password(pw):
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_password(pw, hashed):
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def create_token(user_id, household_id):
    payload = {
        "user_id": user_id,
        "household_id": household_id,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXP_HOURS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


async def get_current_user(creds: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALG])
        user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0})
        if not user:
            raise HTTPException(401, "User not found")
        return user
    except jwt.PyJWTError:
        raise HTTPException(401, "Invalid token")


async def get_user_color(household_id: str) -> str:
    existing = await db.users.find({"household_id": household_id}, {"_id": 0, "color": 1}).to_list(50)
    used = {u.get("color") for u in existing if u.get("color")}
    for c in USER_COLORS:
        if c not in used:
            return c
    return random.choice(USER_COLORS)


async def _post_system_message(household_id: str, content: str):
    msg = {
        "id": str(uuid.uuid4()),
        "household_id": household_id,
        "sender_id": "system",
        "sender_name": "System",
        "sender_color": "#8A9085",
        "role": "system",
        "content": content,
        "created_at": now_iso(),
    }
    await db.chat_messages.insert_one(msg)
    strip_id(msg)
    await broadcaster.publish(household_id, {"type": "message", "message": msg})
    return msg


async def _broadcast_message(msg: dict):
    """Push a fresh chat message to all SSE subscribers of its household."""
    if not msg:
        return
    hid = msg.get("household_id")
    if hid:
        await broadcaster.publish(hid, {"type": "message", "message": msg})


@api.post("/auth/register")
async def register(req: RegisterReq):
    if await db.users.find_one({"email": req.email.lower()}):
        raise HTTPException(400, "Email already registered")
    household_id = str(uuid.uuid4())
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "name": req.name,
        "email": req.email.lower(),
        "password_hash": hash_password(req.password),
        "household_id": household_id,
        "color": USER_COLORS[0],
        "created_at": now_iso(),
    }
    household_doc = {
        "id": household_id,
        "name": req.household_name or "My Home",
        "invite_code": gen_invite_code(),
        "owner_id": user_id,
        "created_at": now_iso(),
    }
    await db.users.insert_one(user_doc)
    await db.households.insert_one(household_doc)
    await db.family_members.insert_one({
        "id": str(uuid.uuid4()),
        "household_id": household_id,
        "name": req.name,
        "role": "self",
        "diet": "vegetarian",
        "allergies": [],
        "preferences": "",
    })
    await _post_system_message(household_id, f"{req.name} created the home")
    token = create_token(user_id, household_id)
    return {
        "token": token,
        "user": {"id": user_id, "name": req.name, "email": user_doc["email"], "household_id": household_id, "color": user_doc["color"]},
        "household": strip_id(household_doc),
    }


@api.post("/auth/join")
async def join(req: JoinReq):
    if await db.users.find_one({"email": req.email.lower()}):
        raise HTTPException(400, "Email already registered")
    household = await db.households.find_one({"invite_code": req.invite_code.upper()}, {"_id": 0})
    if not household:
        raise HTTPException(404, "Invalid invite code")
    user_id = str(uuid.uuid4())
    color = await get_user_color(household["id"])
    user_doc = {
        "id": user_id,
        "name": req.name,
        "email": req.email.lower(),
        "password_hash": hash_password(req.password),
        "household_id": household["id"],
        "color": color,
        "created_at": now_iso(),
    }
    await db.users.insert_one(user_doc)
    await db.family_members.insert_one({
        "id": str(uuid.uuid4()),
        "household_id": household["id"],
        "name": req.name,
        "role": "member",
        "diet": "vegetarian",
        "allergies": [],
        "preferences": "",
    })
    await _post_system_message(household["id"], f"{req.name} joined the home")
    token = create_token(user_id, household["id"])
    return {
        "token": token,
        "user": {"id": user_id, "name": req.name, "email": user_doc["email"], "household_id": household["id"], "color": color},
        "household": household,
    }


@api.post("/auth/login")
async def login(req: LoginReq):
    user = await db.users.find_one({"email": req.email.lower()}, {"_id": 0})
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(401, "Invalid credentials")
    household = await db.households.find_one({"id": user["household_id"]}, {"_id": 0})
    token = create_token(user["id"], user["household_id"])
    return {
        "token": token,
        "user": {"id": user["id"], "name": user["name"], "email": user["email"], "household_id": user["household_id"], "color": user.get("color", USER_COLORS[0])},
        "household": household,
    }


@api.get("/auth/me")
async def me(user=Depends(get_current_user)):
    household = await db.households.find_one({"id": user["household_id"]}, {"_id": 0})
    return {
        "user": {"id": user["id"], "name": user["name"], "email": user["email"], "household_id": user["household_id"], "color": user.get("color", USER_COLORS[0])},
        "household": household,
    }


# -------- Household --------
@api.get("/household")
async def get_household(user=Depends(get_current_user)):
    household = await db.households.find_one({"id": user["household_id"]}, {"_id": 0})
    members = await db.users.find(
        {"household_id": user["household_id"]},
        {"_id": 0, "password_hash": 0, "email": 0},
    ).to_list(50)
    return {"household": household, "members": members}


@api.post("/household/rotate-invite")
async def rotate_invite(user=Depends(get_current_user)):
    household = await db.households.find_one({"id": user["household_id"]}, {"_id": 0})
    if not household:
        raise HTTPException(404, "Household missing")
    new_code = gen_invite_code()
    await db.households.update_one({"id": user["household_id"]}, {"$set": {"invite_code": new_code}})
    household["invite_code"] = new_code
    return household


# -------- Family --------
@api.get("/family")
async def list_family(user=Depends(get_current_user)):
    return await db.family_members.find({"household_id": user["household_id"]}, {"_id": 0}).to_list(100)


@api.post("/family")
async def add_family(payload: FamilyMemberCreate, user=Depends(get_current_user)):
    m = FamilyMember(**payload.model_dump()).model_dump()
    m["household_id"] = user["household_id"]
    await db.family_members.insert_one(m)
    return strip_id(m)


@api.put("/family/{mid}")
async def update_family(mid: str, payload: FamilyMemberCreate, user=Depends(get_current_user)):
    await db.family_members.update_one(
        {"id": mid, "household_id": user["household_id"]}, {"$set": payload.model_dump()}
    )
    return await db.family_members.find_one({"id": mid}, {"_id": 0})


@api.delete("/family/{mid}")
async def delete_family(mid: str, user=Depends(get_current_user)):
    await db.family_members.delete_one({"id": mid, "household_id": user["household_id"]})
    return {"ok": True}


# -------- Pantry --------
@api.get("/pantry")
async def list_pantry(user=Depends(get_current_user)):
    items = await db.pantry.find({"household_id": user["household_id"]}, {"_id": 0}).to_list(500)
    items.sort(key=lambda x: x.get("name", ""))
    return items


@api.post("/pantry")
async def add_pantry(payload: PantryItemCreate, user=Depends(get_current_user)):
    item = PantryItem(**payload.model_dump()).model_dump()
    item["household_id"] = user["household_id"]
    await db.pantry.insert_one(item)
    return strip_id(item)


@api.put("/pantry/{iid}")
async def update_pantry(iid: str, payload: PantryItemUpdate, user=Depends(get_current_user)):
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    update["updated_at"] = now_iso()
    await db.pantry.update_one({"id": iid, "household_id": user["household_id"]}, {"$set": update})
    return await db.pantry.find_one({"id": iid}, {"_id": 0})


@api.delete("/pantry/{iid}")
async def delete_pantry(iid: str, user=Depends(get_current_user)):
    await db.pantry.delete_one({"id": iid, "household_id": user["household_id"]})
    return {"ok": True}


@api.get("/pantry/low")
async def low_pantry(user=Depends(get_current_user)):
    items = await db.pantry.find({"household_id": user["household_id"]}, {"_id": 0}).to_list(500)
    return [i for i in items if float(i.get("qty", 0)) <= float(i.get("low_threshold", 0))]


# -------- Meal plan --------
def week_dates(start: Optional[date] = None):
    today = start or date.today()
    monday = today - timedelta(days=today.weekday())
    return [(monday + timedelta(days=i)).isoformat() for i in range(7)]


@api.get("/mealplan/week")
async def get_week(user=Depends(get_current_user)):
    days = week_dates()
    plans = await db.meal_plans.find(
        {"household_id": user["household_id"], "date": {"$in": days}}, {"_id": 0}
    ).to_list(7)
    by_date = {p["date"]: p for p in plans}
    out = []
    for d in days:
        out.append(by_date.get(d) or {
            "id": str(uuid.uuid4()),
            "household_id": user["household_id"],
            "date": d,
            "breakfast": Meal().model_dump(),
            "lunch": Meal().model_dump(),
            "dinner": Meal().model_dump(),
        })
    return out


@api.put("/mealplan/meal")
async def update_meal(payload: MealUpdate, user=Depends(get_current_user)):
    if payload.slot not in ("breakfast", "lunch", "dinner"):
        raise HTTPException(400, "Invalid slot")
    existing = await db.meal_plans.find_one(
        {"household_id": user["household_id"], "date": payload.day}, {"_id": 0}
    )
    if existing:
        await db.meal_plans.update_one(
            {"household_id": user["household_id"], "date": payload.day},
            {"$set": {payload.slot: payload.meal.model_dump()}},
        )
    else:
        doc = {
            "id": str(uuid.uuid4()),
            "household_id": user["household_id"],
            "date": payload.day,
            "breakfast": Meal().model_dump(),
            "lunch": Meal().model_dump(),
            "dinner": Meal().model_dump(),
        }
        doc[payload.slot] = payload.meal.model_dump()
        await db.meal_plans.insert_one(doc)
    return await db.meal_plans.find_one(
        {"household_id": user["household_id"], "date": payload.day}, {"_id": 0}
    )


@api.get("/mealplan/today")
async def today_plan(user=Depends(get_current_user)):
    today = date.today().isoformat()
    plan = await db.meal_plans.find_one(
        {"household_id": user["household_id"], "date": today}, {"_id": 0}
    )
    if not plan:
        return {
            "id": str(uuid.uuid4()),
            "household_id": user["household_id"],
            "date": today,
            "breakfast": Meal().model_dump(),
            "lunch": Meal().model_dump(),
            "dinner": Meal().model_dump(),
        }
    return plan


# -------- AI Context --------
async def get_chat_context(household_id: str, limit: int = 12):
    msgs = await db.chat_messages.find(
        {"household_id": household_id}, {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    msgs.reverse()
    return msgs


async def get_household_context(household_id: str) -> str:
    members = await db.family_members.find({"household_id": household_id}, {"_id": 0}).to_list(100)
    pantry = await db.pantry.find({"household_id": household_id}, {"_id": 0}).to_list(500)
    users = await db.users.find({"household_id": household_id}, {"_id": 0, "name": 1}).to_list(50)
    today = date.today().isoformat()
    today_plan = await db.meal_plans.find_one(
        {"household_id": household_id, "date": today}, {"_id": 0}
    )
    low = [p for p in pantry if float(p.get("qty", 0)) <= float(p.get("low_threshold", 0))]

    lines = [
        f"ACTIVE CHAT USERS: {', '.join([u['name'] for u in users])}",
        f"FAMILY ({len(members)}):",
    ]
    for m in members:
        allergies = ", ".join(m.get("allergies", [])) or "none"
        lines.append(f"  - {m['name']} ({m['role']}, {m['diet']}, allergies: {allergies}, prefs: {m.get('preferences', '')})")
    lines.append(f"PANTRY LOW ({len(low)}): " + (", ".join([f"{p['name']} ({p['qty']} {p['unit']})" for p in low]) or "none"))
    lines.append("PANTRY TOP STOCK: " + ", ".join([p["name"] for p in pantry[:15]]))
    if today_plan:
        lines.append(f"TODAY'S PLAN: B: {today_plan.get('breakfast', {}).get('name', '-')} | L: {today_plan.get('lunch', {}).get('name', '-')} | D: {today_plan.get('dinner', {}).get('name', '-')}")
    return "\n".join(lines)


JARVIS_SYSTEM = """You are HomeOS — an AI member quietly present in an Indian household's group chat.

You are NOT a chatty bot. You behave like a thoughtful family member who only speaks when needed.

WHEN TO REPLY (should_reply=true):
- Message mentions "homeos", "home os", "@homeos", "jarvis" or "@jarvis"
- Message is a direct question (ends with ?) asking for suggestion, recipe, recommendation
- Message contains a recipe link (Instagram, YouTube, blog) — extract recipe + ingredients, share a quick summary
- Multiple grocery/cooking needs accumulating and you should propose action

WHEN TO STAY SILENT (should_reply=false):
- Family members chatting casually with each other
- Greetings, status updates, jokes
- Coordination between members that doesn't need you

ALWAYS extract grocery intents from EVERY message (silently):
- "out of X" / "X khatam" / "X finishing" / "need to buy X" / "running low on X" / "kal X laana hai"
- Recipe ingredients when a recipe is shared
- Add to `extracted_items`. Use Indian units (kg, g, l, ml, packet, pcs).

REPLY STYLE:
- Short (1-3 sentences). Conversational, warm. Use Hindi/Indian English where natural ("achha", "thoda", "dal", "sabzi").
- Address the person by name when relevant.
- Suggest, don't decide. Never auto-order.
- Avoid emojis.

OUTPUT: strictly valid JSON only, no markdown:
{
  "should_reply": true|false,
  "reply": "string (empty if not replying)",
  "extracted_items": [{"name":"toor dal","qty":"1 kg","note":"optional context"}]
}
"""


async def _run_jarvis(household_id: str, sender_name: str, message_text: str) -> dict:
    if not ANTHROPIC_KEY and not _grok_client:
        return {"should_reply": False, "reply": "", "extracted_items": []}

    ctx = await get_household_context(household_id)
    recent = await get_chat_context(household_id, 10)
    recent_str = "\n".join([
        f"{m.get('sender_name', '?')}: {m.get('content', '')}"
        for m in recent if m.get("role") in ("user", "assistant", "system")
    ])

    prompt = f"""HOUSEHOLD CONTEXT:
{ctx}

RECENT CHAT (oldest first):
{recent_str}

LATEST MESSAGE from {sender_name}:
\"\"\"{message_text}\"\"\"

Decide what to do. Respond with JSON only.
"""
    try:
        text = await llm_call(JARVIS_SYSTEM, prompt, max_tokens=1024)
        text = text.strip()
        if text.startswith("```"):
            text = text.split("```", 2)[1]
            if text.startswith("json"):
                text = text[4:]
            text = text.strip("` \n")
        data = json.loads(text)
        return {
            "should_reply": bool(data.get("should_reply", False)),
            "reply": str(data.get("reply", "")).strip(),
            "extracted_items": data.get("extracted_items", []) or [],
        }
    except Exception as e:
        logger.error(f"Jarvis LLM error: {e}")
        return {"should_reply": False, "reply": "", "extracted_items": []}


# -------- Instagram recipe ingestion (instaloader, anonymous) --------
INSTAGRAM_URL_PATTERN = re.compile(
    r"https?://(?:www\.)?instagram\.com/(?:reel|reels|p|tv)/([A-Za-z0-9_-]+)",
    re.IGNORECASE,
)


def _extract_ig_shortcode(text: str) -> Optional[str]:
    m = INSTAGRAM_URL_PATTERN.search(text or "")
    return m.group(1) if m else None


def _fetch_ig_post_sync(shortcode: str) -> Optional[dict]:
    """Synchronous instaloader fetch — run in a thread executor."""
    try:
        L = instaloader.Instaloader(
            quiet=True,
            download_pictures=False,
            download_videos=False,
            download_video_thumbnails=False,
            download_comments=False,
            save_metadata=False,
            compress_json=False,
            request_timeout=10,
        )
        post = instaloader.Post.from_shortcode(L.context, shortcode)
        return {
            "shortcode": shortcode,
            "caption": post.caption or "",
            "owner": post.owner_username,
            "thumbnail": str(post.url) if post.url else None,
            "is_video": bool(post.is_video),
            "video_url": str(post.video_url) if post.is_video and post.video_url else None,
            "url": f"https://www.instagram.com/p/{shortcode}/",
        }
    except Exception as e:
        logger.warning(f"instaloader failed for {shortcode}: {e}")
        return None


def _fetch_ig_embed_sync(shortcode: str) -> Optional[dict]:
    """Fallback: scrape Instagram's public embed page for og:description / og:image."""
    import urllib.request
    import html as html_mod
    try:
        url = f"https://www.instagram.com/p/{shortcode}/embed/captioned/"
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            },
        )
        with urllib.request.urlopen(req, timeout=10) as r:
            body = r.read().decode("utf-8", errors="ignore")
        if "EmbedIsBroken" in body:
            return None
        og_desc = re.search(r'<meta property="og:description" content="([^"]+)"', body)
        og_img = re.search(r'<meta property="og:image" content="([^"]+)"', body)
        og_title = re.search(r'<meta property="og:title" content="([^"]+)"', body)
        owner_m = re.search(r"@([A-Za-z0-9_.]+)", html_mod.unescape(og_title.group(1)) if og_title else "")
        caption = ""
        if og_desc:
            caption = html_mod.unescape(og_desc.group(1))
            # og:description often is like:  "1,234 likes, 56 comments - username on Date: \"actual caption...\""
            cap_match = re.search(r':\s*"(.+)"\s*$', caption, re.DOTALL) or re.search(r'-\s*[^:]+:\s*(.+)$', caption, re.DOTALL)
            if cap_match:
                caption = cap_match.group(1).strip().strip('"')
        if not caption:
            return None
        return {
            "shortcode": shortcode,
            "caption": caption,
            "owner": owner_m.group(1) if owner_m else None,
            "thumbnail": html_mod.unescape(og_img.group(1)) if og_img else None,
            "is_video": False,
            "video_url": None,
            "url": f"https://www.instagram.com/p/{shortcode}/",
        }
    except Exception as e:
        logger.warning(f"embed fallback failed for {shortcode}: {e}")
        return None


async def _fetch_ig_post(shortcode: str) -> Optional[dict]:
    # Primary: instaloader (works for richer posts but often blocked from cloud IPs)
    result = await asyncio.get_event_loop().run_in_executor(None, _fetch_ig_post_sync, shortcode)
    if result and result.get("caption"):
        return result
    # Fallback: public embed page scrape (no auth, works for many public posts)
    return await asyncio.get_event_loop().run_in_executor(None, _fetch_ig_embed_sync, shortcode)


async def _extract_recipe_from_caption(caption: str) -> Optional[dict]:
    if (not ANTHROPIC_KEY and not _grok_client) or not caption:
        return None
    prompt = f"""Extract a recipe from this Instagram caption. It may be a cooking reel (Indian or global cuisine).

Caption:
\"\"\"{caption[:3000]}\"\"\"

If this is clearly NOT a recipe (e.g., travel, fashion, news, meme), return: {{"is_recipe": false}}

Otherwise return strict JSON only:
{{
  "is_recipe": true,
  "title": "short dish name",
  "cuisine": "indian|global|other",
  "servings": "2-4" or similar,
  "ingredients": [{{"name": "toor dal", "qty": "1 cup"}}, ...],
  "steps": ["step 1 sentence", "step 2 sentence", ...],
  "summary": "1-2 sentence summary of the dish"
}}

Limit ingredients to <= 20 items. Limit steps to <= 10. Use Indian units when relevant (cup, tsp, tbsp, kg, g).
"""
    try:
        text = await llm_call(
            "You extract structured recipes. Output strictly valid JSON only, no markdown.",
            prompt, max_tokens=2048,
        )
        text = text.strip()
        if text.startswith("```"):
            text = text.split("```", 2)[1]
            if text.startswith("json"):
                text = text[4:]
            text = text.strip("` \n")
        data = json.loads(text)
        if not data.get("is_recipe"):
            return None
        # Normalize ingredients to dicts
        ings = []
        for ing in data.get("ingredients", [])[:20]:
            if isinstance(ing, dict):
                ings.append({"name": str(ing.get("name", "")).strip(), "qty": str(ing.get("qty", "1")).strip()})
            elif isinstance(ing, str):
                ings.append({"name": ing.strip(), "qty": "1"})
        data["ingredients"] = [i for i in ings if i["name"]]
        return data
    except Exception as e:
        logger.error(f"recipe extract error: {e}")
        return None


async def _process_instagram_link(household_id: str, user: dict, content: str) -> List[dict]:
    """Detect IG URL in content, fetch caption, extract recipe, add to cart, post recipe card.
    Returns list of new chat messages (may be empty if no IG link)."""
    shortcode = _extract_ig_shortcode(content)
    if not shortcode:
        return []

    ig = await _fetch_ig_post(shortcode)

    if not ig or not ig.get("caption"):
        # Couldn't read it — post a friendly note with paste-fallback affordance
        err = {
            "id": str(uuid.uuid4()),
            "household_id": household_id,
            "sender_id": JARVIS_ID,
            "sender_name": "HomeOS",
            "sender_color": "#D97757",
            "role": "ig_fallback",
            "content": (
                "I saw the Instagram link but couldn't fetch the caption — the post might be private, "
                "deleted, or Instagram is rate-limiting from here. Paste the recipe text and I'll pull ingredients."
            ),
            "created_at": now_iso(),
        }
        await db.chat_messages.insert_one(err)
        strip_id(err)
        await _broadcast_message(err)
        return [err]

    recipe = await _extract_recipe_from_caption(ig["caption"])

    if not recipe:
        err = {
            "id": str(uuid.uuid4()),
            "household_id": household_id,
            "sender_id": JARVIS_ID,
            "sender_name": "HomeOS",
            "sender_color": "#D97757",
            "role": "ig_fallback",
            "content": f"I read the Instagram caption from @{ig.get('owner', '')} but couldn't pull a clear recipe out. Paste the recipe text below and I'll extract it.",
            "created_at": now_iso(),
        }
        await db.chat_messages.insert_one(err)
        strip_id(err)
        await _broadcast_message(err)
        return [err]

    # Save recipe doc
    recipe_doc = {
        "id": str(uuid.uuid4()),
        "household_id": household_id,
        "title": recipe.get("title", "Untitled recipe"),
        "cuisine": recipe.get("cuisine", ""),
        "servings": recipe.get("servings", ""),
        "summary": recipe.get("summary", ""),
        "ingredients": recipe.get("ingredients", []),
        "steps": recipe.get("steps", []),
        "source_url": ig.get("url"),
        "source_owner": ig.get("owner"),
        "thumbnail": ig.get("thumbnail"),
        "video_url": ig.get("video_url"),
        "shared_by": user["name"],
        "shared_by_id": user["id"],
        "created_at": now_iso(),
    }
    await db.recipes.insert_one(recipe_doc)
    strip_id(recipe_doc)

    # Add ingredients to draft cart (silently)
    items = [
        {"name": i["name"], "qty": i.get("qty", "1"), "note": f"for {recipe_doc['title']}"}
        for i in recipe_doc["ingredients"]
    ]
    if items:
        await _add_items_to_draft(household_id, items, user["name"], source="instagram")

    # Post recipe-card message
    card = {
        "id": str(uuid.uuid4()),
        "household_id": household_id,
        "sender_id": JARVIS_ID,
        "sender_name": "Jarvis",
        "sender_color": "#D97757",
        "role": "recipe",
        "content": (
            f"Pulled the recipe for {recipe_doc['title']} from @{ig.get('owner', '')}. "
            f"{len(items)} ingredients added to the cart."
        ),
        "recipe_id": recipe_doc["id"],
        "recipe_title": recipe_doc["title"],
        "recipe_thumbnail": recipe_doc.get("thumbnail"),
        "recipe_summary": recipe_doc.get("summary", ""),
        "ingredients_count": len(items),
        "source_owner": ig.get("owner"),
        "created_at": now_iso(),
    }
    await db.chat_messages.insert_one(card)
    return [strip_id(card)]



async def _get_or_create_draft_cart(household_id: str):
    cart = await db.carts.find_one(
        {"household_id": household_id, "status": "draft"}, {"_id": 0}
    )
    if cart:
        return cart
    cart = {
        "id": str(uuid.uuid4()),
        "household_id": household_id,
        "status": "draft",
        "items": [],
        "swiggy_order_id": None,
        "estimated_total": 0,
        "eta_minutes": None,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.carts.insert_one(cart)
    return strip_id(cart)


async def _add_items_to_draft(household_id: str, items: list, added_by: str, source: str):
    if not items:
        return None
    cart = await _get_or_create_draft_cart(household_id)
    existing_names = {it["name"].lower(): it for it in cart["items"]}
    added = []
    for it in items:
        name = (it.get("name") or "").strip()
        if not name:
            continue
        if name.lower() in existing_names:
            continue
        new_item = {
            "id": str(uuid.uuid4()),
            "name": name,
            "qty": it.get("qty") or "1 unit",
            "note": it.get("note", ""),
            "source": source,
            "added_by": added_by,
        }
        cart["items"].append(new_item)
        existing_names[name.lower()] = new_item
        added.append(new_item)
    if added:
        cart["updated_at"] = now_iso()
        await db.carts.update_one(
            {"id": cart["id"]},
            {"$set": {"items": cart["items"], "updated_at": cart["updated_at"]}},
        )
    return cart


# -------- Chat (group) --------
@api.get("/chat/history")
async def chat_history(limit: int = 200, user=Depends(get_current_user)):
    msgs = await db.chat_messages.find(
        {"household_id": user["household_id"]}, {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    msgs.reverse()
    return msgs


@api.get("/chat/since")
async def chat_since(after: str = Query(""), user=Depends(get_current_user)):
    q = {"household_id": user["household_id"]}
    if after:
        q["created_at"] = {"$gt": after}
    msgs = await db.chat_messages.find(q, {"_id": 0}).sort("created_at", 1).to_list(200)
    return msgs


@api.delete("/chat/history")
async def clear_history(user=Depends(get_current_user)):
    await db.chat_messages.delete_many({"household_id": user["household_id"]})
    return {"ok": True}


@api.post("/chat")
async def send_chat(payload: ChatReq, user=Depends(get_current_user)):
    household_id = user["household_id"]
    content = payload.content.strip()
    if not content:
        raise HTTPException(400, "Empty message")

    user_msg = {
        "id": str(uuid.uuid4()),
        "household_id": household_id,
        "sender_id": user["id"],
        "sender_name": user["name"],
        "sender_color": user.get("color", USER_COLORS[0]),
        "role": "user",
        "content": content,
        "created_at": now_iso(),
    }
    await db.chat_messages.insert_one(user_msg)
    strip_id(user_msg)
    await _broadcast_message(user_msg)

    new_msgs = [user_msg]

    # Check for Instagram link first — if found, extract recipe instead of running normal Jarvis flow
    ig_messages = await _process_instagram_link(household_id, user, content)
    if ig_messages:
        new_msgs.extend(ig_messages)
        for m in ig_messages:
            await _broadcast_message(m)
        cart_updated = True
    else:
        # Run HomeOS chat agent
        decision = await _run_jarvis(household_id, user["name"], content)

        cart_updated = False
        if decision["extracted_items"]:
            await _add_items_to_draft(
                household_id, decision["extracted_items"], user["name"], source="homeos"
            )
            cart_updated = True

        if decision["should_reply"] and decision["reply"]:
            bot_msg = {
                "id": str(uuid.uuid4()),
                "household_id": household_id,
                "sender_id": JARVIS_ID,
                "sender_name": "HomeOS",
                "sender_color": "#D97757",
                "role": "assistant",
                "content": decision["reply"],
                "created_at": now_iso(),
            }
            await db.chat_messages.insert_one(bot_msg)
            strip_id(bot_msg)
            new_msgs.append(bot_msg)
            await _broadcast_message(bot_msg)

    # Auto cart proposal: if draft cart has >=4 items and no recent cart proposal
    if cart_updated:
        cart = await db.carts.find_one(
            {"household_id": household_id, "status": "draft"}, {"_id": 0}
        )
        if cart and len(cart.get("items", [])) >= 4:
            recent_proposals = await db.chat_messages.find(
                {"household_id": household_id, "role": "cart_proposal"}, {"_id": 0}
            ).sort("created_at", -1).limit(1).to_list(1)
            should_propose = True
            if recent_proposals:
                last = recent_proposals[0]
                # only re-propose if items count grew since last proposal
                if last.get("cart_items_count", 0) >= len(cart["items"]):
                    should_propose = False
            if should_propose:
                proposal = {
                    "id": str(uuid.uuid4()),
                    "household_id": household_id,
                    "sender_id": JARVIS_ID,
                    "sender_name": "HomeOS",
                    "sender_color": "#D97757",
                    "role": "cart_proposal",
                    "content": f"I've put together a list of {len(cart['items'])} items from your chat. Want to review and order?",
                    "cart_id": cart["id"],
                    "cart_items_count": len(cart["items"]),
                    "created_at": now_iso(),
                }
                await db.chat_messages.insert_one(proposal)
                strip_id(proposal)
                new_msgs.append(proposal)
                await _broadcast_message(proposal)

    return {"messages": new_msgs}


# -------- SSE stream (real-time push) --------
@api.get("/chat/stream")
async def chat_stream(request: Request, token: str = Query(...)):
    """Server-Sent Events: streams new chat messages to the household.
    EventSource cannot send headers, so JWT comes via ?token=... query param."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        household_id = payload["household_id"]
    except jwt.PyJWTError:
        raise HTTPException(401, "Invalid token")

    q = await broadcaster.subscribe(household_id)

    async def event_gen():
        try:
            # initial hello so clients know the stream is live
            yield {"event": "ready", "data": json.dumps({"household_id": household_id})}
            while True:
                if await request.is_disconnected():
                    break
                try:
                    payload = await asyncio.wait_for(q.get(), timeout=20.0)
                    yield {"event": "message", "data": payload}
                except asyncio.TimeoutError:
                    # heartbeat keeps proxies from closing the connection
                    yield {"event": "ping", "data": "1"}
        finally:
            await broadcaster.unsubscribe(household_id, q)

    return EventSourceResponse(event_gen())


# -------- Cart --------
@api.get("/cart")
async def get_cart(user=Depends(get_current_user)):
    cart = await db.carts.find_one(
        {"household_id": user["household_id"], "status": "draft"}, {"_id": 0}
    )
    if not cart:
        cart = await _get_or_create_draft_cart(user["household_id"])
    return cart


@api.get("/cart/all")
async def list_carts(user=Depends(get_current_user)):
    return await db.carts.find(
        {"household_id": user["household_id"]}, {"_id": 0}
    ).sort("created_at", -1).limit(20).to_list(20)


# -------- Recipes (Instagram-extracted + future) --------
@api.get("/recipes")
async def list_recipes(user=Depends(get_current_user)):
    return await db.recipes.find(
        {"household_id": user["household_id"]}, {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)


@api.get("/recipes/{recipe_id}")
async def get_recipe(recipe_id: str, user=Depends(get_current_user)):
    r = await db.recipes.find_one(
        {"id": recipe_id, "household_id": user["household_id"]}, {"_id": 0}
    )
    if not r:
        raise HTTPException(404, "Recipe not found")
    return r


class TextRecipeReq(BaseModel):
    text: str


@api.post("/recipes/from-text")
async def recipe_from_text(payload: TextRecipeReq, user=Depends(get_current_user)):
    """Paste-text fallback: extract a recipe from arbitrary user-pasted text using
    the same LLM pipeline as the Instagram path. Adds ingredients to the draft
    cart and posts a recipe card to chat (broadcast over SSE)."""
    if not ANTHROPIC_KEY and not _grok_client:
        raise HTTPException(500, "LLM not configured")
    text = (payload.text or "").strip()
    if len(text) < 30:
        raise HTTPException(400, "Recipe text too short — paste the ingredients and steps")

    recipe = await _extract_recipe_from_caption(text)
    if not recipe:
        raise HTTPException(422, "Couldn't pull a clear recipe from that text. Make sure ingredients are listed.")

    household_id = user["household_id"]

    recipe_doc = {
        "id": str(uuid.uuid4()),
        "household_id": household_id,
        "title": recipe.get("title", "Pasted recipe"),
        "cuisine": recipe.get("cuisine", ""),
        "servings": recipe.get("servings", ""),
        "summary": recipe.get("summary", ""),
        "ingredients": recipe.get("ingredients", []),
        "steps": recipe.get("steps", []),
        "source_url": None,
        "source_owner": None,
        "thumbnail": None,
        "video_url": None,
        "shared_by": user["name"],
        "shared_by_id": user["id"],
        "created_at": now_iso(),
    }
    await db.recipes.insert_one(recipe_doc)
    strip_id(recipe_doc)

    items = [
        {"name": i["name"], "qty": i.get("qty", "1"), "note": f"for {recipe_doc['title']}"}
        for i in recipe_doc["ingredients"]
    ]
    if items:
        await _add_items_to_draft(household_id, items, user["name"], source="pasted")

    card = {
        "id": str(uuid.uuid4()),
        "household_id": household_id,
        "sender_id": JARVIS_ID,
        "sender_name": "HomeOS",
        "sender_color": "#D97757",
        "role": "recipe",
        "content": f"Pulled the recipe for {recipe_doc['title']} from text {user['name']} pasted. {len(items)} ingredients added to the cart.",
        "recipe_id": recipe_doc["id"],
        "recipe_title": recipe_doc["title"],
        "recipe_thumbnail": None,
        "recipe_summary": recipe_doc.get("summary", ""),
        "ingredients_count": len(items),
        "source_owner": None,
        "created_at": now_iso(),
    }
    await db.chat_messages.insert_one(card)
    strip_id(card)
    await _broadcast_message(card)
    return {"recipe": recipe_doc, "message": card}




@api.post("/cart/item")
async def add_cart_item(payload: CartItem, user=Depends(get_current_user)):
    cart = await _get_or_create_draft_cart(user["household_id"])
    item = payload.model_dump()
    item["added_by"] = user["name"]
    item["source"] = "manual"
    cart["items"].append(item)
    cart["updated_at"] = now_iso()
    await db.carts.update_one(
        {"id": cart["id"]}, {"$set": {"items": cart["items"], "updated_at": cart["updated_at"]}}
    )
    return cart


@api.put("/cart/item/{item_id}")
async def update_cart_item(item_id: str, payload: CartItemUpdate, user=Depends(get_current_user)):
    cart = await _get_or_create_draft_cart(user["household_id"])
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    for it in cart["items"]:
        if it["id"] == item_id:
            it.update(updates)
            break
    cart["updated_at"] = now_iso()
    await db.carts.update_one(
        {"id": cart["id"]}, {"$set": {"items": cart["items"], "updated_at": cart["updated_at"]}}
    )
    return cart


@api.delete("/cart/item/{item_id}")
async def delete_cart_item(item_id: str, user=Depends(get_current_user)):
    cart = await _get_or_create_draft_cart(user["household_id"])
    cart["items"] = [it for it in cart["items"] if it["id"] != item_id]
    cart["updated_at"] = now_iso()
    await db.carts.update_one(
        {"id": cart["id"]}, {"$set": {"items": cart["items"], "updated_at": cart["updated_at"]}}
    )
    return cart


@api.delete("/cart/clear")
async def clear_cart(user=Depends(get_current_user)):
    cart = await _get_or_create_draft_cart(user["household_id"])
    await db.carts.update_one({"id": cart["id"]}, {"$set": {"items": [], "updated_at": now_iso()}})
    return await db.carts.find_one({"id": cart["id"]}, {"_id": 0})


# -------- Swiggy Instamart — OAuth + MCP --------

SWIGGY_PRICE_LOOKUP = {
    "atta": 320, "rice": 180, "toor dal": 220, "moong dal": 200, "chana dal": 180,
    "oil": 180, "ghee": 650, "salt": 30, "sugar": 60, "tea": 280, "milk": 65,
    "curd": 45, "paneer": 95, "onion": 35, "potato": 30, "tomato": 50,
    "ginger": 90, "garlic": 120, "green chilli": 80, "coriander": 40, "lemon": 50,
}


def _mock_swiggy_price(name: str) -> int:
    n = name.lower()
    for k, v in SWIGGY_PRICE_LOOKUP.items():
        if k in n or n in k:
            return v
    return random.choice([60, 80, 120, 150, 200, 250])


async def _get_swiggy_token(household_id: str) -> str | None:
    """Retrieve the stored Swiggy OAuth token for this household."""
    rec = await db.swiggy_tokens.find_one({"household_id": household_id}, {"_id": 0})
    return rec.get("access_token") if rec else None


# ── OAuth endpoints ──────────────────────────────────────────────────────────

@api.get("/swiggy/status")
async def swiggy_status(user=Depends(get_current_user)):
    """Returns whether this household has a connected Swiggy account."""
    token = await _get_swiggy_token(user["household_id"])
    connected = token is not None
    return {
        "connected": connected,
        "client_configured": bool(SWIGGY_CLIENT_ID),
        "message": (
            "Swiggy account connected" if connected
            else "Connect your Swiggy account to enable real Instamart orders"
        ),
    }


@api.get("/swiggy/auth")
async def swiggy_auth(user=Depends(get_current_user)):
    """Start the Swiggy OAuth flow — redirects browser to Swiggy login."""
    if not SWIGGY_CLIENT_ID:
        raise HTTPException(501, "SWIGGY_CLIENT_ID not configured in backend/.env")
    state = f"{user['household_id']}:{secrets.token_hex(16)}"
    await db.swiggy_oauth_state.insert_one({
        "state": state,
        "household_id": user["household_id"],
        "created_at": now_iso(),
    })
    return RedirectResponse(build_auth_url(state))


@api.get("/swiggy/callback")
async def swiggy_callback(code: str, state: str, request: Request):
    """Swiggy OAuth callback — exchanges code for token and stores it."""
    stored = await db.swiggy_oauth_state.find_one_and_delete({"state": state})
    if not stored:
        raise HTTPException(400, "Invalid or expired OAuth state")
    household_id = stored["household_id"]
    try:
        token_data = await exchange_code_for_token(code)
    except Exception as e:
        raise HTTPException(502, f"Swiggy token exchange failed: {e}")
    await db.swiggy_tokens.update_one(
        {"household_id": household_id},
        {"$set": {
            "household_id": household_id,
            "access_token": token_data["access_token"],
            "refresh_token": token_data.get("refresh_token"),
            "expires_in": token_data.get("expires_in"),
            "saved_at": now_iso(),
        }},
        upsert=True,
    )
    return RedirectResponse("http://localhost:3000/app/cart?swiggy=connected")


@api.delete("/swiggy/disconnect")
async def swiggy_disconnect(user=Depends(get_current_user)):
    """Remove the stored Swiggy token for this household."""
    await db.swiggy_tokens.delete_one({"household_id": user["household_id"]})
    return {"disconnected": True}


class SwiggyTokenReq(BaseModel):
    token: str


@api.post("/swiggy/set-token")
async def swiggy_set_token(req: SwiggyTokenReq, user=Depends(get_current_user)):
    """
    Save a Swiggy bearer token obtained from the browser session.
    Used when Swiggy OAuth credentials are not yet configured.
    """
    if not req.token.strip():
        raise HTTPException(400, "Token cannot be empty")
    await db.swiggy_tokens.update_one(
        {"household_id": user["household_id"]},
        {"$set": {
            "household_id": user["household_id"],
            "access_token": req.token.strip(),
            "refresh_token": None,
            "source": "manual",
            "saved_at": now_iso(),
        }},
        upsert=True,
    )
    return {"connected": True, "source": "manual"}


# ── Checkout endpoint (real MCP when connected, mock fallback) ───────────────

@api.post("/cart/{cart_id}/checkout")
async def checkout_swiggy(cart_id: str, user=Depends(get_current_user)):
    """
    Place a Swiggy Instamart order.
    Uses real Swiggy MCP when the household has connected their Swiggy account.
    Falls back to mock pricing when not connected.
    """
    cart = await db.carts.find_one(
        {"id": cart_id, "household_id": user["household_id"]}, {"_id": 0}
    )
    if not cart:
        raise HTTPException(404, "Cart not found")
    if cart.get("status") != "draft":
        raise HTTPException(400, "Cart already processed")
    if not cart.get("items"):
        raise HTTPException(400, "Cart is empty")

    token = await _get_swiggy_token(user["household_id"])

    if token:
        # ── Real Swiggy order via MAPI (cookie auth) ───────────────────
        try:
            household = await db.households.find_one(
                {"id": user["household_id"]}, {"_id": 0}
            )
            address = (household or {}).get("delivery_address")
            swiggy = SwiggyMAPIClient(token)
            confirmation = await swiggy.place_order(cart["items"], delivery_address=address)

            order_id = confirmation.get("order_id", f"SWGY-{secrets.token_hex(4).upper()}")
            total = confirmation.get("total", 0)
            eta = confirmation.get("eta_minutes", 25)

            update = {
                "status": "ordered",
                "swiggy_order_id": order_id,
                "estimated_total": total,
                "eta_minutes": eta,
                "ordered_at": now_iso(),
                "ordered_by": user["name"],
                "mocked": False,
                "swiggy_confirmation": confirmation,
                "updated_at": now_iso(),
            }
            content = (
                f"{user['name']} placed a Swiggy Instamart order "
                f"({len(cart['items'])} items, ₹{total}). "
                f"ETA {eta} mins. Order ID {order_id}."
            )
        except Exception as e:
            logger.error(f"Swiggy MAPI checkout failed: {e}; falling back to mock")
            token = None  # trigger mock fallback below

    if not token:
        # ── Mock fallback ──────────────────────────────────────────────
        line_items, subtotal = [], 0
        for it in cart["items"]:
            price = _mock_swiggy_price(it["name"])
            subtotal += price
            line_items.append({**it, "price": price})
        delivery_fee = 29 if subtotal < 500 else 0
        total = subtotal + delivery_fee
        order_id = f"SWGY-{secrets.token_hex(4).upper()}"
        eta = random.randint(15, 35)
        update = {
            "status": "ordered",
            "items": line_items,
            "swiggy_order_id": order_id,
            "estimated_total": total,
            "subtotal": subtotal,
            "delivery_fee": delivery_fee,
            "eta_minutes": eta,
            "ordered_at": now_iso(),
            "ordered_by": user["name"],
            "mocked": True,
            "updated_at": now_iso(),
        }
        content = (
            f"{user['name']} placed a Swiggy Instamart order "
            f"({len(line_items)} items, ₹{total}). "
            f"ETA {eta} mins. Order ID {order_id}. [DEMO — connect Swiggy to place real orders]"
        )

    await db.carts.update_one({"id": cart_id}, {"$set": update})

    confirm_msg = {
        "id": str(uuid.uuid4()),
        "household_id": user["household_id"],
        "sender_id": JARVIS_ID,
        "sender_name": "Jarvis",
        "sender_color": "#D97757",
        "role": "system",
        "content": content,
        "created_at": now_iso(),
    }
    await db.chat_messages.insert_one(confirm_msg)
    strip_id(confirm_msg)
    await _broadcast_message(confirm_msg)

    final = await db.carts.find_one({"id": cart_id}, {"_id": 0})
    return {"cart": final, "message": confirm_msg}


# -------- Recipe extraction from URL (mock for POC) --------
@api.post("/cart/from-chat")
async def build_cart_from_chat(user=Depends(get_current_user)):
    """Force Jarvis to scan recent chat and propose a cart."""
    if not ANTHROPIC_KEY and not _grok_client:
        raise HTTPException(500, "LLM not configured")
    msgs = await get_chat_context(user["household_id"], 30)
    chat_str = "\n".join([
        f"{m.get('sender_name','?')}: {m.get('content','')}"
        for m in msgs if m.get("role") == "user"
    ])
    if not chat_str:
        raise HTTPException(400, "No chat to analyze yet")

    prompt = f"""You are extracting grocery items from a family group chat.

Chat:
{chat_str}

Return JSON only:
{{"extracted_items":[{{"name":"...","qty":"1 kg","note":"..."}}]}}
"""
    try:
        text = await llm_call(
            "You extract Indian household grocery items from chat. JSON only.",
            prompt, max_tokens=1024,
        )
        text = text.strip()
        if text.startswith("```"):
            text = text.split("```", 2)[1]
            if text.startswith("json"):
                text = text[4:]
            text = text.strip("` \n")
        data = json.loads(text)
        items = data.get("extracted_items", [])
    except Exception as e:
        raise HTTPException(500, f"LLM error: {e}")

    await _add_items_to_draft(user["household_id"], items, user["name"], source="chat")
    return await db.carts.find_one(
        {"household_id": user["household_id"], "status": "draft"}, {"_id": 0}
    )


# -------- AI bulk endpoints (unchanged) --------
@api.post("/ai/generate-weekly-plan")
async def generate_weekly_plan(user=Depends(get_current_user)):
    if not ANTHROPIC_KEY and not _grok_client:
        raise HTTPException(500, "LLM key not configured")
    household_id = user["household_id"]
    days = week_dates()
    ctx = await get_household_context(household_id)
    prompt = f"""{ctx}

Create a 7-day Indian household meal plan for: {', '.join(days)}.
Respect diets and allergies. Simple home-style meals.

Return ONLY valid JSON:
{{"days":[{{"date":"YYYY-MM-DD","breakfast":{{"name":"...","ingredients":["..."],"notes":"..."}},"lunch":{{"name":"...","ingredients":["..."],"notes":"..."}},"dinner":{{"name":"...","ingredients":["..."],"notes":"..."}}}}]}}
"""
    try:
        text = await llm_call("You output strict JSON meal plans.", prompt, max_tokens=4096)
        text = text.strip()
        if text.startswith("```"):
            text = text.split("```", 2)[1]
            if text.startswith("json"):
                text = text[4:]
            text = text.strip("` \n")
        data = json.loads(text)
    except Exception as e:
        raise HTTPException(500, f"Failed to generate: {e}")

    for d in data.get("days", []):
        date_str = d.get("date")
        if not date_str:
            continue
        doc = {
            "id": str(uuid.uuid4()),
            "household_id": household_id,
            "date": date_str,
            "breakfast": {"name": d.get("breakfast", {}).get("name", ""), "recipe": "", "ingredients": d.get("breakfast", {}).get("ingredients", []), "notes": d.get("breakfast", {}).get("notes", "")},
            "lunch": {"name": d.get("lunch", {}).get("name", ""), "recipe": "", "ingredients": d.get("lunch", {}).get("ingredients", []), "notes": d.get("lunch", {}).get("notes", "")},
            "dinner": {"name": d.get("dinner", {}).get("name", ""), "recipe": "", "ingredients": d.get("dinner", {}).get("ingredients", []), "notes": d.get("dinner", {}).get("notes", "")},
        }
        await db.meal_plans.update_one(
            {"household_id": household_id, "date": date_str}, {"$set": doc}, upsert=True
        )
    plans = await db.meal_plans.find(
        {"household_id": household_id, "date": {"$in": days}}, {"_id": 0}
    ).to_list(7)
    plans.sort(key=lambda p: p["date"])
    return plans


@api.post("/ai/cook-instructions")
async def cook_instructions(user=Depends(get_current_user)):
    if not ANTHROPIC_KEY and not _grok_client:
        raise HTTPException(500, "LLM not configured")
    household_id = user["household_id"]
    today = date.today().isoformat()
    plan = await db.meal_plans.find_one(
        {"household_id": household_id, "date": today}, {"_id": 0}
    )
    if not plan:
        raise HTTPException(404, "No meal plan for today")
    members = await db.family_members.find({"household_id": household_id}, {"_id": 0}).to_list(100)
    pantry = await db.pantry.find({"household_id": household_id}, {"_id": 0}).to_list(200)
    meals_str = "\n".join([
        f"Breakfast: {plan.get('breakfast', {}).get('name', '(none)')}",
        f"Lunch: {plan.get('lunch', {}).get('name', '(none)')}",
        f"Dinner: {plan.get('dinner', {}).get('name', '(none)')}",
    ])
    prompt = f"""Write friendly cook handover instructions in warm tone, WhatsApp-ready.

Family:
{chr(10).join([f"- {m['name']} ({m['diet']}, allergies: {', '.join(m.get('allergies', [])) or 'none'})" for m in members])}

Today:
{meals_str}

Pantry: {', '.join([p['name'] for p in pantry[:20]])}

Sections: Breakfast/Lunch/Dinner. Each: ingredients (4 ppl quantities), 4-6 prep steps, notes. End with items to buy.
"""
    try:
        instructions = await llm_call(
            "Practical Indian household cook notes. Plain text only.",
            prompt, max_tokens=2048,
        )
        return {"date": today, "instructions": instructions, "plan": plan}
    except Exception as e:
        raise HTTPException(500, f"LLM error: {e}")


# -------- Health --------
@api.get("/")
async def root():
    return {"app": "HomeOS", "status": "ok"}


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
