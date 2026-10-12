// AI text improvement using the Anthropic API (Claude).
// POST body: { text, instruction }
// Env: ANTHROPIC_API_KEY
//
// Falls back gracefully: if no ANTHROPIC_API_KEY is set, returns the original text.

async function readBody(req) {
  if (req.body) return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  return new Promise((resolve, reject) => {
    let d = "";
    req.on("data", (c) => (d += c));
    req.on("end", () => { try { resolve(d ? JSON.parse(d) : {}); } catch (e) { reject(e); } });
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  try {
    const { text, instruction = "correct grammar and rephrase professionally" } = await readBody(req);
    if (!text) { res.status(400).json({ error: "Missing text" }); return; }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      // No API key — return the original text unchanged
      res.status(200).json({ improved: text, note: "Set ANTHROPIC_API_KEY in Vercel to enable AI improvement." });
      return;
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-20240307",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: `You are a professional email assistant for a DJ entertainment business (C-RAM Entertainment).
Your task: ${instruction}.

IMPORTANT: Return ONLY the improved text itself — no explanations, no "Here is the improved version:", no quotes around it. Just the improved email text ready to send.

Original text:
${text}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `Anthropic API error ${response.status}`);
    }

    const data = await response.json();
    const improved = data.content?.[0]?.text?.trim() || text;
    res.status(200).json({ improved });
  } catch (e) {
    console.error("ai-improve error:", e);
    res.status(500).json({ error: e.message || "AI improve failed" });
  }
}
