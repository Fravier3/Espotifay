import assert from 'node:assert/strict'
import test from 'node:test'
import { artworkSources } from '../src/artwork.js'

test('older library thumbnails request a 1200px original and keep a fallback', () => {
  const small = 'https://yt3.googleusercontent.com/artwork=w60-h60-l90-rj'
  assert.deepEqual(artworkSources({ image: small }), [
    'https://yt3.googleusercontent.com/artwork=w1200-h1200-l90-rj', small
  ])
})
test('maximum-resolution video thumbnails have a fallback', () => {
  const sources = artworkSources({ source: 'youtube', id: 'TiebZllW8As', image: 'https://i.ytimg.com/vi/TiebZllW8As/hqdefault.jpg' })
  assert.equal(sources[0], 'https://i.ytimg.com/vi/TiebZllW8As/maxresdefault.jpg')
  assert.equal(sources.length, 2)
})
test('unsafe artwork URLs are rejected', () => {
  assert.deepEqual(artworkSources({ image: 'javascript:alert(1)' }), [])
})
