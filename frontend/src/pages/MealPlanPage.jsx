import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Sparkles, Pencil, Loader2 } from "lucide-react";

const SLOTS = ["breakfast", "lunch", "dinner"];

const formatDay = (iso) => {
    const d = new Date(iso + "T00:00:00");
    return {
        weekday: d.toLocaleDateString("en-IN", { weekday: "short" }),
        date: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
        isToday: d.toDateString() === new Date().toDateString(),
    };
};

export default function MealPlanPage() {
    const [week, setWeek] = useState([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [editing, setEditing] = useState(null); // {day, slot, meal}

    const load = async () => {
        setLoading(true);
        try {
            const { data } = await api.get("/mealplan/week");
            setWeek(data);
        } finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        load();
    }, []);

    const generate = async () => {
        setGenerating(true);
        try {
            const { data } = await api.post("/ai/generate-weekly-plan");
            setWeek(data);
            toast.success("Week planned. Tweak anything you'd like.");
        } catch (err) {
            toast.error(err?.response?.data?.detail || "Could not generate plan");
        } finally {
            setGenerating(false);
        }
    };

    const saveMeal = async (day, slot, meal) => {
        try {
            const { data } = await api.put("/mealplan/meal", { day, slot, meal });
            setWeek((w) => w.map((d) => (d.date === day ? data : d)));
            toast.success("Saved");
            setEditing(null);
        } catch (err) {
            toast.error("Could not save");
        }
    };

    return (
        <div className="p-6 lg:p-12 max-w-7xl mx-auto" data-testid="meals-page">
            <div className="flex flex-wrap items-end justify-between gap-4 mb-10 animate-fade-up">
                <div>
                    <p className="text-xs tracking-[0.2em] uppercase font-bold text-terracotta mb-2">
                        This week
                    </p>
                    <h1 className="font-display text-3xl lg:text-4xl font-bold text-ink tracking-tight">
                        Your meal plan
                    </h1>
                    <p className="text-ink-secondary mt-2 max-w-xl">
                        Auto-generated to match your family's diet, allergies and
                        what's already in the pantry. Tap any meal to edit.
                    </p>
                </div>
                <Button
                    onClick={generate}
                    disabled={generating}
                    className="rounded-full bg-sage hover:bg-sage-hover text-white px-6"
                    data-testid="generate-week-button"
                >
                    {generating ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                        <Sparkles className="h-4 w-4 mr-2" />
                    )}
                    {generating ? "Planning…" : "Auto-plan the week"}
                </Button>
            </div>

            {loading ? (
                <p className="text-ink-muted">Loading week…</p>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-7 gap-4" data-testid="week-grid">
                    {week.map((day) => {
                        const f = formatDay(day.date);
                        return (
                            <div
                                key={day.date}
                                className={`rounded-2xl bg-white border ${
                                    f.isToday
                                        ? "border-terracotta/50 ring-1 ring-terracotta/20"
                                        : "border-stoke"
                                } p-4 flex flex-col`}
                                data-testid={`day-card-${day.date}`}
                            >
                                <div className="mb-4">
                                    <p className="text-xs tracking-[0.18em] uppercase font-bold text-ink-muted">
                                        {f.weekday}
                                        {f.isToday && (
                                            <span className="ml-2 text-terracotta">
                                                today
                                            </span>
                                        )}
                                    </p>
                                    <p className="font-display text-base font-semibold text-ink">
                                        {f.date}
                                    </p>
                                </div>
                                <div className="space-y-3 flex-1">
                                    {SLOTS.map((slot) => {
                                        const meal = day[slot] || { name: "" };
                                        return (
                                            <button
                                                key={slot}
                                                onClick={() =>
                                                    setEditing({
                                                        day: day.date,
                                                        slot,
                                                        meal,
                                                    })
                                                }
                                                className="w-full text-left rounded-xl bg-bg-base border border-stoke px-3 py-2.5 hover:border-sage transition-colors group"
                                                data-testid={`meal-${day.date}-${slot}`}
                                            >
                                                <div className="flex items-center justify-between gap-2">
                                                    <p className="text-[10px] tracking-[0.18em] uppercase font-bold text-ink-muted">
                                                        {slot}
                                                    </p>
                                                    <Pencil className="h-3 w-3 text-ink-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                                                </div>
                                                {meal.name ? (
                                                    <p className="text-sm text-ink font-medium leading-snug mt-0.5">
                                                        {meal.name}
                                                    </p>
                                                ) : (
                                                    <p className="text-sm text-ink-muted italic mt-0.5">
                                                        + add
                                                    </p>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
                <DialogContent className="bg-white border-stoke rounded-2xl" data-testid="meal-edit-dialog">
                    <DialogHeader>
                        <DialogTitle className="font-display text-2xl text-ink">
                            {editing?.slot
                                ? editing.slot.charAt(0).toUpperCase() +
                                  editing.slot.slice(1)
                                : ""}{" "}
                            • {editing?.day}
                        </DialogTitle>
                    </DialogHeader>
                    {editing && (
                        <EditMealForm
                            initial={editing.meal}
                            onSave={(m) => saveMeal(editing.day, editing.slot, m)}
                            onCancel={() => setEditing(null)}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

function EditMealForm({ initial, onSave, onCancel }) {
    const [name, setName] = useState(initial?.name || "");
    const [ingredients, setIngredients] = useState(
        (initial?.ingredients || []).join(", "),
    );
    const [notes, setNotes] = useState(initial?.notes || "");

    const submit = (e) => {
        e.preventDefault();
        onSave({
            name,
            ingredients: ingredients
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            notes,
            recipe: initial?.recipe || "",
        });
    };

    return (
        <form onSubmit={submit} className="space-y-4" data-testid="meal-edit-form">
            <div className="space-y-2">
                <Label className="text-ink">Dish name</Label>
                <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Aloo paratha"
                    className="rounded-xl border-stoke bg-bg-base h-11 focus-visible:ring-2 focus-visible:ring-terracotta"
                    data-testid="meal-name-input"
                />
            </div>
            <div className="space-y-2">
                <Label className="text-ink">Ingredients (comma separated)</Label>
                <Textarea
                    value={ingredients}
                    onChange={(e) => setIngredients(e.target.value)}
                    placeholder="atta, potatoes, ghee, cumin"
                    className="rounded-xl border-stoke bg-bg-base focus-visible:ring-2 focus-visible:ring-terracotta"
                    data-testid="meal-ingredients-input"
                />
            </div>
            <div className="space-y-2">
                <Label className="text-ink">Notes for the cook</Label>
                <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Less spice for kids; serve with curd"
                    className="rounded-xl border-stoke bg-bg-base focus-visible:ring-2 focus-visible:ring-terracotta"
                    data-testid="meal-notes-input"
                />
            </div>
            <DialogFooter className="gap-2">
                <Button
                    type="button"
                    variant="ghost"
                    onClick={onCancel}
                    className="rounded-full text-ink-secondary hover:text-ink hover:bg-bg-muted"
                    data-testid="meal-edit-cancel"
                >
                    Cancel
                </Button>
                <Button
                    type="submit"
                    className="rounded-full bg-sage hover:bg-sage-hover text-white"
                    data-testid="meal-edit-save"
                >
                    Save meal
                </Button>
            </DialogFooter>
        </form>
    );
}
