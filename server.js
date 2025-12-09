// server.js — РАБОЧАЯ ВЕРСИЯ (декабрь 2025)

const express = require('express');
const { Redis } = require('@upstash/redis');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Upstash Redis (убедись, что переменные окружения заданы в Vercel!)
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const DATA_KEY = "school_app_all_data_v2";

function getTgId(req) {
  let initData = req.headers['x-telegram-webapp-init-data'] ||
                  req.headers['x-telegram-web-app-init-data'] ||
                  req.query.initData || '';

  if (!initData) return null;

  try {
    const params = new URLSearchParams(initData);
    const userStr = params.get('user');
    if (!userStr) return null;
    const user = JSON.parse(userStr);
    return user.id.toString();
  } catch (e) {
    console.error('Ошибка парсинга initData:', e);
    return null;
  }
}

async function getData() {
  try {
    const data = await redis.get(DATA_KEY);
    return data || { users: {}, schedules: {}, profiles: {}, admins: [] };
  } catch (e) {
    console.error('Redis ошибка чтения:', e);
    return { users: {}, schedules: {}, profiles: {}, admins: [] };
  }
}

async function saveData(data) {
  try {
    await redis.set(DATA_KEY, data);
  } catch (e) {
    console.error('Redis ошибка записи:', e);
  }
}

async function ensureMyAdmin(data) {
  const myId = "913096324";
  if (!data.admins.includes(myId)) {
    data.admins.push(myId);
    data.users[myId] = { name: "Владимир", role: "admin" };
    data.schedules[myId] = {};
    data.profiles[myId] = { subjects: [], gender: "Мужской" };
    await saveData(data);
  }
  return data;
}

// === API ===

app.get('/api/user', async (req, res) => {
  const tgId = getTgId(req);
  if (!tgId) return res.status(401).json({ error: "No auth" });

  let data = await getData();
  data = await ensureMyAdmin(data);

  const user = data.users[tgId];
  res.json({
    role: data.admins.includes(tgId) ? 'admin' : (user?.role || 'teacher'),
    name: user?.name || "Преподаватель",
    photo: "",
    tgId
  });
});

app.get('/api/schedules', async (req, res) => {
  const tgId = getTgId(req);
  if (!tgId) return res.status(401).json({ error: "No auth" });

  const data = await getData();
  res.json(data.schedules[tgId] || {});
});

app.post('/api/schedule/:tgId', async (req, res) => {
  const tgId = req.params.tgId;
  const authId = getTgId(req);
  if (tgId !== authId) return res.status(403).json({ error: "Forbidden" });

  let data = await getData();
  data.schedules[tgId] = data.schedules[tgId] || {};
  Object.assign(data.schedules[tgId], req.body);
  await saveData(data);
  res.json({ ok: true });
});

app.get('/api/profile/:tgId', async (req, res) => {
  const tgId = req.params.tgId;
  const authId = getTgId(req);
  if (tgId !== authId) return res.status(403).json({ error: "Forbidden" });

  const data = await getData();
  res.json(data.profiles[tgId] || { subjects: [], gender: "Мужской" });
});

app.post('/api/profile/:tgId', async (req, res) => {
  const tgId = req.params.tgId;
  const authId = getTgId(req);
  if (tgId !== authId) return res.status(403).json({ error: "Forbidden" });

  let data = await getData();
  data.profiles[tgId] = req.body;
  await saveData(data);
  res.json({ ok: true });
});

// Для админа — одобрение новых пользователей
app.post('/api/approve_user', async (req, res) => {
  const adminId = getTgId(req);
  if (!adminId) return res.status(401).json({ error: "No auth" });

  let data = await getData();
  data = await ensureMyAdmin(data);
  if (!data.admins.includes(adminId)) return res.status(403).json({ error: "Admin only" });

  const { tgId, name, role = "teacher" } = req.body;
  data.users[tgId] = { name, role };
  data.schedules[tgId] = {};
  data.profiles[tgId] = { subjects: [], gender: "Мужской" };
  await saveData(data);
  res.json({ ok: true });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Сервер запущен на порту ${port}`);
  console.log('Redis URL:', process.env.UPSTASH_REDIS_REST_URL ? 'OK' : 'ОТСУТСТВУЕТ!');
});
