'use strict'

const { readFileSync } = require('fs')
const path = require('path')
const test = require('ava').default

const pkg = require('../package.json')

const COPYLEFT = /GPL/i

const licenseOf = name =>
  JSON.parse(
    readFileSync(
      path.join(__dirname, '..', 'node_modules', name, 'package.json'),
      'utf8'
    )
  ).license

// Returns the offending dependency, so deleting the loop or the GPL check
// fails even when this package has no runtime dependencies.
const copyleftDependency = (names, readLicense) => {
  for (const name of names) {
    const license = readLicense(name)
    if (COPYLEFT.test(license)) return `${name} is ${license}`
  }
}

test('runtime dependencies keep the package MIT-compatible', t => {
  t.is(pkg.license, 'MIT')
  t.is(
    copyleftDependency(['ua-parser-js'], () => 'AGPL-3.0-or-later'),
    'ua-parser-js is AGPL-3.0-or-later'
  )
  t.is(
    copyleftDependency(['gpl-dep'], () => 'GPL-3.0-only'),
    'gpl-dep is GPL-3.0-only'
  )
  t.is(
    copyleftDependency(['lgpl-dep'], () => 'LGPL-2.1-only'),
    'lgpl-dep is LGPL-2.1-only'
  )
  t.is(
    copyleftDependency(['mit-dep'], () => 'MIT'),
    undefined
  )
  t.is(
    copyleftDependency(['apache-dep'], () => 'Apache-2.0'),
    undefined
  )
  t.is(
    copyleftDependency(['bsd-dep'], () => 'BSD-3-Clause'),
    undefined
  )
  t.is(
    copyleftDependency(Object.keys(pkg.dependencies || {}), licenseOf),
    undefined
  )
})
