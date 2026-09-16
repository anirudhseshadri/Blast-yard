# Maps

A map is one file of plain data. No code, no drawing, no game rules. To add
one, copy an existing file, change it, and add a line to `index.js`.

## Drawing the arena

The `layout` is 13 strings of 15 characters, one character per tile. Draw it
in your editor and it is what you get:

```
    '###############',
    '#1__.......__3#',
    '#_#.#.#.#.#.#_#',
```

| Character | Tile |
| --- | --- |
| `#` | solid wall, never destroyed |
| `.` | floor that may grow a crate |
| `_` | floor that never grows one, for keeping a lane or a spawn open |
| `1` `2` `3` `4` | where each player starts, in slot order |
| `~` | water |
| `^` `v` `<` `>` | a conveyor, pushing that way |
| `A`–`Z` | a teleport pad. The same letter twice makes a pair |

Every map is checked when the game starts, so a mistake shows up straight
away with the row it is on:

```
Waterworks: row 3 is 14 tiles wide, expected 15
Waterworks: no "4" tile, so player 4 has nowhere to start
Waterworks: teleport "A" appears 1 time, and a pair needs exactly two
```

The grid is 15 by 13 because the canvas is. Changing that means changing
`constants.js`, which moves the whole game.

## Special tiles

- **Water** `~` — you can walk through it, but no bomb can be planted on it,
  no blast crosses it, and a kicked bomb stops at its edge. It is the one
  safe lane on a map.
- **Conveyor** `^ v < >` — drags whoever stands on it, on top of whatever
  they are doing. Walking against a belt still works, just slowly.
- **Teleport** `A`–`Z` — stepping onto a pad puts you on its partner. You
  land standing on that partner and nothing more happens until you step off
  and onto a pad again, so parking on one is quiet.

Specials never change during a round, so they are not sent with snapshots.
Every player works them out from the map the room picked. When the closing
arena seals a special tile it becomes a wall like any other.

## The rest of the file

```js
theme: { floorA, floorB, wall, wallTop, wallLip, crate, crateTop, crateLine }
```
Tile colours. Anything left out falls back to The Yard's.

```js
softDensity: 0.26      // chance a '.' tile grows a crate
pickupChance: 0.45     // chance a crate hides a powerup
```

```js
powerups: { bomb:22, range:22, speed:14, shield:8, kick:10, fuse:8, skull:10, random:6 }
```
How often each powerup comes up on this map, relative to the others. They are
weights, not percentages, so doubling one makes it twice as likely as before.
Anything left out falls back to the house numbers in `constants.js`.

```js
roundLength: 120       // seconds before the arena starts closing
shrinkInterval: 0.28   // seconds between each closing tile
```

## The three that ship

| Map | Feel |
| --- | --- |
| **The Yard** | the original. Regular pillars, 120s. Its numbers are tuned; leave them alone |
| **Scrapheap** | heaps instead of rows, packed with crates, 90s |
| **Waterworks** | open, with water, conveyors and a teleport pair. 150s, but the walls close faster |
