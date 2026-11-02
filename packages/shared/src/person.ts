import type { Color } from './chess.js';

export interface Profile {
  login: string;
  name: string;
}

export interface Player extends Profile {
  color: Color;
  connected: boolean;
}
