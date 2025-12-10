const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Подключение к Supabase PostgreSQL
const pool = new Pool({
  connectionString: 'postgresql://postgres:1234@db.rtywenfvaoxsjdkulmdk.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

// Заголовки против кеширования
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// ===== API с БД =====

// Получить данные пользователя
app.get('/api/user', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, telegram_id, first_name, last_name, role 
       FROM users WHERE telegram_id = $1`,
      ['913096324']
    );
    
    const user = result.rows[0] || {
      telegram_id: '913096324',
      first_name: 'Владимир',
      role: 'teacher'
    };
    
    res.json({
      role: user.role,
      name: user.first_name || 'Владимир',
      photo: "",
      tgId: user.telegram_id,
      _timestamp: Date.now()
    });
  } catch (error) {
    console.error('Ошибка загрузки пользователя:', error);
    res.json({
      role: 'teacher',
      name: 'Владимир',
      photo: "",
      tgId: '913096324',
      _timestamp: Date.now()
    });
  }
});

// Получить расписание пользователя
app.get('/api/my-schedule', async (req, res) => {
  try {
    // Получаем ID пользователя
    const userResult = await pool.query(
      'SELECT id FROM users WHERE telegram_id = $1',
      ['913096324']
    );
    
    const teacherId = userResult.rows[0]?.id;
    if (!teacherId) {
      return res.json({ _timestamp: Date.now() });
    }
    
    // Загружаем расписание
    const scheduleResult = await pool.query(
      `SELECT day, time_slot, status 
       FROM schedules 
       WHERE teacher_id = $1`,
      [teacherId]
    );
    
    // Формируем расписание
    const schedule = {};
    const days = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
    
    days.forEach(day => {
      schedule[day] = {};
    });
    
    scheduleResult.rows.forEach(row => {
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

// Сохранить расписание
app.post('/api/schedule/:tgId', async (req, res) => {
  try {
    const { tgId } = req.params;
    const newSchedule = req.body;
    
    // Получаем ID пользователя
    const userResult = await pool.query(
      'SELECT id FROM users WHERE telegram_id = $1',
      [tgId]
    );
    
    const teacherId = userResult.rows[0]?.id;
    if (!teacherId) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    // Подготавливаем данные для вставки
    const values = [];
    const placeholders = [];
    let paramIndex = 1;
    
    Object.keys(newSchedule).forEach(day => {
      Object.keys(newSchedule[day]).forEach(time => {
        const status = newSchedule[day][time];
        values.push(teacherId, day, time, status);
        placeholders.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3})`);
        paramIndex += 4;
      });
    });
    
    if (values.length === 0) {
      // Удаляем старое расписание если пустое
      await pool.query(
        'DELETE FROM schedules WHERE teacher_id = $1',
        [teacherId]
      );
    } else {
      // Используем UPSERT для обновления или вставки
      await pool.query(`
        INSERT INTO schedules (teacher_id, day, time_slot, status)
        VALUES ${placeholders.join(', ')}
        ON CONFLICT (teacher_id, day, time_slot) 
        DO UPDATE SET status = EXCLUDED.status, updated_at = CURRENT_TIMESTAMP
      `, values);
    }
    
    res.json({ 
      ok: true, 
      message: "Расписание сохранено",
      _timestamp: Date.now()
    });
  } catch (error) {
    console.error('Ошибка сохранения расписания:', error);
    res.status(500).json({ error: 'Ошибка сохранения' });
  }
});

// Получить профиль с предметами
app.get('/api/profile/:tgId', async (req, res) => {
  try {
    const { tgId } = req.params;
    
    const userResult = await pool.query(
      'SELECT id FROM users WHERE telegram_id = $1',
      [tgId]
    );
    
    const teacherId = userResult.rows[0]?.id;
    if (!teacherId) {
      return res.json({ subjects: [], gender: "Мужской", _timestamp: Date.now() });
    }
    
    // Получаем предметы
    const subjectsResult = await pool.query(
      'SELECT subject FROM teacher_subjects WHERE teacher_id = $1',
      [teacherId]
    );
    
    // Получаем профиль
    const profileResult = await pool.query(
      'SELECT gender FROM teacher_profiles WHERE teacher_id = $1',
      [teacherId]
    );
    
    res.json({
      subjects: subjectsResult.rows.map(row => row.subject),
      gender: profileResult.rows[0]?.gender || "Мужской",
      _timestamp: Date.now()
    });
  } catch (error) {
    console.error('Ошибка загрузки профиля:', error);
    res.json({ subjects: [], gender: "Мужской", _timestamp: Date.now() });
  }
});

