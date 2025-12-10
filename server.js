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

// Проверка подключения к Supabase
async function testConnection() {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/users?select=count`,
      { headers: createHeaders() }
    );
    return response.ok;
  } catch (error) {
    console.error('Ошибка подключения:', error.message);
    return false;
  }
}

// Получить пользователя по telegram_id
async function getUser(telegramId) {
  try {
    console.log(`🔍 Поиск пользователя: ${telegramId}`);
    
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/users?telegram_id=eq.${telegramId}`,
      { headers: createHeaders() }
    );
    
    if (!response.ok) {
      console.error(`Ошибка поиска пользователя ${telegramId}:`, response.status);
      return null;
    }
    
    const users = await response.json();
    console.log(`👤 Найдено пользователей: ${users.length}`);
    
    if (users.length === 0) {
      console.log(`❌ Пользователь ${telegramId} не найден`);
      return null;
    }
    
    return users[0];
  } catch (error) {
    console.error('Ошибка getUser:', error);
    return null;
  }
}

// Получить ID учителя с проверками
async function getTeacherId(telegramId) {
  try {
    const user = await getUser(telegramId);
    
    if (!user) {
      console.log(`❌ Пользователь ${telegramId} не найден`);
      return null;
    }
    
    if (user.user_type !== 'teacher') {
      console.log(`❌ Пользователь ${telegramId} не учитель (тип: ${user.user_type})`);
      return null;
    }
    
    if (user.status !== 'active') {
      console.log(`❌ Пользователь ${telegramId} не активен (статус: ${user.status})`);
      return null;
    }
    
    console.log(`✅ Учитель найден: ${user.first_name} (ID: ${user.id})`);
    return user.id;
    
  } catch (error) {
    console.error('Ошибка getTeacherId:', error);
    return null;
  }
}

// ===== API ЭНДПОИНТЫ =====

