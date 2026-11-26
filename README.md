# Espotifay

PWA de música en español, con búsqueda, cola, favoritos, historial y playlists locales. Incluye reproductor de pantalla completa, Media Session y un encabezado sólido con espacio adicional para el área segura del iPhone.

[GitHub Pages](https://fravier3.github.io/Espotifay/)

## Catálogos

YouTube Music es el catálogo inicial desde la versión 1.1.0. El servicio de búsqueda en Vercel utiliza YouTube.js para consultar canciones. La PWA continúa publicada en GitHub Pages. El backend del catálogo está en `catalog-server/`.

La reproducción de estas canciones usa el reproductor incorporado de YouTube, que permanece visible. El cambio de catálogo no resuelve la reproducción con el iPhone bloqueado.

Audius sigue disponible desde Ajustes. Las playlists, favoritas y el historial anteriores se conservan en este dispositivo.

## Desarrollo

```sh
npm ci
npm test
npm run dev
npm run build
```

El workflow publica exclusivamente `dist/` en GitHub Pages.
