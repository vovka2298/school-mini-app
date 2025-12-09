// lib/redis-schema.js

class RedisSchema {
  constructor(redisClient) {
    this.redis = redisClient;
  }

  // ========== ПОЛЬЗОВАТЕЛИ ==========
  
  async setUser(telegramId, userData) {
    const key = `user:${telegramId}`;
    
    // Подготавливаем данные
    const dataToSave = {
      ...userData,
      updatedAt: new Date().toISOString()
    };
    
    // Если это новая регистрация
    if (!userData.registeredAt) {
      dataToSave.registeredAt = new Date().toISOString();
    }
    
    await this.redis.hSet(key, dataToSave);
    
    // Добавляем в список ожидания если pending
    if (userData.status === 'pending') {
      await this.redis.zAdd('pending_approvals', {
        score: Date.now(),
        value: telegramId.toString()
      });
    }
    
    // Добавляем в соответствующий список если approved
    if (userData.status === 'approved') {
      if (userData.role === 'teacher') {
        await this.redis.sAdd('teachers:list', telegramId.toString());
      } else if (userData.role === 'manager') {
        await this.redis.sAdd('managers:list', telegramId.toString());
      }
      
      // Удаляем из pending если там был
      await this.redis.zRem('pending_approvals', telegramId.toString());
    }
    
    return dataToSave;
  }

  async getUser(telegramId) {
    const key = `user:${telegramId}`;
    const user = await this.redis.hGetAll(key);
    return Object.keys(user).length > 0 ? user : null;
  }

  async updateUserStatus(telegramId, status, approvedBy = null) {
    const updates = { status };
    
    if (status === 'approved') {
      updates.approvedAt = new Date().toISOString();
      if (approvedBy) updates.approvedBy = approvedBy;
    }
    
    const user = await this.getUser(telegramId);
    await this.setUser(telegramId, { ...user, ...updates });
    
    return { ...user, ...updates };
  }

  // ========== ЗАЯВКИ ==========
  
  async getPendingApprovals() {
    const telegramIds = await this.redis.zRange('pending_approvals', 0, -1);
    
    const pendingUsers = [];
    for (const id of telegramIds) {
      const user = await this.getUser(id);
      if (user) {
        pendingUsers.push({
          telegramId: id,
          ...user
        });
      }
    }
    
    return pendingUsers;
  }

  // ========== СПИСКИ ==========
  
  async getAllTeachers() {
    const teacherIds = await this.redis.sMembers('teachers:list');
    
    const teachers = [];
    for (const id of teacherIds) {
      const user = await this.getUser(id);
      if (user) {
        teachers.push({
          telegramId: id,
          ...user
        });
      }
    }
    
    return teachers;
  }

  async getAllManagers() {
    const managerIds = await this.redis.sMembers('managers:list');
    
    const managers = [];
    for (const id of managerIds) {
      const user = await this.getUser(id);
      if (user) {
        managers.push({
          telegramId: id,
          ...user
        });
      }
    }
    
    return managers;
  }

  // ========== УЧЕНИКИ ==========
  
  async addStudentToTeacher(teacherTelegramId, studentData) {
    const studentId = Date.now().toString();
    const studentKey = `student:${studentId}`;
    const teacherStudentsKey = `teacher:${teacherTelegramId}:students`;
    
    await this.redis.hSet(studentKey, {
      ...studentData,
      id: studentId,
      teacherId: teacherTelegramId,
      createdAt: new Date().toISOString()
    });
    
    await this.redis.sAdd(teacherStudentsKey, studentId);
    
    return { id: studentId, ...studentData };
  }

  async getTeacherStudents(teacherTelegramId) {
    const teacherStudentsKey = `teacher:${teacherTelegramId}:students`;
    const studentIds = await this.redis.sMembers(teacherStudentsKey);
    
    const students = [];
    for (const studentId of studentIds) {
      const student = await this.redis.hGetAll(`student:${studentId}`);
      if (student && Object.keys(student).length > 0) {
        students.push(student);
      }
    }
    
    return students;
  }

  // ========== СТАТИСТИКА ==========
  
  async getSystemStats() {
    const teachersCount = await this.redis.sCard('teachers:list');
    const managersCount = await this.redis.sCard('managers:list');
    const pendingCount = await this.redis.zCard('pending_approvals');
    
    return {
      teachersCount: teachersCount || 0,
      managersCount: managersCount || 0,
      pendingCount: pendingCount || 0,
      totalStudents: 0 // Пока считаем позже
    };
  }
}

export default RedisSchema;
