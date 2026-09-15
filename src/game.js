/* Rules and simulation only.

   Nothing in here touches the DOM, the canvas or the network. Every function
   takes the game state `G` as its first argument, so the same code can run on
   a host browser today and on a server later without changes. */

import { COLS, ROWS, TS, EMPTY, SOLID, SOFT, PU, PU_WEIGHT, SLOT_NAME } from './constants.js';
import { DEFAULT_MAP } from './maps/index.js';

/* ---------------- setup ---------------- */

export function newGame(playerDefs, map = DEFAULT_MAP){
  const grid = [];
  for(let r=0;r<ROWS;r++){
    grid[r]=[];
    for(let c=0;c<COLS;c++){
      const edge = r===0||c===0||r===ROWS-1||c===COLS-1;
      const pillar = r%2===0 && c%2===0;
      grid[r][c] = (edge||pillar) ? SOLID : EMPTY;
    }
  }
  const spawns = map.spawns;
  const safe = new Set();
  spawns.forEach(([r,c])=>{
    map.spawnClearance.forEach(([dr,dc])=>{
      const rr=r+dr, cc=c+dc;
      if(grid[rr] && grid[rr][cc]===EMPTY) safe.add(rr+','+cc);
    });
  });

  const pickups = new Map();
  for(let r=1;r<ROWS-1;r++) for(let c=1;c<COLS-1;c++){
    if(grid[r][c]!==EMPTY) continue;
    if(safe.has(r+','+c)) continue;
    if(Math.random()<map.softDensity){
      grid[r][c]=SOFT;
      if(Math.random()<map.pickupChance) pickups.set(r+','+c,{type:weighted(),hidden:true});
    }
  }

  const players = playerDefs.map((d,i)=>({
    slot:i, name:d.name, peer:d.peer||null,
    x:(spawns[i][1]+0.5)*TS, y:(spawns[i][0]+0.5)*TS,
    alive:true, maxBombs:1, range:2, speedLv:0, shield:false, kick:false,
    fuse:2.6, curse:0, live:0, inv:0, face:{x:0,y:1},
    input:{u:0,d:0,l:0,r:0,b:0,k:0}, bombEdge:false, kickEdge:false, passing:new Set()
  }));

  return {
    map, grid, pickups, players,
    bombs:[], flames:[], bombId:1,
    time:map.roundLength, phase:'play', over:'', winner:null, shrinkStep:0, shrinkT:0,
    spiral: makeSpiral()
  };
}

export function restart(G){
  const defs = G.players.map(p=>({name:p.name, peer:p.peer}));
  return newGame(defs, G.map);
}

function weighted(){
  const total = PU_WEIGHT.reduce((a,b)=>a+b,0);
  let n = Math.random()*total;
  for(let i=0;i<PU.length;i++){ n-=PU_WEIGHT[i]; if(n<=0) return PU[i]; }
  return 'bomb';
}

function makeSpiral(){
  const out=[];
  let top=1,bot=ROWS-2,left=1,right=COLS-2;
  while(top<=bot && left<=right){
    for(let c=left;c<=right;c++) out.push([top,c]);
    for(let r=top+1;r<=bot;r++) out.push([r,right]);
    if(top<bot) for(let c=right-1;c>=left;c--) out.push([bot,c]);
    if(left<right) for(let r=bot-1;r>top;r--) out.push([r,left]);
    top++;bot--;left++;right--;
  }
  return out;
}

/* ---------------- collision helpers ---------------- */

function blockedTile(G,r,c){
  if(r<0||c<0||r>=ROWS||c>=COLS) return true;
  return G.grid[r][c]!==EMPTY;
}

function bombAt(G,r,c){
  return G.bombs.find(b=> Math.floor(b.y/TS)===r && Math.floor(b.x/TS)===c);
}

function canStand(G,p,x,y){
  const half=14;
  for(const [ox,oy] of [[-half,-half],[half,-half],[-half,half],[half,half]]){
    const c=Math.floor((x+ox)/TS), r=Math.floor((y+oy)/TS);
    if(blockedTile(G,r,c)) return false;
    const b=bombAt(G,r,c);
    if(b && !p.passing.has(b.id)) return false;
  }
  // other players are solid. if you are somehow already overlapping one,
  // ignore it so you can separate instead of both being frozen.
  for(const o of G.players){
    if(o===p || !o.alive) continue;
    const already = Math.abs(o.x-p.x)<26 && Math.abs(o.y-p.y)<26;
    if(already) continue;
    if(Math.abs(o.x-x)<26 && Math.abs(o.y-y)<26) return false;
  }
  return true;
}

/* ---------------- one tick ---------------- */

