#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Junction-link the host `@deepseek-ai/*` packages into THIS repo's node_modules.

Same safe-link rules as scripts/link_deps.py (junctions never recursed into),
but targeting the fused repo root so the composite client typecheck resolves
the plugin sources' `@deepseek-ai/*` type imports.
"""
from __future__ import annotations

import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

LINKED = [
    "@deepseek-ai/cordis",
    "@deepseek-ai/schemastery",
    "@deepseek-ai/dsh-tools",
    "@deepseek-ai/dsh-llm",
    "@deepseek-ai/dsh-util-values",
    "@deepseek-ai/dsh-skill",
    "@deepseek-ai/dsh-system-prompt",
    "@deepseek-ai/dsh-client-ui-tool",
    "@deepseek-ai/dsh-client-ui-renderer",
]


def candidate_hosts() -> list[str]:
    out: list[str] = []
    npm_prefix = os.environ.get("APPDATA")
    if npm_prefix:
        out.append(os.path.join(npm_prefix, "npm", "node_modules"))
    out.append(os.path.join(os.path.dirname(sys.executable), "node_modules"))
    out.append(os.path.join(os.path.expanduser("~"), "AppData", "Roaming", "npm", "node_modules"))
    return out


def find_host() -> str:
    for root in candidate_hosts():
        if not root:
            continue
        for base in (root, os.path.join(root, "@deepseek-ai", "dsh", "node_modules")):
            probe = os.path.join(base, "@deepseek-ai", "cordis", "package.json")
            if os.path.isfile(probe):
                return base
    raise SystemExit("could not locate the dsh host node_modules")


def already_linked(dst: str, src: str) -> bool:
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
                raise SystemExit(f"refusing to remove non-empty real directory {dst}")
        else:
            os.remove(dst)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    if os.name == "nt":
        subprocess.run(["cmd", "/c", "mklink", "/J", dst, src], check=True, capture_output=True)
    else:
        os.symlink(src, dst, target_is_directory=True)


def main() -> None:
    host = find_host()
    nm = os.path.join(ROOT, "node_modules")
    os.makedirs(nm, exist_ok=True)
    for dep in LINKED:
        src = os.path.join(host, *dep.split("/"))
        if not os.path.isdir(src):
            print(f"[link_root] skip (not installed in host): {dep}")
            continue
        link(src, os.path.join(nm, *dep.split("/")))
    print(f"[link_root] linked into {nm}")


if __name__ == "__main__":
    main()
