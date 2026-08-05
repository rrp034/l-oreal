# Project 8: L'Oréal Chatbot

L’Oréal is exploring the power of AI, and your job is to showcase what's possible. Your task is to build a chatbot that helps users discover and understand L’Oréal’s extensive range of products—makeup, skincare, haircare, and fragrances—as well as provide personalized routines and recommendations.

## 🚀 Launch via GitHub Codespaces

1. In the GitHub repo, click the **Code** button and select **Open with Codespaces → New codespace**.
2. Once your codespace is ready, open the `index.html` file via the live preview.

## ☁️ Cloudflare Note

When deploying through Cloudflare, make sure your API request body (in `script.js`) includes a `messages` array and handle the response by extracting `data.choices[0].message.content`.

## Web Search Setup (Cloudflare Worker)

This project can use real-time web search through OpenAI's web search tool in the Worker.

1. Keep using the Worker in `RESOURCE_cloudflare-worker.js`.
2. Store your key securely as a Worker secret (never in frontend code):

```bash
wrangler secret put OPENAI_API_KEY
```

3. Deploy the Worker:

```bash
wrangler deploy
```

4. In `script.js`, keep `workerUrl` set to your deployed Worker URL.

The Worker returns a valid chat-style response (`choices[0].message.content`) and appends any web citations/links under a `Sources:` section when available.

Enjoy building your L’Oréal beauty assistant! 💄
