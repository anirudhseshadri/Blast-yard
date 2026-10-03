/* The map list the lobby picker offers.

   Adding a map is one file plus one line here. See legend.js for what each
   character in a layout means.

   Every map is read once on startup, so a mistyped layout fails loudly here
   rather than halfway through a round. */

import { checkMap } from './legend.js';
import yard from './yard.js';
import scrapheap from './scrapheap.js';
import waterworks from './waterworks.js';
import frozenpond from './frozenpond.js';
import mineshaft from './mineshaft.js';

export const MAPS = [yard, scrapheap, waterworks, frozenpond, mineshaft].map(checkMap);
export const DEFAULT_MAP = yard;

export function mapById(id){
  return MAPS.find(m=>m.id===id) || DEFAULT_MAP;
}
