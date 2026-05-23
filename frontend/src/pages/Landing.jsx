import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
    Sparkles, MessageCircle, ShoppingCart, Users,
    UtensilsCrossed, ArrowRight, Check,
} from "lucide-react";

const HERO_IMG =
    "https://images.unsplash.com/photo-1649083048597-d7b4f1e8a386?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA3MDR8MHwxfHNlYXJjaHwzfHxtb2Rlcm4lMjB3YXJtJTIwa2l0Y2hlbiUyMGFlc3RoZXRpY3xlbnwwfHx8fDE3Nzk1NjY5OTJ8MA&ixlib=rb-4.1.0&q=85";
const PANTRY_IMG =
    "https://images.unsplash.com/photo-1592178036182-5400889dfc74?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjY2NzZ8MHwxfHNlYXJjaHwzfHxuZWF0JTIwcGFudHJ5JTIwc2hlbHZlcyUyMGdyb2Nlcmllc3xlbnwwfHx8fDE3Nzk1NjY5OTJ8MA&ixlib=rb-4.1.0&q=85";

const features = [
    {
        icon: MessageCircle,
        title: "A group chat for your home",
        desc: "Every adult in the house signs in, chats naturally — just like a WhatsApp family group, but on the web.",
    },
    {
        icon: Sparkles,
        title: "Jarvis listens quietly",
        desc: "An AI agent sits in the chat as a silent member. It only speaks when you ask, or when there's something worth flagging.",
    },
    {
        icon: ShoppingCart,
        title: "Cart builds itself",
        desc: '"We\'re out of dal." "Need curd tomorrow." Jarvis hears, extracts, and quietly assembles a shared cart in the background.',
    },
    {
        icon: UtensilsCrossed,
        title: "One tap to Swiggy Instamart",
        desc: "When you're ready, the decision-maker approves the cart and orders directly through Swiggy. No app-hopping.",
    },
    {
        icon: Users,
        title: "Multi-account family",
        desc: "Spouse, parents, flatmates — each with their own login, all in one home. Coordinate without copy-paste.",
    },
    {
        icon: Check,
        title: "You always approve",
        desc: "Jarvis proposes — it never auto-orders. Decision-support, not autopilot. You stay in control.",
    },
];

