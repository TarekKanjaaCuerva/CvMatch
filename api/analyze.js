export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

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
      return res.status(500).json({ error: data.error?.message || 'Error de API' });
    }

    const text = data.content.map(i => i.text || '').join('');
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: 'Error al procesar la respuesta' });
  }
}
