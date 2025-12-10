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

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====

// Получить пользователя по telegram_id
async function getUser(telegramId) {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/users?telegram_id=eq.${telegramId}&select=*`,
      { headers: createHeaders() }
    );
    
    if (response.ok) {
      const users = await response.json();
      return users.length > 0 ? users[0] : null;
    }
    return null;
  } catch (error) {
    console.error('Ошибка получения пользователя:', error);
    return null;
  }
}

// Получить ID учителя (создать если нет)
async function getTeacherId(telegramId, userName = 'Преподаватель') {
  try {
    const user = await getUser(telegramId);
    
    if (user) {
      // Проверяем что это учитель
      if (user.user_type !== 'teacher') {
        console.error(`Пользователь ${telegramId} не является учителем`);
        return null;
      }
      
      // Проверяем активен ли
      if (user.status !== 'active') {
        console.error(`Пользователь ${telegramId} не активен (статус: ${user.status})`);
        return null;
      }
      
      return user.id;
    }
    
    // Если пользователя нет - возможно он еще не зарегистрирован через бота
    console.log(`👤 Пользователь ${telegramId} не найден в системе`);
    return null;
    
  } catch (error) {
    console.error('Ошибка в getTeacherId:', error);
    return null;
  }
}

// Получить профиль учителя
async function getTeacherProfile(teacherId) {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/teacher_profiles?teacher_id=eq.${teacherId}&select=*`,
      { headers: createHeaders() }
    );
    
    if (response.ok) {
      const profiles = await response.json();
      return profiles.length > 0 ? profiles[0] : null;
    }
    return null;
  } catch (error) {
    console.error('Ошибка получения профиля:', error);
    return null;
  }
}

// ===== API ДЛЯ ИНДИВИДУАЛЬНЫХ ПРИЛОЖЕНИЙ =====

