import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Sparkles, Loader2 } from "lucide-react";

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
        <div className="min-h-screen flex items-center justify-center px-6 grain-bg" data-testid="login-page">
            <div className="w-full max-w-md bg-white border border-stoke rounded-3xl p-10 animate-fade-up">
                <Link to="/" className="flex items-center gap-2 mb-8" data-testid="login-logo">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-sage text-white">
                        <Sparkles className="h-4 w-4" />
                    </span>
                    <span className="font-display font-bold text-xl text-ink">
                        Jarvis<span className="text-sage">.home</span>
                    </span>
                </Link>
                <h1 className="font-display text-3xl font-bold text-ink tracking-tight">
                    Welcome back
                </h1>
                <p className="text-ink-secondary mt-2 text-[15px]">
                    Sign in to keep your home running smoothly.
                </p>
                <form onSubmit={onSubmit} className="mt-8 space-y-5" data-testid="login-form">
                    <div className="space-y-2">
                        <Label htmlFor="email" className="text-ink">Email</Label>
                        <Input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            placeholder="you@home.com"
                            className="rounded-xl border-stoke bg-bg-base h-11 focus-visible:ring-2 focus-visible:ring-terracotta"
                            data-testid="login-email-input"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="password" className="text-ink">Password</Label>
                        <Input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            placeholder="••••••••"
                            className="rounded-xl border-stoke bg-bg-base h-11 focus-visible:ring-2 focus-visible:ring-terracotta"
                            data-testid="login-password-input"
                        />
                    </div>
                    <Button
                        type="submit"
                        disabled={loading}
                        className="w-full rounded-full bg-sage hover:bg-sage-hover text-white h-11"
                        data-testid="login-submit-button"
                    >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
                    </Button>
                </form>
                <p className="text-sm text-ink-secondary mt-6 text-center">
                    New here?{" "}
                    <Link to="/register" className="text-sage font-semibold hover:underline" data-testid="login-register-link">
                        Create an account
                    </Link>
                </p>
            </div>
        </div>
    );
}
