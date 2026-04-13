// Vercel serverless function — POST /api/ask
// Supports both single question (legacy) and full conversation history

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { question, messages } = req.body || {};

  // Build messages array — supports both legacy single-question and new conversation mode
  let chatMessages;
  if (Array.isArray(messages) && messages.length > 0) {
    chatMessages = messages.map(m => ({ role: m.role, content: String(m.content).slice(0, 2000) }));
  } else if (question) {
    chatMessages = [{ role: 'user', content: String(question).trim().slice(0, 2000) }];
  } else {
    return res.status(400).json({ error: 'A question is required.' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'AI service not configured.' });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        system: `You are a warm, experienced voice in the polyamory and ethical non-monogamy community. You give honest, practical, non-judgmental advice. You write like a wise friend who has been in the community for years — not a therapist, not an academic. Keep answers to 3-5 sentences that are genuinely useful. No bullet points. No preamble. Just straight, caring, real advice. Remember prior messages in the conversation and build on them naturally.`,
        messages: chatMessages,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Anthropic API error:', response.status, errText);
      return res.status(502).json({ error: 'AI service error. Please try again.' });
    }

    const data = await response.json();
    const answer =
      data.content
        ?.filter(b => b.type === 'text')
        .map(b => b.text)
        .join('') || "I wasn't able to generate an answer right now. Please try again.";

    return res.status(200).json({ answer });
  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
};
