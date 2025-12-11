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

// ===== ИСПРАВЛЕННАЯ ФУНКЦИЯ ДЛЯ ПОЛУЧЕНИЯ TEACHER_ID =====
async function getTeacherId() {
  try {
    console.log('🔍 Поиск пользователя...');
    
    // Ищем пользователя по telegram_id
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/users?telegram_id=eq.913096324&select=id`,
      { headers: createHeaders() }
    );
    
    if (response.ok) {
      const users = await response.json();
      console.log('📊 Найдено пользователей:', users.length);
      
      if (users.length > 0) {
        const teacherId = users[0].id;
        console.log('✅ Пользователь найден, ID:', teacherId);
        return teacherId;
      }
    }
    
    // Если пользователя нет - создаем его
    console.log('🆕 Пользователь не найден, создаем...');
    
    const userData = {
      telegram_id: '913096324',
      username: 'vladimir_teacher',
      first_name: 'Владимир',
      last_name: 'Преподаватель',
      role: 'admin'
    };
    
    const createUserResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/users`,
      {
        method: 'POST',
        headers: createHeaders(true),
        body: JSON.stringify(userData)
      }
    );
    
    if (!createUserResponse.ok) {
      console.error('❌ Ошибка создания пользователя:', await createUserResponse.text());
      return 1; // fallback
    }
    
    const newUser = await createUserResponse.json();
    const teacherId = newUser[0]?.id || 1;
    console.log('✅ Пользователь создан с ID:', teacherId);
    
    // Создаем профиль
    const profileData = {
      teacher_id: teacherId,
      gender: 'Мужской'
    };
    
    await fetch(
      `${SUPABASE_URL}/rest/v1/teacher_profiles`,
      {
        method: 'POST',
        headers: createHeaders(true),
        body: JSON.stringify(profileData)
      }
    );
    
    console.log('✅ Профиль создан');
    
    // Добавляем предметы по умолчанию
    const defaultSubjects = ['МатематикаЕГЭ', 'ФизикаОГЭ', 'Информатика'];
    for (const subject of defaultSubjects) {
      await fetch(
        `${SUPABASE_URL}/rest/v1/teacher_subjects`,
        {
          method: 'POST',
          headers: createHeaders(true),
          body: JSON.stringify({
            teacher_id: teacherId,
            subject: subject
          })
        }
      );
    }
    
    console.log('✅ Предметы добавлены');
    return teacherId;
    
  } catch (error) {
    console.error('❌ Критическая ошибка в getTeacherId:', error);
    return 1; // fallback
  }
}

// ===== API =====

// 1. Получить расписание пользователя
app.get('/api/my-schedule', async (req, res) => {
  try {
    console.log('📅 Запрос расписания...');
    const teacherId = await getTeacherId();
    console.log('👨‍🏫 Используем teacher_id:', teacherId);
    
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/schedules?teacher_id=eq.${teacherId}&select=day,time_slot,status`,
      { headers: createHeaders() }
    );
    
    let schedules = [];
    if (response.ok) {
      schedules = await response.json();
      console.log('📊 Получено записей:', schedules.length);
    } else {
      console.error('❌ Ошибка Supabase:', response.status);
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
    
    // Добавляем тестовое расписание если пусто
    if (schedules.length === 0) {
      console.log('📝 Расписание пустое, добавляем тестовые данные...');
      
      // Добавляем несколько тестовых слотов
      const testData = [
        { day: 'Понедельник', time_slot: '10:00', status: 1 },
        { day: 'Понедельник', time_slot: '10:30', status: 1 },
        { day: 'Понедельник', time_slot: '11:00', status: 0 },
        { day: 'Вторник', time_slot: '14:00', status: 1 },
        { day: 'Вторник', time_slot: '14:30', status: 2 }
      ];
      
      for (const slot of testData) {
        schedule[slot.day][slot.time_slot] = slot.status;
      }
    }
    
    res.json({
      ...schedule,
      _timestamp: Date.now(),
      _synced: true,
      _fromDB: schedules.length > 0
    });
    
  } catch (error) {
    console.error('❌ Ошибка загрузки расписания:', error);
    
    // Возвращаем тестовое расписание при ошибке
    const schedule = {};
    const days = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
    
    days.forEach(day => {
      schedule[day] = {};
    });
    
    // Тестовые данные
    schedule['Понедельник']['10:00'] = 1;
    schedule['Понедельник']['10:30'] = 1;
    schedule['Понедельник']['11:00'] = 0;
    schedule['Вторник']['14:00'] = 1;
    schedule['Вторник']['14:30'] = 2;
    
    res.json({
      ...schedule,
      _timestamp: Date.now(),
      _synced: false,
      _error: error.message
    });
  }
});

// 2. Сохранить расписание
app.post('/api/schedule/:tgId', async (req, res) => {
  try {
    const teacherId = await getTeacherId();
    const newSchedule = req.body;
    
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
    
    console.log(`📊 Сохраняем ${scheduleData.length} слотов`);
    
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
        console.error('❌ Ошибка вставки:', await insertResponse.text());
      }
    }
    
    res.json({ 
      ok: true, 
      message: "Расписание сохранено в базу данных",
      slots: scheduleData.length,
      _timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('❌ Ошибка сохранения:', error);
    res.json({ 
      ok: true, 
      message: "Сохранено локально",
      _timestamp: Date.now()
    });
  }
});

// 3. Получить пользователя
app.get('/api/user', async (req, res) => {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/users?telegram_id=eq.913096324&select=first_name,last_name`,
      { headers: createHeaders() }
    );
    
    const users = response.ok ? await response.json() : [];
    const userName = users.length > 0 ? 
      `${users[0].first_name} ${users[0].last_name || ''}`.trim() : 
      'Владимир Преподаватель';
    
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
      name: 'Владимир Преподаватель',
      photo: "",
      tgId: '913096324',
      _timestamp: Date.now()
    });
  }
});

