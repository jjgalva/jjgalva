/**
 * Reporte de Análisis Forense de Campaña Digital — PDF con @react-pdf/renderer.
 * Se genera 100% en el cliente (sin Puppeteer ni servicios externos).
 * Los criterios de la página de metodología se leen de lib/criteria.ts para
 * que el reporte siempre refleje la configuración real del análisis.
 */

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Svg,
  Circle,
  Path,
  Rect,
  Image,
} from "@react-pdf/renderer";
import type { AnalysisResult, TimelineEvent } from "@/lib/types";
import { PLATFORM_LABEL } from "@/lib/types";
import { BOT_CRITERIA, BOT_CLASSIFICATION, COORDINATION_CRITERIA } from "@/lib/criteria";
import { classify } from "@/lib/botscore";

const PRIMARY = "#7366FE";
const SECONDARY = "#FF66E5";
const DARK = "#0E0E1C";
const GRAY = "#5B5B70";

const s = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 64,
    paddingHorizontal: 52,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#1A1A2E",
  },
  h1: { fontSize: 18, fontFamily: "Helvetica-Bold", color: DARK, marginBottom: 4 },
  h2: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: PRIMARY,
    marginTop: 14,
    marginBottom: 6,
  },
  p: { lineHeight: 1.5, marginBottom: 6 },
  small: { fontSize: 8, color: GRAY },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 52,
    right: 52,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.5,
    borderTopColor: "#D8D8E4",
    paddingTop: 6,
    fontSize: 7.5,
    color: GRAY,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginBottom: 8 },
  statBox: {
    flexGrow: 1,
    flexBasis: "22%",
    borderWidth: 0.75,
    borderColor: "#E4E4F0",
    borderRadius: 6,
    padding: 8,
  },
  statValue: { fontSize: 16, fontFamily: "Helvetica-Bold", color: DARK },
  statLabel: { fontSize: 7, color: GRAY, marginTop: 2, textTransform: "uppercase" },
  tr: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#ECECF4",
    paddingVertical: 4,
  },
  th: { fontFamily: "Helvetica-Bold", fontSize: 8, color: GRAY, textTransform: "uppercase" },
  quote: {
    borderLeftWidth: 2,
    borderLeftColor: SECONDARY,
    backgroundColor: "#FAFAFE",
    padding: 6,
    marginBottom: 4,
    borderRadius: 3,
  },
});

function Footer() {
  return (
    <View style={s.footer} fixed>
      <Text>Radar Forense · AppLab · applab.mx · Confidencial</Text>
      <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
    </View>
  );
}

/**
 * Sanea texto dinámico para la fuente estándar Helvetica (WinAnsi):
 * elimina emojis y glifos fuera de Latin-1 (se verían como cajas vacías).
 */
const T = (s: string) =>
  s.replace(/[^\x20-\x7E\xA0-\xFF‐-―‘-‟…]/g, "").replace(/\s+/g, " ").trim();

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("es-MX", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC",
  }) + " UTC";
const fmtNum = (n: number) => n.toLocaleString("es-MX");

/** Hallazgos clave generados automáticamente a partir de los datos. */
export function buildKeyFindings(data: AnalysisResult): string[] {
  const out: string[] = [];
  const pz = data.timeline.find((e) => e.type === "paciente_cero");
  if (pz) {
    out.push(
      `La campaña inició el ${fmtDate(pz.at)} con la publicación de ${pz.description.split(":")[0]}.`
    );
  }
  const clusters = data.coordination.clusters;
  if (clusters.length > 0) {
    const biggest = [...clusters].sort((a, b) => b.accounts.length - a.accounts.length)[0];
    out.push(
      `Se identificaron ${clusters.length} clúster(es) de mensajes casi idénticos; el principal agrupa ` +
        `${biggest.accounts.length} cuentas con ${biggest.post_count} publicaciones calcadas` +
        (biggest.bursts[0]
          ? `, con una ráfaga de ${biggest.bursts[0].posts} posts en ${Math.max(biggest.bursts[0].minutes, 1)} minutos`
          : "") +
        `.`
    );
  }
  const burst = data.coordination.account_creation_burst;
  if (burst.detected && burst.window_start) {
    out.push(
      `${burst.accounts.length} de las cuentas participantes fueron creadas dentro de la misma ventana ` +
        `(a partir del ${fmtDate(burst.window_start)}), un patrón consistente con granjas de cuentas.`
    );
  }
  const peak = data.timeline.find((e) => e.type === "pico");
  if (peak) out.push(`${peak.title}, el ${fmtDate(peak.at)}.`);
  if (data.totals.bot_accounts > 0) {
    out.push(
      `${data.totals.bot_accounts} cuentas clasifican como probable bot (score > ${BOT_CLASSIFICATION.suspicious_max}) ` +
        `y ${data.totals.suspicious_accounts} adicionales como sospechosas.`
    );
  }
  return out.slice(0, 4);
}

