#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Generate the dsh plugin skeleton files shared by every Amadeus plugin.

The public dsh-plugin-developer skill expects `assets/plugin-skeleton/`, which is
not shipped with this installation; this script reconstructs the same structure
against the API surface of the locally installed dsh (0.1.5-rc.1).

Usage:
    python scripts/scaffold_all.py            # scaffold every plugin in PLUGINS
    python scripts/scaffold_all.py amadeus-tts  # scaffold just one
"""
from __future__ import annotations

import json
import os
import sys
import textwrap

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Plugin id -> (package name, one-line description). Order is also build order.
PLUGINS: dict[str, tuple[str, str]] = {
    "amadeus-persona": (
        "@amadeus/persona",
        "Amadeus persona: Kurisu system prompt section and voice-conversation style skill.",
    ),
    "amadeus-stt": (
        "@amadeus/stt",
        "Amadeus speech-to-text: transcribe recorded audio with a Whisper-compatible endpoint.",
    ),
    "amadeus-tts": (
        "@amadeus/tts",
        "Amadeus text-to-speech: segment text, synthesize CosyVoice2 audio, render a player card.",
    ),
    "amadeus-emotion": (
        "@amadeus/emotion",
        "Amadeus emotion: classify reply text into a Live2D motion and render the expression card.",
    ),
    "amadeus-memory": (
        "@amadeus/memory",
        "Amadeus memory: search and store long-term memories through a mem0-compatible client.",
    ),
    "amadeus-voice-clone": (
        "@amadeus/voice-clone",
        "Amadeus voice clone: upload a reference recording and register a custom SiliconFlow voice.",
    ),
    "amadeus-proactive": (
        "@amadeus/proactive",
        "Amadeus proactive: plan the assistant's next self-initiated conversational move.",
    ),
    "amadeus-live2d": (
        "@amadeus/live2d",
        "Amadeus live2d: render a persistent stage that reacts to emotion tool results.",
    ),
}

# Host packages every Amadeus plugin may import at runtime. They are linked as
# junctions from the installed dsh release, never bundled.
HOST_PEERS = {
    "@deepseek-ai/cordis": "^4.0.0",
    "@deepseek-ai/schemastery": "^3.18.0",
}

TOOL_HOST_PEERS = {
    "@deepseek-ai/dsh-tools": "*",
    "@deepseek-ai/dsh-llm": "*",
    "@deepseek-ai/dsh-util-values": "*",
}

CLIENT_HOST_PEERS = {
    "@deepseek-ai/dsh-client-ui-tool": "*",
    "@deepseek-ai/dsh-client-ui-chat": "*",
    "@deepseek-ai/dsh-client-ui-conversation": "*",
    "@deepseek-ai/dsh-client-ui-renderer": "*",
}


def package_json(pid: str, name: str, desc: str, *, has_client: bool, needs_tools: bool,
                 contributes: dict | None = None) -> dict:
    peers = dict(HOST_PEERS)
    if needs_tools:
        peers.update(TOOL_HOST_PEERS)
    if has_client:
        peers.update(CLIENT_HOST_PEERS)

    pkg: dict = {
        "$schema": "https://json.schemastore.org/package.json",
        "name": name,
        "version": "0.1.0",
        "description": desc,
        "type": "module",
        "private": True,
        "license": "MIT",
        "main": "lib/index.js",
        "exports": {
            ".": {
                "types": "./lib/index.d.ts",
                "default": "./lib/index.js",
            },
            "./package.json": "./package.json",
        },
        "files": ["lib", "cordis.patch.yml", "README.md"],
        "engines": {"node": "^22.19.0 || >=24.0.0"},
        "scripts": {
            "build": "tsdown",
            "typecheck": "tsc -p tsconfig.json --noEmit",
            "test": "node --test test/*.test.mjs",
        },
        "dsh": {
            "bundle": {"patch": "./cordis.patch.yml"},
        },
        "peerDependencies": peers,
        "devDependencies": {
            "tsdown": "^0.23.2",
            "typescript": "^5.7.3",
        },
    }

    if has_client:
        # Type-checking only. The host install ships the client packages but not
        # their `@types/react` or `dsh-client-ui-slots` dependency, so the
        # browser bundles cannot be typechecked without them. They are never
        # bundled (tsdown marks them external).
        pkg["devDependencies"]["@types/react"] = "~18.3.1"
        pkg["devDependencies"]["@types/react-dom"] = "~18.3.1"
        pkg["devDependencies"]["@deepseek-ai/dsh-client-ui-slots"] = "^0.1.5-rc.2"

    if has_client:
        pkg["dsh"]["client"] = {
            "inject": [
                "@deepseek-ai/dsh-client-ui-tool",
                "@deepseek-ai/dsh-client-ui-chat",
                "@deepseek-ai/dsh-client-ui-conversation",
            ],
            "platform": "web",
        }

    if contributes:
        pkg["dshx"] = {"contributes": contributes}

    return pkg


def cordis_patch(pid: str, name: str, *, mount_name: str | None = None,
                 config: dict | None = None) -> str:
    lines = [
        "# dsh bundle patch: inserts this plugin into a profile's layer stack.",
        "- insert:",
        f"    - id: {pid}",
        f"      name: '{mount_name or name}'",
    ]
    if config:
        lines.append("      config:")
        for key, value in config.items():
            lines.append(f"        {key}: {json.dumps(value)}")
    return "\n".join(lines) + "\n"


TSDOWN = """import { defineConfig } from 'tsdown'

