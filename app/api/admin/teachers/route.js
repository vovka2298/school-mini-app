import { getAllTeachers, getTeacherStudents } from '@/lib/redis';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const teachers = await getAllTeachers();
    
    // Для каждого учителя получаем количество учеников
    const teachersWithStats = await Promise.all(
      teachers.map(async (teacher) => {
        const students = await getTeacherStudents(teacher.telegramId);
        return {
          ...teacher,
          studentCount: students.length
        };
      })
    );
    
    return NextResponse.json({
      success: true,
      count: teachersWithStats.length,
      teachers: teachersWithStats
    });
    
  } catch (error) {
    console.error('Get teachers error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