// 1. Получить данные текущего пользователя
app.get('/api/user', async (req, res) => {
  try {
    // Получаем telegram_id из query параметра (приходит из ссылки ?tg_id=...)
    const telegramId = req.query.tg_id || req.query.telegram_id;
    
    if (!telegramId) {
      return res.status(400).json({ 
        error: 'Не указан telegram_id. Используйте ?tg_id=ВАШ_ID в ссылке' 
      });
    }
    
    const user = await getUser(telegramId);
    
    if (!user) {
      return res.status(404).json({ 
        error: 'Пользователь не найден',
        message: 'Зарегистрируйтесь через Telegram бота'
      });
    }
    
    // Проверяем права доступа
    if (user.user_type !== 'teacher' && user.user_type !== 'admin') {
      return res.status(403).json({ 
        error: 'Доступ запрещен',
        message: 'Только учителя и администраторы имеют доступ к приложению'
      });
    }
    
    if (user.status !== 'active') {
      return res.status(403).json({ 
        error: 'Аккаунт не активен',
        message: 'Ваш аккаунт ожидает подтверждения или заблокирован'
      });
    }
    
    // Получаем профиль если учитель
    let profile = null;
    if (user.user_type === 'teacher') {
      profile = await getTeacherProfile(user.id);
    }
    
    res.json({
      success: true,
      user: {
        id: user.id,
        telegramId: user.telegram_id,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        fullName: `${user.first_name} ${user.last_name || ''}`.trim(),
        userType: user.user_type,
        email: user.email,
        phone: user.phone,
        status: user.status,
        createdAt: user.created_at
      },
      profile: profile,
      isTeacher: user.user_type === 'teacher',
      isAdmin: user.user_type === 'admin',
      appUrl: `${req.protocol}://${req.get('host')}/?tg_id=${user.telegram_id}`,
      _timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('Ошибка /api/user:', error);
    res.status(500).json({ 
      error: 'Ошибка сервера',
      message: error.message 
    });
  }
});

// 2. Получить расписание учителя (ИНДИВИДУАЛЬНОЕ ДЛЯ КАЖДОГО)
app.get('/api/my-schedule', async (req, res) => {
  try {
    const telegramId = req.query.tg_id;
    
    if (!telegramId) {
      return res.json({ 
        error: 'Не указан telegram_id',
        _timestamp: Date.now() 
      });
    }
    
    const teacherId = await getTeacherId(telegramId);
    
    if (!teacherId) {
      return res.json({ 
        error: 'Учитель не найден или не активен',
        _timestamp: Date.now() 
      });
    }
    
    // Получаем расписание ТОЛЬКО этого учителя
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/schedules?teacher_id=eq.${teacherId}&select=day_name,time_slot,status,slot_type&order=time_slot.asc`,
      { headers: createHeaders() }
    );
    
    let schedules = [];
    if (response.ok) {
      schedules = await response.json();
    }
    
    // Формируем полное расписание на неделю
    const schedule = {};
    const days = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
    
    // Инициализируем все дни
    days.forEach(day => {
      schedule[day] = {};
    });
    
    // Заполняем из базы
    schedules.forEach(row => {
      if (schedule[row.day_name]) {
        schedule[row.day_name][row.time_slot] = row.status;
      }
    });
    
    // Заполняем пропущенные слоты значением 0 (не работаю)
    const timeSlots = [];
    for (let h = 8; h <= 22; h++) {
      timeSlots.push(`${h.toString().padStart(2, '0')}:00`);
      if (h < 22) timeSlots.push(`${h.toString().padStart(2, '0')}:30`);
    }
    
    days.forEach(day => {
      timeSlots.forEach(time => {
        if (!schedule[day][time]) {
          schedule[day][time] = 0;
        }
      });
    });
    
    res.json({
      ...schedule,
      _timestamp: Date.now(),
      _synced: true,
      _teacherId: teacherId,
      _totalSlots: schedules.length
    });
    
  } catch (error) {
    console.error('Ошибка загрузки расписания:', error);
    res.json({ 
      error: 'Ошибка загрузки',
      _timestamp: Date.now() 
    });
  }
});

// 3. Сохранить расписание учителя (ИНДИВИДУАЛЬНОЕ)
app.post('/api/schedule/:telegramId', async (req, res) => {
  try {
    const { telegramId } = req.params;
    const newSchedule = req.body;
    
    console.log(`💾 Сохранение расписания для учителя: ${telegramId}`);
    
    const teacherId = await getTeacherId(telegramId);
    
    if (!teacherId) {
      return res.status(403).json({ 
        error: 'Доступ запрещен',
        message: 'Учитель не найден или не активен' 
      });
    }
    
    // Подготовка данных для сохранения
    const scheduleData = [];
    Object.keys(newSchedule).forEach(day => {
      const slots = newSchedule[day];
      Object.keys(slots).forEach(time => {
        const status = slots[time];
        scheduleData.push({
          teacher_id: teacherId,
          day_name: day,
          time_slot: time,
          status: status,
          slot_type: status === 0 ? 'break' : status === 1 ? 'free' : 'busy',
          updated_at: new Date().toISOString()
        });
      });
    });
    
    console.log(`📊 Подготовлено ${scheduleData.length} слотов для сохранения`);
    
    // Удаляем старое расписание этого учителя
    await fetch(
      `${SUPABASE_URL}/rest/v1/schedules?teacher_id=eq.${teacherId}`,
      {
        method: 'DELETE',
        headers: createHeaders(true)
      }
    );
    
    // Сохраняем новое расписание (пакетно)
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
        console.error('Ошибка сохранения расписания:', await insertResponse.text());
      }
    }
    
    res.json({ 
      success: true,
      message: "Расписание сохранено",
      teacherId: teacherId,
      slotsSaved: scheduleData.length,
      _timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('Ошибка сохранения расписания:', error);
    res.status(500).json({ 
      success: false,
      error: 'Ошибка сохранения',
      message: error.message 
    });
  }
});

// 4. Получить предметы учителя (ИНДИВИДУАЛЬНЫЕ)
app.get('/api/profile/:telegramId', async (req, res) => {
  try {
    const { telegramId } = req.params;
    const teacherId = await getTeacherId(telegramId);
    
    if (!teacherId) {
      return res.json({ 
        subjects: [], 
        gender: "male",
        _timestamp: Date.now() 
      });
    }
    
    // Получаем предметы этого учителя
    const subjectsResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/teacher_subjects?teacher_id=eq.${teacherId}&select=subject:subjects(name,code,category,level)`,
      { headers: createHeaders() }
    );
    
    let subjects = [];
    if (subjectsResponse.ok) {
      const data = await subjectsResponse.json();
      subjects = data.map(item => item.subject.name);
    }
    
    // Получаем профиль
    const profile = await getTeacherProfile(teacherId);
    
    res.json({
      subjects: subjects,
      gender: profile?.gender === 'female' ? 'Женский' : 'Мужской',
      teacherId: teacherId,
      _timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('Ошибка загрузки профиля:', error);
    res.json({ 
      subjects: [], 
      gender: "Мужской", 
      _timestamp: Date.now() 
    });
  }
});

// 5. Сохранить предметы учителя (ИНДИВИДУАЛЬНЫЕ)
app.post('/api/profile/:telegramId', async (req, res) => {
  try {
    const { telegramId } = req.params;
    const { subjects, gender } = req.body;
    
    const teacherId = await getTeacherId(telegramId);
    
    if (!teacherId) {
      return res.status(403).json({ 
        error: 'Доступ запрещен',
        message: 'Учитель не найден' 
      });
    }
    
    // Обновляем профиль
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
          gender: gender === 'Женский' ? 'female' : 'male'
        })
      }
    );
    
    // Удаляем старые предметы учителя
    await fetch(
      `${SUPABASE_URL}/rest/v1/teacher_subjects?teacher_id=eq.${teacherId}`,
      {
        method: 'DELETE',
        headers: createHeaders(true)
      }
    );
    
    // Находим ID предметов по названиям
    if (subjects && subjects.length > 0) {
      const subjectCodes = subjects.map(name => {
        // Преобразуем название в код (простая логика)
        const code = name.toLowerCase()
          .replace(/[^a-z0-9а-я]/g, '_')
          .replace(/ё/g, 'е');
        return code;
      });
      
      // Ищем предметы в базе
      const findResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/subjects?code=in.(${subjectCodes.join(',')})&select=id`,
        { headers: createHeaders() }
      );
      
      if (findResponse.ok) {
        const foundSubjects = await findResponse.json();
        
        if (foundSubjects.length > 0) {
          const subjectData = foundSubjects.map(subject => ({
            teacher_id: teacherId,
            subject_id: subject.id,
            is_active: true
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
      }
    }
    
    res.json({ 
      success: true,
      teacherId: teacherId,
      subjectsCount: subjects?.length || 0,
      _timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('Ошибка сохранения профиля:', error);
    res.status(500).json({ 
      success: false,
      error: 'Ошибка сохранения' 
    });
  }
});

// 6. Получить заявки учителя (ИНДИВИДУАЛЬНЫЕ)
app.get('/api/bookings/:telegramId', async (req, res) => {
  try {
    const { telegramId } = req.params;
    const teacherId = await getTeacherId(telegramId);
    
    if (!teacherId) {
      return res.json({ 
        bookings: [], 
        _timestamp: Date.now() 
      });
    }
    
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/bookings?teacher_id=eq.${teacherId}&select=id,booking_date,day_name,time_slot,status,created_at,subject:subjects(name),student:users!bookings_student_id_fkey(first_name,last_name)`,
      { headers: createHeaders() }
    );
    
    let bookings = [];
    if (response.ok) {
      const data = await response.json();
      
      bookings = data.map(booking => ({
        id: booking.id,
        day: booking.day_name,
        time_slot: booking.time_slot,
        subject: booking.subject?.name || 'Не указан',
        status: booking.status,
        created_at: booking.created_at,
        date: booking.booking_date,
        first_name: booking.student?.first_name || 'Ученик',
        last_name: booking.student?.last_name || ''
      }));
    }
    
    res.json({
      bookings: bookings,
      teacherId: teacherId,
      count: bookings.length,
      _timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('Ошибка загрузки заявок:', error);
    res.json({ 
      bookings: [], 
      _timestamp: Date.now() 
    });
  }
});

// 7. Обновить статус заявки (только если заявка принадлежит учителю)
app.post('/api/booking/:bookingId/status', async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { status, teacherTelegramId } = req.body;
    
    if (!teacherTelegramId) {
      return res.status(400).json({ 
        error: 'Не указан teacherTelegramId' 
      });
    }
    
    const teacherId = await getTeacherId(teacherTelegramId);
    
    if (!teacherId) {
      return res.status(403).json({ 
        error: 'Доступ запрещен' 
      });
    }
    
    // Проверяем что заявка принадлежит этому учителю
    const checkResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/bookings?id=eq.${bookingId}&teacher_id=eq.${teacherId}&select=id`,
      { headers: createHeaders() }
    );
    
    if (checkResponse.ok) {
      const bookings = await checkResponse.json();
      if (bookings.length === 0) {
        return res.status(403).json({ 
          error: 'Заявка не принадлежит этому учителю' 
        });
      }
    }
    
    // Обновляем статус
    await fetch(
      `${SUPABASE_URL}/rest/v1/bookings?id=eq.${bookingId}`,
      {
        method: 'PATCH',
        headers: createHeaders(true),
        body: JSON.stringify({ 
          status: status,
          updated_at: new Date().toISOString(),
          ...(status === 'cancelled' && { cancelled_at: new Date().toISOString() }),
          ...(status === 'completed' && { completed_at: new Date().toISOString() })
        })
      }
    );
    
    res.json({ 
      success: true,
      message: `Статус заявки изменен на ${status}`,
      _timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('Ошибка обновления заявки:', error);
    res.status(500).json({ 
      success: false,
      error: 'Ошибка обновления' 
    });
  }
});

// 8. Получить всех активных учителей (для админки)
app.get('/api/teachers', async (req, res) => {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/users?user_type=eq.teacher&status=eq.active&select=id,telegram_id,first_name,last_name,email,phone,created_at`,
      { headers: createHeaders() }
    );
    
    const teachers = response.ok ? await response.json() : [];
    
    res.json({
      success: true,
      teachers: teachers,
      count: teachers.length,
      _timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('Ошибка загрузки учителей:', error);
    res.status(500).json({ 
      success: false,
      error: 'Ошибка загрузки' 
    });
  }
});

