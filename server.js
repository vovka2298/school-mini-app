const express = require('express');
const path = require('path');

// Импортируем Vercel KV
const { kv } = require('@vercel/kv');

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

// Ключи для хранения в KV
const KV_KEYS = {
  USERS: 'school:users',
  SCHEDULES: 'school:schedules',
  PROFILES: 'school:profiles',
  ADMINS: 'school:admins'
};

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ KV ===

// Получить данные из KV
async function getKVData(key, defaultValue = {}) {
  try {
    console.log(`🔍 Получение из KV: ${key}`);
    const data = await kv.get(key);
    return data || defaultValue;
  } catch (error) {
    console.error(`❌ Ошибка получения ${key}:`, error);
    return defaultValue;
  }
}

// Сохранить данные в KV
async function setKVData(key, value) {
  try {
    console.log(`💾 Сохранение в KV: ${key}`);
    await kv.set(key, value);
    console.log(`✅ Успешно сохранено в KV: ${key}`);
    return true;
  } catch (error) {
    console.error(`❌ Ошибка сохранения ${key}:`, error);
    return false;
  }
}

// Получить все данные из KV
async function getAllData() {
  try {
    const [users, schedules, profiles, admins] = await Promise.all([
      getKVData(KV_KEYS.USERS, {}),
      getKVData(KV_KEYS.SCHEDULES, {}),
      getKVData(KV_KEYS.PROFILES, {}),
      getKVData(KV_KEYS.ADMINS, [])
    ]);
    
    console.log('📊 Данные загружены из KV:');
    console.log(`👤 Пользователей: ${Object.keys(users).length}`);
    console.log(`📅 Расписаний: ${Object.keys(schedules).length}`);
    console.log(`📋 Профилей: ${Object.keys(profiles).length}`);
    console.log(`👑 Админов: ${admins.length}`);
    
    return { users, schedules, profiles, admins };
  } catch (error) {
    console.error('❌ Ошибка загрузки всех данных:', error);
    return {
      users: {},
      schedules: {},
      profiles: {},
      admins: []
    };
  }
}

// Сохранить все данные в KV
async function saveAllData(data) {
  try {
    console.log('💾 Сохранение всех данных в KV...');
    
    const results = await Promise.allSettled([
      setKVData(KV_KEYS.USERS, data.users),
      setKVData(KV_KEYS.SCHEDULES, data.schedules),
      setKVData(KV_KEYS.PROFILES, data.profiles),
      setKVData(KV_KEYS.ADMINS, data.admins)
    ]);
    
    const success = results.every(r => r.status === 'fulfilled' && r.value === true);
    
    if (success) {
      console.log('✅ Все данные сохранены в KV!');
      return true;
    } else {
      console.error('❌ Ошибка при сохранении некоторых данных');
      return false;
    }
  } catch (error) {
    console.error('❌ Критическая ошибка сохранения:', error);
    return false;
  }
}

// Инициализация данных при запуске
async function initializeData() {
  console.log('\n🚀 ИНИЦИАЛИЗАЦИЯ ДАННЫХ KV\n');
  
  let data = await getAllData();
  
  // Создаем вечного админа если нет
  const eternalAdminId = "913096324";
  if (!data.admins.includes(eternalAdminId)) {
    console.log(`👑 Создание вечного админа: ${eternalAdminId}`);
    
    data.admins.push(eternalAdminId);
    data.users[eternalAdminId] = { 
      name: "Владимир", 
      role: "admin" 
    };
    data.schedules[eternalAdminId] = data.schedules[eternalAdminId] || {};
    data.profiles[eternalAdminId] = { 
      subjects: ["МатематикаЕГЭ", "ФизикаОГЭ"], 
      gender: "Мужской" 
    };
    
    await saveAllData(data);
    console.log('✅ Вечный админ создан и сохранен в KV!');
  } else {
    console.log('✅ Вечный админ уже существует');
  }
  
  console.log('\n✅ ИНИЦИАЛИЗАЦИЯ ЗАВЕРШЕНА\n');
  return data;
}

// Глобальные переменные (кеш в памяти для скорости)
let dataCache = {
  users: {},
  schedules: {},
  profiles: {},
  admins: []
};

