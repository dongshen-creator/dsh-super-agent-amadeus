import assert from 'node:assert/strict'
import test from 'node:test'

import {
  DEFAULT_ROLE,
  EXPRESSIONS,
  IDLE_LIMITS,
  LIVE2D_MODELS,
  RANDOM_MOTIONS,
  REFERENCE_VIEWPORT,
  buildParameterValues,
  computeStageLayout,
  createIdleState,
  isExpression,
  lerp,
  resolveExpression,
  resolveMotion,
  stageMetaFrom,
  stepIdle,
} from '../lib/fragment.js'

const kurisu = LIVE2D_MODELS[DEFAULT_ROLE]

test('the model table keeps the original Kurisu placement values', () => {
  assert.ok(kurisu)
  assert.equal(
    kurisu.path,
    'https://static.amadeus-web.top/live2dmodels/steinsGateKurisuNew/红莉栖.model3.json',
  )
  assert.equal(kurisu.scale1, 0.42)
  assert.equal(kurisu.scale2, 0.42)
  assert.equal(kurisu.x1, 550)
  assert.equal(kurisu.x2, -100)
  assert.equal(kurisu.y1, 50)
  assert.equal(kurisu.y2, 20)
})

test('desktop placement matches x1 + (innerWidth - 1620) / 2', () => {
  const layout = computeStageLayout('牧濑红莉栖', 1620, false)
  assert.equal(layout.scale, 0.42)
  assert.equal(layout.x, 550)
  assert.equal(layout.y, 50)
  assert.equal(layout.mobile, false)
  assert.equal(layout.viewportWidth, 1620)

  const wide = computeStageLayout('牧濑红莉栖', 1920, false)
  assert.equal(wide.x, 550 + (1920 - 1620) / 2)
})

test('mobile placement uses the 2-variant fields and the 380 reference width', () => {
  const layout = computeStageLayout('牧濑红莉栖', 380, true)
  assert.equal(layout.scale, 0.42)
  assert.equal(layout.x, -100)
  assert.equal(layout.y, 20)
  assert.equal(layout.mobile, true)

  const narrow = computeStageLayout('牧濑红莉栖', 200, true)
  assert.equal(narrow.x, -100 + (200 - 380) / 2)
})

test('unknown roles fall back to the default model and bad widths to 1620', () => {
  for (const role of ['未知角色', '', undefined]) {
    const layout = computeStageLayout(role, 1620, false)
    assert.equal(layout.role, DEFAULT_ROLE)
    assert.equal(layout.modelPath, kurisu.path)
  }
  assert.equal(computeStageLayout(DEFAULT_ROLE, 0, false).viewportWidth, REFERENCE_VIEWPORT.desktop)
  assert.equal(computeStageLayout(DEFAULT_ROLE, Number.NaN, false).viewportWidth, 1620)
  assert.equal(computeStageLayout(DEFAULT_ROLE, -20, false).viewportWidth, 1620)
})

test('a saved-config override replaces only the fields it names', () => {
  const layout = computeStageLayout(DEFAULT_ROLE, 1620, false, { scale1: 0.5, y1: 80 })
  assert.equal(layout.scale, 0.5)
  assert.equal(layout.y, 80)
  assert.equal(layout.x, 550)
  assert.equal(layout.modelPath, kurisu.path)
})

test('the expression vocabulary is the nine motions from emotion.py', () => {
  assert.deepEqual([...EXPRESSIONS], [
    'neutral',
    'anger',
    'joy',
    'sadness',
    'shy',
    'shy2',
    'smile1',
    'smile2',
    'unhappy',
  ])
  for (const expression of EXPRESSIONS) assert.equal(isExpression(expression), true)
  assert.equal(isExpression('happy'), false)
})

