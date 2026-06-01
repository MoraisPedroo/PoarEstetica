export default async function handler(req, res) {
    const traceId = Math.random().toString(36).slice(2, 8);
    const log = (...args) => console.log(`[waha-proxy ${traceId}]`, ...args);
    const logErr = (...args) => console.error(`[waha-proxy ${traceId}]`, ...args);

    log('--- request start ---');
    log('method:', req.method);
    log('url:', req.url);
    log('origin:', req.headers.origin);
    log('user-agent:', req.headers['user-agent']);
    log('headers:', JSON.stringify(req.headers));

    if (req.method !== 'POST' && req.method !== 'OPTIONS') {
        logErr('rejected: method not allowed');
        return res.status(405).json({ error: 'Method not allowed', traceId });
    }

    const origin = req.headers.origin || '';
    const allowOrigin = origin.endsWith('.vercel.app') || origin.includes('localhost')
        ? origin
        : '*';
    res.setHeader('Access-Control-Allow-Origin', allowOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Vary', 'Origin');
    res.setHeader('X-Trace-Id', traceId);

    if (req.method === 'OPTIONS') {
        log('preflight OK');
        return res.status(200).end();
    }

    const WAHA_URL = process.env.WAHA_URL;
    const WAHA_API_KEY = process.env.WAHA_API_KEY;

    log('env WAHA_URL present:', !!WAHA_URL);
    log('env WAHA_URL value:', WAHA_URL);
    log('env WAHA_API_KEY present:', !!WAHA_API_KEY);
    log('env WAHA_API_KEY length:', WAHA_API_KEY ? WAHA_API_KEY.length : 0);

    if (!WAHA_URL || !WAHA_API_KEY) {
        logErr('env missing -> 503');
        return res.status(503).json({
            error: 'service_not_configured',
            traceId,
            debug: { hasUrl: !!WAHA_URL, hasKey: !!WAHA_API_KEY }
        });
    }

    const body = req.body || {};
    log('incoming body:', JSON.stringify(body));

    if (!body.chatId || !body.text || typeof body.chatId !== 'string') {
        logErr('invalid payload -> 400');
        return res.status(400).json({
            error: 'invalid_payload',
            traceId,
            debug: { hasChatId: !!body.chatId, hasText: !!body.text, chatIdType: typeof body.chatId }
        });
    }
    if (body.text.length > 4096) {
        logErr('message too long ->', body.text.length);
        return res.status(413).json({ error: 'message_too_long', traceId });
    }

    const upstreamPayload = {
        chatId: body.chatId,
        text: body.text,
        session: body.session || 'default'
    };
    log('upstream payload:', JSON.stringify(upstreamPayload));
    log('upstream url:', WAHA_URL);

    const controller = new AbortController();
    const timeoutMs = 10000;
    const timeoutId = setTimeout(() => {
        logErr('aborting fetch — timeout', timeoutMs, 'ms');
        controller.abort();
    }, timeoutMs);

    const startedAt = Date.now();
    try {
        log('fetching upstream...');
        const response = await fetch(WAHA_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Api-Key': WAHA_API_KEY
            },
            body: JSON.stringify(upstreamPayload),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        const elapsed = Date.now() - startedAt;

        log('upstream status:', response.status, response.statusText);
        log('upstream time (ms):', elapsed);
        const respHeaders = {};
        response.headers.forEach((v, k) => { respHeaders[k] = v; });
        log('upstream headers:', JSON.stringify(respHeaders));

        const text = await response.text();
        log('upstream body raw (first 800 chars):', text.slice(0, 800));
        let data;
        try { data = JSON.parse(text); } catch { data = { raw: text }; }

        log('--- request end ---');
        return res.status(response.status).json({
            ...data,
            _proxy: { traceId, elapsedMs: elapsed, upstreamStatus: response.status }
        });
    } catch (err) {
        clearTimeout(timeoutId);
        const elapsed = Date.now() - startedAt;
        const reason = err.name === 'AbortError' ? 'upstream_timeout' : 'upstream_unreachable';

        logErr('fetch threw after', elapsed, 'ms');
        logErr('error name:', err.name);
        logErr('error message:', err.message);
        logErr('error code:', err.code);
        logErr('error cause:', err.cause);
        logErr('error cause code:', err.cause?.code);
        logErr('error stack:', err.stack);
        log('--- request end (error) ---');

        return res.status(502).json({
            error: reason,
            traceId,
            debug: {
                elapsedMs: elapsed,
                upstreamUrl: WAHA_URL,
                errorName: err.name,
                errorMessage: err.message,
                errorCode: err.code,
                causeCode: err.cause?.code,
                causeMessage: err.cause?.message
            }
        });
    }
}
