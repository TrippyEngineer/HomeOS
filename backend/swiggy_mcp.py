"""
Swiggy Instamart client — cookie-based direct API.

How to get fresh cookies (every ~1 hour):
  1. Log into https://www.swiggy.com/instamart in Chrome
  2. DevTools (F12) → Network tab → reload page
  3. Click any request to www.swiggy.com
  4. Request Headers → find 'cookie:' → copy the ENTIRE value
  5. Paste into the HomeOS "Connect Swiggy" modal

Key cookies that must be present and fresh:
  - tid: auth JWT, expires every ~40 minutes
  - aws-waf-token: WAF bypass, expires every ~1 hour
  - __SW: long-lived session identifier

Swiggy Partner OAuth (for SWIGGY_CLIENT_ID-based flow) is still supported
as a secondary path if credentials become available.
"""
from __future__ import annotations

import os
import re
import uuid
import logging
import httpx
from typing import Any

logger = logging.getLogger(__name__)

SWIGGY_BASE = "https://www.swiggy.com"
SWIGGY_MCP_BASE = "https://mcp.swiggy.com/im"
SWIGGY_OAUTH_AUTH_URL = "https://www.swiggy.com/auth/oauth/authorize"
SWIGGY_OAUTH_TOKEN_URL = "https://www.swiggy.com/auth/oauth/token"

SWIGGY_CLIENT_ID = os.environ.get("SWIGGY_CLIENT_ID", "")
SWIGGY_CLIENT_SECRET = os.environ.get("SWIGGY_CLIENT_SECRET", "")
SWIGGY_REDIRECT_URI = os.environ.get("SWIGGY_REDIRECT_URI", "http://localhost:8000/api/swiggy/callback")

DEFAULT_LAT = "28.533322"
DEFAULT_LNG = "77.249151"
DEFAULT_STORE_ID = "1389690"  # South Delhi dark store (Chittaranjan Park)


class SwiggyMAPIClient:
    """
    Calls Swiggy's internal API using a full browser cookie string.

    The cookie string is copied verbatim from Chrome DevTools → Network →
    any request to www.swiggy.com → Request Headers → cookie:.
    It must include 'tid' (auth JWT) and 'aws-waf-token' to work.
    """

    def __init__(
        self,
        cookie_string: str,
        lat: str = DEFAULT_LAT,
        lng: str = DEFAULT_LNG,
        store_id: str = DEFAULT_STORE_ID,
    ):
        # Accept either a full cookie string or a bare __SW value
        if "=" not in cookie_string:
            cookie_string = f"__SW={cookie_string}"
        self._cookie = cookie_string.strip()
        self._lat = lat
        self._lng = lng
        self._store_id = store_id
        self._device_id = (
            _cookie_val(self._cookie, "_device_id")
            or _cookie_val(self._cookie, "_swuid")
            or "unknown"
        )
        self._headers = {
            "cookie": self._cookie,
            "x-build-version": "2.345.0",
            "x-device-id": self._device_id,
            "content-type": "application/json",
            "accept": "*/*",
            "accept-encoding": "gzip, deflate",
            "accept-language": "en-US,en;q=0.9",
            "origin": SWIGGY_BASE,
            "referer": f"{SWIGGY_BASE}/instamart/search",
            "user-agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/148.0.0.0 Safari/537.36"
            ),
        }

    # ── HTTP helpers ──────────────────────────────────────────────────────────

    async def _get(self, path: str, params: dict | None = None) -> Any:
        url = f"{SWIGGY_BASE}{path}" if path.startswith("/") else path
        async with httpx.AsyncClient(timeout=20, follow_redirects=True) as c:
            r = await c.get(url, headers=self._headers, params=params or {})
            r.raise_for_status()
            return r.json()

    async def _post(self, path: str, body: dict) -> Any:
        url = f"{SWIGGY_BASE}{path}" if path.startswith("/") else path
        async with httpx.AsyncClient(timeout=20, follow_redirects=True) as c:
            r = await c.post(url, headers=self._headers, json=body)
            r.raise_for_status()
            return r.json()

    # ── API calls ─────────────────────────────────────────────────────────────

    async def ping(self) -> bool:
        """Check that the session cookies are still valid."""
        try:
            data = await self._get(
                "/mapi/misc_new/skeleton",
                params={"lat": self._lat, "lng": self._lng},
            )
            return isinstance(data, dict)
        except Exception as e:
            logger.warning(f"Swiggy ping failed: {e}")
            return False

    async def search_products(self, query: str) -> list[dict]:
        """
        Search Instamart products.
        Endpoint: GET /api/instamart/search/suggest-items/v2
        """
        try:
            data = await self._get(
                "/api/instamart/search/suggest-items/v2",
                params={
                    "query": query,
                    "storeId": self._store_id,
                    "primaryStoreId": self._store_id,
                    "secondaryStoreId": "",
                    "trackingId": f"_{uuid.uuid4().hex[:12]}",
                },
            )
            products = _extract_products(data)
            logger.info(f"Instamart search '{query}' → {len(products)} results")
            return products
        except Exception as e:
            logger.warning(f"Instamart search failed for '{query}': {e}")
            return []

    async def add_to_cart(self, product_id: str, quantity: int = 1) -> dict:
        """Add one product to the Instamart cart."""
        return await self._post(
            "/mapi/instamart/cart/add",
            {
                "productId": product_id,
                "quantity": quantity,
                "storeId": self._store_id,
                "lat": self._lat,
                "lng": self._lng,
            },
        ) or {}

    async def place_order(
        self, items: list[dict], delivery_address: str | None = None
    ) -> dict:
        """
        Search for each cart item, add to Swiggy cart, place COD order.
        Returns {order_id, total, eta_minutes, items}.
        """
        resolved, total = [], 0

        for item in items:
            products = await self.search_products(item["name"])
            if products:
                p = products[0]
                resolved.append(p)
                total += p.get("price", 0)
                try:
                    await self.add_to_cart(p["id"])
                except Exception as e:
                    logger.warning(f"add_to_cart failed for {p.get('name')}: {e}")

        if not resolved:
            raise RuntimeError("Could not match any cart items to Instamart products")

        body: dict = {
            "paymentMethod": "COD",
            "storeId": self._store_id,
            "lat": self._lat,
            "lng": self._lng,
        }
        if delivery_address:
            body["deliveryAddress"] = delivery_address

        result = await self._post("/mapi/instamart/order/place", body)

        order_id = (
            result.get("orderId")
            or result.get("order_id")
            or f"SWGY-{uuid.uuid4().hex[:8].upper()}"
        )
        return {
            "order_id": order_id,
            "total": total,
            "eta_minutes": result.get("etaMinutes", result.get("eta", 25)),
            "items": resolved,
        }


