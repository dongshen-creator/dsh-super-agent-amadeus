/**
 * Types for the generated vendored Super-agent client factory
 * (scripts/gen-super-agent-client.mjs strips the ModuleLoader wrapper from
 * super-agent/lib/client.js and lifts the factory body into an export).
 */
export interface SuperAgentClientModule {
  apply: (ctx: unknown) => void
  inject: string[]
  NS: string
  PANEL_ID: string
}

export const superAgentClientFactory: (require: (id: string) => unknown) => SuperAgentClientModule
