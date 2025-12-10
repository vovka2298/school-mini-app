import { NextResponse } from 'next/server';

// Важно: force-dynamic отключает статическую генерацию
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const initData = searchParams.get('initData');
    
    if (!initData) {
      return NextResponse.json(
        { authenticated: false, error: 'No initData provided' },
        { status: 400 }
      );
    }

    // Здесь должна быть ваша логика проверки Telegram данных
    // Пока возвращаем true для теста
    const isValid = true;
    
    return NextResponse.json({
      authenticated: isValid,
      timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('Auth check error:', error);
    return NextResponse.json(
      { 
        authenticated: false, 
        error: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}
