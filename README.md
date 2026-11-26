# Espotifay

PWA de música en español, con búsqueda, cola, favoritos, historial y playlists locales. Incluye reproductor de pantalla completa, Media Session y un encabezado sólido con espacio adicional para el área segura del iPhone.

[GitHub Pages](https://fravier3.github.io/Espotifay/)

## Catálogos

YouTube Music es el catálogo inicial desde la versión 1.1.0. Los botones y acentos usan verde desde la versión 1.2.0. El servicio de búsqueda en Vercel utiliza YouTube.js para consultar canciones. La PWA continúa publicada en GitHub Pages. El backend del catálogo está en `catalog-server/`.

La reproducción usa el elemento HTML audio con Media Session y el servidor Invidious utilizado en YuTub-Premium. La disponibilidad de pistas depende de esa instancia. En la validación del 26 de noviembre de 2026, la instancia respondió HTTP 403 al servidor y el audio no pudo validarse. La reproducción con pantalla bloqueada requiere verificación en un iPhone físico.

Audius sigue disponible desde Ajustes. Las playlists, favoritas y el historial anteriores se conservan en este dispositivo.

## Desarrollo

```sh
npm ci
npm test
npm run dev
npm run build
```

El workflow publica exclusivamente `dist/` en GitHub Pages.
