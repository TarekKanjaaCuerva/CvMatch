const rateLimit = new Map();
const LIMIT = 3;
const WINDOW_MS = 60 * 60 * 1000;

function getIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.headers['x-real-ip'] || 'unknown';
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
      error: `Has superado el límite de ${LIMIT} CVs generados por hora. Puedes volver en ${rate.resetIn} minuto${rate.resetIn !== 1 ? 's' : ''}.`,
      rateLimited: true
    });
  }

  const { nombre, puesto, experiencia, habilidades, formacion, idiomas, logros, tono } = req.body;
  if (!nombre || !puesto) return res.status(400).json({ error: 'Faltan datos obligatorios' });

  const prompt = `Eres un experto redactor de CVs profesionales en español. Genera el texto completo de un CV profesional y convincente basado en los siguientes datos del candidato.

DATOS DEL CANDIDATO:
- Nombre: ${nombre}
- Puesto objetivo: ${puesto}
- Experiencia laboral: ${experiencia || 'No especificada'}
- Habilidades: ${habilidades || 'No especificadas'}
- Formación: ${formacion || 'No especificada'}
- Idiomas: ${idiomas || 'No especificados'}
- Logros destacados: ${logros || 'No especificados'}
- Tono deseado: ${tono || 'Profesional'}

INSTRUCCIONES:
- Genera un CV completo y profesional listo para usar
- Incluye: Resumen profesional (3-4 líneas potentes), Experiencia, Formación, Habilidades, Idiomas
- El resumen debe ser impactante y orientado al puesto objetivo
- Usa verbos de acción y cuantifica logros cuando sea posible
- Optimiza el texto para sistemas ATS incluyendo keywords relevantes para el puesto
- Formato claro con secciones bien diferenciadas usando ===== como separador de sección
- Tono: ${tono || 'profesional y directo'}
- Escribe TODO en español

Responde ÚNICAMENTE con el texto del CV, sin explicaciones ni comentarios adicionales.`;

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
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(500).json({ error: data.error?.message || 'Error de API' });

    const cvText = data.content.map(i => i.text || '').join('');
    return res.status(200).json({ cv: cvText, remaining: rate.remaining });
  } catch (err) {
    return res.status(500).json({ error: 'Error al generar el CV' });
  }
}
