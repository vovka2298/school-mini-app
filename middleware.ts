import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Пути, которые разрешены без проверки Telegram
const publicPaths = [
  '/api/auth/check',
  '/api/health',
  '/telegram-only',
  '/_next',
  '/favicon.ico'
];

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  
  // Пропускаем публичные пути
  if (publicPaths.some(publicPath => path.startsWith(publicPath))) {
    return NextResponse.next();
  }
  
  // Пропускаем статические файлы
  if (path.startsWith('/_next/') || path.includes('.')) {
    return NextResponse.next();
  }
  
  // Проверяем User-Agent для Telegram
  const userAgent = request.headers.get('user-agent') || '';
  const isTelegram = userAgent.includes('Telegram') || 
                     userAgent.includes('TelegramBot') ||
                     request.nextUrl.searchParams.has('tgWebAppStartParam');
  
  // Проверяем наличие заголовка Telegram Web App
  const telegramData = request.headers.get('X-Telegram-Web-App-Data');
  
  // Если не Telegram и не API роут - показываем сообщение
  if (!isTelegram && !telegramData && !path.startsWith('/api/')) {
    return NextResponse.rewrite(new URL('/telegram-only', request.url));
  }
  
  return NextResponse.next();
}

// Конфигурация middleware
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};
