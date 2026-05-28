import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
    ShoppingCart, Trash2, Plus, Sparkles, Loader2,
    Check, ArrowLeft, MessageCircle, ExternalLink,
    Unlink, Zap,
} from "lucide-react";

export default function CartPage() {
    const [cart, setCart] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refining, setRefining] = useState(false);
    const [checkingOut, setCheckingOut] = useState(false);
    const [confirmation, setConfirmation] = useState(null);
    const [newItem, setNewItem] = useState({ name: "", qty: "1 unit" });
    const [swiggy, setSwiggy] = useState(null);
    const [showTokenModal, setShowTokenModal] = useState(false);

    const loadCart = async () => {
        try {
            const { data } = await api.get("/cart");
            setCart(data);
        } finally {
            setLoading(false);
        }
    };

    const loadSwiggyStatus = async () => {
        try {
            const { data } = await api.get("/swiggy/status");
            setSwiggy(data);
        } catch {
            setSwiggy({ connected: false });
        }
    };

    useEffect(() => {
        loadCart();
        loadSwiggyStatus();
        // If redirected back from OAuth
        const params = new URLSearchParams(window.location.search);
        if (params.get("swiggy") === "connected") {
            toast.success("Swiggy account connected!");
            window.history.replaceState({}, "", window.location.pathname);
            loadSwiggyStatus();
        }
    }, []);

    const refineFromChat = async () => {
        setRefining(true);
        try {
            const { data } = await api.post("/cart/from-chat");
            setCart(data);
            toast.success("Pulled fresh items from your chat");
        } catch (err) {
            toast.error(err?.response?.data?.detail || "Nothing new found");
        } finally {
            setRefining(false);
        }
    };

    const addItem = async () => {
        if (!newItem.name.trim()) return;
        try {
            const { data } = await api.post("/cart/item", { name: newItem.name.trim(), qty: newItem.qty || "1 unit" });
            setCart(data);
            setNewItem({ name: "", qty: "1 unit" });
        } catch {
            toast.error("Could not add");
        }
    };

    const removeItem = async (id) => {
        try {
            const { data } = await api.delete(`/cart/item/${id}`);
            setCart(data);
        } catch {
            toast.error("Delete failed");
        }
    };

    const updateItem = async (id, payload) => {
        try {
            const { data } = await api.put(`/cart/item/${id}`, payload);
            setCart(data);
        } catch {
            toast.error("Update failed");
        }
    };

    const clearAll = async () => {
        try {
            const { data } = await api.delete("/cart/clear");
            setCart(data);
            toast.success("Cart cleared");
        } catch {
            toast.error("Could not clear");
        }
    };

    const disconnectSwiggy = async () => {
        try {
            await api.delete("/swiggy/disconnect");
            setSwiggy({ connected: false });
            toast.success("Swiggy disconnected");
        } catch {
            toast.error("Could not disconnect");
        }
    };

    const checkout = async () => {
        if (!cart?.items?.length) return;
        setCheckingOut(true);
        try {
            const { data } = await api.post(`/cart/${cart.id}/checkout`);
            setConfirmation(data.cart);
            setCart(null);
            toast.success(swiggy?.connected ? "Order placed on Swiggy Instamart!" : "Demo order placed");
        } catch (err) {
            toast.error(err?.response?.data?.detail || "Checkout failed");
        } finally {
            setCheckingOut(false);
        }
    };

    if (confirmation) {
        return (
            <OrderConfirmation
                order={confirmation}
                isReal={swiggy?.connected}
                onDone={() => { setConfirmation(null); loadCart(); }}
            />
        );
    }

    return (
        <div className="p-6 lg:p-12 max-w-4xl mx-auto" data-testid="cart-page">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 mb-8 animate-fade-up">
                <div>
                    <Link to="/app" className="inline-flex items-center text-sm text-ink-secondary hover:text-ink mb-3">
                        <ArrowLeft className="h-4 w-4 mr-1" />
                        Back to chat
                    </Link>
                    <p className="text-xs tracking-[0.2em] uppercase font-bold text-terracotta mb-1.5">
                        Draft cart
                    </p>
                    <h1 className="font-display text-3xl lg:text-4xl font-bold text-ink tracking-tight">
                        {cart?.items?.length || 0} {cart?.items?.length === 1 ? "item" : "items"} ready
                    </h1>
                    <p className="text-ink-secondary mt-2 max-w-xl">
                        Items here came from your group chat or were added manually. Review, edit, and order.
                    </p>
                </div>
            </div>

            {/* Swiggy connection banner */}
            <SwiggyConnectBanner
                swiggy={swiggy}
                onConnect={() => setShowTokenModal(true)}
                onOAuth={() => window.location.href = `${process.env.REACT_APP_BACKEND_URL}/api/swiggy/auth`}
                onDisconnect={disconnectSwiggy}
            />

            {/* Cart actions */}
            <div className="flex flex-wrap items-center gap-3 mb-6 mt-6">
                <Button onClick={refineFromChat} disabled={refining} className="rounded-full bg-sage hover:bg-sage-hover text-white">
                    {refining ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                    Pull from chat
                </Button>
                {cart?.items?.length > 0 && (
                    <Button onClick={clearAll} variant="ghost" className="rounded-full text-ink-secondary hover:text-terracotta hover:bg-bg-muted">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Clear all
                    </Button>
                )}
            </div>

            {loading ? (
                <p className="text-ink-muted">Loading…</p>
            ) : (cart?.items?.length || 0) === 0 ? (
                <div className="rounded-2xl border border-stoke bg-white p-12 text-center">
                    <ShoppingCart className="h-10 w-10 text-ink-muted mx-auto mb-3" />
                    <p className="font-display text-xl text-ink">Your cart is empty</p>
                    <p className="text-ink-secondary mt-2 max-w-sm mx-auto">
                        Start chatting in your home group — HomeOS will pick up on things like "we're out of dal" and add them here.
                    </p>
                    <Link to="/app">
                        <Button className="mt-6 rounded-full bg-sage hover:bg-sage-hover text-white">
                            <MessageCircle className="h-4 w-4 mr-2" />
                            Open chat
                        </Button>
                    </Link>
                </div>
            ) : (
                <div className="rounded-2xl bg-white border border-stoke overflow-hidden">
                    {cart.items.map((it) => (
                        <CartRow key={it.id} item={it} onChange={(p) => updateItem(it.id, p)} onRemove={() => removeItem(it.id)} />
                    ))}
                    <div className="border-t border-stoke p-4 flex flex-wrap items-center gap-2 bg-bg-base">
                        <Input
                            value={newItem.name}
                            onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                            onKeyDown={(e) => e.key === "Enter" && addItem()}
                            placeholder="Add an item…"
                            className="flex-1 min-w-[180px] rounded-xl border-stoke bg-white h-10 focus-visible:ring-2 focus-visible:ring-terracotta"
                        />
                        <Input
                            value={newItem.qty}
                            onChange={(e) => setNewItem({ ...newItem, qty: e.target.value })}
                            onKeyDown={(e) => e.key === "Enter" && addItem()}
                            placeholder="1 kg"
                            className="w-28 rounded-xl border-stoke bg-white h-10 focus-visible:ring-2 focus-visible:ring-terracotta"
                        />
                        <Button onClick={addItem} className="rounded-xl bg-sage hover:bg-sage-hover text-white h-10">
                            <Plus className="h-4 w-4 mr-1.5" />
                            Add
                        </Button>
                    </div>
                </div>
            )}

            {/* Checkout bar */}
            {(cart?.items?.length || 0) > 0 && (
                <div className="mt-6 rounded-2xl bg-white border border-stoke p-6 flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <p className="text-xs tracking-[0.18em] uppercase font-bold text-ink-muted mb-1">
                            Ready to order
                        </p>
                        <p className="font-display text-lg text-ink font-semibold">
                            {cart.items.length} items via Swiggy Instamart
                            {!swiggy?.connected && (
                                <span className="ml-2 text-xs font-normal text-ink-muted">(demo mode)</span>
                            )}
                        </p>
                    </div>
                    <Button
                        onClick={checkout}
                        disabled={checkingOut}
                        className="rounded-full bg-terracotta hover:bg-terracotta-hover text-white h-12 px-7 shadow-md ring-1 ring-terracotta/40"
                        data-testid="checkout-button"
                    >
                        {checkingOut ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : swiggy?.connected ? (
                            <Zap className="h-4 w-4 mr-2" />
                        ) : (
                            <ShoppingCart className="h-4 w-4 mr-2" />
                        )}
                        {checkingOut ? "Placing order…" : swiggy?.connected ? "Order on Swiggy" : "Try demo order"}
                    </Button>
                </div>
            )}

            {showTokenModal && (
                <SwiggyTokenModal
                    onClose={() => setShowTokenModal(false)}
                    onSaved={() => { setShowTokenModal(false); loadSwiggyStatus(); }}
                />
            )}
        </div>
    );
}

