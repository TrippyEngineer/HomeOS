import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Sparkles, Loader2, Home, Users } from "lucide-react";

export default function Register() {
    const navigate = useNavigate();
    const { register, joinHome } = useAuth();
    const [mode, setMode] = useState("create");
    const [loading, setLoading] = useState(false);

    // create
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [householdName, setHouseholdName] = useState("");
    // join
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
            toast.success("Home created. Welcome to Jarvis.");
            navigate("/app");
        } catch (err) {
            toast.error(err?.response?.data?.detail || "Could not create home");
        } finally {
            setLoading(false);
        }
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
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-6 grain-bg py-12" data-testid="register-page">
            <div className="w-full max-w-md bg-white border border-stoke rounded-3xl p-10 animate-fade-up">
                <Link to="/" className="flex items-center gap-2 mb-8" data-testid="register-logo">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-sage text-white">
                        <Sparkles className="h-4 w-4" />
                    </span>
                    <span className="font-display font-bold text-xl text-ink">
                        Jarvis<span className="text-sage">.home</span>
                    </span>
                </Link>
                <h1 className="font-display text-3xl font-bold text-ink tracking-tight">
                    Make your home easier
                </h1>
                <p className="text-ink-secondary mt-2 text-[15px]">
                    Less deciding. More living.
                </p>

                <Tabs value={mode} onValueChange={setMode} className="mt-7">
                    <TabsList className="grid grid-cols-2 w-full bg-bg-muted rounded-full p-1 h-11">
                        <TabsTrigger
                            value="create"
                            className="rounded-full data-[state=active]:bg-white data-[state=active]:text-ink data-[state=active]:shadow-sm text-ink-secondary"
                            data-testid="tab-create"
                        >
                            <Home className="h-3.5 w-3.5 mr-2" />
                            Start a home
                        </TabsTrigger>
                        <TabsTrigger
                            value="join"
                            className="rounded-full data-[state=active]:bg-white data-[state=active]:text-ink data-[state=active]:shadow-sm text-ink-secondary"
                            data-testid="tab-join"
                        >
                            <Users className="h-3.5 w-3.5 mr-2" />
                            Join a home
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="create" className="mt-6">
                        <form onSubmit={onCreate} className="space-y-4" data-testid="create-form">
                            <Field label="Your name">
                                <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Priya Sharma" className={inp} data-testid="register-name-input" />
                            </Field>
                            <Field label="Home name (optional)">
                                <Input value={householdName} onChange={(e) => setHouseholdName(e.target.value)} placeholder="The Sharma family" className={inp} data-testid="register-household-input" />
                            </Field>
                            <Field label="Email">
                                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@home.com" className={inp} data-testid="register-email-input" />
                            </Field>
                            <Field label="Password">
                                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="At least 6 characters" className={inp} data-testid="register-password-input" />
                            </Field>
                            <Button type="submit" disabled={loading} className="w-full rounded-full bg-sage hover:bg-sage-hover text-white h-11" data-testid="register-submit-button">
                                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create my home"}
                            </Button>
                        </form>
                    </TabsContent>

                    <TabsContent value="join" className="mt-6">
                        <form onSubmit={onJoin} className="space-y-4" data-testid="join-form">
                            <Field label="Invite code">
                                <Input value={inviteCode} onChange={(e) => setInviteCode(e.target.value.toUpperCase())} required placeholder="ABCD1234" maxLength={12} className={`${inp} font-mono tracking-wider uppercase`} data-testid="join-code-input" />
                            </Field>
                            <Field label="Your name">
                                <Input value={jName} onChange={(e) => setJName(e.target.value)} required placeholder="Rohan Sharma" className={inp} data-testid="join-name-input" />
                            </Field>
                            <Field label="Email">
                                <Input type="email" value={jEmail} onChange={(e) => setJEmail(e.target.value)} required placeholder="you@home.com" className={inp} data-testid="join-email-input" />
                            </Field>
                            <Field label="Password">
                                <Input type="password" value={jPassword} onChange={(e) => setJPassword(e.target.value)} required placeholder="At least 6 characters" className={inp} data-testid="join-password-input" />
                            </Field>
                            <Button type="submit" disabled={loading} className="w-full rounded-full bg-sage hover:bg-sage-hover text-white h-11" data-testid="join-submit-button">
                                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Join the home"}
                            </Button>
                        </form>
                    </TabsContent>
                </Tabs>

                <p className="text-sm text-ink-secondary mt-6 text-center">
                    Already have an account?{" "}
                    <Link to="/login" className="text-sage font-semibold hover:underline" data-testid="register-login-link">
                        Sign in
                    </Link>
                </p>
            </div>
        </div>
    );
}

const inp = "rounded-xl border-stoke bg-bg-base h-11 focus-visible:ring-2 focus-visible:ring-terracotta";

const Field = ({ label, children }) => (
    <div className="space-y-2">
        <Label className="text-ink">{label}</Label>
        {children}
    </div>
);
