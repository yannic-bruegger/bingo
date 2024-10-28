import type { Card } from "./Card.ts";
import type { Player } from "./Player.ts";

export class Game {
  players: Array<Player> = [];
  deck: Deck;
  dealtCards: Array<Card>;
}
