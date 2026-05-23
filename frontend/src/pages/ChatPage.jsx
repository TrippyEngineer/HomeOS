import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, API } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
    Send, Loader2, Sparkles, Users, Copy, RefreshCw,
    ShoppingCart, Check, CheckCheck,
    UtensilsCrossed, ExternalLink,
} from "lucide-react";

const FALLBACK_POLL_MS = 4000;

const formatTime = (iso) => {
    try {
        return new Date(iso).toLocaleTimeString("en-IN", {
            hour: "2-digit", minute: "2-digit", hour12: false,
        });
    } catch { return ""; }
};

const formatDateLabel = (iso) => {
    const d = new Date(iso);
    const today = new Date();
    const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
};

export default function ChatPage() {
    const { user, household, setHousehold, token } = useAuth();
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [sending, setSending] = useState(false);
    const [loading, setLoading] = useState(true);
    const [members, setMembers] = useState([]);
    const [householdData, setHouseholdData] = useState(household);
    const [membersOpen, setMembersOpen] = useState(false);
    const [draftCart, setDraftCart] = useState(null);
    const [activeRecipeId, setActiveRecipeId] = useState(null);
    const [streamLive, setStreamLive] = useState(false);
    const scrollRef = useRef(null);
    const lastTsRef = useRef("");
    const seenIdsRef = useRef(new Set());
    const esRef = useRef(null);
    const pollTimerRef = useRef(null);

    const addMessage = (m) => {
        if (!m || seenIdsRef.current.has(m.id)) return;
        seenIdsRef.current.add(m.id);
        setMessages((prev) => [...prev, m]);
        if (m.created_at > lastTsRef.current) lastTsRef.current = m.created_at;
    };

    const loadInitial = async () => {
        try {
            const [h, c, m] = await Promise.all([
                api.get("/chat/history"),
                api.get("/cart"),
                api.get("/household"),
            ]);
            h.data.forEach((msg) => seenIdsRef.current.add(msg.id));
            setMessages(h.data);
            setDraftCart(c.data);
            setMembers(m.data.members);
            setHouseholdData(m.data.household);
            setHousehold(m.data.household);
            if (h.data.length) lastTsRef.current = h.data[h.data.length - 1].created_at;
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadInitial(); }, []);

    // Real-time push via SSE; falls back to polling if connection fails
    useEffect(() => {
        if (!token) return;

        let cancelled = false;
        const startSSE = () => {
            try {
                const es = new EventSource(`${API}/chat/stream?token=${encodeURIComponent(token)}`);
                esRef.current = es;
                es.addEventListener("ready", () => {
                    if (cancelled) return;
                    setStreamLive(true);
                    // clear polling once SSE is alive
                    if (pollTimerRef.current) {
                        clearInterval(pollTimerRef.current);
                        pollTimerRef.current = null;
                    }
                });
                es.addEventListener("message", async (ev) => {
                    try {
                        const payload = JSON.parse(ev.data);
                        if (payload.type === "message" && payload.message) {
                            addMessage(payload.message);
                            if (["cart_proposal", "recipe", "system"].includes(payload.message.role)) {
                                const c = await api.get("/cart");
                                setDraftCart(c.data);
                            }
                        }
                    } catch {}
                });
                es.onerror = () => {
                    setStreamLive(false);
                    es.close();
                    esRef.current = null;
                    if (!cancelled) startPolling();
                };
            } catch (e) {
                startPolling();
            }
        };
        const startPolling = () => {
            if (pollTimerRef.current) return;
            pollTimerRef.current = setInterval(async () => {
                if (!lastTsRef.current) return;
                try {
                    const { data } = await api.get(`/chat/since?after=${encodeURIComponent(lastTsRef.current)}`);
                    if (data.length) {
                        data.forEach(addMessage);
                        if (data.some((d) => ["cart_proposal", "recipe", "system"].includes(d.role))) {
                            const c = await api.get("/cart");
                            setDraftCart(c.data);
                        }
                    }
                } catch {}
            }, FALLBACK_POLL_MS);
        };

        startSSE();
        return () => {
            cancelled = true;
            if (esRef.current) { esRef.current.close(); esRef.current = null; }
            if (pollTimerRef.current) { clearInterval(pollTimerRef.current); pollTimerRef.current = null; }
        };
    }, [token]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, sending]);

    const send = async (text) => {
        const t = (text ?? input).trim();
        if (!t || sending) return;
        setInput("");
        setSending(true);
        const optimisticId = `temp-${Date.now()}`;
        const optimistic = {
            id: optimisticId, sender_id: user.id, sender_name: user.name,
            sender_color: user.color, role: "user", content: t,
            created_at: new Date().toISOString(), _optimistic: true,
        };
        setMessages((m) => [...m, optimistic]);
        try {
            const { data } = await api.post("/chat", { content: t });
            // Remove optimistic; SSE will deliver canonical messages
            setMessages((m) => m.filter((x) => x.id !== optimisticId));
            // If SSE isn't live, attach messages directly (POST already returned them)
            if (!streamLive) {
                data.messages.forEach(addMessage);
                if (data.messages.some((m) => ["cart_proposal", "recipe"].includes(m.role))) {
                    const c = await api.get("/cart");
                    setDraftCart(c.data);
                }
            }
        } catch (err) {
            toast.error("Could not send. Try again.");
            setMessages((m) => m.filter((x) => x.id !== optimisticId));
        } finally {
            setSending(false);
        }
    };

    const onKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            send();
        }
    };

    const copyInvite = async () => {
        if (!householdData?.invite_code) return;
        try {
            await navigator.clipboard.writeText(householdData.invite_code);
            toast.success("Invite code copied");
        } catch { toast.error("Could not copy"); }
    };

    const rotateInvite = async () => {
        try {
            const { data } = await api.post("/household/rotate-invite");
            setHouseholdData(data); setHousehold(data);
            toast.success("New invite code generated");
        } catch { toast.error("Could not rotate code"); }
    };

    const grouped = [];
    let lastDate = "";
    messages.forEach((m) => {
        const dl = formatDateLabel(m.created_at);
        if (dl !== lastDate) {
            grouped.push({ type: "date", label: dl, id: `date-${dl}-${m.id}` });
            lastDate = dl;
        }
        grouped.push({ type: "msg", msg: m });
    });

    const cartCount = draftCart?.items?.length || 0;

    return (
        <div className="flex flex-col bg-[#E8E1D5] h-[calc(100dvh-3.5rem-65px)] lg:h-screen" data-testid="chat-page">
            {/* WhatsApp-style chat header */}
            <header className="bg-sage-deep text-white shrink-0" data-testid="chat-header">
                <div className="px-3 sm:px-5 lg:px-6 py-3 flex items-center justify-between gap-3">
                    <button
                        onClick={() => setMembersOpen(true)}
                        className="flex items-center gap-3 min-w-0 flex-1 hover:bg-white/10 rounded-xl py-1 px-2 -mx-2 transition-colors text-left"
                        data-testid="chat-household-button"
                    >
                        <div className="relative shrink-0">
                            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-terracotta text-white">
                                <Users className="h-5 w-5" />
                            </span>
                            <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-sage-deep ${streamLive ? "bg-saffron" : "bg-ink-muted"}`} title={streamLive ? "Live" : "Reconnecting…"} />
                        </div>
                        <div className="min-w-0">
                            <p className="font-display font-bold text-[16px] truncate leading-tight" data-testid="chat-household-name">
                                {householdData?.name || "Home"}
                            </p>
                            <p className="text-[11px] text-white/75 truncate">
                                {members.length} {members.length === 1 ? "member" : "members"} · HomeOS listening
                            </p>
                        </div>
                    </button>
                    <Link to="/app/cart" data-testid="chat-cart-link">
                        <Button variant="ghost" size="icon" className="text-white hover:bg-white/15 hover:text-white relative h-10 w-10">
                            <ShoppingCart className="h-5 w-5" />
                            {cartCount > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 h-5 min-w-[20px] px-1 rounded-full bg-terracotta text-white text-[10px] font-bold flex items-center justify-center border-2 border-sage-deep" data-testid="chat-cart-badge">
                                    {cartCount}
                                </span>
                            )}
                        </Button>
                    </Link>
                </div>
            </header>

            {/* Messages */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto overscroll-contain"
                style={{
                    backgroundColor: "#E8E1D5",
                    backgroundImage: "radial-gradient(rgba(31,42,36,0.07) 1px, transparent 1px), radial-gradient(rgba(192,81,42,0.05) 1px, transparent 1px)",
                    backgroundSize: "22px 22px, 38px 38px",
                    backgroundPosition: "0 0, 11px 11px",
                }}
                data-testid="chat-messages"
            >
                <div className="max-w-3xl mx-auto px-3 sm:px-5 lg:px-6 py-4 sm:py-5 space-y-1.5">
                    {loading ? (
                        <p className="text-ink-muted text-center mt-8">Loading chat…</p>
                    ) : messages.length === 0 ? (
                        <EmptyState onSuggestion={send} householdName={householdData?.name} />
                    ) : (
                        grouped.map((g) => {
                            if (g.type === "date") {
                                return (
                                    <div key={g.id} className="flex justify-center my-3" data-testid="date-separator">
                                        <span className="bg-white/90 rounded-full px-3 py-1 text-[11px] tracking-wide text-ink-secondary shadow-sm font-medium">
                                            {g.label}
                                        </span>
                                    </div>
                                );
                            }
                            return <MessageBubble key={g.msg.id} msg={g.msg} currentUserId={user.id} onRecipeClick={setActiveRecipeId} />;
                        })
                    )}
                    {sending && (
                        <div className="flex justify-start ml-1 mt-2">
                            <div className="bg-white rounded-2xl rounded-bl-md px-4 py-2.5 shadow-sm border border-stoke">
                                <span className="inline-flex items-center gap-2 text-ink-secondary text-sm">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin text-terracotta" />
                                    HomeOS is reading…
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Input bar */}
            <div className="bg-bg-base border-t-2 border-stoke px-3 sm:px-5 lg:px-6 py-3 shrink-0">
                <div className="max-w-3xl mx-auto flex items-end gap-2">
                    <div className="flex-1 flex items-end gap-1.5 bg-white rounded-3xl border-2 border-stoke px-3 py-1.5 focus-within:border-terracotta transition-colors shadow-sm">
                        <Textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={onKeyDown}
                            placeholder="Message your home…"
                            rows={1}
                            className="flex-1 bg-transparent border-0 focus-visible:ring-0 resize-none shadow-none min-h-[36px] max-h-32 py-1.5 text-ink text-[15px]"
                            data-testid="chat-input"
                        />
                    </div>
                    <button
                        onClick={() => send()}
                        disabled={sending || !input.trim()}
                        className="btn-accent h-11 w-11 p-0 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                        data-testid="chat-send-button"
                        aria-label="Send"
                    >
                        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </button>
                </div>
                <p className="text-[10px] sm:text-[11px] text-ink-muted mt-1.5 text-center">
                    HomeOS observes silently · Say "homeos" or ask a question to get a reply
                </p>
            </div>

            {/* Members + Invite dialog */}
            <Dialog open={membersOpen} onOpenChange={setMembersOpen}>
                <DialogContent className="bg-white border-2 border-stoke rounded-3xl max-w-md" data-testid="members-dialog">
                    <DialogHeader>
                        <DialogTitle className="font-display text-3xl text-ink tracking-tight">
                            {householdData?.name}
                        </DialogTitle>
                        <DialogDescription className="text-ink-secondary">
                            Your household members and invite code.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-5 mt-2">
                        <div>
                            <p className="overline text-ink-muted mb-3">
                                Members · {members.length}
                            </p>
                            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                                {members.map((m) => (
                                    <div key={m.id} className="flex items-center gap-3 bg-bg-base border border-stoke rounded-xl px-3 py-2.5" data-testid={`member-row-${m.id}`}>
                                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white text-sm font-bold shrink-0" style={{ background: m.color || "#3B5A3F" }}>
                                            {m.name?.[0]?.toUpperCase()}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-ink font-semibold text-sm truncate">{m.name}</p>
                                            <p className="text-xs text-ink-muted truncate">{m.id === user.id ? "You" : "Member"}</p>
                                        </div>
                                    </div>
                                ))}
                                <div className="flex items-center gap-3 bg-terracotta-soft border border-terracotta/30 rounded-xl px-3 py-2.5">
                                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-terracotta text-white shrink-0">
                                        <Sparkles className="h-4 w-4" />
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-ink font-semibold text-sm">HomeOS</p>
                                        <p className="text-xs text-ink-muted">AI household agent · always present</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-ink text-white rounded-2xl p-4">
                            <p className="overline text-saffron mb-2">Invite code</p>
                            <div className="flex items-center gap-2">
                                <Input readOnly value={householdData?.invite_code || ""} className="font-mono tracking-[0.3em] uppercase font-bold text-white text-lg h-12 bg-white/10 border-white/20 focus-visible:ring-0 focus-visible:border-saffron" data-testid="invite-code-display" />
                                <button onClick={copyInvite} className="btn-accent h-12 w-12 p-0" data-testid="copy-invite-button" aria-label="Copy invite">
                                    <Copy className="h-4 w-4" />
                                </button>
                                <button onClick={rotateInvite} className="h-12 w-12 p-0 inline-flex items-center justify-center rounded-full bg-white/15 hover:bg-white/25 text-white transition-colors" data-testid="rotate-invite-button" aria-label="Rotate invite">
                                    <RefreshCw className="h-4 w-4" />
                                </button>
                            </div>
                            <p className="text-xs text-white/70 mt-3">
                                Share this code so anyone you live with can join the home group.
                            </p>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <RecipeDialog recipeId={activeRecipeId} onClose={() => setActiveRecipeId(null)} />
        </div>
    );
}

function RecipeDialog({ recipeId, onClose }) {
    const [recipe, setRecipe] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!recipeId) { setRecipe(null); return; }
        setLoading(true);
        api.get(`/recipes/${recipeId}`)
            .then(({ data }) => setRecipe(data))
            .catch(() => toast.error("Could not load recipe"))
            .finally(() => setLoading(false));
    }, [recipeId]);

    return (
        <Dialog open={!!recipeId} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="bg-white border-2 border-stoke rounded-3xl max-w-2xl max-h-[90vh] overflow-y-auto p-0" data-testid="recipe-dialog">
                {loading || !recipe ? (
                    <div className="p-10 flex items-center justify-center">
                        <Loader2 className="h-5 w-5 animate-spin text-terracotta" />
                    </div>
                ) : (
                    <>
                        {recipe.thumbnail && (
                            <div className="aspect-[16/9] overflow-hidden bg-bg-muted" data-recipe-thumb>
                                <img src={recipe.thumbnail} alt={recipe.title} className="w-full h-full object-cover" referrerPolicy="no-referrer"
                                    onError={(e) => { const wrap = e.currentTarget.closest("[data-recipe-thumb]"); if (wrap) wrap.style.display = "none"; }} />
                            </div>
                        )}
                        <div className="p-6 sm:p-8">
                            <DialogHeader>
                                <p className="overline text-terracotta mb-1">
                                    {recipe.cuisine || "Recipe"}{recipe.servings && ` · Serves ${recipe.servings}`}
                                </p>
                                <DialogTitle className="display-stamp text-3xl sm:text-4xl text-ink">
                                    {recipe.title}
                                </DialogTitle>
                                {recipe.summary && (
                                    <DialogDescription className="text-ink-secondary text-[15px] leading-relaxed">
                                        {recipe.summary}
                                    </DialogDescription>
                                )}
                            </DialogHeader>
                            {recipe.source_owner && (
                                <p className="text-xs text-ink-muted mt-2">
                                    Shared by {recipe.shared_by} · via @{recipe.source_owner}
                                </p>
                            )}
                            <div className="mt-6">
                                <p className="overline text-ink-muted mb-3">Ingredients · {recipe.ingredients?.length || 0}</p>
                                <ul className="space-y-1.5">
                                    {(recipe.ingredients || []).map((ing, i) => (
                                        <li key={i} className="flex items-baseline justify-between gap-3 text-sm py-1.5 border-b border-stoke last:border-0" data-testid={`recipe-ingredient-${i}`}>
                                            <span className="text-ink font-medium">{ing.name}</span>
                                            <span className="text-ink-muted text-xs whitespace-nowrap">{ing.qty}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            {recipe.steps?.length > 0 && (
                                <div className="mt-6">
                                    <p className="overline text-ink-muted mb-3">Steps</p>
                                    <ol className="space-y-3">
                                        {recipe.steps.map((s, i) => (
                                            <li key={i} className="flex gap-3 text-[15px]" data-testid={`recipe-step-${i}`}>
                                                <span className="shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-full bg-terracotta text-white text-xs font-bold">{i + 1}</span>
                                                <span className="text-ink-secondary leading-relaxed">{s}</span>
                                            </li>
                                        ))}
                                    </ol>
                                </div>
                            )}
                            <div className="mt-7 flex flex-wrap items-center gap-3">
                                <Link to="/app/cart" data-testid="recipe-view-cart">
                                    <button className="btn-cta px-5 py-2.5 text-sm">
                                        <ShoppingCart className="h-4 w-4 mr-2" />
                                        View cart
                                    </button>
                                </Link>
                                {recipe.source_url && (
                                    <a href={recipe.source_url} target="_blank" rel="noopener noreferrer" data-testid="recipe-source-link">
                                        <button className="inline-flex items-center rounded-full bg-white border-2 border-ink text-ink font-semibold px-5 py-2 text-sm hover:bg-ink hover:text-white transition-colors">
                                            <ExternalLink className="h-4 w-4 mr-2" />
                                            Open on Instagram
                                        </button>
                                    </a>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}

function MessageBubble({ msg, currentUserId, onRecipeClick }) {
    const isMine = msg.sender_id === currentUserId;
    const isSystem = msg.role === "system";
    const isJarvis = msg.role === "assistant";
    const isCartProposal = msg.role === "cart_proposal";
    const isRecipe = msg.role === "recipe";

    if (isSystem) {
        return (
            <div className="flex justify-center my-2" data-testid="system-message">
                <span className="bg-white/90 rounded-full px-3 py-1 text-[11px] text-ink-secondary shadow-sm max-w-[85%] text-center">
                    {msg.content}
                </span>
            </div>
        );
    }

    if (isRecipe) {
        return (
            <div className="flex justify-start mb-2" data-testid="recipe-message">
                <button onClick={() => onRecipeClick(msg.recipe_id)} className="max-w-[88%] sm:max-w-[80%] rounded-2xl rounded-bl-md bg-white border-2 border-sage/30 shadow-sm overflow-hidden text-left hover:border-sage transition-colors group" data-testid={`recipe-card-${msg.recipe_id}`}>
                    <div className="px-4 pt-3 pb-2 flex items-center gap-2">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-terracotta text-white">
                            <Sparkles className="h-3 w-3" />
                        </span>
                        <p className="font-semibold text-sm text-terracotta">HomeOS</p>
                        <span className="overline text-ink-muted ml-auto">recipe</span>
                    </div>
                    {msg.recipe_thumbnail && (
                        <div className="aspect-[16/10] overflow-hidden bg-bg-muted" data-recipe-thumb>
                            <img src={msg.recipe_thumbnail} alt={msg.recipe_title} className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" referrerPolicy="no-referrer"
                                onError={(e) => { const wrap = e.currentTarget.closest("[data-recipe-thumb]"); if (wrap) wrap.style.display = "none"; }} />
                        </div>
                    )}
                    <div className="px-4 py-3 space-y-1">
                        <p className="font-display text-xl font-bold text-ink leading-snug tracking-tight">
                            {msg.recipe_title}
                        </p>
                        {msg.recipe_summary && (
                            <p className="text-sm text-ink-secondary leading-snug line-clamp-2">
                                {msg.recipe_summary}
                            </p>
                        )}
                        {msg.source_owner && (
                            <p className="text-xs text-ink-muted">via @{msg.source_owner}</p>
                        )}
                    </div>
                    <div className="bg-sage-soft hover:bg-sage/20 transition-colors px-4 py-2.5 flex items-center justify-between border-t border-sage/20">
                        <span className="text-xs font-bold text-sage-deep flex items-center gap-1.5">
                            <UtensilsCrossed className="h-3.5 w-3.5" />
                            {msg.ingredients_count} ingredients added to cart
                        </span>
                        <span className="text-sage-deep text-sm font-bold">View →</span>
                    </div>
                    <div className="px-4 pb-2 text-right">
                        <span className="text-[10px] text-ink-muted">{formatTime(msg.created_at)}</span>
                    </div>
                </button>
            </div>
        );
    }

    if (isCartProposal) {
        return (
            <div className="flex justify-start mb-2" data-testid="cart-proposal-message">
                <div className="max-w-[88%] sm:max-w-[80%] rounded-2xl rounded-bl-md bg-white border-2 border-terracotta/40 shadow-sm overflow-hidden">
                    <div className="px-4 pt-3 pb-2 flex items-center gap-2">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-terracotta text-white">
                            <Sparkles className="h-3 w-3" />
                        </span>
                        <p className="font-semibold text-sm text-terracotta">HomeOS</p>
                    </div>
                    <div className="px-4 pb-3">
                        <p className="text-ink text-[15px] leading-relaxed">{msg.content}</p>
                    </div>
                    <Link to="/app/cart">
                        <div className="bg-terracotta-soft hover:bg-terracotta/15 transition-colors px-4 py-3 flex items-center justify-between border-t border-terracotta/20 cursor-pointer" data-testid="cart-proposal-link">
                            <div className="flex items-center gap-2">
                                <ShoppingCart className="h-4 w-4 text-terracotta" />
                                <span className="text-sm font-bold text-terracotta">Review & order ({msg.cart_items_count} items)</span>
                            </div>
                            <span className="text-terracotta text-lg font-bold">→</span>
                        </div>
                    </Link>
                    <div className="px-4 pb-2 text-right">
                        <span className="text-[10px] text-ink-muted">{formatTime(msg.created_at)}</span>
                    </div>
                </div>
            </div>
        );
    }

    if (isMine) {
        return (
            <div className="flex justify-end mb-1" data-testid="own-message">
                <div className="max-w-[88%] sm:max-w-[80%] bg-[#D9E8D5] text-ink rounded-2xl rounded-br-md px-3.5 py-2 shadow-sm">
                    <p className="whitespace-pre-wrap text-[15px] leading-relaxed break-words">{msg.content}</p>
                    <div className="flex items-center justify-end gap-1 mt-0.5">
                        <span className="text-[10px] text-ink-muted">{formatTime(msg.created_at)}</span>
                        {msg._optimistic ? <Check className="h-3 w-3 text-ink-muted" /> : <CheckCheck className="h-3 w-3 text-sage-deep" />}
                    </div>
                </div>
            </div>
        );
    }

    const senderColor = msg.sender_color || (isJarvis ? "#C0512A" : "#3B5A3F");
    return (
        <div className="flex justify-start mb-1" data-testid={isJarvis ? "jarvis-message" : "other-message"}>
            <div className={`max-w-[88%] sm:max-w-[80%] rounded-2xl rounded-bl-md px-3.5 py-2 shadow-sm ${isJarvis ? "bg-terracotta-soft border border-terracotta/25" : "bg-white"}`}>
                <div className="flex items-center gap-1.5 mb-0.5">
                    {isJarvis && (
                        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-terracotta text-white">
                            <Sparkles className="h-2.5 w-2.5" />
                        </span>
                    )}
                    <p className="text-[12px] font-bold" style={{ color: senderColor }}>{msg.sender_name}</p>
                </div>
                <p className="whitespace-pre-wrap text-ink text-[15px] leading-relaxed break-words">{msg.content}</p>
                <div className="text-right">
                    <span className="text-[10px] text-ink-muted">{formatTime(msg.created_at)}</span>
                </div>
            </div>
        </div>
    );
}

function EmptyState({ onSuggestion, householdName }) {
    const samples = [
        "We're running low on toor dal and atta",
        "HomeOS, what should we cook tonight?",
        "Paneer khatam ho gaya — order kar do",
        "Need milk, curd and bread for tomorrow",
    ];
    return (
        <div className="flex flex-col items-center text-center py-10 sm:py-12 animate-fade-up">
            <span className="inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-sage-deep text-white mb-5 shadow-soft-lift">
                <Sparkles className="h-7 w-7" />
            </span>
            <h2 className="display-stamp text-3xl sm:text-4xl text-ink">
                Welcome to {householdName || "your home"}
            </h2>
            <p className="text-ink-secondary mt-3 max-w-md text-[15px]">
                Chat naturally with the people you live with. HomeOS listens quietly and
                builds a shared cart when groceries come up.
            </p>
            <div className="mt-7 grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-2xl w-full">
                {samples.map((s, i) => (
                    <button key={i} onClick={() => onSuggestion(s)} className="text-left rounded-2xl border-2 border-stoke bg-white px-4 py-3 text-sm text-ink hover:border-terracotta hover:bg-terracotta-soft transition-colors shadow-sm font-medium" data-testid={`chat-suggestion-${i}`}>
                        {s}
                    </button>
                ))}
            </div>
        </div>
    );
}
