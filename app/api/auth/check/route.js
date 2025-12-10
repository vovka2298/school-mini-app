import { NextRequest, NextResponse } from 'next/server';
import { verifyTelegramWebAppData } from '@/lib/telegram-auth';

// Важно: force-dynamic отключает статическую генерацию
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const initData = searchParams.get('initData');
    
    if (!initData) {
      return NextResponse.json(
        { authenticated: false, error: 'No initData provided' },
        { status: 400 }
      );
    }

    // Проверяем Telegram Web App данные
    const isValid = await verifyTelegramWebAppData(initData);
    
    return NextResponse.json({
      authenticated: isValid,
      timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('Auth check error:', error);
    return NextResponse.json(
      { 
        authenticated: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
