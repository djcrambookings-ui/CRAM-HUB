// AI text improvement — tries providers in order of preference:
//   1. Anthropic (ANTHROPIC_API_KEY)   — best quality, paid
//   2. Groq     (GROQ_API_KEY)         — free tier, fast (Llama 3)
//   3. Fallback — returns original text with a note
//
// POST body: { text, instruction }

async function readBody(req) {
  if (req.body) return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  return new Promise((resolve, reject) => {
    let d = "";
    req.on("data", (c) => (d += c));
    req.on("end", () => { try { resolve(d ? JSON.parse(d) : {}); } catch (e) { reject(e); } });
    req.on("error", reject);
  });
}

const SYSTEM_PROMPT = `You are a professional email assistant for C-RAM Entertainment, a Melbourne DJ and events business run by Marc. Your job is to improve email replies so they sound warm, professional, and confident — like they came from an experienced events business owner. Always fix ALL spelling mistakes and grammatical errors, no matter what other instruction is given. Return ONLY the improved text itself — no explanations, no "Here is the improved version:", no quotes. Just the improved email text ready to send.`;

async function tryAnthropic(apiKey, text, instruction) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-20240307",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: `${instruction}.\n\nOriginal text:\n${text}` }],
    }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error?.message || `Anthropic ${res.status}`); }
  const data = await res.json();
  return data.content?.[0]?.text?.trim() || text;
}

async function tryGroq(apiKey, text, instruction) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      max_tokens: 1024,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `${instruction}.\n\nOriginal text:\n${text}` },
      ],
    }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error?.message || `Groq ${res.status}`); }
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || text;
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  try {
    const { text, instruction = "correct grammar and rephrase professionally" } = await readBody(req);
    if (!text) { res.status(400).json({ error: "Missing text" }); return; }

    // Map short dropdown values to detailed AI instructions
    const instructionMap = {
      "correct grammar and rephrase professionally": "Fix ALL spelling mistakes and grammatical errors, then rephrase the text so it reads professionally and confidently. Keep the same meaning and length.",
      "make more friendly and warm": "Fix ALL spelling mistakes, then rewrite the text to sound warm, friendly and personable — like you genuinely care about the client's event. Keep it natural, not overly formal.",
      "make more formal and concise": "Fix ALL spelling mistakes, then rewrite the text to be more formal, polished and concise. Remove casual language, filler phrases and unnecessary words. Every sentence should count.",
      "expand with more detail": "Fix ALL spelling mistakes, then significantly expand the text with helpful, relevant detail. Add context, explain next steps more clearly, and make the response feel thorough and reassuring to a wedding or events client. At least double the length.",
      "shorten and tighten": "Fix ALL spelling mistakes, then shorten the text significantly. Cut anything repetitive or unnecessary. Keep only the essential points in clear, direct language.",
    };
    const detailedInstruction = instructionMap[instruction.toLowerCase().trim()] || `Fix ALL spelling mistakes, then ${instruction}.`;

    // Try Anthropic first (paid, best quality)
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const improved = await tryAnthropic(process.env.ANTHROPIC_API_KEY, text, detailedInstruction);
        res.status(200).json({ improved, provider: "anthropic" });
        return;
      } catch (e) { console.warn("Anthropic failed, trying Groq:", e.message); }
    }

    // Try Groq (free tier)
    if (process.env.GROQ_API_KEY) {
      try {
        const improved = await tryGroq(process.env.GROQ_API_KEY, text, detailedInstruction);
        res.status(200).json({ improved, provider: "groq" });
        return;
      } catch (e) { console.warn("Groq failed:", e.message); }
    }

    // No AI available — return original with a hint
    res.status(200).json({
      improved: text,
      note: "Add GROQ_API_KEY in Vercel environment variables to enable free AI improvement (groq.com — free account, no credit card).",
    });
  } catch (e) {
    console.error("ai-improve error:", e);
    res.status(500).json({ error: e.message || "AI improve failed" });
  }
}
