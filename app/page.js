'use client';

import { useEffect } from 'react';
import AuthChecker from './components/AuthChecker';
import TeacherDashboard from './components/TeacherDashboard';
import ManagerDashboard from './components/ManagerDashboard';

// Стили для анимации спиннера
const styles = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

export default function Home() {
  useEffect(() => {
    if (window.Telegram && window.Telegram.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();
    }
    
    const styleSheet = document.createElement("style");
    styleSheet.innerText = styles;
    document.head.appendChild(styleSheet);
  }, []);

  return (
    <AuthChecker>
      {(userData) => {
        if (userData.role === 'teacher') {
          return <TeacherDashboard userData={userData} />;
        } else if (userData.role === 'manager') {
          return <ManagerDashboard userData={userData} />;
        } else {
          return (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '100vh',
              flexDirection: 'column'
            }}>
              <h2>Роль не определена</h2>
              <p>Обратитесь к администратору</p>
            </div>
          );
        }
      }}
    </AuthChecker>
  );
}
