import type { Color } from '@nearby/shared/chess';

export const pieceSymbols: Record<string, string> = {
  k: '♚',
  q: '♛',
  r: '♜',
  b: '♝',
  n: '♞',
  p: '♟',
};
export const pieceNames: Record<string, string> = {
  k: 'король',
  q: 'ферзь',
  r: 'ладья',
  b: 'слон',
  n: 'конь',
  p: 'пешка',
};

export function pieceColor(piece: string): Color {
  return piece === piece.toUpperCase() ? 'w' : 'b';
}

export function parsePosition(fen: string): Record<string, string> {
  const board: Record<string, string> = {};
  fen
    .split(' ')[0]
    .split('/')
    .forEach((rank, row) => {
      let file = 0;
      for (const piece of rank) {
        if (/\d/.test(piece)) file += Number(piece);
        else {
          board[`${'abcdefgh'[file]}${8 - row}`] = piece;
          file++;
        }
      }
    });
  return board;
}
