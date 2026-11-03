/**
 * Emotion badge card for `amadeus_emotion` results.
 */
import type { ReactNode } from 'react'
import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client'

import { emotionMetaFrom } from '../fragment.js'

const base = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '10px 14px',
  borderRadius: '10px',
  fontFamily: 'inherit',
  fontSize: '13px',
} as const

function Shell({ tone, children }: { tone: string; children: ReactNode }) {
  return (
    <div style={{ ...base, background: tone, border: '1px solid rgba(127,127,127,0.22)' }}>
      {children}
    </div>
  )
}

export function EmotionBadgeView({ block }: ToolCallViewProps) {
  if (!('kind' in block)) {
    return (
      <Shell tone="rgba(148,163,184,0.12)">
        <span style={{ opacity: 0.7 }}>正在判断表情…</span>
      </Shell>
    )
  }

  if (block.isError) {
    return (
      <Shell tone="rgba(248,113,113,0.16)">
        <span>表情分类失败</span>
      </Shell>
    )
  }

  const meta = emotionMetaFrom(block.meta)
  if (meta === undefined) {
    return (
      <Shell tone="rgba(148,163,184,0.12)">
        <span style={{ opacity: 0.7 }}>表情已更新</span>
      </Shell>
    )
  }

  return (
    <Shell tone={meta.color}>
      <span
        style={{
          fontFamily: 'monospace',
          fontSize: '12px',
          padding: '2px 8px',
          borderRadius: '999px',
          background: 'rgba(255,255,255,0.14)',
        }}
      >
        {meta.emotion}
      </span>
      <strong style={{ fontWeight: 600 }}>{meta.label}</strong>
      {!meta.confident ? <span style={{ opacity: 0.65 }}>（回退）</span> : null}
      {meta.text ? (
        <span
          style={{
            marginLeft: 'auto',
            opacity: 0.62,
            maxWidth: '55%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={meta.text}
        >
          {meta.text}
        </span>
      ) : null}
    </Shell>
  )
}
