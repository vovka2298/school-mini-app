const express = require('express');
const { Redis } = require('@upstash/redis');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Подключаемся к Upstash
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || "https://us1-perfect-bream-38700.upstash.io",
  token: process.env.UPSTASH_REDIS_REST_TOKEN || "AYa7ASQgY2U1MmM0MjItZTY3Mi00OWY1LWI5MGUtMDg2OTc2NDg1MGYwYjQ3MTExYmIyNWRmZGI4NzE2MzY1MTFmYzFiM2EzYWE="
});

// === ДАННЫЕ ===
async function getData(key, defaultValue) {
  try {
    const value = await redis.get(key);
    if (value) return value;
  } catch (e) {
    console.log("Ошибка get:", e);
  }
  return defaultValue;
}

async function setData(key, value) {
  try {
    await redis.set(key, value);
    console.log("Данные сохранены для ключа:", key);
  } catch (e) {
    console.log("Ошибка set:", e);
  }
}

// Храним данные в памяти
let users = {};
let schedules = {};
let profiles = {};
let admins = [];

// Функция инициализации данных
async function initializeData() {
  console.log("Начало загрузки данных из Redis...");
  
  try {
    const [usersData, schedulesData, profilesData, adminsData] = await Promise.all([
      getData('users', {}),
      getData('schedules', {}),
      getData('profiles', {}),
      getData('admins', [])
    ]);
    
    users = usersData;
    schedules = schedulesData;
    profiles = profilesData;
    admins = adminsData;
    
    console.log("Данные успешно загружены из Redis");
    console.log("Пользователей:", Object.keys(users).length);
    console.log("Расписаний:", Object.keys(schedules).length);
    console.log("Админов:", admins.length);
    
    // ТЫ — ВЕЧНЫЙ АДМИН
    const eternalAdminId = "913096324";
    if (!admins.includes(eternalAdminId)) {
      console.log("Создаю вечного админа...");
      admins.push(eternalAdminId);
      users[eternalAdminId] = { name: "Владимир", role: "admin" };
      schedules[eternalAdminId] = schedules[eternalAdminId] || {};
      profiles[eternalAdminId] = { subjects: [], gender: "Мужской" };
      
      await Promise.all([
        setData('users', users),
        setData('schedules', schedules),
        setData('profiles', profiles),
        setData('admins', admins)
      ]);
      
      console.log("Вечный админ создан");
    }
    
  } catch (e) {
    console.error("Критическая ошибка инициализации:", e);
  }
}

// Инициализируем данные при запуске
initializeData();

// Функция сохранения ВСЕХ данных
async function saveAllData() {
  try {
    await Promise.all([
      setData('users', users),
      setData('schedules', schedules),
      setData('profiles', profiles),
      setData('admins', admins)
    ]);
    console.log("Все данные сохранены в Redis");
    return true;
  } catch (e) {
    console.error("Ошибка сохранения всех данных:", e);
    return false;
  }
}

// === API ===
app.get('/api/user', async (req, res) => {
  const id = "913096324"; // Пока используем статический ID
  const user = users[id];
  if (!user) {
    return res.json({ 
      role: null,
      name: "",
      photo: "",
      tgId: id,
      needsApproval: true
    });
  }
  res.json({
    role: admins.includes(id) ? 'admin' : 'teacher',
    name: user.name,
    photo: "",
    tgId: id
  });
});

app.get('/api/schedules', async (req, res) => {
  const id = "913096324"; // Пока используем статический ID
  
  if (!users[id]) {
    return res.status(403).json({ error: "Пользователь не найден" });
  }
  
  // Возвращаем ВСЕ расписания если админ, или только свое
  if (admins.includes(id)) {
    res.json(schedules);
  } else {
    res.json({ [id]: schedules[id] || {} });
  }
});

// КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Сохраняем ВСЁ расписание целиком
app.post('/api/schedule/:tgId', async (req, res) => {
  const target = req.params.tgId;
  console.log("Сохранение расписания для:", target, "данные:", req.body);
  
  if (!schedules[target]) {
    schedules[target] = {};
  }
  
  // Важно: сохраняем весь объект расписания, а не только изменения
  // Если в запросе пришло полное расписание (объект с днями)
  if (req.body && typeof req.body === 'object' && !req.body.time) {
    // Это полное расписание
    schedules[target] = req.body;
    console.log("Сохраняю полное расписание");
  } else {
    // Это отдельное изменение ячейки (для обратной совместимости)
    const { day, time, state } = req.body;
    if (day && time !== undefined && state !== undefined) {
      if (!schedules[target][day]) {
        schedules[target][day] = {};
      }
      schedules[target][day][time] = state;
      console.log(`Сохраняю ячейку: ${day} ${time} = ${state}`);
    }
  }
  
  // СРАЗУ сохраняем в Redis
  await setData('schedules', schedules);
  
  res.json({ 
    ok: true, 
    message: "Расписание сохранено",
    schedule: schedules[target]
  });
});

app.get('/api/profile/:tgId', async (req, res) => {
  const profile = profiles[req.params.tgId] || { subjects: [], gender: "Мужской" };
  res.json(profile);
});

app.post('/api/profile/:tgId', async (req, res) => {
  const tgId = req.params.tgId;
  profiles[tgId] = req.body;
  await setData('profiles', profiles);
  res.json({ ok: true });
});

app.post('/api/approve_user', async (req, res) => {
  const { tgId, name, role } = req.body;
  
  users[tgId] = { name, role };
  if (role === 'admin' && !admins.includes(tgId)) {
    admins.push(tgId);
  }
  
  schedules[tgId] = schedules[tgId] || {};
  profiles[tgId] = profiles[tgId] || { subjects: [], gender: "Мужской" };
  
  await saveAllData();
  res.json({ ok: true });
});

// Получение только своего расписания
app.get('/api/my-schedule', async (req, res) => {
  const id = "913096324"; // Пока используем статический ID
  
  if (!schedules[id]) {
    schedules[id] = {};
  }
  
  res.json(schedules[id]);
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Сервер запущен на порту ${port}`);
  console.log('Используется Redis:', redis.url ? 'Да' : 'Нет');
});
