import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
    ShoppingCart, Trash2, Plus, Sparkles, Loader2,
    Check, ArrowLeft, MessageCircle, Info, X,
} from "lucide-react";

export default function CartPage() {
    const [cart, setCart] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refining, setRefining] = useState(false);
    const [checkingOut, setCheckingOut] = useState(false);
    const [confirmation, setConfirmation] = useState(null);
    const [newItem, setNewItem] = useState({ name: "", qty: "1 unit" });

    const load = async () => {
        try {
            const { data } = await api.get("/cart");
            setCart(data);
        } finally {
            setLoading(false);
        }
    };
    useEffect(() => { load(); }, []);

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

    const checkout = async () => {
        if (!cart?.items?.length) return;
        setCheckingOut(true);
        try {
            const { data } = await api.post(`/cart/${cart.id}/checkout`);
            setConfirmation(data.cart);
            setCart(null);
            toast.success("Order placed on Swiggy Instamart");
        } catch (err) {
            toast.error(err?.response?.data?.detail || "Checkout failed");
        } finally {
            setCheckingOut(false);
        }
    };

    if (confirmation) {
        return <OrderConfirmation order={confirmation} onDone={() => { setConfirmation(null); load(); }} />;
    }

    return (
        <div className="p-6 lg:p-12 max-w-4xl mx-auto" data-testid="cart-page">
            <div className="flex items-start justify-between gap-4 mb-8 animate-fade-up">
                <div>
                    <Link to="/app" className="inline-flex items-center text-sm text-ink-secondary hover:text-ink mb-3" data-testid="cart-back-link">
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
                        Items here came from your group chat or were added manually. Review, edit, and order — Jarvis will never order without your tap.
                    </p>
                </div>
            </div>

            <div className="rounded-2xl bg-[#FBF2EC] border border-terracotta/30 p-4 mb-6 flex items-start gap-3" data-testid="swiggy-mock-banner">
                <Info className="h-4 w-4 text-terracotta shrink-0 mt-0.5" />
                <p className="text-sm text-ink-secondary leading-relaxed">
                    <span className="font-semibold text-terracotta">Swiggy Instamart — POC mode.</span>{" "}
                    Checkout uses a mocked Swiggy MCP for now. Real integration plugs in at <code className="bg-white border border-stoke rounded px-1 py-0.5 text-xs">/cart/checkout</code> when keys are available.
                </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 mb-6">
                <Button onClick={refineFromChat} disabled={refining} className="rounded-full bg-sage hover:bg-sage-hover text-white" data-testid="refine-from-chat-button">
                    {refining ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                    Pull from chat
                </Button>
                {cart?.items?.length > 0 && (
                    <Button onClick={clearAll} variant="ghost" className="rounded-full text-ink-secondary hover:text-terracotta hover:bg-bg-muted" data-testid="clear-cart-button">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Clear all
                    </Button>
                )}
            </div>

            {loading ? (
                <p className="text-ink-muted">Loading…</p>
            ) : (cart?.items?.length || 0) === 0 ? (
                <div className="rounded-2xl border border-stoke bg-white p-12 text-center" data-testid="cart-empty">
                    <ShoppingCart className="h-10 w-10 text-ink-muted mx-auto mb-3" />
                    <p className="font-display text-xl text-ink">Your cart is empty</p>
                    <p className="text-ink-secondary mt-2 max-w-sm mx-auto">
                        Start chatting in your home group — Jarvis will pick up on things like "we're out of dal" and add them here.
                    </p>
                    <Link to="/app" data-testid="cart-empty-chat-link">
                        <Button className="mt-6 rounded-full bg-sage hover:bg-sage-hover text-white">
                            <MessageCircle className="h-4 w-4 mr-2" />
                            Open chat
                        </Button>
                    </Link>
                </div>
            ) : (
                <div className="rounded-2xl bg-white border border-stoke overflow-hidden" data-testid="cart-list">
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
                            data-testid="cart-new-name-input"
                        />
                        <Input
                            value={newItem.qty}
                            onChange={(e) => setNewItem({ ...newItem, qty: e.target.value })}
                            onKeyDown={(e) => e.key === "Enter" && addItem()}
                            placeholder="1 kg"
                            className="w-28 rounded-xl border-stoke bg-white h-10 focus-visible:ring-2 focus-visible:ring-terracotta"
                            data-testid="cart-new-qty-input"
                        />
                        <Button onClick={addItem} className="rounded-xl bg-sage hover:bg-sage-hover text-white h-10" data-testid="cart-add-button">
                            <Plus className="h-4 w-4 mr-1.5" />
                            Add
                        </Button>
                    </div>
                </div>
            )}

            {(cart?.items?.length || 0) > 0 && (
                <div className="mt-6 rounded-2xl bg-white border border-stoke p-6 flex flex-wrap items-center justify-between gap-4" data-testid="checkout-bar">
                    <div>
                        <p className="text-xs tracking-[0.18em] uppercase font-bold text-ink-muted mb-1">
                            Ready to order
                        </p>
                        <p className="font-display text-lg text-ink font-semibold">
                            {cart.items.length} items via Swiggy Instamart (mocked)
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
                        ) : (
                            <ShoppingCart className="h-4 w-4 mr-2" />
                        )}
                        {checkingOut ? "Placing order…" : "Order on Swiggy"}
                    </Button>
                </div>
            )}
        </div>
    );
}

