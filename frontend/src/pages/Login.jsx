import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Sparkles, Loader2, ArrowLeft } from "lucide-react";

export default function Login() {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);

    const onSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await login(email, password);
            toast.success("Welcome back");
            navigate("/app");
        } catch (err) {
            toast.error(err?.response?.data?.detail || "Could not log in");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-5 py-10 grain-bg" data-testid="login-page">
            <div className="w-full max-w-md bg-white border-2 border-stoke rounded-3xl p-7 sm:p-10 animate-fade-up shadow-soft-lift">
                <Link to="/" className="inline-flex items-center text-sm text-ink-secondary hover:text-ink mb-6 gap-1">
                    <ArrowLeft className="h-3.5 w-3.5" /> Back
                </Link>
                <Link to="/" className="flex items-center gap-2.5 mb-8" data-testid="login-logo">
                    <span className="relative inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-sage-deep text-white">
                        <Sparkles className="h-4 w-4" />
                        <span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-terracotta border-2 border-white" />
                    </span>
                    <span className="font-display font-black text-[22px] text-ink tracking-tight leading-none">
                        Home<span className="text-terracotta italic">OS</span>
                    </span>
                </Link>
                <h1 className="display-stamp text-3xl sm:text-4xl text-ink">Welcome back.</h1>
                <p className="text-ink-secondary mt-3 text-[15px]">
                    Sign in to keep your home running smoothly.
                </p>
                <form onSubmit={onSubmit} className="mt-7 space-y-4" data-testid="login-form">
                    <div className="space-y-2">
                        <Label htmlFor="email" className="text-ink font-medium">Email</Label>
                        <Input
                            id="email" type="email" value={email}
                            onChange={(e) => setEmail(e.target.value)} required
                            placeholder="you@home.com"
                            className="rounded-xl border-2 border-stoke bg-bg-base h-12 focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:border-terracotta text-ink text-[15px]"
                            data-testid="login-email-input"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="password" className="text-ink font-medium">Password</Label>
                        <Input
                            id="password" type="password" value={password}
                            onChange={(e) => setPassword(e.target.value)} required
                            placeholder="••••••••"
                            className="rounded-xl border-2 border-stoke bg-bg-base h-12 focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:border-terracotta text-ink text-[15px]"
                            data-testid="login-password-input"
                        />
                    </div>
                    <button
                        type="submit" disabled={loading}
                        className="btn-cta w-full h-12 text-base disabled:opacity-60"
                        data-testid="login-submit-button"
                    >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
                    </button>
                </form>
                <p className="text-sm text-ink-secondary mt-6 text-center">
                    New here?{" "}
                    <Link to="/register" className="text-terracotta font-semibold hover:underline" data-testid="login-register-link">
                        Create an account
                    </Link>
                </p>
            </div>
        </div>
    );
}
