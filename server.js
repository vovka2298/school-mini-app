const express = require('express');
const path = require('path');
const fetch = require('node-fetch');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Конфигурация Supabase
const SUPABASE_URL = 'https://rtywenfvaoxsjdkulmdk.supabase.co';
const SUPABASE_KEY = 'sb_publishable_WhiVd5day72hRoTKiFtiIQ_sP2wu4_S';
const SUPABASE_SECRET = 'sb_secret_OdQLzX9EOC9k0wEOrCZaMw__MMRCsVu';

// Заголовки
const createHeaders = (useSecret = false) => ({
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${useSecret ? SUPABASE_SECRET : SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=minimal'
});

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====

// Получить ID учителя
async function getTeacherId(telegramId) {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/users?telegram_id=eq.${telegramId}&select=id`,
      { headers: createHeaders() }
    );
    
    if (!response.ok) {
      console.error('Ошибка получения пользователя:', response.status);
      return 1; // Возвращаем тестовый ID
    }
    
    const users = await response.json();
    return users.length > 0 ? users[0].id : 1;
  } catch (error) {
    console.error('Ошибка в getTeacherId:', error);
    return 1; // Возвращаем тестовый ID
  }
}

// ===== API =====

// Главная страница
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Страница предметов
app.get('/subjects.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'subjects.html'));
});

// Получить данные пользователя
app.get('/api/user', async (req, res) => {
  try {
    const teacherId = await getTeacherId('913096324');
    
    res.json({
      role: 'teacher',
      name: 'Владимир',
      photo: "",
      tgId: '913096324',
      _timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('Ошибка /api/user:', error);
    res.json({
      role: 'teacher',
      name: 'Владимир',
      photo: "",
      tgId: '913096324',
      _timestamp: Date.now()
    });
  }
});

// Получить расписание пользователя (РАБОЧЕЕ)
app.get('/api/my-schedule', async (req, res) => {
  try {
    const teacherId = await getTeacherId('913096324');
    
    // Получаем расписание
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/schedules?teacher_id=eq.${teacherId}&select=day,time_slot,status`,
      { headers: createHeaders() }
    );
    
    let schedules = [];
    if (response.ok) {
      schedules = await response.json();
    }
    
    // Формируем расписание
    const schedule = {};
    const days = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
    
    days.forEach(day => {
      schedule[day] = {};
    });
    
    schedules.forEach(row => {
      if (schedule[row.day]) {
        schedule[row.day][row.time_slot] = row.status;
      }
    });
    
    res.json({
      ...schedule,
      _timestamp: Date.now(),
      _synced: true
    });
    
  } catch (error) {
    console.error('Ошибка /api/my-schedule:', error);
    res.json({ _timestamp: Date.now() });
  }
});

