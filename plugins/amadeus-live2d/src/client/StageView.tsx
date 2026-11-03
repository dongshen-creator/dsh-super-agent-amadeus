/**
 * Avatar stage card for `amadeus_stage` results.
 *
 * The harness sandbox forbids remote scripts, so the real Live2D runtime and the
 * hosted `*.model3.json` cannot be loaded here. The card therefore draws a
 * self-contained stage and renders the exact idle parameters the Node side
 * computed, so the animation contract is visible and replayable. The model URL
 * is shown (and linkable) so the user can open the real model elsewhere.
 */
import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client'

import { stageMetaFrom, type StageMeta } from '../fragment.js'

const cardStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
  padding: '14px 16px',
  border: '1px solid rgba(127, 127, 127, 0.26)',
  borderRadius: '12px',
  background:
    'radial-gradient(circle at 50% 12%, rgba(147, 197, 253, 0.18), rgba(15, 23, 42, 0.04) 62%)',
  fontFamily: 'inherit',
} as const

const rowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: '12px',
  flexWrap: 'wrap',
} as const

const chipStyle = {
  padding: '2px 8px',
  borderRadius: '999px',
  background: 'rgba(96, 165, 250, 0.18)',
  fontSize: '11px',
  whiteSpace: 'nowrap',
} as const

function value(meta: StageMeta, name: string): number {
  const hit = meta.parameters.find((parameter) => parameter.name === name)
  return hit === undefined ? 0 : hit.value
}

/** 0..1 eyelid openness; the idle state blinks down to 0 every few seconds. */
function eyelid(meta: StageMeta, side: 'L' | 'R'): number {
  return Math.max(0, Math.min(1, value(meta, side === 'L' ? 'ParamEyeLOpen' : 'ParamEyeROpen')))
}

const EXPRESSION_TINT: Record<string, string> = {
  anger: '#f87171',
  joy: '#fbbf24',
  sadness: '#60a5fa',
  shy: '#f9a8d4',
  shy2: '#f472b6',
  smile1: '#34d399',
  smile2: '#4ade80',
  unhappy: '#a78bfa',
}

function StageFace({ meta }: { meta: StageMeta }) {
  // Head angles are degrees in [-12, 12]; map to a subtle transform.
  const angleX = value(meta, 'ParamAngleX')
  const angleY = value(meta, 'ParamAngleY')
  const angleZ = value(meta, 'ParamAngleZ')
  const eyeX = value(meta, 'ParamEyeBallX')
  const eyeY = value(meta, 'ParamEyeBallY')
  const lidL = eyelid(meta, 'L')
  const lidR = eyelid(meta, 'R')
  const tint = EXPRESSION_TINT[meta.expression] ?? '#93c5fd'

  const transform = [
    `rotate(${(angleZ * 0.5).toFixed(2)}deg)`,
    `translate(${(angleX * 0.6).toFixed(2)}px, ${(angleY * 0.45).toFixed(2)}px)`,
  ].join(' ')

  const pupilX = eyeX * 5
  const pupilY = eyeY * 5

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '150px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        borderRadius: '10px',
        background:
          'linear-gradient(180deg, rgba(15,23,42,0.24), rgba(15,23,42,0.06) 55%, rgba(15,23,42,0.16))',
      }}
    >
      <div style={{ transform, transition: 'transform 90ms linear' }}>
        <svg width="150" height="130" viewBox="0 0 150 130" aria-label={`${meta.role} 待机姿态`}>
          {/* hair / head silhouette */}
          <ellipse cx="75" cy="62" rx="40" ry="46" fill={tint} opacity="0.28" />
          <ellipse cx="75" cy="62" rx="34" ry="40" fill="#fde7ef" opacity="0.9" />
          {/* eyes */}
          <ellipse cx="62" cy="60" rx="9" ry={9 * Math.max(0.06, lidL)} fill="#1f2937" />
          <ellipse cx="88" cy="60" rx="9" ry={9 * Math.max(0.06, lidR)} fill="#1f2937" />
          {/* pupils follow ParamEyeBall */}
          <circle cx={62 + pupilX} cy={60 + pupilY} r="3.4" fill="#60a5fa" />
          <circle cx={88 + pupilX} cy={60 + pupilY} r="3.4" fill="#60a5fa" />
          {/* mouth changes with expression */}
          <path
            d={meta.expression === 'sadness' || meta.expression === 'unhappy'
              ? 'M 66 84 Q 75 78 84 84'
              : 'M 66 82 Q 75 89 84 82'}
            stroke="#be123c"
            strokeWidth="2.4"
            fill="none"
            strokeLinecap="round"
          />
          {/* blush for shy / joy */}
          {meta.expression === 'shy' || meta.expression === 'shy2' || meta.expression === 'joy' ? (
            <>
              <ellipse cx="52" cy="72" rx="7" ry="4" fill="#fb7185" opacity="0.35" />
              <ellipse cx="98" cy="72" rx="7" ry="4" fill="#fb7185" opacity="0.35" />
            </>
          ) : null}
        </svg>
      </div>
    </div>
  )
}

