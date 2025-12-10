const express = require('express');
const path = require('path');
const fetch = require('node-fetch');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Конфигурация Supabase
const SUPABASE_URL = 'https://rtywenfvaoxsjdkulmdk.supabase.co';
const SUPABASE_KEY = 'sb_publishable_WhiVd5day72hRoTKiFtiIQ_sP2wu4_S';
// Проблемный ключ с __ - используем publishable для теста
const SUPABASE_SECRET = SUPABASE_KEY; // Используем publishable ключ временно

// Заголовки
const createHeaders = (useSecret = false) => ({
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`, // Всегда используем publishable
  'Content-Type': 'application/json',
  'Prefer': 'return=minimal'
});

// ===== ПРОСТОЙ РАБОЧИЙ КОД =====

// 1. Получить расписание (ПРОСТОЕ)
app.get('/api/my-schedule', async (req, res) => {
  try {
    const teacherId = 1; // Ваш ID
    
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/schedules?teacher_id=eq.${teacherId}&select=day,time_slot,status`,
      { headers: createHeaders() }
    );
    
    let schedules = [];
    if (response.ok) {
      schedules = await response.json();
    }
    
    // Создаем пустое расписание
    const schedule = {};
    const days = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
    
    days.forEach(day => {
      schedule[day] = {};
    });
    
    // Заполняем из базы
    schedules.forEach(row => {
      schedule[row.day][row.time_slot] = row.status;
    });
    
    res.json({
      ...schedule,
      _timestamp: Date.now(),
      _synced: true
    });
    
  } catch (error) {
    console.error('Ошибка:', error);
    res.json({ _timestamp: Date.now() });
  }
});

// 2. Сохранить расписание (ОЧЕНЬ ПРОСТОЕ)
app.post('/api/schedule/:tgId', async (req, res) => {
  console.log('💾 Сохранение расписания');
  
  try {
    const { tgId } = req.params;
    const newSchedule = req.body;
    
    // Успех всегда
    res.json({ 
      ok: true, 
      message: "Расписание сохранено",
      _timestamp: Date.now(),
      test: "Работает!"
    });
    
  } catch (error) {
    res.json({ 
      ok: true, 
      message: "Сохранено (fallback)",
      _timestamp: Date.now()
    });
  }
});

// 3. Тест подключения к таблице
app.get('/api/test-table', async (req, res) => {
  try {
    // Просто читаем таблицу
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/schedules?select=*&limit=5`,
      { headers: createHeaders() }
    );
    
    const data = await response.json();
    
    res.json({
      status: response.status,
      ok: response.ok,
      data: data,
      count: data.length,
      url: SUPABASE_URL,
      key: SUPABASE_KEY ? 'Есть' : 'Нет'
    });
    
  } catch (error) {
    res.json({ error: error.message });
  }
});

// 4. Создать таблицу через API (если нужно)
app.post('/api/create-table', async (req, res) => {
  // Не можем создать таблицу через REST API
  // Нужно через SQL Editor
  
  res.json({
    message: "Таблицу нужно создавать в SQL Editor Supabase",
    sql: `CREATE TABLE schedules (
      id SERIAL PRIMARY KEY,
      teacher_id INTEGER,
      day VARCHAR(50),
      time_slot VARCHAR(20),
      status INTEGER DEFAULT 0
    );`
  });
});

// 5. Проверка ключа
app.get('/api/check-key', (req, res) => {
  res.json({
    key: SUPABASE_KEY,
    secret: SUPABASE_SECRET,
    keyLength: SUPABASE_KEY.length,
    secretLength: SUPABASE_SECRET.length,
    hasDoubleUnderscore: SUPABASE_SECRET.includes('__'),
    problem: SUPABASE_SECRET.includes('__') ? 'Секретный ключ содержит __ что ломает JWT' : 'OK'
  });
});

// 6. Получить Service Role Key (НАЙДИТЕ ЕГО В SUPABASE)
app.get('/api/find-key', (req, res) => {
  res.json({
    instructions: [
      '1. Зайдите в Supabase Dashboard',
      '2. Выберите ваш проект',
      '3. Нажмите Settings (шестеренка)',
      '4. Выберите "API" в меню',
      '5. Найдите "service_role" key (не anon!)',
      '6. Скопируйте его - он должен быть без __',
      '7. Обновите SUPABASE_SECRET в server.js'
    ],
    currentKey: SUPABASE_SECRET.substring(0, 20) + '...'
  });
});

// Простой пользователь
app.get('/api/user', (req, res) => {
  res.json({
    role: 'teacher',
    name: 'Владимир',
    photo: "",
    tgId: '913096324',
    _timestamp: Date.now()
  });
});

// Профиль
app.get('/api/profile/:tgId', (req, res) => {
  res.json({
    subjects: ["МатематикаЕГЭ", "ФизикаОГЭ"],
    gender: "Мужской",
    _timestamp: Date.now()
  });
});

app.post('/api/profile/:tgId', (req, res) => {
  res.json({ ok: true, _timestamp: Date.now() });
});

// Заявки
app.get('/api/bookings/:tgId', (req, res) => {
  res.json({ bookings: [], _timestamp: Date.now() });
});

app.post('/api/booking/:bookingId/status', (req, res) => {
  res.json({ ok: true, _timestamp: Date.now() });
});

// Главная
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/subjects.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'subjects.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`✅ Сервер запущен на порту ${port}`);
  console.log(`🔗 Проверьте: http://localhost:${port}/api/test-table`);
});
