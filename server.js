const express = require('express');
const { Redis } = require('@upstash/redis');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Подключаемся к твоей Upstash Redis
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: "default"
});

const DATA_KEY = "school_app_data";

// Загружаем данные один раз при старте
let data = { users: {}, schedules: {}, profiles: {}, admins: [] };

async function loadData() {
  try {
    const saved = await redis.get(DATA_KEY);
    if (saved) {
      data = saved;
      console.log("Данные загружены из Redis");
    } else {
      console.log("Redis пустой — создаём начальные данные");
    }
  } catch (e) {
    console.log("Ошибка загрузки из Redis:", e);
  }

  // ТЫ — ВЕЧНЫЙ АДМИН
  if (!data.admins?.includes("913096324")) {
    data.admins = data.admins || [];
    data.admins.push("913096324");
    data.users["913096324"] = { name: "Владимир", role: "admin" };
    data.schedules["913096324"] = data.schedules["913096324"] || {};
    data.profiles["913096324"] = data.profiles["913096324"] || { subjects: [], gender: "Мужской" };
    await saveData();
  }
}

async function saveData() {
  try {
    await redis.set(DATA_KEY, data);
    console.log("Данные сохранены в Redis");
  } catch (e) {
    console.log("Ошибка сохранения:", e);
  }
}

// Загружаем при старте
loadData();

// === API ===
app.get('/api/user', async (req, res) => {
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
  const id = "913096324";
  if (!data.users[id]) return res.status(403).send();
  res.json(data.schedules);
});

app.post('/api/schedule/:tgId', async (req, res) => {
  const target = req.params.tgId;
  if (!data.schedules[target]) data.schedules[target] = {};
  Object.assign(data.schedules[target], req.body);
  await saveData();
  res.json({ ok: true });
});

app.get('/api/profile/:tgId', async (req, res) => {
  res.json(data.profiles?.[req.params.tgId] || { subjects: [], gender: "Мужской" });
});

app.post('/api/profile/:tgId', async (req, res) => {
  data.profiles[req.params.tgId] = req.body;
  await saveData();
  res.json({ ok: true });
});

app.post('/api/approve_user', async (req, res) => {
  const { tgId, name, role } = req.body;
  data.users[tgId] = { name, role };
  if (role === 'admin') data.admins.push(tgId);
  data.schedules[tgId] = data.schedules[tgId] || {};
  data.profiles[tgId] = data.profiles[tgId] || { subjects: [], gender: "Мужской" };
  await saveData();
  res.json({ ok: true });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log('Запущено с вечным сохранением!'));
