import { defineConfig } from 'tsdown'

// One browser bundle for the whole fused package. Host client packages and
// react stay external (resolved by the harness ModuleLoader at runtime).
export default {
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
    banner: 'window.__ModuleLoader__.load({ id: "dsh-super-agent-amadeus", factory: (require) => {',
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
}
