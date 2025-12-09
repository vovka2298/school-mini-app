const express = require('express');
const { Redis } = require('@upstash/redis');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Upstash Redis
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const DATA_KEY = "school_app_all_data";

// Парсинг tgId из Telegram WebApp
function getTgId(req) {
  const initData = req.headers['x-telegram-webapp-init-data'];
  if (!initData) return null;

  try {
    const params = new URLSearchParams(initData);
    const userStr = params.get('user');
    if (!userStr) return null;
    const user = JSON.parse(userStr);
    return user.id.toString();
  } catch (e) {
    console.error('Parse initData error:', e);
    return null;
  }
}

async function loadData() {
  try {
    const data = await redis.get(DATA_KEY);
    return data || { users: {}, schedules: {}, profiles: {}, admins: [] };
  } catch (e) {
    console.error('Redis load error:', e);
    return { users: {}, schedules: {}, profiles: {}, admins: [] };
  }
}

async function saveData(data) {
  try {
    await redis.set(DATA_KEY, data);
  } catch (e) {
    console.error('Redis save error:', e);
    throw e;
  }
}

async function ensureAdmin(data) {
  const myId = "913096324"; // твой ID
  if (!data.admins.includes(myId)) {
    data.admins.push(myId);
    data.users[myId] = { name: "Владимир", role: "admin" };
    data.schedules[myId] = data.schedules[myId] || {};
    data.profiles[myId] = data.profiles[myId] || { subjects: [], gender: "Мужской" };
    await saveData(data);
  }
  return data;
}

// === API ===

app.get('/api/user', async (req, res) => {
  const tgId = getTgId(req);
  if (!tgId) return res.status(403).json({ error: "Unauthorized" });

  let data = await loadData();
  data = await ensureAdmin(data);

  const user = data.users[tgId];
  if (!user) return res.json({ role: null });

  res.json({
    role: data.admins.includes(tgId) ? 'admin' : 'teacher',
    name: user.name || "Преподаватель",
    photo: "",
    tgId
  });
});

app.get('/api/schedules', async (req, res) => {
  const tgId = getTgId(req);
  if (!tgId) return res.status(403).json({ error: "Unauthorized" });

  let data = await loadData();
  data = await ensureAdmin(data);

  if (!data.users[tgId]) return res.status(403).json({ error: "No access" });

  res.json(data.schedules);
});

app.post('/api/schedule/:tgId', async (req, res) => {
  const targetId = req.params.tgId;
  const authId = getTgId(req);
  if (!authId || authId !== targetId) return res.status(403).json({ error: "Forbidden" });

  let data = await loadData();
  data = await ensureAdmin(data);

  if (!data.schedules[targetId]) data.schedules[targetId] = {};
  Object.assign(data.schedules[targetId], req.body);

  await saveData(data);
  res.json({ ok: true });
});

app.get('/api/profile/:tgId', async (req, res) => {
  const targetId = req.params.tgId;
  const authId = getTgId(req);
  if (!authId || authId !== targetId) return res.status(403).json({ error: "Forbidden" });

  let data = await loadData();
  res.json(data.profiles?.[targetId] || { subjects: [], gender: "Мужской" });
});

app.post('/api/profile/:tgId', async (req, res) => {
  const targetId = req.params.tgId;
  const authId = getTgId(req);
  if (!authId || authId !== targetId) return res.status(403).json({ error: "Forbidden" });

  let data = await loadData();
  data = await ensureAdmin(data);

  data.profiles[targetId] = req.body;
  await saveData(data);
  res.json({ ok: true });
});

app.post('/api/approve_user', async (req, res) => {
  const authId = getTgId(req);
  if (!authId) return res.status(403).json({ error: "Unauthorized" });

  let data = await loadData();
  data = await ensureAdmin(data);
  if (!data.admins.includes(authId)) return res.status(403).json({ error: "Admin only" });

  const { tgId, name, role } = req.body;
  data.users[tgId] = { name, role };
  if (role === 'admin') data.admins.push(tgId);
  data.schedules[tgId] = data.schedules[tgId] || {};
  data.profiles[tgId] = data.profiles[tgId] || { subjects: [], gender: "Мужской" };
  await saveData(data);

  res.json({ ok: true });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log('Сервер запущен — данные сохраняются в Redis навсегда!'));
