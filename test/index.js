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

test('non-Blink browsers emit no client hints', t => {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:156.0) Gecko/20100101 Firefox/156.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Android 13; Mobile; rv:121.0) Gecko/121.0 Firefox/121.0',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1'
  ]

  for (const userAgent of userAgents) {
    t.deepEqual(uaHints(userAgent), {}, userAgent)
  }
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

test('an unparseable user agent yields no versioned hints', t => {
  for (const input of ['', undefined, null, 123, {}, []]) {
    const headers = uaHints(input)
    const label = String(input)

    t.is(headers['sec-ch-ua-mobile'], '?0', label)
    t.is(headers['sec-ch-ua-form-factors'], '["Desktop"]', label)
    t.false('sec-ch-ua' in headers, label)
    t.false('sec-ch-ua-full-version' in headers, label)
    t.false('sec-ch-ua-full-version-list' in headers, label)
  }
})

test("brands HeadlessChrome with Chromium's brand token", t => {
  const headers = uaHints(
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/131.0.6778.85 Safari/537.36'
  )

  t.is(
    headers['sec-ch-ua'],
    '"HeadlessChrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"'
  )
  t.is(headers['sec-ch-ua-full-version'], '"131.0.6778.85"')
})

test('negative parsed versions do not crash GREASE seeding', t => {
  for (const userAgent of [
    'Vivaldi/-1',
    'Whale/-1.0.0.0',
    'Silk/-5',
    'DuckDuckGo/-1',
    'Chromium/-1',
    'Mozilla/5.0 Vivaldi/-1'
  ]) {
    const headers = uaHints(userAgent)
    t.false(headers['sec-ch-ua'].includes('undefined'), userAgent)
    t.false(
      headers['sec-ch-ua-full-version-list'].includes('undefined'),
      userAgent
    )
  }

  // Seed 0 uses GREASE chars ` ` / `(` and version `8`, and order [0, 1, 2].
  t.is(
    uaHints('Vivaldi/-1')['sec-ch-ua'],
    '"Not A(Brand";v="8", "Chromium";v="-1", "Vivaldi";v="-1"'
  )
  t.is(
    uaHints('Chromium/-1')['sec-ch-ua'],
    '"Not A(Brand";v="8", "Chromium";v="-1"'
  )
})

test('non-finite parsed versions do not crash GREASE seeding', t => {
  // parseInt of 310+ digit majors is Infinity; Infinity % n is NaN, so
  // BRAND_ORDERS[NaN] threw and Chromium-only GREASE emitted "undefined".
  const overflow = '1'.repeat(400)

  for (const userAgent of [
    `Chrome/${overflow}`,
    `Vivaldi/${overflow}`,
    `Whale/${overflow}`,
    `Silk/${overflow}`,
    `Chromium/${overflow}`,
    `HeadlessChrome/${overflow}`,
    chromeUA('Windows NT 10.0; Win64; x64', `${overflow}.0.0.0`)
  ]) {
    const headers = uaHints(userAgent)
    t.false(headers['sec-ch-ua'].includes('undefined'), userAgent)
    t.false(
      headers['sec-ch-ua-full-version-list'].includes('undefined'),
      userAgent
    )
  }

  // Seed 0 uses GREASE chars ` ` / `(` and version `8`, and order [0, 1, 2].
  t.is(
    uaHints(`Chrome/${overflow}`)['sec-ch-ua'],
    `"Not A(Brand";v="8", "Chromium";v="${overflow}", "Google Chrome";v="${overflow}"`
  )
  t.is(
    uaHints(`Chromium/${overflow}`)['sec-ch-ua'],
    `"Not A(Brand";v="8", "Chromium";v="${overflow}"`
  )
})

test('Chromium-only builds emit GREASE + Chromium, not a duplicate brand', t => {
  const headers = uaHints(
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chromium/120.0.6099.109 Chrome/120.0.6099.109 Safari/537.36'
  )

  t.is(headers['sec-ch-ua'], '"Not_A Brand";v="8", "Chromium";v="120"')
  t.is(
    headers['sec-ch-ua-full-version-list'],
    '"Not_A Brand";v="8.0.0.0", "Chromium";v="120.0.6099.109"'
  )

  t.is(
    uaHints(
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chromium/131.0.6778.85 Chrome/131.0.6778.85 Safari/537.36'
    )['sec-ch-ua'],
    '"Chromium";v="131", "Not_A Brand";v="24"'
  )
})

test('repeated calls return independent objects', t => {
  const first = uaHints(CHROME_120_WINDOWS)
  first['sec-ch-ua'] = 'mutated'
  delete first['sec-ch-ua-mobile']

  const second = uaHints(CHROME_120_WINDOWS)
  t.not(second, first)
  t.is(
    second['sec-ch-ua'],
    '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"'
  )
  t.is(second['sec-ch-ua-mobile'], '?0')
})

