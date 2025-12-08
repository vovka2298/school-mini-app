const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// === ДАННЫЕ ===
let data = { users: {}, schedules: {}, profiles: {}, admins: [] };
const DATA_FILE = path.join(__dirname, 'data.json');
if (fs.existsSync(DATA_FILE)) {
  try { data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch(e) {}
}

// Ты — вечный админ
if (!data.admins.includes("913096324")) {
  data.admins.push("913096324");
  data.users["913096324"] = { name: "Владимир", role: "admin" };
  data.schedules["913096324"] = {};
  data.profiles["913096324"] = { subjects: [], gender: "Мужской" };
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

const BOT_TOKEN = '8203853124:AAHQmyBWNp1MdSR9B9bOMGbR8X1k6z6P08A';

function validateInitData(initData) {
  if (!initData) return { id: 913096324 }; // для теста
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    params.delete('hash');
    const str = Array.from(params.entries()).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('\n');
    const secret = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
    const calc = crypto.createHmac('sha256', secret).update(str).digest('hex');
    return calc === hash ? JSON.parse(params.get('user')) : null;
  } catch { return null; }
}

// === API ===
app.get('/api/user', (req, res) => {
  let u = validateInitData(req.query.initData || '');
  if (!u) u = { id: 913096324, first_name: "Владимир" };
  const id = u.id.toString();
  if (!data.users[id]) return res.json({ role: null });
  res.json({
    role: data.admins.includes(id) ? 'admin' : 'teacher',
    name: data.users[id].name || u.first_name,
    photo: u.photo_url || '',
    tgId: id
  });
});

app.get('/api/schedules', (req, res) => {
  let u = validateInitData(req.query.initData || '');
  if (!u) u = { id: 913096324 };
  const id = u.id.toString();
  if (!data.users[id]) return res.status(403).send();
  const isAdmin = data.admins.includes(id);
  res.json(isAdmin ? data.schedules : { [id]: data.schedules[id] || {} });
});

app.post('/api/schedule/:tgId', (req, res) => {
  let u = validateInitData(req.query.initData || '');
  if (!u) u = { id: 913096324 };
  const curr = u.id.toString();
  const target = req.params.tgId;
  if (curr !== target && !data.admins.includes(curr)) return res.status(403).send();
  if (!data.schedules[target]) data.schedules[target] = {};
  Object.assign(data.schedules[target], req.body);
  saveData();
  res.json({ ok: true });
});

app.get('/api/profile/:tgId', (req, res) => {
  res.json(data.profiles?.[req.params.tgId] || { subjects: [], gender: "Мужской" });
});

app.post('/api/profile/:tgId', (req, res) => {
  let u = validateInitData(req.query.initData || '');
  if (!u) u = { id: 913096324 };
  const curr = u.id.toString();
  const target = req.params.tgId;
  if (curr !== target && !data.admins.includes(curr)) return res.status(403).send();
  if (!data.profiles) data.profiles = {};
  data.profiles[target] = req.body;
  saveData();
  res.json({ ok: true });
});

app.post('/api/approve_user', (req, res) => {
  const { tgId, name, role } = req.body;
  data.users[tgId] = { name, role };
  if (role === 'admin') data.admins.push(tgId);
  if (!data.schedules[tgId]) data.schedules[tgId] = {};
  if (!data.profiles) data.profiles = {};
  if (!data.profiles[tgId]) data.profiles[tgId] = { subjects: [], gender: "Мужской" };
  saveData();
  res.json({ ok: true });
});

// Все остальные запросы — index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log('Сервер запущен!'));
