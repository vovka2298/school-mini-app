const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// === ДАННЫЕ В ПАМЯТИ ===
let data = {
  users: { "913096324": { name: "Владимир", role: "admin" } },
  schedules: { "913096324": {} },
  profiles: { "913096324": { subjects: [], gender: "Мужской" } },
  admins: ["913096324"]
};

// Загружаем из файла при старте
const DATA_FILE = path.join(__dirname, 'data.json');
if (fs.existsSync(DATA_FILE)) {
  try {
    const loaded = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    data = { ...data, ...loaded };
    if (!data.admins) data.admins = [];
    if (!data.profiles) data.profiles = {};
  } catch (e) {
    console.log('Не удалось загрузить data.json');
  }
}

function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.log('Не удалось сохранить data.json');
  }
}

// === API ===
app.get('/api/user', (req, res) => {
  // Для Telegram WebApp и браузера
  const mockUser = { id: 913096324, first_name: "Владимир", photo_url: "" };
  const id = mockUser.id.toString();
  if (!data.users[id]) return res.json({ role: null });
  res.json({
    role: data.admins.includes(id) ? 'admin' : 'teacher',
    name: data.users[id].name || "Владимир",
    photo: "",
    tgId: id
  });
});

app.get('/api/schedules', (req, res) => {
  const id = "913096324";
  if (!data.users[id]) return res.status(403).send();
  const isAdmin = data.admins.includes(id);
  res.json(isAdmin ? data.schedules : { [id]: data.schedules[id] || {} });
});

app.post('/api/schedule/:tgId', (req, res) => {
  const target = req.params.tgId;
  const curr = "913096324";
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
  const target = req.params.tgId;
  const curr = "913096324";
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

// Все остальные маршруты — index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Сервер запущен на порту ${port}`);
});
