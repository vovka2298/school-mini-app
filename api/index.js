// api/index.js — ЭТО РАБОТАЕТ НА VERCEL В 2025 ГОДУ

import { Redis } from '@upstash/redis';
import express from 'express';

const app = express();
app.use(express.json());

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
});

const KEY = "school_data_v100";

// Всегда свежие данные из Redis
async function getData() {
  const data = await redis.get(KEY);
  if (data) return data;
  return {
    schedules: { "913096324": {} },
    profiles: { "913096324": { subjects: [], gender: "Мужской" } }
  };
}

async function saveData(data) {
  await redis.set(KEY, data);
}

// API
app.get('/api/user', async (req, res) => {
  res.json({ role: "admin", name: "Владимир", tgId: "913096324" });
});

app.get('/api/schedules', async (req, res) => {
  const data = await getData();
  res.json(data.schedules["913096324"] || {});
});

app.post('/api/schedule/:tgId', async (req, res) => {
  const data = await getData();
  data.schedules["913096324"] = { ...(data.schedules["913096324"] || {}), ...req.body };
  await saveData(data);
  res.json({ ok: true });
});

app.get('/api/profile/:tgId', async (req, res) => {
  const data = await getData();
  res.json(data.profiles["913096324"] || { subjects: [], gender: "Мужской" });
});

app.post('/api/profile/:tgId', async (req, res) => {
  const data = await getData();
  data.profiles["913096324"] = req.body;
  await saveData(data);
  res.json({ ok: true });
});

export default app;
