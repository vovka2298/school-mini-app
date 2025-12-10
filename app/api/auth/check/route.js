import { getUser } from '../../../lib/redis';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const telegramId = searchParams.get('telegramId');
    
    if (!telegramId) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Telegram ID is required',
          message: 'Не указан ID пользователя'
        },
        { status: 400 }
      );
    }
    
    const user = await getUser(telegramId);
    
    if (!user) {
      return NextResponse.json({
        success: true,
        status: 'not_found',
        message: 'Пользователь не найден. Зарегистрируйтесь через бота.',
        data: null
      });
    }
    
    const response = {
      success: true,
      status: user.status || 'unknown',
      role: user.role,
      fullName: user.fullName,
      registeredAt: user.registeredAt,
      approvedAt: user.approvedAt,
      data: user
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Auth check error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error',
        message: 'Ошибка сервера',
        details: error.message 
      },
      { status: 500 }
    );
  }
}