# ── OAuth MCP client (requires partner credentials) ───────────────────────────

class SwiggyMCPClient:
    def __init__(self, access_token: str):
        self._token = access_token
        self._headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
        }

    async def _rpc(self, method: str, params: dict | None = None) -> Any:
        payload = {"jsonrpc": "2.0", "id": str(uuid.uuid4()), "method": method, "params": params or {}}
        async with httpx.AsyncClient(timeout=30) as c:
            r = await c.post(SWIGGY_MCP_BASE, json=payload, headers=self._headers)
            r.raise_for_status()
            data = r.json()
            if "error" in data:
                raise RuntimeError(f"MCP error: {data['error']}")
            return data.get("result")

    async def call_tool(self, name: str, arguments: dict) -> Any:
        return await self._rpc("tools/call", {"name": name, "arguments": arguments})


# ── OAuth helpers ─────────────────────────────────────────────────────────────

def build_auth_url(state: str) -> str:
    from urllib.parse import urlencode
    return f"{SWIGGY_OAUTH_AUTH_URL}?" + urlencode({
        "response_type": "code",
        "client_id": SWIGGY_CLIENT_ID,
        "redirect_uri": SWIGGY_REDIRECT_URI,
        "scope": "instamart:read instamart:write",
        "state": state,
    })


async def exchange_code_for_token(code: str) -> dict:
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.post(SWIGGY_OAUTH_TOKEN_URL, data={
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": SWIGGY_REDIRECT_URI,
            "client_id": SWIGGY_CLIENT_ID,
            "client_secret": SWIGGY_CLIENT_SECRET,
        })
        r.raise_for_status()
        return r.json()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _cookie_val(cookie_str: str, key: str) -> str | None:
    m = re.search(rf'(?:^|;\s*){re.escape(key)}=([^;]+)', cookie_str)
    return m.group(1) if m else None


def _extract_products(data: Any) -> list[dict]:
    """
    Parse products from various Swiggy API response shapes.
    Prices are normalised to rupees (divide by 100 if > 10000).
    """
    raw: list | None = None

    if isinstance(data, list):
        raw = data
    elif isinstance(data, dict):
        # Try common top-level keys
        for key in ("listings", "products", "items", "results", "data", "searchResult"):
            v = data.get(key)
            if isinstance(v, list):
                raw = v
                break
            if isinstance(v, dict):
                # One level deeper
                inner = _extract_products(v)
                if inner:
                    return inner

    if not raw:
        return []

    out = []
    for p in raw:
        if not isinstance(p, dict):
            continue
        pid = p.get("id") or p.get("productId") or p.get("skuId") or p.get("itemId")
        name = (
            p.get("name") or p.get("itemName") or p.get("productName") or p.get("title") or ""
        )
        price_raw = (
            p.get("price")
            or p.get("finalPrice")
            or p.get("discountedPrice")
            or p.get("mrp")
            or 0
        )
        price = int(price_raw)
        # Swiggy sometimes returns prices in paise (x100)
        if price > 10000:
            price = price // 100
        unit = p.get("unit") or p.get("quantity") or p.get("weight") or ""
        if pid and name:
            out.append({"id": str(pid), "name": name, "price": price, "unit": unit})
    return out
