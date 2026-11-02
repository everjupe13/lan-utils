export type Color = 'w' | 'b';
export type Promotion = 'q' | 'r' | 'b' | 'n';

export interface ChessMove {
  san: string;
  from: string;
  to: string;
  color: Color;
}

export interface LegalMove {
  from: string;
  to: string;
  promotion?: Promotion;
}

export interface GameResult {
  winner: Color | null;
  reason: 'checkmate' | 'stalemate' | 'draw' | 'resignation' | 'abandonment';
}

export interface ChessPosition {
  fen: string;
  turn: Color;
  revision: number;
  check: boolean;
  history: ChessMove[];
  legalMoves: LegalMove[];
  result: GameResult | null;
}
