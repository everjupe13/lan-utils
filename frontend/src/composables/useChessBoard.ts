import { useEffect, useMemo, useState } from 'react';
import { parsePosition, pieceColor } from '../chess/board';
import type { Color, Promotion } from '@nearby/shared/chess';
import type { BoardSquare } from '../types/game';
import type { RoomState } from '@nearby/shared/room';

export function useChessBoard(
  room: RoomState,
  color: Color,
  enabled: boolean,
  onMove: (from: string, to: string, promotion?: Promotion) => void,
) {
  const [selected, setSelected] = useState<string | null>(null);
  const [promotion, setPromotion] = useState<{ from: string; to: string } | null>(null);
  useEffect(() => {
    setSelected(null);
    setPromotion(null);
  }, [room.revision, enabled]);
  const board = useMemo(() => parsePosition(room.fen), [room.fen]);
  const moves = selected ? room.legalMoves.filter((move) => move.from === selected) : [];
  const files = color === 'w' ? 'abcdefgh' : 'hgfedcba';
  const ranks = color === 'w' ? '87654321' : '12345678';
  const last = room.history.at(-1);
  const squares: BoardSquare[] = [...ranks].flatMap((rank, row) =>
    [...files].map((file, col) => {
      const id = file + rank;
      const piece = board[id];
      return {
        id,
        piece,
        whitePiece: Boolean(piece && pieceColor(piece) === 'w'),
        light: (Number(rank) + 'abcdefgh'.indexOf(file)) % 2 === 0,
        rankLabel: col === 0 ? rank : undefined,
        fileLabel: row === 7 ? file : undefined,
        selected: selected === id,
        target: moves.some((move) => move.to === id),
        lastMove: last?.from === id || last?.to === id,
        check: Boolean(
          room.check && piece?.toLowerCase() === 'k' && pieceColor(piece) === room.turn,
        ),
      };
    }),
  );
  function select(square: string) {
    if (!enabled || promotion) return;
    const targets = moves.filter((move) => move.to === square);
    if (selected && targets.length) {
      if (targets.some((move) => move.promotion)) setPromotion({ from: selected, to: square });
      else {
        onMove(selected, square);
        setSelected(null);
      }
      return;
    }
    const piece = board[square];
    setSelected(piece && pieceColor(piece) === color && square !== selected ? square : null);
  }
  function promote(piece: Promotion) {
    if (enabled && promotion) onMove(promotion.from, promotion.to, piece);
    setPromotion(null);
    setSelected(null);
  }
  return { squares, select, promotion, promote, cancelPromotion: () => setPromotion(null) };
}
