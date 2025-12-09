const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Храним данные В ПАМЯТИ
let users = {
  "913096324": { name: "Владимир", role: "admin" }
};

let schedules = {
  "913096324": {}
};

let profiles = {
  "913096324": { 
    subjects: ["МатематикаЕГЭ", "ФизикаОГЭ"], 
    gender: "Мужской" 
  }
};

let admins = ["913096324"];

// === API ===

// Главная страница
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Страница предметов
app.get('/subjects.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'subjects.html'));
});

// Получить данные пользователя
app.get('/api/user', (req, res) => {
  const id = "913096324";
  const user = users[id];
  
  res.json({
    role: 'admin',
    name: user.name,
    photo: "",
    tgId: id
  });
});

// Получить ВСЕ расписания
app.get('/api/schedules', (req, res) => {
  res.json(schedules);
});

// Получить ТОЛЬКО свое расписание
app.get('/api/my-schedule', (req, res) => {
  const id = "913096324";
  res.json(schedules[id] || {});
});

// Сохранить расписание
app.post('/api/schedule/:tgId', (req, res) => {
  const target = req.params.tgId;
  const newSchedule = req.body;
  
  console.log("СОХРАНЕНИЕ РАСПИСАНИЯ для", target);
  console.log("Полученные данные:", newSchedule);
  
  schedules[target] = newSchedule;
  
  res.json({ 
    ok: true, 
    message: "Расписание сохранено",
    schedule: schedules[target]
  });
});

// Получить профиль
app.get('/api/profile/:tgId', (req, res) => {
  const tgId = req.params.tgId;
  const profile = profiles[tgId] || { 
    subjects: [], 
    gender: "Мужской" 
  };
  res.json(profile);
});

// Сохранить профиль
app.post('/api/profile/:tgId', (req, res) => {
  const tgId = req.params.tgId;
  profiles[tgId] = req.body;
  res.json({ ok: true });
});

// Статус сервера
app.get('/api/status', (req, res) => {
  res.json({
    status: "OK",
    serverTime: new Date().toISOString(),
    usersCount: Object.keys(users).length,
    schedulesCount: Object.keys(schedules).length
  });
});

// Favicon
app.get('/favicon.ico', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'favicon.ico'));
});

// Для всех остальных маршрутов
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`✅ Сервер запущен на порту ${port}`);
});
