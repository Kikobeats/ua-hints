'use strict'

const VERSION = '(-?[\\d.]+)'

const FIRST_BLINK_MAJOR = 28

const MAX_USER_AGENT_LENGTH = 500

const EDGE_HTML = /\bEdge\/\d/i
const BLINK = /AppleWebKit\/537\.36\b.*?\b(?:Headless)?Chrome\/(-?[\w.]+)/i

const OTHER_ENGINES =
  /webkit\/|trident\/|msie |presto\/|\bgecko\/|rv:[^)]*\) gecko|netfront|khtml\/|\b(?:e?links ?[/(]|lynx\/|w3m\/|dillo\/|icab|ladybird\/|goanna\/)/i

const product = (pattern, brand) => ({
  pattern: new RegExp(pattern.replace('VERSION', VERSION), 'i'),
  brand
})

const BROWSERS = [
  product('\\bEdg(?:A|iOS)?/VERSION', 'Microsoft Edge'),
  product('\\b(?:OPRGX|OPX)/VERSION', 'Opera GX'),
  product('\\bOPR/VERSION', 'Opera'),
  product('\\bYaBrowser/VERSION', 'Yandex'),
  product('\\bOculusBrowser/VERSION', 'Oculus Browser'),
  product('\\bSamsungBrowser/VERSION', 'Samsung Internet'),
  product('\\bElectron/VERSION Safari/', 'Electron'),
  product('\\bHeadlessChrome/VERSION', 'HeadlessChrome'),
  product('\\bChromium/VERSION', 'Chromium'),
  product('\\bVivaldi/VERSION', 'Vivaldi'),
  product('\\bWhale/VERSION', 'Whale'),
  product('\\bSilk/VERSION', 'Silk'),
  product('\\bDuckDuckGo/VERSION', 'DuckDuckGo'),
  product('\\bAVG/VERSION', 'AVG Secure Browser'),
  product('\\bAvast/VERSION', 'Avast Secure Browser'),
  product('\\bNorton/VERSION', 'Norton Private Browser'),
  product('\\bMaxthon/VERSION', 'Maxthon'),
  product('\\bQQBrowser/VERSION', 'QQBrowser'),
  product('\\bUCBrowser/VERSION', 'UCBrowser'),
  product('\\bIron/VERSION', 'Iron'),
  product('\\bDragon/VERSION', 'Dragon'),
  product('\\bSleipnir/VERSION', 'Sleipnir'),
  product('\\bQuarkPC/VERSION', 'Quark'),
  product('\\bHuaweiBrowser/VERSION', 'Huawei Browser'),
  product('\\bMQQBrowser/VERSION', 'QQBrowser'),
  product('\\bMiuiBrowser/VERSION', 'MIUI Browser'),
  product('\\bHeyTapBrowser/VERSION', 'HeyTap'),
  product('\\bVivoBrowser/VERSION', 'Vivo Browser'),
  product('\\bMicroMessenger/VERSION', 'WeChat'),
  product('\\bKAKAOTALK/VERSION', 'KAKAOTALK'),
  product('\\bFBAV/VERSION', 'Facebook'),
  product('\\b(?:musical_ly|trill)_.*?\\bapp_version/VERSION', 'TikTok'),
  product('\\b(?:musical_ly|trill)_VERSION', 'TikTok'),
  product('\\bInstagram VERSION', 'Instagram'),
  product('\\bSnapchat/VERSION', 'Snapchat'),
  product('\\bZalo android/VERSION', 'Zalo'),
  product('; wv\\).*?\\bChrome/VERSION', 'Chrome WebView'),
  product('\\bAndroid\\b.*?\\bVersion/VERSION.*?\\bChrome/', 'Android Browser'),
  product('\\bChrome/VERSION', 'Google Chrome')
]

const NO_BROWSER = { brand: '', brandFullVersion: '' }

const WINDOWS_VERSIONS = {
  '10.0': '10',
  6.4: '10',
  6.3: '8.1',
  6.2: '8',
  6.1: '7',
  '6.0': 'Vista',
  5.2: 'XP',
  5.1: 'XP',
  '5.0': '2000'
}

const WINDOWS = /Windows NT ?([\d.]*)/i
const HARMONY = /(?:^|[(;] ?)HarmonyOS\b/i
const ANDROID = /(?:^|[(;] ?)Android\b(?: ([\d.]+))?/i
const CHROME_OS = /CrOS \S+ ([\d.]+)/i
const IOS = /\b(?:iPhone|iPad|iPod)\b.*?\bi?OS ([\d_.]+)/i
const BSD = /\b(Free|Open|Net)BSD\b/i
const MAC_OS = /Mac OS X(?: ([\d_.]+))?/i
const CFNETWORK = /CFNetwork\//i
const MACINTOSH = /Macintosh/i
const UBUNTU = /Ubuntu/i
const LINUX = /Linux/i

// `match[0]` keeps the caller's casing. Hints use Chromium's names.
const BSD_PLATFORM = { free: 'FreeBSD', open: 'OpenBSD', net: 'NetBSD' }

const APPLE_DEVICE = /\((iPhone|iPad|iPod)/i
// The device field follows the Android version. Skip a `U;` marker, a locale
// (`zh-CN`, `zh_CN`, `es-419`), `HarmonyOS`, and Samsung's vendor prefix.
// A later `Build/` or `HMSCore/` token is firmware, not the device name.
const ANDROID_MODEL =
  /(?:^|[(;] ?)Android\b[^;)]*;(?: U;)?(?: [a-z]{2,3}[-_](?:[a-z]{2}|\d{3});)?(?: HarmonyOS;)?(?: SAMSUNG)? ((?:[^;()/]|\([^;()/]*\))+?)(?: [^\s;()]*\/[^;)]*)?[;)]/i
const IGNORED_MODEL = /^(?:wv|harmonyos)$/i
const LOCALE_MODEL = /^[a-z]{2,3}[-_](?:[a-z]{2}|\d{3})$/i
const TABLET_SAFARI = /\/[\w.]+ Safari\//i
const MOBILE = /\bMobile\b/i

const dotted = version => version && version.replace(/_/g, '.')

const chromiumVersionOf = userAgent => {
  const blink = BLINK.exec(userAgent)
  return blink && parseInt(blink[1], 10) >= FIRST_BLINK_MAJOR ? blink[1] : ''
}

const browserOf = userAgent => {
  for (const { pattern, brand } of BROWSERS) {
    const match = pattern.exec(userAgent)
    if (match) return { brand, brandFullVersion: match[1] }
  }
  return NO_BROWSER
}

const platformOf = userAgent => {
  let match = WINDOWS.exec(userAgent)
  if (match) {
    const version = match[1]
    return {
      platform: 'Windows',
      platformVersion: WINDOWS_VERSIONS[version] || version
    }
  }
  if (HARMONY.test(userAgent)) return { platform: 'HarmonyOS' }
  match = ANDROID.exec(userAgent)
  if (match) return { platform: 'Android', platformVersion: match[1] }
  match = CHROME_OS.exec(userAgent)
  if (match) return { platform: 'Chrome OS', platformVersion: match[1] }
  match = IOS.exec(userAgent)
  if (match) return { platform: 'iOS', platformVersion: dotted(match[1]) }
  if (CFNETWORK.test(userAgent)) return { platform: 'iOS' }
  match = MAC_OS.exec(userAgent)
  if (match) return { platform: 'macOS', platformVersion: dotted(match[1]) }
  if (MACINTOSH.test(userAgent)) return { platform: 'macOS' }
  if (UBUNTU.test(userAgent)) return { platform: 'Ubuntu' }
  if (LINUX.test(userAgent)) return { platform: 'Linux' }
  match = BSD.exec(userAgent)
  if (match) return { platform: BSD_PLATFORM[match[1].toLowerCase()] }
  return {}
}

const appleDeviceOf = userAgent => {
  const match = APPLE_DEVICE.exec(userAgent)
  if (!match) return {}
  const model = match[1]
  return {
    model,
    formFactor: model.toLowerCase() === 'ipad' ? 'Tablet' : 'Mobile'
  }
}

const androidFormFactorOf = (userAgent, model) => {
  if (MOBILE.test(userAgent)) return 'Mobile'
  if (TABLET_SAFARI.test(userAgent)) return 'Tablet'
  return model ? 'Mobile' : 'Desktop'
}

const androidDeviceOf = userAgent => {
  const match = ANDROID_MODEL.exec(userAgent)
  const captured = match ? match[1] : ''
  const model =
    captured && !IGNORED_MODEL.test(captured) && !LOCALE_MODEL.test(captured)
      ? captured
      : ''
  return { model, formFactor: androidFormFactorOf(userAgent, model) }
}

const deviceOf = (userAgent, platform) => {
  if (platform === 'iOS') return appleDeviceOf(userAgent)
  if (platform === 'Android' || platform === 'HarmonyOS') {
    return androidDeviceOf(userAgent)
  }
  return {}
}

module.exports = input => {
  const userAgent = input.slice(0, MAX_USER_AGENT_LENGTH)
  const chromiumVersion = EDGE_HTML.test(userAgent)
    ? ''
    : chromiumVersionOf(userAgent)
  if (!chromiumVersion && OTHER_ENGINES.test(userAgent)) return undefined

  const { brand, brandFullVersion } = browserOf(userAgent)
  const { platform = '', platformVersion = '' } = platformOf(userAgent)
  const { model = '', formFactor = 'Desktop' } = deviceOf(userAgent, platform)

  return {
    brand,
    brandFullVersion,
    chromiumFullVersion: chromiumVersion || brandFullVersion,
    platform,
    platformVersion,
    model,
    formFactor,
    // Architecture and WOW64 are read in index.js. They have to see the same
    // prefix the expressions above already matched.
    userAgent
  }
}
