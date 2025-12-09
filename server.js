const express = require('express');
const { Redis } = require('@upstash/redis');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Подключаемся к Upstash
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: "default"
});

// === ДАННЫЕ ===
async function getData(key, defaultValue) {
  try {
    const value = await redis.get(key);
    if (value) return value;
  } catch (e) {
    console.log("Ошибка get:", e);
  }
  return defaultValue;
}

async function setData(key, value) {
  try {
    await redis.set(key, value);
    console.log("Данные сохранены");
  } catch (e) {
    console.log("Ошибка set:", e);
  }
}

// Загружаем данные при старте
let users = await getData('users', {});
let schedules = await getData('schedules', {});
let profiles = await getData('profiles', {});
let admins = await getData('admins', []);

// ТЫ — ВЕЧНЫЙ АДМИН
if (!admins.includes("913096324")) {
  admins.push("913096324");
  users["913096324"] = { name: "Владимир", role: "admin" };
  schedules["913096324"] = {};
  profiles["913096324"] = { subjects: [], gender: "Мужской" };
  await setData('users', users);
  await setData('schedules', schedules);
  await setData('profiles', profiles);
  await setData('admins', admins);
}

// === API ===
app.get('/api/user', async (req, res) => {
  const id = "913096324";
  const user = users[id];
  if (!user) return res.json({ role: null });
  res.json({
    role: admins.includes(id) ? 'admin' : 'teacher',
    name: user.name,
    photo: "",
    tgId: id
  });
});

app.get('/api/schedules', async (req, res) => {
  const id = "913096324";
  if (!users[id]) return res.status(403).send();
  res.json(schedules);
});

app.post('/api/schedule/:tgId', async (req, res) => {
  const target = req.params.tgId;
  if (!schedules[target]) schedules[target] = {};
  Object.assign(schedules[target], req.body);
  await setData('schedules', schedules);
  res.json({ ok: true });
});

app.get('/api/profile/:tgId', async (req, res) => {
  res.json(profiles[req.params.tgId] || { subjects: [], gender: "Мужской" });
});

app.post('/api/profile/:tgId', async (req, res) => {
  profiles[req.params.tgId] = req.body;
  await setData('profiles', profiles);
  res.json({ ok: true });
});

app.post('/api/approve_user', async (req, res) => {
  const { tgId, name, role } = req.body;
  users[tgId] = { name, role };
  if (role === 'admin') admins.push(tgId);
  schedules[tgId] = schedules[tgId] || {};
  profiles[tgId] = profiles[tgId] || { subjects: [], gender: "Мужской" };
  await setData('users', users);
  await setData('schedules', schedules);
  await setData('profiles', profiles);
  await setData('admins', admins);
  res.json({ ok: true });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log('Сервер запущен с Upstash'));
