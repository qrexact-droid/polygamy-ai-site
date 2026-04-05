// Vercel serverless function — POST /api/get-links
// Called from download.html after Stripe redirects with ?ref=paid&guide=XX
// Returns signed download URLs for the guides the customer purchased
// In production this should verify a Stripe session — for now it gates on ref=paid

const crypto = require('crypto');

const SECRET = process.env.DOWNLOAD_SECRET || 'poly-playbook-secret-2026';

const ALL_GUIDES = ['01','02','03','04','05','06','07','08','09','10'];

function makeToken(guideId) {
  const timestamp = Date.now().toString();
  const sig = crypto
    .createHmac('sha256', SECRET)
    .update(`${guideId}:${timestamp}`)
    .digest('hex');
  return Buffer.from(`${guideId}:${timestamp}:${sig}`).toString('base64');
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { guide, ref } = req.body || {};

  if (ref !== 'paid') {
    return res.status(403).json({ error: 'Access denied.' });
  }

  // If guide is specified, give only that guide (individual purchase)
  // If no guide, give all (bundle purchase)
  const guidesToServe = guide ? [String(guide).padStart(2, '0')] : ALL_GUIDES;

  const links = guidesToServe.map(g => ({
    guide: g,
    url: `/api/download?token=${encodeURIComponent(makeToken(g))}`,
  }));

  return res.status(200).json({ links });
};
