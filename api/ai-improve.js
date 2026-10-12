// AI text improvement — tries providers in order of preference:
//   1. Anthropic (ANTHROPIC_API_KEY)   — best quality, paid
//   2. Groq     (GROQ_API_KEY)         — free tier, fast (Llama 3 70b)
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

// Marc's voice profile — used in all prompts so every output sounds like him
const MARC_VOICE = `
You are writing AS Marc from C-RAM Entertainment — a Melbourne DJ with 25 years experience who runs a professional wedding and events business.

Marc's natural writing style:
- Warm and genuine, not corporate or stiff
- Confident but not arrogant — he knows his craft
- Casual-professional: friendly like a mate, but clearly experienced
- Short punchy sentences. Gets to the point.
- Uses "I'd love to" / "happy to" / "let's" naturally
- Mentions the client's event specifically when context is given
- Never sounds like a template or AI-generated copy
- Signs off simply — no "Kind regards" or "Best wishes", just a natural close
- Always fix ALL spelling and grammar mistakes

Never use phrases like: "I hope this email finds you well", "Please don't hesitate", "at your earliest convenience", "I wanted to reach out", "touch base", "moving forward", "as per my last email".
These sound robotic. Marc sounds like a real person who loves what he does.
`;

const SYSTEM_PROMPT = `${MARC_VOICE}
Your job: improve or rewrite email text so it sounds exactly like Marc wrote it himself — warm, professional, genuine. Return ONLY the finished email text, nothing else. No explanations, no "Here is the improved version:", no quotes.`;

const WRITE_FROM_NOTES_PROMPT = `${MARC_VOICE}
Your job: take rough notes or dot points and write a complete, natural-sounding email reply FROM Marc to a client. The email should sound like Marc sat down and typed it — not like it was generated. Return ONLY the finished email text, nothing else. No subject line unless asked. No explanations.`;

async function callAnthropic(apiKey, systemPrompt, userMessage) {
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
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error?.message || `Anthropic ${res.status}`); }
  const data = await res.json();
  return data.content?.[0]?.text?.trim();
}

async function callGroq(apiKey, systemPrompt, userMessage) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "openai/gpt-oss-120b",
      max_tokens: 1024,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error?.message || `Groq ${res.status}`); }
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim();
}

// Detailed instructions for each dropdown option
const INSTRUCTION_MAP = {
  "correct grammar and rephrase professionally":
    "Fix ALL spelling and grammar mistakes. Rephrase so it flows naturally in Marc's voice — confident and professional but still him. Same meaning, same approximate length.",

  "make more friendly and warm":
    "Fix ALL spelling and grammar mistakes. Rewrite so it sounds genuinely warm and personal — like Marc really cares about this client's day. Keep it natural and real, not gushing.",

  "make more formal and concise":
    "Fix ALL spelling and grammar mistakes. Tighten it right up — cut any waffle, filler or casual phrases. Make every sentence earn its place. Still Marc's voice, just sharper and more professional.",

  "expand with more detail":
    "Fix ALL spelling and grammar mistakes. Expand this significantly — add reassurance, explain what happens next, show Marc's experience and enthusiasm for the event. Should feel thorough and confidence-building for the client. At least double the length.",

  "shorten and tighten":
    "Fix ALL spelling and grammar mistakes. Cut this down hard. Strip out anything repeated or unnecessary. Keep only the core message in clear, direct sentences.",

  "write from notes":
    "Take these rough notes and write a complete, natural email reply from Marc. Make it flow like a real email he'd actually send — warm, confident, professional. Fill in the gaps sensibly based on context.",
};

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  try {
    const { text, instruction = "correct grammar and rephrase professionally" } = await readBody(req);
    if (!text) { res.status(400).json({ error: "Missing text" }); return; }

    const isWriteFromNotes = instruction.toLowerCase().trim() === "write from notes";
    const systemPrompt = isWriteFromNotes ? WRITE_FROM_NOTES_PROMPT : SYSTEM_PROMPT;
    const detailedInstruction = INSTRUCTION_MAP[instruction.toLowerCase().trim()] || `Fix ALL spelling mistakes, then ${instruction}.`;
    const userMessage = isWriteFromNotes
      ? `Write a complete email from these notes:\n\n${text}`
      : `${detailedInstruction}\n\nEmail text:\n${text}`;

    // Try Anthropic first (paid, best quality)
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const improved = await callAnthropic(process.env.ANTHROPIC_API_KEY, systemPrompt, userMessage);
        res.status(200).json({ improved: improved || text, provider: "anthropic" });
        return;
      } catch (e) { console.warn("Anthropic failed, trying Groq:", e.message); }
    }

    // Try Groq (free tier)
    if (process.env.GROQ_API_KEY) {
      try {
        const improved = await callGroq(process.env.GROQ_API_KEY, systemPrompt, userMessage);
        res.status(200).json({ improved: improved || text, provider: "groq" });
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
