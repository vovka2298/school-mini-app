// app/api/redis-test/route.js
import { getRedisClient } from '@/lib/redis';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const redis = await getRedisClient();
    const data = await redis.get('test');
    
    if (!data) {
      return NextResponse.json({
        success: true,
        message: 'Redis работает! Данных пока нет.',
        data: null
      });
    }
    
    return NextResponse.json({
      success: true,
      message: 'Данные успешно получены из Redis! 🎉',
      data: JSON.parse(data)
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: 'Ошибка при работе с Redis',
      error: error.message
    }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    
    if (!body || !body.value) {
      return NextResponse.json({
        success: false,
        message: 'Пожалуйста, укажите данные в поле "value"'
      }, { status: 400 });
    }
    
    const redis = await getRedisClient();
    
    const dataToSave = {
      value: body.value,
      savedAt: new Date().toISOString(),
      savedFrom: 'Next.js API'
    };
    
    await redis.set('test', JSON.stringify(dataToSave));
    
    return NextResponse.json({
      success: true,
      message: 'Данные успешно сохранены в Redis! ✅',
      savedData: dataToSave
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: 'Ошибка при сохранении в Redis',
      error: error.message
    }, { status: 500 });
  }
}
