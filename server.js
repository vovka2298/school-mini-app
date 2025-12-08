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
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  }
  // ТЫ УЖЕ ОДОБРЕН НАВСЕГДА + АДМИН
  return {
    users: {
      "913096324": { name: "Владимир", role: "teacher" }
    },
    schedules: {
      "913096324": {}
    },
    admins: ["913096324"]  // ← ты админ
  };
}

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

const BOT_TOKEN = '8203853124:AAHQmyBWNp1MdSR9B9bOMGbR8X1k6z6P08A';

function validateInitData(initData) {
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
    const userData = JSON.parse(params.get('user'));
    return userData;
  } catch (e) {
    return null;
  }
}

// Получить информацию о пользователе
app.get('/api/user', (req, res) => {
  const initData = req.query.initData || '';
  const tgUser = validateInitData(initData);
  if (!tgUser) return res.status(401).json({ error: 'Unauthorized' });

  const tgId = tgUser.id.toString();
  const userInfo = data.users[tgId];

  if (!userInfo) {
    return res.json({ role: null });
  }

  res.json({
    role: data.admins.includes(tgId) ? 'admin' : 'teacher',
    name: userInfo.name || tgUser.first_name || 'Пользователь',
    photo: tgUser.photo_url || '',
    tgId
  });
});

// Получить все расписания (для админа) или своё
app.get('/api/schedules', (req, res) => {
  const initData = req.query.initData || '';
  const tgUser = validateInitData(initData);
  if (!tgUser) return res.status(401).json({ error: 'Unauthorized' });

  const tgId = tgUser.id.toString();
  if (!data.users[tgId]) return res.status(403).json({ error: 'No access' });

  const isAdmin = data.admins.includes(tgId);
  res.json(isAdmin ? data.schedules : { [tgId]: data.schedules[tgId] || {} });
});

// Сохранить расписание
app.post('/api/schedule/:tgId', (req, res) => {
  const initData = req.query.initData || '';
  const tgUser = validateInitData(initData);
  if (!tgUser) return res.status(401).json({ error: 'Unauthorized' });

  const currentUserId = tgUser.id.toString();
  const targetId = req.params.tgId;

  const isAdmin = data.admins.includes(currentUserId);
  if (!isAdmin && currentUserId !== targetId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (!data.schedules[targetId]) data.schedules[targetId] = {};
  Object.assign(data.schedules[targetId], req.body);
  saveData();
  res.json({ success: true });
});

// Одобрение пользователя (вызывается из бота)
app.post('/api/approve_user', (req, res) => {
  const { tgId, name, role } = req.body;
  data.users[tgId] = { name, role };
  if (role === 'admin') data.admins.push(tgId);
  if (!data.schedules[tgId]) data.schedules[tgId] = {};
  saveData();
  res.json({ success: true });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Сервер запущен на порту ${port}`);
});
