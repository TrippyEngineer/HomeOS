import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
    Send, Loader2, Sparkles, Users, Copy, RefreshCw,
    ShoppingCart, Smile, Paperclip, Check, CheckCheck,
} from "lucide-react";

const POLL_MS = 3500;

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
    const { user, household, setHousehold } = useAuth();
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [sending, setSending] = useState(false);
    const [loading, setLoading] = useState(true);
    const [members, setMembers] = useState([]);
    const [householdData, setHouseholdData] = useState(household);
    const [membersOpen, setMembersOpen] = useState(false);
    const [draftCart, setDraftCart] = useState(null);
    const scrollRef = useRef(null);
    const lastTsRef = useRef("");

    const loadInitial = async () => {
        try {
            const [h, c, m] = await Promise.all([
                api.get("/chat/history"),
                api.get("/cart"),
                api.get("/household"),
            ]);
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

    // Polling for new messages
    useEffect(() => {
        const t = setInterval(async () => {
            if (!lastTsRef.current) return;
            try {
                const { data } = await api.get(`/chat/since?after=${encodeURIComponent(lastTsRef.current)}`);
                if (data.length) {
                    setMessages((m) => [...m, ...data]);
                    lastTsRef.current = data[data.length - 1].created_at;
                    // Refresh cart on cart proposals
                    if (data.some((d) => d.role === "cart_proposal" || d.role === "system")) {
                        const c = await api.get("/cart");
                        setDraftCart(c.data);
                    }
                }
            } catch {}
        }, POLL_MS);
        return () => clearInterval(t);
    }, []);

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
        const optimistic = {
            id: `temp-${Date.now()}`,
            sender_id: user.id,
            sender_name: user.name,
            sender_color: user.color,
            role: "user",
            content: t,
            created_at: new Date().toISOString(),
            _optimistic: true,
        };
        setMessages((m) => [...m, optimistic]);
        try {
            const { data } = await api.post("/chat", { content: t });
            setMessages((m) => {
                const filtered = m.filter((x) => x.id !== optimistic.id);
                return [...filtered, ...data.messages];
            });
            const lastMsg = data.messages[data.messages.length - 1];
            if (lastMsg) lastTsRef.current = lastMsg.created_at;
            // Refresh cart if any cart proposal came back
            if (data.messages.some((m) => m.role === "cart_proposal")) {
                const c = await api.get("/cart");
                setDraftCart(c.data);
            }
        } catch (err) {
            toast.error("Could not send. Try again.");
            setMessages((m) => m.filter((x) => x.id !== optimistic.id));
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
        } catch {
            toast.error("Could not copy");
        }
    };

    const rotateInvite = async () => {
        try {
            const { data } = await api.post("/household/rotate-invite");
            setHouseholdData(data);
            setHousehold(data);
            toast.success("New invite code generated");
        } catch {
            toast.error("Could not rotate code");
        }
    };

    // Group messages by date
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
        <div className="h-screen flex flex-col bg-[#EDE6DD] lg:bg-bg-base" data-testid="chat-page">
            {/* WhatsApp-style header */}
            <header className="bg-sage text-white shrink-0" data-testid="chat-header">
                <div className="px-4 lg:px-6 py-3 flex items-center justify-between gap-3">
                    <button
                        onClick={() => setMembersOpen(true)}
                        className="flex items-center gap-3 min-w-0 flex-1 hover:bg-white/10 rounded-xl py-1 px-2 -mx-2 transition-colors text-left"
                        data-testid="chat-household-button"
                    >
                        <div className="relative shrink-0">
                            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white">
                                <Users className="h-5 w-5" />
                            </span>
                        </div>
                        <div className="min-w-0">
                            <p className="font-display font-semibold text-[15px] truncate" data-testid="chat-household-name">
                                {householdData?.name || "Home"}
                            </p>
                            <p className="text-[11px] text-white/80 truncate">
                                {members.length} {members.length === 1 ? "member" : "members"}
                                {" • Jarvis is listening"}
                            </p>
                        </div>
                    </button>
                    <Link to="/app/cart" data-testid="chat-cart-link">
                        <Button variant="ghost" size="icon" className="text-white hover:bg-white/15 hover:text-white relative h-10 w-10">
                            <ShoppingCart className="h-5 w-5" />
                            {cartCount > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 h-5 min-w-[20px] px-1 rounded-full bg-terracotta text-white text-[10px] font-bold flex items-center justify-center" data-testid="chat-cart-badge">
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
                className="flex-1 overflow-y-auto"
                style={{
                    backgroundColor: "#EDE6DD",
                    backgroundImage:
                        "radial-gradient(rgba(84,110,88,0.08) 1px, transparent 1px), radial-gradient(rgba(217,119,87,0.04) 1px, transparent 1px)",
                    backgroundSize: "22px 22px, 38px 38px",
                    backgroundPosition: "0 0, 11px 11px",
                }}
                data-testid="chat-messages"
            >
                <div className="max-w-3xl mx-auto px-3 lg:px-6 py-5 space-y-1.5">
                    {loading ? (
                        <p className="text-ink-muted text-center mt-8">Loading chat…</p>
                    ) : messages.length === 0 ? (
                        <EmptyState onSuggestion={send} householdName={householdData?.name} />
                    ) : (
                        grouped.map((g, idx) => {
                            if (g.type === "date") {
                                return (
                                    <div key={g.id} className="flex justify-center my-3" data-testid="date-separator">
                                        <span className="bg-white/90 rounded-full px-3 py-1 text-[11px] tracking-wide text-ink-secondary shadow-sm">
                                            {g.label}
                                        </span>
                                    </div>
                                );
                            }
                            return <MessageBubble key={g.msg.id} msg={g.msg} currentUserId={user.id} />;
                        })
                    )}
                    {sending && (
                        <div className="flex justify-start ml-1 mt-2">
                            <div className="bg-white rounded-2xl rounded-bl-md px-4 py-2.5 shadow-sm">
                                <span className="inline-flex items-center gap-2 text-ink-secondary text-sm">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin text-terracotta" />
                                    Jarvis is reading…
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Input bar */}
            <div className="bg-bg-base border-t border-stoke px-3 lg:px-6 py-3 shrink-0">
                <div className="max-w-3xl mx-auto flex items-end gap-2">
                    <div className="flex-1 flex items-end gap-1.5 bg-white rounded-3xl border border-stoke px-3 py-1.5 focus-within:border-sage transition-colors">
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
                    <Button
                        onClick={() => send()}
                        disabled={sending || !input.trim()}
                        className="rounded-full bg-sage hover:bg-sage-hover text-white h-11 w-11 p-0 shrink-0"
                        data-testid="chat-send-button"
                    >
                        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                </div>
                <p className="text-[10px] text-ink-muted mt-1.5 text-center">
                    Jarvis observes silently. Mention "jarvis" or ask a question to get a reply.
                </p>
            </div>

            {/* Members + Invite dialog */}
            <Dialog open={membersOpen} onOpenChange={setMembersOpen}>
                <DialogContent className="bg-white border-stoke rounded-2xl" data-testid="members-dialog">
                    <DialogHeader>
                        <DialogTitle className="font-display text-2xl text-ink">
                            {householdData?.name}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-5">
                        <div>
                            <p className="text-xs tracking-[0.18em] uppercase font-bold text-ink-muted mb-3">
                                Members ({members.length})
                            </p>
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                                {members.map((m) => (
                                    <div key={m.id} className="flex items-center gap-3 bg-bg-base border border-stoke rounded-xl px-3 py-2.5" data-testid={`member-row-${m.id}`}>
                                        <span
                                            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white text-sm font-semibold"
                                            style={{ background: m.color || "#546E58" }}
                                        >
                                            {m.name?.[0]?.toUpperCase()}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-ink font-medium text-sm truncate">{m.name}</p>
                                            <p className="text-xs text-ink-muted truncate">
                                                {m.id === user.id ? "You" : "Member"}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                                <div className="flex items-center gap-3 bg-[#FBF2EC] border border-terracotta/30 rounded-xl px-3 py-2.5">
                                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-terracotta text-white">
                                        <Sparkles className="h-4 w-4" />
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-ink font-medium text-sm">Jarvis</p>
                                        <p className="text-xs text-ink-muted">AI household agent</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-bg-base border border-stoke rounded-2xl p-4">
                            <p className="text-xs tracking-[0.18em] uppercase font-bold text-terracotta mb-2">
                                Invite code
                            </p>
                            <div className="flex items-center gap-2">
                                <Input
                                    readOnly
                                    value={householdData?.invite_code || ""}
                                    className="font-mono tracking-[0.3em] uppercase font-bold text-ink text-lg h-12 bg-white border-stoke focus-visible:ring-0"
                                    data-testid="invite-code-display"
                                />
                                <Button onClick={copyInvite} className="rounded-xl bg-sage hover:bg-sage-hover text-white h-12 px-4" data-testid="copy-invite-button">
                                    <Copy className="h-4 w-4" />
                                </Button>
                                <Button onClick={rotateInvite} variant="outline" className="rounded-xl border-stoke bg-white hover:bg-bg-muted text-ink hover:text-ink h-12 px-4" data-testid="rotate-invite-button">
                                    <RefreshCw className="h-4 w-4" />
                                </Button>
                            </div>
                            <p className="text-xs text-ink-secondary mt-3">
                                Share this code with anyone you live with. They can join with it from the sign-up page.
                            </p>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function MessageBubble({ msg, currentUserId }) {
    const isMine = msg.sender_id === currentUserId;
    const isSystem = msg.role === "system";
    const isJarvis = msg.role === "assistant";
    const isCartProposal = msg.role === "cart_proposal";

    if (isSystem) {
        return (
            <div className="flex justify-center my-2" data-testid="system-message">
                <span className="bg-white/90 rounded-full px-3 py-1 text-[11px] text-ink-secondary shadow-sm max-w-[80%] text-center">
                    {msg.content}
                </span>
            </div>
        );
    }

    if (isCartProposal) {
        return (
            <div className="flex justify-start mb-2" data-testid="cart-proposal-message">
                <div className="max-w-[88%] rounded-2xl rounded-bl-md bg-white border border-terracotta/40 shadow-sm overflow-hidden">
                    <div className="px-4 pt-3 pb-2 flex items-center gap-2">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-terracotta text-white">
                            <Sparkles className="h-3 w-3" />
                        </span>
                        <p className="font-semibold text-sm text-terracotta">Jarvis</p>
                    </div>
                    <div className="px-4 pb-3">
                        <p className="text-ink text-[15px] leading-relaxed">{msg.content}</p>
                    </div>
                    <Link to="/app/cart">
                        <div className="bg-[#FBF2EC] hover:bg-[#F5E5DA] transition-colors px-4 py-3 flex items-center justify-between border-t border-terracotta/20 cursor-pointer" data-testid="cart-proposal-link">
                            <div className="flex items-center gap-2">
                                <ShoppingCart className="h-4 w-4 text-terracotta" />
                                <span className="text-sm font-semibold text-terracotta">Review & order ({msg.cart_items_count} items)</span>
                            </div>
                            <span className="text-terracotta text-lg">→</span>
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
                <div className="max-w-[80%] bg-[#D9E8D5] text-ink rounded-2xl rounded-br-md px-3.5 py-2 shadow-sm">
                    <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{msg.content}</p>
                    <div className="flex items-center justify-end gap-1 mt-0.5">
                        <span className="text-[10px] text-ink-muted">{formatTime(msg.created_at)}</span>
                        {msg._optimistic ? (
                            <Check className="h-3 w-3 text-ink-muted" />
                        ) : (
                            <CheckCheck className="h-3 w-3 text-sage" />
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // Others (including Jarvis)
    const senderColor = msg.sender_color || (isJarvis ? "#D97757" : "#546E58");
    return (
        <div className="flex justify-start mb-1" data-testid={isJarvis ? "jarvis-message" : "other-message"}>
            <div
                className={`max-w-[80%] rounded-2xl rounded-bl-md px-3.5 py-2 shadow-sm ${
                    isJarvis ? "bg-[#FBF2EC] border border-terracotta/20" : "bg-white"
                }`}
            >
                <div className="flex items-center gap-1.5 mb-0.5">
                    {isJarvis && (
                        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-terracotta text-white">
                            <Sparkles className="h-2.5 w-2.5" />
                        </span>
                    )}
                    <p
                        className="text-[12px] font-semibold"
                        style={{ color: senderColor }}
                    >
                        {msg.sender_name}
                    </p>
                </div>
                <p className="whitespace-pre-wrap text-ink text-[15px] leading-relaxed">{msg.content}</p>
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
        "Jarvis, what should we cook tonight?",
        "Paneer khatam ho gaya — order kar do",
        "Need milk, curd and bread for tomorrow",
    ];
    return (
        <div className="flex flex-col items-center text-center py-12 animate-fade-up">
            <span className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-sage text-white mb-5">
                <Sparkles className="h-7 w-7" />
            </span>
            <h2 className="font-display text-2xl font-semibold text-ink">
                Welcome to {householdName || "your home"}
            </h2>
            <p className="text-ink-secondary mt-2 max-w-md">
                Chat naturally with the people you live with. Jarvis listens quietly and
                builds a shared cart when groceries come up.
            </p>
            <div className="mt-7 grid grid-cols-1 md:grid-cols-2 gap-2 max-w-2xl w-full">
                {samples.map((s, i) => (
                    <button
                        key={i}
                        onClick={() => onSuggestion(s)}
                        className="text-left rounded-xl border border-stoke bg-white px-4 py-3 text-sm text-ink hover:border-sage hover:bg-bg-muted transition-colors shadow-sm"
                        data-testid={`chat-suggestion-${i}`}
                    >
                        {s}
                    </button>
                ))}
            </div>
        </div>
    );
}
