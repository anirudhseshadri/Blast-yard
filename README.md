# Blast Yard

A browser bomb-battler. Four players, grid arena, destructible blocks, powerups,
last one alive wins. Static site, no backend, no build step.

## Running it locally

The game is built from ES modules, so opening `index.html` straight off your
disk (a `file://` address) will not work. Browsers block module loading there.
Serve the folder over HTTP instead. From this directory:

    npx http-server -p 8080

Then open <http://127.0.0.1:8080>. Any static server will do.

Deploying is unchanged: push the repo to Vercel or GitHub Pages.

## Layout

    index.html      canvas, touch pad, and the module entry point
    src/main.js     wires the parts together and runs the frame loop
    src/game.js     rules and simulation. No drawing, no networking, no DOM
    src/render.js   draws a view object onto the canvas
    src/net.js      PeerJS host and guest, snapshot packing
    src/input.js    keyboard and touch
    src/ui.js       menu and lobby screens
    src/constants.js  values shared by all of the above
    src/maps/       one file per map, data only

`game.js` holds the tuned numbers for movement, bomb timing and blasts. The
simulation never reads the DOM, so the host and every guest run the same rules,
and the same file can move to a server later (see MULTIPLAYER.md).

## Controls

Arrow keys or WASD to move, space or enter to drop a bomb, K or left shift to
kick. On a phone the d-pad appears automatically: hold your thumb on it and
slide between directions without lifting. Add `?pad` to the URL to force the
touch controls on a laptop.

Four players can share one keyboard: arrows, WASD, UHJK and the numpad.
