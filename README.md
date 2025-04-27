# ua-hints

![Last version](https://img.shields.io/github/tag/kikobeats/ua-hints.svg?style=flat-square)
[![Coverage Status](https://img.shields.io/coveralls/kikobeats/ua-hints.svg?style=flat-square)](https://coveralls.io/github/kikobeats/ua-hints)
[![NPM Status](https://img.shields.io/npm/dm/ua-hints.svg?style=flat-square)](https://www.npmjs.org/package/ua-hints)

> It generates [Sec-CH-UA-*](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers#user_agent_client_hints) headers for the provided `'user-agent'`.

## Install

```bash
$ npm install ua-hints --save
```

## Usage

Giving an user agent as input, such as:

> Mozilla/5.0 (Windows NT 10.0; Win64; x64; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.109 Safari/537.36

This library returns The [User-Agent Client Hints](https://wicg.github.io/ua-client-hints/#sec-ch-ua) detected:

```js
const uaHints = require('ua-hints')

uaHint('Mozilla/5.0 (Windows NT 10.0; Win64; x64; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.109 Safari/537.36')
// {
//   'sec-ch-ua': '"Chrome";v="120"',
//   'sec-ch-ua-mobile': '?0',
//   'sec-ch-ua-platform': '"Windows"',
//   'sec-ch-ua-platform-version': '"10"',
//   'sec-ch-ua-arch': '"x86"',
//   'sec-ch-ua-bitness': '"64"',
//   'sec-ch-ua-full-version': '"120.0.6099.109"',
//   'sec-ch-ua-full-version-list': '"Chrome";v="120.0.6099.109"',
//   'sec-ch-ua-wow64': '?1',
//   'sec-ch-ua-form-factors': '["Desktop"]'
// }
```

The library implementing Chromium GREASE[(¹)](https://stackoverflow.com/a/64443187)[(²)](https://github.com/chromium/chromium/commit/19ad8d3cab21013ce2d40cf2ec84267bb04b08ec) includes intentionally incorrect data to prevent ossification attacks.

## License

**ua-hints** © [Kiko Beats](https://kikobeats.com), released under the [MIT](https://github.com/kikobeats/ua-hints/blob/master/LICENSE.md) License.<br>
Authored and maintained by [Kiko Beats](https://kikobeats.com) with help from [contributors](https://github.com/kikobeats/ua-hints/contributors).

> [kikobeats.com](https://kikobeats.com) · GitHub [Kiko Beats](https://github.com/kikobeats) · Twitter [@kikobeats](https://twitter.com/kikobeats)
