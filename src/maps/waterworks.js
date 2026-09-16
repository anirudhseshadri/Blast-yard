/* Waterworks: the map that proves the special tiles.

   ~  a water channel through the middle. You can walk it, but no bomb can be
      planted on it and no blast crosses it, so it is the one safe lane.
   >  < conveyor belts that shove you along whether you like it or not.
   A  a teleport pair linking the two long sides.

   Data only, like every other map. */

export default {
  id: 'waterworks',
  name: 'Waterworks',

  theme: {
    floorA:   '#26343a',
    floorB:   '#2c3c44',
    wall:     '#6f8794',
    wallTop:  '#8aa4b2',
    wallLip:  '#4d5f6a',
    crate:    '#5f6b4a',
    crateTop: '#75845c',
    crateLine:'#414a33'
  },

  layout: [
    '###############',
    '#1__.......__3#',
    '#_#.#.#.#.#.#_#',
    '#_...>>>....A_#',
    '#.#.#.#.#.#.#.#',
    '#...~~~~~~~...#',
    '#.#.#.#.#.#.#.#',
    '#.....<<<.....#',
    '#.#.#.#.#.#.#.#',
    '#_A.........._#',
    '#_#.#.#.#.#.#_#',
    '#4__.......__2#',
    '###############'
  ],

  softDensity: 0.22,        // the specials are the point, so keep sight lines
  pickupChance: 0.55,

  powerups: { bomb:20, range:20, speed:18, shield:10, kick:14, fuse:8, skull:6, random:4 },

  roundLength: 150,
  shrinkInterval: 0.22      // longer round, but the walls close faster at the end
};
