'use strict'

const UAParser = require('ua-parser-js')

const quote = value => JSON.stringify(value)

const majorVersion = version => version.split('.')[0]

// Chromium's reduced Android User-Agent freezes the device model to this
// literal placeholder rather than omitting it.
const REDUCED_UA_MODEL = 'K'

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

const FORM_FACTORS = { mobile: 'Mobile', tablet: 'Tablet' }

const OFFICIAL_BRANDS = {
  Chrome: 'Google Chrome',
  Edge: 'Microsoft Edge',
  Firefox: 'Mozilla Firefox',
  // ua-parser-js names this "Chrome Headless"; Chromium's brand token is
  // the single word HeadlessChrome (old headless / chrome-headless-shell).
  'Chrome Headless': 'HeadlessChrome'
}

const ARM = /arm|aarch64/
const X86 = /x86|i686|i386|amd64|x64/
const SIXTY_FOUR_BIT = /arm64|aarch64|x86_64|amd64|win64|x64/

const greaseBrandVersion = seed => ({
  brand: `Not${GREASE_CHARS[seed % GREASE_CHARS.length]}A${
    GREASE_CHARS[(seed + 1) % GREASE_CHARS.length]
  }Brand`,
  fullVersion: `${GREASE_VERSIONS[seed % GREASE_VERSIONS.length]}.0.0.0`
})

const generateBrandVersionList = (
  brand,
  brandFullVersion,
  chromiumFullVersion
) => {
  if (!brand) return []

  const seed = parseInt(chromiumFullVersion, 10) || 0
  const order = BRAND_ORDERS[seed % BRAND_ORDERS.length]

  const brandList = []
  brandList[order[0]] = greaseBrandVersion(seed)
  brandList[order[1]] = { brand: 'Chromium', fullVersion: chromiumFullVersion }
  brandList[order[2]] = { brand, fullVersion: brandFullVersion }

  return brandList
}

const serializeBrands = (brandList, versionOf = version => version) =>
  brandList
    .map(
      ({ brand, fullVersion }) =>
        `${quote(brand)};v=${quote(versionOf(fullVersion))}`
    )
    .join(', ')

const getArchAndBitness = uaLower => {
  const arch = ARM.test(uaLower) ? 'arm' : X86.test(uaLower) ? 'x86' : ''
  const bitness = arch && (SIXTY_FOUR_BIT.test(uaLower) ? '64' : '32')
  return { arch, bitness }
}

module.exports = userAgent => {
  // Missing / non-string UAs are common (absent User-Agent header). Treat them
  // like an empty string instead of throwing on `.toLowerCase()`.
  if (typeof userAgent !== 'string') userAgent = ''

  const parser = new UAParser(userAgent)
  const { name: browserName = '', version: browserFullVersion = '' } =
    parser.getBrowser()
  const { name: engine = '', version: engineFullVersion = '' } =
    parser.getEngine()
  const { name: platform = '', version: platformVersion = '' } = parser.getOS()
  const { model = '', type: deviceType = '' } = parser.getDevice()

  const uaLower = userAgent.toLowerCase()
  const formFactor = FORM_FACTORS[deviceType] || 'Desktop'

  // ua-parser-js prefixes mobile builds with `Mobile`, but a browser brands
  // itself the same on every platform.
  const browserBrand = browserName.replace(/^Mobile /, '')
  const officialBrand = OFFICIAL_BRANDS[browserBrand] || browserBrand

  // Chromium embedders report their own version as the browser version (Opera
  // 106) while the Chromium brand and the GREASE seed follow Blink (120).
  const chromiumFullVersion =
    engine === 'Blink' && engineFullVersion
      ? engineFullVersion
      : browserFullVersion

  const brandList = generateBrandVersionList(
    officialBrand,
    browserFullVersion,
    chromiumFullVersion
  )

  const { arch, bitness } = getArchAndBitness(uaLower)

  // Desktop user agents parse as model `Macintosh`, which no browser sends.
  const deviceModel =
    formFactor !== 'Desktop' && model !== REDUCED_UA_MODEL ? model : ''

  const hints = {}

  if (brandList.length) {
    hints['sec-ch-ua'] = serializeBrands(brandList, majorVersion)
  }

  // Tablets are `?0`: the form factor is what tells them apart from phones
  // once the User-Agent has been reduced.
  hints['sec-ch-ua-mobile'] = formFactor === 'Mobile' ? '?1' : '?0'

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

  if (deviceModel) {
    hints['sec-ch-ua-model'] = quote(deviceModel)
  }

  if (browserFullVersion) {
    hints['sec-ch-ua-full-version'] = quote(browserFullVersion)
    hints['sec-ch-ua-full-version-list'] = serializeBrands(brandList)
  }

  hints['sec-ch-ua-wow64'] = uaLower.includes('wow64') ? '?1' : '?0'
  hints['sec-ch-ua-form-factors'] = JSON.stringify([formFactor])

  return hints
}
