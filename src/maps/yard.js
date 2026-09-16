/* The classic yard: solid border, pillars on every even row and column.
   Data only. No functions, no drawing, no DOM.

   The `_` tiles are the clearance around each spawn. They are floor that
   never grows a crate, so nobody starts the round boxed in. */

export default {
  id: 'yard',
  name: 'The Yard',

  theme: {
    floorA:   '#2b2f3a',
    floorB:   '#303542',
    wall:     '#7c8699',
    wallTop:  '#98a3b8',
    wallLip:  '#5c6577',
    crate:    '#7d5a3c',
    crateTop: '#966d48',
    crateLine:'#5a3f2a'
  },

  layout: [
    '###############',
    '#1__.......__3#',
    '#_#.#.#.#.#.#_#',
    '#_..........._#',
    '#.#.#.#.#.#.#.#',
    '#.............#',
    '#.#.#.#.#.#.#.#',
    '#.............#',
    '#.#.#.#.#.#.#.#',
    '#_..........._#',
    '#_#.#.#.#.#.#_#',
    '#4__.......__2#',
    '###############'
  ],

  softDensity: 0.26,        // chance a free tile becomes a soft block
  pickupChance: 0.45,       // chance a soft block hides a powerup

  // how often each powerup comes up on this map, relative to the others
  powerups: { bomb:22, range:22, speed:14, shield:8, kick:10, fuse:8, skull:10, random:6 },

  roundLength: 120,         // seconds before the arena starts closing
  shrinkInterval: 0.28      // seconds between each closing tile
};
