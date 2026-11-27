# Espotifay

PWA de música en español: búsqueda, cola, favoritas, historial, playlists y artistas guardados, con reproductor de pantalla completa y controles en la pantalla bloqueada (Media Session).

**App:** https://fravier3.github.io/Espotifay/

## Cómo está hecha

| Parte | Dónde | Qué hace |
| --- | --- | --- |
| PWA | `src/`, publicada en GitHub Pages | Interfaz, reproductor y biblioteca en el teléfono |
| Backend | `catalog-server/`, en Vercel (`espotifay-catalog-vercel-fran`) | Búsqueda en YouTube Music y respaldo del audio |
| Cuentas y nube | Supabase, proyecto **Desarollos Fran** | Tabla `espotifay_libraries` y registro sin correo |

### Módulos de la PWA

- `main.js`: arranque, vistas y mapa de acciones.
- `state.js`: validación de datos guardados, combinación de bibliotecas y artistas más escuchados.
- `library-ops.js`: operaciones de la biblioteca (favoritas, playlists, artistas).
- `sync.js`: cuenta opcional y sincronización con Supabase (la librería se carga solo cuando hace falta).
- `backup.js`: exportar e importar la biblioteca como archivo JSON.
- `catalog.js` y `player.js`: catálogos, resolución del audio y reproductor.
- `config.js`: URLs y claves públicas en un solo sitio (se pueden cambiar con `VITE_API_BASE`, `VITE_SUPABASE_URL` y `VITE_SUPABASE_KEY`).

## Datos del usuario

- Se guardan en el teléfono y la app pide al navegador que no los borre (`navigator.storage.persist`).
- **Ajustes → Copia de seguridad** exporta e importa un archivo con playlists, favoritas y artistas.
- **Ajustes → Tu cuenta** permite entrar o crear una cuenta (correo + contraseña de 6 caracteres o más, sin confirmar el correo). La biblioteca se sincroniza entre dispositivos; si hay cambios en dos dispositivos, se combinan sin perder canciones.
- Las cuentas son las mismas del proyecto Supabase: quien ya tenga cuenta en otra app de ese proyecto puede entrar con ella.

## Audio

La búsqueda usa YouTube.js. El audio sale de instancias de Invidious: la PWA intenta primero el enlace directo y, si falla, usa el respaldo `/api/media` del backend.

- Las instancias se configuran en Vercel con `INVIDIOUS_INSTANCES` (URLs HTTPS separadas por coma, en orden de preferencia). Si una falla, se pasa a la siguiente y la fallida descansa 5 minutos.
- `/api/media` solo atiende a la PWA (comprueba `Origin`/`Referer`) y limita cada conexión a 400 peticiones por hora (tabla `espotifay_private.media_limits`).
- La disponibilidad depende de esas instancias. Audius (desde Ajustes) siempre ofrece música independiente.

## Desarrollo

```sh
npm ci
npm test          # pruebas de la PWA y del backend
npm run dev
npm run build     # genera dist/, sw.js y version.json
```

Backend: `cd catalog-server && npm ci && npm test`. Se despliega en Vercel desde esa carpeta.

Supabase: el SQL aplicado está en `supabase/migrations/`.

## Publicación

El workflow `.github/workflows/pages.yml` prueba, compila y publica `dist/` en GitHub Pages en cada push a `main`. La versión sale de `package.json` y se muestra en Ajustes; la app se actualiza sola al abrirla o al volver a ella.
