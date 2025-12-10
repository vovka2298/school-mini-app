// api/user.js - Рабочая версия для Vercel
module.exports = async (req, res) => {
  // ВРЕМЕННО: Прямые значения
  const SUPABASE_URL = 'https://rtywenfvaoxsjdku1mdk.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0eXd1bmZ2YW94c2pka3UxbWRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU2MDQ4MDAsImV4cCI6MjA1MTE4MDgwMH0.gQ99aMJ_sUnOMR4XQm54gOq3MSF6hjePjEn4nyI6mFg';
  
  // Разрешаем CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    const { tgId } = req.query;
    
    if (!tgId) {
      return res.status(400).json({ error: 'Требуется tgId' });
    }
    
    console.log('🔍 API: Запрос пользователя:', tgId);
    
    // Прямой запрос к Supabase
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/users?telegram_id=eq.${tgId}&select=*`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        }
      }
    );
    
    if (!response.ok) {
      return res.status(500).json({ 
        error: 'Ошибка Supabase',
        status: response.status 
      });
    }
    
    const users = await response.json();
    
    if (users.length === 0) {
      return res.status(200).json({
        telegram_id: tgId,
        role: 'guest',
        status: 'not_registered'
      });
    }
    
    const userData = users[0];
    return res.status(200).json(userData);
    
  } catch (error) {
    console.error('❌ Handler error:', error);
    return res.status(500).json({ error: 'Серверная ошибка' });
  }
};
