# Blast Yard

A browser bomb-battler. Four players, grid arena, destructible blocks, powerups,
last one alive wins. The client is a static site with no build step; online
games run on a small Node server that owns the match.

## Running it locally

The game is built from ES modules, so opening `index.html` straight off your
disk (a `file://` address) will not work. Browsers block module loading there.
Serve the folder over HTTP instead. From this directory:

    npx http-server -p 8099

Then open <http://127.0.0.1:8099>. Any static server will do. That is enough
for local play on one keyboard.

For online games, start the server too, in a second terminal:

    cd server && npm install && npm start

On `localhost` the client finds it by itself. See `server/README.md` for
deploying and for the message protocol.

## Deploying

Two pieces, because a game server has to keep running and Vercel cannot do
that:

- **The client** still deploys by pushing the repo to Vercel or GitHub Pages.
- **The server** goes somewhere that keeps a process alive, such as Render.
  Then put its `wss://` URL in `src/config.js`.

## Layout

    index.html      canvas, touch pad, and the module entry point
    src/main.js     wires the parts together and runs the frame loop
    src/game.js     rules and simulation. No drawing, no networking, no DOM
    src/render.js   draws a view object onto the canvas
    src/net.js      the WebSocket connection to the server
    src/snapshot.js the snapshot format, shared with the server
    src/config.js   where the server lives
    src/input.js    keyboard and touch
    src/ui.js       menu and lobby screens
    src/constants.js  values shared by all of the above
    src/maps/       one file per map, data only, plus index.js listing them
    server/         the game server. See server/README.md

`game.js` holds the tuned numbers for movement, bomb timing and blasts. It
never reads the DOM, so the same file runs in the browser for local play and on
the server for online play. There is one copy of the rules and it cannot drift.

## The lobby

Everyone in a room sees the same lobby screen. The server owns it and sends it
out after every change, so there is never a version only one person can see.

- Type a name. It is kept in this browser, so nobody retypes it next time.
- Each player has their own ready toggle.
- Whoever made the room picks the map; everyone sees the choice.
- Only that player can start, and only once two players are ready.
- When someone leaves, they disappear from everyone's list.
- After a round the lobby comes back with the scores on it, so the next round
  is one tap. Wins are counted for the session only and are never stored.

Four players to a room. A fifth is told the room is full.

## Controls

Arrow keys or WASD to move, space or enter to drop a bomb, K or left shift to
kick. On a phone the d-pad appears automatically: hold your thumb on it and
slide between directions without lifting. Add `?pad` to the URL to force the
touch controls on a laptop.

Four players can share one keyboard: arrows, WASD, UHJK and the numpad.
