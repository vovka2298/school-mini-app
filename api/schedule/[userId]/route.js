// /api/schedule/[userId]/route.js
import { createClient } from '@supabase/supabase-js';

export const config = {
  runtime: 'edge',
};

export default async function handler(request, context) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ error: 'Supabase не настроен' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { userId } = context.params;
    const method = request.method;
    
    console.log(`📅 ${method} запрос расписания для:`, userId);
    
    // GET - получение расписания
    if (method === 'GET') {
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('telegram_id', userId)
        .single();
      
      if (!user) {
        return new Response(
          JSON.stringify([]),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      
      const { data: schedule } = await supabase
        .from('schedules')
        .select('*')
        .eq('teacher_id', user.id)
        .order('day_of_week', { ascending: true })
        .order('time_slot', { ascending: true });
      
      return new Response(JSON.stringify(schedule || []), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // POST - обновление расписания
    if (method === 'POST') {
      const body = await request.json();
      const { day, time, status } = body;
      
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('telegram_id', userId)
        .single();
      
      if (!user) {
        return new Response(
          JSON.stringify({ error: 'Пользователь не найден' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }
      
      const { error } = await supabase
        .from('schedules')
        .update({ 
          status: status,
          updated_at: new Date().toISOString()
        })
        .eq('teacher_id', user.id)
        .eq('day_of_week', day)
        .eq('time_slot', time);
      
      if (error) throw error;
      
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(
      JSON.stringify({ error: 'Метод не поддерживается' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Schedule API error:', error);
    return new Response(
      JSON.stringify({ error: 'Ошибка сервера' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
