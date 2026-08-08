/**
 * CRITERIOS AUDITABLES DE RADAR FORENSE
 * =====================================
 * Este archivo es la ÚNICA fuente de verdad de los umbrales y pesos usados
 * por el score de bot (lib/botscore.ts) y la detección de coordinación
 * (lib/coordination.ts). El reporte PDF lee estos valores directamente,
 * de modo que el documento entregado siempre refleja la configuración real
 * con la que se calculó el análisis.
 *
 * Cada criterio es explícito y citable: si un perito o un tercero cuestiona
 * el análisis, estos son los parámetros exactos que se aplicaron.
 */

export const BOT_CRITERIA = {
  /** Cuenta creada hace menos de N días → señal de cuenta desechable. */
  ACCOUNT_AGE: {
    threshold_days: 90,
    points: 20,
    label: "Cuenta con menos de 90 días de antigüedad",
  },
  /** Ratio seguidores/seguidos muy bajo → cuenta que sigue masivamente sin audiencia propia. */
  FOLLOWER_RATIO: {
    threshold: 0.1,
    points: 15,
    label: "Ratio seguidores/seguidos menor a 0.1",
  },
  /** Frecuencia de publicación inhumana dentro del dataset. */
  POSTING_FREQUENCY: {
    threshold_posts_per_hour: 3,
    points: 20,
    label: "Más de 3 posts por hora en promedio dentro del dataset",
  },
  /** Texto casi idéntico al de otra cuenta → contenido plantilla. */
  DUPLICATE_TEXT: {
    similarity_threshold: 0.85,
    points: 25,
    label: "Texto casi idéntico (similitud > 0.85) al de otra cuenta del dataset",
  },
  /** Handle autogenerado: nombre + 6 o más dígitos (ej. user48291047). */
  GENERIC_HANDLE: {
    digit_count: 6,
    points: 10,
    label: "Handle con patrón genérico (nombre + 6 o más dígitos)",
  },
  /**
   * Actividad distribuida uniformemente en las 24 horas del día:
   * los humanos duermen; una desviación estándar baja entre buckets horarios
   * (con actividad en muchos buckets) sugiere automatización.
   */
  UNIFORM_ACTIVITY: {
    /** Mínimo de posts para evaluar esta señal (evita falsos positivos). */
    min_posts: 6,
    /** Mínimo de buckets horarios distintos con actividad. */
    min_active_hours: 6,
    /** Coeficiente de variación (σ/μ) por debajo del cual se considera uniforme. */
    max_coefficient_of_variation: 0.6,
    points: 10,
    label: "Actividad distribuida uniformemente en las 24 horas",
  },
} as const;

/** Clasificación del score total (0-100). */
export const BOT_CLASSIFICATION = {
  human_max: 30, //  0-30: probablemente humano
  suspicious_max: 60, // 31-60: sospechoso
  //                     61+ : probable bot
} as const;

export const COORDINATION_CRITERIA = {
  /** Similitud mínima entre textos para agruparlos en un clúster. */
  TEXT_SIMILARITY_THRESHOLD: 0.85,
  /** Mínimo de cuentas distintas para que un grupo de textos calcados sea clúster. */
  MIN_ACCOUNTS_PER_CLUSTER: 3,
  /** Ráfaga sincronizada: N+ posts casi idénticos dentro de la ventana. */
  BURST: {
    window_minutes: 30,
    min_posts: 5,
  },
  /** Ráfaga de creación de cuentas: N+ cuentas participantes creadas en una ventana de 2-4 semanas. */
  ACCOUNT_CREATION_BURST: {
    window_days: 28,
    min_accounts: 5,
  },
  /**
   * Dictamen conservador: el % coordinado se calcula sobre actividad ponderada
   * por engagement (likes + shares + comments) + 1 por el post mismo.
   * La confianza baja si hay pocos datos o señales ambiguas.
   */
  VERDICT: {
    /** Menos de N posts totales → confianza "baja" automática. */
    min_posts_for_confidence: 50,
    /** Se requieren al menos N señales independientes para confianza "alta". */
    min_signals_for_high_confidence: 3,
  },
} as const;

export type BotCriterionKey = keyof typeof BOT_CRITERIA;
