import { Game } from "./Game.ts";

enum Commands {
  JOIN = "JOIN",
  LEAVE = "LEAVE",
  CREATE = "CREATE",
  START = "START",
  STOP = "STOP",
}

const games: Array<Game> = [];

function joinGame(gameId: string, socket: WebSocket, name: String) {
  const newGame = new Game();
  newGame.players.push();
  games.push(new Game());
}

Deno.serve(async (req) => {
  if (req.headers.get("upgrade") != "websocket") {
    return new Response(await Deno.readFile("client.html"), { status: 200 });
  }

  const { socket, response } = Deno.upgradeWebSocket(req);

  socket.addEventListener("open", () => {
    console.log("a client connected!");
    console.log(socket);
  });

  socket.addEventListener("message", (event) => {
    console.log({ ...event.data });
    const data: { command: string; parameters: string } = event.data.map((
      data: any,
    ) => ({
      command: data.command.toUpperCase(),
      parameters: data.parameters.toUpperCase(),
    }));

    if (data.command === Commands.CREATE) {
      games.push(new Game());
    }

    switch (data.command) {
      case Commands.CREATE: {
        games.push(new Game());
        break;
      }
      case Commands.JOIN: {
        const gameId = data.parameters[0];
        joinGame(gameId, socket, crypto.randomUUID());
        break;
      }
      default: {
        socket.send("Unknown Command");
      }
    }
  });

  return response;
});
