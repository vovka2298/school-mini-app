/** @type {import('next').NextConfig} */
const nextConfig = {
  // Отключаем строгий режим если есть проблемы
  reactStrictMode: false,
  
  // Добавляем поддержку внешних изображений
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  
  // Настройки для Vercel
  output: 'standalone',
  
  // Компилятор для уменьшения размера
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  
  // Переменные окружения для клиента
  env: {
    NEXT_PUBLIC_BOT_USERNAME: process.env.NEXT_PUBLIC_BOT_USERNAME || 'YourBotName',
  },
  
  // Настройки для Middleware
  experimental: {
    middleware: true,
  },
};

export default nextConfig;
