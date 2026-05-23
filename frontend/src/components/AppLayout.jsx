import React from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import {
    Sparkles, MessageCircle, ShoppingCart, LayoutGrid,
    UtensilsCrossed, ShoppingBasket, ChefHat, Users, LogOut,
} from "lucide-react";

const nav = [
    { to: "/app", icon: MessageCircle, label: "Chat", end: true, id: "nav-chat" },
    { to: "/app/cart", icon: ShoppingCart, label: "Cart", id: "nav-cart" },
    { to: "/app/overview", icon: LayoutGrid, label: "Home", id: "nav-overview" },
    { to: "/app/meals", icon: UtensilsCrossed, label: "Meals", id: "nav-meals" },
    { to: "/app/pantry", icon: ShoppingBasket, label: "Pantry", id: "nav-pantry" },
    { to: "/app/cook", icon: ChefHat, label: "Cook", id: "nav-cook" },
    { to: "/app/family", icon: Users, label: "Family", id: "nav-family" },
];

export default function AppLayout() {
    const { user, household, logout } = useAuth();
    const navigate = useNavigate();
    const handleLogout = () => { logout(); navigate("/"); };

    return (
        <div className="min-h-screen bg-bg-base flex">
            {/* Desktop sidebar */}
            <aside className="hidden lg:flex w-60 shrink-0 border-r-2 border-stoke bg-white flex-col" data-testid="app-sidebar">
                <div className="px-5 py-5 border-b-2 border-stoke">
                    <div className="flex items-center gap-2.5">
                        <span className="relative inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-sage-deep text-white">
                            <Sparkles className="h-4 w-4" />
                            <span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-terracotta border-2 border-white" />
                        </span>
                        <span className="font-display font-black text-xl text-ink tracking-tight leading-none">
                            Home<span className="text-terracotta italic">OS</span>
                        </span>
                    </div>
                    <p className="text-xs text-ink-muted mt-3 tracking-wide truncate font-medium" data-testid="sidebar-household-name">
                        {household?.name || "Your home"}
                    </p>
                </div>
                <nav className="flex-1 p-3 space-y-1" data-testid="app-nav">
                    {nav.map((n) => (
                        <NavLink key={n.to} to={n.to} end={n.end} data-testid={n.id}
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-4 py-2.5 rounded-xl text-[15px] font-medium transition-colors ${
                                    isActive ? "bg-ink text-white" : "text-ink hover:bg-bg-muted"
                                }`}>
                            <n.icon className="h-4 w-4" />
                            {n.label}
                        </NavLink>
                    ))}
                </nav>
                <div className="p-3 border-t-2 border-stoke">
                    <div className="flex items-center gap-2 px-2 mb-2">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full text-white text-xs font-bold shrink-0" style={{ background: user?.color || "#3B5A3F" }} data-testid="sidebar-user-avatar">
                            {user?.name?.[0]?.toUpperCase()}
                        </span>
                        <div className="min-w-0">
                            <p className="text-sm font-semibold text-ink truncate" data-testid="sidebar-user-name">{user?.name}</p>
                            <p className="text-xs text-ink-muted truncate">{user?.email}</p>
                        </div>
                    </div>
                    <Button onClick={handleLogout} variant="ghost" className="w-full justify-start text-ink-secondary hover:text-ink hover:bg-bg-muted rounded-xl h-9 font-medium" data-testid="logout-button">
                        <LogOut className="h-4 w-4 mr-2" />
                        Sign out
                    </Button>
                </div>
            </aside>

            {/* Mobile/tablet top bar */}
            <div className="lg:hidden fixed top-0 inset-x-0 z-40 glass-header border-b-2 border-stoke px-4 py-3 flex items-center justify-between safe-top">
                <div className="flex items-center gap-2">
                    <span className="relative inline-flex h-8 w-8 items-center justify-center rounded-xl bg-sage-deep text-white">
                        <Sparkles className="h-3.5 w-3.5" />
                        <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-terracotta border-2 border-bg-base" />
                    </span>
                    <span className="font-display font-black text-lg text-ink tracking-tight">
                        Home<span className="text-terracotta italic">OS</span>
                    </span>
                </div>
                <Button onClick={handleLogout} variant="ghost" size="icon" className="text-ink-secondary h-9 w-9" data-testid="logout-button-mobile">
                    <LogOut className="h-4 w-4" />
                </Button>
            </div>

            {/* Mobile/tablet bottom nav */}
            <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t-2 border-stoke px-1 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] flex justify-around overflow-x-auto">
                {nav.map((n) => (
                    <NavLink key={n.to} to={n.to} end={n.end} data-testid={`${n.id}-mobile`}
                        className={({ isActive }) =>
                            `flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] shrink-0 font-semibold ${
                                isActive ? "text-terracotta" : "text-ink-muted"
                            }`}>
                        <n.icon className="h-[18px] w-[18px]" />
                        {n.label}
                    </NavLink>
                ))}
            </div>

            <main className="flex-1 min-w-0 pt-14 lg:pt-0 pb-[calc(64px+env(safe-area-inset-bottom))] lg:pb-0" data-testid="app-main">
                <Outlet />
            </main>
        </div>
    );
}