export function step(G, dt){
  if(G.phase==='over') return;

  // clock and closing walls
  if(G.time>0){
    G.time-=dt;
  }else{
    G.shrinkT+=dt;
    while(G.shrinkT>G.map.shrinkInterval && G.shrinkStep<G.spiral.length){
      G.shrinkT-=G.map.shrinkInterval;
      const [r,c]=G.spiral[G.shrinkStep++];
      G.grid[r][c]=SOLID;
      G.pickups.delete(r+','+c);
      G.bombs = G.bombs.filter(b=> !(Math.floor(b.y/TS)===r && Math.floor(b.x/TS)===c));
      G.players.forEach(p=>{
        if(p.alive && Math.floor(p.y/TS)===r && Math.floor(p.x/TS)===c) kill(p);
      });
    }
  }

  for(const p of G.players){
    if(!p.alive) continue;
    if(p.curse>0) p.curse-=dt;
    if(p.inv>0) p.inv-=dt;

    let {u,d,l,r,b}=p.input;
    if(p.curse>0){ [u,d]=[d,u]; [l,r]=[r,l]; }

    moveP(G,p,{u,d,l,r},dt);

    if(p.input.k && !p.kickEdge) doKick(G,p);
    p.kickEdge = !!p.input.k;

    // a bomb you just dropped stays walk-through until your whole body is off its tile
    for(const id of Array.from(p.passing)){
      const bb = G.bombs.find(x=>x.id===id);
      if(!bb){ p.passing.delete(id); continue; }
      const bc=Math.floor(bb.x/TS), br=Math.floor(bb.y/TS);
      const overlap = (p.x+14 > bc*TS) && (p.x-14 < (bc+1)*TS) &&
                      (p.y+14 > br*TS) && (p.y-14 < (br+1)*TS);
      if(!overlap) p.passing.delete(id);
    }

    if(b && !p.bombEdge) plant(G,p);
    p.bombEdge = !!b;

    // pick up
    const key = Math.floor(p.y/TS)+','+Math.floor(p.x/TS);
    const pk = G.pickups.get(key);
    if(pk && !pk.hidden){ G.pickups.delete(key); grant(p, pk.type); }
  }

  // bombs
  for(const b of G.bombs){
    if(b.vx||b.vy){
      const nx=b.x+b.vx*dt, ny=b.y+b.vy*dt;
      const lx=nx+Math.sign(b.vx)*(TS/2-1), ly=ny+Math.sign(b.vy)*(TS/2-1);
      const r=Math.floor(ly/TS), c=Math.floor(lx/TS);
      const hitPlayer = G.players.some(p=>p.alive && Math.abs(p.x-lx)<18 && Math.abs(p.y-ly)<18);
      const other = G.bombs.find(o=>o!==b && Math.floor(o.y/TS)===r && Math.floor(o.x/TS)===c);
      if(blockedTile(G,r,c) || other || hitPlayer){
        b.x=(Math.round((b.x-TS/2)/TS)+0.5)*TS; b.y=(Math.round((b.y-TS/2)/TS)+0.5)*TS;
        b.vx=b.vy=0;
      }else{ b.x=nx; b.y=ny; }
    }
    b.fuse-=dt;
  }
  let guard=0;
  while(G.bombs.some(b=>b.fuse<=0) && guard++<40){
    const b=G.bombs.find(x=>x.fuse<=0);
    detonate(G,b);
  }

  // flames
  for(const f of G.flames) f.t-=dt;
  G.flames = G.flames.filter(f=>f.t>0);

  for(const p of G.players){
    if(!p.alive || p.inv>0) continue;
    const r=Math.floor(p.y/TS), c=Math.floor(p.x/TS);
    if(G.flames.some(f=>f.r===r && f.c===c)){
      if(p.shield){ p.shield=false; p.inv=1.6; }
      else kill(p);
    }
  }

  const alive = G.players.filter(p=>p.alive);
  if(G.players.length>1 && alive.length<=1){
    G.phase='over';
    G.winner = alive.length===1 ? alive[0].slot : null;
    G.over = alive.length===1 ? displayName(alive[0])+' wins' : 'Everyone blew up';
  }else if(G.players.length===1 && alive.length===0){
    G.phase='over'; G.winner=null; G.over='You blew yourself up';
  }
}

function moveP(G, p, dir, dt){
  const sp = (108 + p.speedLv*26) * dt;
  let dx = dir.r - dir.l, dy = dir.d - dir.u;
  if(dx && dy){ if(canStand(G, p, p.x+dx*sp, p.y)) dy=0; else dx=0; }
  if(!dx && !dy) return;

  p.face = {x:dx, y:dy};

  if(dx){
    // pull toward the middle of the row so you never snag on a corner
    const cy=(Math.floor(p.y/TS)+0.5)*TS, off=cy-p.y;
    if(Math.abs(off)>0.6){
      const s=Math.sign(off)*Math.min(Math.abs(off),sp);
      if(canStand(G,p,p.x,p.y+s)) p.y+=s;
    }
    if(canStand(G,p,p.x+dx*sp,p.y)) p.x+=dx*sp;
  }else{
    const cx=(Math.floor(p.x/TS)+0.5)*TS, off=cx-p.x;
    if(Math.abs(off)>0.6){
      const s=Math.sign(off)*Math.min(Math.abs(off),sp);
      if(canStand(G,p,p.x+s,p.y)) p.x+=s;
    }
    if(canStand(G,p,p.x,p.y+dy*sp)) p.y+=dy*sp;
  }
}