export default function ReportPDF({
  data,
  graphImage,
}: {
  data: AnalysisResult;
  graphImage: string | null;
}) {
  const v = data.coordination.verdict;
  const findings = buildKeyFindings(data);
  const topAccounts = data.accounts.slice(0, 18);

  return (
    <Document
      title={`Reporte Forense ${data.run.id}`}
      author="Radar Forense · AppLab"
      language="es"
    >
      {/* ================= 1. PORTADA ================= */}
      <Page size="A4" style={{ backgroundColor: DARK, padding: 0 }}>
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: 5, backgroundColor: PRIMARY }} />
        <View style={{ position: "absolute", top: 5, left: 0, right: 0, height: 2, backgroundColor: SECONDARY }} />
        <View style={{ padding: 60, height: "100%", justifyContent: "space-between" }}>
          <View>
            <Text style={{ color: "#FFFFFF", fontSize: 11, letterSpacing: 3 }}>
              RADAR FORENSE · APPLAB
            </Text>
          </View>
          <View>
            <Svg width="70" height="70" viewBox="0 0 24 24" style={{ marginBottom: 24 }}>
              <Circle cx="12" cy="12" r="9" stroke={PRIMARY} strokeWidth={1} fill="none" />
              <Circle cx="12" cy="12" r="5" stroke={SECONDARY} strokeWidth={1} fill="none" />
              <Circle cx="12" cy="12" r="1.4" fill="#FFFFFF" />
            </Svg>
            <Text style={{ color: "#FFFFFF", fontSize: 26, fontFamily: "Helvetica-Bold", lineHeight: 1.25 }}>
              Reporte de Análisis Forense{"\n"}de Campaña Digital
            </Text>
            <View style={{ width: 90, height: 3, backgroundColor: SECONDARY, marginVertical: 18 }} />
            <Text style={{ color: "#B9B9D0", fontSize: 11, lineHeight: 1.7 }}>
              Términos analizados: {data.run.keywords.join("  ·  ")}
            </Text>
            <Text style={{ color: "#B9B9D0", fontSize: 11, lineHeight: 1.7 }}>
              Periodo observado: {fmtDate(data.totals.date_range.from)} — {fmtDate(data.totals.date_range.to)}
            </Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <View>
              <Text style={{ color: GRAY, fontSize: 8 }}>FOLIO DE LA CORRIDA</Text>
              <Text style={{ color: PRIMARY, fontSize: 13, fontFamily: "Helvetica-Bold" }}>
                {data.run.id}
              </Text>
            </View>
            <View>
              <Text style={{ color: GRAY, fontSize: 8 }}>FECHA DE GENERACIÓN</Text>
              <Text style={{ color: "#FFFFFF", fontSize: 10 }}>
                {new Date().toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })}
              </Text>
            </View>
            <View>
              <Text style={{ color: GRAY, fontSize: 8 }}>CLASIFICACIÓN</Text>
              <Text style={{ color: SECONDARY, fontSize: 10 }}>Confidencial</Text>
            </View>
          </View>
        </View>
      </Page>

      {/* ================= 2. RESUMEN EJECUTIVO Y DICTAMEN ================= */}
      <Page size="A4" style={s.page}>
        <Text style={s.h1}>Resumen ejecutivo y dictamen</Text>
        <Text style={s.small}>
          {data.run.mode === "mock" ? "Corrida de demostración con datos sintéticos · " : ""}
          Confianza del dictamen: {v.confidence}
        </Text>

        <View style={{ flexDirection: "row", marginTop: 16, gap: 18 }}>
          <Donut pct={v.coordinated_pct} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold", color: SECONDARY }}>
              {v.coordinated_pct}% actividad coordinada / automatizada
            </Text>
            <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold", color: PRIMARY, marginBottom: 6 }}>
              {v.organic_pct}% actividad orgánica
            </Text>
            <Text style={s.p}>{T(v.justification)}</Text>
          </View>
        </View>

        <View style={[s.chipRow, { marginTop: 12 }]}>
          <View style={s.statBox}>
            <Text style={s.statValue}>{fmtNum(data.totals.posts)}</Text>
            <Text style={s.statLabel}>Posts analizados</Text>
          </View>
          <View style={s.statBox}>
            <Text style={s.statValue}>{fmtNum(data.totals.total_engagement)}</Text>
            <Text style={s.statLabel}>Interacciones (alcance estimado)</Text>
          </View>
          <View style={s.statBox}>
            <Text style={s.statValue}>{data.totals.clusters}</Text>
            <Text style={s.statLabel}>Clústeres de coordinación</Text>
          </View>
          <View style={s.statBox}>
            <Text style={s.statValue}>
              {data.totals.bot_accounts + data.totals.suspicious_accounts}
            </Text>
            <Text style={s.statLabel}>Cuentas señaladas</Text>
          </View>
        </View>

        <Text style={s.h2}>Hallazgos clave</Text>
        {findings.map((f, i) => (
          <View key={i} style={{ flexDirection: "row", marginBottom: 5 }}>
            <Text style={{ color: SECONDARY, marginRight: 6, fontFamily: "Helvetica-Bold" }}>
              {i + 1}.
            </Text>
            <Text style={[s.p, { flex: 1, marginBottom: 0 }]}>{T(f)}</Text>
          </View>
        ))}
        <Footer />
      </Page>

      {/* ================= 3. CRONOLOGÍA ================= */}
      <Page size="A4" style={s.page}>
        <Text style={s.h1}>Cronología de la campaña</Text>
        <Text style={[s.small, { marginBottom: 10 }]}>
          Eventos clave detectados automáticamente sobre {fmtNum(data.totals.posts)} publicaciones.
        </Text>
        <VolumeBars data={data} />
        {data.timeline.map((e, i) => (
          <TimelineRow key={i} e={e} />
        ))}
        <Footer />
      </Page>

      {/* ================= 4. ORIGEN Y DIFUSIÓN ================= */}
      <Page size="A4" style={s.page}>
        <Text style={s.h1}>Origen y difusión</Text>

        <Text style={s.h2}>Paciente cero por plataforma</Text>
        {data.timeline
          .filter((e) => e.type === "paciente_cero")
          .map((e, i) => (
            <View key={i} style={s.quote}>
              <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold" }}>
                {e.platform ? PLATFORM_LABEL[e.platform] : ""} · {fmtDateTime(e.at)}
              </Text>
              <Text style={{ fontSize: 9, marginTop: 2 }}>{T(e.description)}</Text>
              {e.url && <Text style={[s.small, { marginTop: 2 }]}>{e.url}</Text>}
            </View>
          ))}

        <Text style={s.h2}>Top 5 amplificadores en X (por reposts recibidos)</Text>
        <View style={s.tr}>
          <Text style={[s.th, { width: "34%" }]}>Cuenta</Text>
          <Text style={[s.th, { width: "22%" }]}>Reposts recibidos</Text>
          <Text style={[s.th, { width: "22%" }]}>Seguidores</Text>
          <Text style={[s.th, { width: "22%" }]}>Score de bot</Text>
        </View>
        {data.graph.top_amplifiers.slice(0, 5).map((a, i) => (
          <View key={i} style={s.tr}>
            <Text style={{ width: "34%", fontFamily: "Helvetica-Bold" }}>{a.handle}</Text>
            <Text style={{ width: "22%" }}>{a.in_degree}</Text>
            <Text style={{ width: "22%" }}>{fmtNum(a.followers)}</Text>
            <Text style={{ width: "22%" }}>
              {a.bot_score} ({classify(a.bot_score)})
            </Text>
          </View>
        ))}

        <Text style={s.h2}>Grafo de difusión (X)</Text>
        {graphImage ? (
          <Image
            src={graphImage}
            style={{ width: "100%", maxHeight: 300, objectFit: "contain", borderRadius: 6 }}
          />
        ) : (
          <Text style={s.p}>
            {data.graph.nodes.length > 0
              ? `El grafo contiene ${data.graph.nodes.length} cuentas y ${data.graph.edges.length} aristas de repost. ` +
                `El nodo origen es ${data.graph.origin?.handle ?? "desconocido"} (${
                  data.graph.origin ? fmtDateTime(data.graph.origin.posted_at) : ""
                }). Consulte la versión interactiva en la plataforma.`
              : "No hay posts de X en esta corrida."}
          </Text>
        )}
        <Footer />
      </Page>

      {/* ================= 5. ANÁLISIS DE COORDINACIÓN ================= */}
      <Page size="A4" style={s.page}>
        <Text style={s.h1}>Análisis de coordinación</Text>
        {data.coordination.clusters.length === 0 && (
          <Text style={s.p}>
            No se detectaron clústeres de coordinación con los criterios configurados.
          </Text>
        )}
        {data.coordination.clusters.map((c) => (
          <View key={c.id} wrap={false} style={{ marginBottom: 14 }}>
            <Text style={s.h2}>
              Clúster #{c.id} — {c.accounts.length} cuentas · {c.post_count} posts casi idénticos
            </Text>
            {c.bursts.length > 0 && (
              <Text style={[s.p, { color: "#C2255C" }]}>
                Ráfaga sincronizada: {c.bursts[0].posts} publicaciones en{" "}
                {Math.max(c.bursts[0].minutes, 1)} minutos ({fmtDateTime(c.bursts[0].start)}).
              </Text>
            )}
            <View style={{ flexDirection: "row", gap: 6 }}>
              {c.sample_texts.slice(0, 2).map((t, i) => (
                <View key={i} style={[s.quote, { flex: 1 }]}>
                  <Text style={{ fontSize: 8.5 }}>“{T(t.text)}”</Text>
                  <Text style={[s.small, { marginTop: 3 }]}>
                    {t.handle} · {fmtDateTime(t.posted_at)}
                  </Text>
                </View>
              ))}
            </View>
            <Text style={[s.small, { marginTop: 3 }]}>
              Cuentas: {c.accounts.map((a) => a.split(":")[1]).join(", ")}
            </Text>
          </View>
        ))}
        {data.coordination.account_creation_burst.detected && (
          <View>
            <Text style={s.h2}>Ráfaga de creación de cuentas</Text>
            <Text style={s.p}>
              {data.coordination.account_creation_burst.accounts.length} cuentas participantes
              fueron creadas dentro de la misma ventana de{" "}
              {COORDINATION_CRITERIA.ACCOUNT_CREATION_BURST.window_days} días (a partir del{" "}
              {data.coordination.account_creation_burst.window_start
                ? fmtDate(data.coordination.account_creation_burst.window_start)
                : "—"}
              ).
            </Text>
          </View>
        )}
        <Footer />
      </Page>

      {/* ================= 6. CATÁLOGO DE CUENTAS SEÑALADAS ================= */}
      <Page size="A4" style={s.page}>
        <Text style={s.h1}>Catálogo de cuentas señaladas</Text>
        <Text style={[s.small, { marginBottom: 10 }]}>
          Cuentas con mayor score de bot. Utilizable para reportar ante las plataformas.
        </Text>
        <View style={s.tr}>
          <Text style={[s.th, { width: "22%" }]}>Cuenta</Text>
          <Text style={[s.th, { width: "13%" }]}>Plataforma</Text>
          <Text style={[s.th, { width: "9%" }]}>Score</Text>
          <Text style={[s.th, { width: "16%" }]}>Clasificación</Text>
          <Text style={[s.th, { width: "40%" }]}>Señales (flags)</Text>
        </View>
        {topAccounts.map((a, i) => (
          <View key={i} style={s.tr} wrap={false}>
            <Text style={{ width: "22%", fontFamily: "Helvetica-Bold", fontSize: 8.5 }}>
              {a.handle}
            </Text>
            <Text style={{ width: "13%", fontSize: 8.5 }}>{PLATFORM_LABEL[a.platform]}</Text>
            <Text style={{ width: "9%", fontSize: 8.5 }}>{a.bot_score}</Text>
            <Text style={{ width: "16%", fontSize: 8.5 }}>{classify(a.bot_score)}</Text>
            <Text style={{ width: "40%", fontSize: 7.5, color: "#3A3A55" }}>
              {a.bot_flags.length > 0 ? a.bot_flags.join(" · ") : "—"}
            </Text>
          </View>
        ))}
        <Footer />
      </Page>

      {/* ================= 7. METODOLOGÍA Y CRITERIOS ================= */}
      <Page size="A4" style={s.page}>
        <Text style={s.h1}>Metodología y criterios</Text>

        <Text style={s.h2}>Recolección y preservación de evidencia</Text>
        <Text style={s.p}>
          La evidencia se recolectó mediante actors públicos de la plataforma Apify
          (apidojo/tweet-scraper, apify/instagram-hashtag-scraper, clockworks/tiktok-scraper y
          apify/facebook-search-scraper) sobre contenido público que coincidió con los términos
          de búsqueda. Cada elemento conserva: la URL original, el timestamp de publicación
          reportado por la plataforma (posted_at), el timestamp de captura del sistema
          (collected_at, ISO 8601 UTC), el JSON crudo íntegro tal como lo devolvió la fuente y
          su hash SHA-256 (raw_sha256) calculado en el momento de la captura, que permite
          verificar que el elemento no fue alterado posteriormente. El Anexo de Evidencia (ZIP)
          incluye un archivo JSON por post, un manifest.csv con estos campos y la metodología de
          verificación.
        </Text>

        <Text style={s.h2}>Criterios del score de bot (0-100)</Text>
        {Object.values(BOT_CRITERIA).map((c: any, i) => (
          <View key={i} style={{ flexDirection: "row", marginBottom: 3 }}>
            <Text style={{ width: "10%", fontFamily: "Helvetica-Bold", color: PRIMARY }}>
              +{c.points}
            </Text>
            <Text style={{ width: "90%", fontSize: 9 }}>{c.label}</Text>
          </View>
        ))}
        <Text style={[s.p, { marginTop: 4 }]}>
          Clasificación: 0-{BOT_CLASSIFICATION.human_max} probablemente humano ·{" "}
          {BOT_CLASSIFICATION.human_max + 1}-{BOT_CLASSIFICATION.suspicious_max} sospechoso ·{" "}
          {BOT_CLASSIFICATION.suspicious_max + 1}+ probable bot. El score siempre se reporta
          acompañado de sus señales.
        </Text>

        <Text style={s.h2}>Criterios de coordinación</Text>
        <Text style={s.p}>
          • Clúster de texto: grupos de publicaciones con similitud Jaccard &gt;{" "}
          {COORDINATION_CRITERIA.TEXT_SIMILARITY_THRESHOLD} emitidas por al menos{" "}
          {COORDINATION_CRITERIA.MIN_ACCOUNTS_PER_CLUSTER} cuentas distintas.{"\n"}• Ráfaga
          sincronizada: {COORDINATION_CRITERIA.BURST.min_posts}+ posts casi idénticos en un
          máximo de {COORDINATION_CRITERIA.BURST.window_minutes} minutos.{"\n"}• Ráfaga de creación:{" "}
          {COORDINATION_CRITERIA.ACCOUNT_CREATION_BURST.min_accounts}+ cuentas participantes
          creadas en la misma ventana de{" "}
          {COORDINATION_CRITERIA.ACCOUNT_CREATION_BURST.window_days} días.{"\n"}• Amplificación
          artificial: cuentas cuya única actividad en el dataset es repostear.{"\n"}• El
          dictamen pondera cada publicación por su engagement (1 + likes + shares +
          comentarios) y reporta el porcentaje atribuible a cuentas coordinadas/automatizadas,
          con nivel de confianza explícito.
        </Text>

        <View
          style={{
            marginTop: 18,
            padding: 10,
            backgroundColor: "#FAFAFE",
            borderRadius: 6,
            borderWidth: 0.75,
            borderColor: "#E4E4F0",
          }}
        >
          <Text style={{ fontSize: 9, color: "#3A3A55", lineHeight: 1.5 }}>
            Este análisis caracteriza el comportamiento de cuentas públicas; no identifica
            personas físicas. No constituye asesoría legal.
          </Text>
        </View>
        <Footer />
      </Page>
    </Document>
  );
}

