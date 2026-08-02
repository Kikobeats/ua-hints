'use strict'

const test = require('ava').default

const uaHints = require('..')

const chromeUA = (
  platform,
  version = '120.0.6099.109',
  trailer = 'Safari/537.36'
) =>
  `Mozilla/5.0 (${platform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} ${trailer}`

const CHROME_120_WINDOWS = chromeUA('Windows NT 10.0; Win64; x64; WOW64')
const CHROME_135_MAC = chromeUA(
  'Macintosh; Intel Mac OS X 10_15_7',
  '135.0.0.0'
)
const CHROME_120_PIXEL_7 = chromeUA(
  'Linux; Android 13; Pixel 7',
  '120.0.6099.144',
  'Mobile Safari/537.36'
)
const OPERA_106 = chromeUA(
  'Windows NT 10.0; Win64; x64',
  '120.0.0.0',
  'Safari/537.36 OPR/106.0.0.0'
)

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
  const headers = uaHints(CHROME_135_MAC)
  t.is(
    headers['sec-ch-ua'],
    '"Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"'
  )
})

test('`sec-ch-ua` GREASE matches what Chromium ships', t => {
  const brandsOf = major =>
    uaHints(chromeUA('Windows NT 10.0; Win64; x64', `${major}.0.0.0`))[
      'sec-ch-ua'
    ]

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

test('`sec-ch-ua-full-version-list` always mirrors the `sec-ch-ua` brands', t => {
  const brandsOf = value =>
    value.split(', ').map(entry => entry.split(';v=')[0])

  for (const userAgent of [
    CHROME_120_WINDOWS,
    CHROME_135_MAC,
    CHROME_120_PIXEL_7,
    OPERA_106
  ]) {
    const headers = uaHints(userAgent)
    t.deepEqual(
      brandsOf(headers['sec-ch-ua-full-version-list']),
      brandsOf(headers['sec-ch-ua']),
      userAgent
    )
  }
})

test('brands Android Chrome as Google Chrome', t => {
  const headers = uaHints(CHROME_120_PIXEL_7)

  t.is(
    headers['sec-ch-ua'],
    '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"'
  )
  t.is(headers['sec-ch-ua-mobile'], '?1')
  t.is(headers['sec-ch-ua-model'], '"Pixel 7"')
  t.is(headers['sec-ch-ua-form-factors'], '["Mobile"]')
})

test('mobile builds keep the desktop brand name', t => {
  const safari = uaHints(
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  )
  const firefox = uaHints(
    'Mozilla/5.0 (Android 13; Mobile; rv:121.0) Gecko/121.0 Firefox/121.0'
  )

  t.true(safari['sec-ch-ua'].includes('"Safari";v="17"'))
  t.true(firefox['sec-ch-ua'].includes('"Mozilla Firefox";v="121"'))
})

test('embedders keep their own version while Chromium follows Blink', t => {
  const opera = uaHints(OPERA_106)

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
    chromeUA(
      'Windows NT 10.0; Win64; x64',
      '120.0.0.0',
      'Safari/537.36 Edg/120.0.2210.61'
    )
  )

  t.is(
    headers['sec-ch-ua'],
    '"Not_A Brand";v="8", "Chromium";v="120", "Microsoft Edge";v="120"'
  )
  t.is(headers['sec-ch-ua-full-version'], '"120.0.2210.61"')
})

test('detects architecture and bitness', t => {
  // Windows on ARM reports both Win64 and ARM64; only the latter is the arch.
  const architectures = [
    ['Windows NT 10.0; Win64; ARM64', '"arm"', '"64"'],
    ['Windows NT 10.0; Win64; x64', '"x86"', '"64"'],
    ['X11; Linux armv7l', '"arm"', '"32"'],
    ['X11; Linux i686', '"x86"', '"32"'],
    ['Macintosh; Intel Mac OS X 10_15_7', undefined, undefined]
  ]

  for (const [platform, arch, bitness] of architectures) {
    const headers = uaHints(chromeUA(platform))
    t.is(headers['sec-ch-ua-arch'], arch, platform)
    t.is(headers['sec-ch-ua-bitness'], bitness, platform)
  }
})

test('omits `sec-ch-ua-model` on desktop', t => {
  const headers = uaHints(chromeUA('Macintosh; Intel Mac OS X 10_15_7'))

  t.is(headers['sec-ch-ua-mobile'], '?0')
  t.is(headers['sec-ch-ua-form-factors'], '["Desktop"]')
  t.false('sec-ch-ua-model' in headers)
})

test('omits the reduced User-Agent placeholder model', t => {
  const headers = uaHints(
    chromeUA('Linux; Android 10; K', '120.0.0.0', 'Mobile Safari/537.36')
  )

  t.false('sec-ch-ua-model' in headers)
  t.is(headers['sec-ch-ua-mobile'], '?1')
  t.is(headers['sec-ch-ua-platform'], '"Android"')
})

test('tablets are not mobile and report the Tablet form factor', t => {
  const headers = uaHints(
    chromeUA('Linux; Android 13; Pixel Tablet', '120.0.0.0')
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
  t.false('sec-ch-ua' in headers)
  t.false('sec-ch-ua-full-version' in headers)
  t.false('sec-ch-ua-full-version-list' in headers)
})
