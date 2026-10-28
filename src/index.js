'use strict'

const parseUserAgent = require('./parse-user-agent')

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

const CACHE_SIZE = 1000

// Whole tokens only. `arm` inside HarmonyOS, and `x64` inside a model, are not the CPU.
// `Win64` is the Windows edition, so it does not make an x86 or armv7l CPU 64-bit.
const BOUND = '(?:^|[^a-z0-9])'
const TAIL = '(?:[^a-z0-9]|$)'
const ARM = new RegExp(`${BOUND}(?:aarch64|arm(?:64|v\\d+l?)?)${TAIL}`)
// `x86_64` matches as `x86` because `_` is a token boundary. Bitness still reads `x86_64`.
const X86 = new RegExp(`${BOUND}(?:x86|i686|i386|amd64|x64)${TAIL}`)
const SIXTY_FOUR_BIT = new RegExp(
  `${BOUND}(?:arm64|aarch64|x86_64|amd64|x64)${TAIL}`
)
const WOW64 = new RegExp(`${BOUND}wow64${TAIL}`)

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

  // A negative major is finite and JS `%` is signed (`BRAND_ORDERS[-1]`).
  // `Infinity % n` is `NaN`, so that index is `undefined`. Both become 0.
  const parsed = parseInt(chromiumFullVersion, 10)
  const seed = Number.isFinite(parsed) ? Math.max(0, parsed) : 0

  // Chromium-branded builds leave the additional product brand unset and emit
  // only GREASE + Chromium (see GenerateBrandVersionList's `else` branch).
  // Treating "Chromium" as a third brand duplicates it and breaks fingerprinting.
  if (brand === 'Chromium') {
    const grease = greaseBrandVersion(seed)
    const chromium = { brand: 'Chromium', fullVersion: chromiumFullVersion }
    return seed % 2 === 0 ? [grease, chromium] : [chromium, grease]
  }

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

const getHints = userAgent => {
  const userAgentData = parseUserAgent(userAgent)

  // User-Agent Client Hints are a Chromium feature. Firefox, Safari, and
  // other non-Blink browsers send none of these headers.
  if (!userAgentData) return {}

  const {
    brand,
    brandFullVersion,
    chromiumFullVersion,
    platform,
    platformVersion,
    model,
    formFactor,
    userAgent: limitedUserAgent
  } = userAgentData

  const uaLower = limitedUserAgent.toLowerCase()

  const brandList = generateBrandVersionList(
    brand,
    brandFullVersion,
    chromiumFullVersion
  )

  const { arch, bitness } = getArchAndBitness(uaLower)

  const deviceModel =
    model.toLowerCase() === REDUCED_UA_MODEL.toLowerCase() ? '' : model

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

  if (brandFullVersion) {
    hints['sec-ch-ua-full-version'] = quote(brandFullVersion)
    hints['sec-ch-ua-full-version-list'] = serializeBrands(brandList)
  }

  hints['sec-ch-ua-wow64'] = WOW64.test(uaLower) ? '?1' : '?0'
  hints['sec-ch-ua-form-factors'] = JSON.stringify([formFactor])

  return hints
}

const cache = new Map()

module.exports = input => {
  const userAgent = typeof input === 'string' ? input : ''

  let hints = cache.get(userAgent)
  if (hints !== undefined) {
    // Reinsert the hit so it becomes the newest entry.
    cache.delete(userAgent)
  } else {
    hints = getHints(userAgent)
    if (cache.size === CACHE_SIZE) cache.delete(cache.keys().next().value)
  }
  cache.set(userAgent, hints)

  return { ...hints }
}