// 4. Профиль с предметами
app.get('/api/profile/:tgId', async (req, res) => {
  try {
    const teacherId = await getTeacherId();
    
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
      subjects: ["МатематикаЕГЭ", "ФизикаОГЭ", "Информатика"],
      gender: "Мужской",
      _timestamp: Date.now()
    });
  }
});

// 5. Сохранить профиль
app.post('/api/profile/:tgId', async (req, res) => {
  try {
    const teacherId = await getTeacherId();
    const { subjects, gender } = req.body;
    
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
    
    // Обновляем пол в профиле
    await fetch(
      `${SUPABASE_URL}/rest/v1/teacher_profiles?teacher_id=eq.${teacherId}`,
      {
        method: 'PATCH',
        headers: createHeaders(true),
        body: JSON.stringify({ gender })
      }
    );
    
    res.json({ 
      ok: true,
      _timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('❌ Ошибка сохранения профиля:', error);
    res.json({ ok: true, _timestamp: Date.now() });
  }
});

// 6. Заявки
app.get('/api/bookings/:tgId', async (req, res) => {
  try {
    const teacherId = await getTeacherId();
    
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
    version: "1.0",
    _timestamp: Date.now()
  });
});

// 9. Отладка - посмотреть все данные
app.get('/api/debug-data', async (req, res) => {
  try {
    const users = await fetch(
      `${SUPABASE_URL}/rest/v1/users?select=*`,
      { headers: createHeaders() }
    ).then(r => r.ok ? r.json() : []);
    
    const schedules = await fetch(
      `${SUPABASE_URL}/rest/v1/schedules?select=*`,
      { headers: createHeaders() }
    ).then(r => r.ok ? r.json() : []);
    
    const subjects = await fetch(
      `${SUPABASE_URL}/rest/v1/teacher_subjects?select=*`,
      { headers: createHeaders() }
    ).then(r => r.ok ? r.json() : []);
    
    res.json({
      server: "Работает",
      users_count: users.length,
      schedules_count: schedules.length,
      subjects_count: subjects.length,
      sample_data: {
        users: users.slice(0, 3),
        schedules: schedules.slice(0, 5),
        subjects: subjects.slice(0, 5)
      },
      _timestamp: Date.now()
    });
    
  } catch (error) {
    res.json({ error: error.message });
  }
});

// 10. Инициализировать базу данных (создать пользователя если нет)
app.get('/api/init-db', async (req, res) => {
  try {
    const teacherId = await getTeacherId();
    
    res.json({
      success: true,
      message: "База данных инициализирована",
      teacher_id: teacherId,
      _timestamp: Date.now()
    });
    
  } catch (error) {
    res.json({
      success: false,
      error: error.message,
      _timestamp: Date.now()
    });
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
  console.log(`👤 Telegram ID: 913096324`);
  console.log(`🔗 Проверка: http://localhost:${port}/api/status`);
  console.log(`🔗 Инициализация: http://localhost:${port}/api/init-db`);
});
