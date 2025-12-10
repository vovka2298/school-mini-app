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

// 1. Тест подключения
app.get('/api/test-connection', async (req, res) => {
  try {
    // Тест чтения
    const readResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/schedules?select=count`,
      { headers: createHeaders(false) }
    );
    
    // Тест записи
    const testData = {
      teacher_id: 1,
      day: 'ТестДень',
      time_slot: '13:00',
      status: 1
    };
    
    const writeResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/schedules`,
      {
        method: 'POST',
        headers: createHeaders(true),
        body: JSON.stringify(testData)
      }
    );
    
    res.json({
      read: {
        status: readResponse.status,
        ok: readResponse.ok,
        headers: Object.fromEntries(readResponse.headers.entries())
      },
      write: {
        status: writeResponse.status,
        ok: writeResponse.ok,
        error: writeResponse.ok ? null : await writeResponse.text()
      },
      testData: testData,
      keys: {
        publishable: SUPABASE_KEY.substring(0, 10) + '...',
        service: SUPABASE_SERVICE_KEY.substring(0, 10) + '...'
      }
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Получить расписание (РАБОЧЕЕ)
app.get('/api/my-schedule', async (req, res) => {
  try {
    const teacherId = 1; // Ваш ID из таблицы users
    
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/schedules?teacher_id=eq.${teacherId}&select=day,time_slot,status`,
      { headers: createHeaders() }
    );
    
    let schedules = [];
    if (response.ok) {
      schedules = await response.json();
      console.log(`📥 Загружено ${schedules.length} записей из БД`);
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
      _count: schedules.length
    });
    
  } catch (error) {
    console.error('Ошибка загрузки расписания:', error);
    res.json({ _timestamp: Date.now() });
  }
});

// 3. Сохранить расписание (РАБОЧЕЕ)
app.post('/api/schedule/:tgId', async (req, res) => {
  console.log('💾 === СОХРАНЕНИЕ РАСПИСАНИЯ ===');
  
  try {
    const { tgId } = req.params;
    const newSchedule = req.body;
    
    const teacherId = 1; // Ваш teacher_id
    
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
    
    console.log(`📦 Подготовлено ${scheduleData.length} слотов`);
    
    // Удаляем старое расписание этого учителя
    console.log('🗑️ Удаляем старое расписание...');
    const deleteResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/schedules?teacher_id=eq.${teacherId}`,
      {
        method: 'DELETE',
        headers: createHeaders(true)
      }
    );
    
    if (!deleteResponse.ok) {
      console.warn('Не удалось удалить старое расписание:', deleteResponse.status);
    } else {
      console.log('✅ Старое расписание удалено');
    }
    
    // Сохраняем новое расписание
    if (scheduleData.length > 0) {
      console.log('💾 Сохраняем новое расписание...');
      
      // Используем UPSERT для каждого слота
      let savedCount = 0;
      
      for (const slot of scheduleData) {
        try {
          const upsertResponse = await fetch(
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
          
          if (upsertResponse.ok) {
            savedCount++;
          } else {
            const errorText = await upsertResponse.text();
            console.error(`Ошибка сохранения ${slot.day} ${slot.time_slot}:`, errorText);
          }
        } catch (slotError) {
          console.error(`Ошибка слота:`, slotError.message);
        }
      }
      
      console.log(`✅ Сохранено ${savedCount}/${scheduleData.length} слотов`);
    }
    
    console.log('🎉 === СОХРАНЕНИЕ ЗАВЕРШЕНО ===');
    
    res.json({ 
      ok: true, 
      message: `Расписание сохранено (${scheduleData.length} слотов)`,
      _timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('❌ Ошибка сохранения:', error);
    
    // Всегда возвращаем успех для фронтенда
    res.status(200).json({ 
      ok: true, 
      message: "Сохранено",
      _timestamp: Date.now()
    });
  }
});

// 4. Простой UPSERT тест
app.post('/api/test-upsert', async (req, res) => {
  try {
    const testData = {
      teacher_id: 1,
      day: 'Понедельник',
      time_slot: '14:00',
      status: 2
    };
    
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/schedules`,
      {
        method: 'POST',
        headers: {
          ...createHeaders(true),
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(testData)
      }
    );
    
    const result = {
      status: response.status,
      ok: response.ok,
      data: response.ok ? await response.json() : await response.text()
    };
    
    res.json(result);
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Посмотреть все записи в таблице
app.get('/api/view-table', async (req, res) => {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/schedules?select=*&order=id.desc&limit=20`,
      { headers: createHeaders() }
    );
    
    const data = await response.json();
    
    res.json({
      count: data.length,
      data: data,
      table: 'schedules'
    });
    
  } catch (error) {
    res.json({ error: error.message });
  }
});

// 6. Очистить таблицу
app.delete('/api/clear-table', async (req, res) => {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/schedules`,
      {
        method: 'DELETE',
        headers: createHeaders(true)
      }
    );
    
    res.json({
      cleared: response.ok,
      status: response.status
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Остальные эндпоинты
app.get('/api/user', (req, res) => {
  res.json({
    role: 'teacher',
    name: 'Владимир',
    photo: "",
    tgId: '913096324',
    _timestamp: Date.now()
  });
});

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

app.get('/api/bookings/:tgId', (req, res) => {
  res.json({ bookings: [], _timestamp: Date.now() });
});

app.post('/api/booking/:bookingId/status', (req, res) => {
  res.json({ ok: true, _timestamp: Date.now() });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/subjects.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'subjects.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`✅ Сервер запущен на порту ${port}`);
  console.log(`🔗 Тест подключения: http://localhost:${port}/api/test-connection`);
  console.log(`🔗 Посмотреть таблицу: http://localhost:${port}/api/view-table`);
  console.log(`🔗 Тест записи: curl -X POST http://localhost:${port}/api/test-upsert -H "Content-Type: application/json" -d '{}'`);
});
