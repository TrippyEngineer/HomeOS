import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
    Sparkles, MessageCircle, ShoppingCart, Users, UtensilsCrossed,
    ArrowRight, Check, Zap, Heart, Instagram,
} from "lucide-react";

const HERO_IMG =
    "https://images.unsplash.com/photo-1649083048597-d7b4f1e8a386?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA3MDR8MHwxfHNlYXJjaHwzfHxtb2Rlcm4lMjB3YXJtJTIwa2l0Y2hlbiUyMGFlc3RoZXRpY3xlbnwwfHx8fDE3Nzk1NjY5OTJ8MA&ixlib=rb-4.1.0&q=85";
const PANTRY_IMG =
    "https://images.unsplash.com/photo-1592178036182-5400889dfc74?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjY2NzZ8MHwxfHNlYXJjaHwzfHxuZWF0JTIwcGFudHJ5JTIwc2hlbHZlcyUyMGdyb2Nlcmllc3xlbnwwfHx8fDE3Nzk1NjY5OTJ8MA&ixlib=rb-4.1.0&q=85";

const Logo = ({ className = "" }) => (
    <Link to="/" className={`inline-flex items-center gap-2.5 ${className}`} data-testid="landing-logo">
        <span className="relative inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-sage-deep text-white">
            <Sparkles className="h-4 w-4" />
            <span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-terracotta border-2 border-bg-base" />
        </span>
        <span className="font-display font-black text-[22px] text-ink tracking-tight leading-none">
            Home<span className="text-terracotta italic">OS</span>
        </span>
    </Link>
);

const features = [
    { icon: MessageCircle, title: "A group chat for your home",
      desc: "Every adult signs in. Chat naturally — same flow as your WhatsApp family group, just smarter underneath." },
    { icon: Sparkles, title: "HomeOS listens quietly",
      desc: "An AI agent sits in the chat as a silent member. Only speaks when asked, or when something deserves attention." },
    { icon: ShoppingCart, title: "Cart builds itself",
      desc: '"We\'re out of dal." "Need curd tomorrow." HomeOS hears, extracts, and quietly assembles a shared cart in the background.' },
    { icon: Instagram, title: "Drop a recipe reel",
      desc: "Share an Instagram cooking reel into the chat. HomeOS pulls the recipe, parses ingredients, drops them into the cart." },
    { icon: UtensilsCrossed, title: "One tap to Swiggy",
      desc: "Decision-maker reviews, taps. Order flows through Swiggy Instamart. No app-hopping. (Swiggy live integration pending.)" },
    { icon: Check, title: "You always approve",
      desc: "HomeOS proposes — it never auto-orders. Decision-support, not autopilot. The household stays in charge." },
];

