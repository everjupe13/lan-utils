import { pieceNames, pieceSymbols } from '../../chess/board';
import type { Promotion } from '@nearby/shared/chess';
import { Button } from '../ui/Button';
import styles from './PromotionPicker.module.css';

export function PromotionPicker({
  onSelect,
  onCancel,
}: {
  onSelect(piece: Promotion): void;
  onCancel(): void;
}) {
  return (
    <div className={styles.promotionOverlay}>
      <div
        className={styles.promotionCard}
        role="dialog"
        aria-modal="true"
        aria-label="Превращение пешки"
      >
        <h3>Выберите фигуру</h3>
        <div className={styles.promotionOptions}>
          {(['q', 'r', 'b', 'n'] as const).map((piece) => (
            <button
              type="button"
              autoFocus={piece === 'q'}
              key={piece}
              aria-label={pieceNames[piece]}
              onClick={() => onSelect(piece)}
            >
              {pieceSymbols[piece]}
            </button>
          ))}
        </div>
        <Button variant="text" onClick={onCancel}>
          Отмена
        </Button>
      </div>
    </div>
  );
}