const id = '%(pid)s'

export default [
  {
    entry: %(entries)s,
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    dts: true,
    clean: true,
    outputOptions: {
      entryFileNames: '[name].js',
      chunkFileNames: 'chunks/[name].js',
    },
    deps: {
      neverBundle: [
        '@deepseek-ai/cordis',
        '@deepseek-ai/schemastery',
        '@deepseek-ai/dsh-tools',
        '@deepseek-ai/dsh-llm',
        '@deepseek-ai/dsh-util-values',
        '@deepseek-ai/dsh-skill',
        '@deepseek-ai/dsh-scope',
        '@deepseek-ai/dsh-system-prompt',
        // Optional at runtime: imported lazily only when a proxy is configured,
        // and the plugin degrades to a direct fetch when it cannot be resolved.
        // Bundling it would add ~1 MB to every install for an opt-in feature.
        'undici',
      ],
    },
  },
%(client)s]
"""

TSDOWN_CLIENT = """  {
    entry: { client: 'src/client/index.tsx' },
    outDir: 'lib',
    format: ['cjs'],
    platform: 'browser',
    target: 'es2022',
    dts: false,
    external: /^(@deepseek-ai\\/dsh-client-|react$|react\\/jsx-runtime$)/,
    outputOptions: {
      entryFileNames: 'client.js',
      inlineDynamicImports: true,
      banner: `window.__ModuleLoader__.load({ id: "${id}", factory: (require) => {`,
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
"""

TSCONFIG = """{
  "compilerOptions": {
    "target": "ES2024",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2024", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": false,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/client/**/*", "lib", "node_modules"]
}
"""

TSCONFIG_CLIENT = """{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": []
  },
  "include": ["src/client/**/*.ts", "src/client/**/*.tsx"],
  "exclude": ["lib", "node_modules"]
}
"""


def node_entries(base: str) -> str:
    """Entry map for the Node bundle, including only modules the plugin actually has."""
    mapping = [("index", "src/index.ts")]
    for extra in ("fragment", "api", "tool", "skill"):
        if os.path.isfile(os.path.join(base, "src", f"{extra}.ts")):
            mapping.append((extra, f"src/{extra}.ts"))
    body = ", ".join(f"{key}: '{path}'" for key, path in mapping)
    return f"{{ {body} }}"


def write(path: str, content: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(content)


def scaffold(pid: str, *, has_client: bool, needs_tools: bool,
             contributes: dict | None = None, patch_config: dict | None = None,
             mount_name: str | None = None) -> None:
    name, desc = PLUGINS[pid]
    base = os.path.join(ROOT, "plugins", pid)

    write(
        os.path.join(base, "package.json"),
        json.dumps(package_json(pid, name, desc, has_client=has_client,
                                needs_tools=needs_tools, contributes=contributes),
                   indent=2, ensure_ascii=False) + "\n",
    )
    write(os.path.join(base, "cordis.patch.yml"),
          cordis_patch(pid, name, mount_name=mount_name, config=patch_config))
    write(os.path.join(base, "tsdown.config.ts"),
          TSDOWN % {"pid": pid,
                    "entries": node_entries(base),
                    "client": TSDOWN_CLIENT % {"id": pid} if has_client else ""})
    write(os.path.join(base, "tsconfig.json"), TSCONFIG)
    if has_client:
        write(os.path.join(base, "tsconfig.client.json"), TSCONFIG_CLIENT)
    print(f"[scaffold] {pid} -> {base}")


def main() -> None:
    targets = sys.argv[1:] or list(PLUGINS)
    configs = {
        "amadeus-persona": dict(has_client=False, needs_tools=False),
        "amadeus-stt": dict(has_client=False, needs_tools=True),
        "amadeus-tts": dict(has_client=True, needs_tools=True),
        "amadeus-emotion": dict(has_client=True, needs_tools=True),
        "amadeus-memory": dict(has_client=False, needs_tools=True),
        "amadeus-voice-clone": dict(has_client=False, needs_tools=True),
        "amadeus-proactive": dict(has_client=False, needs_tools=True),
        "amadeus-live2d": dict(has_client=True, needs_tools=True),
    }
    for pid in targets:
        if pid not in PLUGINS:
            raise SystemExit(f"unknown plugin id: {pid}")
        scaffold(pid, **configs[pid])


if __name__ == "__main__":
    main()