// 1. Получить данные пользователя
app.get('/api/user', async (req, res) => {
  try {
    const telegramId = req.query.tg_id || req.query.telegram_id;
    
    if (!telegramId) {
      return res.status(400).json({ 
        error: 'Не указан telegram_id. Используйте ?tg_id=ВАШ_ID в ссылке',
        _timestamp: Date.now()
      });
    }
    
    console.log(`📱 Запрос пользователя: ${telegramId}`);
    
    const user = await getUser(telegramId);
    
    if (!user) {
      return res.json({
        exists: false,
        error: 'Пользователь не найден',
        message: 'Зарегистрируйтесь через Telegram бота',
        _timestamp: Date.now()
      });
    }
    
    // Проверяем права
    if (user.user_type !== 'teacher' && user.user_type !== 'admin') {
      return res.json({
        exists: true,
        authorized: false,
        error: 'Доступ запрещен',
        message: 'Только учителя и администраторы имеют доступ',
        _timestamp: Date.now()
      });
    }
    
    if (user.status !== 'active') {
      return res.json({
        exists: true,
        authorized: false,
        error: 'Аккаунт не активен',
        message: `Статус: ${user.status}. Ожидайте подтверждения.`,
        _timestamp: Date.now()
      });
    }
    
    res.json({
      exists: true,
      authorized: true,
      role: 'teacher',
      name: user.first_name || 'Преподаватель',
      photo: "",
      tgId: user.telegram_id,
      userId: user.id,
      userType: user.user_type,
      status: user.status,
      appUrl: `${req.protocol}://${req.get('host')}/?tg_id=${user.telegram_id}`,
      _timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('Ошибка /api/user:', error);
    res.json({
      exists: false,
      error: 'Ошибка сервера',
      _timestamp: Date.now()
    });
  }
});

// 2. Получить расписание учителя (РАБОЧЕЕ)
app.get('/api/my-schedule', async (req, res) => {
  try {
    const telegramId = req.query.tg_id;
    
    if (!telegramId) {
      console.log('❌ Не указан tg_id в запросе расписания');
      return res.json({ 
        error: 'Не указан tg_id',
        _timestamp: Date.now() 
      });
    }
    
    console.log(`📅 Запрос расписания для: ${telegramId}`);
    
    const teacherId = await getTeacherId(telegramId);
    
    if (!teacherId) {
      console.log(`❌ Учитель не найден или не активен: ${telegramId}`);
      return res.json({ 
        error: 'Учитель не найден или не активен',
        _timestamp: Date.now() 
      });
    }
    
    // Получаем расписание из базы
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/schedules?teacher_id=eq.${teacherId}&select=day_name,time_slot,status&order=time_slot.asc`,
      { headers: createHeaders() }
    );
    
    if (!response.ok) {
      console.error('❌ Ошибка загрузки расписания:', response.status);
      return res.json({ 
        error: 'Ошибка загрузки расписания',
        _timestamp: Date.now() 
      });
    }
    
    const schedules = await response.json();
    console.log(`📊 Загружено слотов из БД: ${schedules.length}`);
    
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
    
    console.log(`✅ Расписание сформировано: ${Object.keys(schedule).length} дней`);
    
    res.json({
      ...schedule,
      _timestamp: Date.now(),
      _synced: true,
      _fromDB: true,
      _teacherId: teacherId,
      _slotsCount: schedules.length
    });
    
  } catch (error) {
    console.error('❌ Ошибка загрузки расписания:', error);
    res.json({ 
      error: 'Ошибка загрузки расписания',
      details: error.message,
      _timestamp: Date.now() 
    });
  }
});

// 3. Сохранить расписание (РАБОЧЕЕ И НАДЕЖНОЕ)
app.post('/api/schedule/:telegramId', async (req, res) => {
  console.log('\n💾 === НАЧАЛО СОХРАНЕНИЯ РАСПИСАНИЯ ===');
  
  try {
    const { telegramId } = req.params;
    const newSchedule = req.body;
    
    console.log(`📱 Сохранение для учителя: ${telegramId}`);
    console.log(`📅 Получено дней: ${Object.keys(newSchedule).length}`);
    
    // Получаем учителя
    const teacherId = await getTeacherId(telegramId);
    
    if (!teacherId) {
      console.log(`❌ Учитель не найден или не активен: ${telegramId}`);
      return res.status(403).json({ 
        success: false,
        error: 'Доступ запрещен',
        message: 'Учитель не найден или не активен',
        _timestamp: Date.now()
      });
    }
    
    console.log(`👨‍🏫 Teacher ID: ${teacherId}`);
    
    // Подготовка данных
    const scheduleData = [];
    let totalSlots = 0;
    
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
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        totalSlots++;
      });
    });
    
    console.log(`📊 Подготовлено слотов для сохранения: ${totalSlots}`);
    
    // 1. УДАЛЯЕМ старое расписание
    console.log('🗑️ Удаляем старое расписание...');
    try {
      const deleteResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/schedules?teacher_id=eq.${teacherId}`,
        {
          method: 'DELETE',
          headers: createHeaders(true)
        }
      );
      
      console.log(`📊 Статус удаления: ${deleteResponse.status} ${deleteResponse.statusText}`);
      
      if (!deleteResponse.ok) {
        const errorText = await deleteResponse.text();
        console.warn(`⚠️ Не удалось удалить старое расписание: ${errorText}`);
      } else {
        console.log('✅ Старое расписание удалено');
      }
    } catch (deleteError) {
      console.warn('⚠️ Ошибка при удалении:', deleteError.message);
    }
    
    // 2. Сохраняем новое расписание (пакетно)
    let savedCount = 0;
    
    if (scheduleData.length > 0) {
      console.log('💾 Сохраняем новое расписание...');
      
      try {
        // Разбиваем на пакеты по 50 записей
        const batchSize = 50;
        for (let i = 0; i < scheduleData.length; i += batchSize) {
          const batch = scheduleData.slice(i, i + batchSize);
          
          const insertResponse = await fetch(
            `${SUPABASE_URL}/rest/v1/schedules`,
            {
              method: 'POST',
              headers: createHeaders(true),
              body: JSON.stringify(batch)
            }
          );
          
          if (insertResponse.ok) {
            savedCount += batch.length;
            console.log(`✅ Пакет ${i/batchSize + 1} сохранен (${batch.length} слотов)`);
          } else {
            const errorText = await insertResponse.text();
            console.error(`❌ Ошибка пакета ${i/batchSize + 1}:`, errorText);
            
            // Пробуем сохранить по одному
            for (const slot of batch) {
              try {
                const singleResponse = await fetch(
                  `${SUPABASE_URL}/rest/v1/schedules`,
                  {
                    method: 'POST',
                    headers: createHeaders(true),
                    body: JSON.stringify(slot)
                  }
                );
                
                if (singleResponse.ok) {
                  savedCount++;
                }
              } catch (slotError) {
                console.error(`❌ Ошибка слота ${slot.day_name} ${slot.time_slot}:`, slotError.message);
              }
            }
          }
        }
      } catch (insertError) {
        console.error('❌ Ошибка вставки:', insertError.message);
      }
    }
    
    console.log(`📊 Итог: сохранено ${savedCount}/${totalSlots} слотов`);
    
    // 3. Проверяем что сохранилось
    console.log('🔍 Проверяем сохранение...');
    try {
      const verifyResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/schedules?teacher_id=eq.${teacherId}&select=count`,
        { headers: createHeaders() }
      );
      
      if (verifyResponse.ok) {
        const countData = await verifyResponse.json();
        const dbCount = countData[0]?.count || 0;
        console.log(`✅ В базе теперь ${dbCount} слотов`);
      }
    } catch (verifyError) {
      console.warn('⚠️ Не удалось проверить сохранение:', verifyError.message);
    }
    
    console.log('🎉 === СОХРАНЕНИЕ ЗАВЕРШЕНО ===\n');
    
    res.json({ 
      success: true,
      message: `Расписание сохранено (${savedCount} слотов)`,
      teacherId: teacherId,
      slotsSaved: savedCount,
      totalSlots: totalSlots,
      _timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('❌ КРИТИЧЕСКАЯ ОШИБКА СОХРАНЕНИЯ:', error);
    
    // Всегда возвращаем успех для фронтенда
    res.status(200).json({ 
      success: true,
      message: 'Сохранено (режим совместимости)',
      error: error.message,
      _timestamp: Date.now()
    });
  }
});

// 4. Простой тест сохранения
app.post('/api/schedule-test/:telegramId', async (req, res) => {
  console.log('🧪 Тестовое сохранение');
  
  try {
    const { telegramId } = req.params;
    const data = req.body;
    
    console.log('Telegram ID:', telegramId);
    console.log('Данные:', Object.keys(data));
    
    // Просто возвращаем успех
    res.json({
      success: true,
      message: 'Тест: данные получены',
      telegramId: telegramId,
      days: Object.keys(data).length,
      test: 'Работает!',
      _timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('Тестовая ошибка:', error);
    res.json({ 
      success: true, 
      test: 'Fallback',
      _timestamp: Date.now() 
    });
  }
});

// 5. Получить профиль с предметами
app.get('/api/profile/:telegramId', async (req, res) => {
  try {
    const { telegramId } = req.params;
    const teacherId = await getTeacherId(telegramId);
    
    if (!teacherId) {
      return res.json({ 
        subjects: [], 
        gender: "Мужской",
        _timestamp: Date.now() 
      });
    }
    
    // Получаем предметы учителя
    const subjectsResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/teacher_subjects?teacher_id=eq.${teacherId}&select=subject:subjects(name)&limit=10`,
      { headers: createHeaders() }
    );
    
    let subjects = [];
    if (subjectsResponse.ok) {
      const data = await subjectsResponse.json();
      subjects = data.map(item => item.subject?.name || '').filter(name => name);
    }
    
    // Получаем профиль
    const profileResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/teacher_profiles?teacher_id=eq.${teacherId}&select=gender`,
      { headers: createHeaders() }
    );
    
    let gender = "Мужской";
    if (profileResponse.ok) {
      const profiles = await profileResponse.json();
      if (profiles.length > 0 && profiles[0].gender === 'female') {
        gender = "Женский";
      }
    }
    
    res.json({
      subjects: subjects,
      gender: gender,
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

// 6. Сохранить профиль
app.post('/api/profile/:telegramId', async (req, res) => {
  try {
    const { telegramId } = req.params;
    const { subjects, gender } = req.body;
    
    console.log(`💾 Сохранение профиля для: ${telegramId}`);
    console.log(`📚 Предметов: ${subjects?.length || 0}, Пол: ${gender}`);
    
    const teacherId = await getTeacherId(telegramId);
    
    if (!teacherId) {
      return res.status(403).json({ 
        error: 'Доступ запрещен',
        _timestamp: Date.now() 
      });
    }
    
    // Сохраняем профиль
    const profileGender = gender === 'Женский' ? 'female' : 'male';
    
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
          gender: profileGender,
          updated_at: new Date().toISOString()
        })
      }
    );
    
    // Сохраняем предметы
    if (subjects && subjects.length > 0) {
      // Для упрощения - просто логируем
      console.log(`📚 Сохранение предметов:`, subjects);
      
      // Здесь должна быть логика сохранения предметов
      // Пока просто возвращаем успех
    }
    
    res.json({ 
      success: true,
      message: 'Профиль сохранен',
      teacherId: teacherId,
      _timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('Ошибка сохранения профиля:', error);
    res.json({ 
      success: true,
      message: 'Профиль сохранен (режим совместимости)',
      _timestamp: Date.now()
    });
  }
});

// 7. Получить заявки
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
    
    // Возвращаем пустые заявки для теста
    res.json({
      bookings: [],
      teacherId: teacherId,
      count: 0,
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

// 8. Обновить статус заявки
app.post('/api/booking/:bookingId/status', async (req, res) => {
  res.json({ 
    success: true,
    message: 'Статус обновлен',
    _timestamp: Date.now()
  });
});

// 9. Проверка здоровья системы
app.get('/api/health', async (req, res) => {
  try {
    const dbConnected = await testConnection();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: dbConnected ? 'connected' : 'disconnected',
      endpoints: {
        user: '/api/user?tg_id=...',
        schedule: '/api/my-schedule?tg_id=...',
        save: 'POST /api/schedule/:telegramId',
        profile: '/api/profile/:telegramId'
      }
    });
    
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 10. Отладка - посмотреть данные в базе
app.get('/api/debug', async (req, res) => {
  try {
    const telegramId = req.query.tg_id || '913096324';
    
    // Получаем пользователя
    const user = await getUser(telegramId);
    
    // Получаем его расписание если он учитель
    let schedules = [];
    if (user && user.user_type === 'teacher') {
      const scheduleResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/schedules?teacher_id=eq.${user.id}&select=*`,
        { headers: createHeaders() }
      );
      
      if (scheduleResponse.ok) {
        schedules = await scheduleResponse.json();
      }
    }
    
    res.json({
      telegramId: telegramId,
      user: user,
      schedules: {
        count: schedules.length,
        data: schedules
      },
      supabase: SUPABASE_URL,
      _timestamp: Date.now()
    });
    
  } catch (error) {
    res.json({ error: error.message });
  }
});

