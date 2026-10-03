/* Frozen Pond: a lake of ice in the middle with holes in it, and brick
   cottages in the corners. Step onto the ice and you slide until something
   stops you, so a bomb on the far bank is a trap. Data only. */

export default {
  id: 'frozenpond',
  name: 'Frozen Pond',

  theme: {
    floorA:   '#2a3540',
    floorB:   '#2f3b47',
    wall:     '#8da2b5',
    wallTop:  '#a9bdcf',
    wallLip:  '#677a8c',
    crate:    '#7a6450',
    crateTop: '#94795f',
    crateLine:'#574535'
  },

  layout: [
    '###############',
    '#1__.......__3#',
    '#_%%.%...%.%%_#',
    '#_%..*****..%_#',
    '#..o*******o..#',
    '#.%.***o***.%.#',
    '#...**ooo**...#',
    '#.%.***o***.%.#',
    '#..o*******o..#',
    '#_%..*****..%_#',
    '#_%%.%...%.%%_#',
    '#4__.......__2#',
    '###############'
  ],

  softDensity: 0.55,        // crates only grow on the banks, never on the ice
  pickupChance: 0.5,

  // kick is the star here: a kicked bomb skates across the pond
  powerups: { bomb:20, range:18, speed:10, shield:10, kick:20, fuse:8, skull:8, random:6 },

  roundLength: 120,
  shrinkInterval: 0.28
};
