# bingo

Multiplayer-Bingo für den Browser. Eine Runde erstellen, die sechsstellige Spiel-ID
teilen, alle spielen live auf eigenen Karten — ohne Anmeldung, ohne Datenbank.

## Stack

Alles steckt in `web/`: eine Next.js-App (App Router, React 19, Tailwind v4), die in
**einem** Node-Prozess zusammen mit dem WebSocket-Server läuft.

```
web/
├── server.ts              HTTP (Next) + WebSocket auf /ws im selben Prozess
├── src/server/
│   ├── engine.ts          autoritative Spiellogik, komplett in-memory
│   ├── ws.ts              Transport: Nachricht → Engine → Snapshot an alle
│   └── wordlists.ts       die Begriffssammlungen
├── src/lib/
│   ├── protocol.ts        Nachrichten-Typen, von Server und Client geteilt
│   └── connection.ts      eine app-weite Verbindung als External Store
└── src/app, src/components   die Oberfläche
```

## Loslegen

```bash
cd web && npm install && npm run dev
```

http://localhost:3000 — für einen echten Mehrspieler-Test einen zweiten Browser
(oder ein privates Fenster) nehmen: zwei Tabs im selben Browser teilen sich
absichtlich denselben Sitzplatz.

| Befehl | Wirkung |
| --- | --- |
| `npm run dev` | Next-Dev-Server + WebSocket, mit Hot Reload |
| `npm run build` && `npm start` | Produktionsbuild und -start |
| `npm test` | Tests der Spiellogik |
| `npm run typecheck` | `tsc --noEmit` |

## Wie es funktioniert

Der Server ist die einzige Quelle der Wahrheit. Clients schicken Absichten, der
Server rechnet und schickt danach einen vollständigen Snapshot der Runde an alle
Verbundenen. Dadurch kann es keinen auseinanderlaufenden Zustand geben, und ein
Client, der gerade neu verbindet, ist sofort wieder synchron.

**Client → Server**

| Nachricht | Wer | Wirkung |
| --- | --- | --- |
| `create` | alle | neue Runde, Absender wird Host |
| `join` | alle | Runde betreten oder alten Platz zurücknehmen (`playerId`) |
| `config` | Host | Wortliste oder Kartengröße ändern (nur in der Lobby) |
| `start` / `stop` / `reset` | Host | Karten austeilen / beenden / zurück in die Lobby |
| `stamp` | alle | Feld stempeln oder wieder freigeben |
| `leave` | alle | Platz endgültig aufgeben |

**Server → Client**

| Nachricht | Inhalt |
| --- | --- |
| `welcome` | verfügbare Wortlisten |
| `sync` | kompletter Rundenzustand + die eigene Karte |
| `event` | einmalige Ereignisse: `player_joined`, `player_left`, `player_bingo`, `game_started`, `game_stopped` |
| `error` | abgelehnte Aktion mit Begründung |

Eigene Karten bleiben privat: `sync` enthält von den Mitspielern nur Name, Status
und die gestempelten Felder — genug für die Mini-Vorschau und die Rangliste, aber
nie deren Begriffe.

### Verbindungen, die abreißen

* Bricht der Socket ab, bleibt der Platz reserviert: Karte und Stempel überleben.
  Der Client merkt sich seine `playerId` pro Spiel-ID und nimmt den Platz beim
  Reconnect automatisch wieder ein.
* War der Host weg, übernimmt jemand, der noch verbunden ist — eine Lobby bleibt
  nie ohne Startknopf zurück.
* Nach fünf Minuten ohne Rückkehr wird ein Platz geräumt, nach zehn Minuten ohne
  jede Verbindung die ganze Runde.

### Bingo

Karten sind 3×3, 4×4 oder 5×5; ungerade Größen haben ein freies Mittelfeld, das
von Anfang an gestempelt ist. Jede Spielerin bekommt eine eigene Mischung der
Wortliste, gleiche Karten gibt es also nicht. Eine volle Reihe, Spalte oder
Diagonale ist ein Bingo — der Server erkennt es, hält die Reihenfolge der Gewinner
fest und nimmt ein Bingo wieder zurück, wenn ein Feld entstempelt wird.

## Vorgänger

`front-end/` (SvelteKit) und `back-end/` (Python-WebSockets) sind die erste
Fassung und werden nicht mehr gebraucht.
