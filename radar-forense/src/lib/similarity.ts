/**
 * Similitud de textos (Jaccard sobre tokens normalizados).
 * Se usa tanto en el score de bot (texto calcado) como en la
 * detección de clústeres de coordinación.
 */

const STRIP_RE = /[^\p{L}\p{N}\s#@]/gu;

export function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(STRIP_RE, " ")
      .split(/\s+/)
      .filter((t) => t.length > 1)
  );
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  const [small, big] = a.size <= b.size ? [a, b] : [b, a];
  for (const t of small) if (big.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

export interface SimilarPair {
  i: number;
  j: number;
  similarity: number;
}

/**
 * Devuelve todos los pares de índices con similitud >= threshold.
 * O(n²) — aceptable para datasets de campaña (cientos de posts).
 */
export function findSimilarPairs(texts: string[], threshold: number): SimilarPair[] {
  const tokens = texts.map(tokenize);
  const pairs: SimilarPair[] = [];
  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      const s = jaccard(tokens[i], tokens[j]);
      if (s >= threshold) pairs.push({ i, j, similarity: s });
    }
  }
  return pairs;
}
