const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const app = express();
app.use(bodyParser.json());
app.use(express.static('public'));

const DATA_FILE = path.join(__dirname, 'data.json');
let data = { users: {}, schedules: {}, admins: [] };

// Загружаем данные, если файл есть
if (fs.existsSync(DATA_FILE)) {
  try {
    data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {}
}

// ТЫ — ГЛАВНЫЙ АДМИН НАВСЕГДА
if (!data.admins.includes("913096324")) {
  data.admins.push("913096324");
  data.users["913096324"] = { name: "Владимир", role: "admin" };
  if (!data.schedules["913096324"]) data.schedules["913096324"] = {};
  saveData();
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
    const sorted = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`).join('\n');
    const secret = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
    const calculated = crypto.createHmac('sha256', secret).update(sorted).digest('hex');
    if (calculated !== hash) return null;
    return JSON.parse(params.get('user'));
  } catch (e) {
    return null;
  }
}

app.get('/api/user', (req, res) => {
  const tgUser = validateInitData(req.query.initData || '');
  if (!tgUser) return res.status(401).json({ error: 'Invalid' });

  const id = tgUser.id.toString();
  const userInfo = data.users[id];

  if (!userInfo) return res.json({ role: null });

  res.json({
    role: data.admins.includes(id) ? 'admin' : 'teacher',
    name: userInfo.name || tgUser.first_name,
    photo: tgUser.photo_url || '',
    tgId: id
  });
});

app.get('/api/schedules', (req, res) => {
  const tgUser = validateInitData(req.query.initData || '');
  if (!tgUser) return res.status(401).json({ error: 'Invalid' });

  const id = tgUser.id.toString();
  if (!data.users[id]) return res.status(403).json({ error: 'No access' });

  const isAdmin = data.admins.includes(id);
  res.json(isAdmin ? data.schedules : { [id]: data.schedules[id] || {} });
});

app.post('/api/schedule/:tgId', (req, res) => {
  const tgUser = validateInitData(req.query.initData || '');
  if (!tgUser) return res.status(401).json({ error: 'Invalid' });

  const currentId = tgUser.id.toString();
  const targetId = req.params.tgId;
  const isAdmin = data.admins.includes(currentId);

  if (!isAdmin && currentId !== targetId) return res.status(403).json({ error: 'Forbidden' });

  if (!data.schedules[targetId]) data.schedules[targetId] = {};
  Object.assign(data.schedules[targetId], req.body);
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

app.listen(process.env.PORT || 3000, () => console.log('Server running'));
