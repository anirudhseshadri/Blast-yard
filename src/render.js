/* Draws a view object onto the canvas.

   A view is the plain data produced by game.js `buildView`, or the same shape
   unpacked from a host snapshot. The renderer never reads game state and never
   changes it, so the host and a guest draw through exactly this one path. */

import { COLS, ROWS, TS, BAR, W, H, SOLID, SOFT, SLOT_COLOR, SLOT_NAME, BUILD } from './constants.js';
import { parseLayout } from './maps/legend.js';
import { DEFAULT_MAP } from './maps/index.js';

let ctx = null;

/* The map decides the tile colours and where the special tiles are. Both are
   fixed for the whole round, so they are read once here rather than shipped
   with every snapshot. */
const DEFAULT_THEME = {
  floorA:'#2b2f3a', floorB:'#303542',
  wall:'#7c8699', wallTop:'#98a3b8', wallLip:'#5c6577',
  crate:'#7d5a3c', crateTop:'#966d48', crateLine:'#5a3f2a'
};
let theme = DEFAULT_THEME;
let specials = new Map();

export function setMap(map){
  const m = map || DEFAULT_MAP;
  theme = { ...DEFAULT_THEME, ...(m.theme||{}) };
  specials = parseLayout(m.layout, m.name).special;
}

export function attach(canvas){
  canvas.width = W; canvas.height = H;
  ctx = canvas.getContext('2d');
  setMap(DEFAULT_MAP);
}

/* Special tiles sit on open floor. A wall or a crate covers one up, and the
   closing arena turns them into walls, so this only runs on empty tiles. */
