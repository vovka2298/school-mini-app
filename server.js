const express = require('express');
const { Redis } = require('@upstash/redis');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Подключаемся к твоей базе Upstash
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: "default"
});

// === ДАННЫЕ ===
let cache = { users: {}, schedules: {}, profiles: {}, admins: [] };

async function load() {
  const [u, s, p, a] = await Promise.all([
    redis.get('data:users'),
    redis.get('data:schedules'),
    redis.get('data:profiles'),
    redis.get('data:admins')
  ]);
  if (u) cache.users = u;
  if (s) cache.schedules = s;
  if (p) cache.profiles = p;
  if (a) cache.admins = a || [];

  // Ты — вечный админ
  if (!cache.admins.includes("913096324")) {
    cache.admins.push("913096324");
    cache.users["913096324"] = { name: "Владимир", role: "admin" };
    cache.schedules["913096324"] = {};
    cache.profiles["913096324"] = { subjects: [], gender: "Мужской" };
    await save();
  }
}

async function save() {
  await Promise.all([
    redis.set('data:users', cache.users),
    redis.set('data:schedules', cache.schedules),
    redis.set('data:profiles', cache.profiles),
    redis.set('data:admins', cache.admins)
  ]);
}

load(); // Загружаем при старте

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
  const isAdmin = cache.admins.includes(id);
  res.json(isAdmin ? cache.schedules : { [id]: cache.schedules[id] || {} });
});

app.post('/api/schedule/:tgId', async (req, res) => {
  const target = req.params.tgId;
  const curr = "913096324";
  if (curr !== target && !cache.admins.includes(curr)) return res.status(403).send();
  if (!cache.schedules[target]) cache.schedules[target] = {};
  Object.assign(cache.schedules[target], req.body);
  await save();
  res.json({ ok: true });
});

app.get('/api/profile/:tgId', async (req, res) => {
  res.json(cache.profiles?.[req.params.tgId] || { subjects: [], gender: "Мужской" });
});

app.post('/api/profile/:tgId', async (req, res) => {
  const target = req.params.tgId;
  const curr = "913096324";
  if (curr !== target && !cache.admins.includes(curr)) return res.status(403).send();
  cache.profiles[target] = req.body;
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
app.listen(port, () => console.log('Запущено с Upstash Redis!'));
