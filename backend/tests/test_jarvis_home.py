"""
End-to-end backend tests for Jarvis for Home API.
Covers: auth (register/join/login/me), household, chat + Jarvis intelligence,
cart CRUD, mock Swiggy checkout, family/pantry/mealplan supporting endpoints.
"""
import os
import time
import uuid
import pytest
import requests
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8000").rstrip("/")
API = f"{BASE_URL}/api"

_HAS_LLM = bool(os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("XAI_API_KEY"))
needs_ai = pytest.mark.skipif(not _HAS_LLM, reason="No LLM API key — set ANTHROPIC_API_KEY or XAI_API_KEY to run AI tests")

# Unique user creds per session run so we can re-run tests without DB cleanup
RUN_ID = uuid.uuid4().hex[:6]
PRIYA = {"name": "TEST_Priya", "email": f"TEST_priya_{RUN_ID}@test.com", "password": "password123", "household_name": "TEST_Sharma_Home"}
ROHAN = {"name": "TEST_Rohan", "email": f"TEST_rohan_{RUN_ID}@test.com", "password": "password123"}

state = {}  # shared between tests


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------- Health ----------
def test_health(session):
    r = session.get(f"{API}/")
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


# ---------- Auth ----------
def test_register_priya(session):
    r = session.post(f"{API}/auth/register", json=PRIYA)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "token" in data and isinstance(data["token"], str)
    assert data["user"]["email"] == PRIYA["email"].lower()
    assert data["user"]["household_id"]
    assert data["household"]["invite_code"]
    assert len(data["household"]["invite_code"]) == 8
    state["priya"] = data
    state["invite_code"] = data["household"]["invite_code"]


def test_register_duplicate_fails(session):
    r = session.post(f"{API}/auth/register", json=PRIYA)
    assert r.status_code == 400


def test_join_with_invalid_code(session):
    r = session.post(f"{API}/auth/join", json={**ROHAN, "invite_code": "BADBADXX"})
    assert r.status_code == 404


def test_join_rohan(session):
    r = session.post(f"{API}/auth/join", json={**ROHAN, "invite_code": state["invite_code"]})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["user"]["household_id"] == state["priya"]["user"]["household_id"]
    assert data["user"]["color"] != state["priya"]["user"]["color"]
    state["rohan"] = data


def test_login_success(session):
    r = session.post(f"{API}/auth/login", json={"email": PRIYA["email"], "password": PRIYA["password"]})
    assert r.status_code == 200
    assert r.json()["user"]["email"] == PRIYA["email"].lower()


def test_login_wrong_password(session):
    r = session.post(f"{API}/auth/login", json={"email": PRIYA["email"], "password": "wrong"})
    assert r.status_code == 401


def test_me(session):
    r = session.get(f"{API}/auth/me", headers=auth_headers(state["priya"]["token"]))
    assert r.status_code == 200
    j = r.json()
    assert j["user"]["email"] == PRIYA["email"].lower()
    assert j["household"]["id"] == state["priya"]["user"]["household_id"]


def test_me_no_token(session):
    r = requests.get(f"{API}/auth/me")
    assert r.status_code in (401, 403)


# ---------- Household ----------
def test_household_members(session):
    r = session.get(f"{API}/household", headers=auth_headers(state["priya"]["token"]))
    assert r.status_code == 200
    j = r.json()
    assert len(j["members"]) == 2
    names = {m["name"] for m in j["members"]}
    assert PRIYA["name"] in names and ROHAN["name"] in names
    # password_hash should NOT be exposed
    assert all("password_hash" not in m for m in j["members"])


def test_rotate_invite(session):
    old = state["invite_code"]
    r = session.post(f"{API}/household/rotate-invite", headers=auth_headers(state["priya"]["token"]))
    assert r.status_code == 200
    new_code = r.json()["invite_code"]
    assert new_code != old and len(new_code) == 8
    state["invite_code"] = new_code


# ---------- Chat & Jarvis ----------
def test_chat_history_initial(session):
    r = session.get(f"{API}/chat/history", headers=auth_headers(state["priya"]["token"]))
    assert r.status_code == 200
    msgs = r.json()
    # should contain at least the system "created the home" + "joined" messages
    assert any(m["role"] == "system" for m in msgs)


@needs_ai
def test_chat_silent_for_casual(session):
    """Casual greeting should NOT get a Jarvis reply."""
    r = session.post(f"{API}/chat", json={"content": "hello everyone good morning"},
                     headers=auth_headers(state["priya"]["token"]))
    assert r.status_code == 200, r.text
    msgs = r.json()["messages"]
    # only user msg should be present; no assistant reply
    assistant_msgs = [m for m in msgs if m.get("role") == "assistant"]
    assert len(assistant_msgs) == 0, f"Jarvis should stay silent for casual chat. got: {assistant_msgs}"


