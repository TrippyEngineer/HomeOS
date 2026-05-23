import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import {
    UtensilsCrossed,
    ShoppingBasket,
    ChefHat,
    Users,
    MessageCircle,
    AlertTriangle,
    Sparkles,
    ArrowRight,
} from "lucide-react";

const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
};

const todayLabel = () =>
    new Date().toLocaleDateString("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "long",
    });

export default function Dashboard() {
    const { user, household } = useAuth();
    const [todayPlan, setTodayPlan] = useState(null);
    const [low, setLow] = useState([]);
    const [family, setFamily] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const [tp, lp, fm] = await Promise.all([
                    api.get("/mealplan/today"),
                    api.get("/pantry/low"),
                    api.get("/family"),
                ]);
                setTodayPlan(tp.data);
                setLow(lp.data);
                setFamily(fm.data);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    return (
        <div className="p-6 lg:p-12 max-w-7xl mx-auto" data-testid="dashboard-page">
            <header className="mb-10 animate-fade-up">
                <p className="text-xs tracking-[0.2em] uppercase font-bold text-terracotta mb-3">
                    {todayLabel()}
                </p>
                <h1 className="font-display text-3xl lg:text-5xl font-bold text-ink tracking-tight">
                    {greeting()}, {user?.name?.split(" ")[0]}.
                </h1>
                <p className="text-ink-secondary mt-3 text-lg">
                    Here's what your home looks like today.
                </p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Today's meals */}
                <div className="lg:col-span-2 rounded-2xl bg-white border border-stoke p-7 card-hover" data-testid="today-meals-card">
                    <div className="flex items-start justify-between gap-4 mb-5">
                        <div>
                            <p className="text-xs tracking-[0.18em] uppercase font-bold text-ink-muted mb-1.5">
                                Today's menu
                            </p>
                            <h2 className="font-display text-2xl font-semibold text-ink">
                                What's cooking
                            </h2>
                        </div>
                        <Link to="/app/meals" data-testid="dashboard-meals-link">
                            <Button variant="ghost" className="rounded-full text-sage hover:text-sage-hover hover:bg-bg-muted">
                                Week view
                                <ArrowRight className="h-4 w-4 ml-1.5" />
                            </Button>
                        </Link>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {["breakfast", "lunch", "dinner"].map((slot) => {
                            const meal = todayPlan?.[slot];
                            return (
                                <div
                                    key={slot}
                                    className="rounded-xl bg-bg-base border border-stoke p-5"
                                    data-testid={`today-${slot}-tile`}
                                >
                                    <p className="text-xs tracking-[0.15em] uppercase font-bold text-ink-muted mb-2">
                                        {slot}
                                    </p>
                                    {meal?.name ? (
                                        <p className="font-display text-lg text-ink font-medium leading-snug">
                                            {meal.name}
                                        </p>
                                    ) : (
                                        <p className="text-ink-muted text-sm italic">
                                            Not planned yet
                                        </p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    {!todayPlan?.breakfast?.name && (
                        <Link to="/app/meals" data-testid="dashboard-plan-week-cta">
                            <Button className="mt-6 rounded-full bg-sage hover:bg-sage-hover text-white">
                                <Sparkles className="h-4 w-4 mr-2" />
                                Plan my week
                            </Button>
                        </Link>
                    )}
                </div>

                {/* Pantry alerts */}
                <div className="rounded-2xl bg-white border border-stoke p-7 card-hover" data-testid="pantry-alert-card">
                    <p className="text-xs tracking-[0.18em] uppercase font-bold text-terracotta mb-1.5">
                        Pantry alerts
                    </p>
                    <h2 className="font-display text-2xl font-semibold text-ink mb-5">
                        Running low
                    </h2>
                    {loading ? (
                        <p className="text-ink-muted text-sm">Loading…</p>
                    ) : low.length === 0 ? (
                        <p className="text-ink-secondary text-sm">
                            All essentials stocked. Nothing to worry about right now.
                        </p>
                    ) : (
                        <ul className="space-y-2.5">
                            {low.slice(0, 5).map((p) => (
                                <li
                                    key={p.id}
                                    className="flex items-center justify-between text-sm"
                                    data-testid={`low-item-${p.id}`}
                                >
                                    <span className="flex items-center gap-2 text-ink">
                                        <AlertTriangle className="h-3.5 w-3.5 text-terracotta" />
                                        {p.name}
                                    </span>
                                    <span className="text-ink-muted text-xs">
                                        {p.qty} {p.unit}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                    <Link to="/app/pantry" data-testid="dashboard-pantry-link">
                        <Button variant="ghost" className="mt-5 rounded-full text-sage hover:text-sage-hover hover:bg-bg-muted px-0">
                            Manage pantry
                            <ArrowRight className="h-4 w-4 ml-1.5" />
                        </Button>
                    </Link>
                </div>

                {/* Quick actions */}
                <div className="rounded-2xl border border-terracotta/30 bg-[#FBF2EC] p-7 card-hover lg:col-span-2" data-testid="quick-actions-card">
                    <p className="text-xs tracking-[0.18em] uppercase font-bold text-terracotta mb-1.5">
                        Quick actions
                    </p>
                    <h2 className="font-display text-2xl font-semibold text-ink mb-5">
                        Hand off the thinking
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <Link to="/app/chat" data-testid="qa-ask-jarvis">
                            <Button className="w-full justify-start rounded-xl bg-white text-ink border border-stoke hover:bg-bg-muted h-auto py-4">
                                <MessageCircle className="h-4 w-4 mr-3 text-sage" />
                                <span className="text-left">
                                    <span className="block font-medium">Ask Jarvis</span>
                                    <span className="block text-xs text-ink-muted">"What's for dinner?"</span>
                                </span>
                            </Button>
                        </Link>
                        <Link to="/app/cook" data-testid="qa-cook-notes">
                            <Button className="w-full justify-start rounded-xl bg-white text-ink border border-stoke hover:bg-bg-muted h-auto py-4">
                                <ChefHat className="h-4 w-4 mr-3 text-terracotta" />
                                <span className="text-left">
                                    <span className="block font-medium">Brief the cook</span>
                                    <span className="block text-xs text-ink-muted">Today's handover</span>
                                </span>
                            </Button>
                        </Link>
                        <Link to="/app/meals" data-testid="qa-plan-week">
                            <Button className="w-full justify-start rounded-xl bg-white text-ink border border-stoke hover:bg-bg-muted h-auto py-4">
                                <UtensilsCrossed className="h-4 w-4 mr-3 text-sage" />
                                <span className="text-left">
                                    <span className="block font-medium">Plan the week</span>
                                    <span className="block text-xs text-ink-muted">AI menu</span>
                                </span>
                            </Button>
                        </Link>
                    </div>
                </div>

                {/* Family */}
                <div className="rounded-2xl bg-white border border-stoke p-7 card-hover" data-testid="family-card">
                    <p className="text-xs tracking-[0.18em] uppercase font-bold text-ink-muted mb-1.5">
                        Your household
                    </p>
                    <h2 className="font-display text-2xl font-semibold text-ink mb-5">
                        {family.length} {family.length === 1 ? "member" : "members"}
                    </h2>
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                        {family.slice(0, 6).map((m) => (
                            <div
                                key={m.id}
                                className="flex items-center justify-between text-sm"
                            >
                                <span className="text-ink">{m.name}</span>
                                <span className="text-xs text-ink-muted capitalize">
                                    {m.role}
                                </span>
                            </div>
                        ))}
                    </div>
                    <Link to="/app/family" data-testid="dashboard-family-link">
                        <Button variant="ghost" className="mt-4 rounded-full text-sage hover:text-sage-hover hover:bg-bg-muted px-0">
                            Manage family
                            <ArrowRight className="h-4 w-4 ml-1.5" />
                        </Button>
                    </Link>
                </div>
            </div>
        </div>
    );
}
