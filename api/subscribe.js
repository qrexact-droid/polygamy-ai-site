// Vercel serverless function — POST /api/subscribe
// Collects emails and appends to a simple log (or sends to Brevo if configured)

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { email } = req.body || {};
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Invalid email' });

  const clean = String(email).toLowerCase().trim().slice(0, 254);

  // Try Brevo (Sendinblue) if API key is set
  const brevoKey = process.env.BREVO_API_KEY;
  if (brevoKey) {
    try {
      await fetch('https://api.brevo.com/v3/contacts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': brevoKey,
        },
        body: JSON.stringify({
          email: clean,
          listIds: [2],
          updateEnabled: true,
          attributes: { SOURCE: 'polygamy.ai email capture' },
        }),
      });
    } catch (e) {
      console.error('Brevo error:', e.message);
    }
  }

  console.log(`[subscribe] ${clean} ${new Date().toISOString()}`);
  return res.status(200).json({ ok: true });
};