function CartRow({ item, onChange, onRemove }) {
    const [name, setName] = useState(item.name);
    const [qty, setQty] = useState(item.qty);

    return (
        <div className="flex items-center gap-3 px-4 py-3 border-b border-stoke last:border-0" data-testid={`cart-row-${item.id}`}>
            <div className="flex-1 min-w-0 grid grid-cols-3 gap-3 items-center">
                <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={() => name !== item.name && onChange({ name })}
                    className="col-span-2 rounded-lg border-transparent bg-transparent hover:border-stoke hover:bg-bg-base focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:border-stoke text-ink font-medium h-9"
                    data-testid={`cart-name-${item.id}`}
                />
                <Input
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    onBlur={() => qty !== item.qty && onChange({ qty })}
                    className="rounded-lg border-transparent bg-transparent hover:border-stoke hover:bg-bg-base focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:border-stoke text-ink-secondary h-9"
                    data-testid={`cart-qty-${item.id}`}
                />
            </div>
            <div className="flex items-center gap-2 shrink-0">
                <span className="hidden md:inline text-[10px] uppercase tracking-[0.15em] font-bold text-ink-muted">
                    {item.source === "jarvis" ? "from chat" : item.added_by}
                </span>
                <Button onClick={onRemove} variant="ghost" size="icon" className="text-ink-muted hover:text-terracotta hover:bg-bg-muted h-8 w-8" data-testid={`cart-remove-${item.id}`}>
                    <Trash2 className="h-3.5 w-3.5" />
                </Button>
            </div>
        </div>
    );
}

function OrderConfirmation({ order, onDone }) {
    return (
        <div className="p-6 lg:p-12 max-w-2xl mx-auto" data-testid="order-confirmation">
            <div className="rounded-3xl bg-white border border-stoke p-10 text-center animate-fade-up">
                <span className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-good text-white mb-5">
                    <Check className="h-8 w-8" />
                </span>
                <p className="text-xs tracking-[0.2em] uppercase font-bold text-good mb-2">
                    Order placed
                </p>
                <h1 className="font-display text-3xl font-bold text-ink tracking-tight">
                    {order.items.length} items on the way
                </h1>
                <p className="text-ink-secondary mt-3">
                    Swiggy Instamart • Order <code className="bg-bg-base border border-stoke rounded px-2 py-0.5 text-sm font-mono">{order.swiggy_order_id}</code>
                </p>
                <div className="mt-6 grid grid-cols-3 gap-3 max-w-sm mx-auto">
                    <Stat label="Subtotal" value={`₹${order.subtotal}`} />
                    <Stat label="Delivery" value={order.delivery_fee === 0 ? "Free" : `₹${order.delivery_fee}`} />
                    <Stat label="ETA" value={`${order.eta_minutes} min`} />
                </div>
                <div className="mt-6 text-left bg-bg-base border border-stoke rounded-2xl p-4 max-h-60 overflow-y-auto">
                    {order.items.map((it) => (
                        <div key={it.id} className="flex items-center justify-between py-1.5 text-sm">
                            <span className="text-ink">
                                {it.name}{" "}
                                <span className="text-ink-muted text-xs">· {it.qty}</span>
                            </span>
                            <span className="text-ink-secondary">₹{it.price}</span>
                        </div>
                    ))}
                </div>
                <p className="mt-5 text-xs text-ink-muted">
                    This is a mocked Swiggy order for POC validation. No real money was charged.
                </p>
                <Button onClick={onDone} className="mt-6 rounded-full bg-sage hover:bg-sage-hover text-white" data-testid="confirmation-done">
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
