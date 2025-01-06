import { goto } from '$app/navigation';
import { BingoMessageTypes, GameState, type BingoMessages, type Player } from './types'

export const webSocket = new WebSocket('ws://127.0.0.1:8765');

export const players: Array<Player> = $state([])

export let session = $state({
  username: '',
  id: ''
})

let gameStateId: GameState = $state(GameState.NONE)

export function getGameState() {
  return gameStateId
}

export function setGameState(newState: GameState) {
  gameStateId = newState
}

webSocket.onmessage = (message) => {
  const data: BingoMessages = JSON.parse(message.data)
  switch (gameStateId) {
    case GameState.NONE:
      switch (data.type) {
        case BingoMessageTypes.session_created:
          gameStateId = GameState.JOINED
          players.push(...data.players)
          session.id = data.sessionId
          goto(`sessions/${data.sessionId}`);
          break;
        case BingoMessageTypes.joined_successfully:
          gameStateId = GameState.JOINED
          players.push(...data.players)
          goto(`sessions/${session.id}`);
          break;
      
        default:
          break;
      }
      break;
      case GameState.JOINED:
        switch (data.type) {
          case BingoMessageTypes.user_joined:
            players.push(data.name)
            break;
          case BingoMessageTypes.user_left:
            
            break;
          case BingoMessageTypes.game_started:
            gameStateId = GameState.STARTED
            break;
          default:
            break;
        }
      case GameState.STARTED:
        switch (data.type) {
          case BingoMessageTypes.cards_dealt:

            break;
          case BingoMessageTypes.user_has_bingo:
            
            break;
          case BingoMessageTypes.user_stamped:

            break;
          default:
        break;
    default:
      break;
  }
}

