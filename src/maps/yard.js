/* The classic yard: solid border, pillars on every even row and column.
   Data only. No functions, no drawing, no DOM.

   Task 3 in BRIEF.md turns this into a richer format (typed layouts, special
   tiles, per-map powerup weights). For now it holds exactly the numbers the
   prototype used, so the feel is unchanged. */

export default {
  id: 'yard',
  name: 'The Yard',

  // Soft blocks are scattered over every free tile that is not next to a spawn.
  softDensity: 0.26,        // chance a free tile becomes a soft block
  pickupChance: 0.45,       // chance a soft block hides a powerup

  // [row, col] of each starting corner, in slot order.
  spawns: [[1,1],[11,13],[1,13],[11,1]],

  // Tiles kept clear around every spawn, as [rowOffset, colOffset].
  spawnClearance: [
    [0,0],[1,0],[2,0],[-1,0],[-2,0],
    [0,1],[0,2],[0,-1],[0,-2],
    [1,1],[-1,-1],[1,-1],[-1,1]
  ],

  roundLength: 120,         // seconds before the arena starts closing
  shrinkInterval: 0.28      // seconds between each closing tile
};
