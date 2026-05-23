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
    { to: "/app/overview", icon: LayoutGrid, label: "Overview", id: "nav-overview" },
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
            <aside className="hidden lg:flex w-60 shrink-0 border-r border-stoke bg-white flex-col" data-testid="app-sidebar">
                <div className="px-5 py-5 border-b border-stoke">
                    <div className="flex items-center gap-2.5 font-display font-bold text-lg text-ink">
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-sage text-white">
                            <Sparkles className="h-4 w-4" />
                        </span>
                        Jarvis<span className="text-sage">.home</span>
                    </div>
                    <p className="text-xs text-ink-muted mt-3 tracking-wide truncate" data-testid="sidebar-household-name">
                        {household?.name || "Your home"}
                    </p>
                </div>
                <nav className="flex-1 p-3 space-y-1" data-testid="app-nav">
                    {nav.map((n) => (
                        <NavLink
                            key={n.to}
                            to={n.to}
                            end={n.end}
                            data-testid={n.id}
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-4 py-2.5 rounded-xl text-[15px] transition-colors ${
                                    isActive ? "bg-sage text-white" : "text-ink hover:bg-bg-muted hover:text-ink"
                                }`
                            }
                        >
                            <n.icon className="h-4 w-4" />
                            {n.label}
                        </NavLink>
                    ))}
                </nav>
                <div className="p-3 border-t border-stoke">
                    <div className="flex items-center gap-2 px-2 mb-2">
                        <span
                            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-white text-xs font-semibold"
                            style={{ background: user?.color || "#546E58" }}
                            data-testid="sidebar-user-avatar"
                        >
                            {user?.name?.[0]?.toUpperCase()}
                        </span>
                        <div className="min-w-0">
                            <p className="text-sm font-medium text-ink truncate" data-testid="sidebar-user-name">{user?.name}</p>
                            <p className="text-xs text-ink-muted truncate">{user?.email}</p>
                        </div>
                    </div>
                    <Button onClick={handleLogout} variant="ghost" className="w-full justify-start text-ink-secondary hover:text-ink hover:bg-bg-muted rounded-xl" data-testid="logout-button">
                        <LogOut className="h-4 w-4 mr-2" />
                        Sign out
                    </Button>
                </div>
            </aside>

            <div className="lg:hidden fixed top-0 inset-x-0 z-40 glass-header border-b border-stoke px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2 font-display font-bold text-ink">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-sage text-white">
                        <Sparkles className="h-3.5 w-3.5" />
                    </span>
                    Jarvis<span className="text-sage">.home</span>
                </div>
                <Button onClick={handleLogout} variant="ghost" size="icon" className="text-ink-secondary" data-testid="logout-button-mobile">
                    <LogOut className="h-4 w-4" />
                </Button>
            </div>

            <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-stoke px-1 py-1.5 flex justify-around overflow-x-auto">
                {nav.map((n) => (
                    <NavLink
                        key={n.to}
                        to={n.to}
                        end={n.end}
                        data-testid={`${n.id}-mobile`}
                        className={({ isActive }) =>
                            `flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] shrink-0 ${
                                isActive ? "text-sage" : "text-ink-muted"
                            }`
                        }
                    >
                        <n.icon className="h-4 w-4" />
                        {n.label}
                    </NavLink>
                ))}
            </div>

            <main className="flex-1 min-w-0 pt-14 lg:pt-0 pb-16 lg:pb-0" data-testid="app-main">
                <Outlet />
            </main>
        </div>
    );
}