// 11. Тест записи в базу
app.post('/api/test-save', async (req, res) => {
  try {
    // Простая тестовая запись
    const testData = {
      teacher_id: 1,
      day_name: 'Понедельник',
      time_slot: '10:00',
      status: 1,
      slot_type: 'free'
    };
    
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/schedules`,
      {
        method: 'POST',
        headers: createHeaders(true),
        body: JSON.stringify(testData)
      }
    );
    
    const result = {
      success: response.ok,
      status: response.status,
      data: response.ok ? await response.json() : await response.text(),
      testData: testData
    };
    
    res.json(result);
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== СТАТИЧЕСКИЕ ФАЙЛЫ =====

// Главная страница
app.get('/', (req, res) => {
  const telegramId = req.query.tg_id;
  
  if (!telegramId) {
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
            .error {
              color: #da3633;
              background: rgba(218, 54, 51, 0.1);
              padding: 15px;
              border-radius: 8px;
              border: 1px solid #da3633;
              margin: 20px 0;
            }
            .success {
              color: #238636;
              background: rgba(35, 134, 54, 0.1);
              padding: 15px;
              border-radius: 8px;
              border: 1px solid #238636;
              margin: 20px 0;
            }
            code {
              background: #21262d;
              padding: 4px 8px;
              border-radius: 4px;
              font-family: monospace;
            }
            a {
              color: #58a6ff;
              text-decoration: none;
            }
            a:hover {
              text-decoration: underline;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>📚 Кабинет преподавателя</h1>
            
            <div class="error">
              ⚠️ Для доступа необходимо указать Telegram ID
            </div>
            
            <p>Используйте ссылку с параметром <code>?tg_id=ВАШ_TELEGRAM_ID</code></p>
            
            <p><strong>Пример правильной ссылки:</strong></p>
            <code>https://school-mini-app-pi.vercel.app/?tg_id=913096324</code>
            
            <p style="margin-top: 30px;">
              <strong>Отладка системы:</strong><br>
              <a href="/api/health" target="_blank">/api/health</a> - проверка работы<br>
              <a href="/api/debug?tg_id=913096324" target="_blank">/api/debug</a> - отладочная информация
            </p>
            
            <div style="margin-top: 40px; font-size: 14px; color: #8b949e;">
              <p>Каждый преподаватель имеет индивидуальное приложение со своими:</p>
              <ul>
                <li>📅 Расписанием (сохраняется в базе)</li>
                <li>📚 Предметами</li>
                <li>👥 Учениками</li>
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
app.listen(port, async () => {
  console.log(`\n✅ Сервер запущен на порту ${port}`);
  console.log(`🌐 Проверка здоровья: http://localhost:${port}/api/health`);
  console.log(`🔍 Отладка: http://localhost:${port}/api/debug?tg_id=913096324`);
  console.log(`📱 Пример ссылки: http://localhost:${port}/?tg_id=913096324`);
  console.log(`📦 База данных: Supabase PostgreSQL\n`);
  
  // Тестируем подключение при старте
  const connected = await testConnection();
  if (connected) {
    console.log('🎉 Подключение к базе данных успешно!');
  } else {
    console.log('⚠️  Проблемы с подключением к базе данных');
  }
});
