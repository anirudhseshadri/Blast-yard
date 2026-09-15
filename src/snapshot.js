/* The snapshot format, shared by the server that sends it and the client that
   draws it. No DOM and no transport in here, so the same file runs in Node and
   in the browser.

   Short keys and rounded numbers, because this goes out 20 times a second. The
   grid ships as one string of digits, one character per tile.

   The packed object keeps its own `t` for the clock, so transports must nest it
   (`{t:'snap', s:pack(view)}`) rather than spread it. Spreading would let the
   clock overwrite the message type. */

import { COLS, ROWS, PU } from './constants.js';

export function pack(v){
  return {
    g:v.grid.map(row=>row.join('')).join(''),
    p:v.players.map(p=>[p.slot, Math.round(p.x), Math.round(p.y), p.alive?1:0, p.shield?1:0, p.curse?1:0, p.kick?1:0]),
    b:v.bombs.map(b=>[Math.round(b.x),Math.round(b.y)]),
    f:v.flames.map(f=>[f.r,f.c]),
    u:v.pickups.map(p=>[p.r,p.c,PU.indexOf(p.type)]),
    t:Math.round(v.time), c:v.closing?1:0, m:v.msg
  };
}

export function unpack(d){
  const grid=[];
  for(let r=0;r<ROWS;r++){
    grid[r]=[];
    for(let c=0;c<COLS;c++) grid[r][c]=+d.g[r*COLS+c];
  }
  return {
    grid,
    players:d.p.map(a=>({slot:a[0],x:a[1],y:a[2],alive:!!a[3],shield:!!a[4],curse:!!a[5],kick:!!a[6]})),
    bombs:d.b.map(a=>({x:a[0],y:a[1]})),
    flames:d.f.map(a=>({r:a[0],c:a[1]})),
    pickups:d.u.map(a=>({r:a[0],c:a[1],type:PU[a[2]]})),
    time:d.t, closing:!!d.c, msg:d.m
  };
}
