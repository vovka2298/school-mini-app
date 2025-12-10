const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

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

// ==================== SUPABASE КЛИЕНТ ====================

const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'your-anon-key';
const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🔗 Подключение к Supabase...');

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================

async function getUser(telegramId) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', telegramId)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  } catch (error) {
    console.error('Ошибка получения пользователя:', error);
    return null;
  }
}

async function getSchedule(teacherId) {
  try {
    const { data, error } = await supabase
      .from('schedules')
      .select('*')
      .eq('teacher_id', teacherId);
    
    if (error) throw error;
    
    // Преобразуем в формат старого API
    const schedule = {};
    const days = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
    
    days.forEach(day => {
      schedule[day] = {};
    });
    
    data.forEach(item => {
      if (schedule[item.day]) {
        schedule[item.day][item.time] = item.state;
      }
    });
    
    return schedule;
  } catch (error) {
    console.error('Ошибка получения расписания:', error);
    return {};
  }
}

async function saveSchedule(teacherId, scheduleData) {
  try {
    // Удаляем старые записи
    const { error: deleteError } = await supabase
      .from('schedules')
      .delete()
      .eq('teacher_id', teacherId);
    
    if (deleteError) throw deleteError;
    
    // Создаем новые записи
    const records = [];
    const days = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
    
    days.forEach(day => {
      if (scheduleData[day]) {
        for (const time in scheduleData[day]) {
          const state = scheduleData[day][time];
          if (state >= 0 && state <= 2) {
            records.push({
              teacher_id: teacherId,
              day: day,
              time: time,
              state: state
            });
          }
        }
      }
    });
    
    // Сохраняем пачками по 100 записей
    for (let i = 0; i < records.length; i += 100) {
      const batch = records.slice(i, i + 100);
      const { error } = await supabase
        .from('schedules')
        .insert(batch);
      
      if (error) throw error;
    }
    
    return { success: true };
  } catch (error) {
    console.error('Ошибка сохранения расписания:', error);
    return { success: false, error };
  }
}

async function getProfile(userId) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    
    return data || {
      subjects: [],
      gender: "Мужской"
    };
  } catch (error) {
    console.error('Ошибка получения профиля:', error);
    return {
      subjects: [],
      gender: "Мужской"
    };
  }
}

async function saveProfile(userId, profileData) {
  try {
    const { error } = await supabase
      .from('profiles')
      .upsert({
        user_id: userId,
        subjects: profileData.subjects || [],
        gender: profileData.gender || "Мужской",
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });
    
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Ошибка сохранения профиля:', error);
    return { success: false, error };
  }
}

async function getStudents(teacherId) {
  try {
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('teacher_id', teacherId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Ошибка получения учеников:', error);
    return [];
  }
}

async function addStudent(teacherId, studentData) {
  try {
    const { data, error } = await supabase
      .from('students')
      .insert({
        teacher_id: teacherId,
        full_name: studentData.full_name,
        class: studentData.class,
        subject: studentData.subject,
        status: 'active'
      })
      .select()
      .single();
    
    if (error) throw error;
    return { success: true, student: data };
  } catch (error) {
    console.error('Ошибка добавления ученика:', error);
    return { success: false, error };
  }
}

// ==================== API ====================

// Главная страница
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/subjects.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'subjects.html'));
});

