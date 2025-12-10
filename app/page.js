'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();
  const [isTelegram, setIsTelegram] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkTelegram = () => {
      // Проверка через window.Telegram.WebApp
      if (typeof window !== 'undefined' && window.Telegram && window.Telegram.WebApp) {
        console.log('Telegram Web App detected');
        setIsTelegram(true);
        try {
          window.Telegram.WebApp.ready();
          window.Telegram.WebApp.expand();
        } catch (error) {
          console.error('Error initializing Telegram WebApp:', error);
        }
        setIsLoading(false);
        return;
      }
      
      // Проверка через User-Agent
      const userAgent = navigator.userAgent || '';
      if (userAgent.includes('Telegram')) {
        console.log('Telegram detected by User-Agent');
        setIsTelegram(true);
        setIsLoading(false);
        return;
      }
      
      // В режиме разработки пропускаем проверку
      if (process.env.NODE_ENV === 'development') {
        console.log('Development mode - bypassing Telegram check');
        setIsTelegram(true);
        setIsLoading(false);
        return;
      }
      
      // Если не Telegram и не разработка - проверяем через API
      checkAuth();
    };

    const checkAuth = async () => {
      try {
        console.log('Checking auth via API...');
        const response = await fetch('/api/auth/check');
        const data = await response.json();
        
        console.log('Auth check response:', data);
        
        if (data.authenticated) {
          setIsTelegram(true);
        } else {
          console.log('Not authenticated, redirecting to telegram-only page');
          router.push('/telegram-only');
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        // В случае ошибки показываем пользователю
        router.push('/telegram-only');
      } finally {
        setIsLoading(false);
      }
    };

    checkTelegram();
  }, [router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Проверка доступа...</p>
          <p className="text-sm text-gray-500 mt-2">Пожалуйста, подождите</p>
        </div>
      </div>
    );
  }

  if (!isTelegram) {
    // Перенаправление уже обработано в useEffect
    return null;
  }

  // Ваш основной контент приложения
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Ваша навигация или заголовок */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-800">Добро пожаловать!</h1>
          <p className="text-gray-600">Telegram мини-приложение работает</p>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Ваше основное содержимое */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Ваш контент здесь</h2>
          <p className="text-gray-700">
            Приложение успешно загружено и работает в Telegram.
          </p>
          
          {/* Кнопка для теста Telegram WebApp */}
          <button
            onClick={() => {
              if (window.Telegram?.WebApp) {
                window.Telegram.WebApp.showAlert('Тест: Telegram WebApp работает!');
              }
            }}
            className="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Проверить Telegram WebApp
          </button>
        </div>
      </main>
    </div>
  );
}
