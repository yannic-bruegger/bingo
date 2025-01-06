export type Player = string

export enum GameState {
  NONE,
  JOINED,
  STARTED,
}

export enum BingoMessageTypes {
  'joined_successfully' = 'joined_successfully',
  'user_joined' = 'user_joined',
  'session_created' = 'session_created',
  'user_left' = 'user_left',
  'game_started' = 'game_started',
  'cards_dealt' = 'game_started',
  'user_stamped_card' = 'game_started',
  'user_has_bingo' = 'game_started',
}

export type BingoMessages = {
  type: BingoMessageTypes.joined_successfully,
  players: Array<string>
} | {
  type: BingoMessageTypes.user_joined,
  name: string
} | {
  type: BingoMessageTypes.session_created,
  players: Array<string>
  sessionId: string
} | {
  type: BingoMessageTypes.user_left,
  players: Array<string>
  sessionId: string
} | {
  type: BingoMessageTypes.game_started,
  players: Array<string>
  sessionId: string
}