/** Donut nativo en SVG (arco con Path — sin transform ni dasharray,
 *  que el motor SVG de react-pdf no soporta de forma fiable). */
function Donut({ pct }: { pct: number }) {
  const r = 42;
  const clamped = Math.max(0.5, Math.min(pct, 99.5));
  const angle = (clamped / 100) * 2 * Math.PI;
  // Arco desde las 12 en punto, sentido horario.
  const x = 60 + r * Math.sin(angle);
  const y = 60 - r * Math.cos(angle);
  const largeArc = clamped > 50 ? 1 : 0;
  return (
    <Svg width="120" height="120" viewBox="0 0 120 120">
      <Circle cx="60" cy="60" r={r} stroke={PRIMARY} strokeWidth={14} fill="none" />
      <Path
        d={`M 60 ${60 - r} A ${r} ${r} 0 ${largeArc} 1 ${x} ${y}`}
        stroke={SECONDARY}
        strokeWidth={14}
        fill="none"
      />
    </Svg>
  );
}

/** Barras de volumen por día, con la porción sospechosa en rosa — dibujo nativo. */
function VolumeBars({ data }: { data: AnalysisResult }) {
  const vol = data.volume;
  if (vol.length === 0) return null;
  const W = 490;
  const H = 90;
  const max = Math.max(...vol.map((v) => v.total), 1);
  const bw = Math.min(28, (W - vol.length * 4) / vol.length);
  return (
    <View style={{ marginBottom: 14 }}>
      <Svg width={W} height={H + 16} viewBox={`0 0 ${W} ${H + 16}`}>
        {vol.map((v, i) => {
          const x = i * (bw + 4);
          const h = (v.total / max) * H;
          const hs = (v.suspicious / max) * H;
          return (
            <React.Fragment key={i}>
              <Rect x={x} y={H - h} width={bw} height={h - hs} fill={PRIMARY} rx={1.5} />
              <Rect x={x} y={H - hs} width={bw} height={hs} fill={SECONDARY} rx={1.5} />
            </React.Fragment>
          );
        })}
      </Svg>
      <View style={{ flexDirection: "row", justifyContent: "space-between", width: W }}>
        <Text style={s.small}>{vol[0].date}</Text>
        <Text style={s.small}>
          morado: orgánico/otros · rosa: cuentas sospechosas · máx {max} posts/día
        </Text>
        <Text style={s.small}>{vol[vol.length - 1].date}</Text>
      </View>
    </View>
  );
}

