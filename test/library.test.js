import assert from 'node:assert/strict'
import test from 'node:test'
import { backupFile, parseBackup } from '../src/backup.js'
import { forYouQuery, homeFilters } from '../src/discovery.js'
import * as ops from '../src/library-ops.js'
import { cleanPrefs, cleanTrack, libraryOf, mergeLibraries, topArtists } from '../src/state.js'

const song = (id, artist = 'Ozuna', title = 'Canción ' + id) => ({ id: id.padEnd(11, 'x'), source: 'youtube', title, artist, image: '', duration: 200 })

test('drops damaged tracks and duplicates from stored data', () => {
  assert.equal(cleanTrack({ id: 'corto', source: 'youtube', title: 'x' }), null)
  assert.equal(cleanTrack({ source: 'youtube', id: 'abcdefghijk' }), null)
  assert.equal(cleanTrack({ id: 'abcdefghijk', source: 'otro', title: 'x' }), null)
  assert.equal(cleanTrack({ id: 'abcdefghijk', source: 'youtube', title: 'x', image: 'javascript:alert(1)' }).image, '')
  const prefs = cleanPrefs({ favorites: [song('a'), song('a'), null, 'texto', { id: 1 }], playlists: [{ id: 'p', name: '  Mía ', tracks: [song('b'), {}] }, { name: 'sin id' }] })
  assert.equal(prefs.favorites.length, 1)
  assert.deepEqual(prefs.playlists.map(p => [p.name, p.tracks.length]), [['Mía', 1]])
  assert.equal(prefs.provider, 'youtube')
})

test('keeps the old Audius preference and layout settings', () => {
  const prefs = cleanPrefs({ provider: 'audius', catalogVersion: 2, libraryLayout: 'grid', libraryOrder: 'name' })
  assert.deepEqual([prefs.provider, prefs.libraryLayout, prefs.libraryOrder], ['audius', 'grid', 'name'])
})

test('merging two devices keeps everything and respects deleted playlists', () => {
  const phone = cleanPrefs({ favorites: [song('a')], playlists: [{ id: 'p1', name: 'Gym', tracks: [song('a')], updatedAt: 5 }], removed: ['p3'] })
  const cloud = cleanPrefs({ favorites: [song('b')], playlists: [
    { id: 'p1', name: 'Gimnasio', tracks: [song('c')], updatedAt: 9 },
    { id: 'p2', name: 'Fiesta', tracks: [] },
    { id: 'p3', name: 'Borrada', tracks: [] }
  ] })
  const merged = mergeLibraries(libraryOf(phone), libraryOf(cloud))
  assert.deepEqual(merged.favorites.map(t => t.id[0]), ['a', 'b'])
  assert.deepEqual(merged.playlists.map(p => p.name), ['Gimnasio', 'Fiesta'])
  assert.deepEqual(merged.playlists[0].tracks.map(t => t.id[0]), ['c', 'a'])
  assert.deepEqual(merged.removed, ['p3'])
})

test('library operations update prefs and report a message', () => {
  const prefs = cleanPrefs({})
  assert.equal(ops.toggleFavorite(prefs, song('a')), 'Guardada en favoritas')
  assert.ok(ops.isFavorite(prefs, song('a')))
  assert.equal(ops.toggleFavorite(prefs, song('a')), 'Quitada de favoritas')
  const playlist = ops.createPlaylist(prefs, 'Mía', song('a'), 'p1')
  assert.equal(ops.addToPlaylist(prefs, 'p1', song('a')).changed, false)
  assert.equal(ops.addToPlaylist(prefs, 'p1', song('b')).message, 'Añadida a Mía')
  assert.ok(ops.removeFromPlaylist(prefs, 'p1', song('a')))
  assert.deepEqual(playlist.tracks.map(t => t.id[0]), ['b'])
  assert.equal(ops.saveArtist(prefs, song('a', 'Bad Bunny')).changed, true)
  assert.equal(ops.saveArtist(prefs, song('b', 'bad bunny')).changed, false)
  ops.deletePlaylist(prefs, 'p1')
  assert.deepEqual([prefs.playlists.length, prefs.removed], [0, ['p1']])
})

test('backup files round-trip and reject unrelated files', async () => {
  const prefs = cleanPrefs({ favorites: [song('a')], artists: [{ name: 'Ozuna' }] })
  const file = backupFile(libraryOf(prefs), '2.0.0', new Date('2026-11-27T00:00:00Z'))
  assert.equal(file.name, 'espotifay-biblioteca-2026-11-27.json')
  const restored = parseBackup(await file.text())
  assert.deepEqual(restored.favorites, prefs.favorites)
  assert.throws(() => parseBackup('no es json'), /no es una copia/)
  assert.throws(() => parseBackup('{"format":"espotifay-biblioteca","library":{}}'), /no tiene canciones/)
})

test('personal suggestions come from the most listened artists', () => {
  const prefs = cleanPrefs({ artists: [{ name: 'Karol G' }], favorites: [song('a', 'Ozuna, Farruko'), song('b', 'Ozuna')], recent: [song('c', 'Rauw Alejandro')] })
  assert.deepEqual(topArtists(prefs), ['Karol G', 'Ozuna', 'Rauw Alejandro'])
  assert.equal(forYouQuery(prefs, new Date(86_400_000 * 4)), 'Ozuna')
  assert.equal(forYouQuery(cleanPrefs({})), '')
  assert.deepEqual(homeFilters(prefs).slice(3).map(([, label]) => label), ['Karol G', 'Ozuna'])
})
