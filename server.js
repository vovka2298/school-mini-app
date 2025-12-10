const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Инициализация Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'https://rtywenfvaoxsjdkulmdk.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'sb_publishable_WhiVd5day72hRoTKiFtiIQ_sP2wu4_S';
const supabase = createClient(supabaseUrl, supabaseKey);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Заголовки против кеширования
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// === API ЭНДПОИНТЫ ===

// Получить данные пользователя
app.get('/api/user', async (req, res) => {
  try {
    const { tgId } = req.query;
    
    if (!tgId) {
      return res.status(400).json({ error: 'Требуется tgId' });
    }
    
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', tgId)
      .single();
    
    if (error) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    res.json({
      ...user,
      _timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получить расписание пользователя
app.get('/api/my-schedule', async (req, res) => {
  try {
    const { tgId } = req.query;
    
    if (!tgId) {
      return res.status(400).json({ error: 'Требуется tgId' });
    }
    
    // Находим пользователя
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('telegram_id', tgId)
      .single();
    
    if (userError || !user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    // Получаем расписание
    const { data: schedule, error: scheduleError } = await supabase
      .from('teacher_schedule')
      .select('*')
      .eq('teacher_id', user.id);
    
    if (scheduleError) {
      console.error('Schedule error:', scheduleError);
    }
    
    // Преобразуем в формат для фронтенда
    const formattedSchedule = {};
    const DAYS = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
    
    DAYS.forEach(day => {
      formattedSchedule[day] = {};
    });
    
    if (schedule) {
      schedule.forEach(item => {
        if (formattedSchedule[item.day_name]) {
          formattedSchedule[item.day_name][item.time_slot] = item.status;
        }
      });
    }
    
    res.json({
      ...formattedSchedule,
      _timestamp: Date.now(),
      _synced: true
    });
    
  } catch (error) {
    console.error('Schedule API Error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Сохранить расписание
app.post('/api/schedule/:tgId', async (req, res) => {
  try {
    const tgId = req.params.tgId;
    const schedule = req.body;
    
    console.log('💾 Сохранение расписания для:', tgId);
    
    // Находим пользователя
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('telegram_id', tgId)
      .single();
    
    if (userError || !user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    // Сохраняем каждую ячейку в базу
    const DAYS = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
    const operations = [];
    
    DAYS.forEach(day => {
      if (schedule[day]) {
        Object.entries(schedule[day]).forEach(([time, status]) => {
          operations.push(
            supabase
              .from('teacher_schedule')
              .upsert({
                teacher_id: user.id,
                day_name: day,
                time_slot: time,
                status: status,
                updated_at: new Date().toISOString()
              }, {
                onConflict: 'teacher_id,day_name,time_slot'
              })
          );
        });
      }
    });
    
    // Выполняем все операции
    await Promise.all(operations);
    
    console.log('✅ Расписание сохранено');
    
    res.json({ 
      ok: true, 
      message: "Расписание сохранено",
      _timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('Save Schedule Error:', error);
    res.status(500).json({ error: 'Ошибка сохранения' });
  }
});

// Получить профиль
app.get('/api/profile/:tgId', async (req, res) => {
  try {
    const tgId = req.params.tgId;
    
    const { data: user, error } = await supabase
      .from('users')
      .select('subjects, gender')
      .eq('telegram_id', tgId)
      .single();
    
    if (error) {
      return res.status(404).json({ 
        subjects: [], 
        gender: "Мужской" 
      });
    }
    
    res.json({
      subjects: user.subjects || [],
      gender: user.gender || "Мужской",
      _timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('Profile API Error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Сохранить профиль
app.post('/api/profile/:tgId', async (req, res) => {
  try {
    const tgId = req.params.tgId;
    const profile = req.body;
    
    const { error } = await supabase
      .from('users')
      .update({
        subjects: profile.subjects,
        gender: profile.gender,
        updated_at: new Date().toISOString()
      })
      .eq('telegram_id', tgId);
    
    if (error) throw error;
    
    res.json({ 
      ok: true,
      _timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('Save Profile Error:', error);
    res.status(500).json({ error: 'Ошибка сохранения' });
  }
});

// Статус сервера
app.get('/api/status', (req, res) => {
  res.json({
    status: "OK",
    serverTime: new Date().toISOString(),
    _timestamp: Date.now()
  });
});

// Главная страница
app.get('/', (req, res) => {
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

// Запуск сервера
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`✅ Сервер запущен на порту ${port}`);
  console.log(`🌐 Supabase URL: ${supabaseUrl}`);
  console.log(`📁 Статика: public/`);
  console.log(`👤 Тестовый ID: 913096324`);
});
