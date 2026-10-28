'use strict'

const test = require('ava').default

const uaHints = require('..')
const FIXTURES = require('./fixtures/hints.json')

test('top user agents produce the expected hints', t => {
  for (const { userAgent, hints } of FIXTURES) {
    t.deepEqual(uaHints(userAgent), hints, userAgent)
  }
})
