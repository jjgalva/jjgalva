"use client";

import { useState, type RefObject } from "react";
import type { AnalysisResult } from "@/lib/types";

/**
 * Genera el reporte forense PDF en el cliente con @react-pdf/renderer.
 * Antes de renderizar intenta capturar el canvas del grafo de difusión como
 * PNG; si no es posible, el PDF dibuja una versión simplificada nativa.
 */
export default function ReportButton({
  data,
  graphContainerRef,
}: {
  data: AnalysisResult;
  graphContainerRef: RefObject<HTMLDivElement>;
}) {
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    try {
      // Captura del grafo (canvas → dataURL PNG), con fondo oscuro compuesto.
      let graphImage: string | null = null;
      try {
        const canvas = graphContainerRef.current?.querySelector("canvas");
        if (canvas && canvas.width > 0) {
          const out = document.createElement("canvas");
          out.width = canvas.width;
          out.height = canvas.height;
          const ctx = out.getContext("2d")!;
          ctx.fillStyle = "#0E0E1C";
          ctx.fillRect(0, 0, out.width, out.height);
          ctx.drawImage(canvas, 0, 0);
          graphImage = out.toDataURL("image/png");
        }
      } catch {
        graphImage = null; // fallback nativo dentro del PDF
      }

      const [{ pdf }, { default: ReportPDF }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/report/ReportPDF"),
      ]);
      const blob = await pdf(<ReportPDF data={data} graphImage={graphImage} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `reporte_forense_${data.run.id}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      alert(`No se pudo generar el PDF: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button className="btn-primary" onClick={generate} disabled={busy}>
      {busy ? (
        <span className="flex items-center gap-2">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          Generando…
        </span>
      ) : (
        "⬇ Descargar reporte forense"
      )}
    </button>
  );
}
