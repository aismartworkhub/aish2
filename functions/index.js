const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

const anthropicApiKey = defineSecret("ANTHROPIC_API_KEY");

exports.claude = onRequest(
  {
    cors: true,
    secrets: [anthropicApiKey],
    maxInstances: 5,
    region: "asia-northeast3",
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const apiKey = anthropicApiKey.value();
    if (!apiKey) {
      res.status(500).json({ error: "Missing ANTHROPIC_API_KEY secret" });
      return;
    }

    const { prompt } = req.body || {};
    if (!prompt || typeof prompt !== "string") {
      res.status(400).json({ error: "prompt is required" });
      return;
    }

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1024,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        res.status(response.status).json({ error: "Anthropic API error", detail: errorBody });
        return;
      }

      const data = await response.json();
      const output = data.content?.[0]?.text || "";
      res.json({ output });
    } catch (error) {
      res.status(500).json({ error: "Request failed", detail: error.message });
    }
  }
);
