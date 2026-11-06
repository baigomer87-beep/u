// Minimal RAG retrieval: chunking + BM25 keyword ranking. No external services needed.
import fs from "node:fs";
import path from "node:path";

const STOPWORDS = new Set(
  "a an the and or but if then of to in on at by for with from as is are was were be been being it its this that these those i you he she we they my your our their me him her us them do does did have has had not no yes can could should would will just so than too very about into over after before what which who whom how when where why".split(
    " "
  )
);

const CHUNK_WORDS = 110;
const OVERLAP_WORDS = 20;

export function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t && !STOPWORDS.has(t));
}

// Split a document into overlapping chunks of ~CHUNK_WORDS words, preferring paragraph boundaries.
export function chunkDocument(name, text) {
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const chunks = [];
  let current = [];

  const flush = () => {
    if (current.length) {
      chunks.push({ source: name, text: current.join(" ") });
      current = current.slice(-OVERLAP_WORDS);
      if (current.length >= CHUNK_WORDS - OVERLAP_WORDS) current = [];
    }
  };

  for (const para of paragraphs) {
    const words = para.split(/\s+/);
    for (const w of words) {
      current.push(w);
      if (current.length >= CHUNK_WORDS) flush();
    }
    // Keep paragraphs together when there's room; otherwise start fresh.
    if (current.length > CHUNK_WORDS * 0.6) flush();
  }
  if (current.length > OVERLAP_WORDS || chunks.length === 0) {
    if (current.length) chunks.push({ source: name, text: current.join(" ") });
  }
  return chunks;
}

// Builds an in-memory BM25 index over chunks.
export function buildIndex(chunks) {
  const docs = chunks.map((c) => {
    const tokens = tokenize(c.text);
    const tf = new Map();
    tokens.forEach((t) => tf.set(t, (tf.get(t) || 0) + 1));
    return { ...c, tf, len: tokens.length };
  });
  const df = new Map();
  docs.forEach((d) => d.tf.forEach((_, t) => df.set(t, (df.get(t) || 0) + 1)));
  const avgLen = docs.reduce((a, d) => a + d.len, 0) / Math.max(docs.length, 1);
  return { docs, df, avgLen, n: docs.length };
}

export function search(index, query, k = 4) {
  const qTokens = [...new Set(tokenize(query))];
  if (!qTokens.length || !index.n) return [];
  const k1 = 1.5;
  const b = 0.75;

  const scored = index.docs.map((d) => {
    let score = 0;
    for (const t of qTokens) {
      const f = d.tf.get(t);
      if (!f) continue;
      const n = index.df.get(t) || 0;
      const idf = Math.log(1 + (index.n - n + 0.5) / (n + 0.5));
      score += (idf * f * (k1 + 1)) / (f + k1 * (1 - b + (b * d.len) / (index.avgLen || 1)));
    }
    return { source: d.source, text: d.text, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b2) => b2.score - a.score)
    .slice(0, k);
}

// Loads every .md / .txt file in ./knowledge once per server instance.
let cachedKnowledge = null;
export function loadKnowledgeChunks() {
  if (cachedKnowledge) return cachedKnowledge;
  const dir = path.join(process.cwd(), "knowledge");
  let chunks = [];
  try {
    for (const file of fs.readdirSync(dir)) {
      if (!/\.(md|txt)$/i.test(file)) continue;
      const text = fs.readFileSync(path.join(dir, file), "utf8");
      chunks = chunks.concat(chunkDocument(file, text));
    }
  } catch {
    // No knowledge folder: the bot will rely on uploaded documents only.
  }
  cachedKnowledge = chunks;
  return chunks;
}
