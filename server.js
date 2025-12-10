// server.js
const express = require('express');
const path = require('path');
const fetch = require('node-fetch');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Конфигурация Supabase - КЛЮЧИ ИСПРАВЛЕНЫ
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rtywenfvaoxsjdkulmdk.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0eXdlbmZ2YW94c2pka3VsbWRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU2MDQ4MDAsImV4cCI6MjA1MTE4MDgwMH0.gQ99aMJ_sUhOMR4XQm54gOq3MSF6hjePjEn4nyI6mFg';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'sb_publishable_WhiVd5day72hRoTKiFtiIQ_sP2wu4_S';

// Заголовки
const createHeaders = (useServiceKey = false) => ({
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${useServiceKey ? SUPABASE_SERVICE_KEY : SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=minimal'
});

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====
async function getTeacherIdByTelegramId(telegramId) {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/users?telegram_id=eq.${telegramId}&select=id`,
      { headers: createHeaders() }
    );
    
    if (!response.ok) {
      console.error('Ошибка поиска пользователя:', response.status);
      return null;
    }
    
    const users = await response.json();
    return users.length > 0 ? users[0].id : null;
  } catch (error) {
    console.error('Ошибка в getTeacherIdByTelegramId:', error);
    return null;
  }
}

// ===== API =====

// 1. Получить расписание пользователя
app.get('/api/my-schedule', async (req, res) => {
  try {
    const MY_TG_ID = '913096324'; // Ваш Telegram ID
    const teacherId = await getTeacherIdByTelegramId(MY_TG_ID);
    
    if (!teacherId) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/schedules?teacher_id=eq.${teacherId}&select=day,time_slot,status`,
      { headers: createHeaders() }
    );
    
    let schedules = [];
    if (response.ok) {
      schedules = await response.json();
      console.log(`Загружено ${schedules.length} слотов расписания для teacher_id=${teacherId}`);
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
      _synced: true,
      _teacherId: teacherId
    });
    
  } catch (error) {
    console.error('Ошибка загрузки расписания:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      _timestamp: Date.now() 
    });
  }
});

// 2. Сохранить расписание (ОСНОВНАЯ ФИКСАЦИЯ)
app.post('/api/schedule/:tgId', async (req, res) => {
  try {
    const telegramId = req.params.tgId;
    const teacherId = await getTeacherIdByTelegramId(telegramId);
    
    if (!teacherId) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    const newSchedule = req.body;
    console.log(`💾 Сохранение расписания для teacher_id=${teacherId}, слотов:`, Object.keys(newSchedule).length);
    
    // Подготовка данных
    const scheduleData = [];
    Object.keys(newSchedule).forEach(day => {
      const slots = newSchedule[day];
      Object.keys(slots).forEach(time => {
        scheduleData.push({
          teacher_id: teacherId,
          day: day,
          time_slot: time,
          status: slots[time]
        });
      });
    });
    
    // Удаляем старое расписание
    console.log(`🗑️ Удаление старого расписания для teacher_id=${teacherId}`);
    const deleteResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/schedules?teacher_id=eq.${teacherId}`,
      {
        method: 'DELETE',
        headers: createHeaders(true) // Используем service key для удаления
      }
    );
    
    if (!deleteResponse.ok) {
      console.warn('Предупреждение при удалении:', await deleteResponse.text());
    }
    
    // Сохраняем новое (если есть данные)
    if (scheduleData.length > 0) {
      console.log(`💫 Вставка ${scheduleData.length} новых слотов`);
      const insertResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/schedules`,
        {
          method: 'POST',
          headers: createHeaders(true), // Используем service key для вставки
          body: JSON.stringify(scheduleData)
        }
      );
      
      if (!insertResponse.ok) {
        const errorText = await insertResponse.text();
        console.error('❌ Ошибка вставки расписания:', errorText);
        return res.status(500).json({ 
          error: 'Ошибка сохранения в базу данных',
          details: errorText 
        });
      }
    }
    
    res.json({ 
      ok: true, 
      message: `Расписание успешно сохранено (${scheduleData.length} слотов)`,
      slots: scheduleData.length,
      _timestamp: Date.now(),
      _teacherId: teacherId
    });
    
  } catch (error) {
    console.error('❌ Ошибка сохранения:', error);
    res.status(500).json({ 
      ok: false,
      error: 'Внутренняя ошибка сервера при сохранении',
      _timestamp: Date.now()
    });
  }
});

