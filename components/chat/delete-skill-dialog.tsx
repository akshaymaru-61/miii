"use client";

import * as React from "react";
import { Loader2Icon, Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ToolRow = { name: string; description: string; createdAt: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
};

export function DeleteSkillDialog({ open, onOpenChange, onDeleted }: Props) {
  const [tools, setTools] = React.useState<ToolRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [deleting, setDeleting] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/custom-tools");
      const data = (await res.json()) as { tools?: ToolRow[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to load tools");
      setTools(data.tools ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setTools([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  async function removeTool(name: string) {
    if (
      !window.confirm(
        `Delete tool "${name}"? This removes the JSON file under customTools/.`,
      )
    ) {
      return;
    }
    setDeleting(name);
    setError(null);
    try {
      const res = await fetch(
        `/api/custom-tools?name=${encodeURIComponent(name)}`,
        { method: "DELETE" },
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Delete failed");
      setTools((prev) => prev.filter((t) => t.name !== name));
      onDeleted?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white text-neutral-950 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-neutral-950">Delete custom tool</DialogTitle>
          <DialogDescription className="text-neutral-600">
            Remove a skill JSON file from{" "}
            <code className="rounded bg-neutral-100 px-1 text-xs">customTools/</code>
            . The model will stop seeing this tool after the next request.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[min(50vh,20rem)] overflow-y-auto rounded-lg border border-neutral-200">
          {loading ? (
            <p className="flex items-center gap-2 px-3 py-6 text-sm text-neutral-500">
              <Loader2Icon className="size-4 animate-spin" />
              Loading tools…
            </p>
          ) : tools.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-neutral-500">
              No custom tools yet. Add one with /tools or “Add tool” in the slash
              menu.
            </p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {tools.map((t) => (
                <li
                  key={t.name}
                  className="flex items-start gap-2 px-3 py-2.5 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-neutral-900">{t.name}</p>
                    <p className="line-clamp-2 text-neutral-600">{t.description}</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 border-red-200 text-red-700 hover:bg-red-50"
                    disabled={deleting !== null}
                    onClick={() => void removeTool(t.name)}
                    aria-label={`Delete ${t.name}`}
                  >
                    {deleting === t.name ? (
                      <Loader2Icon className="size-4 animate-spin" />
                    ) : (
                      <Trash2Icon className="size-4" />
                    )}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            className="border-neutral-300 text-neutral-950"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
