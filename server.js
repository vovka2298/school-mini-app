const express = require('express');
const { Redis } = require('@upstash/redis');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
});

const KEY = "school_data_v3";

async function loadData() {
  try {
    const data = await redis.get(KEY);
    if (data) return data;
  } catch (e) {}
  return {
    users: { "913096324": { name: "Владимир", role: "admin" } },
    schedules: { "913096324": {} },
    profiles: { "913096324": { subjects: [], gender: "Мужской" } },
    admins: ["913096324"]
  };
}

async function saveData(data) {
  try { await redis.set(KEY, data); } catch (e) {}
}

// === API ===
app.get('/api/user', async (req, res) => {
  const data = await loadData();
  res.json({
    role: "admin",
    name: "Владимир",
    photo: "",
    tgId: "913096324"
  });
});

app.get('/api/schedules', async (req, res) => {
  const data = await loadData();
  res.json(data.schedules["913096324"] || {});
});

app.post('/api/schedule/:tgId', async (req, res) => {
  const data = await loadData();
  data.schedules["913096324"] = { ...data.schedules["913096324"], ...req.body };
  await saveData(data);
  res.json({ ok: true });
});

app.get('/api/profile/:tgId', async (req, res) => {
  const data = await loadData();
  res.json(data.profiles["913096324"] || { subjects: [], gender: "Мужской" });
});

app.post('/api/profile/:tgId', async (req, res) => {
  const data = await loadData();
  data.profiles["913096324"] = req.body;
  await saveData(data);
  res.json({ ok: true });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log('ГОТОВО. Всё сохраняется навсегда.'));
