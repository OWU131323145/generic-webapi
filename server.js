const express = require('express');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// 設定
const PROVIDER = 'openai';   // 'openai' or 'gemini'
const MODEL = 'gpt-4o-mini'; // OpenAI: 'gpt-4o-mini', Gemini: 'gemini-2.5-flash'

let promptTemplate;
try {
  promptTemplate = fs.readFileSync('prompt.md', 'utf8');
} catch (error) {
  console.error('Error reading prompt.md:', error);
  process.exit(1);
}

const OPENAI_API_ENDPOINT = "https://openai-api-proxy-746164391621.us-west1.run.app";
const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models/';

// ---- Sync storage (file-based) ----
const DATA_DIR = path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

function safeCode(code) {
  return String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
}
function mergeById(a = [], b = []) {
  const map = new Map();
  for (const it of a) if (it && it.id) map.set(it.id, it);
  for (const it of b) if (it && it.id) map.set(it.id, it);
  return [...map.values()].sort((x, y) => (x.savedAt || 0) - (y.savedAt || 0));
}
function readSyncFile(file) {
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function writeSyncFile(file, obj) {
  fs.writeFileSync(file, JSON.stringify(obj, null, 2), 'utf8');
}

app.post('/api/', async (req, res) => {
  try {
    const { prompt, title = 'Generated Content', ...variables } = req.body;

    let finalPrompt = prompt || promptTemplate;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\$\\{${key}\\}`, 'g');
      finalPrompt = finalPrompt.replace(regex, value);
    }

    let result;
    if (PROVIDER === 'openai') result = await callOpenAI(finalPrompt);
    else if (PROVIDER === 'gemini') result = await callGemini(finalPrompt);
    else return res.status(400).json({ error: 'Invalid provider configuration' });

    res.json({ title, data: result });
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ---- Auto Sync endpoints ----
// POST: merge and save
app.post('/sync/:code', (req, res) => {
  try {
    const code = safeCode(req.params.code);
    if (!code || code.length < 4) return res.status(400).json({ error: 'Invalid code' });

    const file = path.join(DATA_DIR, `sync-${code}.json`);
    const incoming = req.body || {};
    const incomingItems = Array.isArray(incoming.items) ? incoming.items : [];

    const current = readSyncFile(file);
    const currentItems = current?.data?.items && Array.isArray(current.data.items) ? current.data.items : [];

    const mergedItems = mergeById(currentItems, incomingItems);

    const payload = {
      savedAt: Date.now(),
      code,
      data: {
        version: incoming.version || current?.data?.version || "v5",
        items: mergedItems,
        lastPush: {
          device: incoming.device || "unknown",
          pushedAt: incoming.exportedAt || Date.now()
        }
      }
    };

    writeSyncFile(file, payload);

    res.json({
      ok: true,
      code,
      savedAt: payload.savedAt,
      mergedItems: mergedItems.length,
      receivedItems: incomingItems.length
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET: download
app.get('/sync/:code', (req, res) => {
  try {
    const code = safeCode(req.params.code);
    if (!code || code.length < 4) return res.status(400).json({ error: 'Invalid code' });

    const file = path.join(DATA_DIR, `sync-${code}.json`);
    if (!fs.existsSync(file)) return res.status(404).json({ error: 'Not found' });

    const obj = JSON.parse(fs.readFileSync(file, 'utf8'));
    res.json(obj);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Optional cleanup
app.delete('/sync/:code', (req, res) => {
  try {
    const code = safeCode(req.params.code);
    const file = path.join(DATA_DIR, `sync-${code}.json`);
    if (fs.existsSync(file)) fs.unlinkSync(file);
    res.json({ ok: true, code });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

async function callOpenAI(prompt) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY environment variable is not set');

  const response = await fetch(OPENAI_API_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'system', content: prompt }],
      max_completion_tokens: 2000,
      response_format: { type: "json_object" }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const responseText = data.choices?.[0]?.message?.content;
  if (!responseText) throw new Error('OpenAI API returned empty content');

  try { return JSON.parse(responseText); }
  catch (e) { throw new Error('Failed to parse LLM response: ' + e.message); }
}

async function callGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY environment variable is not set');

  const response = await fetch(`${GEMINI_API_BASE_URL}${MODEL}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 3000, response_mime_type: "application/json" }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!responseText) throw new Error('Gemini API returned empty content');

  try { return JSON.parse(responseText); }
  catch (e) { throw new Error('Failed to parse LLM response: ' + e.message); }
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Config: ${PROVIDER} - ${MODEL}`);
});
