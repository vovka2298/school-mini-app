'use client';

import { useState, useEffect } from 'react';

export default function ManagerDashboard({ userData }) {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState(null);

  // Загружаем данные при монтировании
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Загружаем список учителей
      const teachersRes = await fetch('/api/admin/teachers');
      const teachersData = await teachersRes.json();
      
      if (teachersData.success) {
        setTeachers(teachersData.teachers);
      }

      // Загружаем статистику
      const statsRes = await fetch('/api/admin/stats');
      const statsData = await statsRes.json();
      
      if (statsData.success) {
        setStats(statsData.stats);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddStudent = (teacherId) => {
    setSelectedTeacher(teacherId);
    setShowAddStudent(true);
  };

  const handleViewSchedule = (teacherId) => {
    // Пока просто показываем ID
    alert(`Просмотр расписания учителя ${teacherId}`);
    // TODO: Реализовать просмотр расписания
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loader}>Загрузка...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Шапка */}
      <header style={styles.header}>
        <h1 style={styles.title}>👨‍💼 Панель менеджера</h1>
        <p style={styles.subtitle}>Добро пожаловать, {userData.fullName}</p>
      </header>

      {/* Статистика */}
      {stats && (
        <div style={styles.stats}>
          <h2>📊 Статистика системы</h2>
          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <div style={styles.statNumber}>{stats.teachersCount}</div>
              <div style={styles.statLabel}>Учителей</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statNumber}>{stats.totalStudents || 0}</div>
              <div style={styles.statLabel}>Учеников</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statNumber}>{stats.pendingCount}</div>
              <div style={styles.statLabel}>Ожидают</div>
            </div>
          </div>
        </div>
      )}

      {/* Список учителей */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <h2>👥 Преподаватели ({teachers.length})</h2>
          <button style={styles.refreshButton} onClick={loadData}>
            🔄 Обновить
          </button>
        </div>
        
        {teachers.length === 0 ? (
          <p style={styles.emptyMessage}>Нет зарегистрированных учителей</p>
        ) : (
          <div style={styles.teachersList}>
            {teachers.map((teacher) => (
              <div key={teacher.telegramId} style={styles.teacherCard}>
                <div style={styles.teacherInfo}>
                  <h3 style={styles.teacherName}>{teacher.fullName}</h3>
                  <p style={styles.teacherMeta}>
                    Учеников: {teacher.studentCount || 0} | 
                    Зарегистрирован: {new Date(teacher.registeredAt).toLocaleDateString()}
                  </p>
                </div>
                <div style={styles.teacherActions}>
                  <button 
                    style={styles.actionButton}
                    onClick={() => handleViewSchedule(teacher.telegramId)}
                  >
                    📅 Расписание
                  </button>
                  <button 
                    style={{...styles.actionButton, backgroundColor: '#28a745'}}
                    onClick={() => handleAddStudent(teacher.telegramId)}
                  >
                    ➕ Ученика
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Модалка добавления ученика */}
      {showAddStudent && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h3>Добавить ученика</h3>
            <p>Учитель: {selectedTeacher}</p>
            <form style={styles.form}>
              <input
                type="text"
                placeholder="Имя ученика"
                style={styles.input}
                required
              />
              <input
                type="text"
                placeholder="Класс"
                style={styles.input}
                required
              />
              <div style={styles.modalActions}>
                <button
                  type="button"
                  style={{...styles.button, backgroundColor: '#6c757d'}}
                  onClick={() => setShowAddStudent(false)}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  style={{...styles.button, backgroundColor: '#28a745'}}
                >
                  Добавить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '1000px',
    margin: '0 auto',
    padding: '20px',
    fontFamily: 'Arial, sans-serif'
  },
  header: {
    marginBottom: '30px',
    textAlign: 'center'
  },
  title: {
    fontSize: '2rem',
    color: '#333',
    marginBottom: '10px'
  },
  subtitle: {
    color: '#666',
    fontSize: '1.1rem'
  },
  stats: {
    backgroundColor: '#f8f9fa',
    padding: '20px',
    borderRadius: '10px',
    marginBottom: '30px'
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '20px',
    marginTop: '15px'
  },
  statCard: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '8px',
    textAlign: 'center',
    boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
  },
  statNumber: {
    fontSize: '2rem',
    fontWeight: 'bold',
    color: '#007bff'
  },
  statLabel: {
    color: '#666',
    marginTop: '5px'
  },
  section: {
    marginBottom: '40px'
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px'
  },
  refreshButton: {
    padding: '8px 16px',
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer'
  },
  emptyMessage: {
    textAlign: 'center',
    color: '#666',
    padding: '40px'
  },
  teachersList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px'
  },
  teacherCard: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '8px',
    boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  teacherInfo: {
    flex: 1
  },
  teacherName: {
    margin: '0 0 5px 0',
    color: '#333'
  },
  teacherMeta: {
    margin: '0',
    color: '#666',
    fontSize: '0.9rem'
  },
  teacherActions: {
    display: 'flex',
    gap: '10px'
  },
  actionButton: {
    padding: '8px 16px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer'
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000
  },
  modal: {
    backgroundColor: 'white',
    padding: '30px',
    borderRadius: '10px',
    maxWidth: '500px',
    width: '90%'
  },
  form: {
    marginTop: '20px'
  },
  input: {
    width: '100%',
    padding: '10px',
    marginBottom: '15px',
    border: '1px solid #ddd',
    borderRadius: '5px',
    fontSize: '16px'
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px'
  },
  button: {
    padding: '10px 20px',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '16px'
  },
  loader: {
    textAlign: 'center',
    padding: '50px',
    fontSize: '18px'
  }
};
