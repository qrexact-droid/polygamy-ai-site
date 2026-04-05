// Vercel serverless function — GET /api/download?token=XXX
// Serves PDFs only to customers with a valid signed token
// Token = base64(guideId:timestamp:hmac) — expires after 2 hours

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SECRET = process.env.DOWNLOAD_SECRET || 'poly-playbook-secret-2026';

const GUIDE_MAP = {
  '00': '00_complete_enm_guide.pdf',
  '01': '01_jealousy_decoded.pdf',
  '02': '02_opening_up_guide.pdf',
  '03': '03_communication_scripts.pdf',
  '04': '04_solo_poly.pdf',
  '05': '05_kids_and_poly.pdf',
  '06': '06_long_distance_poly.pdf',
  '07': '07_relationship_anarchy.pdf',
  '08': '08_common_mistakes.pdf',
  '09': '09_calendar_and_time.pdf',
  '10': '10_glossary_and_foundations.pdf',
  'bundle': null, // bundle = all guides, handled separately
};

function signToken(guideId, timestamp) {
  return crypto
    .createHmac('sha256', SECRET)
    .update(`${guideId}:${timestamp}`)
    .digest('hex');
}

function verifyToken(token) {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const [guideId, timestamp, sig] = decoded.split(':');
    const now = Date.now();
    const ts = parseInt(timestamp, 10);
    // Expires after 2 hours
    if (now - ts > 2 * 60 * 60 * 1000) return null;
    const expected = signToken(guideId, timestamp);
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    return guideId;
  } catch {
    return null;
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token } = req.query;

  if (!token) {
    return res.status(403).json({ error: 'Access denied. No token provided.' });
  }

  const guideId = verifyToken(token);

  if (!guideId) {
    return res.status(403).json({ error: 'Access denied. Invalid or expired link.' });
  }

  if (!(guideId in GUIDE_MAP)) {
    return res.status(404).json({ error: 'Guide not found.' });
  }

  const filename = GUIDE_MAP[guideId];
  const filePath = path.join(process.cwd(), 'private_books', filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found on server.' });
  }

  const stat = fs.statSync(filePath);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', stat.size);
  res.setHeader('Cache-Control', 'no-store');

  const stream = fs.createReadStream(filePath);
  stream.pipe(res);
};
