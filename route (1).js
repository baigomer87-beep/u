import { buildIndex, chunkDocument, loadKnowledgeChunks, search } from "../../../lib/rag";

export const runtime = "nodejs";
export const maxDuration = 60;

const BASE_URL = (process.env.LLM_BASE_URL || "https://api.groq.com/openai/v1").replace(/\/$/, "");
const MODEL = process.env.LLM_MODEL || "openai/gpt-oss-120b";

const MAX_MESSAGES = 20;
const MAX_CHARS = 6000;
const MAX_DOCS = 5;
const MAX_DOC_CHARS = 100000;
const TOP_K = 4;

const SYSTEM_PROMPT = `You are a helpful assistant that answers using the provided context excerpts from the user's documents.
Rules:
- Base your answer on the context. Cite the excerpts you used like [1], [2].
- If the context does not contain the answer, say you could not find it in the documents, and only then offer general knowledge, clearly labelled as not from the documents.
- Be concise. Use Markdown for lists and code. Reply in the user's language.`;

export async function POST(req) {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "LLM_API_KEY is not set on the server." }, { status: 500 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const messages = (Array.isArray(body?.messages) ? body.messages : [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-MAX_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));

  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return Response.json({ error: "No user message provided." }, { status: 400 });
  }

  // 1) Build the knowledge index: repo documents + documents uploaded in the browser.
  let chunks = [...loadKnowledgeChunks()];
  const uploaded = (Array.isArray(body?.documents) ? body.documents : []).slice(0, MAX_DOCS);
  for (const d of uploaded) {
    if (d && typeof d.name === "string" && typeof d.text === "string") {
      chunks = chunks.concat(chunkDocument(d.name.slice(0, 80), d.text.slice(0, MAX_DOC_CHARS)));
    }
  }
  const index = buildIndex(chunks);

  // 2) Retrieve: use the last two user turns so follow-up questions still match.
  const userTurns = messages.filter((m) => m.role === "user");
  const query = userTurns.slice(-2).map((m) => m.content).join(" ");
  const hits = search(index, query, TOP_K);

  const context = hits.length
    ? hits.map((h, i) => `[${i + 1}] (source: ${h.source})\n${h.text}`).join("\n\n")
    : "(no relevant excerpts found)";

  const sources = hits.map((h, i) => ({
    id: i + 1,
    name: h.source,
    snippet: h.text.slice(0, 160) + (h.text.length > 160 ? "…" : ""),
  }));

  // 3) Generate with the LLM, injecting the retrieved context into the latest question.
  const history = messages.slice(0, -1);
  const last = messages[messages.length - 1];
  const augmented = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history,
    { role: "user", content: `Context:\n${context}\n\nQuestion: ${last.content}` },
  ];

  let upstream;
  try {
    upstream = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: MODEL, stream: true, messages: augmented }),
      signal: req.signal,
    });
  } catch {
    return Response.json({ error: "Could not reach the LLM API. Please try again." }, { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    if (upstream.status === 429) {
      return Response.json({ error: "Rate limit reached. Wait a minute and try again." }, { status: 429 });
    }
    const text = await upstream.text().catch(() => "");
    return Response.json(
      { error: `LLM API error (${upstream.status}): ${text.slice(0, 500)}` },
      { status: upstream.status || 502 }
    );
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body.getReader();
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const raw of lines) {
            const line = raw.trim();
            if (!line.startsWith("data:")) continue;
            const data = line.slice(5).trim();
            if (data === "[DONE]") continue;
            try {
              const delta = JSON.parse(data).choices?.[0]?.delta?.content;
              if (delta) controller.enqueue(encoder.encode(delta));
            } catch {
              // ignore partial lines
            }
          }
        }
      } catch {
        controller.enqueue(encoder.encode("\n\n[Connection interrupted. Please try again.]"));
      } finally {
        controller.close();
      }
    },
    cancel() {
      upstream.body?.cancel();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Sources": encodeURIComponent(JSON.stringify(sources)),
    },
  });
}
