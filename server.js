const express = require('express');
const { Redis } = require('@upstash/redis');

const app = express();
app.use(express.json());
app.use(express.static('public'));

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: 'default', // не нужен при REST URL
});

const BOT_TOKEN = '8203853124:AAHQmyBWNp1MdSR9B9bOMGbR8X1k6z6P08A';
const OWNER_ID = "913096324";

function validateInitData(initData) {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    params.delete('hash');
    const sorted = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`).join('\n');
    const secret = require('crypto').createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
    const calculated = require('crypto').createHmac('sha256', secret).update(sorted).digest('hex');
    return calculated === hash ? JSON.parse(params.get('user')) : null;
  } catch { return null; }
}

app.get('/api/user', async (req, res) => {
  const tgUser = validateInitData(req.query.initData || '');
  if (!tgUser) return res.status(401).json({ error: 'Invalid' });

  const id = tgUser.id.toString();
  const userData = await redis.hget('users', id);

  if (!userData) return res.json({ role: null });

  const isAdmin = (await redis.smembers('admins')).includes(id);

  res.json({
    role: isAdmin ? 'admin' : 'teacher',
    name: userData.name || tgUser.first_name,
    photo: tgUser.photo_url || '',
    tgId: id
  });
});

app.get('/api/schedules', async (req, res) => {
  const tgUser = validateInitData(req.query.initData || '');
  if (!tgUser) return res.status(401).json({ error: 'Invalid' });

  const id = tgUser.id.toString();
  const exists = await redis.hexists('users', id);
  if (!exists) return res.status(403).json({ error: 'No access' });

  const isAdmin = (await redis.smembers('admins')).includes(id);
  if (isAdmin) {
    const all = await redis.hgetall('schedules');
    res.json(all || {});
  } else {
    const sched = await redis.hget('schedules', id);
    res.json({ [id]: sched || {} });
  }
});

app.post('/api/schedule/:tgId', async (req, res) => {
  const tgUser = validateInitData(req.query.initData || '');
  if (!tgUser) return res.status(401).json({ error: 'Invalid' });

  const currentId = tgUser.id.toString();
  const targetId = req.params.tgId;
  const isAdmin = (await redis.smembers('admins')).includes(currentId);

  if (!isAdmin && currentId !== targetId) return res.status(403).json({ error: 'Forbidden' });

  await redis.hset('schedules', targetId, req.body);
  res.json({ success: true });
});

app.post('/api/approve_user', async (req, res) => {
  const { tgId, name, role } = req.body;
  await redis.hset('users', tgId, { name, role });
  if (role === 'admin') await redis.sadd('admins', tgId);
  await redis.hset('schedules', tgId, {});
  res.json({ success: true });
});

// Добавляем тебя как владельца при первом запуске
(async () => {
  const isAdmin = (await redis.smembers('admins')).includes(OWNER_ID);
  if (!isAdmin) {
    await redis.hset('users', OWNER_ID, { name: "Владимир", role: "admin" });
    await redis.sadd('admins', OWNER_ID);
    await redis.hset('schedules', OWNER_ID, {});
  }
})();

app.listen(process.env.PORT || 3000);
