// api/schedule.js
export default async function handler(req, res) {
  const SUPABASE_URL = 'https://rtywenfvaoxsjdku1mdk.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0eXd1bmZ2YW94c2pka3UxbWRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU2MDQ4MDAsImV4cCI6MjA1MTE4MDgwMH0.gQ99aMJ_sUnOMR4XQm54gOq3MSF6hjePjEn4nyI6mFg';
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: 'Требуется userId' });
    }
    
    console.log('📅 Запрос расписания для:', userId);
    
    // Сначала находим teacher_id
    const userRes = await fetch(
      `${SUPABASE_URL}/rest/v1/users?telegram_id=eq.${userId}&select=id`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!userRes.ok) throw new Error('User not found');
    
    const users = await userRes.json();
    if (users.length === 0) {
      return res.status(200).json([]);
    }
    
    const teacherId = users[0].id;
    
    // Получаем расписание
    const scheduleRes = await fetch(
      `${SUPABASE_URL}/rest/v1/schedules?teacher_id=eq.${teacherId}&select=*&order=day_of_week.asc,time_slot.asc`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const schedule = await scheduleRes.json();
    console.log('✅ Расписание загружено:', schedule.length, 'записей');
    
    return res.status(200).json(schedule || []);
    
  } catch (error) {
    console.error('❌ Schedule API error:', error);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
}
