import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Sparkles, Loader2, Home, Users, ArrowLeft } from "lucide-react";

export default function Register() {
    const navigate = useNavigate();
    const { register, joinHome } = useAuth();
    const [mode, setMode] = useState("create");
    const [loading, setLoading] = useState(false);

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [householdName, setHouseholdName] = useState("");
    const [jName, setJName] = useState("");
    const [jEmail, setJEmail] = useState("");
    const [jPassword, setJPassword] = useState("");
    const [inviteCode, setInviteCode] = useState("");

    const onCreate = async (e) => {
        e.preventDefault();
        if (password.length < 6) return toast.error("Password too short (min 6)");
        setLoading(true);
        try {
            await register(name, email, password, householdName || `${name.split(" ")[0]}'s home`);
            toast.success("Home created. Welcome to HomeOS.");
            navigate("/app");
        } catch (err) {
            toast.error(err?.response?.data?.detail || "Could not create home");
        } finally { setLoading(false); }
    };

    const onJoin = async (e) => {
        e.preventDefault();
        if (jPassword.length < 6) return toast.error("Password too short (min 6)");
        setLoading(true);
        try {
            await joinHome(jName, jEmail, jPassword, inviteCode.toUpperCase().trim());
            toast.success("Joined the home.");
            navigate("/app");
        } catch (err) {
            toast.error(err?.response?.data?.detail || "Could not join. Check invite code.");
        } finally { setLoading(false); }
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-5 py-10 grain-bg" data-testid="register-page">
            <div className="w-full max-w-md bg-white border-2 border-stoke rounded-3xl p-7 sm:p-10 animate-fade-up shadow-soft-lift">
                <Link to="/" className="inline-flex items-center text-sm text-ink-secondary hover:text-ink mb-6 gap-1">
                    <ArrowLeft className="h-3.5 w-3.5" /> Back
                </Link>
                <Link to="/" className="flex items-center gap-2.5 mb-8" data-testid="register-logo">
                    <span className="relative inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-sage-deep text-white">
                        <Sparkles className="h-4 w-4" />
                        <span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-terracotta border-2 border-white" />
                    </span>
                    <span className="font-display font-black text-[22px] text-ink tracking-tight leading-none">
                        Home<span className="text-terracotta italic">OS</span>
                    </span>
                </Link>
                <h1 className="display-stamp text-3xl sm:text-4xl text-ink">Make your home easier.</h1>
                <p className="text-ink-secondary mt-3 text-[15px]">
                    Less deciding. More living.
                </p>

                <Tabs value={mode} onValueChange={setMode} className="mt-7">
                    <TabsList className="grid grid-cols-2 w-full bg-bg-muted rounded-full p-1 h-12">
                        <TabsTrigger value="create" className="rounded-full data-[state=active]:bg-white data-[state=active]:text-ink data-[state=active]:shadow-sm text-ink-secondary font-semibold" data-testid="tab-create">
                            <Home className="h-3.5 w-3.5 mr-2" /> Start a home
                        </TabsTrigger>
                        <TabsTrigger value="join" className="rounded-full data-[state=active]:bg-white data-[state=active]:text-ink data-[state=active]:shadow-sm text-ink-secondary font-semibold" data-testid="tab-join">
                            <Users className="h-3.5 w-3.5 mr-2" /> Join a home
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="create" className="mt-5">
                        <form onSubmit={onCreate} className="space-y-4" data-testid="create-form">
                            <Field label="Your name"><Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Priya Sharma" className={inp} data-testid="register-name-input" /></Field>
                            <Field label="Home name (optional)"><Input value={householdName} onChange={(e) => setHouseholdName(e.target.value)} placeholder="The Sharma family" className={inp} data-testid="register-household-input" /></Field>
                            <Field label="Email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@home.com" className={inp} data-testid="register-email-input" /></Field>
                            <Field label="Password"><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="At least 6 characters" className={inp} data-testid="register-password-input" /></Field>
                            <button type="submit" disabled={loading} className="btn-cta w-full h-12 text-base disabled:opacity-60" data-testid="register-submit-button">
                                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create my home"}
                            </button>
                        </form>
                    </TabsContent>

                    <TabsContent value="join" className="mt-5">
                        <form onSubmit={onJoin} className="space-y-4" data-testid="join-form">
                            <Field label="Invite code"><Input value={inviteCode} onChange={(e) => setInviteCode(e.target.value.toUpperCase())} required placeholder="ABCD1234" maxLength={12} className={`${inp} font-mono tracking-wider uppercase`} data-testid="join-code-input" /></Field>
                            <Field label="Your name"><Input value={jName} onChange={(e) => setJName(e.target.value)} required placeholder="Rohan Sharma" className={inp} data-testid="join-name-input" /></Field>
                            <Field label="Email"><Input type="email" value={jEmail} onChange={(e) => setJEmail(e.target.value)} required placeholder="you@home.com" className={inp} data-testid="join-email-input" /></Field>
                            <Field label="Password"><Input type="password" value={jPassword} onChange={(e) => setJPassword(e.target.value)} required placeholder="At least 6 characters" className={inp} data-testid="join-password-input" /></Field>
                            <button type="submit" disabled={loading} className="btn-cta w-full h-12 text-base disabled:opacity-60" data-testid="join-submit-button">
                                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Join the home"}
                            </button>
                        </form>
                    </TabsContent>
                </Tabs>

                <p className="text-sm text-ink-secondary mt-6 text-center">
                    Already have an account?{" "}
                    <Link to="/login" className="text-terracotta font-semibold hover:underline" data-testid="register-login-link">
                        Sign in
                    </Link>
                </p>
            </div>
        </div>
    );
}

const inp = "rounded-xl border-2 border-stoke bg-bg-base h-12 focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:border-terracotta text-ink text-[15px]";

const Field = ({ label, children }) => (
    <div className="space-y-2">
        <Label className="text-ink font-medium">{label}</Label>
        {children}
    </div>
);
