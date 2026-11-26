# Espotifay

PWA de música en español, con búsqueda, cola, favoritos, historial y playlists locales. Incluye reproductor de pantalla completa, Media Session y un encabezado sólido con espacio adicional para el área segura del iPhone.

[GitHub Pages](https://fravier3.github.io/Espotifay/)

## Catálogos

- **Audius** es el catálogo inicial. Ofrece pistas de su catálogo abierto mediante la API oficial.
- **YouTube vía Invidious** es una opción experimental en Ajustes. Requiere una instancia HTTPS externa que permita solicitudes desde GitHub Pages y entregue audio AAC/MP4. Busca videos en YouTube mediante Invidious, por lo que sus resultados pueden diferir de la búsqueda de YouTube Music de Metrolist. La aplicación no incluye una instancia propia.
- En el iPhone, hay que validar la reproducción al bloquear la pantalla y el salto a la siguiente pista usando la PWA instalada. Media Session integra controles del sistema donde el navegador los admite. La app conserva su interfaz offline, pero el streaming requiere conexión.

## Desarrollo

```sh
npm ci
npm test
npm run dev
npm run build
```

El workflow publica exclusivamente `dist/` en GitHub Pages.
