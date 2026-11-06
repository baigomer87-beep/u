# About this chatbot

This is a RAG (Retrieval-Augmented Generation) chatbot. RAG means the bot first searches a set of documents for the passages most relevant to your question, then gives those passages to a large language model (LLM) so that it can write an answer grounded in them. The answer cites its sources like [1] and [2].

## Why use RAG

A plain LLM only knows what it learned during training. It can be out of date and may invent facts. With RAG you can make it answer from your own documents, such as company policies, course notes or product manuals, without retraining any model. You update the answers simply by changing the documents.

## How retrieval works here

The documents are split into small chunks of roughly 110 words with a little overlap. When you ask a question, the app ranks all chunks with BM25, a classic keyword-based ranking algorithm used by search engines. BM25 rewards chunks that contain the rare words from your question and takes the chunk length into account. The top four chunks are sent to the LLM together with your question.

BM25 needs no embedding model and no vector database, so the app has zero extra services and stays free to host. The trade-off is that it matches words, not meaning, so a question should share some vocabulary with the document.