test('neutral and anything containing random reset the expression', () => {
  assert.equal(resolveExpression('neutral'), '')
  assert.equal(resolveExpression('random3'), '')
  assert.equal(resolveExpression('joy'), 'joy')
  assert.equal(resolveExpression('unhappy'), 'unhappy')
  assert.equal(resolveExpression(''), '')
  assert.equal(resolveExpression(undefined), '')
  assert.equal(resolveExpression('not-an-expression'), '')
})

test('speaking and thinking pick a random idle motion', () => {
  assert.deepEqual([...RANDOM_MOTIONS], ['random1', 'random2', 'random3', 'random4', 'random5'])
  assert.equal(resolveMotion('speaking', () => 0), 'random1')
  assert.equal(resolveMotion('speaking', () => 0.999), 'random5')
  assert.equal(resolveMotion('thinking', () => 0.5), 'random3')
  assert.equal(resolveMotion('smile1'), 'smile1')
  assert.equal(resolveMotion(''), '')
  assert.equal(resolveMotion(undefined), '')
})

test('idle state starts exactly like the Animation_Control constructor', () => {
  const state = createIdleState()
  assert.equal(state.headMove, 0)
  assert.deepEqual([...state.head], [0, 0, 0])
  assert.deepEqual([...state.targetHead], [0, 0, 0])
  assert.equal(state.eyeMove, 0)
  assert.deepEqual([...state.eyes], [0, 0])
  assert.deepEqual([...state.targetEyes], [-20, 20])
  assert.equal(state.blinkTime, 0)
  assert.deepEqual([...state.eyeLids], [1, 1])
  assert.equal(state.blinkState, 'Open')
})

test('lerp matches a + (b - a) * t', () => {
  assert.equal(lerp(0, 10, 0.1), 1)
  assert.equal(lerp(5, 5, 0.9), 5)
})

test('the first tick always retargets head and eyes', () => {
  const state = stepIdle(createIdleState(), 1000, () => 0)
  // random() = 0 gives headMin (-12) and eyesMin (-0.5) as targets.
  assert.equal(state.headMove, 1000 + IDLE_LIMITS.headSpeed[0])
  assert.deepEqual([...state.targetHead], [-12, -12, -12])
  assert.equal(state.eyeMove, 1000 + IDLE_LIMITS.eyesSpeed[0])
  assert.deepEqual([...state.targetEyes], [-0.5, -0.5])
  // One lerp step at 0.1 from 0 toward -12 / -0.5.
  assert.ok(Math.abs(state.head[0] - -1.2) < 1e-9)
  assert.ok(Math.abs(state.eyes[0] - -0.05) < 1e-9)
})

test('targets hold steady until the scheduled retarget time', () => {
  const first = stepIdle(createIdleState(), 1000, () => 0)
  const second = stepIdle(first, 1500, () => 1)
  assert.deepEqual([...second.targetHead], [...first.targetHead])
  assert.equal(second.headMove, first.headMove)
  // Converging toward -12: 0 -> -1.2 -> -2.28
  assert.ok(Math.abs(second.head[0] - -2.28) < 1e-9)
})

test('random() = 1 clamps to headMax / eyesMax', () => {
  const state = stepIdle(createIdleState(), 10, () => 1)
  assert.deepEqual([...state.targetHead], [12, 12, 12])
  assert.deepEqual([...state.targetEyes], [0.5, 0.5])
})

