/* Scrapheap: no tidy rows of pillars, just heaps of junk. Packed with crates
   and a shorter clock, so rounds are a scramble for space. Data only. */

export default {
  id: 'scrapheap',
  name: 'Scrapheap',

  theme: {
    floorA:   '#332c26',
    floorB:   '#3a322a',
    wall:     '#8a7a63',
    wallTop:  '#a89478',
    wallLip:  '#5f5342',
    crate:    '#8a5a30',
    crateTop: '#a86f3c',
    crateLine:'#5f3d20'
  },

  layout: [
    '###############',
    '#1__.......__3#',
    '#__.##...##.__#',
    '#...#.....#...#',
    '#.##.......##.#',
    '#..#.......#..#',
    '#.....###.....#',
    '#..#.......#..#',
    '#.##.......##.#',
    '#...#.....#...#',
    '#__.##...##.__#',
    '#4__.......__2#',
    '###############'
  ],

  softDensity: 0.42,        // a lot more crates to dig through
  pickupChance: 0.5,        // so a few more of them hide something

  // a scrapheap turns up more bombs and more junk, and fewer clean upgrades
  powerups: { bomb:26, range:18, speed:12, shield:6, kick:12, fuse:8, skull:14, random:4 },

  roundLength: 90,
  shrinkInterval: 0.28
};
