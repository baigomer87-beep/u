# RAG Chat

A ChatGPT-style **RAG (Retrieval-Augmented Generation)** chatbot built with Next.js. It answers from your documents, shows the sources it used, streams replies, and lets users attach their own files. The API key stays on the server.

```
question → BM25 search over document chunks → top 4 chunks + question → LLM API → streamed answer with [1][2] citations
```

- **LLM:** any OpenAI-compatible API. Default: Groq (free tier), model `openai/gpt-oss-120b`. Switch to xAI Grok (`grok-4.7`) by changing env variables (below).
- **Retrieval:** BM25 keyword search, implemented in `lib/rag.js`. No embeddings, no vector database, no extra services. It matches words rather than meaning, so questions should share vocabulary with the documents.
- **Knowledge:** `.md` / `.txt` files in `knowledge/` (permanent) plus files users attach in the browser (.txt .md .csv .json, up to 5 files, 100 KB each; sent with the question and not stored).

## Project structure

```
rag-chatbot/
├── app/
│   ├── api/chat/route.js   # RAG pipeline + LLM call (uses your API key)
│   ├── globals.css
│   ├── layout.js
│   └── page.js             # chat UI
├── lib/
│   └── rag.js              # chunking + BM25 retrieval
├── knowledge/
│   ├── about-rag.md        # sample documents (replace with your own)
│   └── setup-and-deploy.md
├── .env.example
├── .gitignore
├── next.config.mjs
├── package.json
└── README.md
```

## Run locally

```bash
npm install
cp .env.example .env.local     # then put your key in .env.local
npm run dev
```

Open http://localhost:3000

## Environment variables

Groq (default, free):
```
LLM_API_KEY=gsk_...                  # https://console.groq.com/keys
LLM_BASE_URL=https://api.groq.com/openai/v1
LLM_MODEL=openai/gpt-oss-120b
```

xAI Grok:
```
LLM_API_KEY=xai-...                  # https://console.x.ai
LLM_BASE_URL=https://api.x.ai/v1
LLM_MODEL=grok-4.7
```

## Upload to GitHub

```bash
git init
git add .
git commit -m "RAG chatbot"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/rag-chatbot.git
git push -u origin main
```

`.env.local` is in `.gitignore`, so your key is not uploaded.

## Deploy on Vercel

1. https://vercel.com/new → import your GitHub repo (Next.js is auto-detected).
2. Add Environment Variables: `LLM_API_KEY` (and optionally `LLM_BASE_URL`, `LLM_MODEL`).
3. Deploy. If you change variables later, redeploy.

## Use your own knowledge base

Delete the two sample files in `knowledge/` and add your own `.md` or `.txt` files, then commit and redeploy.

## Notes

- Model names change over time. If you get a "model not found" error, pick a current one from your provider's docs and set `LLM_MODEL`.
- Free API tiers have rate limits (the app shows a message when you hit one).
- PDF and Word files are not parsed in this version; convert them to text or Markdown first.
