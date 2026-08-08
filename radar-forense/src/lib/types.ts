// Tipos compartidos del esquema unificado de Radar Forense.

export type Platform = "x" | "instagram" | "tiktok" | "facebook";

export const PLATFORMS: Platform[] = ["x", "instagram", "tiktok", "facebook"];

export const PLATFORM_LABEL: Record<Platform, string> = {
  x: "X (Twitter)",
  instagram: "Instagram",
  tiktok: "TikTok",
  facebook: "Facebook",
};

/** Post normalizado — una fila de la tabla `posts`. */
export interface Post {
  id: string;
  platform: Platform;
  author_handle: string;
  author_name: string;
  author_followers: number;
  /** ISO 8601 o null si la plataforma no lo expone. */
  author_created_at: string | null;
  text: string;
  url: string;
  posted_at: string;
  likes: number;
  shares: number;
  comments: number;
  views: number | null;
  /** id del post original si esto es retweet/quote (solo X). */
  parent_post_id: string | null;
  raw_json: string;
  collected_at: string;
  raw_sha256: string;
  /** Keywords de la corrida que trajeron este post. */
  matched_terms: string[];
}

/** Cuenta derivada — una fila de la tabla `accounts`. */
export interface Account {
  handle: string;
  platform: Platform;
  followers: number;
  following: number | null;
  account_age_days: number | null;
  posts_in_dataset: number;
  avg_posts_per_hour: number;
  bot_score: number;
  bot_flags: string[];
  coordination_cluster_id: number | null;
}

export interface Run {
  id: string;
  keywords: string[];
  started_at: string;
  status: "running" | "done" | "error";
  posts_collected: number;
  mode: "mock" | "apify";
}

export type BotVerdict = "probablemente humano" | "sospechoso" | "probable bot";

export interface CoordinationCluster {
  id: number;
  accounts: string[]; // handles (con plataforma: "x:@handle")
  post_count: number;
  sample_texts: { handle: string; text: string; posted_at: string; url: string }[];
  /** Ráfagas detectadas: ventanas cortas con muchos posts casi idénticos. */
  bursts: { start: string; end: string; posts: number; minutes: number }[];
  first_post_at: string;
  platforms: Platform[];
}

export interface CoordinationResult {
  clusters: CoordinationCluster[];
  /** Cuentas creadas en la misma ventana de 2-4 semanas. */
  account_creation_burst: {
    detected: boolean;
    window_start: string | null;
    window_end: string | null;
    accounts: string[];
  };
  /** Cuentas que solo repostean (0 posts originales). */
  amplification_only_accounts: string[];
  verdict: {
    coordinated_pct: number;
    organic_pct: number;
    confidence: "alta" | "media" | "baja";
    justification: string;
  };
}

export interface TimelineEvent {
  at: string;
  type: "paciente_cero" | "pico" | "cluster" | "amplificador";
  title: string;
  description: string;
  url: string | null;
  platform: Platform | null;
}

export interface GraphNode {
  id: string; // handle
  handle: string;
  followers: number;
  bot_score: number;
  posts: number;
  /** log-scale para tamaño del nodo */
  val: number;
}

export interface GraphEdge {
  source: string;
  target: string;
}

export interface DiffusionGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  origin: { handle: string; url: string; posted_at: string; text: string } | null;
  top_amplifiers: { handle: string; in_degree: number; followers: number; bot_score: number }[];
}

export interface VolumePoint {
  date: string; // YYYY-MM-DD
  x: number;
  instagram: number;
  tiktok: number;
  facebook: number;
  suspicious: number; // posts de cuentas bot/sospechosas ese día (todas las plataformas)
  total: number;
}

export interface PlatformLists {
  platform: Platform;
  first_posters: { handle: string; posted_at: string; url: string; followers: number }[];
  top_engagement: { handle: string; url: string; engagement: number; text: string }[];
}

/** Resultado completo del análisis de una corrida. */
export interface AnalysisResult {
  run: Run;
  totals: {
    posts: number;
    platforms: Platform[];
    accounts: number;
    bot_accounts: number;
    suspicious_accounts: number;
    clusters: number;
    date_range: { from: string; to: string };
    total_engagement: number;
  };
  accounts: Account[];
  coordination: CoordinationResult;
  timeline: TimelineEvent[];
  volume: VolumePoint[];
  graph: DiffusionGraph;
  platform_lists: PlatformLists[];
  posts: Post[];
}
