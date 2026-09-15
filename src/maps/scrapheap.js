/* Scrapheap: packed with crates and a shorter clock, so rounds are a scramble
   for space. Same wall layout as the yard. Data only. */

import YARD from './yard.js';

export default {
  id: 'scrapheap',
  name: 'Scrapheap',

  softDensity: 0.42,        // a lot more crates to dig through
  pickupChance: 0.5,        // so a few more of them hide something

  spawns: YARD.spawns,
  spawnClearance: YARD.spawnClearance,

  roundLength: 90,          // shorter round
  shrinkInterval: 0.28
};
