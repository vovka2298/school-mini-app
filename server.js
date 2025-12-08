const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const app = express();
app.use(bodyParser.json());
app.use(express.static('public'));

const DATA_FILE = path.join(__dirname, 'data.json');
let data = loadData();

function loadData() {
  if (fs.existsSync(DATA_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (e) {
      console.log('Ошибка чтения data.json, создаём новый');
    }
  }
  // По умолчанию — ты админ
  return {
    users: { "913096324": { name: "Владимир", role: "admin" } },
    schedules: { "913096324": {} },
    profiles: { "913096324": { subjects: [], gender: "Мужской" } },
    admins: ["913096324"]
  };
}

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Автоматически делаем тебя админом при запуске
if (!data.admins.includes("913096324")) {
  data.admins.push("913096324");
  data.users["913096324"] = { name: "Владимир", role: "admin" };
  if (!data.schedules["913096324"]) data.schedules["913096324"] = {};
  if (!data.profiles) data.profiles = {};
  if (!data.profiles["913096324"]) data.profiles["913096324"] = { subjects: [], gender: "Мужской" };
  saveData();
}

const BOT_TOKEN = '8203853124:AAHQmyBWNp1MdSR9B9bOMGbR8X1k6z6P08A';

function validateInitData(initData) {
  if (!initData) return { id: 913096324 }; // для теста в браузере
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    params.delete('hash');
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`).join('\n');
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    if (calculatedHash !== hash) return null;
    return JSON.parse(params.get('user'));
  } catch (e) {
    return null;
  }
}

// === API ===

app.get('/api/user', (req, res) => {
  const initData = req.query.initData || '';
  let tgUser = validateInitData(initData);
  if (!tgUser) tgUser = { id: 913096324, first_name: "Владимир", photo_url: "" }; // fallback

  const tgId = tgUser.id.toString();
  const userInfo = data.users[tgId];

  if (!userInfo) return res.json({ role: null });

  res.json({
    role: data.admins.includes(tgId) ? 'admin' : 'teacher',
    name: userInfo.name || tgUser.first_name,
    photo: tgUser.photo_url || '',
    tgId
  });
});

app.get('/api/schedules', (req, res) => {
  const initData = req.query.initData || '';
  let tgUser = validateInitData(initData);
  if (!tgUser) tgUser = { id: 913096324 };

  const tgId = tgUser.id.toString();
  if (!data.users[tgId]) return res.status(403).json({ error: 'No access' });

  const isAdmin = data.admins.includes(tgId);
  res.json(isAdmin ? data.schedules : { [tgId]: data.schedules[tgId] || {} });
});

app.post('/api/schedule/:tgId', (req, res) => {
  const initData = req.query.initData || '';
  let tgUser = validateInitData(initData);
  if (!tgUser) tgUser = { id: 913096324 };

  const currentTgId = tgUser.id.toString();
  const targetTgId = req.params.tgId;
  const isAdmin = data.admins.includes(currentTgId);

  if (!isAdmin && currentTgId !== targetTgId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (!data.schedules[targetTgId]) data.schedules[targetTgId] = {};
  Object.assign(data.schedules[targetTgId], req.body);
  saveData();
  res.json({ success: true });
});

// Профиль (предметы + пол)
app.get('/api/profile/:tgId', (req, res) => {
  const id = req.params.tgId;
  res.json(data.profiles?.[id] || { subjects: [], gender: "Мужской" });
});

app.post('/api/profile/:tgId', (req, res) => {
  const initData = req.query.initData || '';
  let tgUser = validateInitData(initData);
  if (!tgUser) tgUser = { id: 913096324 };

  const currentTgId = tgUser.id.toString();
  const targetTgId = req.params.tgId;

  if (currentTgId !== targetTgId && !data.admins.includes(currentTgId)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (!data.profiles) data.profiles = {};
  data.profiles[targetTgId] = req.body;
  saveData();
  res.json({ ok: true });
});

// Одобрение пользователя из бота
app.post('/api/approve_user', (req, res) => {
  const { tgId, name, role } = req.body;
  data.users[tgId] = { name, role };
  if (role === 'admin') data.admins.push(tgId);
  if (!data.schedules[tgId]) data.schedules[tgId] = {};
  if (!data.profiles) data.profiles = {};
  if (!data.profiles[tgId]) data.profiles[tgId] = { subjects: [], gender: "Мужской" };
  saveData();
  res.json({ success: true });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Сервер запущен на порту ${port}`);
});
