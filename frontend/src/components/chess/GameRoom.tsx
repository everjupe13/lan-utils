import { useGameRoom } from '../../composables/useGameRoom';
import type { GameActions } from '../../types/game';
import type { Profile } from '@nearby/shared/person';
import type { RoomState } from '@nearby/shared/room';
import { RoomInvite } from '../room/RoomInvite';
import { Eyebrow } from '../ui/Typography';
import { ChessBoard } from './ChessBoard';
import { GameControls } from './GameControls';
import { GameResult } from './GameResult';
import { MoveHistory } from './MoveHistory';
import { PlayerBar } from './PlayerBar';
import styles from './GameRoom.module.css';

export function GameRoom({
  room,
  profile,
  ready,
  actions,
}: {
  room: RoomState;
  profile: Profile;
  ready: boolean;
  actions: GameActions;
}) {
  const game = useGameRoom(room, profile, ready, actions);
  const opponentColor = game.color === 'w' ? 'b' : 'w';
  return (
    <main className={styles.gameLayout}>
      <section>
        <div className={styles.gameHeading}>
          <div>
            <Eyebrow>КОМНАТА {room.id}</Eyebrow>
            <h1>{game.status}</h1>
          </div>
          <span className={styles.colorLabel}>
            <i className={game.color === 'w' ? styles.whiteDot : styles.blackDot} />
            Вы — {game.color === 'w' ? 'белые' : 'чёрные'}
          </span>
        </div>
        <PlayerBar
          player={room.seats.find((player) => player.color === opponentColor)}
          color={opponentColor}
        />
        <ChessBoard room={room} color={game.color} enabled={game.canMove} onMove={actions.move} />
        <PlayerBar
          player={room.seats.find((player) => player.color === game.color)}
          color={game.color}
          me
        />
        <p className={styles.boardHint}>Нажмите на фигуру, затем на клетку, куда хотите пойти.</p>
      </section>
      <aside className={styles.gameSidebar}>
        <RoomInvite roomId={room.id} waiting={room.status === 'waiting'} />
        {room.result && <GameResult result={room.result} color={game.color} />}
        <MoveHistory history={room.history} />
        <GameControls
          active={room.status === 'active'}
          ready={ready}
          onResign={game.resign}
          onLeave={game.leave}
        />
      </aside>
    </main>
  );
}
