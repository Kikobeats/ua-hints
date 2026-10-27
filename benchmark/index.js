'use strict'

const { writeFileSync } = require('fs')
const { join } = require('path')

const uaHints = require('..')
const USER_AGENTS = require('./fixtures/user-agents.json')

const RUNS = 7
const LIST_PASSES = 50
const SINGLE_CALLS = 5000

const BLINK_USER_AGENTS = 77
const REQUIRED_HINTS = [
  'sec-ch-ua',
  'sec-ch-ua-mobile',
  'sec-ch-ua-wow64',
  'sec-ch-ua-form-factors'
]

const SINGLE_USER_AGENT = USER_AGENTS[0]
const SINGLE_EXPECTED_BRANDS =
  '"Google Chrome";v="155", "Chromium";v="155", "Not(A:Brand";v="24"'

const median = values => {
  const sorted = values.slice().sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

const now = () => process.hrtime.bigint()

const elapsed = started => Number(now() - started) / 1e6

const hasRequiredHints = hints =>
  REQUIRED_HINTS.every(key => typeof hints[key] === 'string')

const listPasses = () => {
  let blink = 0
  let malformed = 0
  for (let pass = 0; pass < LIST_PASSES; pass++) {
    for (const userAgent of USER_AGENTS) {
      const hints = uaHints(userAgent)
      if (Object.keys(hints).length === 0) continue
      blink++
      if (!hasRequiredHints(hints)) malformed++
    }
  }
  return blink === BLINK_USER_AGENTS * LIST_PASSES && malformed === 0
}

const singleRepeated = () => {
  let matches = 0
  for (let call = 0; call < SINGLE_CALLS; call++) {
    const hints = uaHints(SINGLE_USER_AGENT)
    if (
      hints['sec-ch-ua'] === SINGLE_EXPECTED_BRANDS &&
      hasRequiredHints(hints)
    ) { matches++ }
  }
  return matches === SINGLE_CALLS
}

const CASES = [
  {
    name: 'hints top 100 user agents',
    run: listPasses,
    extra: `${LIST_PASSES} passes x ${USER_AGENTS.length} user agents, ${BLINK_USER_AGENTS} blink per pass`
  },
  {
    name: 'hints single user agent repeated',
    run: singleRepeated,
    extra: `${SINGLE_CALLS} calls on one chrome user agent`
  }
]

const fmt = value => value.toFixed(1)

const report = (entry, slot) => {
  const med = slot.walls.length ? median(slot.walls) : Number.NaN
  const min = slot.walls.length ? Math.min(...slot.walls) : Number.NaN
  const max = slot.walls.length ? Math.max(...slot.walls) : Number.NaN
  const extra = `${entry.extra}, errors ${slot.errors}, runs ${RUNS}`
  console.log(
    `${entry.name}  median ${fmt(med)}ms  range ${fmt(min)}-${fmt(
      max
    )}  ${extra}`
  )
  return {
    name: entry.name,
    unit: 'ms',
    value: Number(med.toFixed(1)),
    range: `${fmt(min)}-${fmt(max)}`,
    extra
  }
}

const takeSample = (entry, slot, run) => {
  try {
    const started = now()
    const ok = entry.run()
    const wall = elapsed(started)
    if (!ok) {
      console.error(`${entry.name} run ${run} produced unexpected hints`)
      slot.errors++
      return
    }
    slot.walls.push(wall)
  } catch (error) {
    console.error(error)
    slot.errors++
  }
}

const main = () => {
  const slots = CASES.map(entry => {
    entry.run()
    return { entry, walls: [], errors: 0 }
  })
  for (let run = 0; run < RUNS; run++) {
    for (const slot of slots) takeSample(slot.entry, slot, run)
  }
  const results = slots.map(slot => report(slot.entry, slot))
  writeFileSync(
    join(__dirname, '..', 'benchmark-output.json'),
    JSON.stringify(results, null, 2) + '\n'
  )
  const errors = slots.reduce((total, slot) => total + slot.errors, 0)
  if (errors > 0 || results.some(result => !Number.isFinite(result.value))) {
    process.exitCode = 1
  }
}

main()
