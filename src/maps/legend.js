/* Reading a typed map layout.

   A layout is one string per row, one character per tile, so a new map is
   something you draw in a text editor rather than describe in code:

       #  a solid wall, never destroyed
       .  floor that may grow a soft block
       _  floor that never grows one, for keeping a lane or a spawn open
       1  2  3  4   where each player starts, in slot order
       ~  water: you can walk it, but bombs cannot be planted on it and
          blasts will not cross it
       ^  v  <  >   a conveyor, pushing whatever stands on it that way
       A..Z  a teleport pad. The same letter twice makes a pair.

   Nothing here draws or simulates. It turns characters into data that both
   the game and the renderer read. */

import { COLS, ROWS, EMPTY, SOLID } from '../constants.js';

export const WALL = '#', FLOOR = '.', OPEN = '_', WATER = '~';

const CONVEYORS = { '^':[0,-1], 'v':[0,1], '<':[-1,0], '>':[1,0] };
const SPAWNS = '1234';
const PAD = /^[A-Z]$/;

/* Turn a layout into the pieces the rest of the game needs. Returns a fresh
   grid every time, so each round can dig up its own copy. */
export function parseLayout(layout, name='map'){
  const fail = msg => { throw new Error(`${name}: ${msg}`); };

  if(!Array.isArray(layout) || layout.length !== ROWS){
    fail(`layout has ${layout ? layout.length : 0} rows, expected ${ROWS}`);
  }

  const grid = [];
  const soft = [];                 // tiles allowed to grow a soft block
  const spawns = [];
  const special = new Map();       // 'r,c' -> {kind, ...}
  const pads = new Map();          // letter -> [[r,c], ...]

  for(let r=0;r<ROWS;r++){
    const row = layout[r];
    if(typeof row !== 'string' || row.length !== COLS){
      fail(`row ${r} is ${row ? row.length : 0} tiles wide, expected ${COLS}`);
    }
    grid[r] = [];
    for(let c=0;c<COLS;c++){
      const ch = row[c];
      const key = r+','+c;
      grid[r][c] = ch===WALL ? SOLID : EMPTY;

      if(ch===WALL || ch===OPEN) continue;
      if(ch===FLOOR){ soft.push([r,c]); continue; }
      if(ch===WATER){ special.set(key,{kind:'water'}); continue; }

      const push = CONVEYORS[ch];
      if(push){ special.set(key,{kind:'conveyor', dx:push[0], dy:push[1]}); continue; }

      if(SPAWNS.includes(ch)){
        const slot = SPAWNS.indexOf(ch);
        if(spawns[slot]) fail(`two tiles are marked "${ch}"`);
        spawns[slot] = [r,c];
        continue;
      }

      if(PAD.test(ch)){
        if(!pads.has(ch)) pads.set(ch, []);
        pads.get(ch).push([r,c]);
        continue;
      }

      fail(`row ${r} has "${ch}", which is not a tile this format knows`);
    }
  }

  for(let slot=0; slot<4; slot++){
    if(!spawns[slot]) fail(`no "${SPAWNS[slot]}" tile, so player ${slot+1} has nowhere to start`);
  }

  // a pad with nowhere to send you is almost certainly a typo
  for(const [letter, found] of pads){
    if(found.length !== 2){
      fail(`teleport "${letter}" appears ${found.length} time${found.length===1?'':'s'}, and a pair needs exactly two`);
    }
    const [a, b] = found;
    special.set(a[0]+','+a[1], {kind:'teleport', to:b});
    special.set(b[0]+','+b[1], {kind:'teleport', to:a});
  }

  return { grid, soft, spawns, special };
}

/* Read a map once at startup so a typo shows up immediately rather than
   halfway through a round. */
export function checkMap(map){
  if(!map.id) throw new Error('a map needs an id');
  if(!map.name) throw new Error(`${map.id}: a map needs a name`);
  parseLayout(map.layout, map.name);
  return map;
}
