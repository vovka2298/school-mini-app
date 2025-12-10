import Image from 'next/image';
import Link from 'next/link';

export default function TelegramOnlyPage() {
  const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME || 'YourBotName';
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 text-center">
        {/* Telegram Logo */}
        <div className="mb-6">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-500 rounded-full mb-4">
            <svg 
              className="w-12 h-12 text-white" 
              fill="currentColor" 
              viewBox="0 0 24 24"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.41 1-.68 1-.58.05-1.02-.38-1.58-.75-.88-.57-1.38-.93-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.06-.2-.07-.06-.17-.04-.24-.02-.1.02-1.79 1.15-5.06 3.38-.48.33-.91.49-1.31.48-.43-.01-1.27-.24-1.89-.44-.76-.24-1.37-.37-1.32-.78.03-.2.2-.4.52-.56 2.05-1.05 4.37-2.24 6.14-3.14 2.92-1.48 3.53-1.74 3.93-1.74.09 0 .3.02.43.13.11.09.14.21.16.31.02.1.04.31.02.5z"/>
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Откройте в Telegram
          </h1>
        </div>
        
        {/* Message */}
        <div className="mb-8">
          <p className="text-gray-600 mb-4 text-lg">
            Это приложение работает только внутри Telegram.
          </p>
          <p className="text-gray-600 mb-6">
            Чтобы использовать все функции, откройте приложение через бота.
          </p>
          
          {/* Bot Link */}
          <div className="bg-blue-50 rounded-xl p-4 mb-6">
            <p className="text-gray-700 mb-2 font-medium">Бот:</p>
            <p className="text-blue-600 font-bold text-xl">
              @{botUsername}
            </p>
          </div>
          
          {/* Instructions */}
          <div className="text-left bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-gray-700 mb-2">Как открыть:</h3>
            <ol className="list-decimal pl-5 space-y-2 text-gray-600">
              <li>Откройте Telegram</li>
              <li>Найдите бота @{botUsername}</li>
              <li>Нажмите "Start" или кнопку меню</li>
              <li>Выберите нужный раздел в меню бота</li>
            </ol>
          </div>
        </div>
        
        {/* Buttons */}
        <div className="space-y-3">
          <a
            href={`https://t.me/${botUsername}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg transition duration-300 transform hover:scale-[1.02] active:scale-[0.98]"
          >
            📱 Открыть в Telegram
          </a>
          
          <Link
            href="/"
            className="block w-full border-2 border-gray-300 hover:border-gray-400 text-gray-700 font-semibold py-3 px-4 rounded-lg transition duration-300"
          >
            ⟳ Обновить страницу
          </Link>
        </div>
        
        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            Если вы уже в Telegram, попробуйте обновить страницу
          </p>
        </div>
      </div>
      
      {/* Debug info (только в development) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-6 text-sm text-gray-500">
          Режим разработки: проверка User-Agent отключена
        </div>
      )}
    </div>
  );
}

// Отключаем предварительный рендеринг для этой страницы
export const dynamic = 'force-dynamic';
