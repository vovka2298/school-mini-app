const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static('public'));

let users = { "913096324": { name: "Владимир", role: "admin" } };
let schedules = { "913096324": {} };
let admins = ["913096324"];

// Простая проверка Telegram (в браузере тоже работает)
app.get('/api/user', (req, res) => {
  const mockUser = { id: 913096324, first_name: "Владимир" };
  const id = mockUser.id.toString();
  if (!users[id]) return res.json({ role: null });
  res.json({
    role: admins.includes(id) ? "admin" : "teacher",
    name: users[id].name,
    photo: "",
    tgId: id
  });
});

app.get('/api/schedules', (req, res) => {
  const mockUser = { id: 913096324 };
  const id = mockUser.id.toString();
  if (!users[id]) return res.status(403).send();
  const isAdmin = admins.includes(id);
  res.json(isAdmin ? schedules : { [id]: schedules[id] || {} });
});

app.post('/api/schedule/:id', (req, res) => {
  const mockUser = { id: 913096324 };
  const currentId = mockUser.id.toString();
  const targetId = req.params.id;
  if (currentId !== targetId && !admins.includes(currentId)) return res.status(403).send();
  schedules[targetId] = { ...schedules[targetId], ...req.body };
  res.json({ ok: true });
});

app.post('/api/approve', (req, res) => {
  const { id, name, role } = req.body;
  users[id] = { name, role };
  if (role === "admin") admins.push(id);
  if (!schedules[id]) schedules[id] = {};
  res.json({ ok: true });
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log('Работает!'));
