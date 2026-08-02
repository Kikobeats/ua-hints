'use strict'

const UAParser = require('ua-parser-js')

const quote = str => `"${str.replace(/"/g, '\\"')}"`

const majorVersion = version => version.split('.')[0] || ''

// Chromium's reduced Android User-Agent freezes the device model to this
// literal placeholder. Real Chromium sends the actual model in the hint, so
// forwarding the placeholder invents a device that does not exist.
const REDUCED_UA_MODEL = 'K'

const CHROMIUM_ENGINE = 'Blink'

// GREASE tables from Chromium's GetGreasedUserAgentBrandVersion in
// components/embedder_support/user_agent_utils.cc
const GREASE_CHARS = [' ', '(', ':', '-', '.', '/', ')', ';', '=', '?', '_']
const GREASE_VERSIONS = ['8', '99', '24']

const BRAND_ORDERS = [
  [0, 1, 2],
  [0, 2, 1],
  [1, 0, 2],
  [1, 2, 0],
  [2, 0, 1],
  [2, 1, 0]
]

const greaseBrandVersion = seed => {
  const prefix = GREASE_CHARS[seed % GREASE_CHARS.length]
  const infix = GREASE_CHARS[(seed + 1) % GREASE_CHARS.length]
  const version = GREASE_VERSIONS[seed % GREASE_VERSIONS.length]

  return {
    brand: `Not${prefix}A${infix}Brand`,
    version,
    fullVersion: `${version}.0.0.0`
  }
}

const generateBrandVersionList = (
  seed,
  brand,
  brandFullVersion,
  chromiumFullVersion
) => {
  const order = BRAND_ORDERS[seed % BRAND_ORDERS.length]

  const grease = greaseBrandVersion(seed)
  const chromium = {
    brand: 'Chromium',
    version: majorVersion(chromiumFullVersion),
    fullVersion: chromiumFullVersion
  }

  const brandList = []

  if (brand) {
    brandList[order[0]] = grease
    brandList[order[1]] = chromium
    brandList[order[2]] = {
      brand,
      version: majorVersion(brandFullVersion),
      fullVersion: brandFullVersion
    }
  } else {
    brandList[seed % 2] = grease
    brandList[(seed + 1) % 2] = chromium
  }

  return brandList.filter(Boolean)
}

const getArchAndBitness = userAgent => {
  const uaLower = userAgent.toLowerCase()
  // ARM is matched first: Windows on ARM reports `Win64; ARM64`, so the x86
  // patterns would otherwise claim it.
  if (/arm64|aarch64/.test(uaLower)) return { arch: 'arm', bitness: '64' }
  if (/arm/.test(uaLower)) return { arch: 'arm', bitness: '32' }
  if (/x86_64|amd64|win64|x64/.test(uaLower)) { return { arch: 'x86', bitness: '64' } }
  if (/i686|i386|win32|x86/.test(uaLower)) return { arch: 'x86', bitness: '32' }
  return { arch: '', bitness: '' }
}

const brandsMap = {
  Chrome: 'Google Chrome',
  'Mobile Chrome': 'Google Chrome',
  Chromium: 'Chromium',
  'Mobile Chromium': 'Chromium',
  Edge: 'Microsoft Edge',
  Opera: 'Opera',
  Firefox: 'Mozilla Firefox',
  Safari: 'Safari'
}

module.exports = userAgent => {
  const parser = new UAParser(userAgent)
  const { name: browserBrand = '', version: browserFullVersion = '' } =
    parser.getBrowser()
  const { name: engine = '', version: engineFullVersion = '' } =
    parser.getEngine()
  const { name: platform = '', version: platformVersion = '' } = parser.getOS()
  const { model = '', type: deviceType = '' } = parser.getDevice()

  const isPhone = deviceType === 'mobile'
  const isTablet = deviceType === 'tablet'

  // Chromium embedders report their own version as the browser version (Opera
  // 106) while the Chromium brand and the GREASE seed follow Blink (120).
  const chromiumFullVersion =
    engine === CHROMIUM_ENGINE && engineFullVersion
      ? engineFullVersion
      : browserFullVersion

  const { arch, bitness } = getArchAndBitness(userAgent)
  const wow64 = userAgent.toLowerCase().includes('wow64') ? '?1' : '?0'
  const formFactors = isPhone
    ? '["Mobile"]'
    : isTablet
      ? '["Tablet"]'
      : '["Desktop"]'

  const officialBrand = brandsMap[browserBrand] || browserBrand || undefined

  const seed = parseInt(majorVersion(chromiumFullVersion), 10) || 0
  const brandList = generateBrandVersionList(
    seed,
    officialBrand,
    browserFullVersion,
    chromiumFullVersion
  )

  const hints = {}

  if (brandList.length) {
    hints['sec-ch-ua'] = brandList
      .map(({ brand, version }) => `${quote(brand)};v=${quote(version)}`)
      .join(', ')
  }

  // Chromium sends `?1` for phones only; tablets get `?0` plus the Tablet form
  // factor, which is how phone and tablet are told apart after UA reduction.
  hints['sec-ch-ua-mobile'] = isPhone ? '?1' : '?0'

  if (platform) {
    hints['sec-ch-ua-platform'] = quote(platform)
  }

  if (platformVersion) {
    hints['sec-ch-ua-platform-version'] = quote(platformVersion)
  }

  if (arch) {
    hints['sec-ch-ua-arch'] = quote(arch)
  }

  if (bitness) {
    hints['sec-ch-ua-bitness'] = quote(bitness)
  }

  // The model hint only exists for phones and tablets: desktop macOS UAs parse
  // as model `Macintosh`, which no browser ever sends.
  if (model && model !== REDUCED_UA_MODEL && (isPhone || isTablet)) {
    hints['sec-ch-ua-model'] = quote(model)
  }

  if (browserFullVersion) {
    hints['sec-ch-ua-full-version'] = quote(browserFullVersion)

    hints['sec-ch-ua-full-version-list'] = brandList
      .map(
        ({ brand, fullVersion }) => `${quote(brand)};v=${quote(fullVersion)}`
      )
      .join(', ')
  }

  hints['sec-ch-ua-wow64'] = wow64
  hints['sec-ch-ua-form-factors'] = formFactors

  return hints
}
