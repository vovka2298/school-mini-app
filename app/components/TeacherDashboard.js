// app/components/TeacherDashboard.js
'use client';

export default function TeacherDashboard({ userData }) {
  return (
    <div style={{
      maxWidth: '800px',
      margin: '0 auto',
      padding: '20px',
      fontFamily: 'Arial, sans-serif'
    }}>
      <header style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h1 style={{ color: '#333' }}>👨‍🏫 Панель преподавателя</h1>
        <p style={{ color: '#666' }}>Добро пожаловать, {userData?.fullName || 'Преподаватель'}!</p>
      </header>
      
      <div style={{
        backgroundColor: '#f8f9fa',
        padding: '30px',
        borderRadius: '10px',
        textAlign: 'center'
      }}>
        <h2>🛠 Интерфейс в разработке</h2>
        <p>Основной интерфейс преподавателя скоро будет доступен.</p>
        <p>А пока проверьте работу системы:</p>
        
        <div style={{ marginTop: '20px' }}>
          <button 
            onClick={() => window.location.href = '/redis-demo'}
            style={{
              padding: '10px 20px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              marginRight: '10px'
            }}
          >
            📊 Демо Redis
          </button>
          
          <button 
            onClick={() => window.location.href = '/redis-test'}
            style={{
              padding: '10px 20px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            🧪 Тест API
          </button>
        </div>
      </div>
      
      <div style={{ marginTop: '30px', padding: '20px', backgroundColor: '#fff3cd', borderRadius: '10px' }}>
        <h3>📋 Информация о вашем аккаунте:</h3>
        <pre style={{ 
          backgroundColor: '#f8f9fa', 
          padding: '15px', 
          borderRadius: '5px',
          overflow: 'auto'
        }}>
          {JSON.stringify(userData, null, 2)}
        </pre>
      </div>
    </div>
  );
}