test('`sec-ch-ua-model` is the model exactly as the User-Agent sends it', t => {
  for (const [platform, model] of [
    ['Linux; Android 5.0.2; LG-D690', 'LG-D690'],
    ['Linux; Android 12; Nokia G21 Build/SP1A.210812.016; wv', 'Nokia G21'],
    ['Linux; Android 6.0.1; Moto G (4) Build/MPJ24.139-64', 'Moto G (4)'],
    ['Linux; U; Android 10; zh-cn; Mi 10 Build/QKQ1.191117.002', 'Mi 10']
  ]) {
    const headers = uaHints(
      chromeUA(platform, '120.0.0.0', 'Mobile Safari/537.36')
    )
    t.is(headers['sec-ch-ua-model'], JSON.stringify(model), platform)
  }
})

test('Linux has no platform version', t => {
  for (const platform of [
    'X11; Linux x86_64',
    'X11; Linux aarch64',
    'X11; Linux i686'
  ]) {
    const headers = uaHints(chromeUA(platform))
    t.is(headers['sec-ch-ua-platform'], '"Linux"', platform)
    t.false('sec-ch-ua-platform-version' in headers, platform)
  }
})

test('Internet Explorer emits no client hints', t => {
  for (const userAgent of [
    'Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.0)',
    'Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; rv:11.0) like Gecko',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.102 Safari/537.36 Edge/18.18363'
  ]) {
    t.deepEqual(uaHints(userAgent), {}, userAgent)
  }
})

test('names the Chromium embedder that sent the User-Agent', t => {
  const brandOf = userAgent => {
    const brands = uaHints(userAgent)['sec-ch-ua']
    return brands.split(', ').map(entry => entry.split(';')[0])
  }

  for (const [userAgent, brand] of [
    [
      chromeUA(
        'Linux; Android 10; K',
        '143.0.0.0',
        'Mobile Safari/537.36'
      ).replace('Chrome/', 'SamsungBrowser/30.0 Chrome/'),
      'Samsung Internet'
    ],
    [
      chromeUA(
        'Windows NT 10.0; Win64; x64',
        '150.0.0.0',
        'YaBrowser/26.8.0.0 Safari/537.36'
      ),
      'Yandex'
    ],
    [
      chromeUA(
        'Linux; Android 16; SM-S928B Build/BP4A.251205.006; wv',
        '151.0.7922.199',
        'Mobile Safari/537.36'
      ),
      'Chrome WebView'
    ],
    [
      chromeUA(
        'Linux; Android 10; K',
        '130.0.6723.107',
        'Mobile Safari/537.36'
      ).replace('Chrome/', 'Version/4.0 Chrome/'),
      'Android Browser'
    ],
    [
      chromeUA(
        'Windows NT 10.0; Win64; x64',
        '142.0.7444.265',
        'Electron/39.5.1 Safari/537.36'
      ),
      'Electron'
    ],
    [
      chromeUA(
        'Linux; Android 13; SM-S918B',
        '120.0.0.0',
        'Mobile Safari/537.36 EdgA/120.0.2210.115'
      ),
      'Microsoft Edge'
    ]
  ]) {
    t.true(brandOf(userAgent).includes(JSON.stringify(brand)), userAgent)
  }
})

test('iOS apps report the Apple device', t => {
  const headers = uaHints('retweet/2.17 (iPhone; iOS 17.1.2; Scale/3.00)')
  t.is(headers['sec-ch-ua-platform'], '"iOS"')
  t.is(headers['sec-ch-ua-platform-version'], '"17.1.2"')
  t.is(headers['sec-ch-ua-model'], '"iPhone"')
  t.is(headers['sec-ch-ua-mobile'], '?1')
})

test('reads at most the first 500 characters of the User-Agent', t => {
  const headers = uaHints(`${'x'.repeat(500)} Chrome/120.0.0.0`)
  t.false('sec-ch-ua' in headers)
  t.is(headers['sec-ch-ua-mobile'], '?0')
})

test('a `Mobile` token anywhere marks an Android phone', t => {
  const headers = uaHints(
    'Mozilla/5.0 (Linux; Android 13; K) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.0.0 Mobile DuckDuckGo/5 Safari/537.36'
  )
  t.is(headers['sec-ch-ua-mobile'], '?1')
  t.is(headers['sec-ch-ua-form-factors'], '["Mobile"]')
})

test('reads the Android model past browser decorations', t => {
  const modelOf = userAgent => uaHints(userAgent)['sec-ch-ua-model']

  t.is(
    modelOf(
      'Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36'
    ),
    '"SM-S918B"'
  )
  t.is(
    modelOf(
      'Mozilla/5.0 (Linux; U; Android 9; zh-CN; MI 8 Build/PKQ1.180729.001) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/57.0.2987.108 UCBrowser/13.4.0.1306 Mobile Safari/537.36'
    ),
    '"MI 8"'
  )
  t.is(
    modelOf(
      'Mozilla/5.0 (Linux; Android 14; Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.0.0 Mobile Safari/537.36'
    ),
    undefined
  )
})

