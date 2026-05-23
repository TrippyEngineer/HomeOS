import React, { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, AlertTriangle, Trash2, Pencil, Sparkles, Loader2, X } from "lucide-react";

const CATEGORIES = [
    "staple",
    "vegetable",
    "fruit",
    "dairy",
    "spice",
    "snack",
    "beverage",
    "other",
];
const UNITS = ["kg", "g", "l", "ml", "pcs", "packet"];

export default function PantryPage() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(null);
    const [creating, setCreating] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [groceryList, setGroceryList] = useState(null);

    const load = async () => {
        setLoading(true);
        try {
            const { data } = await api.get("/pantry");
            setItems(data);
        } finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        load();
    }, []);

    const low = useMemo(
        () =>
            items.filter(
                (i) => Number(i.qty) <= Number(i.low_threshold || 0),
            ),
        [items],
    );

    const handleSave = async (payload, id) => {
        try {
            if (id) {
                const { data } = await api.put(`/pantry/${id}`, payload);
                setItems((arr) => arr.map((i) => (i.id === id ? data : i)));
                toast.success("Updated");
            } else {
                const { data } = await api.post("/pantry", payload);
                setItems((arr) => [...arr, data]);
                toast.success("Added");
            }
            setEditing(null);
            setCreating(false);
        } catch (err) {
            toast.error("Save failed");
        }
    };

    const handleDelete = async (id) => {
        try {
            await api.delete(`/pantry/${id}`);
            setItems((arr) => arr.filter((i) => i.id !== id));
            toast.success("Removed");
        } catch {
            toast.error("Delete failed");
        }
    };

    const generateGrocery = async () => {
        setGenerating(true);
        try {
            const { data } = await api.post("/ai/grocery-list");
            setGroceryList(data.items || []);
            toast.success("Grocery list ready");
        } catch (err) {
            toast.error(err?.response?.data?.detail || "Could not generate");
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div className="p-6 lg:p-12 max-w-7xl mx-auto" data-testid="pantry-page">
            <div className="flex flex-wrap items-end justify-between gap-4 mb-10 animate-fade-up">
                <div>
                    <p className="text-xs tracking-[0.2em] uppercase font-bold text-terracotta mb-2">
                        Pantry
                    </p>
                    <h1 className="font-display text-3xl lg:text-4xl font-bold text-ink tracking-tight">
                        What's in the kitchen
                    </h1>
                    <p className="text-ink-secondary mt-2">
                        {items.length} items • {low.length} running low
                    </p>
                </div>
                <div className="flex gap-3">
                    <Button
                        onClick={generateGrocery}
                        disabled={generating}
                        variant="outline"
                        className="rounded-full border-stoke bg-white hover:bg-bg-muted text-ink hover:text-ink"
                        data-testid="generate-grocery-button"
                    >
                        {generating ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                            <Sparkles className="h-4 w-4 mr-2 text-terracotta" />
                        )}
                        Smart grocery list
                    </Button>
                    <Button
                        onClick={() => setCreating(true)}
                        className="rounded-full bg-sage hover:bg-sage-hover text-white"
                        data-testid="add-pantry-button"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Add item
                    </Button>
                </div>
            </div>

            {groceryList && (
                <div className="mb-10 rounded-2xl border border-terracotta/40 bg-[#FBF2EC] p-6 animate-fade-up" data-testid="grocery-list-result">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-display text-xl font-semibold text-ink">
                            Suggested grocery run
                        </h2>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setGroceryList(null)}
                            className="text-ink-secondary hover:text-ink"
                            data-testid="grocery-close-button"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                    {groceryList.length === 0 ? (
                        <p className="text-ink-secondary">
                            Nothing urgent. Pantry looks healthy.
                        </p>
                    ) : (
                        <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {groceryList.map((g, i) => (
                                <li
                                    key={i}
                                    className="flex items-start justify-between gap-3 bg-white rounded-xl border border-stoke px-4 py-3"
                                >
                                    <div>
                                        <p className="text-ink font-medium">
                                            {g.name}{" "}
                                            <span className="text-ink-muted text-sm">
                                                · {g.qty}
                                            </span>
                                        </p>
                                        <p className="text-xs text-ink-muted">
                                            {g.reason}
                                        </p>
                                    </div>
                                    <span className="text-[10px] uppercase tracking-[0.15em] font-bold text-sage">
                                        {g.category}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            {loading ? (
                <p className="text-ink-muted">Loading pantry…</p>
            ) : items.length === 0 ? (
                <div className="rounded-2xl border border-stoke bg-white p-12 text-center" data-testid="pantry-empty-state">
                    <p className="font-display text-xl text-ink">
                        Your pantry is empty
                    </p>
                    <p className="text-ink-secondary mt-2">
                        Add a few essentials so Jarvis can keep an eye on them.
                    </p>
                    <Button
                        onClick={() => setCreating(true)}
                        className="mt-6 rounded-full bg-sage hover:bg-sage-hover text-white"
                        data-testid="pantry-empty-add-button"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Add first item
                    </Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="pantry-grid">
                    {items.map((item) => {
                        const isLow =
                            Number(item.qty) <= Number(item.low_threshold || 0);
                        return (
                            <div
                                key={item.id}
                                className={`rounded-2xl border ${
                                    isLow
                                        ? "border-terracotta/40 bg-[#FBF2EC]"
                                        : "border-stoke bg-white"
                                } p-5 card-hover`}
                                data-testid={`pantry-item-${item.id}`}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-[10px] tracking-[0.18em] uppercase font-bold text-ink-muted">
                                            {item.category}
                                        </p>
                                        <h3 className="font-display text-lg font-semibold text-ink mt-1 truncate">
                                            {item.name}
                                        </h3>
                                        <p className="text-ink-secondary text-sm mt-1">
                                            {item.qty} {item.unit}
                                        </p>
                                        {isLow && (
                                            <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-terracotta font-medium">
                                                <AlertTriangle className="h-3 w-3" />
                                                Running low
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            onClick={() => setEditing(item)}
                                            className="text-ink-secondary hover:text-ink hover:bg-bg-muted h-8 w-8"
                                            data-testid={`edit-pantry-${item.id}`}
                                        >
                                            <Pencil className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            onClick={() => handleDelete(item.id)}
                                            className="text-ink-secondary hover:text-terracotta hover:bg-bg-muted h-8 w-8"
                                            data-testid={`delete-pantry-${item.id}`}
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <Dialog
                open={creating || !!editing}
                onOpenChange={(v) => {
                    if (!v) {
                        setCreating(false);
                        setEditing(null);
                    }
                }}
            >
                <DialogContent className="bg-white border-stoke rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="font-display text-2xl text-ink">
                            {editing ? "Edit item" : "Add to pantry"}
                        </DialogTitle>
                    </DialogHeader>
                    <PantryForm
                        initial={editing}
                        onSave={(p) => handleSave(p, editing?.id)}
                        onCancel={() => {
                            setCreating(false);
                            setEditing(null);
                        }}
                    />
                </DialogContent>
            </Dialog>
        </div>
    );
}

function PantryForm({ initial, onSave, onCancel }) {
    const [name, setName] = useState(initial?.name || "");
    const [qty, setQty] = useState(initial?.qty ?? 1);
    const [unit, setUnit] = useState(initial?.unit || "kg");
    const [category, setCategory] = useState(initial?.category || "staple");
    const [lowThreshold, setLowThreshold] = useState(
        initial?.low_threshold ?? 0.5,
    );

    const submit = (e) => {
        e.preventDefault();
        onSave({
            name,
            qty: Number(qty),
            unit,
            category,
            low_threshold: Number(lowThreshold),
        });
    };

    return (
        <form onSubmit={submit} className="space-y-4" data-testid="pantry-form">
            <div className="space-y-2">
                <Label className="text-ink">Item name</Label>
                <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="Toor dal"
                    className="rounded-xl border-stoke bg-bg-base h-11 focus-visible:ring-2 focus-visible:ring-terracotta"
                    data-testid="pantry-name-input"
                />
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                    <Label className="text-ink">Quantity</Label>
                    <Input
                        type="number"
                        step="0.01"
                        value={qty}
                        onChange={(e) => setQty(e.target.value)}
                        required
                        className="rounded-xl border-stoke bg-bg-base h-11 focus-visible:ring-2 focus-visible:ring-terracotta"
                        data-testid="pantry-qty-input"
                    />
                </div>
                <div className="space-y-2">
                    <Label className="text-ink">Unit</Label>
                    <Select value={unit} onValueChange={setUnit}>
                        <SelectTrigger
                            className="rounded-xl border-stoke bg-bg-base h-11"
                            data-testid="pantry-unit-select"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {UNITS.map((u) => (
                                <SelectItem key={u} value={u}>
                                    {u}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                    <Label className="text-ink">Category</Label>
                    <Select value={category} onValueChange={setCategory}>
                        <SelectTrigger
                            className="rounded-xl border-stoke bg-bg-base h-11"
                            data-testid="pantry-category-select"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {CATEGORIES.map((c) => (
                                <SelectItem key={c} value={c} className="capitalize">
                                    {c}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label className="text-ink">Alert when below</Label>
                    <Input
                        type="number"
                        step="0.01"
                        value={lowThreshold}
                        onChange={(e) => setLowThreshold(e.target.value)}
                        className="rounded-xl border-stoke bg-bg-base h-11 focus-visible:ring-2 focus-visible:ring-terracotta"
                        data-testid="pantry-threshold-input"
                    />
                </div>
            </div>
            <DialogFooter className="gap-2">
                <Button
                    type="button"
                    variant="ghost"
                    onClick={onCancel}
                    className="rounded-full text-ink-secondary hover:text-ink hover:bg-bg-muted"
                    data-testid="pantry-cancel"
                >
                    Cancel
                </Button>
                <Button
                    type="submit"
                    className="rounded-full bg-sage hover:bg-sage-hover text-white"
                    data-testid="pantry-save"
                >
                    Save
                </Button>
            </DialogFooter>
        </form>
    );
}
