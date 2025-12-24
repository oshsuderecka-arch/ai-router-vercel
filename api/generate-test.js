export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const keysEnv = process.env.OPENAI_KEYS;
  if (!keysEnv) {
    return res.status(500).json({ error: 'OPENAI_KEYS not set' });
  }

  const keys = keysEnv.split(',').map(k => k.trim());
  let lastError = null;

  for (let i = 0; i < keys.length; i++) {
    const apiKey = keys[i];

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: req.body.messages,
          temperature: 0.7
        })
      });

      if (response.ok) {
        const data = await response.json();
        return res.status(200).json(data);
      }

      // если лимит — пробуем следующий ключ
      if (response.status === 429) {
        lastError = 'Rate limit, switching key';
        continue;
      }

      // другая ошибка — сразу возвращаем
      const text = await response.text();
      return res.status(response.status).json({ error: text });

    } catch (err) {
      lastError = err.message;
    }
  }

  return res.status(429).json({
    error: 'All OpenAI keys are exhausted',
    details: lastError
  });
}
