import assert from 'node:assert/strict'
import test from 'node:test'
import { nextIndex } from '../src/player.js'

test('advances in order and stops at the end unless repeat is enabled', () => {
  const normal = { repeat: false, shuffle: false }
  assert.equal(nextIndex(0, 3, 1, normal), 1)
  assert.equal(nextIndex(2, 3, 1, normal), -1)
  assert.equal(nextIndex(2, 3, 1, { ...normal, repeat: true }), 0)
  assert.equal(nextIndex(0, 3, -1, { ...normal, repeat: true }), 2)
  assert.equal(nextIndex(-1, 0, 1, normal), -1)
})
test('shuffle selects a different track at either end of its random range', () => {
  const random = { repeat: false, shuffle: true }
  assert.equal(nextIndex(2, 3, 1, random, () => 0), 0)
  assert.equal(nextIndex(2, 3, 1, random, () => .99), 1)
})