test('the blink cycle closes the lids then reopens them', () => {
  // t=0: still Open and blinkTime is 0, so the guard `currentTime > blinkTime`
  // is false and nothing happens — same first-tick no-op as the original.
  const idleAtZero = stepIdle(createIdleState(), 0, () => 0)
  assert.equal(idleAtZero.blinkState, 'Open')
  assert.equal(idleAtZero.blinkTime, 0)
  assert.deepEqual([...idleAtZero.eyeLids], [1, 1])

  // First tick past the deadline closes the lids for `blinkLength` ms.
  const closing = stepIdle(idleAtZero, 1, () => 0)
  assert.equal(closing.blinkState, 'Blink')
  assert.equal(closing.blinkTime, 1 + IDLE_LIMITS.blinkLength)
  assert.deepEqual([...closing.eyeLids], [0, 0])

  // While the blink is still running the lids stay shut.
  const stillClosed = stepIdle(closing, 50, () => 0)
  assert.equal(stillClosed.blinkState, 'Blink')
  assert.deepEqual([...stillClosed.eyeLids], [0, 0])

  // After the blink window the lids open again and the next blink is scheduled.
  const reopened = stepIdle(stillClosed, 200, () => 0)
  assert.equal(reopened.blinkState, 'Open')
  assert.deepEqual([...reopened.eyeLids], [1, 1])
  assert.equal(reopened.blinkTime, 200 + IDLE_LIMITS.blinkSpeed[0])
})

test('parameter values map head and eyes to the Cubism parameter names', () => {
  const state = stepIdle(createIdleState(), 1000, () => 0)
  const parameters = buildParameterValues(state)
  const names = parameters.map((parameter) => parameter.name)
  assert.deepEqual(names, [
    'ParamAngleX',
    'ParamAngleY',
    'ParamAngleZ',
    'ParamBodyAngleX',
    'ParamBodyAngleY',
    'ParamBodyAngleZ',
    'ParamEyeBallX',
    'ParamEyeBallY',
    'ParamEyeLOpen',
    'ParamEyeROpen',
  ])

  const byName = new Map(parameters.map((parameter) => [parameter.name, parameter.value]))
  assert.equal(byName.get('ParamAngleX'), state.head[0])
  // Body angle is the head angle divided by ten in the original.
  assert.equal(byName.get('ParamBodyAngleX'), state.head[0] / 10)
  assert.equal(byName.get('ParamEyeBallX'), state.eyes[0])
  // This tick crossed the blink deadline, so the lids are closed.
  assert.equal(byName.get('ParamEyeLOpen'), state.eyeLids[0])
  assert.equal(byName.get('ParamEyeROpen'), state.eyeLids[1])
  assert.deepEqual([...state.eyeLids], [0, 0])

  // Before the first blink the lids are wide open.
  const fresh = new Map(
    buildParameterValues(createIdleState()).map((parameter) => [parameter.name, parameter.value]),
  )
  assert.equal(fresh.get('ParamEyeLOpen'), 1)
  assert.equal(fresh.get('ParamEyeROpen'), 1)
})

test('meta narrowing requires the plugin tag and the numeric placement', () => {
  const meta = stageMetaFrom({
    kind: 'amadeus-live2d',
    role: '牧濑红莉栖',
    modelPath: kurisu.path,
    scale: 0.42,
    x: 550,
    y: 50,
    mobile: false,
    emotion: 'joy',
    motion: 'random2',
    expression: 'joy',
    parameters: [{ name: 'ParamAngleX', value: 1.5 }],
  })
  assert.ok(meta)
  assert.equal(meta.expression, 'joy')
  assert.equal(meta.parameters.length, 1)

  assert.equal(stageMetaFrom({ kind: 'amadeus-tts', role: 'x', modelPath: 'y', scale: 1, x: 0, y: 0 }), undefined)
  assert.equal(stageMetaFrom({ kind: 'amadeus-live2d', role: 'x' }), undefined)
  assert.equal(stageMetaFrom(null), undefined)
})

test('meta narrowing tolerates missing optional fields and junk parameters', () => {
  const meta = stageMetaFrom({
    kind: 'amadeus-live2d',
    role: '牧濑红莉栖',
    modelPath: kurisu.path,
    scale: 0.42,
    x: 0,
    y: 0,
    parameters: [{ name: 'ParamAngleX', value: 1 }, { name: 'bad' }, 'junk'],
  })
  assert.ok(meta)
  assert.equal(meta.emotion, '')
  assert.equal(meta.mobile, false)
  assert.equal(meta.parameters.length, 1)
})
