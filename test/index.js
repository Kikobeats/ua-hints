'use strict'

const test = require('ava').default

const uaHints = require('..')

const CHROME_120_WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.109 Safari/537.36'

test('get client hints', t => {
  t.deepEqual(uaHints(CHROME_120_WINDOWS), {
    'sec-ch-ua':
      '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-ch-ua-platform-version': '"10"',
    'sec-ch-ua-arch': '"x86"',
    'sec-ch-ua-bitness': '"64"',
    'sec-ch-ua-full-version': '"120.0.6099.109"',
    'sec-ch-ua-full-version-list':
      '"Not_A Brand";v="8.0.0.0", "Chromium";v="120.0.6099.109", "Google Chrome";v="120.0.6099.109"',
    'sec-ch-ua-wow64': '?1',
    'sec-ch-ua-form-factors': '["Desktop"]'
  })
})

test('sets `sec-ch-ua`', t => {
  const userAgent =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36'
  const headers = uaHints(userAgent)
  t.is(
    headers['sec-ch-ua'],
    '"Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"'
  )
})

test('`sec-ch-ua` GREASE matches what Chromium ships', t => {
  const brandsOf = major =>
    uaHints(
      `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Safari/537.36`
    )['sec-ch-ua']

  t.is(
    brandsOf(120),
    '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"'
  )
  t.is(
    brandsOf(131),
    '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"'
  )
  t.is(
    brandsOf(133),
    '"Not(A:Brand";v="99", "Google Chrome";v="133", "Chromium";v="133"'
  )
})

test('`sec-ch-ua-full-version-list` mirrors `sec-ch-ua` brands', t => {
  const headers = uaHints(CHROME_120_WINDOWS)

  const brands = value => value.split(', ').map(entry => entry.split(';v=')[0])

  t.deepEqual(
    brands(headers['sec-ch-ua-full-version-list']),
    brands(headers['sec-ch-ua'])
  )
})

test('brands Android Chrome as Google Chrome', t => {
  const userAgent =
    'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.144 Mobile Safari/537.36'
  const headers = uaHints(userAgent)

  t.is(
    headers['sec-ch-ua'],
    '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"'
  )
  t.is(headers['sec-ch-ua-mobile'], '?1')
  t.is(headers['sec-ch-ua-model'], '"Pixel 7"')
  t.is(headers['sec-ch-ua-form-factors'], '["Mobile"]')
})

test('embedders keep their own version while Chromium follows Blink', t => {
  const opera = uaHints(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OPR/106.0.0.0'
  )

  t.is(
    opera['sec-ch-ua'],
    '"Not_A Brand";v="8", "Chromium";v="120", "Opera";v="106"'
  )
  t.is(opera['sec-ch-ua-full-version'], '"106.0.0.0"')
  t.is(
    opera['sec-ch-ua-full-version-list'],
    '"Not_A Brand";v="8.0.0.0", "Chromium";v="120.0.0.0", "Opera";v="106.0.0.0"'
  )
})

test('brands Edge as Microsoft Edge', t => {
  const headers = uaHints(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.2210.61'
  )

  t.is(
    headers['sec-ch-ua'],
    '"Not_A Brand";v="8", "Chromium";v="120", "Microsoft Edge";v="120"'
  )
  t.is(headers['sec-ch-ua-full-version'], '"120.0.2210.61"')
})

test('detects arm before Win64 on Windows on ARM', t => {
  const headers = uaHints(
    'Mozilla/5.0 (Windows NT 10.0; Win64; ARM64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.109 Safari/537.36'
  )

  t.is(headers['sec-ch-ua-arch'], '"arm"')
  t.is(headers['sec-ch-ua-bitness'], '"64"')
})

test('detects x86 on Windows x64', t => {
  const headers = uaHints(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.109 Safari/537.36'
  )

  t.is(headers['sec-ch-ua-arch'], '"x86"')
  t.is(headers['sec-ch-ua-bitness'], '"64"')
})

test('detects 32 bit architectures', t => {
  const arm = uaHints(
    'Mozilla/5.0 (X11; Linux armv7l) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  )
  t.is(arm['sec-ch-ua-arch'], '"arm"')
  t.is(arm['sec-ch-ua-bitness'], '"32"')

  const x86 = uaHints(
    'Mozilla/5.0 (X11; Linux i686) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  )
  t.is(x86['sec-ch-ua-arch'], '"x86"')
  t.is(x86['sec-ch-ua-bitness'], '"32"')
})

test('omits `sec-ch-ua-model` on desktop', t => {
  const headers = uaHints(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.109 Safari/537.36'
  )

  t.is(headers['sec-ch-ua-mobile'], '?0')
  t.is(headers['sec-ch-ua-form-factors'], '["Desktop"]')
  t.false('sec-ch-ua-model' in headers)
})

test('omits the reduced User-Agent placeholder model', t => {
  const headers = uaHints(
    'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
  )

  t.false('sec-ch-ua-model' in headers)
  t.is(headers['sec-ch-ua-mobile'], '?1')
  t.is(headers['sec-ch-ua-platform'], '"Android"')
})

test('tablets are not mobile and report the Tablet form factor', t => {
  const headers = uaHints(
    'Mozilla/5.0 (Linux; Android 13; Pixel Tablet) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  )

  t.is(headers['sec-ch-ua-mobile'], '?0')
  t.is(headers['sec-ch-ua-form-factors'], '["Tablet"]')
  t.is(headers['sec-ch-ua-model'], '"Pixel Tablet"')
})

test('does not seed GREASE with a non Blink engine version', t => {
  const headers = uaHints(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'
  )

  // Seeded with Safari 17, not with the WebKit 605 engine version.
  t.is(
    headers['sec-ch-ua'],
    '"Safari";v="17", "Chromium";v="17", "Not)A;Brand";v="24"'
  )
})

test('an unparseable user agent yields no versioned hints', t => {
  const headers = uaHints('')

  t.is(headers['sec-ch-ua-mobile'], '?0')
  t.is(headers['sec-ch-ua-form-factors'], '["Desktop"]')
  t.false('sec-ch-ua-full-version' in headers)
  t.false('sec-ch-ua-full-version-list' in headers)
})