function ParameterList({ meta }: { meta: StageMeta }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
        gap: '4px 10px',
        fontSize: '11px',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        opacity: 0.72,
      }}
    >
      {meta.parameters.map((parameter) => (
        <span key={parameter.name} title={parameter.name}>
          {parameter.name.replace(/^Param/, '')} {parameter.value.toFixed(2)}
        </span>
      ))}
    </div>
  )
}

export function StageView({ callId, block }: ToolCallViewProps) {
  if (!('kind' in block)) {
    return (
      <div style={cardStyle} data-amadeus-live2d="pending">
        <div style={rowStyle}>
          <span style={chipStyle}>舞台</span>
          <span style={{ opacity: 0.7 }}>正在摆放虚拟形象…</span>
        </div>
      </div>
    )
  }

  if (block.isError) {
    return (
      <div style={cardStyle} data-amadeus-live2d="error">
        <div style={rowStyle}>
          <span style={chipStyle}>舞台</span>
          <span>虚拟形象摆放失败。</span>
        </div>
      </div>
    )
  }

  const meta = stageMetaFrom(block.meta)
  if (meta === undefined) {
    return (
      <div style={cardStyle} data-amadeus-live2d="fallback">
        <div style={rowStyle}>
          <span style={chipStyle}>舞台</span>
          <span style={{ opacity: 0.7 }}>虚拟形象已更新（此视图缺少结构化数据）。</span>
        </div>
      </div>
    )
  }

  return (
    <div style={cardStyle} data-amadeus-live2d="ready" data-call-id={callId}>
      <div style={rowStyle}>
        <span style={chipStyle}>{meta.role}</span>
        <span>{meta.expression === '' ? '表情复位' : meta.expression}</span>
        <span style={{ opacity: 0.6 }}>{meta.motion === '' ? '待机' : meta.motion}</span>
        <span style={{ marginLeft: 'auto', opacity: 0.55 }}>
          {meta.mobile ? '移动端' : '桌面端'} · scale {meta.scale}
        </span>
      </div>

      <StageFace meta={meta} />

      <ParameterList meta={meta} />

      <div style={rowStyle}>
        <span style={{ opacity: 0.55 }}>x {meta.x.toFixed(0)} · y {meta.y}</span>
        <a
          href={meta.modelPath}
          target="_blank"
          rel="noreferrer"
          style={{ marginLeft: 'auto', opacity: 0.6, color: 'inherit', fontSize: '11px' }}
          title={meta.modelPath}
        >
          打开模型文件
        </a>
      </div>

      <div style={{ fontSize: '11px', opacity: 0.45, lineHeight: 1.5 }}>
        沙箱禁止加载外部 Live2D 运行时，此处按 Node 端算出的参数绘制等价站位与待机姿态。
      </div>
    </div>
  )
}
