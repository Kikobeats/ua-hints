'use strict'

const uaHints = require('..')

const test = require('ava')

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

test('sec-ch-ua-full-version-list mirrors sec-ch-ua brands', t => {
  const userAgent =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.109 Safari/537.36'
  const headers = uaHints(userAgent)

  t.is(
    headers['sec-ch-ua'],
    '"\\Not\\"A;Brand";v="99", "Chromium";v="120", "Google Chrome";v="120"'
  )
  t.is(
    headers['sec-ch-ua-full-version-list'],
    '"\\Not\\"A;Brand";v="99.0.0.0", "Chromium";v="120.0.6099.109", "Google Chrome";v="120.0.6099.109"'
  )
})
