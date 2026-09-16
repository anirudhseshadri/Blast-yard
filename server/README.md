# Blast Yard server

Runs the match. Every client sends its key state and draws the snapshots the
server sends back, so nobody hosts and closing a tab only costs that player.

Node 20 or newer and the `ws` package. Nothing else. Rooms live in memory:
there is no database, and a restart clears every room.

## Running it locally

    cd server
    npm install
    npm start

It listens on port 8080 unless `PORT` says otherwise, and answers `GET /health`
with a small JSON status.

Serve the game files separately, from the repository root:

    npx http-server -p 8080 .    # any static server will do

When the page is opened on `localhost` or `127.0.0.1` the client looks for the
server at `ws://localhost:8080` on its own, so local development needs no
configuration. Add `?server=ws://...` to the URL to point a page at a different
server.

## Deploying

The server has to keep running, so Vercel and Netlify cannot host it. They can
still serve the game files.

1. Create a Web Service on [Render](https://render.com), pointed at this repo.
   - Root directory: `server`
   - Build command: `npm install`
   - Start command: `npm start`
   - Region: Singapore is the closest free region to India.
   - Check Render's current free tier terms before relying on them.
2. Render gives the service a URL. Put the `wss://` form of it in
   `src/config.js` as `SERVER_URL`, then redeploy the client.

Use `wss://`, not `ws://`. A browser on an `https://` page refuses to open a
plain `ws://` socket.

**The free tier sleeps when idle.** The first person to connect waits roughly
half a minute while it wakes, and the client shows "Reaching the server..."
rather than a dead button. If that wait annoys you, the paid step is small.
Fly.io has a Mumbai region, which would be closer, but it is restricted to
their paid plans, so budget for it rather than assuming it is free.

## Limits

These are deliberate and all live in `rooms.js` and `server.js`:

| Limit | Value |
| --- | --- |
| Players per room | 4 |
| Rooms on the server | 50 |
| New rooms per address | one per 10 seconds |
| Idle room lifetime | 60 seconds after the last player leaves |
| Tick rate | 30 a second |
| Snapshot rate | 20 a second |

## Protocol

Client to server:

    { t: "create", name }
    { t: "join", code, name }
    { t: "name", name }
    { t: "ready", value }
    { t: "map", id }               // room owner only
    { t: "bestof", value }         // room owner only, 3 / 5 / 7
    { t: "start" }                 // room owner only
    { t: "input", u, d, l, r, b, k }
    { t: "leave" }

Server to client:

    { t: "room", code, you, mapId, bestOf, phase,
      players: [{ slot, name, ready, owner, wins, matches }] }
    { t: "starting", inSeconds }
    { t: "snap", s: { ... } }
    { t: "ended", winner, winnerSlot, round, bestOf, target, matchOver,
      champion, championSlot, nextIn, scores }
    { t: "error", reason }

`name`, `map` and `bestof` are additions to the list in MULTIPLAYER.md. The lobby already
had a name field and a map picker, and the server owns lobby state now, so
those two choices had to become messages.

The snapshot sits in its own `s` field rather than being spread into the
message, because the packed snapshot has a `t` of its own for the round clock
and spreading it would overwrite the message type.

## A match, round by round

A room runs a match of best of three, five or seven. `wins` counts rounds in
the match being played; `matches` counts matches won since the room opened.
Both live in memory and are gone when the room is.

    lobby  -> starting    3 seconds, then the first round
           -> playing     the round itself
           -> result      1.5s, the finished board holds so the last blast lands
           -> scoreboard  5s, the score, counting down to the next round
           -> playing     the next round, with nobody tapping anything

The scoreboard goes back to the lobby instead when the match is decided, or
when fewer than two players are left to play the next round.

## Files

    server.js   sockets, the protocol, the limits, and the room sweeper
    rooms.js    a room: its lobby, its match, and one step of its clock

`rooms.js` imports `../src/game.js`, the same rules file the browser runs for
local play, so there is one copy of the game and it cannot drift.
