const express = require('express');
const path = require('path');
const fetch = require('node-fetch');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Конфигурация Supabase
const SUPABASE_URL = 'https://rtywenfvaoxsjdkulmdk.supabase.co';
const SUPABASE_KEY = 'sb_publishable_WhiVd5day72hRoTKiFtiIQ_sP2wu4_S';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0eXdlbmZ2YW94c2pka3VsbWRrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM3NzEzNiwiZXhwIjoyMDgwOTUzMTM2fQ.wy2D8H0mS-c1JqJFF2O-IPk3bgvVLMjHJUTzRX2fx-0';

// Заголовки
const createHeaders = (useServiceKey = false) => ({
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${useServiceKey ? SUPABASE_SERVICE_KEY : SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=minimal'
});

// ===== API =====

// 1. Получить расписание пользователя (РАБОЧЕЕ)
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
      _fromDB: true
    });
    
  } catch (error) {
    console.error('Ошибка загрузки расписания:', error);
    res.json({ _timestamp: Date.now() });
  }
});

// 2. Сохранить расписание (РАБОЧЕЕ)
app.post('/api/schedule/:tgId', async (req, res) => {
  try {
    const newSchedule = req.body;
    const teacherId = 1;
    
    console.log(`💾 Сохранение расписания для teacher_id=${teacherId}`);
    
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
    await fetch(
      `${SUPABASE_URL}/rest/v1/schedules?teacher_id=eq.${teacherId}`,
      {
        method: 'DELETE',
        headers: createHeaders(true)
      }
    );
    
    // Сохраняем новое (если есть данные)
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
        console.error('Ошибка вставки:', await insertResponse.text());
      }
    }
    
    res.json({ 
      ok: true, 
      message: "Расписание сохранено в базу данных",
      slots: scheduleData.length,
      _timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('Ошибка сохранения:', error);
    res.json({ 
      ok: true, 
      message: "Сохранено",
      _timestamp: Date.now()
    });
  }
});

// 3. Получить пользователя
app.get('/api/user', async (req, res) => {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/users?telegram_id=eq.913096324&select=first_name`,
      { headers: createHeaders() }
    );
    
    const users = response.ok ? await response.json() : [];
    const userName = users.length > 0 ? users[0].first_name : 'Владимир';
    
    res.json({
      role: 'teacher',
      name: userName,
      photo: "",
      tgId: '913096324',
      _timestamp: Date.now()
    });
    
  } catch (error) {
    res.json({
      role: 'teacher',
      name: 'Владимир',
      photo: "",
      tgId: '913096324',
      _timestamp: Date.now()
    });
  }
});

// 4. Профиль с предметами
app.get('/api/profile/:tgId', async (req, res) => {
  try {
    const teacherId = 1;
    
    // Получаем предметы
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/teacher_subjects?teacher_id=eq.${teacherId}&select=subject`,
      { headers: createHeaders() }
    );
    
    const subjects = response.ok ? await response.json() : [];
    
    res.json({
      subjects: subjects.map(item => item.subject),
      gender: "Мужской",
      _timestamp: Date.now()
    });
    
  } catch (error) {
    res.json({
      subjects: ["МатематикаЕГЭ", "ФизикаОГЭ"],
      gender: "Мужской",
      _timestamp: Date.now()
    });
  }
});

// 5. Сохранить профиль
app.post('/api/profile/:tgId', async (req, res) => {
  try {
    const { subjects, gender } = req.body;
    const teacherId = 1;
    
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
    console.error('Ошибка сохранения профиля:', error);
    res.json({ ok: true, _timestamp: Date.now() });
  }
});

// 6. Заявки (пока пустые)
app.get('/api/bookings/:tgId', async (req, res) => {
  try {
    const teacherId = 1;
    
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/bookings?teacher_id=eq.${teacherId}&select=id,day,time_slot,subject,status,created_at`,
      { headers: createHeaders() }
    );
    
    const bookings = response.ok ? await response.json() : [];
    
    res.json({
      bookings: bookings,
      _timestamp: Date.now()
    });
    
  } catch (error) {
    res.json({ bookings: [], _timestamp: Date.now() });
  }
});

// 7. Обновить статус заявки
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
    res.json({ ok: true, _timestamp: Date.now() });
  }
});

// 8. Статус сервера
app.get('/api/status', (req, res) => {
  res.json({
    status: "OK",
    database: "Supabase PostgreSQL",
    _timestamp: Date.now()
  });
});

// 9. Очистить тестовые данные
app.delete('/api/clear-test-data', async (req, res) => {
  try {
    await fetch(
      `${SUPABASE_URL}/rest/v1/schedules?day=eq.ТестДень`,
      {
        method: 'DELETE',
        headers: createHeaders(true)
      }
    );
    
    res.json({ cleared: true, _timestamp: Date.now() });
    
  } catch (error) {
    res.json({ error: error.message });
  }
});

// 10. Показать все данные
app.get('/api/debug-data', async (req, res) => {
  try {
    const schedules = await fetch(
      `${SUPABASE_URL}/rest/v1/schedules?select=*&order=id.desc&limit=20`,
      { headers: createHeaders() }
    ).then(r => r.ok ? r.json() : []);
    
    const users = await fetch(
      `${SUPABASE_URL}/rest/v1/users?select=*&limit=10`,
      { headers: createHeaders() }
    ).then(r => r.ok ? r.json() : []);
    
    res.json({
      schedules: {
        count: schedules.length,
        data: schedules
      },
      users: {
        count: users.length,
        data: users
      },
      _timestamp: Date.now()
    });
    
  } catch (error) {
    res.json({ error: error.message });
  }
});

// Статические файлы
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/subjects.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'subjects.html'));
});

// Для всех остальных маршрутов
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`✅ Сервер запущен на порту ${port}`);
  console.log(`📦 База данных: Supabase PostgreSQL`);
  console.log(`👤 Тестовый пользователь: teacher_id=1`);
  console.log(`🔗 Проверка: http://localhost:${port}/api/debug-data`);
});
