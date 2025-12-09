const express = require('express');
const { Redis } = require('@upstash/redis');
const path = require('path');
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Upstash Redis — данные сохраняются навсегда
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN  // ФИКС: правильный токен из env
});

const DATA_KEY = "school_app_all_data";

// Хелпер: Получить tgId из Telegram initData (для авторизации)
function getTgId(req) {
  const initData = req.headers['x-telegram-webapp-init-data'];  // Telegram передаёт в headers
  if (!initData) return null;
  
  const params = new URLSearchParams(initData);
  const userStr = params.get('user');
  if (!userStr) return null;
  
  try {
    const user = JSON.parse(userStr);
    return user.id.toString();
  } catch {
    return null;
  }
}

// Хелпер: Загрузить все данные из Redis (или дефолт)
async function loadAllData() {
  try {
    const saved = await redis.get(DATA_KEY);
    if (saved) return saved;
  } catch (e) {
    console.error("Ошибка загрузки данных:", e);
  }
  // Дефолтные данные
  return {
    users: {},
    schedules: {},
    profiles: {},
    admins: []
  };
}

// Хелпер: Сохранить все данные в Redis
async function saveAllData(data) {
  try {
    await redis.set(DATA_KEY, data);
  } catch (e) {
    console.error("Ошибка сохранения данных:", e);
    throw e;  // Чтобы эндпоинты возвращали ошибку
  }
}

// Инициализация твоего админа (вызывается при необходимости)
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

// === API ===
// Все эндпоинты теперь stateless: load → modify → save

app.get('/api/user', async (req, res) => {
  const tgId = getTgId(req);
  if (!tgId) return res.status(403).json({ error: "Unauthorized" });
  
  try {
    let data = await loadAllData();
    data = await ensureAdmin(data);
    
    const user = data.users[tgId];
    if (!user) return res.json({ role: null });
    
    res.json({
      role: data.admins.includes(tgId) ? 'admin' : 'teacher',
      name: user.name,
      photo: "",
      tgId: tgId
    });
  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
});

app.get('/api/schedules', async (req, res) => {
  const tgId = getTgId(req);
  if (!tgId) return res.status(403).json({ error: "Unauthorized" });
  
  try {
    let data = await loadAllData();
    data = await ensureAdmin(data);
    
    if (!data.users[tgId]) return res.status(403).json({ error: "No access" });
    res.json(data.schedules);  // Возвращаем все schedules (для админов? Или только свои — уточни)
  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
});

app.post('/api/schedule/:tgId', async (req, res) => {
  const targetTgId = req.params.tgId;
  const authTgId = getTgId(req);
  if (!authTgId || authTgId !== targetTgId) return res.status(403).json({ error: "Unauthorized" });  // Только свой schedule
  
  try {
    let data = await loadAllData();
    data = await ensureAdmin(data);
    
    if (!data.schedules[targetTgId]) data.schedules[targetTgId] = {};
    Object.assign(data.schedules[targetTgId], req.body);
    
    await saveAllData(data);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Save failed" });
  }
});

app.get('/api/profile/:tgId', async (req, res) => {
  const targetTgId = req.params.tgId;
  const authTgId = getTgId(req);
  if (!authTgId || authTgId !== targetTgId) return res.status(403).json({ error: "Unauthorized" });
  
  try {
    let data = await loadAllData();
    data = await ensureAdmin(data);
    
    res.json(data.profiles?.[targetTgId] || { subjects: [], gender: "Мужской" });
  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
});

app.post('/api/profile/:tgId', async (req, res) => {
  const targetTgId = req.params.tgId;
  const authTgId = getTgId(req);
  if (!authTgId || authTgId !== targetTgId) return res.status(403).json({ error: "Unauthorized" });
  
  try {
    let data = await loadAllData();
    data = await ensureAdmin(data);
    
    data.profiles[targetTgId] = req.body;
    
    await saveAllData(data);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Save failed" });
  }
});

app.post('/api/approve_user', async (req, res) => {
  const authTgId = getTgId(req);
  if (!authTgId) return res.status(403).json({ error: "Unauthorized" });
  
  try {
    let data = await loadAllData();
    data = await ensureAdmin(data);
    
    if (!data.admins.includes(authTgId)) return res.status(403).json({ error: "Admin only" });
    
    const { tgId, name, role } = req.body;
    data.users[tgId] = { name, role };
    if (role === 'admin') data.admins.push(tgId);
    data.schedules[tgId] = data.schedules[tgId] || {};
    data.profiles[tgId] = data.profiles[tgId] || { subjects: [], gender: "Мужской" };
    
    await saveAllData(data);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Save failed" });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log('Сервер запущен — данные сохраняются навсегда!'));
