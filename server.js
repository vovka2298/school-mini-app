const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Конфигурация Supabase
const SUPABASE_URL = 'https://rtywenfvaoxsjdkulmdk.supabase.co';
const SUPABASE_KEY = 'sb_publishable_WhiVd5day72hRoTKiFtiIQ_sP2wu4_S';
const SUPABASE_SECRET = 'sb_secret_OdQLzX9EOC9k0wEOrCZaMw__MMRCsVu';

// Заголовки для Supabase API
const createHeaders = (useSecret = false) => ({
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${useSecret ? SUPABASE_SECRET : SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
});

// Заголовки против кеширования
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====

// Получить ID учителя по telegram_id
async function getTeacherId(telegramId) {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/users?telegram_id=eq.${telegramId}&select=id`,
      { headers: createHeaders() }
    );
    
    if (!response.ok) {
      console.error('Ошибка получения пользователя:', response.status);
      return null;
    }
    
    const users = await response.json();
    return users.length > 0 ? users[0].id : null;
  } catch (error) {
    console.error('Ошибка в getTeacherId:', error);
    return null;
  }
}

// Создать пользователя если не существует
async function createUserIfNotExists(telegramId, userData) {
  try {
    const existingId = await getTeacherId(telegramId);
    if (existingId) return existingId;
    
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/users`,
      {
        method: 'POST',
        headers: createHeaders(true), // Используем секретный ключ для записи
        body: JSON.stringify({
          telegram_id: telegramId,
          first_name: userData.name || 'Владимир',
          role: 'teacher'
        })
      }
    );
    
    if (!response.ok) {
      console.error('Ошибка создания пользователя:', response.status);
      return null;
    }
    
    const newUser = await response.json();
    return newUser[0]?.id || null;
  } catch (error) {
    console.error('Ошибка в createUserIfNotExists:', error);
    return null;
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
    
    if (!teacherId) {
      // Создаем пользователя если нет
      const newId = await createUserIfNotExists('913096324', { name: 'Владимир' });
      
      res.json({
        role: 'teacher',
        name: 'Владимир',
        photo: "",
        tgId: '913096324',
        _timestamp: Date.now()
      });
      return;
    }
    
    // Получаем данные пользователя
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/users?id=eq.${teacherId}&select=first_name,role`,
      { headers: createHeaders() }
    );
    
    if (response.ok) {
      const users = await response.json();
      const user = users[0] || {};
      
      res.json({
        role: user.role || 'teacher',
        name: user.first_name || 'Владимир',
        photo: "",
        tgId: '913096324',
        _timestamp: Date.now()
      });
    } else {
      throw new Error('Ошибка загрузки пользователя');
    }
    
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

// Получить расписание пользователя
app.get('/api/my-schedule', async (req, res) => {
  try {
    const teacherId = await getTeacherId('913096324');
    
    if (!teacherId) {
      return res.json({ _timestamp: Date.now() });
    }
    
    // Получаем расписание
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/schedules?teacher_id=eq.${teacherId}&select=day,time_slot,status`,
      { headers: createHeaders() }
    );
    
    const schedules = await response.json();
    
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

// Сохранить расписание
app.post('/api/schedule/:tgId', async (req, res) => {
  try {
    const { tgId } = req.params;
    const newSchedule = req.body;
    
    console.log('Сохранение расписания для:', tgId);
    
    // Получаем или создаем пользователя
    let teacherId = await getTeacherId(tgId);
    if (!teacherId) {
      teacherId = await createUserIfNotExists(tgId, { name: 'Преподаватель' });
      if (!teacherId) {
        throw new Error('Не удалось создать пользователя');
      }
    }
    
    // Удаляем старое расписание
    await fetch(
      `${SUPABASE_URL}/rest/v1/schedules?teacher_id=eq.${teacherId}`,
      {
        method: 'DELETE',
        headers: createHeaders(true)
      }
    );
    
    // Подготавливаем данные для вставки
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
    
    // Вставляем новое расписание если есть данные
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
        console.error('Ошибка вставки расписания:', await insertResponse.text());
        throw new Error('Ошибка сохранения расписания');
      }
    }
    
    res.json({ 
      ok: true, 
      message: "Расписание сохранено",
      _timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('Ошибка /api/schedule:', error);
    res.status(500).json({ 
      error: 'Ошибка сохранения',
      details: error.message
    });
  }
});

