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

// ===== API =====

// 1. Получить расписание
app.get('/api/my-schedule', async (req, res) => {
  try {
    // Получаем ID учителя
    const userResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/users?telegram_id=eq.913096324&select=id`,
      { headers: createHeaders() }
    );
    
    const users = await userResponse.json();
    if (users.length === 0) {
      return res.json({ _timestamp: Date.now() });
    }
    
    const teacherId = users[0].id;
    
    // Получаем расписание
    const scheduleResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/schedules?teacher_id=eq.${teacherId}&select=day,time_slot,status`,
      { headers: createHeaders() }
    );
    
    const schedules = await scheduleResponse.json();
    
    // Формируем ответ
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
    console.error('Ошибка загрузки расписания:', error);
    res.json({ _timestamp: Date.now() });
  }
});

// 2. Сохранить расписание (ИСПРАВЛЕННАЯ ВЕРСИЯ)
app.post('/api/schedule/:tgId', async (req, res) => {
  console.log('💾 Начало сохранения расписания');
  
  try {
    const { tgId } = req.params;
    const newSchedule = req.body;
    
    // Получаем ID учителя
    const userResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/users?telegram_id=eq.${tgId}&select=id`,
      { headers: createHeaders() }
    );
    
    const users = await userResponse.json();
    if (users.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    const teacherId = users[0].id;
    console.log(`👨‍🏫 Teacher ID: ${teacherId}`);
    
    // ПОДГОТОВКА ДАННЫХ ДЛЯ UPSERT
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
    
    if (scheduleData.length === 0) {
      // Если нет данных - удаляем все расписание
      await fetch(
        `${SUPABASE_URL}/rest/v1/schedules?teacher_id=eq.${teacherId}`,
        {
          method: 'DELETE',
          headers: createHeaders(true)
        }
      );
    } else {
      // Используем UPSERT через цикл для каждого слота
      for (const slot of scheduleData) {
        await fetch(
          `${SUPABASE_URL}/rest/v1/schedules`,
          {
            method: 'POST',
            headers: {
              ...createHeaders(true),
              'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify(slot)
          }
        );
      }
    }
    
    console.log('✅ Расписание сохранено успешно');
    
    res.json({ 
      ok: true, 
      message: "Расписание сохранено",
      savedSlots: scheduleData.length,
      _timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('❌ Ошибка сохранения:', error);
    
    // Детальный лог ошибки
    res.status(500).json({ 
      error: 'Ошибка сохранения',
      message: error.message,
      stack: error.stack,
      _timestamp: Date.now()
    });
  }
});

// 3. Проверка таблицы schedules
app.get('/api/check-schedules', async (req, res) => {
  try {
    // Проверяем есть ли таблица и данные
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/schedules?limit=1`,
      { headers: createHeaders() }
    );
    
    const result = {
      status: response.status,
      ok: response.ok,
      tableExists: response.ok
    };
    
    if (response.ok) {
      const data = await response.json();
      result.count = data.length;
      result.sample = data;
    } else {
      result.error = await response.text();
    }
    
    res.json(result);
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Простой тест записи
app.post('/api/test-save', async (req, res) => {
  try {
    // Тестовая запись
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
      status: response.status,
      ok: response.ok,
      testData: testData
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Остальные эндпоинты (user, profile, bookings) остаются как в предыдущем коде

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`✅ Сервер запущен на порту ${port}`);
  console.log(`🔑 Используется Supabase REST API`);
});