function doKick(G,p){
  if(!p.kick) return;
  const r=Math.floor(p.y/TS)+p.face.y, c=Math.floor(p.x/TS)+p.face.x;
  const b=bombAt(G,r,c);
  if(!b || b.vx || b.vy) return;
  b.vx=p.face.x*200; b.vy=p.face.y*200;
  G.players.forEach(pl=>pl.passing.delete(b.id));
}

function plant(G,p){
  if(p.live>=p.maxBombs) return;
  const r=Math.floor(p.y/TS), c=Math.floor(p.x/TS);
  if(bombAt(G,r,c)) return;
  const b={id:G.bombId++, x:(c+0.5)*TS, y:(r+0.5)*TS, owner:p.slot, fuse:p.fuse, range:p.range, vx:0, vy:0};
  G.bombs.push(b);
  p.live++;
  p.passing.add(b.id);
}

function detonate(G,b){
  G.bombs = G.bombs.filter(x=>x!==b);
  const owner = G.players.find(p=>p.slot===b.owner);
  if(owner) owner.live=Math.max(0,owner.live-1);

  const r=Math.floor(b.y/TS), c=Math.floor(b.x/TS);
  flame(G,r,c);
  for(const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]){
    for(let i=1;i<=b.range;i++){
      const rr=r+dr*i, cc=c+dc*i;
      if(rr<0||cc<0||rr>=ROWS||cc>=COLS) break;
      const t=G.grid[rr][cc];
      if(t===SOLID) break;
      flame(G,rr,cc);
      if(t===SOFT){
        G.grid[rr][cc]=EMPTY;
        const pk=G.pickups.get(rr+','+cc);
        if(pk) pk.hidden=false;
        break;
      }
      const chain=bombAt(G,rr,cc);
      if(chain) chain.fuse=0;
    }
  }
}

function flame(G,r,c){
  const f=G.flames.find(x=>x.r===r&&x.c===c);
  if(f) f.t=Math.max(f.t,0.45); else G.flames.push({r,c,t:0.45});
  const key=r+','+c;
  const pk=G.pickups.get(key);
  if(pk && !pk.hidden) G.pickups.delete(key);
}

function grant(p,type){
  if(type==='random'){
    if(Math.random()<0.15){ p.maxBombs=1; p.range=2; p.speedLv=0; p.kick=false; p.shield=false; p.fuse=2.6; return; }
    type = PU[Math.floor(Math.random()*(PU.length-1))];
    if(type==='skull') type='range';
  }
  if(type==='bomb')   p.maxBombs=Math.min(4,p.maxBombs+1);
  if(type==='range')  p.range=Math.min(8,p.range+1);
  if(type==='speed')  p.speedLv=Math.min(3,p.speedLv+1);
  if(type==='shield') p.shield=true;
  if(type==='kick')   p.kick=true;
  if(type==='fuse')   p.fuse=Math.max(1.2,p.fuse-0.5);
  if(type==='skull')  p.curse=8;
}

function kill(p){ p.alive=false; }

/* Players type their own name online. Local play falls back to the slot colour. */
function displayName(p){
  return p.name || SLOT_NAME[p.slot];
}

/* ---------------- what the renderer and the network see ---------------- */

export function buildView(G){
  return {
    grid:G.grid,
    players:G.players.map(p=>({slot:p.slot,x:p.x,y:p.y,alive:p.alive,shield:p.shield||p.inv>0,curse:p.curse>0,kick:p.kick})),
    bombs:G.bombs.map(b=>({x:b.x,y:b.y,fuse:b.fuse})),
    flames:G.flames.map(f=>({r:f.r,c:f.c})),
    pickups:[...G.pickups].filter(([,v])=>!v.hidden).map(([k,v])=>{
      const [r,c]=k.split(',').map(Number); return {r,c,type:v.type};
    }),
    time:Math.max(0,G.time), closing:G.time<=0, msg:G.phase==='over'?G.over:''
  };
}

/* Blocks drawn behind the menu before a match starts. */
export function idleView(){
  return {
    grid: Array.from({length:ROWS},(_,r)=>Array.from({length:COLS},(_,c)=>
      (r===0||c===0||r===ROWS-1||c===COLS-1||(r%2===0&&c%2===0))?SOLID:(Math.random()<0.7?SOFT:EMPTY))),
    players:[], bombs:[], flames:[], pickups:[], time:120, closing:false, msg:''
  };
}
