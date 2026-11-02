import styles from './HubHeader.module.css';

export function HubHeader({ path }: { path: string }) {
  return (
    <header className={styles.header}>
      <a href="/" className={styles.brand}>
        <span aria-hidden="true">↔</span>рядом
        <span className={styles.tag}>LOCALHOST & FRIENDS</span>
      </a>
      <nav aria-label="Инструменты">
        <a href="/" aria-current={path === '/' ? 'page' : undefined}>
          Главная
        </a>
        <a href="/chat" aria-current={path === '/chat' ? 'page' : undefined}>
          Общение
        </a>
        <a href="/gambit">Гамбит ↗</a>
      </nav>
    </header>
  );
}
