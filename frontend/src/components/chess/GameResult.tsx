import { resultReasons } from '../../chess/gameStatus';
import type { Color, GameResult as Result } from '@nearby/shared/chess';
import styles from './GameResult.module.css';

export function GameResult({ result, color }: { result: Result; color: Color }) {
  return (
    <section className={styles.resultCard} role="status">
      <span>⚑</span>
      <h2>
        {result.winner === null
          ? 'Ничья'
          : result.winner === color
            ? 'Вы победили'
            : 'Партия завершена'}
      </h2>
      <p>{resultReasons[result.reason]}</p>
    </section>
  );
}
