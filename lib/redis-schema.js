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
    
    // Сохраняем в Redis
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
    try {
      const key = `user:${telegramId}`;
      const user = await this.redis.hGetAll(key);
      
      // Если объект пустой или нет ключа status
      if (!user || Object.keys(user).length === 0 || !user.status) {
        return null;
      }
      
      return user;
    } catch (error) {
      console.error('Error getting user:', error);
      return null;
    }
  }

  async updateUserStatus(telegramId, status, approvedBy = null) {
    const user = await this.getUser(telegramId);
    
    if (!user) {
      throw new Error('User not found');
    }
    
    const updates = {
      ...user,
      status: status,
      updatedAt: new Date().toISOString()
    };
    
    if (status === 'approved') {
      updates.approvedAt = new Date().toISOString();
      if (approvedBy) updates.approvedBy = approvedBy;
    }
    
    return await this.setUser(telegramId, updates);
  }

  // ========== ЗАЯВКИ ==========
  
  async getPendingApprovals() {
    try {
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
    } catch (error) {
      console.error('Error getting pending approvals:', error);
      return [];
    }
  }

  // ========== СПИСКИ ==========
  
  async getAllTeachers() {
    try {
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
    } catch (error) {
      console.error('Error getting teachers:', error);
      return [];
    }
  }

  async getAllManagers() {
    try {
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
    } catch (error) {
      console.error('Error getting managers:', error);
      return [];
    }
  }

  // ========== УЧЕНИКИ ==========
  
  async addStudentToTeacher(teacherTelegramId, studentData) {
    try {
      const studentId = Date.now().toString();
      const studentKey = `student:${studentId}`;
      const teacherStudentsKey = `teacher:${teacherTelegramId}:students`;
      
      const student = {
        ...studentData,
        id: studentId,
        teacherId: teacherTelegramId,
        createdAt: new Date().toISOString()
      };
      
      // Сохраняем ученика
      await this.redis.hSet(studentKey, student);
      
      // Добавляем в список учителя
      await this.redis.sAdd(teacherStudentsKey, studentId);
      
      return student;
    } catch (error) {
      console.error('Error adding student:', error);
      throw error;
    }
  }

  async getTeacherStudents(teacherTelegramId) {
    try {
      const teacherStudentsKey = `teacher:${teacherTelegramId}:students`;
      const studentIds = await this.redis.sMembers(teacherStudentsKey);
      
      const students = [];
      for (const studentId of studentIds) {
        const student = await this.redis.hGetAll(`student:${studentId}`);
        if (student && student.id) {
          students.push(student);
        }
      }
      
      return students;
    } catch (error) {
      console.error('Error getting students:', error);
      return [];
    }
  }

  // ========== СТАТИСТИКА ==========
  
  async getSystemStats() {
    try {
      const teachersCount = await this.redis.sCard('teachers:list').catch(() => 0);
      const managersCount = await this.redis.sCard('managers:list').catch(() => 0);
      const pendingCount = await this.redis.zCard('pending_approvals').catch(() => 0);
      
      // Считаем учеников
      let totalStudents = 0;
      const teacherIds = await this.redis.sMembers('teachers:list').catch(() => []);
      
      for (const id of teacherIds) {
        const count = await this.redis.sCard(`teacher:${id}:students`).catch(() => 0);
        totalStudents += count;
      }
      
      return {
        teachersCount,
        managersCount,
        pendingCount,
        totalStudents
      };
    } catch (error) {
      console.error('Error getting stats:', error);
      return {
        teachersCount: 0,
        managersCount: 0,
        pendingCount: 0,
        totalStudents: 0
      };
    }
  }
}

export default RedisSchema;