// 9. Получить статистику учителя
app.get('/api/teacher-stats/:telegramId', async (req, res) => {
  try {
    const { telegramId } = req.params;
    const teacherId = await getTeacherId(telegramId);
    
    if (!teacherId) {
      return res.json({ 
        success: false,
        error: 'Учитель не найден' 
      });
    }
    
    // Получаем несколько статистик параллельно
    const [schedules, subjects, bookings, profile] = await Promise.all([
      // Расписание
      fetch(`${SUPABASE_URL}/rest/v1/schedules?teacher_id=eq.${teacherId}&select=count`, 
        { headers: createHeaders() }).then(r => r.ok ? r.json() : [{count: 0}]),
      // Предметы
      fetch(`${SUPABASE_URL}/rest/v1/teacher_subjects?teacher_id=eq.${teacherId}&select=count`, 
        { headers: createHeaders() }).then(r => r.ok ? r.json() : [{count: 0}]),
      // Заявки по статусам
      fetch(`${SUPABASE_URL}/rest/v1/bookings?teacher_id=eq.${teacherId}&select=status`, 
        { headers: createHeaders() }).then(r => r.ok ? r.json() : []),
      // Профиль
      getTeacherProfile(teacherId)
    ]);
    
    // Считаем заявки по статусам
    const bookingsByStatus = {};
    bookings.forEach(b => {
      bookingsByStatus[b.status] = (bookingsByStatus[b.status] || 0) + 1;
    });
    
    res.json({
      success: true,
      teacherId: teacherId,
      telegramId: telegramId,
      stats: {
        totalSlots: parseInt(schedules[0]?.count || 0),
        totalSubjects: parseInt(subjects[0]?.count || 0),
        totalBookings: bookings.length,
        bookingsByStatus: bookingsByStatus,
        rating: profile?.avg_rating || 0,
        totalReviews: profile?.total_reviews || 0,
        completedLessons: profile?.total_completed_lessons || 0
      },
      _timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('Ошибка статистики:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// 10. Проверка подключения к базе
app.get('/api/health', async (req, res) => {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/users?limit=1`,
      { headers: createHeaders() }
    );
    
    res.json({
      status: 'healthy',
      database: response.ok ? 'connected' : 'disconnected',
      app: 'running',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ===== СТАТИЧЕСКИЕ ФАЙЛЫ =====

// Главная страница (перенаправляет на приложение с tg_id)
app.get('/', (req, res) => {
  const telegramId = req.query.tg_id;
  
  if (!telegramId) {
    // Если нет tg_id, показываем инструкцию
    res.send(`
      <html>
        <head>
          <title>📚 Кабинет преподавателя</title>
          <meta charset="utf-8">
          <style>
            body { 
              font-family: 'Arial', sans-serif; 
              max-width: 800px; 
              margin: 0 auto; 
              padding: 40px; 
              background: #0d1117;
              color: #c9d1d9;
            }
            .container {
              background: #161b22;
              padding: 40px;
              border-radius: 12px;
              border: 1px solid #30363d;
            }
            h1 { color: #58a6ff; margin-top: 0; }
            .instruction {
              background: #21262d;
              padding: 20px;
              border-radius: 8px;
              margin: 20px 0;
            }
            .step {
              margin: 15px 0;
              padding-left: 20px;
              border-left: 3px solid #238636;
            }
            .error {
              color: #da3633;
              background: rgba(218, 54, 51, 0.1);
              padding: 10px;
              border-radius: 6px;
              border: 1px solid #da3633;
            }
            .success {
              color: #238636;
              background: rgba(35, 134, 54, 0.1);
              padding: 10px;
              border-radius: 6px;
              border: 1px solid #238636;
            }
            .teacher-link {
              display: inline-block;
              background: #1f6feb;
              color: white;
              padding: 12px 24px;
              border-radius: 8px;
              text-decoration: none;
              margin-top: 20px;
              font-weight: bold;
            }
            .teacher-link:hover {
              background: #1565c0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>📚 Кабинет преподавателя</h1>
            
            <div class="instruction">
              <h3>Как получить доступ:</h3>
              <div class="step">1. Зарегистрируйтесь через Telegram бота</div>
              <div class="step">2. Дождитесь одобрения администратора</div>
              <div class="step">3. Откройте ссылку, которую отправит бот</div>
              <div class="step">4. Или добавьте <code>?tg_id=ВАШ_TELEGRAM_ID</code> к этой ссылке</div>
            </div>
            
            ${telegramId ? `
              <div class="success">
                ✅ Telegram ID указан: <strong>${telegramId}</strong>
              </div>
              <a href="/?tg_id=${telegramId}" class="teacher-link">
                📱 Открыть мое приложение
              </a>
            ` : `
              <div class="error">
                ⚠️ Для доступа к приложению необходим Telegram ID
              </div>
              <p>Пример правильной ссылки:</p>
              <code>https://school-mini-app-pi.vercel.app/?tg_id=123456789</code>
            `}
            
            <div style="margin-top: 40px; font-size: 14px; color: #8b949e;">
              <p>Каждый преподаватель имеет индивидуальное приложение со своими:</p>
              <ul>
                <li>📅 Расписанием</li>
                <li>📚 Предметами</li>
                <li>👥 Учениками</li>
                <li>📊 Статистикой</li>
              </ul>
            </div>
          </div>
        </body>
      </html>
    `);
    return;
  }
  
  // Если есть tg_id - отдаем основное приложение
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Страница предметов
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
  console.log(`👥 Система многопользовательская`);
  console.log(`🔗 Пример индивидуальной ссылки: http://localhost:${port}/?tg_id=987654321`);
  console.log(`📊 Проверка здоровья: http://localhost:${port}/api/health`);
});