// Загружаем данные при старте
initializeData().then(data => {
  dataCache = data;
  console.log('📦 Данные загружены в кеш памяти');
});

// Функция для обновления кеша
async function updateCache() {
  console.log('🔄 Обновление кеша из KV...');
  const freshData = await getAllData();
  dataCache = freshData;
  return freshData;
}

// === API ENDPOINTS ===

// Главная страница
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Страница предметов
app.get('/subjects.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'subjects.html'));
});

// Получить данные пользователя
app.get('/api/user', async (req, res) => {
  const id = "913096324";
  
  res.set('Cache-Control', 'no-store');
  res.json({
    role: 'admin',
    name: "Владимир",
    photo: "",
    tgId: id,
    _timestamp: Date.now(),
    _source: 'KV'
  });
});

// Получить ТОЛЬКО свое расписание
app.get('/api/my-schedule', async (req, res) => {
  const id = "913096324";
  
  // Обновляем кеш перед выдачей
  await updateCache();
  
  const schedule = dataCache.schedules[id] || {};
  
  // Убедимся, что все дни существуют
  const days = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
  const fullSchedule = {};
  
  days.forEach(day => {
    fullSchedule[day] = schedule[day] || {};
  });
  
  res.set('Cache-Control', 'no-store');
  res.json({
    ...fullSchedule,
    _synced: true,
    _timestamp: Date.now(),
    _source: 'KV',
    _persistent: true
  });
});

// Сохранить расписание (В KV!)
app.post('/api/schedule/:tgId', async (req, res) => {
  const target = req.params.tgId;
  const newSchedule = req.body;
  
  console.log(`💾 СОХРАНЕНИЕ РАСПИСАНИЯ В KV для ${target}`);
  
  // Обновляем кеш
  await updateCache();
  
  // Создаем чистое расписание
  const days = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
  const cleanSchedule = {};
  
  days.forEach(day => {
    if (newSchedule[day] && typeof newSchedule[day] === 'object') {
      cleanSchedule[day] = {};
      for (const time in newSchedule[day]) {
        const state = newSchedule[day][time];
        if (state >= 0 && state <= 2) {
          cleanSchedule[day][time] = state;
        }
      }
    } else {
      cleanSchedule[day] = {};
    }
  });
  
  // Обновляем в кеше
  dataCache.schedules[target] = cleanSchedule;
  
  // Сохраняем в KV
  const saveSuccess = await setKVData(KV_KEYS.SCHEDULES, dataCache.schedules);
  
  if (saveSuccess) {
    console.log(`✅ Расписание сохранено в KV для ${target}`);
    
    res.set('Cache-Control', 'no-store');
    res.json({ 
      ok: true, 
      message: "Расписание сохранено в базу данных",
      schedule: cleanSchedule,
      _timestamp: Date.now(),
      _source: 'KV',
      _persistent: true
    });
  } else {
    res.status(500).json({ 
      ok: false, 
      error: "Ошибка сохранения в базу данных",
      _timestamp: Date.now()
    });
  }
});

// Получить профиль
app.get('/api/profile/:tgId', async (req, res) => {
  const tgId = req.params.tgId;
  
  // Обновляем кеш
  await updateCache();
  
  const profile = dataCache.profiles[tgId] || { 
    subjects: [], 
    gender: "Мужской" 
  };
  
  res.set('Cache-Control', 'no-store');
  res.json({
    ...profile,
    _timestamp: Date.now(),
    _source: 'KV'
  });
});

// Сохранить профиль (В KV!)
app.post('/api/profile/:tgId', async (req, res) => {
  const tgId = req.params.tgId;
  const profileData = req.body;
  
  console.log(`💾 СОХРАНЕНИЕ ПРОФИЛЯ В KV для ${tgId}`);
  
  // Обновляем кеш
  await updateCache();
  
  // Обновляем в кеше
  dataCache.profiles[tgId] = profileData;
  
  // Сохраняем в KV
  const saveSuccess = await setKVData(KV_KEYS.PROFILES, dataCache.profiles);
  
  if (saveSuccess) {
    console.log(`✅ Профиль сохранен в KV для ${tgId}`);
    
    res.set('Cache-Control', 'no-store');
    res.json({ 
      ok: true,
      message: "Профиль сохранен в базу данных",
      _timestamp: Date.now(),
      _source: 'KV',
      _persistent: true
    });
  } else {
    res.status(500).json({ 
      ok: false, 
      error: "Ошибка сохранения профиля в базу данных",
      _timestamp: Date.now()
    });
  }
});

