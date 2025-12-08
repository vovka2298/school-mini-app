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
  if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  return { users: {}, schedules: {}, admins: [] };
}

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Валидация Telegram initData (замени BOT_TOKEN на свой)
const BOT_TOKEN = 'YOUR_BOT_TOKEN_HERE'; // ← Замени!
function validateInitData(initData) {
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
}

// API: Получить роль пользователя
app.get('/api/user', (req, res) => {
  const initData = req.query.initData;
  const user = validateInitData(initData);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  const tgId = user.id.toString();
  if (!data.users[tgId]) return res.json({ role: null });
  res.json({
    role: data.admins.includes(tgId) ? 'admin' : 'teacher',
    name: data.users[tgId].name,
    tgId
  });
});

// API: Получить расписания
app.get('/api/schedules', (req, res) => {
  const initData = req.query.initData;
  const user = validateInitData(initData);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  const tgId = user.id.toString();
  if (!data.users[tgId]) return res.status(403).json({ error: 'No access' });
  const isAdmin = data.admins.includes(tgId);
  res.json(isAdmin ? data.schedules : { [tgId]: data.schedules[tgId] || {} });
});

// API: Обновить расписание
app.post('/api/schedule/:tgId', (req, res) => {
  const initData = req.query.initData;
  const user = validateInitData(initData);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  const currentTgId = user.id.toString();
  const targetTgId = req.params.tgId;
  const isAdmin = data.admins.includes(currentTgId);
  if (!isAdmin && currentTgId !== targetTgId) return res.status(403).json({ error: 'No access' });
  if (!data.schedules[targetTgId]) data.schedules[targetTgId] = {};
  Object.assign(data.schedules[targetTgId], req.body);
  saveData();
  res.json({ success: true });
});

// API: Одобрить пользователя (от бота)
app.post('/api/approve_user', (req, res) => {
  const { tgId, name, role } = req.body;
  data.users[tgId] = { name, role };
  if (role === 'admin' && !data.admins.includes(tgId)) data.admins.push(tgId);
  if (!data.schedules[tgId]) data.schedules[tgId] = {};
  saveData();
  res.json({ success: true });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server on port ${port}`));
