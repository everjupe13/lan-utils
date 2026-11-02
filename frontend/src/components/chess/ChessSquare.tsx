import { pieceNames, pieceSymbols } from '../../chess/board';
import type { BoardSquare } from '../../types/game';
import { classNames } from '../../utils/classNames';
import styles from './ChessSquare.module.css';

export function ChessSquare({
  square,
  onSelect,
}: {
  square: BoardSquare;
  onSelect(square: string): void;
}) {
  const { id, piece, whitePiece, target } = square;
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      aria-label={`${id}${piece ? `, ${whitePiece ? 'белые' : 'чёрные'} ${pieceNames[piece.toLowerCase()]}` : ''}${target ? ', доступный ход' : ''}`}
      aria-pressed={square.selected}
      className={classNames(
        styles.square,
        square.light ? styles.light : styles.dark,
        square.selected && styles.selected,
        square.lastMove && styles.lastMove,
        square.check && styles.inCheck,
      )}
    >
      {square.rankLabel && (
        <span className={classNames(styles.coordinate, styles.rank)}>{square.rankLabel}</span>
      )}
      {square.fileLabel && (
        <span className={classNames(styles.coordinate, styles.file)}>{square.fileLabel}</span>
      )}
      {piece && (
        <span
          aria-hidden="true"
          className={classNames(styles.piece, whitePiece ? styles.whitePiece : styles.blackPiece)}
        >
          {pieceSymbols[piece.toLowerCase()]}
        </span>
      )}
      {target && <span className={classNames(styles.target, Boolean(piece) && styles.capture)} />}
    </button>
  );
}
