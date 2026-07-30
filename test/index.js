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
  t.falsy(headers['sec-ch-ua-model'])
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

test('omits reduced-UA placeholder model "K"', t => {
  const userAgent =
    'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
  const headers = uaHints(userAgent)

  t.falsy(headers['sec-ch-ua-model'])
  t.is(headers['sec-ch-ua-mobile'], '?1')
  t.is(headers['sec-ch-ua-platform'], '"Android"')
})

test('keeps real Android device models', t => {
  const userAgent =
    'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.144 Mobile Safari/537.36'
  const headers = uaHints(userAgent)

  t.is(headers['sec-ch-ua-model'], '"Pixel 7"')
  t.is(headers['sec-ch-ua-mobile'], '?1')
})
