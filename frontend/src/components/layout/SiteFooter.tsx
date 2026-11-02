import styles from './SiteFooter.module.css';

export function SiteFooter() {
  return (
    <footer className={styles.siteFooter}>
      <span>Меньше суеты. Больше хороших ходов.</span>
      <span>
        Локальные шахматы <span className={styles.footerStar}>✳</span>
      </span>
    </footer>
  );
}
