// app/redis-demo/page.js
'use client';

import { useState } from 'react';

export default function RedisDemoPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [input, setInput] = useState('Привет от Redis!');
  
  const getData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/redis-test');
      const json = await res.json();
      setData(json);
      setMessage(json.success ? '✅ Данные получены!' : '❌ Ошибка');
    } catch (error) {
      setMessage('❌ Ошибка соединения');
    }
    setLoading(false);
  };
  
  const saveData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/redis-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: input })
      });
      const json = await res.json();
      setData(json);
      setMessage(json.success ? '✅ Данные сохранены!' : '❌ Ошибка');
    } catch (error) {
      setMessage('❌ Ошибка соединения');
    }
    setLoading(false);
  };
  
  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1>🧪 Redis Demo</h1>
      <p>Тестирование работы Redis в Next.js</p>
      
      <div style={{ margin: '2rem 0' }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          style={{ width: '100%', padding: '1rem', marginBottom: '1rem' }}
          rows={3}
        />
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            onClick={saveData}
            disabled={loading}
            style={{ padding: '0.5rem 1rem', background: 'blue', color: 'white', border: 'none' }}
          >
            💾 Сохранить
          </button>
          <button
            onClick={getData}
            disabled={loading}
            style={{ padding: '0.5rem 1rem', background: 'green', color: 'white', border: 'none' }}
          >
            📥 Получить
          </button>
        </div>
      </div>
      
      {message && (
        <div style={{ padding: '1rem', background: '#e7f5ff', margin: '1rem 0' }}>
          {message}
        </div>
      )}
      
      {data && (
        <div style={{ background: '#f8f9fa', padding: '1rem' }}>
          <h3>Данные из Redis:</h3>
          <pre>{JSON.stringify(data, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
