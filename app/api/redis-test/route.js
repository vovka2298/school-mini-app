import { getData, saveData } from '../redis-client.js';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const data = await getData('test');
    
    return NextResponse.json({
      success: true,
      data: data || 'Нет данных'
    });
    
  } catch (error) {
    console.error('Redis test error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    await saveData('test', JSON.stringify(body));
    
    return NextResponse.json({
      success: true,
      message: 'Данные сохранены'
    });
    
  } catch (error) {
    console.error('Redis save error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
