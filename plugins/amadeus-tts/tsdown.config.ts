import { defineConfig } from 'tsdown'

const id = 'amadeus-tts'

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
  {
    entry: { client: 'src/client/index.tsx' },
    outDir: 'lib',
    format: ['cjs'],
    platform: 'browser',
    target: 'es2022',
    dts: false,
    external: /^(@deepseek-ai\/dsh-client-|react$|react\/jsx-runtime$)/,
    outputOptions: {
      entryFileNames: 'client.js',
      inlineDynamicImports: true,
      banner: `window.__ModuleLoader__.load({ id: "${id}", factory: (require) => {`,
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
]
