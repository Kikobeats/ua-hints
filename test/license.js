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

test('runtime dependencies keep the package MIT-compatible', t => {
  t.is(pkg.license, 'MIT')
  for (const name of Object.keys(pkg.dependencies || {})) {
    t.false(COPYLEFT.test(licenseOf(name)), `${name} is ${licenseOf(name)}`)
  }
})
