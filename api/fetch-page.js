const OPENAI_API = "https://api.openai.com/v1/chat/completions";

const EXTRACT_PROMPT = `You are a web content extractor. Given HTML or web page text, extract the main content.
Return ONLY raw JSON (no markdown, no backticks):
{"title": "page title", "content": "main article text and headings, no nav/footer/ads, max 3000 chars"}`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: { message: "Method not allowed" } });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: { message: "OPENAI_API_KEY is not configured" } });
    return;
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { url } = body || {};
    if (!url) {
      res.status(400).json({ error: { message: "url is required" } });
      return;
    }

    const cleanUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;

    const pageRes = await fetch(cleanUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AEOOptimizer/1.0)" },
      signal: AbortSignal.timeout(15000),
    });
    if (!pageRes.ok) {
      res.status(502).json({ error: { message: `Failed to fetch URL: ${pageRes.status}` } });
      return;
    }
    const html = await pageRes.text();
    const textForModel = html.slice(0, 50000);

    const openaiRes = await fetch(OPENAI_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: EXTRACT_PROMPT },
          { role: "user", content: `Extract content from this page:\n\n${textForModel}` },
        ],
        max_tokens: 3000,
      }),
    });

    const data = await openaiRes.json().catch(() => ({}));
    if (!openaiRes.ok) {
      res.status(openaiRes.status).json(data);
      return;
    }

    const raw = data.choices?.[0]?.message?.content ?? "";
    res.status(200).json({ raw });
  } catch (err) {
    res.status(500).json({ error: { message: err.message || "Fetch error" } });
  }
}
