import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Radar Forense — AppLab",
  description:
    "Análisis forense de campañas en redes sociales: cronología, origen, bots y coordinación.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen font-sans">
        <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-ink-950/80 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
            <Link href="/" className="flex items-center gap-3">
              <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary shadow-glow">
                <RadarIcon />
              </span>
              <span className="text-lg font-bold tracking-tight text-white">
                Radar Forense
                <span className="ml-2 rounded-md bg-white/[0.06] px-1.5 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                  AppLab
                </span>
              </span>
            </Link>
            <nav className="flex items-center gap-2 text-sm text-slate-400">
              <span className="hidden sm:inline">Análisis forense de campañas digitales</span>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
        <footer className="border-t border-white/[0.06] py-6 text-center text-xs text-slate-600">
          Radar Forense · AppLab · applab.mx · Confidencial
        </footer>
      </body>
    </html>
  );
}

function RadarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
      <circle cx="12" cy="12" r="9" opacity="0.5" />
      <circle cx="12" cy="12" r="5" opacity="0.75" />
      <circle cx="12" cy="12" r="1.2" fill="white" />
      <path d="M12 12 L18.5 5.5" strokeLinecap="round" />
    </svg>
  );
}
