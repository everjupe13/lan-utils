import { useEffect } from 'react';
import { ChessPage } from './components/chess/ChessPage';
import { ChatPage } from './components/chat/ChatPage';
import { HomePage } from './components/home/HomePage';
import { HubHeader } from './components/layout/HubHeader';
import styles from './App.module.css';

export default function App() {
  const path = location.pathname.replace(/\/+$/, '') || '/';
  useEffect(() => {
    document.title =
      path === '/gambit'
        ? 'Гамбит — шахматы для двоих'
        : path === '/chat'
          ? 'Рядом — общение'
          : 'Рядом — локальные инструменты';
  }, [path]);
  if (path === '/gambit') return <ChessPage />;
  return (
    <div className={styles.appShell}>
      <HubHeader path={path} />
      {path === '/' ? (
        <HomePage />
      ) : path === '/chat' ? (
        <ChatPage />
      ) : (
        <main className={styles.notFound}>
          <h1>Такой страницы нет.</h1>
          <a href="/">Вернуться в меню ↗</a>
        </main>
      )}
      <footer className={styles.hubFooter}>
        <span>Рядом. Небольшие инструменты для вашей сети.</span>
        <span>Без регистрации.</span>
      </footer>
    </div>
  );
}
