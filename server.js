const express = require('express');
const { Redis } = require('@upstash/redis');
const path = require('path');
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Redis
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
});

const DATA_KEY = "school_app_all_data";

// Функция для загрузки данных из Redis перед каждым запросом
async function getData() {
  try {
    const saved = await redis.get(DATA_KEY);
    return saved || {
      users: {},
      schedules: {},
      profiles: {},
      admins: []
    };
  } catch (e) {
    console.log("Ошибка загрузки:", e);
    return {
      users: {},
      schedules: {},
      profiles: {},
      admins: []
    };
  }
}

// Функция для сохранения данных в Redis после изменения
async function setData(data) {
  try {
    await redis.set(DATA_KEY, data);
  } catch (e) {
    console.log("Ошибка сохранения:", e);
  }
}

// Вечный админ
async function ensureAdmin(data) {
  const myId = "913096324";
  if (!data.admins.includes(myId)) {
    data.admins.push(myId);
    data.users[myId] = { name: "Владимир", role: "admin" };
    data.schedules[myId] = data.schedules[myId] || {};
    data.profiles[myId] = data.profiles[myId] || { subjects: [], gender: "Мужской" };
  }
  return data;
}

// API — теперь stateless: load → modify → save
app.get('/api/user', async (req, res) => {
  let data = await getData();
  data = await ensureAdmin(data);
  const id = "913096324";
  const user = data.users[id];
  if (!user) return res.json({ role: null });
  res.json({
    role: data.admins.includes(id) ? 'admin' : 'teacher',
    name: user.name,
    photo: "",
    tgId: id
  });
});

app.get('/api/schedules', async (req, res) => {
  let data = await getData();
  const id = "913096324";
  if (!data.users[id]) return res.status(403).send();
  res.json(data.schedules);
});

app.post('/api/schedule/:tgId', async (req, res) => {
  let data = await getData();
  const target = req.params.tgId;
  if (!data.schedules[target]) data.schedules[target] = {};
  Object.assign(data.schedules[target], req.body);
  await setData(data);
  res.json({ ok: true });
});

app.get('/api/profile/:tgId', async (req, res) => {
  let data = await getData();
  res.json(data.profiles?.[req.params.tgId] || { subjects: [], gender: "Мужской" });
});

app.post('/api/profile/:tgId', async (req, res) => {
  let data = await getData();
  data.profiles[req.params.tgId] = req.body;
  await setData(data);
  res.json({ ok: true });
});

app.post('/api/approve_user', async (req, res) => {
  let data = await getData();
  const { tgId, name, role } = req.body;
  data.users[tgId] = { name, role };
  if (role === 'admin') data.admins.push(tgId);
  data.schedules[tgId] = data.schedules[tgId] || {};
  data.profiles[tgId] = data.profiles[tgId] || { subjects: [], gender: "Мужской" };
  await setData(data);
  res.json({ ok: true });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log('Сервер запущен — всё сохраняется навсегда'));
