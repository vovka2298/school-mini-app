const express = require('express');
const { Redis } = require('@upstash/redis');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let redis;
try {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL || "https://tough-bunny-46893.upstash.io",
    token: "default"
  });
} catch (e) {
  console.log("Redis не подключился");
}

// === ДАННЫЕ ===
let cache = { users: {}, schedules: {}, profiles: {}, admins: [] };

async function load() {
  try {
    const data = await redis.get("app_data");
    if (data) cache = data;
  } catch (e) {}

  // Ты — вечный админ
  if (!cache.admins?.includes("913096324")) {
    cache.admins = cache.admins || [];
    cache.admins.push("913096324");
    cache.users["913096324"] = { name: "Владимир", role: "admin" };
    cache.schedules["913096324"] = {};
    cache.profiles["913096324"] = { subjects: [], gender: "Мужской" };
    await save();
  }
}

async function save() {
  try {
    await redis.set("app_data", cache);
  } catch (e) {}
}

load();

// === API ===
app.get('/api/user', async (req, res) => {
  const id = "913096324";
  const user = cache.users[id];
  if (!user) return res.json({ role: null });
  res.json({
    role: cache.admins.includes(id) ? 'admin' : 'teacher',
    name: user.name,
    photo: "",
    tgId: id
  });
});

app.get('/api/schedules', async (req, res) => {
  const id = "913096324";
  if (!cache.users[id]) return res.status(403).send();
  res.json(cache.schedules);
});

app.post('/api/schedule/:tgId', async (req, res) => {
  const target = req.params.tgId;
  if (!cache.schedules[target]) cache.schedules[target] = {};
  Object.assign(cache.schedules[target], req.body);
  await save();
  res.json({ ok: true });
});

app.get('/api/profile/:tgId', async (req, res) => {
  res.json(cache.profiles?.[req.params.tgId] || { subjects: [], gender: "Мужской" });
});

app.post('/api/profile/:tgId', async (req, res) => {
  cache.profiles[req.params.tgId] = req.body;
  await save();
  res.json({ ok: true });
});

app.post('/api/approve_user', async (req, res) => {
  const { tgId, name, role } = req.body;
  cache.users[tgId] = { name, role };
  if (role === 'admin') cache.admins.push(tgId);
  cache.schedules[tgId] = cache.schedules[tgId] || {};
  cache.profiles[tgId] = cache.profiles[tgId] || { subjects: [], gender: "Мужской" };
  await save();
  res.json({ ok: true });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log('Запущено!'));
