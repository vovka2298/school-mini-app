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

const BOT_TOKEN = '8203853124:AAHQmyBWNp1MdSR9B9bOMGbR8X1k6z6P08A';

function validateInitData(initData) {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  params.delete('hash');
  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`).join('\n');
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  return calculatedHash === hash ? JSON.parse(params.get('user')) : null;
}

app.get('/api/user', (req, res) => {
  const initData = req.query.initData || '';
  let user = validateInitData(initData);
  if (!user) {
    // Фейковый режим для браузера - используем тебя для теста
    user = { id: 913096324, first_name: 'Владимир', photo_url: '' };
  }
  const tgId = user.id.toString();
  const userInfo = data.users[tgId];
  if (!userInfo) return res.json({ role: null });
  res.json({
    role: data.admins.includes(tgId) ? 'admin' : 'teacher',
    name: userInfo.name || user.first_name || 'Пользователь',
    photo: user.photo_url || '',
    tgId
  });
});

app.get('/api/schedules', (req, res) => {
  const initData = req.query.initData || '';
  let user = validateInitData(initData);
  if (!user) {
    // Фейковый для браузера
    user = { id: 913096324 };
  }
  const tgId = user.id.toString();
  if (!data.users[tgId]) return res.status(403).json({ error: 'No access' });
  const isAdmin = data.admins.includes(tgId);
  res.json(isAdmin ? data.schedules : { [tgId]: data.schedules[tgId] || {} });
});

app.post('/api/schedule/:tgId', (req, res) => {
  const initData = req.query.initData || '';
  let user = validateInitData(initData);
  if (!user) {
    user = { id: 913096324 };
  }
  const currentTgId = user.id.toString();
  const targetTgId = req.params.tgId;
  const isAdmin = data.admins.includes(currentTgId);
  if (!isAdmin && currentTgId !== targetTgId) return res.status(403).json({ error: 'No access' });
  if (!data.schedules[targetTgId]) data.schedules[targetTgId] = {};
  Object.assign(data.schedules[targetTgId], req.body);
  saveData();
  res.json({ success: true });
});

app.post('/api/approve_user', (req, res) => {
  const { tgId, name, role } = req.body;
  data.users[tgId] = { name, role };
  if (role === 'admin' && !data.admins.includes(tgId)) data.admins.push(tgId);
  if (!data.schedules[tgId]) data.schedules[tgId] = {};
  saveData();
  res.json({ success: true });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));
