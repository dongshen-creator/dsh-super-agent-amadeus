#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Junction-link the host `@deepseek-ai/*` packages into every plugin's node_modules.

dsh ships all host packages inside its own install tree. Linking them (instead
of installing them from npm) guarantees the plugins compile against exactly the
API the running dsh exposes.

Run AFTER `npm install` (npm prunes unknown directories), i.e. exactly like
`scripts/build.mjs` orchestrates it.

Usage:
    python scripts/link_deps.py
    python scripts/link_deps.py --host "C:/path/to/dsh/node_modules"
"""
from __future__ import annotations

import argparse
import os

import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Packages every plugin is allowed to import at runtime (never bundled).
LINKED = [
    "@deepseek-ai/cordis",
    "@deepseek-ai/schemastery",
    "@deepseek-ai/dsh-tools",
    "@deepseek-ai/dsh-llm",
    "@deepseek-ai/dsh-skill",
    "@deepseek-ai/dsh-system-prompt",
    "@deepseek-ai/dsh-util-values",
    "@deepseek-ai/dsh-client-ui-tool",
    "@deepseek-ai/dsh-client-ui-chat",
    "@deepseek-ai/dsh-client-ui-conversation",
    # Owns the `ctx.slots` Context augmentation consumed by the browser cards.
    "@deepseek-ai/dsh-client-ui-renderer",
    # Type declarations for node builtins used by the Node-side clients.
    "@types/node",
    # Optional per-request proxy support in @amadeus/voice-clone; the plugin
    # degrades to a direct fetch when it is absent.
    "undici",
]


def candidate_hosts() -> list[str]:
    out: list[str] = []
    npm_prefix = os.environ.get("APPDATA")
    if npm_prefix:
        out.append(os.path.join(npm_prefix, "npm", "node_modules"))
    out.append(os.path.join(os.path.dirname(sys.executable), "node_modules"))
    out.append(os.path.join(os.path.expanduser("~"), "AppData", "Roaming", "npm", "node_modules"))
    return out


def find_host(explicit: str | None) -> str:
    roots = [explicit] if explicit else candidate_hosts()
    for root in roots:
        if not root:
            continue
        for base in (root, os.path.join(root, "@deepseek-ai", "dsh", "node_modules")):
            probe = os.path.join(base, "@deepseek-ai", "cordis", "package.json")
            if os.path.isfile(probe):
                return base
    raise SystemExit(
        "could not locate the dsh host node_modules; pass --host <dir> "
        "(the directory containing @deepseek-ai/cordis)"
    )


def already_linked(dst: str, src: str) -> bool:
    """True when `dst` already resolves to `src` (a junction or a symlink)."""
    if not os.path.lexists(dst):
        return False
    try:
        return os.path.normcase(os.path.realpath(dst)) == os.path.normcase(os.path.realpath(src))
    except OSError:
        return False


def link(src: str, dst: str) -> None:
    if already_linked(dst, src):
        return
    if os.path.lexists(dst):
        # Never recurse into the target: a junction is removed with rmdir/unlink
        # only, so a mistaken path can never delete host package contents.
        if os.path.isdir(dst) and not os.path.islink(dst):
            try:
                os.rmdir(dst)
            except OSError:
                raise SystemExit(
                    f"refusing to remove non-empty real directory {dst}; "
                    "delete it manually if it is a stale copy"
                )
        else:
            os.remove(dst)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    if os.name == "nt":
        subprocess.run(["cmd", "/c", "mklink", "/J", dst, src],
                       check=True, capture_output=True)
    else:
        os.symlink(src, dst, target_is_directory=True)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--host", default=None, help="dsh node_modules that contains @deepseek-ai/*")
    args = ap.parse_args()

    host = find_host(args.host)
    print(f"[link_deps] host: {host}")

    plugins_dir = os.path.join(ROOT, "plugins")
    if not os.path.isdir(plugins_dir):
        raise SystemExit("plugins/ not found; run scripts/scaffold_all.py first")

    missing: list[str] = []
    for pid in sorted(os.listdir(plugins_dir)):
        pkg_file = os.path.join(plugins_dir, pid, "package.json")
        if not os.path.isfile(pkg_file):
            continue
        nm = os.path.join(plugins_dir, pid, "node_modules")
        os.makedirs(nm, exist_ok=True)
        for dep in LINKED:
            src = os.path.join(host, *dep.split("/"))
            if not os.path.isdir(src):
                missing.append(dep)
                continue
            link(src, os.path.join(nm, *dep.split("/")))

    # The client packages are optional (only client-facing plugins reference them).
    for dep in sorted(set(missing)):
        print(f"[link_deps] skip (not installed in host): {dep}")
    print(f"[link_deps] linked into {plugins_dir}")


if __name__ == "__main__":
    main()