export default function Landing() {
    return (
        <div className="min-h-screen bg-bg-base" data-testid="landing-page">
            <header className="glass-header sticky top-0 z-50 border-b border-stoke">
                <div className="max-w-7xl mx-auto px-6 lg:px-10 py-5 flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-2.5 font-display font-bold text-xl text-ink" data-testid="landing-logo">
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-sage text-white">
                            <Sparkles className="h-4 w-4" />
                        </span>
                        Jarvis<span className="text-sage">.home</span>
                    </Link>
                    <nav className="flex items-center gap-3">
                        <Link to="/login" data-testid="header-login-link">
                            <Button variant="ghost" className="rounded-full text-ink hover:bg-bg-muted hover:text-ink">
                                Log in
                            </Button>
                        </Link>
                        <Link to="/register" data-testid="header-signup-link">
                            <Button className="rounded-full bg-sage hover:bg-sage-hover text-white px-5">
                                Get started
                            </Button>
                        </Link>
                    </nav>
                </div>
            </header>

            <section className="relative overflow-hidden">
                <div className="absolute inset-0 -z-10">
                    <img src={HERO_IMG} alt="Warm kitchen" className="w-full h-full object-cover opacity-40" />
                    <div className="absolute inset-0 bg-gradient-to-b from-bg-base/30 via-bg-base/70 to-bg-base" />
                </div>
                <div className="max-w-7xl mx-auto px-6 lg:px-10 pt-20 pb-28 lg:pt-28 lg:pb-36">
                    <div className="max-w-3xl animate-fade-up">
                        <div className="inline-flex items-center gap-2 rounded-full border border-stoke bg-white/70 px-4 py-1.5 text-xs tracking-[0.2em] uppercase font-bold text-ink-secondary mb-7">
                            <span className="h-1.5 w-1.5 rounded-full bg-terracotta" />
                            A family group chat, that orders for you
                        </div>
                        <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold text-ink leading-[1.05] tracking-tight">
                            Just talk to your home.
                            <br />
                            <span className="text-sage">The kitchen handles the rest.</span>
                        </h1>
                        <p className="mt-7 text-lg lg:text-xl text-ink-secondary leading-relaxed max-w-2xl">
                            A WhatsApp-style chat where your whole family logs in,
                            chats normally — and Jarvis quietly turns "we're out of
                            dal" into a Swiggy cart, ready for one tap.
                        </p>
                        <div className="mt-10 flex flex-wrap items-center gap-4">
                            <Link to="/register" data-testid="hero-cta-primary">
                                <Button className="rounded-full bg-sage hover:bg-sage-hover text-white px-7 py-6 text-base">
                                    Start a home
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            </Link>
                            <Link to="/register" data-testid="hero-cta-secondary">
                                <Button variant="outline" className="rounded-full border-stoke bg-white/80 hover:bg-white text-ink hover:text-ink px-7 py-6 text-base">
                                    Join an existing home
                                </Button>
                            </Link>
                        </div>
                        <p className="mt-6 text-sm text-ink-muted">
                            POC build • Real Claude Sonnet 4.5 agent • Swiggy Instamart (mocked)
                        </p>
                    </div>
                </div>
            </section>

            <section className="max-w-7xl mx-auto px-6 lg:px-10 py-20 lg:py-28">
                <div className="max-w-2xl mb-14">
                    <p className="text-xs tracking-[0.2em] uppercase font-bold text-terracotta mb-4">
                        How it works
                    </p>
                    <h2 className="font-display text-3xl lg:text-4xl font-bold tracking-tight text-ink">
                        Same family group chat. Quietly smarter.
                    </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {features.map((f, i) => (
                        <div key={i} className="card-hover rounded-2xl bg-white border border-stoke p-7" data-testid={`feature-card-${i}`}>
                            <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-bg-muted text-sage mb-5">
                                <f.icon className="h-5 w-5" />
                            </div>
                            <h3 className="font-display text-xl font-semibold text-ink mb-2">{f.title}</h3>
                            <p className="text-ink-secondary leading-relaxed text-[15px]">{f.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            <section className="max-w-7xl mx-auto px-6 lg:px-10 py-20 grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
                <div>
                    <p className="text-xs tracking-[0.2em] uppercase font-bold text-terracotta mb-4">
                        The thesis
                    </p>
                    <h2 className="font-display text-3xl lg:text-4xl font-bold text-ink tracking-tight mb-6">
                        We don't automate decisions. We retire them.
                    </h2>
                    <p className="text-ink-secondary text-lg leading-relaxed mb-5">
                        The cognitive tax of running a home — "what to cook", "are
                        we out of curd", "did anyone tell didi" — never appears on
                        any to-do list. But it costs you every evening.
                    </p>
                    <p className="text-ink-secondary text-lg leading-relaxed">
                        Jarvis proposes. You approve. Your home keeps running —
                        without the running commentary in your head.
                    </p>
                </div>
                <div className="relative">
                    <img src={PANTRY_IMG} alt="Neat pantry" className="rounded-3xl border border-stoke w-full object-cover aspect-[4/5]" />
                    <div className="absolute -bottom-6 -left-6 bg-white border border-stoke rounded-2xl p-5 max-w-xs shadow-lg hidden md:block">
                        <p className="text-xs tracking-[0.18em] uppercase font-bold text-terracotta mb-2">
                            Jarvis · in the chat
                        </p>
                        <p className="text-sm text-ink leading-relaxed">
                            "Noticed you're out of toor dal and curd. I've added them to the cart along with 2 more items from yesterday's chat. Ready when you are."
                        </p>
                    </div>
                </div>
            </section>

            <footer className="border-t border-stoke mt-10">
                <div className="max-w-7xl mx-auto px-6 lg:px-10 py-10 flex flex-wrap items-center justify-between gap-4 text-sm text-ink-muted">
                    <div className="flex items-center gap-2.5">
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-sage text-white">
                            <Sparkles className="h-3.5 w-3.5" />
                        </span>
                        <span className="font-display font-semibold text-ink">Jarvis.home</span>
                    </div>
                    <p>POC on the web today. WhatsApp-native next.</p>
                </div>
            </footer>
        </div>
    );
}