// Сохранить профиль с предметами
app.post('/api/profile/:tgId', async (req, res) => {
  try {
    const { tgId } = req.params;
    const { subjects, gender } = req.body;
    
    const userResult = await pool.query(
      'SELECT id FROM users WHERE telegram_id = $1',
      [tgId]
    );
    
    const teacherId = userResult.rows[0]?.id;
    if (!teacherId) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    // Обновляем профиль
    await pool.query(`
      INSERT INTO teacher_profiles (teacher_id, gender)
      VALUES ($1, $2)
      ON CONFLICT (teacher_id) 
      DO UPDATE SET gender = EXCLUDED.gender, updated_at = CURRENT_TIMESTAMP
    `, [teacherId, gender]);
    
    // Обновляем предметы
    await pool.query(
      'DELETE FROM teacher_subjects WHERE teacher_id = $1',
      [teacherId]
    );
    
    if (subjects && subjects.length > 0) {
      const subjectValues = subjects.map(subject => [teacherId, subject]);
      const placeholders = subjectValues.map((_, i) => 
        `($${i * 2 + 1}, $${i * 2 + 2})`
      ).join(', ');
      
      const flatValues = subjectValues.flat();
      
      await pool.query(`
        INSERT INTO teacher_subjects (teacher_id, subject)
        VALUES ${placeholders}
      `, flatValues);
    }
    
    res.json({ 
      ok: true,
      _timestamp: Date.now()
    });
  } catch (error) {
    console.error('Ошибка сохранения профиля:', error);
    res.status(500).json({ error: 'Ошибка сохранения' });
  }
});

// Получить заявки (для вкладки "Заявки")
app.get('/api/bookings/:tgId', async (req, res) => {
  try {
    const { tgId } = req.params;
    
    const userResult = await pool.query(
      'SELECT id FROM users WHERE telegram_id = $1',
      [tgId]
    );
    
    const teacherId = userResult.rows[0]?.id;
    if (!teacherId) {
      return res.json({ bookings: [], _timestamp: Date.now() });
    }
    
    const bookingsResult = await pool.query(`
      SELECT b.id, b.day, b.time_slot, b.subject, b.status, b.created_at,
             u.first_name, u.last_name, u.telegram_id as student_tg_id
      FROM bookings b
      JOIN users u ON b.student_id = u.id
      WHERE b.teacher_id = $1
      ORDER BY b.day, b.time_slot
    `, [teacherId]);
    
    res.json({
      bookings: bookingsResult.rows,
      _timestamp: Date.now()
    });
  } catch (error) {
    console.error('Ошибка загрузки заявок:', error);
    res.json({ bookings: [], _timestamp: Date.now() });
  }
});

// Обновить статус заявки
app.post('/api/booking/:bookingId/status', async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { status } = req.body;
    
    await pool.query(
      'UPDATE bookings SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [status, bookingId]
    );
    
    res.json({ ok: true, _timestamp: Date.now() });
  } catch (error) {
    console.error('Ошибка обновления заявки:', error);
    res.status(500).json({ error: 'Ошибка обновления' });
  }
});

// Проверка статуса сервера
app.get('/api/status', async (req, res) => {
  try {
    const usersCount = await pool.query('SELECT COUNT(*) FROM users');
    const schedulesCount = await pool.query('SELECT COUNT(*) FROM schedules');
    
    res.json({
      status: "OK",
      database: "Connected",
      usersCount: parseInt(usersCount.rows[0].count),
      schedulesCount: parseInt(schedulesCount.rows[0].count),
      _timestamp: Date.now()
    });
  } catch (error) {
    res.json({
      status: "ERROR",
      database: "Disconnected",
      error: error.message,
      _timestamp: Date.now()
    });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`✅ Сервер запущен на порту ${port}`);
  console.log(`📦 Используется Supabase PostgreSQL`);
});