// Получить данные пользователя
app.get('/api/user', async (req, res) => {
  try {
    // Получаем telegram_id из initData Telegram или query параметра
    let telegramId = req.query.tgId;
    
    // Если нет в query, пробуем получить из заголовков (для Telegram Web App)
    if (!telegramId && req.headers['x-telegram-data']) {
      try {
        const initData = new URLSearchParams(req.headers['x-telegram-data']);
        const userData = JSON.parse(initData.get('user') || '{}');
        telegramId = userData.id?.toString();
      } catch (e) {
        console.log('Не удалось получить Telegram ID из заголовков');
      }
    }
    
    // Если все еще нет - используем дефолтный
    if (!telegramId) {
      telegramId = "913096324";
    }
    
    const user = await getUser(telegramId);
    
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        exists: false
      });
    }
    
    res.json({
      role: user.role,
      name: user.full_name,
      tgId: user.telegram_id,
      status: user.status,
      _timestamp: Date.now()
    });
  } catch (error) {
    console.error('Ошибка получения пользователя:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Получить расписание
app.get('/api/my-schedule', async (req, res) => {
  try {
    const tgId = req.query.tgId || "913096324";
    const schedule = await getSchedule(tgId);
    
    // Убедимся, что все дни существуют
    const days = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
    days.forEach(day => {
      if (!schedule[day]) {
        schedule[day] = {};
      }
    });
    
    res.json({
      ...schedule,
      _synced: true,
      _timestamp: Date.now()
    });
  } catch (error) {
    console.error('Ошибка получения расписания:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Сохранить расписание
app.post('/api/schedule/:tgId', async (req, res) => {
  try {
    const teacherId = req.params.tgId;
    const scheduleData = req.body;
    
    console.log(`💾 Сохранение расписания для ${teacherId}`);
    
    const result = await saveSchedule(teacherId, scheduleData);
    
    if (!result.success) {
      throw result.error;
    }
    
    res.json({
      ok: true,
      message: "Расписание сохранено",
      _timestamp: Date.now()
    });
  } catch (error) {
    console.error('Ошибка сохранения расписания:', error);
    res.status(500).json({ 
      ok: false, 
      error: 'Failed to save schedule' 
    });
  }
});

// Получить профиль
app.get('/api/profile/:tgId', async (req, res) => {
  try {
    const tgId = req.params.tgId;
    const profile = await getProfile(tgId);
    
    res.json({
      ...profile,
      _timestamp: Date.now()
    });
  } catch (error) {
    console.error('Ошибка получения профиля:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Сохранить профиль
app.post('/api/profile/:tgId', async (req, res) => {
  try {
    const tgId = req.params.tgId;
    const profileData = req.body;
    
    const result = await saveProfile(tgId, profileData);
    
    if (!result.success) {
      throw result.error;
    }
    
    res.json({
      ok: true,
      _timestamp: Date.now()
    });
  } catch (error) {
    console.error('Ошибка сохранения профиля:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Получить учеников
app.get('/api/students/:teacherId', async (req, res) => {
  try {
    const teacherId = req.params.teacherId;
    const students = await getStudents(teacherId);
    
    const activeStudents = students.filter(s => s.status === 'active');
    
    res.json({
      students: students,
      total: students.length,
      active: activeStudents.length,
      _timestamp: Date.now()
    });
  } catch (error) {
    console.error('Ошибка получения учеников:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Добавить ученика
app.post('/api/students/:teacherId/add', async (req, res) => {
  try {
    const teacherId = req.params.teacherId;
    const { name, class: studentClass, subject } = req.body;
    
    if (!name || !studentClass || !subject) {
      return res.status(400).json({ error: 'Все поля обязательны' });
    }
    
    const result = await addStudent(teacherId, {
      full_name: name,
      class: studentClass,
      subject: subject
    });
    
    if (!result.success) {
      throw result.error;
    }
    
    res.json({
      ok: true,
      student: result.student,
      _timestamp: Date.now()
    });
  } catch (error) {
    console.error('Ошибка добавления ученика:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Регистрация пользователя (для бота)
app.post('/api/register-user', async (req, res) => {
  try {
    const { telegram_id, telegram_username, full_name, role } = req.body;
    
    if (!telegram_id || !full_name || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const { data, error } = await supabase
      .from('users')
      .upsert({
        telegram_id: telegram_id,
        telegram_username: telegram_username,
        full_name: full_name,
        role: role,
        status: 'active'
      }, {
        onConflict: 'telegram_id'
      })
      .select()
      .single();
    
    if (error) throw error;
    
    res.json({
      ok: true,
      user: data,
      _timestamp: Date.now()
    });
  } catch (error) {
    console.error('Ошибка регистрации пользователя:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Проверить пользователя (для бота)
app.get('/api/check-user/:telegramId', async (req, res) => {
  try {
    const telegramId = req.params.telegramId;
    const user = await getUser(telegramId);
    
    if (!user) {
      return res.json({
        exists: false,
        message: "User not found"
      });
    }
    
    res.json({
      exists: true,
      name: user.full_name,
      role: user.role.replace('pending_', ''),
      status: user.status,
      isActive: user.status === 'active',
      isTeacher: user.role.includes('teacher'),
      isManager: user.role.includes('manager')
    });
  } catch (error) {
    console.error('Ошибка проверки пользователя:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Статус сервера
app.get('/api/status', async (req, res) => {
  try {
    const { count: usersCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });
    
    const { count: schedulesCount } = await supabase
      .from('schedules')
      .select('*', { count: 'exact', head: true });
    
    res.json({
      status: "OK",
      database: "Supabase",
      usersCount: usersCount || 0,
      schedulesCount: schedulesCount || 0,
      _timestamp: Date.now()
    });
  } catch (error) {
    res.json({
      status: "ERROR",
      error: error.message,
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
  console.log(`🗄️  База данных: Supabase`);
  console.log(`🌐 URL: ${supabaseUrl}`);
});
