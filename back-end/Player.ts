export class Player {
  socket: WebSocket;
  name: string;

  constructor(socket: WebSocket, name: string) {
    this.socket = socket;
    this.name = name;
  }
}
