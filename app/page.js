"use client";

import { useEffect, useRef, useState } from "react";

const SUGGESTIONS = [
  "What is RAG and why use it?",
  "How do I add my own documents?",
  "What is BM25?",
  "How do I deploy this on Vercel?",
];

const MAX_FILES = 5;
const MAX_FILE_BYTES = 100 * 1024;

function renderContent(text) {
  const parts = text.split(/```/);
  return parts.map((part, i) => {
    if (i % 2 === 1) {
      const nl = part.indexOf("\n");
      const lang = nl > -1 ? part.slice(0, nl).trim() : "";
      const code = nl > -1 ? part.slice(nl + 1) : part;
      return (
        <div className="codeblock" key={i}>
          <div className="codehead">
            <span>{lang || "code"}</span>
            <button onClick={() => navigator.clipboard?.writeText(code)}>Copy</button>
          </div>
          <pre><code>{code}</code></pre>
        </div>
      );
    }
    const inline = part.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).map((seg, j) => {
      if (seg.startsWith("`") && seg.endsWith("`") && seg.length > 2)
        return <code className="inline" key={j}>{seg.slice(1, -1)}</code>;
      if (seg.startsWith("**") && seg.endsWith("**") && seg.length > 4)
        return <strong key={j}>{seg.slice(2, -2)}</strong>;
      return <span key={j}>{seg}</span>;
    });
    return <p key={i} className="text">{inline}</p>;
  });
}

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef(null);
  const bottomRef = useRef(null);
  const taRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, [input]);

  async function onFiles(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    setError("");
    const added = [];
    for (const f of files) {
      if (documents.length + added.length >= MAX_FILES) {
        setError(`You can attach up to ${MAX_FILES} files.`);
        break;
      }
      if (!/\.(txt|md|csv|json)$/i.test(f.name)) {
        setError(`${f.name}: only .txt, .md, .csv and .json files are supported.`);
        continue;
      }
      if (f.size > MAX_FILE_BYTES) {
        setError(`${f.name}: file is larger than 100 KB.`);
        continue;
      }
      added.push({ name: f.name, text: await f.text() });
    }
    if (added.length) setDocuments((d) => [...d, ...added]);
  }

  async function send(text) {
    const content = (text ?? input).trim();
    if (!content || loading) return;

    setError("");
    setInput("");
    const next = [...messages, { role: "user", content }];
    setMessages([...next, { role: "assistant", content: "", sources: [] }]);
    setLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.map(({ role, content }) => ({ role, content })),
          documents,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${res.status})`);
      }

      let sources = [];
      try {
        sources = JSON.parse(decodeURIComponent(res.headers.get("X-Sources") || "[]"));
      } catch {}

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "assistant", content: acc, sources };
          return copy;
        });
      }
    } catch (e) {
      if (e.name !== "AbortError") {
        setError(e.message || "Something went wrong.");
        setMessages((m) => (m[m.length - 1]?.content === "" ? m.slice(0, -1) : m));
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  function newChat() {
    stop();
    setMessages([]);
    setError("");
    setInput("");
  }

  function onKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <span className="logo">R</span> RAG Chat
        </div>
        <div className="top-actions">
          <button className="ghost" onClick={newChat}>+ New chat</button>
        </div>
      </header>

      <main className="chat">
        {messages.length === 0 ? (
          <div className="empty">
            <h1>Ask your documents</h1>
            <p style={{ color: "var(--muted)", margin: "-12px 0 24px" }}>
              Answers come from the built-in knowledge base plus any files you attach (.txt, .md, .csv, .json).
            </p>
            <div className="chips">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="chip" onClick={() => send(s)}>{s}</button>
              ))}
            </div>
          </div>
        ) : (
          <div className="thread">
            {messages.map((m, i) => (
              <div key={i} className={`row ${m.role}`}>
                <div className="avatar">{m.role === "user" ? "U" : "R"}</div>
                <div className="bubble">
                  {m.content ? renderContent(m.content) : <span className="dots"><i /><i /><i /></span>}
                  {m.role === "assistant" && m.sources?.length > 0 && m.content && (
                    <div className="sources">
                      {m.sources.map((s) => (
                        <div className="source" key={s.id}>
                          <b>[{s.id}] {s.name}</b> — {s.snippet}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {error && <div className="error">{error}</div>}
            <div ref={bottomRef} />
          </div>
        )}
      </main>

      <footer className="composer">
        {documents.length > 0 && (
          <div className="docs">
            {documents.map((d, i) => (
              <span className="doc" key={d.name + i}>
                {d.name}
                <button onClick={() => setDocuments((x) => x.filter((_, j) => j !== i))} aria-label={`Remove ${d.name}`}>×</button>
              </span>
            ))}
          </div>
        )}
        {error && messages.length === 0 && <div className="error" style={{ maxWidth: 760, margin: "0 auto 8px" }}>{error}</div>}
        <div className="box">
          <input ref={fileRef} type="file" multiple accept=".txt,.md,.csv,.json" onChange={onFiles} hidden />
          <button className="attach" onClick={() => fileRef.current?.click()} aria-label="Attach documents" title="Attach documents">+</button>
          <textarea
            ref={taRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask a question about your documents..."
          />
          {loading ? (
            <button className="send stop" onClick={stop} aria-label="Stop">■</button>
          ) : (
            <button className="send" onClick={() => send()} disabled={!input.trim()} aria-label="Send">↑</button>
          )}
        </div>
        <p className="hint">Enter to send · Shift+Enter for new line · Attached files stay in your browser</p>
      </footer>
    </div>
  );
}
