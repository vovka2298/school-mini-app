'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AuthChecker({ children }) {
  const [authStatus, setAuthStatus] = useState('checking');
  const [userData, setUserData] = useState(null);
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      // Получаем данные из Telegram Web App
      if (window.Telegram && window.Telegram.WebApp) {
        const tg = window.Telegram.WebApp;
        const telegramUser = tg.initDataUnsafe?.user;
        
        if (telegramUser && telegramUser.id) {
          // Проверяем статус пользователя
          const response = await fetch(`/api/auth/check?telegramId=${telegramUser.id}`);
          const data = await response.json();
          
          if (data.success) {
            if (data.status === 'approved') {
              setAuthStatus('approved');
              setUserData(data.data);
            } else if (data.status === 'pending') {
              setAuthStatus('pending');
            } else if (data.status === 'not_found') {
              setAuthStatus('not_found');
            } else {
              setAuthStatus('unknown');
            }
          } else {
            setAuthStatus('error');
          }
        } else {
          setAuthStatus('no_telegram');
        }
      } else {
        // Если открыто не в Telegram
        setAuthStatus('not_in_telegram');
      }
    } catch (error) {
      console.error('Auth check error:', error);
      setAuthStatus('error');
    }
  };

  // Состояния загрузки
  if (authStatus === 'checking') {
    return (
      <div style={styles.container}>
        <div style={styles.loader}>
          <div style={styles.spinner}></div>
          <p>Проверка доступа...</p>
        </div>
      </div>
    );
  }

  // Пользователь не в Telegram
  if (authStatus === 'not_in_telegram') {
    return (
      <div style={styles.container}>
        <div style={styles.message}>
          <h2>📱 Откройте в Telegram</h2>
          <p>Это приложение работает только внутри Telegram.</p>
          <p>Откройте его через бота @YourBotName</p>
        </div>
      </div>
    );
  }

  // Пользователь не найден (не регистрировался)
  if (authStatus === 'not_found') {
    return (
      <div style={styles.container}>
        <div style={styles.message}>
          <h2>👋 Приветствуем!</h2>
          <p>Вы ещё не зарегистрированы в системе.</p>
          <p>Пожалуйста:</p>
          <ol style={{ textAlign: 'left', margin: '20px auto', maxWidth: '300px' }}>
            <li>Напишите боту @YourBotName</li>
            <li>Отправьте команду /start</li>
            <li>Выберите роль и введите ФИО</li>
            <li>Дождитесь одобрения администратором</li>
          </ol>
          <button 
            onClick={() => window.open('https://t.me/YourBotName', '_blank')}
            style={styles.button}
          >
            📲 Перейти к боту
          </button>
        </div>
      </div>
    );
  }

  // Заявка на рассмотрении
  if (authStatus === 'pending') {
    return (
      <div style={styles.container}>
        <div style={styles.message}>
          <h2>⏳ Заявка на рассмотрении</h2>
          <p>Ваша заявка отправлена администратору.</p>
          <p>Ожидайте одобрения в Telegram.</p>
          <p>Как только вас одобрят, здесь появится рабочий интерфейс.</p>
        </div>
      </div>
    );
  }

  // Ошибка
  if (authStatus === 'error') {
    return (
      <div style={styles.container}>
        <div style={styles.message}>
          <h2>❌ Ошибка</h2>
          <p>Произошла ошибка при проверке доступа.</p>
          <p>Попробуйте перезагрузить страницу.</p>
          <button 
            onClick={() => window.location.reload()}
            style={styles.button}
          >
            🔄 Обновить
          </button>
        </div>
      </div>
    );
  }

  // Доступ одобрен - показываем интерфейс
  if (authStatus === 'approved') {
    return children(userData);
  }

  // На всякий случай
  return (
    <div style={styles.container}>
      <div style={styles.message}>
        <h2>⚠️ Неизвестный статус</h2>
        <button 
          onClick={() => window.location.reload()}
          style={styles.button}
        >
          🔄 Обновить
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
    padding: '20px'
  },
  loader: {
    textAlign: 'center'
  },
  spinner: {
    width: '50px',
    height: '50px',
    border: '5px solid #f3f3f3',
    borderTop: '5px solid #3498db',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    margin: '0 auto 20px'
  },
  message: {
    backgroundColor: 'white',
    padding: '40px',
    borderRadius: '10px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
    textAlign: 'center',
    maxWidth: '500px'
  },
  button: {
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    padding: '12px 24px',
    borderRadius: '5px',
    fontSize: '16px',
    cursor: 'pointer',
    marginTop: '20px'
  }
};