// Получить профиль с предметами
app.get('/api/profile/:tgId', async (req, res) => {
  try {
    const { tgId } = req.params;
    const teacherId = await getTeacherId(tgId);
    
    if (!teacherId) {
      return res.json({ 
        subjects: [], 
        gender: "Мужской", 
        _timestamp: Date.now() 
      });
    }
    
    // Получаем предметы
    const subjectsResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/teacher_subjects?teacher_id=eq.${teacherId}&select=subject`,
      { headers: createHeaders() }
    );
    
    const subjects = subjectsResponse.ok ? await subjectsResponse.json() : [];
    
    // Получаем профиль
    const profileResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/teacher_profiles?teacher_id=eq.${teacherId}&select=gender`,
      { headers: createHeaders() }
    );
    
    const profiles = profileResponse.ok ? await profileResponse.json() : [];
    
    res.json({
      subjects: subjects.map(item => item.subject),
      gender: profiles.length > 0 ? profiles[0].gender : "Мужской",
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
    if (!teacherId) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    // Обновляем или создаем профиль
    await fetch(
      `${SUPABASE_URL}/rest/v1/teacher_profiles`,
      {
        method: 'POST',
        headers: {
          ...createHeaders(true),
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          teacher_id: teacherId,
          gender: gender
        })
      }
    );
    
    // Удаляем старые предметы
    await fetch(
      `${SUPABASE_URL}/rest/v1/teacher_subjects?teacher_id=eq.${teacherId}`,
      {
        method: 'DELETE',
        headers: createHeaders(true)
      }
    );
    
    // Добавляем новые предметы
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
    res.status(500).json({ error: 'Ошибка сохранения профиля' });
  }
});

// Получить заявки
app.get('/api/bookings/:tgId', async (req, res) => {
  try {
    const { tgId } = req.params;
    const teacherId = await getTeacherId(tgId);
    
    if (!teacherId) {
      return res.json({ bookings: [], _timestamp: Date.now() });
    }
    
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/bookings?teacher_id=eq.${teacherId}&select=id,day,time_slot,subject,status,created_at,student:users(first_name,last_name)`,
      { headers: createHeaders() }
    );
    
    if (!response.ok) {
      return res.json({ bookings: [], _timestamp: Date.now() });
    }
    
    const bookings = await response.json();
    
    // Форматируем данные
    const formattedBookings = bookings.map(booking => ({
      id: booking.id,
      day: booking.day,
      time_slot: booking.time_slot,
      subject: booking.subject,
      status: booking.status,
      created_at: booking.created_at,
      first_name: booking.student?.first_name || 'Ученик',
      last_name: booking.student?.last_name || ''
    }));
    
    res.json({
      bookings: formattedBookings,
      _timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('Ошибка /api/bookings:', error);
    res.json({ bookings: [], _timestamp: Date.now() });
  }
});

// Обновить статус заявки
app.post('/api/booking/:bookingId/status', async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { status } = req.body;
    
    await fetch(
      `${SUPABASE_URL}/rest/v1/bookings?id=eq.${bookingId}`,
      {
        method: 'PATCH',
        headers: createHeaders(true),
        body: JSON.stringify({ 
          status: status,
          updated_at: new Date().toISOString()
        })
      }
    );
    
    res.json({ ok: true, _timestamp: Date.now() });
    
  } catch (error) {
    console.error('Ошибка /api/booking/status:', error);
    res.status(500).json({ error: 'Ошибка обновления' });
  }
});

// Статус сервера
app.get('/api/status', async (req, res) => {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/users?select=count`,
      { headers: createHeaders() }
    );
    
    const countHeader = response.headers.get('content-range');
    const usersCount = countHeader ? parseInt(countHeader.split('/')[1]) : 0;
    
    res.json({
      status: "OK",
      database: "Supabase REST API",
      usersCount: usersCount,
      _timestamp: Date.now()
    });
    
  } catch (error) {
    res.json({
      status: "ERROR",
      database: "Disconnected",
      error: error.message,
      _timestamp: Date.now()
    });
  }
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
    
    res.json({
      supabase: "Connected",
      apiKey: SUPABASE_KEY ? "Set" : "Missing",
      secretKey: SUPABASE_SECRET ? "Set" : "Missing",
      usersCount: users.length,
      users: users,
      testUserExists: users.some(u => u.telegram_id === '913096324'),
      headersTest: createHeaders(),
      _timestamp: Date.now()
    });
    
  } catch (error) {
    res.status(500).json({
      error: error.message,
      stack: error.stack,
      _timestamp: Date.now()
    });
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
  console.log(`🔑 API Key: ${SUPABASE_KEY.substring(0, 10)}...`);
});
