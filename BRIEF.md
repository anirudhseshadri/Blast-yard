# Blast Yard - build brief for Claude Code

## What this is

A browser bomb-battler in the style of the 2006 Flash game Pyromasters. Four players,
grid arena, destructible blocks, powerups, last one alive wins. Played by family on
phones and laptops at the same time.

`index.html` in this repo is a working prototype. It is the starting point and the
reference for how the game should feel. Do not rewrite it from scratch. Refactor it.

## Rules for this project

- Keep it a static site. No backend, no database, no build step.
- Use plain ES modules (`<script type="module">`). No React, no bundler, no npm
  packages except PeerJS, which loads from a CDN.
- It must stay deployable to Vercel or GitHub Pages by pushing the repo, nothing else.
- Everything must work with touch input on iPhone and Android, and with a keyboard.
- Do not change the movement, bomb timing, or blast constants unless I ask. The feel is tuned.

## How the multiplayer works today

Host-authoritative peer to peer over WebRTC using PeerJS.

- One browser hosts. It runs the whole simulation.
- Guests send only their key or touch state.
- The host sends a full snapshot of the world about 20 times a second.
- Guests draw the snapshot and smooth player positions between updates.
- There is no server and no matchmaking. Rooms are a 5 letter code used as the PeerJS id.

Keep this model. It is free and it is fast enough for family play.

## Task 1: restructure

Split `index.html` into ES modules, roughly:

- `src/game.js` - rules and simulation only. No drawing, no networking.
- `src/render.js` - draws a view object onto the canvas.
- `src/net.js` - PeerJS host and guest, snapshot packing and unpacking.
- `src/input.js` - keyboard and touch.
- `src/ui.js` - menu, lobby, scoreboard screens.
- `src/maps/*.js` - one file per map, pure data.
- `index.html` - canvas, touch pad, and the module entry point.

The simulation must not read the DOM. That keeps it testable and keeps host and guest
running the same rules.

## Task 2: shared lobby (do this first after the restructure)

Today the host sees who joined and guests see nothing. Replace both with one lobby
screen that everyone sees the same version of.

- Host broadcasts lobby state; everyone renders it.
- Shows: room code, the list of joined players with their colour, who is host,
  and a ready toggle per player.
- Each player can type a name. Store it in localStorage so they do not retype it.
- Map picker: host selects, everyone sees the selection.
- Start button is host-only and disabled until at least two players are ready.
- Handle someone leaving the lobby: remove them from the list for everyone.
- After a round ends, everyone returns to this same screen with scores shown,
  so the next round is one tap away.

## Task 3: maps as data

A map file is data only:

- name, tile theme colours
- fixed wall layout (a grid of characters, so I can draw new maps by typing)
- soft block density and which spawn corners are used
- powerup weights for that map
- optional special tiles: conveyor, one-way, teleport pair, water that blocks bombs
- round length and how fast the arena closes at the end

Ship three maps to prove the format works, including one with a special tile.

## Task 4: rounds and scoring

- Best of 3, 5 or 7, chosen in the lobby.
- Scoreboard between rounds, auto-start next round after a short countdown.
- Track wins per player for the session only. Nothing is saved to a server.

## Backlog, roughly in the order I want it

1. Bots, so two of us can play a full arena. Simple avoidance of flames and own bombs is enough.
2. Sound effects: fuse, explosion, powerup, round win. Short files, preload, mute toggle.
3. More powerups: remote detonator, throw bomb over blocks, walk through soft blocks.
4. More curses: slow, tiny blast, one bomb only, invisible to yourself.
5. Landscape hint on phones and a larger touch pad option.
6. Spectator view for dead players with a "next round in 5" overlay.
7. Reconnect: if a guest drops mid-round, let them rejoin into the next round.

## Known problems to fix while you are in there

- If the host closes the tab the game dies with no message for the guests.
- Kicked bombs can pass through a player standing exactly on a tile edge.
- The random powerup can strip everything with no visual feedback.
- Nothing tells a phone player that the game wants landscape.

## How I will test

Laptop hosts, two phones join over wifi, one phone on mobile data. Tell me anything
that needs a second device to verify, since you cannot test the networking yourself.