test('an Android token inside another product is not the platform', t => {
  const headers = uaHints(
    chromeUA(
      'X11; Linux x86_64',
      '131.0.0.0',
      'Safari/537.36 MyApp-Android/1.0'
    )
  )
  t.is(headers['sec-ch-ua-platform'], '"Linux"')
  t.is(headers['sec-ch-ua-form-factors'], '["Desktop"]')
})

test('compatibility tokens do not hide the real browser', t => {
  const headers = uaHints(
    'Mozilla/5.0 (X11; Linux x86_64; Quest 3) AppleWebKit/537.36 (KHTML, like Gecko) OculusBrowser/35.2.0.10.62 SamsungBrowser/4.0 Chrome/128.0.6613.137 VR Safari/537.36'
  )
  t.is(headers['sec-ch-ua-full-version'], '"35.2.0.10.62"')
  t.true(headers['sec-ch-ua'].includes('"Oculus Browser";v="35"'))
})

test('reports BSD platforms by name', t => {
  for (const platform of ['FreeBSD', 'OpenBSD']) {
    const headers = uaHints(chromeUA(`X11; ${platform} amd64`))
    t.is(headers['sec-ch-ua-platform'], JSON.stringify(platform))
  }
})

test('matches tokens regardless of case', t => {
  const headers = uaHints(chromeUA('Windows NT 10.0; Win64; x64').toLowerCase())
  t.is(
    headers['sec-ch-ua'],
    '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"'
  )
  t.is(headers['sec-ch-ua-platform'], '"Windows"')
})

test('detects the form factor regardless of case', t => {
  const cases = [
    [chromeUA('iPad; CPU OS 17_0 like Mac OS X'), 'Tablet'],
    [chromeUA('iPhone; CPU iPhone OS 17_0 like Mac OS X'), 'Mobile'],
    [chromeUA('Linux; Android 14; SM-X910'), 'Tablet'],
    [
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      'Mobile'
    ]
  ]

  for (const [userAgent, formFactor] of cases) {
    t.is(
      uaHints(userAgent.toLowerCase())['sec-ch-ua-form-factors'],
      uaHints(userAgent)['sec-ch-ua-form-factors'],
      userAgent
    )
    t.is(
      uaHints(userAgent)['sec-ch-ua-form-factors'],
      JSON.stringify([formFactor]),
      userAgent
    )
  }
})

test('detects the platform and its version', t => {
  const cases = [
    [chromeUA('Windows NT 6.1; Win64; x64'), 'Windows', '7'],
    ['Mozilla/5.0 (Windows NT) Chrome/120.0.0.0', 'Windows', undefined],
    [chromeUA('X11; CrOS x86_64 14541.0.0'), 'Chrome OS', '14541.0.0'],
    [chromeUA('Macintosh; Intel Mac OS X 14_6'), 'macOS', '14.6'],
    [chromeUA('Macintosh'), 'macOS', undefined],
    [
      chromeUA('X11; Linux x86_64').replace(
        'Chrome/',
        'Ubuntu Chromium/120.0.0.0 Chrome/'
      ),
      'Ubuntu',
      undefined
    ],
    ['SpringBoard/50 CFNetwork/1209 Darwin/20.2.0', 'iOS', undefined],
    [chromeUA('iPad; CPU OS 17_0 like Mac OS X'), 'iOS', '17.0'],
    [
      chromeUA(
        'Linux; Android 10; HarmonyOS; HLK-AL00; HMSCore 6.10.0.312',
        '88.0.4324.93',
        'Mobile Safari/537.36'
      ),
      'HarmonyOS',
      undefined
    ],
    [
      'Dalvik/2.1.0 (Linux; U; Android 14; SM-S911N Build/UP1A.231005.007)',
      'Android',
      '14'
    ]
  ]

  for (const [userAgent, platform, version] of cases) {
    const headers = uaHints(userAgent)
    t.is(headers['sec-ch-ua-platform'], JSON.stringify(platform), userAgent)
    t.is(
      headers['sec-ch-ua-platform-version'],
      version && JSON.stringify(version),
      userAgent
    )
  }
})

test('detects the form factor of Apple and Android devices', t => {
  const cases = [
    [chromeUA('iPad; CPU OS 17_0 like Mac OS X'), 'Tablet', '"iPad"'],
    ['retweet/2.17 (iPhone; iOS 17.1.2; Scale/3.00)', 'Mobile', '"iPhone"'],
    ['SpringBoard/50 CFNetwork/1209 Darwin/20.2.0', 'Desktop', undefined],
    [
      'Dalvik/2.1.0 (Linux; U; Android 14; SM-S911N Build/UP1A.231005.007)',
      'Mobile',
      '"SM-S911N"'
    ],
    ['Mozilla/5.0 (Linux; Android 14)', 'Desktop', undefined]
  ]

  for (const [userAgent, formFactor, model] of cases) {
    const headers = uaHints(userAgent)
    t.is(
      headers['sec-ch-ua-form-factors'],
      JSON.stringify([formFactor]),
      userAgent
    )
    t.is(headers['sec-ch-ua-model'], model, userAgent)
  }
})