function drawSpecial(r, c, x, y){
  const s = specials.get(r+','+c);
  if(!s) return;

  if(s.kind==='water'){
    ctx.fillStyle='#2f6b8f'; ctx.fillRect(x,y,TS,TS);
    ctx.fillStyle='#3d87b3'; ctx.fillRect(x,y,TS,3);
    ctx.strokeStyle='rgba(190,230,255,.45)'; ctx.lineWidth=2; ctx.lineCap='round';
    for(const [oy,ox] of [[14,6],[26,18]]){
      ctx.beginPath();
      ctx.moveTo(x+ox, y+oy);
      ctx.quadraticCurveTo(x+ox+5, y+oy-4, x+ox+10, y+oy);
      ctx.stroke();
    }
    return;
  }

  if(s.kind==='conveyor'){
    ctx.fillStyle='#3b3f4d'; ctx.fillRect(x+1,y+1,TS-2,TS-2);
    ctx.save();
    ctx.translate(x+TS/2, y+TS/2);
    ctx.rotate(Math.atan2(s.dy, s.dx));
    ctx.strokeStyle='#ffb347'; ctx.lineWidth=2.5; ctx.lineCap='round'; ctx.lineJoin='round';
    for(const o of [-9,0,9]){                 // chevrons pointing the way it pushes
      ctx.beginPath();
      ctx.moveTo(o-4,-6); ctx.lineTo(o+3,0); ctx.lineTo(o-4,6);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  if(s.kind==='teleport'){
    ctx.fillStyle='#241b33'; ctx.fillRect(x+2,y+2,TS-4,TS-4);
    ctx.strokeStyle='#c77dff'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(x+TS/2, y+TS/2, 12, 0, 7); ctx.stroke();
    ctx.strokeStyle='rgba(199,125,255,.55)'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.arc(x+TS/2, y+TS/2, 6, 0, 7); ctx.stroke();
  }
}

function roundRect(x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
}

function drawPickup(p){
  const x=p.c*TS, y=p.r*TS+BAR;
  const bad = p.type==='skull';
  const edge = bad ? '#c77dff' : (p.type==='random' ? '#ffcf6b' : '#7fd1ff');

  ctx.fillStyle = bad ? '#2a1b33' : '#132639';
  roundRect(x+5,y+5,TS-10,TS-10,8);
  ctx.fill();
  ctx.strokeStyle=edge; ctx.lineWidth=2; ctx.stroke();

  ctx.save();
  ctx.translate(x+TS/2, y+TS/2);
  ctx.lineCap='round'; ctx.lineJoin='round';
  const ink='#e8e4d9';

  if(p.type==='bomb'){                       // one more bomb at a time
    ctx.fillStyle=ink;
    ctx.beginPath(); ctx.arc(1,2,7,0,7); ctx.fill();
    ctx.strokeStyle='#ffb347'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(5,-3); ctx.lineTo(9,-8); ctx.stroke();
    ctx.strokeStyle=ink; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(-10,-6); ctx.lineTo(-4,-6); ctx.moveTo(-7,-9); ctx.lineTo(-7,-3); ctx.stroke();
  }
  else if(p.type==='range'){                 // longer blast
    ctx.strokeStyle='#ffb347'; ctx.lineWidth=2.5;
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      ctx.beginPath(); ctx.moveTo(dx*3,dy*3); ctx.lineTo(dx*10,dy*10); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(dx*11,dy*11);
      ctx.lineTo(dx*6-dy*4, dy*6-dx*4);
      ctx.lineTo(dx*6+dy*4, dy*6+dx*4);
      ctx.closePath(); ctx.fillStyle='#ffb347'; ctx.fill();
    }
  }
  else if(p.type==='speed'){                 // move faster
    ctx.strokeStyle=ink; ctx.lineWidth=2.5;
    [-6,1].forEach(o=>{
      ctx.beginPath(); ctx.moveTo(o,-7); ctx.lineTo(o+6,0); ctx.lineTo(o,7); ctx.stroke();
    });
  }
  else if(p.type==='shield'){                // survive one blast
    ctx.fillStyle='#7fd1ff';
    ctx.beginPath();
    ctx.moveTo(0,-10); ctx.lineTo(9,-6); ctx.lineTo(9,2);
    ctx.quadraticCurveTo(9,8,0,11);
    ctx.quadraticCurveTo(-9,8,-9,2);
    ctx.lineTo(-9,-6); ctx.closePath(); ctx.fill();
  }
  else if(p.type==='kick'){                  // shove bombs down a lane
    ctx.fillStyle=ink;
    ctx.fillRect(-11,-8,5,12);
    ctx.fillRect(-11,0,11,5);
    ctx.beginPath(); ctx.arc(7,4,5,0,7); ctx.fill();
    ctx.strokeStyle='#ffb347'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(3,-6); ctx.lineTo(9,-9); ctx.moveTo(4,-2); ctx.lineTo(11,-4); ctx.stroke();
  }
  else if(p.type==='fuse'){                  // bombs go off sooner
    ctx.strokeStyle=ink; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(0,1,8,0,7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0,1); ctx.lineTo(0,-4); ctx.moveTo(0,1); ctx.lineTo(5,3); ctx.stroke();
  }
  else if(p.type==='skull'){                 // curse
    ctx.fillStyle='#e6d8f5';
    ctx.beginPath(); ctx.arc(0,-2,8,0,7); ctx.fill();
    ctx.fillRect(-5,4,10,5);
    ctx.fillStyle='#2a1b33';
    ctx.beginPath(); ctx.arc(-3.5,-3,2.4,0,7); ctx.fill();
    ctx.beginPath(); ctx.arc(3.5,-3,2.4,0,7); ctx.fill();
    ctx.fillRect(-1,1,2,3);
    ctx.strokeStyle='#2a1b33'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(-2,4); ctx.lineTo(-2,9); ctx.moveTo(2,4); ctx.lineTo(2,9); ctx.stroke();
  }
  else {                                     // random
    ctx.fillStyle='#ffcf6b';
    ctx.font='bold 22px Rockwell,Georgia,serif';
    ctx.textAlign='center'; ctx.fillText('?',0,8); ctx.textAlign='left';
  }
  ctx.restore();
}

/* `hint` is the line under the end-of-round message. The caller decides what
   it says, because the renderer does not know whether this browser is hosting. */
export function draw(v, hint=''){
  if(!ctx) return;
  ctx.clearRect(0,0,W,H);

  // hud
  ctx.fillStyle='#161923'; ctx.fillRect(0,0,W,BAR);
  ctx.fillStyle='#0d0f16'; ctx.fillRect(0,BAR-2,W,2);
  v.players.forEach((p,i)=>{
    const x=14+i*88;
    ctx.globalAlpha = p.alive?1:0.3;
    ctx.fillStyle=SLOT_COLOR[p.slot];
    ctx.beginPath(); ctx.arc(x,BAR/2,9,0,7); ctx.fill();
    ctx.globalAlpha=1;
    ctx.fillStyle = p.alive?'#c9d1e0':'#5a6274';
    ctx.font='14px system-ui,sans-serif';
    ctx.fillText(p.alive?SLOT_NAME[p.slot]:'out', x+15, BAR/2+5);
  });
  const t=Math.ceil(v.time);
  ctx.font='bold 20px ui-monospace,Menlo,monospace';
  ctx.fillStyle = v.closing?'#ff6b6b':'#ffcf6b';
  ctx.textAlign='right';
  ctx.fillText(v.closing?'CLOSING':(Math.floor(t/60)+':'+String(t%60).padStart(2,'0')), W-14, BAR/2+7);
  ctx.textAlign='left';

  // floor, blocks and the map's own tiles
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
    const x=c*TS, y=r*TS+BAR, t=v.grid[r][c];
    ctx.fillStyle = (r+c)%2 ? theme.floorA : theme.floorB;
    ctx.fillRect(x,y,TS,TS);
    if(t===SOLID){
      ctx.fillStyle=theme.wall;    ctx.fillRect(x+2,y+2,TS-4,TS-4);
      ctx.fillStyle=theme.wallTop; ctx.fillRect(x+2,y+2,TS-4,6);
      ctx.fillStyle=theme.wallLip; ctx.fillRect(x+2,y+TS-8,TS-4,6);
    }else if(t===SOFT){
      ctx.fillStyle=theme.crate;    ctx.fillRect(x+3,y+3,TS-6,TS-6);
      ctx.fillStyle=theme.crateTop; ctx.fillRect(x+3,y+3,TS-6,5);
      ctx.strokeStyle=theme.crateLine; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(x+3,y+TS/2); ctx.lineTo(x+TS-3,y+TS/2); ctx.stroke();
    }else{
      drawSpecial(r,c,x,y);
    }
  }

  // pickups
  v.pickups.forEach(drawPickup);

  // bombs
  v.bombs.forEach(b=>{
    const pulse = 1 + 0.12*Math.sin(performance.now()/90);
    ctx.fillStyle='#14161d';
    ctx.beginPath(); ctx.arc(b.x, b.y+BAR, 13*pulse, 0, 7); ctx.fill();
    ctx.strokeStyle='#ffb347'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(b.x+6,b.y+BAR-10); ctx.lineTo(b.x+12,b.y+BAR-17); ctx.stroke();
  });

  // flames
  v.flames.forEach(f=>{
    const x=f.c*TS, y=f.r*TS+BAR;
    ctx.fillStyle='#ff9e3d'; ctx.fillRect(x+2,y+2,TS-4,TS-4);
    ctx.fillStyle='#ffe27a'; ctx.fillRect(x+8,y+8,TS-16,TS-16);
  });

  // players
  v.players.forEach(p=>{
    if(!p.alive) return;
    const y=p.y+BAR;
    ctx.fillStyle='rgba(0,0,0,.35)';
    ctx.beginPath(); ctx.ellipse(p.x,y+13,12,5,0,0,7); ctx.fill();
    ctx.fillStyle=SLOT_COLOR[p.slot];
    ctx.fillRect(p.x-14,y-15,28,29);
    ctx.fillStyle='#1b1e27';
    ctx.fillRect(p.x-8,y-9,16,8);
    if(p.shield){
      ctx.strokeStyle='#7fd1ff'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(p.x,y,18,0,7); ctx.stroke();
    }
    if(p.curse){
      ctx.fillStyle='#c77dff'; ctx.font='12px system-ui,sans-serif'; ctx.textAlign='center';
      ctx.fillText('drunk', p.x, y-20); ctx.textAlign='left';
    }
  });

  ctx.fillStyle='#4a5266'; ctx.font='11px system-ui,sans-serif';
  ctx.fillText(BUILD, 6, H-6);

  if(v.msg){
    ctx.fillStyle='rgba(10,12,18,.78)'; ctx.fillRect(0,BAR,W,H-BAR);
    ctx.fillStyle='#ffcf6b'; ctx.font='bold 34px Rockwell,Georgia,serif'; ctx.textAlign='center';
    ctx.fillText(v.msg, W/2, H/2);
    ctx.fillStyle='#9aa3b8'; ctx.font='15px system-ui,sans-serif';
    ctx.fillText(hint, W/2, H/2+30);
    ctx.textAlign='left';
  }
}

/* Guests get about 20 snapshots a second. Move the drawn players toward the
   latest snapshot instead of teleporting them, so movement still looks smooth. */
export function smooth(lerpView, view, dt){
  if(!lerpView) return JSON.parse(JSON.stringify(view));
  lerpView.grid=view.grid; lerpView.bombs=view.bombs; lerpView.flames=view.flames;
  lerpView.pickups=view.pickups; lerpView.time=view.time; lerpView.closing=view.closing; lerpView.msg=view.msg;
  const k=Math.min(1,dt*18);
  view.players.forEach((p,i)=>{
    const l=lerpView.players[i];
    if(!l){ lerpView.players[i]={...p}; return; }
    l.x+=(p.x-l.x)*k; l.y+=(p.y-l.y)*k;
    l.alive=p.alive; l.shield=p.shield; l.curse=p.curse; l.slot=p.slot; l.kick=p.kick;
  });
  lerpView.players.length=view.players.length;
  return lerpView;
}
