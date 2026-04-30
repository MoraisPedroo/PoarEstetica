// Vercel Serverless Proxy for WAHA API
// Solves Mixed Content (HTTPS -> HTTP) issue when deployed on Vercel

export default async function handler(req, res) {
    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const WAHA_URL = 'http://136.115.81.162:3000/api/sendText';
    const WAHA_API_KEY = 'segredo123';

    try {
        const response = await fetch(WAHA_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Api-Key': WAHA_API_KEY
            },
            body: JSON.stringify(req.body)
        });

        const data = await response.json().catch(() => ({}));
        return res.status(response.status).json(data);
    } catch (err) {
        return res.status(502).json({ error: 'WAHA proxy error', message: err.message });
    }
}
