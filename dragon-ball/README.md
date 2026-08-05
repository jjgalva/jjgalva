# ⚡ Dragon Ball · Comparador de Poder

Página web de fans donde eliges dos personajes de Dragon Ball, sus transformaciones,
y descubres quién es más fuerte.

**🌐 Página publicada:** https://jjgalva.github.io/jjgalva/

## Qué hace

- **17 personajes**: Goku, Vegeta, Gohan, Piccolo, Freezer, Cell, Majin Buu,
  Trunks del Futuro, Broly, Gotenks, Gogeta, Vegetto, Krilin, Beerus, Jiren,
  Whis y Zeno-sama.
- **59 formas seleccionables** con su imagen propia: cada tarjeta tiene un
  desplegable de transformaciones (por ejemplo, Goku va de Base a Ultra Instinto
  pasando por SSJ, SSJ2, SSJ3, SSJ4 y Blue) y el avatar cambia al elegirla.
- **Comparador**: seleccionas dos personajes, pulsas **¡LUCHAR!** y un modal
  declara al ganador según su nivel de poder, con cuántas veces supera al rival
  y barras de poder animadas (escala logarítmica). El ganador brilla con un aura
  dorada. Hay mensajes distintos según lo reñido del combate, y empate si los
  poderes coinciden.
- Detalles con cariño: la fusión fallida de Gotenks (gordo, poder 500) y
  Zeno-sama con poder 999.999.999.999 — puede borrar universos, no hay pelea.

## Cómo se usa

Es una página estática sin dependencias: abre `index.html` en cualquier
navegador y funciona (también sin internet — las imágenes son locales).

Para desarrollarla en tu computadora:

```bash
git clone https://github.com/jjgalva/jjgalva.git
cd jjgalva/dragon-ball
# abre index.html en el navegador, o sirve la carpeta:
python3 -m http.server 8000   # → http://localhost:8000
```

## Estructura

```
dragon-ball/
├── index.html   # Toda la app: HTML + CSS + JS en un solo archivo
├── img/         # 56 imágenes WebP (~2 MB): una por personaje y transformación
└── README.md
```

Los datos viven en el array `CHARACTERS` dentro de `index.html`. Cada personaje
tiene `id`, `name`, `race`, `emoji` (respaldo si una imagen falla), `color`
(degradado del avatar) y una lista `forms` con `{ name, power, img }`.

**Añadir un personaje o transformación** = añadir su imagen a `img/` y una
entrada en ese array. Nada más.

## Niveles de poder

Escala relativa inventada para el juego, inspirada en el manga, el anime y las
guías oficiales (los "niveles de poder" canónicos dejaron de tener sentido tras
la saga de Freezer 😄). Se editan en el campo `power` de cada forma.

## Publicación

La página se publica automáticamente en GitHub Pages: el workflow
`.github/workflows/deploy-pages.yml` despliega la carpeta `dragon-ball/` en cada
push a la rama principal que la modifique. No hay que hacer nada manual.

## Créditos de las imágenes

Arte oficial de los juegos *Dragon Ball Z Dokkan Battle* y *Dragon Ball
Legends* (© Bandai Namco / Akatsuki), obtenido de archivos de assets públicos y
procesado (recorte + WebP 400px) para uso en esta página de fans.

Página de fans sin ánimo de lucro. Dragon Ball es obra de Akira Toriyama.
