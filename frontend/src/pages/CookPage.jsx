import React, { useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ChefHat, Sparkles, Loader2, Copy, MessageCircle } from "lucide-react";

export default function CookPage() {
    const [instructions, setInstructions] = useState("");
    const [plan, setPlan] = useState(null);
    const [loading, setLoading] = useState(false);

    const generate = async () => {
        setLoading(true);
        try {
            const { data } = await api.post("/ai/cook-instructions");
            setInstructions(data.instructions);
            setPlan(data.plan);
        } catch (err) {
            toast.error(
                err?.response?.data?.detail ||
                    "Could not generate. Plan some meals first.",
            );
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = async () => {
        try {
            await navigator.clipboard.writeText(instructions);
            toast.success("Copied. Paste into WhatsApp.");
        } catch {
            toast.error("Could not copy");
        }
    };

    const openWhatsApp = () => {
        const text = encodeURIComponent(instructions);
        window.open(`https://wa.me/?text=${text}`, "_blank");
    };

    return (
        <div className="p-6 lg:p-12 max-w-4xl mx-auto" data-testid="cook-page">
            <div className="animate-fade-up">
                <p className="text-xs tracking-[0.2em] uppercase font-bold text-terracotta mb-2">
                    Today's handover
                </p>
                <h1 className="font-display text-3xl lg:text-4xl font-bold text-ink tracking-tight">
                    Brief your cook
                </h1>
                <p className="text-ink-secondary mt-2 max-w-2xl">
                    A clear, warm note with ingredients, prep steps, and notes for
                    each meal. Share to WhatsApp with one tap.
                </p>
            </div>

            <div className="mt-8 rounded-2xl border border-terracotta/30 bg-[#FBF2EC] p-7" data-testid="cook-card">
                <div className="flex items-center gap-3 mb-5">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-terracotta text-white">
                        <ChefHat className="h-5 w-5" />
                    </span>
                    <div>
                        <p className="font-display text-lg font-semibold text-ink">
                            Cook instructions
                        </p>
                        <p className="text-xs text-ink-muted">
                            Generated from today's meal plan
                        </p>
                    </div>
                </div>

                {!instructions && (
                    <div className="bg-white rounded-xl border border-stoke p-8 text-center">
                        <p className="text-ink-secondary mb-5">
                            No notes yet. Pull today's meal plan into a clean
                            handover.
                        </p>
                        <Button
                            onClick={generate}
                            disabled={loading}
                            className="rounded-full bg-sage hover:bg-sage-hover text-white px-6"
                            data-testid="generate-cook-button"
                        >
                            {loading ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <Sparkles className="h-4 w-4 mr-2" />
                            )}
                            {loading ? "Writing…" : "Generate today's handover"}
                        </Button>
                    </div>
                )}

                {instructions && (
                    <>
                        <pre
                            className="bg-white rounded-xl border border-stoke p-5 text-[15px] text-ink whitespace-pre-wrap font-sans leading-relaxed max-h-[60vh] overflow-y-auto"
                            data-testid="cook-instructions-text"
                        >
                            {instructions}
                        </pre>
                        <div className="mt-5 flex flex-wrap gap-3">
                            <Button
                                onClick={openWhatsApp}
                                className="rounded-full bg-sage hover:bg-sage-hover text-white"
                                data-testid="cook-share-whatsapp"
                            >
                                <MessageCircle className="h-4 w-4 mr-2" />
                                Send on WhatsApp
                            </Button>
                            <Button
                                onClick={copyToClipboard}
                                variant="outline"
                                className="rounded-full border-stoke bg-white hover:bg-bg-muted text-ink hover:text-ink"
                                data-testid="cook-copy-button"
                            >
                                <Copy className="h-4 w-4 mr-2" />
                                Copy
                            </Button>
                            <Button
                                onClick={generate}
                                variant="ghost"
                                disabled={loading}
                                className="rounded-full text-ink-secondary hover:text-ink hover:bg-bg-muted"
                                data-testid="cook-regenerate-button"
                            >
                                {loading ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                    <Sparkles className="h-4 w-4 mr-2" />
                                )}
                                Regenerate
                            </Button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