function TimelineRow({ e }: { e: TimelineEvent }) {
  const typeLabel: Record<TimelineEvent["type"], string> = {
    paciente_cero: "PACIENTE CERO",
    pico: "PICO",
    cluster: "CLÚSTER",
    amplificador: "AMPLIFICADOR",
  };
  const typeColor: Record<TimelineEvent["type"], string> = {
    paciente_cero: "#B8860B",
    pico: PRIMARY,
    cluster: SECONDARY,
    amplificador: "#0E7490",
  };
  return (
    <View wrap={false} style={{ flexDirection: "row", marginBottom: 7 }}>
      <View style={{ width: "20%" }}>
        <Text style={{ fontSize: 8, color: GRAY }}>{fmtDateTime(e.at)}</Text>
        <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", color: typeColor[e.type] }}>
          {typeLabel[e.type]}
        </Text>
      </View>
      <View style={{ width: "80%" }}>
        <Text style={{ fontSize: 9.5, fontFamily: "Helvetica-Bold" }}>{T(e.title)}</Text>
        <Text style={{ fontSize: 8.5, color: "#3A3A55", marginTop: 1 }}>{T(e.description)}</Text>
        {e.url && <Text style={[s.small, { marginTop: 1 }]}>{e.url}</Text>}
      </View>
    </View>
  );
}
