import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
    DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Users } from "lucide-react";

const ROLES = ["self", "spouse", "parent", "child", "elderly", "guest", "cook"];
const DIETS = ["vegetarian", "non-vegetarian", "vegan", "jain", "eggetarian"];

export default function FamilyPage() {
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(null);
    const [creating, setCreating] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const { data } = await api.get("/family");
            setMembers(data);
        } finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        load();
    }, []);

    const save = async (payload, id) => {
        try {
            if (id) {
                const { data } = await api.put(`/family/${id}`, payload);
                setMembers((arr) => arr.map((m) => (m.id === id ? data : m)));
                toast.success("Updated");
            } else {
                const { data } = await api.post("/family", payload);
                setMembers((arr) => [...arr, data]);
                toast.success("Added");
            }
            setEditing(null);
            setCreating(false);
        } catch {
            toast.error("Save failed");
        }
    };

    const remove = async (id) => {
        try {
            await api.delete(`/family/${id}`);
            setMembers((arr) => arr.filter((m) => m.id !== id));
            toast.success("Removed");
        } catch {
            toast.error("Delete failed");
        }
    };

    return (
        <div className="p-6 lg:p-12 max-w-5xl mx-auto" data-testid="family-page">
            <div className="flex flex-wrap items-end justify-between gap-4 mb-10 animate-fade-up">
                <div>
                    <p className="text-xs tracking-[0.2em] uppercase font-bold text-terracotta mb-2">
                        Family
                    </p>
                    <h1 className="font-display text-3xl lg:text-4xl font-bold text-ink tracking-tight">
                        Who's at the table
                    </h1>
                    <p className="text-ink-secondary mt-2 max-w-xl">
                        Tell Jarvis once. It'll remember diets, allergies and
                        preferences for every meal it suggests.
                    </p>
                </div>
                <Button
                    onClick={() => setCreating(true)}
                    className="rounded-full bg-sage hover:bg-sage-hover text-white"
                    data-testid="add-family-button"
                >
                    <Plus className="h-4 w-4 mr-2" />
                    Add member
                </Button>
            </div>

            {loading ? (
                <p className="text-ink-muted">Loading…</p>
            ) : members.length === 0 ? (
                <div className="rounded-2xl border border-stoke bg-white p-12 text-center">
                    <Users className="h-10 w-10 text-ink-muted mx-auto mb-3" />
                    <p className="font-display text-xl text-ink">
                        Add your first family member
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="family-grid">
                    {members.map((m) => (
                        <div
                            key={m.id}
                            className="rounded-2xl bg-white border border-stoke p-6 card-hover"
                            data-testid={`family-card-${m.id}`}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-[10px] tracking-[0.18em] uppercase font-bold text-ink-muted">
                                        {m.role}
                                    </p>
                                    <h3 className="font-display text-xl font-semibold text-ink mt-1">
                                        {m.name}
                                    </h3>
                                    <p className="text-ink-secondary text-sm mt-1 capitalize">
                                        {m.diet}
                                    </p>
                                    {m.allergies?.length > 0 && (
                                        <p className="text-xs text-terracotta mt-2">
                                            Allergies: {m.allergies.join(", ")}
                                        </p>
                                    )}
                                    {m.preferences && (
                                        <p className="text-sm text-ink-secondary mt-2 italic">
                                            "{m.preferences}"
                                        </p>
                                    )}
                                </div>
                                <div className="flex flex-col gap-1">
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => setEditing(m)}
                                        className="text-ink-secondary hover:text-ink hover:bg-bg-muted h-8 w-8"
                                        data-testid={`edit-family-${m.id}`}
                                    >
                                        <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => remove(m.id)}
                                        className="text-ink-secondary hover:text-terracotta hover:bg-bg-muted h-8 w-8"
                                        data-testid={`delete-family-${m.id}`}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ))}
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
                            {editing ? "Edit member" : "Add family member"}
                        </DialogTitle>
                    </DialogHeader>
                    <FamilyForm
                        initial={editing}
                        onSave={(p) => save(p, editing?.id)}
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

function FamilyForm({ initial, onSave, onCancel }) {
    const [name, setName] = useState(initial?.name || "");
    const [role, setRole] = useState(initial?.role || "self");
    const [diet, setDiet] = useState(initial?.diet || "vegetarian");
    const [allergies, setAllergies] = useState(
        (initial?.allergies || []).join(", "),
    );
    const [preferences, setPreferences] = useState(initial?.preferences || "");

    const submit = (e) => {
        e.preventDefault();
        onSave({
            name,
            role,
            diet,
            allergies: allergies
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            preferences,
        });
    };

    return (
        <form onSubmit={submit} className="space-y-4" data-testid="family-form">
            <div className="space-y-2">
                <Label className="text-ink">Name</Label>
                <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="Aarav"
                    className="rounded-xl border-stoke bg-bg-base h-11 focus-visible:ring-2 focus-visible:ring-terracotta"
                    data-testid="family-name-input"
                />
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                    <Label className="text-ink">Role</Label>
                    <Select value={role} onValueChange={setRole}>
                        <SelectTrigger
                            className="rounded-xl border-stoke bg-bg-base h-11"
                            data-testid="family-role-select"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {ROLES.map((r) => (
                                <SelectItem
                                    key={r}
                                    value={r}
                                    className="capitalize"
                                >
                                    {r}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label className="text-ink">Diet</Label>
                    <Select value={diet} onValueChange={setDiet}>
                        <SelectTrigger
                            className="rounded-xl border-stoke bg-bg-base h-11"
                            data-testid="family-diet-select"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {DIETS.map((d) => (
                                <SelectItem
                                    key={d}
                                    value={d}
                                    className="capitalize"
                                >
                                    {d}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <div className="space-y-2">
                <Label className="text-ink">Allergies (comma separated)</Label>
                <Input
                    value={allergies}
                    onChange={(e) => setAllergies(e.target.value)}
                    placeholder="peanuts, lactose"
                    className="rounded-xl border-stoke bg-bg-base h-11 focus-visible:ring-2 focus-visible:ring-terracotta"
                    data-testid="family-allergies-input"
                />
            </div>
            <div className="space-y-2">
                <Label className="text-ink">Preferences / notes</Label>
                <Textarea
                    value={preferences}
                    onChange={(e) => setPreferences(e.target.value)}
                    placeholder="Loves paneer; no spicy food after 7pm"
                    className="rounded-xl border-stoke bg-bg-base focus-visible:ring-2 focus-visible:ring-terracotta"
                    data-testid="family-preferences-input"
                />
            </div>
            <DialogFooter className="gap-2">
                <Button
                    type="button"
                    variant="ghost"
                    onClick={onCancel}
                    className="rounded-full text-ink-secondary hover:text-ink hover:bg-bg-muted"
                    data-testid="family-cancel"
                >
                    Cancel
                </Button>
                <Button
                    type="submit"
                    className="rounded-full bg-sage hover:bg-sage-hover text-white"
                    data-testid="family-save"
                >
                    Save
                </Button>
            </DialogFooter>
        </form>
    );
}