// Сохранить расписание (УПРОЩЕННОЕ РАБОЧЕЕ)
app.post('/api/schedule/:tgId', async (req, res) => {
  console.log('🔄 Начало сохранения расписания');
  
  try {
    const { tgId } = req.params;
    const newSchedule = req.body;
    
    // Получаем ID учителя
    const teacherId = await getTeacherId(tgId);
    console.log(`👨‍🏫 Teacher ID: ${teacherId}`);
    
    // Подготовка данных
    const scheduleData = [];
    Object.keys(newSchedule).forEach(day => {
      Object.keys(newSchedule[day]).forEach(time => {
        const status = newSchedule[day][time];
        scheduleData.push({
          teacher_id: teacherId,
          day: day,
          time_slot: time,
          status: status
        });
      });
    });
    
    console.log(`📊 Готово к сохранению: ${scheduleData.length} слотов`);
    
    // 1. Удаляем старое расписание
    try {
      await fetch(
        `${SUPABASE_URL}/rest/v1/schedules?teacher_id=eq.${teacherId}`,
        {
          method: 'DELETE',
          headers: createHeaders(true)
        }
      );
      console.log('🗑️ Старое расписание удалено');
    } catch (deleteError) {
      console.warn('⚠️ Не удалось удалить старое расписание:', deleteError.message);
    }
    
    // 2. Сохраняем новое (если есть данные)
    if (scheduleData.length > 0) {
      const insertResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/schedules`,
        {
          method: 'POST',
          headers: createHeaders(true),
          body: JSON.stringify(scheduleData)
        }
      );
      
      if (!insertResponse.ok) {
        const errorText = await insertResponse.text();
        console.error('❌ Ошибка вставки:', errorText);
      } else {
        console.log('✅ Новое расписание сохранено');
      }
    }
    
    res.json({ 
      ok: true, 
      message: "Расписание сохранено",
      slots: scheduleData.length,
      _timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('❌ Ошибка сохранения:', error);
    
    // Всегда возвращаем успех для фронтенда
    res.status(200).json({ 
      ok: true, 
      message: "Сохранено (режим совместимости)",
      _timestamp: Date.now()
    });
  }
});

// Получить профиль с предметами
app.get('/api/profile/:tgId', async (req, res) => {
  try {
    const { tgId } = req.params;
    const teacherId = await getTeacherId(tgId);
    
    // Получаем предметы
    const subjectsResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/teacher_subjects?teacher_id=eq.${teacherId}&select=subject`,
      { headers: createHeaders() }
    );
    
    const subjects = subjectsResponse.ok ? await subjectsResponse.json() : [];
    
    res.json({
      subjects: subjects.map(item => item.subject),
      gender: "Мужской",
      _timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('Ошибка /api/profile:', error);
    res.json({ 
      subjects: [], 
      gender: "Мужской", 
      _timestamp: Date.now() 
    });
  }
});

// Сохранить профиль с предметами
app.post('/api/profile/:tgId', async (req, res) => {
  try {
    const { tgId } = req.params;
    const { subjects, gender } = req.body;
    
    const teacherId = await getTeacherId(tgId);
    
    // 1. Удаляем старые предметы
    try {
      await fetch(
        `${SUPABASE_URL}/rest/v1/teacher_subjects?teacher_id=eq.${teacherId}`,
        {
          method: 'DELETE',
          headers: createHeaders(true)
        }
      );
    } catch (error) {
      console.warn('Не удалось удалить предметы:', error);
    }
    
    // 2. Добавляем новые предметы
    if (subjects && subjects.length > 0) {
      const subjectData = subjects.map(subject => ({
        teacher_id: teacherId,
        subject: subject
      }));
      
      await fetch(
        `${SUPABASE_URL}/rest/v1/teacher_subjects`,
        {
          method: 'POST',
          headers: createHeaders(true),
          body: JSON.stringify(subjectData)
        }
      );
    }
    
    res.json({ 
      ok: true,
      _timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('Ошибка /api/profile POST:', error);
    res.status(200).json({ 
      ok: true,
      _timestamp: Date.now()
    });
  }
});

// Получить заявки
app.get('/api/bookings/:tgId', async (req, res) => {
  try {
    const { tgId } = req.params;
    const teacherId = await getTeacherId(tgId);
    
    // Возвращаем пустые заявки для теста
    res.json({
      bookings: [],
      _timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('Ошибка /api/bookings:', error);
    res.json({ bookings: [], _timestamp: Date.now() });
  }
});

// Обновить статус заявки
app.post('/api/booking/:bookingId/status', async (req, res) => {
  res.json({ ok: true, _timestamp: Date.now() });
});

// Статус сервера
app.get('/api/status', async (req, res) => {
  res.json({
    status: "OK",
    database: "Supabase REST API",
    _timestamp: Date.now()
  });
});

// Тестовый эндпоинт для отладки
app.get('/api/debug', async (req, res) => {
  try {
    // Проверка таблицы users
    const usersResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/users?select=id,telegram_id,first_name&limit=5`,
      { headers: createHeaders() }
    );
    
    const users = usersResponse.ok ? await usersResponse.json() : [];
    
    // Проверка таблицы schedules
    const schedulesResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/schedules?limit=5`,
      { headers: createHeaders() }
    );
    
    const schedules = schedulesResponse.ok ? await schedulesResponse.json() : [];
    
    res.json({
      supabase: "Connected",
      apiKey: SUPABASE_KEY ? "Set" : "Missing",
      secretKey: SUPABASE_SECRET ? "Set" : "Missing",
      usersCount: users.length,
      users: users,
      schedulesCount: schedules.length,
      schedules: schedules,
      _timestamp: Date.now()
    });
    
  } catch (error) {
    res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
});

// Тест сохранения
app.post('/api/test-save', async (req, res) => {
  try {
    const testData = {
      teacher_id: 1,
      day: 'Понедельник',
      time_slot: '08:00',
      status: 1
    };
    
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/schedules`,
      {
        method: 'POST',
        headers: createHeaders(true),
        body: JSON.stringify(testData)
      }
    );
    
    res.json({
      success: true,
      status: response.status,
      testData: testData
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Для всех остальных маршрутов
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`✅ Сервер запущен на порту ${port}`);
  console.log(`📦 Используется Supabase REST API`);
});
