/* Long Yard: open floor and a slow clock. Fewer crates means fewer powerups,
   so rounds come down to position rather than pickups. Data only. */

import YARD from './yard.js';

export default {
  id: 'longyard',
  name: 'Long Yard',

  softDensity: 0.15,        // open floor, room to run
  pickupChance: 0.6,        // fewer crates, so a better chance each one pays

  spawns: YARD.spawns,
  spawnClearance: YARD.spawnClearance,

  roundLength: 150,         // longer round
  shrinkInterval: 0.22      // but the walls close faster once it runs out
};
