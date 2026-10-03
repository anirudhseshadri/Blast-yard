/* Mineshaft: tunnels cross in the middle, where nobody can see you, and
   conveyor belts feed into them. Holes and brick supports break up the
   lanes, and a lift (a teleport pair) links the top and bottom. Data only. */

export default {
  id: 'mineshaft',
  name: 'Mineshaft',

  theme: {
    floorA:   '#2e2a26',
    floorB:   '#35302b',
    wall:     '#7d7468',
    wallTop:  '#988e80',
    wallLip:  '#5a534a',
    crate:    '#7a5531',
    crateTop: '#93683f',
    crateLine:'#563b22'
  },

  layout: [
    '###############',
    '#1__..%A%..__3#',
    '#_#.#.%.%.#.#_#',
    '#_..>>>=<<<.._#',
    '#.#.#.#=#.#.#.#',
    '#..o..%=%..o..#',
    '#=============#',
    '#..o..%=%..o..#',
    '#.#.#.#=#.#.#.#',
    '#_..>>>=<<<.._#',
    '#_#.#.%.%.#.#_#',
    '#4__..%A%..__2#',
    '###############'
  ],

  softDensity: 0.5,
  pickupChance: 0.5,

  powerups: { bomb:22, range:22, speed:14, shield:10, kick:10, fuse:8, skull:8, random:6 },

  roundLength: 120,
  shrinkInterval: 0.26
};
