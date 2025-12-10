'use client';

export default function ManagerDashboard({ userData }) {
  return (
    <div style={{
      maxWidth: '800px',
      margin: '0 auto',
      padding: '40px 20px',
      fontFamily: 'Arial, sans-serif',
      textAlign: 'center'
    }}>
      <h1 style={{ color: '#333', marginBottom: '20px' }}>👨‍💼 Панель менеджера</h1>
      
      <div style={{
        backgroundColor: '#f8f9fa',
        padding: '30px',
        borderRadius: '10px',
        marginBottom: '30px',
        display: 'inline-block'
      }}>
        <p style={{ fontSize: '18px', marginBottom: '15px' }}>
          Добро пожаловать, <strong>{userData?.fullName || 'Менеджер'}</strong>!
        </p>
        
        <div style={{ 
          backgroundColor: 'white', 
          padding: '20px', 
          borderRadius: '8px',
          margin: '20px 0',
          textAlign: 'left'
        }}>
          <p><strong>Telegram ID:</strong> {userData?.telegramId}</p>
          <p><strong>Роль:</strong> Менеджер</p>
          <p><strong>Статус:</strong> Одобрен ✅</p>
        </div>
        
        <p style={{ color: '#666', marginBottom: '25px' }}>
          Интерфейс для управления преподавателями и учениками скоро будет доступен.
        </p>
        
        <button 
          onClick={() => window.location.href = '/api/admin/teachers'}
          style={{
            padding: '12px 24px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          👥 Список преподавателей
        </button>
      </div>
    </div>
  );
}