// 3. Получить данные пользователя
app.get('/api/user', async (req, res) => {
  try {
    const MY_TG_ID = '913096324';
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/users?telegram_id=eq.${MY_TG_ID}&select=first_name,last_name`,
      { headers: createHeaders() }
    );
    
    if (!response.ok) {
      throw new Error(`Ошибка API: ${response.status}`);
    }
    
    const users = await response.json();
    const userName = users.length > 0 
      ? `${users[0].first_name} ${users[0].last_name || ''}`.trim() 
      : 'Владимир Преподаватель';
    
    res.json({
      role: 'teacher',
      name: userName,
      tgId: MY_TG_ID,
      _timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('Ошибка загрузки пользователя:', error);
    res.json({
      role: 'teacher',
      name: 'Владимир Преподаватель',
      tgId: '913096324',
      _timestamp: Date.now()
    });
  }
});

// 4. Загрузить профиль с предметами
app.get('/api/profile/:tgId', async (req, res) => {
  try {
    const teacherId = await getTeacherIdByTelegramId(req.params.tgId);
    
    if (!teacherId) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    // Получаем предметы
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/teacher_subjects?teacher_id=eq.${teacherId}&select=subject`,
      { headers: createHeaders() }
    );
    
    const subjects = response.ok ? await response.json() : [];
    
    res.json({
      subjects: subjects.map(item => item.subject),
      gender: "Мужской", // Можно доработать загрузку из teacher_profiles
      _timestamp: Date.now(),
      _teacherId: teacherId
    });
    
  } catch (error) {
    console.error('Ошибка загрузки профиля:', error);
    res.status(500).json({
      subjects: [],
      gender: "Мужской",
      _timestamp: Date.now()
    });
  }
});

// 5. Сохранить профиль (предметы)
app.post('/api/profile/:tgId', async (req, res) => {
  try {
    const { subjects } = req.body;
    const teacherId = await getTeacherIdByTelegramId(req.params.tgId);
    
    if (!teacherId) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    // Удаляем старые предметы
    await fetch(
      `${SUPABASE_URL}/rest/v1/teacher_subjects?teacher_id=eq.${teacherId}`,
      {
        method: 'DELETE',
        headers: createHeaders(true)
      }
    );
    
    // Добавляем новые
    if (subjects && subjects.length > 0) {
      const subjectData = subjects.map(subject => ({
        teacher_id: teacherId,
        subject: subject
      }));
      
      const insertResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/teacher_subjects`,
        {
          method: 'POST',
          headers: createHeaders(true),
          body: JSON.stringify(subjectData)
        }
      );
      
      if (!insertResponse.ok) {
        throw new Error('Ошибка сохранения предметов');
      }
    }
    
    res.json({ 
      ok: true,
      message: `Сохранено ${subjects?.length || 0} предметов`,
      _timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('Ошибка сохранения профиля:', error);
    res.status(500).json({ 
      ok: false,
      error: 'Ошибка сохранения профиля',
      _timestamp: Date.now() 
    });
  }
});

// 6. Получить заявки
app.get('/api/bookings/:tgId', async (req, res) => {
  try {
    const teacherId = await getTeacherIdByTelegramId(req.params.tgId);
    
    if (!teacherId) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/bookings?teacher_id=eq.${teacherId}&select=id,day,time_slot,subject,status,created_at&order=created_at.desc`,
      { headers: createHeaders() }
    );
    
    const bookings = response.ok ? await response.json() : [];
    
    res.json({
      bookings: bookings,
      count: bookings.length,
      _timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('Ошибка загрузки заявок:', error);
    res.json({ 
      bookings: [], 
      count: 0,
      _timestamp: Date.now() 
    });
  }
});

// 7. Обновить статус заявки
app.post('/api/booking/:bookingId/status', async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { status } = req.body;
    
    const updateResponse = await fetch(
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
    
    if (!updateResponse.ok) {
      throw new Error('Ошибка обновления заявки');
    }
    
    res.json({ 
      ok: true, 
      message: `Статус заявки обновлен на "${status}"`,
      _timestamp: Date.now() 
    });
    
  } catch (error) {
    console.error('Ошибка обновления заявки:', error);
    res.status(500).json({ 
      ok: false,
      error: 'Ошибка обновления заявки',
      _timestamp: Date.now() 
    });
  }
});

// 8. Статус сервера
app.get('/api/status', (req, res) => {
  res.json({
    status: "OK",
    database: "Supabase PostgreSQL",
    version: "1.0",
    _timestamp: Date.now()
  });
});

// 9. Отладка: показать данные
app.get('/api/debug-data', async (req, res) => {
  try {
    const [schedules, users, subjects] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/schedules?select=*&order=id.desc&limit=5`, 
            { headers: createHeaders() }).then(r => r.ok ? r.json() : []),
      fetch(`${SUPABASE_URL}/rest/v1/users?select=id,telegram_id,first_name&limit=5`, 
            { headers: createHeaders() }).then(r => r.ok ? r.json() : []),
      fetch(`${SUPABASE_URL}/rest/v1/teacher_subjects?select=*&limit=10`, 
            { headers: createHeaders() }).then(r => r.ok ? r.json() : [])
    ]);
    
    res.json({
      server: "Работает",
      schedules_count: schedules.length,
      users_count: users.length,
      subjects_count: subjects.length,
      sample_data: { schedules, users, subjects },
      _timestamp: Date.now()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Статические файлы
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/subjects.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'subjects.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`\n✅ Сервер запущен на порту ${port}`);
  console.log(`📦 База данных: ${SUPABASE_URL}`);
  console.log(`🔗 Локальная проверка: http://localhost:${port}/api/status`);
  console.log(`👤 Telegram ID для теста: 913096324`);
});
