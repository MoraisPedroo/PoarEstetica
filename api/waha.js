export default async function handler(req, res) {
    if (req.method !== 'POST' && req.method !== 'OPTIONS') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const origin = req.headers.origin || '';
    const allowOrigin = origin.endsWith('.vercel.app') || origin.includes('localhost')
        ? origin
        : '*';
    res.setHeader('Access-Control-Allow-Origin', allowOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Vary', 'Origin');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const WAHA_URL = process.env.WAHA_URL;
    const WAHA_API_KEY = process.env.WAHA_API_KEY;

    if (!WAHA_URL || !WAHA_API_KEY) {
        return res.status(500).json({ error: 'Service not configured' });
    }

    const body = req.body || {};
    if (!body.chatId || !body.text || typeof body.chatId !== 'string') {
        return res.status(400).json({ error: 'Invalid payload' });
    }
    if (body.text.length > 4096) {
        return res.status(413).json({ error: 'Message too long' });
    }

    try {
        const response = await fetch(WAHA_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Api-Key': WAHA_API_KEY
            },
            body: JSON.stringify({
                chatId: body.chatId,
                text: body.text,
                session: body.session || 'default'
            })
        });

        const data = await response.json().catch(() => ({}));
        return res.status(response.status).json(data);
    } catch (err) {
        return res.status(502).json({ error: 'Upstream error' });
    }
}
