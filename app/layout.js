// app/layout.js
import { Inter } from 'next/font/google';
import './globals.css'; // Если у тебя есть глобальные стили

// Можно использовать любые шрифты
const inter = Inter({ subsets: ['latin', 'cyrillic'] });

export const metadata = {
  title: 'School Mini App',
  description: 'Приложение для учёта занятий',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body className={inter.className} style={{ margin: 0, padding: 0 }}>
        {children}
      </body>
    </html>
  );
}
