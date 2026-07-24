'use strict'

const uaHints = require('..')

const test = require('ava').default

test('get client hints', t => {
  const userAgent =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.109 Safari/537.36'

  const headers = uaHints(userAgent)

  t.is(
    headers['sec-ch-ua'],
    '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"'
  )
  t.is(headers['sec-ch-ua-mobile'], '?0')
  t.is(headers['sec-ch-ua-platform'], '"Windows"')
  t.is(headers['sec-ch-ua-platform-version'], '"10"')
  t.is(headers['sec-ch-ua-arch'], '"x86"')
  t.is(headers['sec-ch-ua-bitness'], '"64"')
  t.is(headers['sec-ch-ua-full-version'], '"120.0.6099.109"')
  t.is(
    headers['sec-ch-ua-full-version-list'],
    '"Google Chrome";v="120.0.6099.109"'
  )
  t.is(headers['sec-ch-ua-wow64'], '?1')
  t.is(headers['sec-ch-ua-form-factors'], '["Desktop"]')
  t.falsy(headers['sec-ch-ua-model'])
})

test('sets `sec-ch-ua` for desktop Chrome', t => {
  const userAgent =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36'
  const headers = uaHints(userAgent)
  t.is(
    headers['sec-ch-ua'],
    '"Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"'
  )
})

test('maps Android Chrome to Google Chrome brand', t => {
  const userAgent =
    'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.144 Mobile Safari/537.36'
  const headers = uaHints(userAgent)

  t.is(
    headers['sec-ch-ua'],
    '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"'
  )
  t.is(
    headers['sec-ch-ua-full-version-list'],
    '"Google Chrome";v="120.0.6099.144"'
  )
  t.is(headers['sec-ch-ua-mobile'], '?1')
  t.is(headers['sec-ch-ua-model'], '"Pixel 7"')
  t.is(headers['sec-ch-ua-form-factors'], '["Mobile"]')
})

test('uses engine version for Chromium brand on Opera', t => {
  const userAgent =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OPR/106.0.0.0'
  const headers = uaHints(userAgent)

  // Seed/GREASE/Chromium follow Blink 120; Opera brand keeps embedder 106.
  t.is(
    headers['sec-ch-ua'],
    '"Not_A Brand";v="8", "Chromium";v="120", "Opera";v="106"'
  )
  t.is(headers['sec-ch-ua-full-version'], '"106.0.0.0"')
  t.is(headers['sec-ch-ua-full-version-list'], '"Opera";v="106.0.0.0"')
})