// ── Swiggy connection banner ────────────────────────────────────────────────

function SwiggyConnectBanner({ swiggy, onConnect, onOAuth, onDisconnect }) {
    if (!swiggy) return null;

    if (swiggy.connected) {
        return (
            <div className="rounded-2xl bg-good/10 border border-good/30 p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <span className="h-8 w-8 rounded-full bg-good flex items-center justify-center shrink-0">
                        <Check className="h-4 w-4 text-white" />
                    </span>
                    <div>
                        <p className="text-sm font-semibold text-ink">Swiggy account connected</p>
                        <p className="text-xs text-ink-secondary">Orders will be placed directly on your Swiggy Instamart</p>
                    </div>
                </div>
                <Button onClick={onDisconnect} variant="ghost" size="sm" className="text-ink-muted hover:text-terracotta shrink-0">
                    <Unlink className="h-4 w-4 mr-1.5" />
                    Disconnect
                </Button>
            </div>
        );
    }

    return (
        <div className="rounded-2xl bg-[#FBF2EC] border border-terracotta/30 p-5">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="text-sm font-semibold text-ink mb-1">Connect your Swiggy account</p>
                    <p className="text-xs text-ink-secondary leading-relaxed max-w-lg">
                        Without a connected account, checkout runs in demo mode — no real order is placed.
                        Connect once and HomeOS will order directly from Swiggy Instamart for your household.
                    </p>
                </div>
                <div className="flex gap-2 shrink-0">
                    {swiggy.client_configured ? (
                        <Button onClick={onOAuth} size="sm" className="rounded-full bg-terracotta hover:bg-terracotta-hover text-white">
                            <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                            Login with Swiggy
                        </Button>
                    ) : (
                        <Button onClick={onConnect} size="sm" className="rounded-full bg-terracotta hover:bg-terracotta-hover text-white">
                            <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                            Connect Swiggy
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Swiggy token modal (browser session token workaround) ───────────────────

function SwiggyTokenModal({ onClose, onSaved }) {
    const [step, setStep] = useState(1);
    const [token, setToken] = useState("");
    const [saving, setSaving] = useState(false);

    const save = async () => {
        if (!token.trim()) return;
        setSaving(true);
        try {
            await api.post("/swiggy/set-token", { token: token.trim() });
            toast.success("Swiggy connected!");
            onSaved();
        } catch (err) {
            toast.error(err?.response?.data?.detail || "Could not save token");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl shadow-xl max-w-lg w-full p-8 animate-fade-up">
                <h2 className="font-display text-2xl font-bold text-ink mb-1">Connect Swiggy</h2>
                <p className="text-sm text-ink-secondary mb-6">
                    We'll use your existing Swiggy session to place real Instamart orders.
                </p>

                {step === 1 && (
                    <div className="space-y-4">
                        <Step n={1} active text="Log into Swiggy Instamart in Chrome" />
                        <Step n={2} text={<>Press <kbd className="bg-bg-base border border-stoke rounded px-1.5 py-0.5 text-xs font-mono">F12</kbd> → <strong>Network</strong> tab → reload the page</>} />
                        <Step n={3} text={<>Click any request to <code className="bg-bg-base border border-stoke rounded px-1 text-xs">www.swiggy.com</code> (e.g. <code className="bg-bg-base border border-stoke rounded px-1 text-xs">skeleton?lat=…</code>)</>} />
                        <Step n={4} text={<>In <strong>Request Headers</strong>, find <code className="bg-bg-base border border-stoke rounded px-1 text-xs">cookie:</code> → right-click the value → <strong>Copy value</strong> (it will be very long — that's normal)</>} />

                        <div className="flex gap-3 mt-6">
                            <Button onClick={onClose} variant="outline" className="flex-1 rounded-full">Cancel</Button>
                            <Button
                                onClick={() => { window.open("https://www.swiggy.com/instamart", "_blank"); setStep(2); }}
                                className="flex-1 rounded-full bg-terracotta hover:bg-terracotta-hover text-white"
                            >
                                <ExternalLink className="h-4 w-4 mr-2" />
                                Open Instamart
                            </Button>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-4">
                        <p className="text-sm text-ink-secondary">
                            Paste the full <code className="bg-bg-base border border-stoke rounded px-1 text-xs">cookie:</code> header value below (it will be a very long string):
                        </p>
                        <textarea
                            value={token}
                            onChange={(e) => setToken(e.target.value)}
                            placeholder="__SW=Ww3v…; tid=eyJ…; aws-waf-token=8cbc…"
                            rows={4}
                            className="w-full rounded-xl border border-stoke focus:outline-none focus:ring-2 focus:ring-terracotta font-mono text-xs p-3 resize-none bg-bg-base"
                        />
                        <p className="text-xs text-ink-muted">
                            Your token is stored only in your household's database and never leaves your server.
                        </p>
                        <div className="flex gap-3 mt-2">
                            <Button onClick={() => setStep(1)} variant="outline" className="flex-1 rounded-full">Back</Button>
                            <Button
                                onClick={save}
                                disabled={!token.trim() || saving}
                                className="flex-1 rounded-full bg-terracotta hover:bg-terracotta-hover text-white"
                            >
                                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                                {saving ? "Connecting…" : "Connect"}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function Step({ n, text, active }) {
    return (
        <div className={`flex gap-3 items-start p-3 rounded-xl ${active ? "bg-terracotta/10" : "bg-bg-base"}`}>
            <span className="h-6 w-6 rounded-full bg-terracotta/20 text-terracotta text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                {n}
            </span>
            <p className="text-sm text-ink leading-relaxed">{text}</p>
        </div>
    );
}

// ── Cart row ────────────────────────────────────────────────────────────────

function CartRow({ item, onChange, onRemove }) {
    const [name, setName] = useState(item.name);
    const [qty, setQty] = useState(item.qty);

    return (
        <div className="flex items-center gap-3 px-4 py-3 border-b border-stoke last:border-0">
            <div className="flex-1 min-w-0 grid grid-cols-3 gap-3 items-center">
                <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={() => name !== item.name && onChange({ name })}
                    className="col-span-2 rounded-lg border-transparent bg-transparent hover:border-stoke hover:bg-bg-base focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:border-stoke text-ink font-medium h-9"
                />
                <Input
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    onBlur={() => qty !== item.qty && onChange({ qty })}
                    className="rounded-lg border-transparent bg-transparent hover:border-stoke hover:bg-bg-base focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:border-stoke text-ink-secondary h-9"
                />
            </div>
            <div className="flex items-center gap-2 shrink-0">
                <span className="hidden md:inline text-[10px] uppercase tracking-[0.15em] font-bold text-ink-muted">
                    {item.source === "jarvis" ? "from chat" : item.added_by}
                </span>
                <Button onClick={onRemove} variant="ghost" size="icon" className="text-ink-muted hover:text-terracotta hover:bg-bg-muted h-8 w-8">
                    <Trash2 className="h-3.5 w-3.5" />
                </Button>
            </div>
        </div>
    );
}

// ── Order confirmation ──────────────────────────────────────────────────────

function OrderConfirmation({ order, isReal, onDone }) {
    return (
        <div className="p-6 lg:p-12 max-w-2xl mx-auto">
            <div className="rounded-3xl bg-white border border-stoke p-10 text-center animate-fade-up">
                <span className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-good text-white mb-5">
                    <Check className="h-8 w-8" />
                </span>
                <p className="text-xs tracking-[0.2em] uppercase font-bold text-good mb-2">
                    {isReal ? "Order placed on Swiggy" : "Demo order placed"}
                </p>
                <h1 className="font-display text-3xl font-bold text-ink tracking-tight">
                    {order.items?.length || 0} items on the way
                </h1>
                <p className="text-ink-secondary mt-3">
                    Swiggy Instamart • Order{" "}
                    <code className="bg-bg-base border border-stoke rounded px-2 py-0.5 text-sm font-mono">
                        {order.swiggy_order_id}
                    </code>
                </p>
                <div className="mt-6 grid grid-cols-3 gap-3 max-w-sm mx-auto">
                    <Stat label="Subtotal" value={`₹${order.subtotal || order.estimated_total || 0}`} />
                    <Stat label="Delivery" value={order.delivery_fee === 0 ? "Free" : `₹${order.delivery_fee ?? 29}`} />
                    <Stat label="ETA" value={`${order.eta_minutes} min`} />
                </div>
                {order.items?.length > 0 && (
                    <div className="mt-6 text-left bg-bg-base border border-stoke rounded-2xl p-4 max-h-60 overflow-y-auto">
                        {order.items.map((it) => (
                            <div key={it.id} className="flex items-center justify-between py-1.5 text-sm">
                                <span className="text-ink">
                                    {it.name}{" "}
                                    <span className="text-ink-muted text-xs">· {it.qty}</span>
                                </span>
                                {it.price && <span className="text-ink-secondary">₹{it.price}</span>}
                            </div>
                        ))}
                    </div>
                )}
                {!isReal && (
                    <p className="mt-5 text-xs text-ink-muted">
                        Demo mode — connect your Swiggy account to place real orders.
                    </p>
                )}
                <Button onClick={onDone} className="mt-6 rounded-full bg-sage hover:bg-sage-hover text-white">
                    Back to chat
                </Button>
            </div>
        </div>
    );
}

const Stat = ({ label, value }) => (
    <div className="bg-bg-base border border-stoke rounded-xl py-3 px-2">
        <p className="text-[10px] tracking-[0.15em] uppercase font-bold text-ink-muted">{label}</p>
        <p className="font-display text-lg font-semibold text-ink mt-1">{value}</p>
    </div>
);
