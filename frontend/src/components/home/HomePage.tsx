import { NetworkAccess } from '../network/NetworkAccess';
import { Eyebrow } from '../ui/Typography';
import styles from './HomePage.module.css';

export function HomePage() {
  return (
    <main className={styles.home}>
      <Eyebrow>НЕБОЛЬШИЕ ИНСТРУМЕНТЫ ДЛЯ ОДНОЙ СЕТИ</Eyebrow>
      <h1>Всё нужное — рядом.</h1>
      <p className={styles.lead}>
        Передайте ссылку с телефона на компьютер, соберите разговор в комнате или сделайте ход.
      </p>
      <div className={styles.tools}>
        <a className={styles.tool} href="/chat">
          <span className={styles.icon}>↔</span>
          <div>
            <h2>Общение</h2>
            <p>Комнаты, личные чаты и ссылки между подключёнными устройствами.</p>
          </div>
          <span className={styles.arrow}>↗</span>
        </a>
        <a className={styles.tool} href="/gambit">
          <span className={styles.icon}>♞</span>
          <div>
            <h2>Гамбит</h2>
            <p>Шахматы для двоих. Создайте комнату и пригласите соперника.</p>
          </div>
          <span className={styles.arrow}>↗</span>
        </a>
      </div>
      <NetworkAccess />
    </main>
  );
}
