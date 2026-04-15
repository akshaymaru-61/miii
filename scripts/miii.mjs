#!/usr/bin/env node
/**
 * Global CLI: `miii web` | `miii tui`
 * Install once from this repo: npm install -g .
 * Then run `miii` from any directory (paths resolve to this package root).
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const sub = argv[0];

function usage() {
  console.log(`Miii — A local-first AI chat UI built to simplify running LLMs locally

Usage:
  miii web [args]     Next.js dev server
  miii tui [args]     Terminal UI (start the API first, e.g. miii web in another terminal)
  miii help           Show this message

Examples:
  miii web
  miii web -- -p 4000
  miii tui
  miii tui -- --url http://127.0.0.1:3000
`);
}

function runNpmScript(name, passthrough) {
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const args = ["run", name];
  if (passthrough.length > 0) args.push("--", ...passthrough);
  const child = spawn(npm, args, {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
  child.on("exit", (code, signal) => {
    if (signal) process.exit(1);
    process.exit(code ?? 0);
  });
}

if (!sub || sub === "help" || sub === "-h" || sub === "--help") {
  usage();
  process.exit(0);
}

if (sub === "web") {
  runNpmScript("dev", argv.slice(1));
} else if (sub === "tui") {
  runNpmScript("tui", argv.slice(1));
} else {
  console.error(`Unknown command: ${sub}\n`);
  usage();
  process.exit(1);
}
