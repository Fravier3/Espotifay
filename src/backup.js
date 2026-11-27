// Exportar e importar la biblioteca como archivo JSON.
import { cleanLibrary, isEmptyLibrary } from './state.js'

const FORMAT = 'espotifay-biblioteca'

export function backupFile(library, version, now = new Date()) {
  const body = JSON.stringify({ format: FORMAT, version: 1, app: version, exportedAt: now.toISOString(), library: cleanLibrary(library) }, null, 2)
  const name = `espotifay-biblioteca-${now.toISOString().slice(0, 10)}.json`
  return new File([body], name, { type: 'application/json' })
}

/** Lee un archivo exportado y devuelve una biblioteca validada; lanza un error claro si no sirve. */
export function parseBackup(textContent) {
  let data
  try { data = JSON.parse(textContent) } catch { throw Error('El archivo no es una copia de Espotifay.') }
  const library = cleanLibrary(data?.format === FORMAT ? data.library : data)
  if (isEmptyLibrary(library)) throw Error('La copia no tiene canciones, playlists ni artistas.')
  return library
}

/** Comparte el archivo (iPhone/Android) o lo descarga si no se puede compartir. */
export async function deliverBackup(file) {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Biblioteca de Espotifay' })
      return 'shared'
    } catch (error) {
      if (error.name === 'AbortError') return 'cancelled'
    }
  }
  const url = URL.createObjectURL(file)
  const link = Object.assign(document.createElement('a'), { href: url, download: file.name })
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
  return 'downloaded'
}
