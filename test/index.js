'use strict'

const uaHints = require('..')

const test = require('ava').default

test('get client hints', t => {
  const userAgent =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.109 Safari/537.36'

  const headers = uaHints(userAgent)

  t.truthy(headers['sec-ch-ua-arch'])
  t.truthy(headers['sec-ch-ua-bitness'])
  t.truthy(headers['sec-ch-ua-form-factors'])
  t.truthy(headers['sec-ch-ua-full-version-list'])
  t.truthy(headers['sec-ch-ua-full-version'])
  t.truthy(headers['sec-ch-ua-mobile'])
  t.truthy(headers['sec-ch-ua-platform-version'])
  t.truthy(headers['sec-ch-ua-platform'])
  t.truthy(headers['sec-ch-ua-wow64'])
  t.truthy(headers['sec-ch-ua'])
})

test('sets `sec-ch-ua`', t => {
  const userAgent =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36'
  const headers = uaHints(userAgent)
  t.is(headers['sec-ch-ua'], '"Google Chrome";v="135", "\\"Not;A\\Brand";v="99", "Chromium";v="135"')
})

test('reports arm arch for Windows on ARM64', t => {
  // Real Chrome on Windows ARM includes both Win64 and ARM64 tokens.
  const userAgent =
    'Mozilla/5.0 (Windows NT 10.0; Win64; ARM64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.109 Safari/537.36'
  const headers = uaHints(userAgent)

  t.is(headers['sec-ch-ua-arch'], '"arm"')
  t.is(headers['sec-ch-ua-bitness'], '"64"')
})

test('reports x86 arch for Windows x64', t => {
  const userAgent =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.109 Safari/537.36'
  const headers = uaHints(userAgent)

  t.is(headers['sec-ch-ua-arch'], '"x86"')
  t.is(headers['sec-ch-ua-bitness'], '"64"')
})
