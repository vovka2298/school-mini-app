// lib/redis.js
import { createClient } from 'redis';
import RedisSchema from './redis-schema';

let redisClient = null;
let redisSchema = null;

// Основной клиент
export async function getRedisClient() {
  if (!redisClient) {
    redisClient = createClient({
      url: process.env.REDIS_URL,
    });
    
    redisClient.on('error', (err) => {
      console.error('❌ Redis Client Error:', err);
    });
    
    await redisClient.connect();
    console.log('✅ Redis подключен');
  }
  
  return redisClient;
}

// Схема данных
export async function getRedisSchema() {
  if (!redisSchema) {
    const client = await getRedisClient();
    redisSchema = new RedisSchema(client);
  }
  return redisSchema;
}

// ========== ЭКСПОРТИРУЕМЫЕ МЕТОДЫ ==========

export async function getUser(telegramId) {
  const schema = await getRedisSchema();
  return await schema.getUser(telegramId);
}

export async function setUser(telegramId, userData) {
  const schema = await getRedisSchema();
  return await schema.setUser(telegramId, userData);
}

export async function updateUserStatus(telegramId, status, approvedBy = null) {
  const schema = await getRedisSchema();
  return await schema.updateUserStatus(telegramId, status, approvedBy);
}

export async function getPendingApprovals() {
  const schema = await getRedisSchema();
  return await schema.getPendingApprovals();
}

export async function getAllTeachers() {
  const schema = await getRedisSchema();
  return await schema.getAllTeachers();
}

export async function getAllManagers() {
  const schema = await getRedisSchema();
  return await schema.getAllManagers();
}

export async function addStudentToTeacher(teacherTelegramId, studentData) {
  const schema = await getRedisSchema();
  return await schema.addStudentToTeacher(teacherTelegramId, studentData);
}

export async function getTeacherStudents(teacherTelegramId) {
  const schema = await getRedisSchema();
  return await schema.getTeacherStudents(teacherTelegramId);
}

export async function getSystemStats() {
  const schema = await getRedisSchema();
  return await schema.getSystemStats();
}

// Для обратной совместимости с существующим кодом
export async function saveData(key, value) {
  const client = await getRedisClient();
  return await client.set(key, value);
}

export async function getData(key) {
  const client = await getRedisClient();
  return await client.get(key);
}
