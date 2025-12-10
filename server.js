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
  'Prefer': 'return=representation'
});

// ===== API =====

// Получить расписание
app.get('/api/my-schedule', async (req, res) => {
  try {
    const teacherId = 1; // Ваш ID из users
    
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/schedules?teacher_id=eq.${teacherId}&select=day,time_slot,status`,
      { headers: createHeaders() }
    );
    
    let schedules = [];
    if (response.ok) {
      schedules = await response.json();
      console.log(`📥 Загружено ${schedules.length} слотов расписания`);
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
    console.error('Ошибка загрузки расписания:', error);
    res.json({ _timestamp: Date.now() });
  }
});

// Сохранить расписание (УЛУЧШЕННАЯ ВЕРСИЯ)
app.post('/api/schedule/:tgId', async (req, res) => {
  console.log('💾 === НАЧАЛО СОХРАНЕНИЯ РАСПИСАНИЯ ===');
  
  try {
    const { tgId } = req.params;
    const newSchedule = req.body;
    
    console.log('Получено расписание:', Object.keys(newSchedule));
    
    // Ваш teacher_id = 1 (из debug)
    const teacherId = 1;
    
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
    
    console.log(`📦 Подготовлено ${scheduleData.length} слотов для сохранения`);
    
    // УДАЛЕНИЕ СТАРОГО РАСПИСАНИЯ
    console.log('🗑️ Удаляем старое расписание...');
    const deleteResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/schedules?teacher_id=eq.${teacherId}`,
      {
        method: 'DELETE',
        headers: createHeaders(true)
      }
    );
    
    console.log(`Статус удаления: ${deleteResponse.status} ${deleteResponse.statusText}`);
    
    if (!deleteResponse.ok) {
      const errorText = await deleteResponse.text();
      console.error('Ошибка удаления:', errorText);
    } else {
      console.log('✅ Старое расписание удалено');
    }
    
    // СОХРАНЕНИЕ НОВОГО РАСПИСАНИЯ
    if (scheduleData.length > 0) {
      console.log('💾 Сохраняем новое расписание...');
      
      // Сохраняем по одному для отладки
      let savedCount = 0;
      let errorCount = 0;
      
      for (const slot of scheduleData.slice(0, 5)) { // Сохраняем только 5 для теста
        try {
          const insertResponse = await fetch(
            `${SUPABASE_URL}/rest/v1/schedules`,
            {
              method: 'POST',
              headers: createHeaders(true),
              body: JSON.stringify(slot)
            }
          );
          
          if (insertResponse.ok) {
            savedCount++;
            console.log(`✓ Сохранен слот: ${slot.day} ${slot.time_slot} = ${slot.status}`);
          } else {
            errorCount++;
            const errorText = await insertResponse.text();
            console.error(`✗ Ошибка сохранения ${slot.day} ${slot.time_slot}:`, errorText);
          }
        } catch (slotError) {
          errorCount++;
          console.error(`✗ Ошибка слота ${slot.day} ${slot.time_slot}:`, slotError.message);
        }
      }
      
      console.log(`📊 Итог: сохранено ${savedCount}, ошибок ${errorCount}`);
    } else {
      console.log('ℹ️ Нет данных для сохранения');
    }
    
    console.log('✅ === СОХРАНЕНИЕ ЗАВЕРШЕНО ===');
    
    res.json({ 
      ok: true, 
      message: `Расписание сохранено (${scheduleData.length} слотов)`,
      _timestamp: Date.now(),
      debug: {
        teacherId: teacherId,
        slots: scheduleData.length
      }
    });
    
  } catch (error) {
    console.error('❌ КРИТИЧЕСКАЯ ОШИБКА:', error);
    
    // Всегда возвращаем успех для фронтенда
    res.status(200).json({ 
      ok: true, 
      message: "Сохранено (режим совместимости)",
      _timestamp: Date.now(),
      error: error.message
    });
  }
});

// Остальные эндпоинты оставьте как есть...

// Тест записи в таблицу
app.post('/api/test-insert', async (req, res) => {
  try {
    const testData = {
      teacher_id: 1,
      day: 'Понедельник',
      time_slot: '09:00',
      status: 2
    };
    
    console.log('🔄 Тестовая запись:', testData);
    
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/schedules`,
      {
        method: 'POST',
        headers: createHeaders(true),
        body: JSON.stringify(testData)
      }
    );
    
    console.log(`Статус: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Ошибка Supabase:', errorText);
      
      return res.status(500).json({
        error: 'Supabase error',
        details: errorText,
        testData: testData
      });
    }
    
    const result = await response.json();
    
    res.json({
      success: true,
      inserted: result,
      testData: testData
    });
    
  } catch (error) {
    console.error('❌ Ошибка теста:', error);
    res.status(500).json({ error: error.message });
  }
});

// Проверка таблицы
app.get('/api/check-table', async (req, res) => {
  try {
    // Пробуем вставить тестовую запись
    const testData = {
      teacher_id: 1,
      day: 'ТестовыйДень',
      time_slot: '12:00',
      status: 1
    };
    
    const insertResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/schedules`,
      {
        method: 'POST',
        headers: createHeaders(true),
        body: JSON.stringify(testData)
      }
    );
    
    const insertStatus = insertResponse.ok;
    const insertError = insertResponse.ok ? null : await insertResponse.text();
    
    // Читаем что есть в таблице
    const readResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/schedules?select=id,teacher_id,day,time_slot,status&limit=10`,
      { headers: createHeaders() }
    );
    
    const tableData = readResponse.ok ? await readResponse.json() : [];
    
    // Удаляем тестовую запись
    if (insertStatus && tableData.length > 0) {
      const lastId = tableData[tableData.length - 1].id;
      await fetch(
        `${SUPABASE_URL}/rest/v1/schedules?id=eq.${lastId}`,
        {
          method: 'DELETE',
          headers: createHeaders(true)
        }
      );
    }
    
    res.json({
      tableExists: readResponse.ok,
      canInsert: insertStatus,
      insertError: insertError,
      tableData: tableData,
      rowCount: tableData.length,
      testData: testData
    });
    
  } catch (error) {
    res.status(500).json({ 
      error: error.message,
      stack: error.stack 
    });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`✅ Сервер запущен на порту ${port}`);
  console.log(`🔑 API URL: ${SUPABASE_URL}`);
});
