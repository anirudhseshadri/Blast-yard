# Blast Yard - phase 2: real multiplayer, and the login question

## The short version

Login is not what makes a game multiplayer. Right now the game is peer to peer:
one cousin's phone runs the match and everyone else's phone is a screen and a
controller. That works until it doesn't. What breaks:

- The host leaves and the match dies.
- Two phones on mobile data sometimes cannot form a direct connection at all.
- The host's phone is doing all the work, so the host gets the smoothest game.
- Anyone who can open dev tools on the host device could cheat.

The fix for all four is a small game server that runs the match. That is the
change worth making. Accounts are optional and come later, if ever.

## Phase A: move the match onto a server

### Architecture

    phone ─┐
    phone ─┼── WebSocket ──► Node server ── runs the game loop, owns the truth
    laptop ┘                     │
                                 └── sends every player the same snapshot 20x a second

The client already works this way. Guests today send key presses and draw
snapshots. So this is mostly moving `game.js` from the browser to the server and
swapping PeerJS for a WebSocket.

### Server

- Node 20, the `ws` package, nothing else. No Express unless a health check needs it.
- Rooms live in memory in a `Map` of room code to room object. No database.
- One `setInterval` at 30 ticks a second per active room. Snapshot out at 20 a second.
- A room dies 60 seconds after its last player leaves.
- Limits: 4 players a room, 50 rooms, one room creation per IP per 10 seconds.

### Message protocol

Client to server:

    { t: "create", name }
    { t: "join", code, name }
    { t: "ready", value }
    { t: "start" }                 // room owner only
    { t: "input", u, d, l, r, b, k }
    { t: "leave" }

Server to client:

    { t: "room", code, you, players: [{ slot, name, ready, owner }] }
    { t: "starting", inSeconds }
    { t: "snap", ... }             // same shape the host broadcasts today
    { t: "ended", winner, scores }
    { t: "error", reason }

Keep the snapshot format as it is. It already works.

### Client changes

- `net.js` swaps PeerJS for `new WebSocket(...)`. Everything else stays.
- Remove the host and guest split. Every client is now the same.
- Handle a dropped socket: show "reconnecting", retry for 10 seconds, then drop to the menu.

### Hosting

Needs a process that stays running, so Vercel and Netlify cannot do it. They
can still serve the game files.

- Start with Render's free tier, region Singapore, which is the closest free
  option to India. It sleeps when idle, so the first person to connect waits
  about half a minute while it wakes. Check their current free tier terms before
  relying on it.
- If the wait or the latency annoys you, the paid step is small. Fly.io has a
  Mumbai region, but it has been restricted to their paid plans, so budget for
  that rather than assuming it is free.
- Serve the client from Vercel as now, and point it at the server's URL.
  Use `wss://`, not `ws://`, or browsers will block it.

### Why this is worth doing before anything else

Everything below gets easier once a server owns the match. Scores, rematch,
reconnect, stats and anti-cheat all need one place that knows the truth.

## Phase B: identity without a login

Enough for family play:

- Ask for a display name once. Store it in `localStorage`.
- Generate a random device id, store it too, and send it with every join.
- The server uses the device id to give someone their slot back if they
  reconnect mid-match.

No passwords, no email, no accounts to reset, nothing to leak. Do this when
Phase A is stable.

## Phase C: real accounts, only if you want a leaderboard

Add this only when someone asks "what is my record against him", meaning the
history has to survive across devices.

- Sign-in: Google only, through a hosted provider such as Supabase Auth or
  Clerk. Do not build password auth yourself. It is the one part of this
  project where a mistake has real consequences.
- Database: Postgres on Neon or Supabase, free tier. Tables:
  `users(id, name, created_at)`,
  `matches(id, map, started_at, ended_at)`,
  `match_players(match_id, user_id, slot, placement, kills, deaths)`.
- The server writes match results. The client never writes to the database.
- Let people play as a guest without signing in. Forcing a login before a
  family game is the fastest way to kill it.

Rough cost at this scale: the database free tiers are ample for four people,
and the server is the only real bill, around $5 to $7 a month if you leave the
free tier.

## Order of work

1. Phase A server, same game, same maps. Nothing visible changes except that
   nobody has to host.
2. Lobby and map selection on top of the server, since the server now owns lobby state.
3. Rounds and scoring, held in the room.
4. Phase B names and reconnect.
5. Phase C accounts, only if the leaderboard question actually comes up.

## Things that will bite

- A sleeping free server means the first join looks broken. Show "waking up the
  server" rather than a spinner.
- Phones lock and suspend the tab. Treat a socket that goes quiet for 5 seconds
  as disconnected, and let it reconnect into the same slot.
- Clock differences between server and client will make movement look jittery if
  the client ever tries to predict. Do not add prediction unless the game
  actually feels laggy. Drawing the snapshot directly is fine at this scale.
