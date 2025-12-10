const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Заголовки против кеширования
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

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
  
  res.set('Cache-Control', 'no-store');
  res.json({
    role: 'admin',
    name: user.name,
    photo: "",
    tgId: id,
    _timestamp: Date.now()
  });
});

// Получить ВСЕ расписания
app.get('/api/schedules', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({
    ...schedules,
    _timestamp: Date.now()
  });
});

// Получить ТОЛЬКО свое расписание (ОСНОВНОЙ ЭНДПОИНТ)
app.get('/api/my-schedule', (req, res) => {
  const id = "913096324";
  
  // Убедимся, что все дни существуют
  const days = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
  if (!schedules[id]) {
    schedules[id] = {};
  }
  
  // Создаем полное расписание с всеми днями
  const fullSchedule = {};
  days.forEach(day => {
    fullSchedule[day] = schedules[id][day] || {};
  });
  
  res.set('Cache-Control', 'no-store');
  res.json({
    ...fullSchedule,
    _synced: true,
    _timestamp: Date.now()
  });
});

// Сохранить расписание (УЛУЧШЕННАЯ ВЕРСИЯ)
app.post('/api/schedule/:tgId', (req, res) => {
  const target = req.params.tgId;
  const newSchedule = req.body;
  
  console.log("💾 СОХРАНЕНИЕ РАСПИСАНИЯ для", target);
  
  if (!schedules[target]) {
    schedules[target] = {};
  }
  
  // Создаем чистое расписание
  const days = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
  const cleanSchedule = {};
  
  days.forEach(day => {
    if (newSchedule[day] && typeof newSchedule[day] === 'object') {
      // Копируем только валидные слоты времени
      cleanSchedule[day] = {};
      for (const time in newSchedule[day]) {
        const state = newSchedule[day][time];
        if (state >= 0 && state <= 2) {
          cleanSchedule[day][time] = state;
        }
      }
    } else {
      cleanSchedule[day] = {};
    }
  });
  
  // Сохраняем
  schedules[target] = cleanSchedule;
  
  console.log("✅ Расписание сохранено");
  
  res.set('Cache-Control', 'no-store');
  res.json({ 
    ok: true, 
    message: "Расписание сохранено",
    schedule: schedules[target],
    _timestamp: Date.now()
  });
});

// Синхронизация расписания (для принудительного обновления)
app.get('/api/sync-schedule/:tgId', (req, res) => {
  const tgId = req.params.tgId;
  const schedule = schedules[tgId] || {};
  
  const days = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
  const fullSchedule = {};
  days.forEach(day => {
    fullSchedule[day] = schedule[day] || {};
  });
  
  res.set('Cache-Control', 'no-store');
  res.json({
    ...fullSchedule,
    _synced: true,
    _timestamp: Date.now(),
    _force: true
  });
});

// Получить профиль
app.get('/api/profile/:tgId', (req, res) => {
  const tgId = req.params.tgId;
  const profile = profiles[tgId] || { 
    subjects: [], 
    gender: "Мужской" 
  };
  
  res.set('Cache-Control', 'no-store');
  res.json({
    ...profile,
    _timestamp: Date.now()
  });
});

// Сохранить профиль
app.post('/api/profile/:tgId', (req, res) => {
  const tgId = req.params.tgId;
  profiles[tgId] = req.body;
  
  res.set('Cache-Control', 'no-store');
  res.json({ 
    ok: true,
    _timestamp: Date.now()
  });
});

// Статус сервера
app.get('/api/status', (req, res) => {
  res.json({
    status: "OK",
    serverTime: new Date().toISOString(),
    usersCount: Object.keys(users).length,
    schedulesCount: Object.keys(schedules).length,
    _timestamp: Date.now()
  });
});

// Сброс кеша клиента
app.get('/api/clear-cache', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ 
    cleared: true,
    message: "Кеш сброшен",
    _timestamp: Date.now()
  });
});

// Для всех остальных маршрутов
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`✅ Сервер запущен на порту ${port}`);
  console.log(`👤 Вечный админ: 913096324`);
  console.log(`📁 Статика: public/`);
});
