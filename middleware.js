import { NextResponse } from 'next/server';

// Пути, которые разрешены без проверки Telegram
const publicPaths = [
  '/api/auth/check',
  '/api/health',
  '/telegram-only',
  '/_next',
  '/favicon.ico'
];

export function middleware(request) {
  const path = request.nextUrl.pathname;
  
  // Пропускаем публичные пути
  if (publicPaths.some(publicPath => path.startsWith(publicPath))) {
    return NextResponse.next();
  }
  
  // Пропускаем статические файлы
  if (path.startsWith('/_next/') || path.includes('.')) {
    return NextResponse.next();
  }
  
  // В режиме разработки пропускаем все
  if (process.env.NODE_ENV === 'development') {
    return NextResponse.next();
  }
  
  // Проверяем User-Agent для Telegram
  const userAgent = request.headers.get('user-agent') || '';
  const isTelegram = userAgent.includes('Telegram') || 
                     userAgent.includes('TelegramBot');
  
  // Если не Telegram - показываем сообщение
  if (!isTelegram && !path.startsWith('/api/')) {
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