export default function Landing() {
    return (
        <div className="min-h-screen bg-bg-base" data-testid="landing-page">
            {/* Header */}
            <header className="glass-header sticky top-0 z-50 border-b border-stoke">
                <div className="max-w-7xl mx-auto px-5 lg:px-10 py-4 flex items-center justify-between gap-3">
                    <Logo />
                    <nav className="flex items-center gap-2 sm:gap-3">
                        <Link to="/login" data-testid="header-login-link">
                            <Button variant="ghost" className="rounded-full text-ink hover:bg-bg-muted hover:text-ink font-semibold">
                                Log in
                            </Button>
                        </Link>
                        <Link to="/register" data-testid="header-signup-link">
                            <button className="btn-cta px-5 py-2.5 text-sm">
                                Get started
                                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                            </button>
                        </Link>
                    </nav>
                </div>
            </header>

            {/* Hero */}
            <section className="relative overflow-hidden">
                <div className="absolute inset-0 -z-10">
                    <img src={HERO_IMG} alt="Warm kitchen" className="w-full h-full object-cover opacity-35" />
                    <div className="absolute inset-0 bg-gradient-to-b from-bg-base/20 via-bg-base/75 to-bg-base" />
                </div>
                <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-10 pt-16 pb-20 sm:pt-24 sm:pb-28 lg:pt-32 lg:pb-40">
                    <div className="max-w-4xl animate-fade-up">
                        <div className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-white/80 px-3.5 py-1.5 mb-7">
                            <span className="h-1.5 w-1.5 rounded-full bg-terracotta animate-pulse" />
                            <span className="overline text-ink-secondary">A family group chat that orders for you</span>
                        </div>
                        <h1 className="display-stamp text-[44px] sm:text-6xl lg:text-[88px] text-ink">
                            Just talk to
                            <br />
                            your home.
                            <br />
                            <span className="display-italic text-terracotta">The kitchen handles the rest.</span>
                        </h1>
                        <p className="mt-7 text-lg lg:text-xl text-ink-secondary leading-relaxed max-w-2xl font-normal">
                            A WhatsApp-style chat where your whole family logs in,
                            chats normally — and HomeOS quietly turns
                            <span className="italic"> "we're out of dal" </span>
                            into a Swiggy cart, ready for one tap.
                        </p>
                        <div className="mt-9 flex flex-wrap items-center gap-3 sm:gap-4">
                            <Link to="/register" data-testid="hero-cta-primary">
                                <button className="btn-cta text-base px-7 py-4">
                                    Start a home
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </button>
                            </Link>
                            <Link to="/register" data-testid="hero-cta-secondary">
                                <button className="inline-flex items-center justify-center rounded-full bg-white border-2 border-ink text-ink font-semibold px-7 py-[14px] text-base hover:bg-ink hover:text-white transition-colors">
                                    Join an existing home
                                </button>
                            </Link>
                        </div>
                        <p className="mt-6 text-sm text-ink-muted">
                            POC build · Real Claude Sonnet 4.5 agent · Real-time via SSE · Swiggy Instamart (mocked, pending access)
                        </p>
                    </div>
                </div>
            </section>

            {/* Big quote / thesis */}
            <section className="bg-bg-accent text-white py-16 sm:py-20 lg:py-28 overflow-hidden">
                <div className="max-w-6xl mx-auto px-5 sm:px-6 lg:px-10">
                    <p className="overline text-saffron mb-6">The thesis</p>
                    <h2 className="display-stamp text-3xl sm:text-5xl lg:text-7xl text-white">
                        We don't <span className="display-italic text-saffron">automate</span> decisions.
                        <br />
                        We retire them.
                    </h2>
                    <p className="text-lg lg:text-xl text-white/70 leading-relaxed mt-8 max-w-3xl">
                        The cognitive tax of running a home — "what to cook", "are we out of curd",
                        "did anyone tell didi" — never appears on any to-do list. But it costs you every evening.
                        HomeOS proposes. You approve. The home keeps running.
                    </p>
                </div>
            </section>

            {/* Features */}
            <section className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-10 py-16 sm:py-20 lg:py-28">
                <div className="max-w-2xl mb-12 sm:mb-16">
                    <p className="overline text-terracotta mb-4">How it works</p>
                    <h2 className="display-stamp text-3xl sm:text-4xl lg:text-5xl text-ink">
                        Same family group chat.
                        <span className="display-italic text-sage"> Quietly smarter.</span>
                    </h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                    {features.map((f, i) => (
                        <div key={i} className="card-hover rounded-3xl bg-white border-2 border-stoke p-6 sm:p-7" data-testid={`feature-card-${i}`}>
                            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-sage text-white mb-5">
                                <f.icon className="h-5 w-5" />
                            </div>
                            <h3 className="font-display text-2xl font-bold text-ink mb-2 tracking-tight">
                                {f.title}
                            </h3>
                            <p className="text-ink-secondary leading-relaxed text-[15px]">
                                {f.desc}
                            </p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Split */}
            <section className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-10 py-16 sm:py-20 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
                <div>
                    <p className="overline text-terracotta mb-4">Built for Indian homes</p>
                    <h2 className="display-stamp text-3xl sm:text-4xl lg:text-5xl text-ink mb-6">
                        Roti, sabzi, tiffin.
                        <span className="display-italic text-sage"> Khatam hone se pehle.</span>
                    </h2>
                    <p className="text-ink-secondary text-lg leading-relaxed mb-5">
                        HomeOS understands the rhythm — Hindi-English, weekly grocery runs,
                        diet preferences for parents and kids, the cook handover. It's not a
                        generic AI bolted on; it speaks the everyday language of the Indian kitchen.
                    </p>
                    <Link to="/register" data-testid="split-cta">
                        <button className="btn-cta px-6 py-3 text-sm mt-2">
                            Try it free
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </button>
                    </Link>
                </div>
                <div className="relative">
                    <img src={PANTRY_IMG} alt="Neat pantry" className="rounded-[28px] border-2 border-stoke w-full object-cover aspect-[4/5] shadow-soft-lift" />
                    <div className="absolute -bottom-5 -left-5 sm:-bottom-6 sm:-left-6 bg-white border-2 border-terracotta/40 rounded-2xl p-4 sm:p-5 max-w-[16rem] sm:max-w-xs shadow-soft-lift">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-terracotta text-white">
                                <Sparkles className="h-3 w-3" />
                            </span>
                            <p className="overline text-terracotta">HomeOS · in chat</p>
                        </div>
                        <p className="text-sm text-ink leading-relaxed">
                            "Noticed you're out of toor dal and curd. Added them to the cart with 2 more from yesterday's chat. Ready when you are."
                        </p>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t-2 border-stoke mt-10">
                <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-10 py-10 flex flex-wrap items-center justify-between gap-4 text-sm text-ink-muted">
                    <Logo />
                    <p>POC on the web today. WhatsApp-native next.</p>
                </div>
            </footer>
        </div>
    );
}
