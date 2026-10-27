'use strict'

const Module = require('module')
const test = require('ava').default

// Result checks stay green if a hit, the size check, or the recency update is
// removed. Counting constructions is what makes those branches fail.
let parses = 0
const originalRequire = Module.prototype.require
Module.prototype.require = function (request) {
  const loaded = originalRequire.apply(this, arguments)
  if (request !== 'ua-parser-js') return loaded

  const Parser = loaded
  function CountingParser (...args) {
    parses += 1
    return new Parser(...args)
  }

  return CountingParser
}

const uaHints = require('..')

const CACHE_SIZE = 1000

const addedParses = callback => {
  const before = parses
  callback()
  return parses - before
}

const misses = (t, userAgent) => {
  t.is(
    addedParses(() => uaHints(userAgent)),
    1
  )
}

const hits = (t, userAgent) => {
  t.is(
    addedParses(() => uaHints(userAgent)),
    0
  )
}

const FIREFOX =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:156.0) Gecko/20100101 Firefox/156.0'

test('parsed hints stay cached until that entry is the least recently used', t => {
  misses(t, 'phase-0')
  hits(t, 'phase-0')
  misses(t, 'phase-1')
  hits(t, 'phase-0')

  // Two phase entries plus the rest of the cap. The next two evict the phase
  // keys and leave fill-0 as the oldest of a full cache.
  for (let index = 0; index < CACHE_SIZE - 2; index++) uaHints(`fill-${index}`)
  uaHints(`fill-${CACHE_SIZE - 2}`)
  uaHints(`fill-${CACHE_SIZE - 1}`)

  // Re-reading the oldest entry has to move it off the eviction end.
  hits(t, 'fill-0')
  misses(t, `fill-${CACHE_SIZE}`)
  hits(t, 'fill-0')
  misses(t, 'fill-1')

  // A non-Blink result is an empty object, and that is still a cache hit.
  misses(t, FIREFOX)
  const firefox = uaHints(FIREFOX)
  firefox.poison = true
  hits(t, FIREFOX)
  t.deepEqual(uaHints(FIREFOX), {})

  // Non-strings share one key. A caller can only mutate its own copy.
  misses(t, null)
  const empty = uaHints(null)
  empty.poison = true
  delete empty['sec-ch-ua-mobile']
  hits(t, undefined)
  hits(t, '')
  hits(t, false)
  const stringObject = Object(FIREFOX)
  t.is(typeof stringObject, 'object')
  hits(t, stringObject)
  const shared = uaHints('')
  t.is(shared.poison, undefined)
  t.is(shared['sec-ch-ua-mobile'], '?0')
})
