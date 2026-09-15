/* The map list the lobby picker offers.

   Adding a map is one file plus one line here. The format is still the simple
   one the prototype needed; Task 3 in BRIEF.md replaces it with typed layouts,
   tile themes, special tiles and per-map powerup weights. */

import yard from './yard.js';
import scrapheap from './scrapheap.js';
import longyard from './longyard.js';

export const MAPS = [yard, scrapheap, longyard];
export const DEFAULT_MAP = yard;

export function mapById(id){
  return MAPS.find(m=>m.id===id) || DEFAULT_MAP;
}
