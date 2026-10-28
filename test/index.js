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
    ['X11; Linux x86; win64extra', '"x86"', '"32"'],
    ['Macintosh; Intel Mac OS X 10_15_7', undefined, undefined],
    ['X11; Linux aarch64', '"arm"', '"64"'],
    ['Linux; Android 10; HarmonyOS; HLK-AL00', undefined, undefined],
    ['X11; Linux x86_64; HarmonyOS', '"x86"', '"64"'],
    ['Linux; Android 10; HarmonyOS; AArch64', '"arm"', '"64"'],
    ['Linux; Android 10; SM-X640', undefined, undefined],
    ['Linux; Android 10; Pixelx64', undefined, undefined],
    ['X11; Linux armextra', undefined, undefined]
  ]

  for (const [platform, arch, bitness] of architectures) {
    const headers = uaHints(chromeUA(platform))
    t.is(headers['sec-ch-ua-arch'], arch, platform)
    t.is(headers['sec-ch-ua-bitness'], bitness, platform)
  }

  const leading = uaHints('aarch64 Chrome/120.0.0.0')
  t.is(leading['sec-ch-ua-arch'], '"arm"')
  t.is(leading['sec-ch-ua-bitness'], '"64"')

  t.is(
    uaHints(chromeUA('Windows NT 10.0; Win64; x64; WOW64'))['sec-ch-ua-wow64'],
    '?1'
  )
  t.is(
    uaHints(chromeUA('Windows NT 10.0; wow64extra'))['sec-ch-ua-wow64'],
    '?0'
  )
  t.is(uaHints(chromeUA('Windows NT 10.0; x64wow64'))['sec-ch-ua-wow64'], '?0')
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
    t.false('sec-ch-ua-platform' in headers, label)
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
  for (const platform of ['FreeBSD', 'OpenBSD', 'NetBSD']) {
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

test('returns no hints for EdgeHTML regardless of case', t => {
  const userAgent =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.102 Safari/537.36 Edge/18.19582'
  t.deepEqual(uaHints(userAgent), {})
  t.deepEqual(uaHints(userAgent.toLowerCase()), {})
})

test('does not report the WebView token as the device model', t => {
  const withoutModel =
    'Mozilla/5.0 (Linux; Android 13; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.6099.230 Mobile Safari/537.36'
  const withModel =
    'Mozilla/5.0 (Linux; Android 13; SM-S918B Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.6099.230 Mobile Safari/537.36'
  const uppercaseToken = withoutModel.replace('; wv)', '; WV)')
  t.is(uaHints(withoutModel)['sec-ch-ua-model'], undefined)
  t.is(uaHints(uppercaseToken)['sec-ch-ua-model'], undefined)
  t.is(uaHints(withoutModel)['sec-ch-ua-form-factors'], '["Mobile"]')
  t.is(
    uaHints(withoutModel.toLowerCase())['sec-ch-ua-form-factors'],
    '["Mobile"]'
  )
  t.is(uaHints(withModel)['sec-ch-ua-model'], '"SM-S918B"')
})

test('detects the platform and its version', t => {
  const cases = [
    [chromeUA('Windows NT 6.1; Win64; x64'), 'Windows', '7'],
    ['Mozilla/5.0 (Windows NT) Chrome/120.0.0.0', 'Windows', undefined],
    [chromeUA('X11; CrOS x86_64 14541.0.0'), 'Chrome OS', '14541.0.0'],
    [chromeUA('Macintosh; Intel Mac OS X 14_6'), 'macOS', '14.6'],
    [chromeUA('Macintosh; Intel Mac OS X 10_15_7'), 'macOS', '10.15.7'],
    [chromeUA('Intel Mac OS X'), 'macOS', undefined],
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

test('matches platform tokens regardless of case', t => {
  const cases = [
    [chromeUA('X11; Linux x86_64'), 'Linux'],
    [chromeUA('X11; Ubuntu'), 'Ubuntu'],
    [chromeUA('Macintosh'), 'macOS'],
    [chromeUA('Macintosh; Intel Mac OS X 10_15_7'), 'macOS', '10.15.7'],
    [chromeUA('X11; CrOS x86_64 14541.0.0'), 'Chrome OS'],
    [chromeUA('X11; FreeBSD amd64'), 'FreeBSD'],
    [chromeUA('X11; OpenBSD amd64'), 'OpenBSD'],
    [chromeUA('X11; NetBSD amd64'), 'NetBSD'],
    ['SpringBoard/50 CFNetwork/1209 Darwin/20.2.0', 'iOS'],
    [
      chromeUA(
        'Linux; Android 10; HarmonyOS; HLK-AL00',
        '88.0.4324.93',
        'Mobile Safari/537.36'
      ),
      'HarmonyOS'
    ]
  ]

  for (const [userAgent, platform, version] of cases) {
    const headers = uaHints(userAgent.toLowerCase())
    t.is(headers['sec-ch-ua-platform'], JSON.stringify(platform), userAgent)
    if (version) {
      t.is(
        headers['sec-ch-ua-platform-version'],
        JSON.stringify(version),
        userAgent
      )
    }
  }
})

test('a glued platform token is not that platform', t => {
  const cases = [
    [chromeUA('X11; Linux x86_64; HarmonyOSPhone'), 'Linux'],
    [chromeUA('X11; Linux x86_64; AndroidPhone'), 'Linux'],
    [chromeUA('X11; FreeBSDextra'), undefined],
    [chromeUA('X11; NotFreeBSD'), undefined],
    [chromeUA('X11; NotLinux'), undefined],
    [chromeUA('X11; LinuxPhone'), undefined],
    [chromeUA('X11; MyUbuntuApp'), undefined],
    [chromeUA('Xubuntu'), undefined],
    [chromeUA('X11; Xubuntu; Linux x86_64'), 'Linux'],
    [chromeUA('NotMacintosh'), undefined],
    [chromeUA('MacintoshPhone'), undefined],
    [chromeUA('NotWindows NT 10.0'), undefined],
    [chromeUA('Windows NTPhone'), undefined],
    [chromeUA('MyMac OS X 10_15_7'), undefined],
    [chromeUA('Mac OS Xtra'), undefined],
    [chromeUA('NotCrOS x86_64 14541.0.0'), undefined],
    [chromeUA('NotCFNetwork/1209 Darwin/20.2.0'), undefined],
    ['Windows NT 10.0 Chrome/120.0.0.0', 'Windows'],
    ['Mac OS X 14_6 Chrome/120.0.0.0', 'macOS'],
    ['CFNetwork/1209 Chrome/120.0.0.0', 'iOS'],
    [
      chromeUA(
        'Macintosh; Intel Mac OS X 10_15_7',
        '120.0.0.0',
        'Safari/537.36 MyApp-iPhone/1.0'
      ),
      'macOS'
    ],
    [
      chromeUA(
        'X11; Linux x86_64',
        '120.0.0.0',
        'Safari/537.36 MyApp-iPod/1.0'
      ),
      'Linux'
    ],
    [
      chromeUA('X11; Ubuntu', '120.0.0.0', 'Safari/537.36 MyApp-iPad/1.0'),
      'Ubuntu'
    ]
  ]
  for (const [userAgent, platform] of cases) {
    t.is(
      uaHints(userAgent)['sec-ch-ua-platform'],
      platform && JSON.stringify(platform),
      userAgent
    )
  }
})

test('a product token that contains HarmonyOS is not the platform', t => {
  const headers = uaHints(
    chromeUA(
      'X11; Linux x86_64',
      '131.0.0.0',
      'Safari/537.36 MyApp-HarmonyOS/1.0'
    )
  )
  t.is(headers['sec-ch-ua-platform'], '"Linux"')
  t.is(headers['sec-ch-ua-form-factors'], '["Desktop"]')
})

test('HarmonyOS uses the Android device field', t => {
  const phone = uaHints(
    chromeUA(
      'Linux; Android 10; HarmonyOS; HLK-AL00; HMSCore 6.10.0.312',
      '88.0.4324.93',
      'Mobile Safari/537.36'
    )
  )
  t.is(phone['sec-ch-ua-model'], '"HLK-AL00"')
  t.is(phone['sec-ch-ua-form-factors'], '["Mobile"]')

  const tablet = uaHints(
    chromeUA('Linux; Android 10; HarmonyOS; AGS3-W09', '120.0.0.0')
  )
  t.is(tablet['sec-ch-ua-platform'], '"HarmonyOS"')
  t.is(tablet['sec-ch-ua-model'], '"AGS3-W09"')
  t.is(tablet['sec-ch-ua-form-factors'], '["Tablet"]')

  const bare = uaHints('Mozilla/5.0 (Linux; Android 10; HarmonyOS)')
  t.is(bare['sec-ch-ua-platform'], '"HarmonyOS"')
  t.false('sec-ch-ua-model' in bare)
  t.is(bare['sec-ch-ua-form-factors'], '["Desktop"]')
})

test('a locale is not the device model', t => {
  const modelOf = userAgent => uaHints(userAgent)['sec-ch-ua-model']

  t.is(modelOf('Mozilla/5.0 (Linux; Android 10; en-US)'), undefined)
  t.is(modelOf('Mozilla/5.0 (Linux; Android 10; zh_CN)'), undefined)
  t.is(modelOf('Mozilla/5.0 (Linux; Android 10; es-419)'), undefined)
  t.is(
    modelOf(
      'Mozilla/5.0 (Linux; Android 9; zh_CN; MI 8 Build/PKQ1.180729.001) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
    ),
    '"MI 8"'
  )
  t.is(
    modelOf(
      'Mozilla/5.0 (Linux; Android 9; es-419; MI 8 Build/PKQ1.180729.001) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
    ),
    '"MI 8"'
  )
  t.is(
    modelOf(
      'Mozilla/5.0 (Linux; Android 4.1.2; U; en-us; GT-I9300 Build/JZO54K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
    ),
    '"GT-I9300"'
  )
})

test('omits the reduced model regardless of case', t => {
  const headers = uaHints(
    chromeUA(
      'Linux; Android 10; K',
      '120.0.0.0',
      'Mobile Safari/537.36'
    ).toLowerCase()
  )
  t.false('sec-ch-ua-model' in headers)
  t.is(headers['sec-ch-ua-mobile'], '?1')

  const tablet = uaHints(
    chromeUA('Linux; Android 10; K', '120.0.0.0').toLowerCase()
  )
  t.false('sec-ch-ua-model' in tablet)
  t.is(tablet['sec-ch-ua-form-factors'], '["Tablet"]')
})

test('hints come only from the first 500 characters', t => {
  const inside = chromeUA('Windows NT 10.0; Win64; x64; WOW64')
  t.true(inside.length < 500)
  const withTail = inside + ' '.repeat(500)
  t.is(uaHints(withTail)['sec-ch-ua-arch'], '"x86"')
  t.is(uaHints(withTail)['sec-ch-ua-bitness'], '"64"')
  t.is(uaHints(withTail)['sec-ch-ua-wow64'], '?1')

  const head = chromeUA('Windows NT 10.0')
  const outside = `${head}${'x'.repeat(500)} Win64; x64; WOW64`
  const headers = uaHints(outside)
  t.true('sec-ch-ua' in headers)
  t.false('sec-ch-ua-arch' in headers)
  t.false('sec-ch-ua-bitness' in headers)
  t.is(headers['sec-ch-ua-wow64'], '?0')

  // The digit that distinguishes NT 6.1 (Windows 7) from NT 6.11 sits on the
  // cut. One character less or more changes the platform version.
  const version = 'Windows NT 6.1'
  const prefix = 'Mozilla/5.0 ('
  // A space, not a letter: a letter would glue onto Windows and stop being that token.
  const capped =
    prefix + ' '.repeat(500 - prefix.length - version.length) + version
  t.is(capped.length, 500)
  const bounded = `${capped}1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36`
  t.is(uaHints(bounded)['sec-ch-ua-platform-version'], '"7"')
})

test('treats Chrome 28 as the first Blink version', t => {
  t.deepEqual(
    uaHints(chromeUA('Windows NT 10.0; Win64; x64', '27.0.1453.93')),
    {}
  )
  t.true(
    'sec-ch-ua' in
      uaHints(chromeUA('Windows NT 10.0; Win64; x64', '28.0.1500.71'))
  )
})

test('a tab can separate a platform from its version', t => {
  t.is(
    uaHints(chromeUA('Windows NT\t10.0'))['sec-ch-ua-platform-version'],
    '"10"'
  )
  t.is(
    uaHints(chromeUA('Macintosh; Intel Mac OS X\t10_15_7'))[
      'sec-ch-ua-platform-version'
    ],
    '"10.15.7"'
  )
  const cros = uaHints(chromeUA('X11; CrOS x86_64\t14541.0.0'))
  t.is(cros['sec-ch-ua-platform'], '"Chrome OS"')
  t.is(cros['sec-ch-ua-platform-version'], '"14541.0.0"')
  const crosBoard = uaHints(chromeUA('X11; CrOS\tx86_64 14541.0.0'))
  t.is(crosBoard['sec-ch-ua-platform'], '"Chrome OS"')
  const android = uaHints(
    chromeUA('Linux; Android\t14; Pixel 8', '120.0.0.0', 'Mobile Safari/537.36')
  )
  t.is(android['sec-ch-ua-platform-version'], '"14"')
  t.is(android['sec-ch-ua-model'], '"Pixel 8"')
  t.is(
    uaHints(
      chromeUA(
        'iPhone; CPU iPhone OS\t17_0 like Mac OS X',
        '120.0.0.0',
        'Mobile Safari/537.36'
      )
    )['sec-ch-ua-platform-version'],
    '"17.0"'
  )
})

test('reads a Windows version with no space after NT', t => {
  const headers = uaHints(
    'Mozilla/5.0 (Windows NT10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  )
  t.is(headers['sec-ch-ua-platform'], '"Windows"')
  t.is(headers['sec-ch-ua-platform-version'], '"10"')
})

test('Android with no version is still Android', t => {
  const headers = uaHints(
    'Mozilla/5.0 (Linux; Android) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  )
  t.is(headers['sec-ch-ua-platform'], '"Android"')
  t.false('sec-ch-ua-platform-version' in headers)
})

test('Linux wins when the user agent also names a BSD', t => {
  const headers = uaHints(chromeUA('X11; Linux FreeBSD'))
  t.is(headers['sec-ch-ua-platform'], '"Linux"')
})

test('maps every Windows NT version', t => {
  const versions = [
    ['10.0', '10'],
    ['6.4', '10'],
    ['6.3', '8.1'],
    ['6.2', '8'],
    ['6.1', '7'],
    ['6.0', 'Vista'],
    ['5.2', 'XP'],
    ['5.1', 'XP'],
    ['5.0', '2000'],
    ['4.0', '4.0'],
    ['6.1.7601', '7'],
    ['10.0.19041', '10']
  ]

  for (const [nt, platformVersion] of versions) {
    const headers = uaHints(chromeUA(`Windows NT ${nt}`))
    t.is(
      headers['sec-ch-ua-platform-version'],
      JSON.stringify(platformVersion),
      nt
    )
  }
})

test('iPod is a phone', t => {
  // `CPU OS`, not `CPU iPhone OS`: the iPhone token would satisfy the iOS
  // alternation without the iPod branch.
  const headers = uaHints(chromeUA('iPod; CPU OS 15_0 like Mac OS X'))
  t.is(headers['sec-ch-ua-platform'], '"iOS"')
  t.is(headers['sec-ch-ua-platform-version'], '"15.0"')
  t.is(headers['sec-ch-ua-model'], '"iPod"')
  t.is(headers['sec-ch-ua-mobile'], '?1')
  t.is(headers['sec-ch-ua-form-factors'], '["Mobile"]')
})

test('an Apple device without an OS version is still iOS', t => {
  const cases = [
    ['iPhone; CPU iPhone OS like Mac OS X', '"iPhone"', '["Mobile"]'],
    ['iPad; CPU OS like Mac OS X', '"iPad"', '["Tablet"]'],
    ['iPod; CPU iPhone OS like Mac OS X', '"iPod"', '["Mobile"]'],
    ['iPhone', '"iPhone"', '["Mobile"]'],
    ['iPad', '"iPad"', '["Tablet"]']
  ]

  for (const [platform, model, formFactor] of cases) {
    const headers = uaHints(
      chromeUA(platform, '120.0.0.0', 'Mobile Safari/537.36')
    )
    t.is(headers['sec-ch-ua-platform'], '"iOS"', platform)
    t.false('sec-ch-ua-platform-version' in headers, platform)
    t.is(headers['sec-ch-ua-model'], model, platform)
    t.is(headers['sec-ch-ua-form-factors'], formFactor, platform)
  }
})

test('reads an Apple device at the start of the string and after a semicolon', t => {
  const tail =
    ' AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
  const cases = [
    [
      `iPhone; CPU iPhone OS 17_0 like Mac OS X)${tail}`,
      '"iPhone"',
      '["Mobile"]',
      '?1'
    ],
    [`iPad; CPU OS 17_0 like Mac OS X)${tail}`, '"iPad"', '["Tablet"]', '?0'],
    [
      `; iPod; CPU iPhone OS 17_0 like Mac OS X)${tail}`,
      '"iPod"',
      '["Mobile"]',
      '?1'
    ]
  ]

  for (const [userAgent, model, formFactor, mobile] of cases) {
    const headers = uaHints(userAgent)
    t.is(headers['sec-ch-ua-platform'], '"iOS"', userAgent)
    t.is(headers['sec-ch-ua-platform-version'], '"17.0"', userAgent)
    t.is(headers['sec-ch-ua-model'], model, userAgent)
    t.is(headers['sec-ch-ua-form-factors'], formFactor, userAgent)
    t.is(headers['sec-ch-ua-mobile'], mobile, userAgent)
  }
})

test('a field token can follow a semicolon with no space', t => {
  const tail =
    ' AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
  const iphone = uaHints(`;iPhone; CPU iPhone OS 17_0 like Mac OS X)${tail}`)
  t.is(iphone['sec-ch-ua-platform'], '"iOS"')
  t.is(iphone['sec-ch-ua-model'], '"iPhone"')

  const android = uaHints(`Mozilla/5.0 (;Android 14; Pixel 8)${tail}`)
  t.is(android['sec-ch-ua-platform'], '"Android"')
  t.is(android['sec-ch-ua-platform-version'], '"14"')
  t.is(android['sec-ch-ua-model'], '"Pixel 8"')

  const harmony = uaHints(`Mozilla/5.0 (;HarmonyOS)${tail}`)
  t.is(harmony['sec-ch-ua-platform'], '"HarmonyOS"')

  const tabbed = uaHints(`;\tiPhone; CPU iPhone OS 17_0 like Mac OS X)${tail}`)
  t.is(tabbed['sec-ch-ua-platform'], '"iOS"')
  t.is(tabbed['sec-ch-ua-model'], '"iPhone"')
  t.is(tabbed['sec-ch-ua-form-factors'], '["Mobile"]')

  const tabAndroid = uaHints(`Mozilla/5.0 (;\tAndroid 14; Pixel 8)${tail}`)
  t.is(tabAndroid['sec-ch-ua-platform'], '"Android"')
  t.is(tabAndroid['sec-ch-ua-platform-version'], '"14"')
  t.is(tabAndroid['sec-ch-ua-model'], '"Pixel 8"')

  const tabHarmony = uaHints(`Mozilla/5.0 (;\tHarmonyOS)${tail}`)
  t.is(tabHarmony['sec-ch-ua-platform'], '"HarmonyOS"')
})

test('reads Android at the start of the string and after an opening parenthesis', t => {
  const atStart =
    'Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
  const paren = chromeUA(
    'Android 14; Pixel 8',
    '120.0.0.0',
    'Mobile Safari/537.36'
  )

  for (const userAgent of [atStart, paren]) {
    const headers = uaHints(userAgent)
    t.is(headers['sec-ch-ua-platform'], '"Android"', userAgent)
    t.is(headers['sec-ch-ua-platform-version'], '"14"', userAgent)
    t.is(headers['sec-ch-ua-model'], '"Pixel 8"', userAgent)
  }
})

test('WebView requires the closing parenthesis after wv', t => {
  const headers = uaHints(
    'Mozilla/5.0 (Linux; Android 13; wv Build/X) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
  )
  t.true(headers['sec-ch-ua'].includes('"Google Chrome"'))
  t.false(headers['sec-ch-ua'].includes('"Chrome WebView"'))
})

test('Electron without a following Safari token is Chrome', t => {
  const headers = uaHints(
    chromeUA('Windows NT 10.0; Win64; x64', '120.0.0.0', 'Electron/39.5.1')
  )
  t.true(headers['sec-ch-ua'].includes('"Google Chrome"'))
  t.false(headers['sec-ch-ua'].includes('"Electron"'))
})

test('names every embedder in the product table', t => {
  const cases = [
    ['EdgiOS/120.0.2210.61', 'Microsoft Edge', '120.0.2210.61'],
    ['OPRGX/90.0.4480.84', 'Opera GX', '90.0.4480.84'],
    ['OPX/90.0.4480.84', 'Opera GX', '90.0.4480.84'],
    ['AVG/1.2.3.4', 'AVG Secure Browser', '1.2.3.4'],
    ['Avast/1.2.3.4', 'Avast Secure Browser', '1.2.3.4'],
    ['Norton/1.2.3.4', 'Norton Private Browser', '1.2.3.4'],
    ['Maxthon/7.0.1.0', 'Maxthon', '7.0.1.0'],
    ['QQBrowser/12.1.0.0', 'QQBrowser', '12.1.0.0'],
    ['UCBrowser/13.4.0.1306', 'UCBrowser', '13.4.0.1306'],
    ['Iron/120.0.0.0', 'Iron', '120.0.0.0'],
    ['Dragon/120.0.0.0', 'Dragon', '120.0.0.0'],
    ['Sleipnir/6.4.1', 'Sleipnir', '6.4.1'],
    ['QuarkPC/4.0.1.0', 'Quark', '4.0.1.0'],
    ['HuaweiBrowser/14.0.0.301', 'Huawei Browser', '14.0.0.301'],
    ['MQQBrowser/13.3.0', 'QQBrowser', '13.3.0'],
    ['MiuiBrowser/17.4.0', 'MIUI Browser', '17.4.0'],
    ['HeyTapBrowser/40.8.7.1', 'HeyTap', '40.8.7.1'],
    ['VivoBrowser/21.0.0.0', 'Vivo Browser', '21.0.0.0'],
    ['MicroMessenger/8.0.49', 'WeChat', '8.0.49'],
    ['KAKAOTALK/10.6.2', 'KAKAOTALK', '10.6.2'],
    ['FBAV/440.0.0.29.112', 'Facebook', '440.0.0.29.112'],
    ['Instagram 300.0.0.0.0', 'Instagram', '300.0.0.0.0'],
    ['Snapchat/12.80.0.32', 'Snapchat', '12.80.0.32'],
    ['Zalo android/24.01.01', 'Zalo', '24.01.01'],
    ['musical_ly_99.0 app_version/32.1.1', 'TikTok', '32.1.1'],
    ['trill_99.0 app_version/32.1.1', 'TikTok', '32.1.1'],
    ['musical_ly_32.1.1', 'TikTok', '32.1.1'],
    ['trill_32.1.1', 'TikTok', '32.1.1']
  ]

  for (const [token, brand, version] of cases) {
    const userAgent = chromeUA(
      'Windows NT 10.0; Win64; x64',
      '120.0.0.0',
      `Safari/537.36 ${token}`
    )
    const headers = uaHints(userAgent)
    t.true(headers['sec-ch-ua'].includes(JSON.stringify(brand)), token)
    t.is(headers['sec-ch-ua-full-version'], JSON.stringify(version), token)
  }
})

test('rejects every non-Blink engine token', t => {
  const userAgents = [
    'Mozilla/5.0 AppleWebKit/605.1.15 Version/17.0',
    'Opera/9.80 (Windows NT 6.1) Presto/2.12.388 Version/12.17',
    'Mozilla/5.0 Gecko/20100101 Firefox/100.0',
    'Mozilla/5.0 rv:1.9.2) Gecko',
    'SAMSUNG-GT-S5230/S5230RFJK1 NetFront/3.5',
    'Mozilla/5.0 (compatible; Konqueror/4.4; Linux) KHTML/4.4.0',
    'Links/2.29 (Linux)',
    'ELinks/0.13.5',
    'Lynx/2.8.9rel.1 libwww-FM/2.14',
    'w3m/0.5.3',
    'Dillo/3.0.5',
    'iCab/6.0',
    'Ladybird/1.0',
    'Mozilla/5.0 Goanna/6.2'
  ]

  for (const userAgent of userAgents) {
    t.deepEqual(uaHints(userAgent), {}, userAgent)
  }
})
