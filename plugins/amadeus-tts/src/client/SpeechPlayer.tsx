/**
 * Audio player card for `amadeus_speak` results.
 *
 * Reads only the persisted meta (segments + data URI), never re-runs Node work,
 * so replay renders the same card.
 */
import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client'

import { speechMetaFrom } from '../fragment.js'

const cardStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
  padding: '14px 16px',
  border: '1px solid rgba(127, 127, 127, 0.28)',
  borderRadius: '12px',
  background: 'linear-gradient(180deg, rgba(96, 165, 250, 0.08), rgba(96, 165, 250, 0.02))',
  fontFamily: 'inherit',
} as const

const rowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  fontSize: '12px',
  opacity: 0.75,
} as const

const chipStyle = {
  padding: '2px 8px',
  borderRadius: '999px',
  background: 'rgba(96, 165, 250, 0.16)',
  color: 'inherit',
  fontSize: '11px',
  whiteSpace: 'nowrap',
} as const

const segmentListStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  margin: 0,
  padding: 0,
  listStyle: 'none',
  maxHeight: '180px',
  overflowY: 'auto',
} as const

const segmentStyle = {
  display: 'flex',
  gap: '8px',
  fontSize: '13px',
  lineHeight: 1.5,
} as const

export function SpeechPlayerView({ callId, block }: ToolCallViewProps) {
  // Pending calls carry no `kind`; show the progress state instead of a blank card.
  if (!('kind' in block)) {
    return (
      <div style={cardStyle} data-amadeus-tts="pending">
        <div style={rowStyle}>
          <span style={chipStyle}>语音合成中</span>
          <span>正在按标点分段并生成音频…</span>
        </div>
      </div>
    )
  }

  if (block.isError) {
    return (
      <div style={cardStyle} data-amadeus-tts="error">
        <div style={rowStyle}>
          <span style={chipStyle}>语音合成失败</span>
          <span>未生成音频，请检查语音服务配置。</span>
        </div>
      </div>
    )
  }

  const meta = speechMetaFrom(block.meta)
  if (meta === undefined) {
    return (
      <div style={cardStyle} data-amadeus-tts="fallback">
        <div style={rowStyle}>
          <span style={chipStyle}>语音</span>
          <span>已生成音频（此视图缺少结构化数据）。</span>
        </div>
      </div>
    )
  }

  const seconds = meta.durationSeconds ? meta.durationSeconds.toFixed(1) : undefined

  return (
    <div style={cardStyle} data-amadeus-tts="ready" data-call-id={callId}>
      <div style={rowStyle}>
        <span style={chipStyle}>{meta.segments.length} 段</span>
        {seconds !== undefined ? <span>{seconds}s</span> : null}
        {meta.voice ? <span title={meta.voice}>🎙 {meta.voice.slice(-12)}</span> : null}
        <span style={{ marginLeft: 'auto' }}>{Math.max(1, Math.round(meta.byteLength / 1024))} KB</span>
      </div>

      <audio
        controls
        preload="metadata"
        src={meta.audio}
        style={{ width: '100%', height: '36px' }}
      />

      <ol style={segmentListStyle}>
        {meta.segments.map((segment) => (
          <li key={segment.id} style={segmentStyle}>
            <span style={{ ...chipStyle, minWidth: '22px', textAlign: 'center' }}>{segment.index}</span>
            <span>{segment.text}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
