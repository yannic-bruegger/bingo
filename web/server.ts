/**
 * Single process: Next.js (HTTP) + the bingo WebSocket server on /ws.
 *
 *   npm run dev    → next dev + live-reloading ws server
 *   npm run build && npm start → production
 */

import { createServer } from 'node:http';
import next from 'next';

import { attachBingoServer } from './src/server/ws.ts';

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOST ?? '0.0.0.0';
const port = Number(process.env.PORT ?? 3000);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

await app.prepare();

const server = createServer((req, res) => {
  handle(req, res).catch((error: unknown) => {
    console.error('request failed', error);
    res.statusCode = 500;
    res.end('internal server error');
  });
});

const wss = attachBingoServer(server);

server.listen(port, hostname, () => {
  console.log(`▪ bingo ready on http://localhost:${port}  (ws on /ws)`);
});

// Open WebSockets keep `server.close()` waiting forever, which on a restart
// leaves clients hanging on a socket that is accepted but never answered.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    for (const client of wss.clients) client.terminate();
    wss.close();
    server.closeAllConnections();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
  });
}