@needs_ai
def test_chat_silent_extracts_grocery(session):
    """Plain statement of being out of dal -> silent extraction (no reply) but cart should grow."""
    r = session.post(f"{API}/chat", json={"content": "we are out of toor dal"},
                     headers=auth_headers(state["priya"]["token"]))
    assert r.status_code == 200, r.text
    # Sometimes LLM may reply; we mainly verify cart got the item
    time.sleep(0.5)
    cart = session.get(f"{API}/cart", headers=auth_headers(state["priya"]["token"])).json()
    names = [it["name"].lower() for it in cart.get("items", [])]
    assert any("toor" in n or "dal" in n for n in names), f"Expected dal in cart, got {names}"


@needs_ai
def test_chat_question_gets_reply(session):
    """Direct question with 'jarvis' should get a reply."""
    r = session.post(f"{API}/chat",
                     json={"content": "Jarvis what should we cook tonight?"},
                     headers=auth_headers(state["priya"]["token"]))
    assert r.status_code == 200, r.text
    msgs = r.json()["messages"]
    assistant_msgs = [m for m in msgs if m.get("role") == "assistant"]
    assert len(assistant_msgs) >= 1, f"Expected Jarvis reply. msgs={msgs}"
    assert assistant_msgs[0]["sender_name"] == "Jarvis"


@needs_ai
def test_chat_more_groceries_for_cart_proposal(session):
    """Add a few more grocery items to trigger cart_proposal (>=4 items)."""
    for content in ["curd khatam, need to buy", "need 2 litres milk", "running low on rice and oil"]:
        session.post(f"{API}/chat", json={"content": content},
                     headers=auth_headers(state["priya"]["token"]))
        time.sleep(0.3)
    cart = session.get(f"{API}/cart", headers=auth_headers(state["priya"]["token"])).json()
    assert len(cart["items"]) >= 4, f"Expected >=4 items, got {len(cart['items'])}: {cart['items']}"
    state["cart_id"] = cart["id"]

    # Cart proposal message should exist in chat
    hist = session.get(f"{API}/chat/history",
                       headers=auth_headers(state["priya"]["token"])).json()
    proposals = [m for m in hist if m.get("role") == "cart_proposal"]
    assert len(proposals) >= 1, "Expected at least 1 cart_proposal message"
    assert proposals[0]["cart_id"] == state["cart_id"]


