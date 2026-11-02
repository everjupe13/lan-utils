import { useApplication } from '../../composables/useApplication';
import { GameRoom } from './GameRoom';
import { SiteFooter } from '../../components/layout/SiteFooter';
import { SiteHeader } from '../../components/layout/SiteHeader';
import { Welcome } from '../../components/person/Welcome';
import { Lobby } from '../../components/room/Lobby';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import styles from '../../App.module.css';

export function ChessPage() {
  const { profile, setProfile, resetProfile, game, needsProfile } = useApplication();
  return (
    <div className={styles.appShell}>
      <SiteHeader profile={profile} status={game.status} showProfile={!needsProfile} />
      {game.error && <Alert onDismiss={game.actions.clearError}>{game.error}</Alert>}
      {game.status === 'displaced' && (
        <div className={styles.notice}>
          Для другой партии используйте новый логин.{' '}
          <Button variant="text" onClick={resetProfile}>
            Сменить профиль
          </Button>
        </div>
      )}
      {needsProfile ? (
        <Welcome profile={profile} onEnter={setProfile} />
      ) : game.room && profile ? (
        <GameRoom room={game.room} profile={profile} ready={game.ready} actions={game.actions} />
      ) : (
        <Lobby
          rooms={game.rooms}
          ready={game.ready}
          onCreate={game.actions.createRoom}
          onJoin={game.actions.joinRoom}
        />
      )}
      <SiteFooter />
    </div>
  );
}
