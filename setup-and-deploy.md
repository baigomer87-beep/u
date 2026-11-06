# Adding documents and deploying

## How to add your own documents

There are two ways. First, click the plus button next to the message box and attach up to five files in .txt, .md, .csv or .json format, each up to 100 KB. These files stay in your browser and are sent with your question only. They are not stored on the server.

Second, to make documents permanent for everyone, put .md or .txt files into the knowledge folder of the project, commit them to GitHub and redeploy. The server reads every file in that folder when it starts.

## Choosing the LLM and API key

The app talks to any OpenAI-compatible chat API. By default it uses Groq, which has a free tier, with the model openai/gpt-oss-120b. To use xAI Grok instead, set LLM_BASE_URL to https://api.x.ai/v1, LLM_MODEL to grok-4.7 and use an xAI API key. The key is read from the LLM_API_KEY environment variable on the server and is never sent to the browser.

## How to deploy on Vercel

Push the project to a GitHub repository. Go to vercel.com/new and import the repository. Vercel detects Next.js automatically. Under Environment Variables add LLM_API_KEY, and optionally LLM_BASE_URL and LLM_MODEL, then click Deploy. If you change environment variables later, redeploy for them to take effect.

## Limits

The free tier of an API has rate limits, so you may see a message asking you to wait a minute. Only text formats are supported. PDF and Word files are not parsed in this version.
