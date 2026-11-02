import { useChessBoard } from '../../composables/useChessBoard';
import type { Color, Promotion } from '@nearby/shared/chess';
import type { RoomState } from '@nearby/shared/room';
import { ChessSquare } from './ChessSquare';
import { PromotionPicker } from './PromotionPicker';
import styles from './ChessBoard.module.css';

export function ChessBoard({
  room,
  color,
  enabled,
  onMove,
}: {
  room: RoomState;
  color: Color;
  enabled: boolean;
  onMove(from: string, to: string, promotion?: Promotion): void;
}) {
  const board = useChessBoard(room, color, enabled, onMove);
  return (
    <div className={styles.boardWrap}>
      <div className={styles.board} aria-label="Шахматная доска">
        {board.squares.map((square) => (
          <ChessSquare key={square.id} square={square} onSelect={board.select} />
        ))}
      </div>
      {board.promotion && (
        <PromotionPicker onSelect={board.promote} onCancel={board.cancelPromotion} />
      )}
    </div>
  );
}
