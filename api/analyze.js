const rateLimit = new Map();

const LIMIT = 4;
const WINDOW_MS = 60 * 60 * 1000;

function getIP(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

function checkRateLimit(ip) {
  const now = Date.now();
  const record = rateLimit.get(ip);

  if (!record || now - record.windowStart > WINDOW_MS) {
    rateLimit.set(ip, { count: 1, windowStart: now });
    return { allowed: true, remaining: LIMIT - 1 };
  }

  if (record.count >= LIMIT) {
    const resetIn = Math.ceil((WINDOW_MS - (now - record.windowStart)) / 60000);
    return { allowed: false, resetIn };
  }

  record.count++;
  return { allowed: true, remaining: LIMIT - record.count };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = getIP(req);
  const rate = checkRateLimit(ip);

  if (!rate.allowed) {
    return res.status(429).json({
      error: `Has superado el límite de ${LIMIT} análisis por hora. Puedes volver a intentarlo en ${rate.resetIn} minuto${rate.resetIn !== 1 ? 's' : ''}.`,
      rateLimited: true,
      resetIn: rate.resetIn
    });
  }

  const { cvText, pdfBase64, jobText } = req.body;

  if (!jobText) return res.status(400).json({ error: 'Falta la oferta de trabajo' });
  if (!cvText && !pdfBase64) return res.status(400).json({ error: 'Falta el CV' });

  const prompt = `Eres un experto en selección de personal y ATS (Applicant Tracking Systems). Analiza la compatibilidad entre el CV ${pdfBase64 ? '(adjunto como PDF)' : '(en texto)'} y esta oferta de trabajo.

OFERTA DE TRABAJO:
${jobText}

${cvText ? `CV DEL CANDIDATO:\n${cvText}` : ''}

Responde ÚNICAMENTE con un JSON válido, sin markdown, sin backticks, sin texto adicional:
{
  "score": <número del 0 al 100>,
  "keywords_present": [<palabras clave del candidato que coinciden>],
  "keywords_missing": [<palabras clave importantes que faltan en el CV>],
  "analysis": "<análisis detallado en 3-4 párrafos>",
  "improvements": "<recomendaciones concretas en 3-4 puntos>"
}`;

  let userContent;

  if (pdfBase64) {
    userContent = [
      { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
      { type: 'text', text: prompt }
    ];
  } else {
    userContent = prompt;
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages: [{ role: 'user', content: userContent }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({ error: data.error?.message || 'Error de API', detail: data });
    }

    const text = data.content.map(i => i.text || '').join('');
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    return res.status(200).json({ ...parsed, remaining: rate.remaining });
  } catch (err) {
    return res.status(500).json({ error: 'Error al procesar la respuesta' });
  }
}
