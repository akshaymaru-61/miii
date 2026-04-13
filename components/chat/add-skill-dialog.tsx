"use client";

import * as React from "react";
import { Loader2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
};

export function AddSkillDialog({ open, onOpenChange, onSaved }: Props) {
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setError(null);
  }, [open]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/custom-tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Save failed");
      }
      setName("");
      setDescription("");
      onOpenChange(false);
      onSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white text-neutral-950 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-neutral-950">
            Add custom skill
          </DialogTitle>
          <DialogDescription className="text-neutral-600">
            Name and describe a tool. It is saved under{" "}
            <code className="rounded bg-neutral-100 px-1 text-xs">
              customTools/
            </code>{" "}
            and registered in the LangGraph agent (name must be a valid
            identifier).
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="skill-name" className="text-neutral-900">
              Tool name
            </Label>
            <Input
              id="skill-name"
              placeholder="e.g. lookup_ticket"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border-neutral-300 bg-white text-neutral-950"
              autoComplete="off"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="skill-desc" className="text-neutral-900">
              Description
            </Label>
            <Textarea
              id="skill-desc"
              placeholder="What this tool does (shown to the model)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="resize-none border-neutral-300 bg-white text-neutral-950"
            />
          </div>
          {error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter className="gap-2 sm:justify-end border-none">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="border-neutral-300 text-neutral-900"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void save()}
            disabled={saving || !name.trim() || !description.trim()}
            className="bg-neutral-950 text-white hover:bg-neutral-800"
          >
            {saving ? <Loader2Icon className="size-4 animate-spin" /> : null}
            Save skill
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
