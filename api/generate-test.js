export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages } = req.body;
  if (!Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages must be an array' });
  }

  const keysEnv = process.env.OPENAI_KEYS;
  if (!keysEnv) {
    return res.status(500).json({ error: 'OPENAI_KEYS not set' });
  }

  const keys = keysEnv.split(',').map(k => k.trim()).filter(Boolean);
  let lastError = null;

  for (const apiKey of keys) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15_000);

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4.1-mini',
          messages,
          temperature: 0.7
        })
      });

      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json();
        return res.status(200).json(data);
      }

      // rate limit — пробуем следующий ключ
      if (response.status === 429) {
        lastError = 'Rate limit, switching key';
        continue;
      }

      // другие ошибки — сразу отдаём
      const text = await response.text();
      return res.status(response.status).json({ error: text });

    } catch (err) {
      lastError = err.name === 'AbortError'
        ? 'Request timeout'
        : err.message;
    }
  }

  return res.status(429).json({
    error: 'All OpenAI keys are exhausted',
    details: lastError
  });
}
