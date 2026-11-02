import type { ChessMove } from '@nearby/shared/chess';
import { Card } from '../ui/Card';
import { HeadingRow } from '../ui/HeadingRow';
import { MutedText } from '../ui/Typography';
import styles from './MoveHistory.module.css';

export function MoveHistory({ history }: { history: ChessMove[] }) {
  return (
    <Card className={styles.historyCard}>
      <HeadingRow title="Ходы">
        <span>{history.length} полуходов</span>
      </HeadingRow>
      <div className={styles.historyScroll}>
        {history.length === 0 ? (
          <MutedText className={styles.historyEmpty}>Первый ход ещё впереди.</MutedText>
        ) : (
          <table aria-label="История ходов">
            <thead>
              <tr>
                <th>№</th>
                <th>Белые</th>
                <th>Чёрные</th>
              </tr>
            </thead>
            <tbody>
              {history
                .filter((_, index) => index % 2 === 0)
                .map((move, index) => (
                  <tr key={index}>
                    <td>{index + 1}.</td>
                    <td>{move.san}</td>
                    <td>{history[index * 2 + 1]?.san ?? '—'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>
    </Card>
  );
}