def test_chat_since(session):
    hist = session.get(f"{API}/chat/history",
                       headers=auth_headers(state["priya"]["token"])).json()
    assert len(hist) > 0
    middle_ts = hist[len(hist) // 2]["created_at"]
    r = session.get(f"{API}/chat/since", params={"after": middle_ts},
                    headers=auth_headers(state["priya"]["token"]))
    assert r.status_code == 200
    later = r.json()
    assert all(m["created_at"] > middle_ts for m in later)


# ---------- Cart ----------
def test_cart_manual_add_update_delete(session):
    h = auth_headers(state["priya"]["token"])
    add = session.post(f"{API}/cart/item",
                       json={"name": "TEST_paneer", "qty": "200 g", "note": "fresh"},
                       headers=h)
    assert add.status_code == 200
    items = add.json()["items"]
    new_item = [it for it in items if it["name"] == "TEST_paneer"][0]
    iid = new_item["id"]
    assert new_item["added_by"] == PRIYA["name"]
    assert new_item["source"] == "manual"

    # update
    upd = session.put(f"{API}/cart/item/{iid}", json={"qty": "500 g"}, headers=h)
    assert upd.status_code == 200
    upd_item = [it for it in upd.json()["items"] if it["id"] == iid][0]
    assert upd_item["qty"] == "500 g"

    # delete
    dele = session.delete(f"{API}/cart/item/{iid}", headers=h)
    assert dele.status_code == 200
    assert not any(it["id"] == iid for it in dele.json()["items"])


@needs_ai
def test_cart_from_chat(session):
    h = auth_headers(state["priya"]["token"])
    r = session.post(f"{API}/cart/from-chat", headers=h)
    assert r.status_code == 200, r.text
    cart = r.json()
    assert len(cart["items"]) >= 1


# ---------- Mock Swiggy Checkout ----------
def test_checkout_mock_swiggy(session):
    h = auth_headers(state["priya"]["token"])
    cart = session.get(f"{API}/cart", headers=h).json()
    if len(cart["items"]) == 0:
        # AI tests were skipped (no LLM key in CI); add a seed item so checkout has something to process
        session.post(f"{API}/cart/item", json={"name": "CI_test_atta", "qty": "1 kg"}, headers=h)
        cart = session.get(f"{API}/cart", headers=h).json()
    assert len(cart["items"]) > 0
    cid = cart["id"]
    state["cart_id"] = cid
    r = session.post(f"{API}/cart/{cid}/checkout", headers=h)
    assert r.status_code == 200, r.text
    body = r.json()
    final = body["cart"]
    assert final["status"] == "ordered"
    assert final["mocked"] is True
    assert final["swiggy_order_id"].startswith("SWGY-")
    assert isinstance(final["subtotal"], int) and final["subtotal"] > 0
    expected_fee = 29 if final["subtotal"] < 500 else 0
    assert final["delivery_fee"] == expected_fee
    assert final["estimated_total"] == final["subtotal"] + final["delivery_fee"]
    assert 15 <= final["eta_minutes"] <= 35

    # Confirmation system message should exist in chat
    hist = session.get(f"{API}/chat/history", headers=h).json()
    sys_msgs = [m for m in hist if m.get("role") == "system" and "SWGY-" in m.get("content", "")]
    assert len(sys_msgs) >= 1


def test_checkout_already_processed(session):
    h = auth_headers(state["priya"]["token"])
    cid = state.get("cart_id")
    if not cid:
        pytest.skip("no prior cart id")
    r = session.post(f"{API}/cart/{cid}/checkout", headers=h)
    # cart is now in ordered status -> 400 (or 404 if a new draft replaced)
    assert r.status_code in (400, 404)


def test_checkout_empty_cart(session):
    h = auth_headers(state["priya"]["token"])
    # Get new draft cart (auto created after previous order)
    cart = session.get(f"{API}/cart", headers=h).json()
    session.delete(f"{API}/cart/clear", headers=h)
    r = session.post(f"{API}/cart/{cart['id']}/checkout", headers=h)
    assert r.status_code == 400


# ---------- Family / Pantry / Mealplan supporting endpoints ----------
def test_family_crud(session):
    h = auth_headers(state["priya"]["token"])
    r = session.get(f"{API}/family", headers=h)
    assert r.status_code == 200
    initial_count = len(r.json())

    add = session.post(f"{API}/family",
                       json={"name": "TEST_Child", "role": "kid", "diet": "vegetarian"},
                       headers=h)
    assert add.status_code == 200
    mid = add.json()["id"]

    upd = session.put(f"{API}/family/{mid}",
                      json={"name": "TEST_ChildUpdated", "role": "kid", "diet": "vegetarian",
                            "allergies": ["peanuts"], "preferences": "loves dosa"},
                      headers=h)
    assert upd.status_code == 200
    assert upd.json()["name"] == "TEST_ChildUpdated"
    assert "peanuts" in upd.json()["allergies"]

    dele = session.delete(f"{API}/family/{mid}", headers=h)
    assert dele.status_code == 200

    final = session.get(f"{API}/family", headers=h).json()
    assert len(final) == initial_count


def test_pantry_crud(session):
    h = auth_headers(state["priya"]["token"])
    add = session.post(f"{API}/pantry",
                       json={"name": "TEST_atta", "qty": 5, "unit": "kg", "category": "staple", "low_threshold": 1},
                       headers=h)
    assert add.status_code == 200
    iid = add.json()["id"]

    upd = session.put(f"{API}/pantry/{iid}", json={"qty": 0.2}, headers=h)
    assert upd.status_code == 200
    assert upd.json()["qty"] == 0.2

    low = session.get(f"{API}/pantry/low", headers=h).json()
    assert any(i["id"] == iid for i in low)

    dele = session.delete(f"{API}/pantry/{iid}", headers=h)
    assert dele.status_code == 200


def test_mealplan_week_and_update(session):
    h = auth_headers(state["priya"]["token"])
    r = session.get(f"{API}/mealplan/week", headers=h)
    assert r.status_code == 200
    week = r.json()
    assert len(week) == 7
    day = week[0]["date"]
    upd = session.put(f"{API}/mealplan/meal",
                      json={"day": day, "slot": "breakfast",
                            "meal": {"name": "TEST_Poha", "recipe": "", "ingredients": ["poha"], "notes": ""}},
                      headers=h)
    assert upd.status_code == 200
    assert upd.json()["breakfast"]["name"] == "TEST_Poha"

    bad = session.put(f"{API}/mealplan/meal",
                      json={"day": day, "slot": "snack",
                            "meal": {"name": "x", "recipe": "", "ingredients": [], "notes": ""}},
                      headers=h)
    assert bad.status_code == 400


# ---------- Household isolation ----------
def test_rohan_sees_same_cart(session):
    """Both household members must see the same household chat / cart."""
    hr = auth_headers(state["rohan"]["token"])
    cart_r = session.get(f"{API}/cart", headers=hr).json()
    cart_p = session.get(f"{API}/cart", headers=auth_headers(state["priya"]["token"])).json()
    assert cart_r["id"] == cart_p["id"]

    hist_r = session.get(f"{API}/chat/history", headers=hr).json()
    assert len(hist_r) > 0