// Статус сервера и KV
app.get('/api/status', async (req, res) => {
  // Тестируем подключение к KV
  let kvStatus = 'unknown';
  try {
    await kv.ping();
    kvStatus = 'connected';
  } catch (error) {
    kvStatus = 'disconnected';
  }
  
  // Получаем статистику
  const allData = await getAllData();
  
  res.json({
    status: "OK",
    serverTime: new Date().toISOString(),
    kv: kvStatus,
    stats: {
      users: Object.keys(allData.users).length,
      schedules: Object.keys(allData.schedules).length,
      profiles: Object.keys(allData.profiles).length,
      admins: allData.admins.length
    },
    cache: {
      users: Object.keys(dataCache.users).length,
      schedules: Object.keys(dataCache.schedules).length
    },
    eternalAdmin: "913096324",
    _timestamp: Date.now(),
    _source: 'KV'
  });
});

// Проверка данных в KV (для отладки)
app.get('/api/debug/kv', async (req, res) => {
  try {
    const allData = await getAllData();
    
    res.json({
      kvKeys: {
        users: KV_KEYS.USERS,
        schedules: KV_KEYS.SCHEDULES,
        profiles: KV_KEYS.PROFILES,
        admins: KV_KEYS.ADMINS
      },
      data: allData,
      eternalAdmin: {
        id: "913096324",
        exists: allData.admins.includes("913096324"),
        hasSchedule: !!allData.schedules["913096324"],
        hasProfile: !!allData.profiles["913096324"]
      },
      _timestamp: Date.now()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Сброс всех данных (только для разработки!)
app.post('/api/admin/reset', async (req, res) => {
  const { secret } = req.body;
  
  // Секретный ключ для защиты
  if (secret !== "reset_school_2024") {
    return res.status(403).json({ error: "Forbidden" });
  }
  
  console.log('⚠️  СБРОС ВСЕХ ДАННЫХ В KV!');
  
  // Создаем чистые данные с вечным админом
  const eternalAdminId = "913096324";
  const newData = {
    users: { [eternalAdminId]: { name: "Владимир", role: "admin" } },
    schedules: { [eternalAdminId]: {} },
    profiles: { [eternalAdminId]: { subjects: ["МатематикаЕГЭ", "ФизикаОГЭ"], gender: "Мужской" } },
    admins: [eternalAdminId]
  };
  
  // Сохраняем в KV
  const success = await saveAllData(newData);
  
  if (success) {
    // Обновляем кеш
    dataCache = newData;
    
    res.json({ 
      ok: true, 
      message: "Данные сброшены, вечный админ сохранен",
      eternalAdmin: eternalAdminId,
      _timestamp: Date.now()
    });
  } else {
    res.status(500).json({ 
      ok: false, 
      error: "Ошибка сброса данных" 
    });
  }
});

// Синхронизация кеша с KV
app.get('/api/sync', async (req, res) => {
  console.log('🔄 Принудительная синхронизация кеша с KV');
  
  await updateCache();
  
  res.json({
    ok: true,
    message: "Кеш синхронизирован с KV",
    timestamp: Date.now(),
    cacheSize: {
      users: Object.keys(dataCache.users).length,
      schedules: Object.keys(dataCache.schedules).length
    }
  });
});

// Для всех остальных маршрутов
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`
  ==========================================
  🚀 Сервер запущен на порту ${port}
  🗄️  Vercel KV: ВКЛЮЧЕН
  👑 Вечный админ: 913096324
  📁 Статика: public/
  ==========================================
  `);
  
  // Периодическая синхронизация с KV (каждые 5 минут)
  setInterval(async () => {
    console.log('⏰ Периодическая синхронизация с KV...');
    await updateCache();
  }, 5 * 60 * 1000); // 5 минут
  
  console.log('✅ Автосинхронизация с KV настроена (каждые 5 минут)');
});
