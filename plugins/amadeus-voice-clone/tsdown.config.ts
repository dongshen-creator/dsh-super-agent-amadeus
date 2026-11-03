import { defineConfig } from 'tsdown'

const id = 'amadeus-voice-clone'

export default [
  {
    entry: { index: 'src/index.ts', fragment: 'src/fragment.ts', api: 'src/api.ts', tool: 'src/tool.ts' },
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
]
