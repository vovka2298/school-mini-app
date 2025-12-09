const express = require('express');
const { Redis } = require('@upstash/redis');
const path = require('path');
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
// Upstash Redis — данные сохраняются навсегда
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: "default"
});
const DATA_KEY = "school_app_all_data";
// Глобальные данные
let appData = {
  users: {},
  schedules: {},
  profiles: {},
  admins: []
};
async function loadData() {
  try {
    const saved = await redis.get(DATA_KEY);
    if (saved) {
      appData = saved;
      console.log("Данные загружены из Redis");
    }
  } catch (e) {
    console.log("Ошибка загрузки:", e);
  }
  // ТЫ — ВЕЧНЫЙ АДМИН
  const myId = "913096324";
  if (!appData.admins.includes(myId)) {
    appData.admins.push(myId);
    appData.users[myId] = { name: "Владимир", role: "admin" };
    appData.schedules[myId] = appData.schedules[myId] || {};
    appData.profiles[myId] = appData.profiles[myId] || { subjects: [], gender: "Мужской" };
    await saveData();
  }
}
async function saveData() {
  try {
    await redis.set(DATA_KEY, appData);
  } catch (e) {
    console.log("Ошибка сохранения:", e);
  }
}
loadData(); // Загружаем при старте
// === API ===
app.get('/api/user', async (req, res) => {
  const id = "913096324";
  const user = appData.users[id];
  if (!user) return res.json({ role: null });
  res.json({
    role: appData.admins.includes(id) ? 'admin' : 'teacher',
    name: user.name,
    photo: "",
    tgId: id
  });
});
app.get('/api/schedules', async (req, res) => {
  const id = "913096324";
  if (!appData.users[id]) return res.status(403).send();
  res.json(appData.schedules);
});
app.post('/api/schedule/:tgId', async (req, res) => {
  const target = req.params.tgId;
  if (!appData.schedules[target]) appData.schedules[target] = {};
  Object.assign(appData.schedules[target], req.body);
  await saveData();
  res.json({ ok: true });
});
app.get('/api/profile/:tgId', async (req, res) => {
  res.json(appData.profiles?.[req.params.tgId] || { subjects: [], gender: "Мужской" });
});
app.post('/api/profile/:tgId', async (req, res) => {
  appData.profiles[req.params.tgId] = req.body;
  await saveData();
  res.json({ ok: true });
});
app.post('/api/approve_user', async (req, res) => {
  const { tgId, name, role } = req.body;
  appData.users[tgId] = { name, role };
  if (role === 'admin') appData.admins.push(tgId);
  appData.schedules[tgId] = appData.schedules[tgId] || {};
  appData.profiles[tgId] = appData.profiles[tgId] || { subjects: [], gender: "Мужской" };
  await saveData();
  res.json({ ok: true });
});
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
const port = process.env.PORT || 3000;
app.listen(port, () => console.log('Сервер запущен — данные сохраняются навсегда!'));
package.json
{
  "name": "school-mini-app",
  "version": "1.0.0",
  "description": "Кабинет расписания для преподавателей",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "@upstash/redis": "^1.34.0",
    "express": "^4.21.0"
  },
  "engines": {
    "node": "20.x"
  },
  "author": "Владимир",
  "license": "MIT"
}
