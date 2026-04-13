"use client";

import * as React from "react";
import { Loader2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialKey: string;
  onSave: (key: string) => void;
  /** Shown when the server returned TAVILY_KEY_REQUIRED */
  serverHint?: string | null;
};

export function TavilyKeyDialog({
  open,
  onOpenChange,
  initialKey,
  onSave,
  serverHint,
}: Props) {
  const [key, setKey] = React.useState(initialKey);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) setKey(initialKey);
  }, [open, initialKey]);

  function save() {
    setSaving(true);
    try {
      onSave(key.trim());
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white text-neutral-950 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-neutral-950">Tavily API key</DialogTitle>
          <DialogDescription className="text-neutral-600">
            Web search uses{" "}
            <a
              href="https://tavily.com"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-neutral-800 underline"
            >
              Tavily
            </a>
            . Paste your API key to enable <code className="text-xs">tavily_web_search</code>{" "}
            in the agent. You can leave the field empty if this server is already configured
            with the <code className="text-xs">TAVILY_API_KEY</code> environment variable.
          </DialogDescription>
        </DialogHeader>
        {serverHint ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            {serverHint}
          </p>
        ) : null}
        <div className="grid gap-2 py-2">
          <Label htmlFor="tavily-key" className="text-neutral-900">
            API key
          </Label>
          <Input
            id="tavily-key"
            type="password"
            autoComplete="off"
            placeholder="tvly-…"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="border-neutral-300 bg-white font-mono text-sm text-neutral-950"
          />
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            className="border-neutral-300 text-neutral-950"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-neutral-950 text-white hover:bg-neutral-800"
            onClick={() => void save()}
            disabled={saving}
          >
            {saving ? <Loader2Icon className="size-4 animate-spin" /> : null}
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
