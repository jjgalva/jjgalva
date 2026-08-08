# Radar Forense — AppLab

Plataforma interna de **análisis forense de campañas en redes sociales**. Dado un conjunto de
keywords/hashtags/menciones, recolecta posts públicos de X (Twitter), Instagram, TikTok y
Facebook con evidencia trazable (URL, timestamps, datos crudos y hash SHA-256), reconstruye la
cronología de la campaña, identifica su origen, calcula un score de bot auditable por cuenta,
detecta señales de coordinación y emite un **dictamen**: % estimado de actividad orgánica vs.
coordinada/automatizada — con reporte forense en PDF y Anexo de Evidencia en ZIP.

## Stack

- **Next.js 14 (App Router) + TypeScript** — frontend y API en el mismo proyecto
- **SQLite** (better-sqlite3) — persistencia local, cero servicios de paga
- **Tailwind CSS** — UI (modo oscuro, acentos `#7366FE` / `#FF66E5`)
- **Recharts** (series de tiempo) y **react-force-graph-2d** (grafo de difusión)
- **@react-pdf/renderer** (reporte PDF en el cliente) y **JSZip** (anexo de evidencia)
- **Apify** — ingesta de datos (plan gratis, $5 USD de créditos/mes)

## Setup

```bash
cd radar-forense
npm install
cp .env.example .env      # opcional: agrega tu APIFY_TOKEN
npm run dev               # http://localhost:3000
```

> Nota: `better-sqlite3` compila un binario nativo; con Node 18+ usa binarios
> pre-compilados y no requiere toolchain adicional.

## Modo mock (demo sin API keys)

**Sin `APIFY_TOKEN` el sistema corre automáticamente en modo mock** — no hay nada que
configurar. El botón **“Cargar caso demo”** de la portada ejecuta el análisis sobre una
campaña sintética pre-generada (`data/mock/*.json`): ~320 posts en 10 días contra un
desarrollo inmobiliario ficticio, donde ~40% proviene de un clúster de 22 cuentas bot
(creadas en la misma quincena, textos calcados, ráfagas sincronizadas, handles genéricos)
y ~60% de cuentas orgánicas, con paciente cero claro y 3 amplificadores grandes.

- El demo **nunca depende de la red**: si Apify falla o no hay token, la ingesta cae sola al mock.
- Para forzar el modo mock aunque exista token: `RADAR_MOCK=1` en `.env`.
- Para regenerar el dataset sintético (determinista): `npm run mock:generate`.
- El PDF y el ZIP de evidencia funcionan igual en modo mock.

## Cómo obtener el token de Apify

1. Crea una cuenta gratis en [apify.com](https://apify.com) (incluye $5 USD de créditos/mes).
2. Ve a **Settings → API & Integrations** ([console.apify.com/account/integrations](https://console.apify.com/account/integrations)).
3. Copia tu **Personal API token** y pégalo en `.env` como `APIFY_TOKEN=apify_api_...`.

Actors utilizados (los límites por corrida son agresivos para no quemar créditos):

| Plataforma | Actor | Límite |
|---|---|---|
| X (Twitter) | `apidojo/tweet-scraper` (Tweet Scraper V2) | 200 posts |
| Instagram | `apify/instagram-hashtag-scraper` | 100 posts |
| TikTok | `clockworks/tiktok-scraper` | 100 videos |
| Facebook | `apify/facebook-search-scraper` | 50 posts |

La búsqueda acepta **múltiples términos por corrida** (separados por coma) y deduplica los
resultados por URL, fusionando en `matched_terms` qué términos trajeron cada post.

## Estructura

```
radar-forense/
├── data/mock/            # campaña sintética pre-generada (demo)
├── scripts/generate-mock.mjs
└── src/
    ├── app/              # páginas y API routes (analyze, runs, run/[id], evidence ZIP)
    ├── components/       # dashboard: dictamen, cronología, volumen, grafo, clústeres, cuentas
    ├── lib/
    │   ├── criteria.ts   # ★ criterios auditables (pesos y umbrales, citados en el PDF)
    │   ├── botscore.ts   # score de bot 0-100 con flags
    │   ├── coordination.ts # clústeres, ráfagas, dictamen
    │   ├── timeline.ts   # eventos clave automáticos
    │   ├── graph.ts      # grafo de difusión de X
    │   ├── db.ts         # SQLite (data/radar.db)
    │   └── ingest/       # cliente Apify + normalización + mock
    └── report/ReportPDF.tsx  # reporte forense (react-pdf)
```

## Deploy en Vercel (plan gratis)

1. Sube el repo a GitHub e importa el proyecto en [vercel.com/new](https://vercel.com/new)
   (Root Directory: `radar-forense`).
2. Agrega la variable de entorno `APIFY_TOKEN` (o déjala vacía para demo en modo mock).
3. Deploy.

**Limitación conocida (documentada a propósito):** el filesystem de las funciones serverless
de Vercel es **efímero** — SQLite funciona durante la ejecución, pero las corridas no
persisten entre invocaciones ni entre deploys. Para el demo esto es suficiente (cada corrida
se analiza y exporta en el momento). **Producción requeriría una base de datos gestionada
(p. ej. Turso/libSQL, gratis en tier básico) — siguiente fase.** Para demos locales ante
cliente, `npm run dev` con la BD local es el camino recomendado.

## Valor probatorio

Cada post capturado conserva: URL, `posted_at` (plataforma), `collected_at` (captura, ISO
8601 UTC), el JSON crudo íntegro y su `raw_sha256`. El botón **“Exportar evidencia”** genera
un ZIP con un JSON por post, `manifest.csv` y `README_evidencia.txt` con la metodología y el
procedimiento de verificación de integridad.

> Este análisis caracteriza el comportamiento de cuentas públicas; no identifica personas
> físicas. No constituye asesoría legal.
