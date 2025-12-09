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

// getTgId с логами
function getTgId(req) {
  const initData = req.headers['x-telegram-webapp-init-data'];
  console.log('Received initData:', initData); // Дебаг: что пришло в headers
  if (!initData) {
    console.log('No initData in headers');
    return null;
  }
  
  try {
    const params = new URLSearchParams(initData);
    const userStr = params.get('user');
    console.log('userStr:', userStr); // Дебаг
    if (!userStr) {
      console.log('No user in params');
      return null;
    }
    
    const user = JSON.parse(userStr);
    console.log('Parsed user:', user); // Дебаг: что спарсилось
    return user.id.toString();
  } catch (e) {
    console.error('Parse error:', e);
    return null;
  }
}

// loadAllData с логами
async function loadAllData() {
  try {
    const saved = await redis.get(DATA_KEY);
    console.log('Loaded data from Redis:', saved ? 'Yes' : 'No data'); // Дебаг
    return saved || {
      users: {},
      schedules: {},
      profiles: {},
      admins: []
    };
  } catch (e) {
    console.error("Redis load error:", e);
    return {
      users: {},
      schedules: {},
      profiles: {},
      admins: []
    };
  }
}

// saveAllData с логами
async function saveAllData(data) {
  try {
    await redis.set(DATA_KEY, data);
    console.log('Saved data to Redis'); // Дебаг
  } catch (e) {
    console.error("Redis save error:", e);
    throw e;
  }
}

// ensureAdmin
async function ensureAdmin(data) {
  const myId = "913096324";
  if (!data.admins.includes(myId)) {
    data.admins.push(myId);
    data.users[myId] = { name: "Владимир", role: "admin" };
    data.schedules[myId] = data.schedules[myId] || {};
    data.profiles[myId] = data.profiles[myId] || { subjects: [], gender: "Мужской" };
    console.log('Added eternal admin'); // Дебаг
  }
  return data;
}

// API с логами
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
      tgId
    });
  } catch (e) {
    console.error('/api/user error:', e);
    res.status(500).json({ error: "Server error" });
  }
});

// Аналогично для других роутов — добавь console.log('Entering /api/schedules') и т.д., если нужно больше

// (Остальные роуты как в предыдущей версии, с try-catch и console.error)

const port = process.env.PORT || 3000;
app.listen(port, () => console.log('Server started'));
