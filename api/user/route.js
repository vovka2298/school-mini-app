// /api/user/route.js
import { createClient } from '@supabase/supabase-js';

export const config = {
  runtime: 'edge', // Важно для Vercel Edge Functions
};

export default async function handler(request) {
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
    const url = new URL(request.url);
    const tgId = url.searchParams.get('tgId');
    
    console.log('🔍 Запрос пользователя:', tgId);
    
    if (!tgId) {
      return new Response(
        JSON.stringify({ error: 'Требуется tgId' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', tgId)
      .single();
    
    if (error) {
      console.error('Supabase error:', error);
      
      // Если пользователь не найден
      if (error.code === 'PGRST116') {
        return new Response(
          JSON.stringify({ 
            telegram_id: tgId, 
            role: 'guest',
            status: 'not_registered'
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Ошибка базы' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('✅ Найден:', user.id);
    return new Response(JSON.stringify(user), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Handler error:', error);
    return new Response(
      JSON.stringify({ error: 'Серверная ошибка' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
