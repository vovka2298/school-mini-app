// lib/redis.js
import { createClient } from 'redis';

let redisClient = null;
let isConnected = false;

export async function getRedisClient() {
  if (redisClient && isConnected) {
    return redisClient;
  }
  
  redisClient = createClient({
    url: process.env.REDIS_URL,
  });
  
  redisClient.on('error', (err) => {
    console.error('❌ Redis Client Error:', err);
    isConnected = false;
  });
  
  try {
    await redisClient.connect();
    isConnected = true;
    console.log('✅ Redis подключен успешно!');
  } catch (error) {
    console.error('❌ Не удалось подключиться к Redis:', error);
    throw error;
  }
  
  return redisClient;
}
