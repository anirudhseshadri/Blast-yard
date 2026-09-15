/* PeerJS host and guest, plus snapshot packing.

   How it works: one browser hosts and runs the whole simulation. Guests send
   only their {u,d,l,r,b,k} input and draw the snapshots the host sends back
   about 20 times a second. There is no server. The room code is the PeerJS id.

   Messages the host sends out:
     {k:'lobby', ...}  who is in the room, their names, ready flags and scores
     {k:'go'}          the match is starting
     {k:'full'}        no room left, you are about to be hung up on
     {k:'s', ...}      a snapshot of the world, during a match
     {k:'slot', slot}  sent once, privately, when a guest connects

   Messages a guest sends back:
     {k:'i', i:{...}} its input
     {k:'name', name}  the name it typed
     {k:'ready', ready}  its ready toggle

   This module knows nothing about the canvas or the menu. It reports what
   happened through the callbacks its caller passes in. */

import { COLS, ROWS, PU } from './constants.js';

const ID_PREFIX = 'blastyard-';
const CODE_LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';  // no I, L, O, 0 or 1

export function makeCode(){
  return Array.from({length:5},()=>CODE_LETTERS[Math.floor(Math.random()*CODE_LETTERS.length)]).join('');
}

/* PeerJS arrives from a CDN, so it may not be there yet (or at all). */
export function peerReady(){
  return typeof Peer !== 'undefined';
}

/* ---------------- snapshot format ---------------- */

/* Short keys and rounded numbers, because this goes out 20 times a second.
   The grid ships as one string of digits, one character per tile. */
export function packet(v){
  return JSON.stringify({
    k:'s',
    g:v.grid.map(row=>row.join('')).join(''),
    p:v.players.map(p=>[p.slot, Math.round(p.x), Math.round(p.y), p.alive?1:0, p.shield?1:0, p.curse?1:0, p.kick?1:0]),
    b:v.bombs.map(b=>[Math.round(b.x),Math.round(b.y)]),
    f:v.flames.map(f=>[f.r,f.c]),
    u:v.pickups.map(p=>[p.r,p.c,PU.indexOf(p.type)]),
    t:Math.round(v.time), c:v.closing?1:0, m:v.msg
  });
}

export function unpack(s){
  const d=JSON.parse(s);
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

/* ---------------- host ---------------- */

/* Callbacks:
     onOpen(code)        the room is live and guests can connect
     onError(peerError)  PeerJS gave up
     onJoin(peerId)      someone connected. Return the slot number to give
                         them, or null to turn them away. The caller owns the
                         player list, so it decides.
     onLeave(peerId)     someone dropped
     onInput(peerId, input)    a guest pressed something
     onName(peerId, name)      a guest typed a name
     onReady(peerId, ready)    a guest toggled ready
   Returns the handle the game loop uses to push snapshots out. */
export function createHost({ onOpen, onError, onJoin, onLeave, onInput, onName, onReady }){
  let peer=null, conns=[], code='';

  function open(){
    code = makeCode();
    peer = new Peer(ID_PREFIX+code, {debug:0});
    peer.on('open',()=>onOpen(code));
    peer.on('error',e=>{
      // that code is already taken by another room, so pick a new one
      if(String(e).includes('unavailable')){ open(); return; }
      onError(e);
    });
    peer.on('connection',conn=>{
      conn.on('open',()=>{
        // Register the connection before asking for a slot. onJoin broadcasts
        // the updated lobby, and the guest that just arrived has to be on the
        // list to receive it -- that packet is what opens its lobby screen.
        conns.push(conn);
        const slot = onJoin(conn.peer);
        if(slot==null){                           // room is full
          conns = conns.filter(c=>c!==conn);
          // say why before hanging up, or the guest just sees a dropped host
          conn.send(JSON.stringify({k:'full'}));
          setTimeout(()=>conn.close(), 250);
          return;
        }
        conn.send(JSON.stringify({k:'slot',slot}));
      });
      conn.on('data',raw=>{
        const d=JSON.parse(raw);
        if(d.k==='i') onInput(conn.peer, {u:d.i.u,d:d.i.d,l:d.i.l,r:d.i.r,b:d.i.b,k:d.i.k||0});
        else if(d.k==='name') onName(conn.peer, String(d.name||'').slice(0,12));
        else if(d.k==='ready') onReady(conn.peer, !!d.ready);
      });
      conn.on('close',()=>{
        conns=conns.filter(c=>c!==conn);
        onLeave(conn.peer);
      });
    });
  }
  open();

  return {
    get code(){ return code; },
    broadcast(v){
      const msg=packet(v);
      conns.forEach(c=>{ if(c.open) c.send(msg); });
    },
    send(obj){
      const msg=JSON.stringify(obj);
      conns.forEach(c=>{ if(c.open) c.send(msg); });
    }
  };
}

/* ---------------- guest ---------------- */

/* Callbacks:
     onOpen(myId)        connected to the host. myId is this browser's peer id,
                         which is how you find yourself in a lobby packet
     onSlot(slot)        the host says you are this player
     onLobby(state)      the shared lobby. Arriving means you are in the lobby,
                         either before the first round or back after one
     onStart()           the host started the match
     onSnapshot(view)    a fresh picture of the world
     onFull()            the room was already full, so you were turned away
     onClose()           the host went away
     onError(peerError)  could not connect */
export function createGuest(code, { onOpen, onSlot, onLobby, onStart, onSnapshot, onFull, onClose, onError }){
  const peer = new Peer({debug:0});
  let hostConn=null, lastSent='', turnedAway=false;

  peer.on('open',()=>{
    // unreliable mode: a dropped input or snapshot is better than a stalled queue
    hostConn = peer.connect(ID_PREFIX+code, {reliable:false});
    hostConn.on('open',()=>onOpen(peer.id));
    hostConn.on('data',raw=>{
      const d=JSON.parse(raw);
      if(d.k==='slot') onSlot(d.slot);
      else if(d.k==='full'){ turnedAway=true; onFull(); }
      else if(d.k==='lobby') onLobby(d);
      else if(d.k==='go') onStart();
      else if(d.k==='s') onSnapshot(unpack(raw));
    });
    hostConn.on('close',()=>{ if(!turnedAway) onClose(); });
  });
  peer.on('error',onError);

  return {
    /* Only send when something actually changed.

       The input goes in its own field rather than being spread across the
       message. Input has a `k` of its own (the kick key) and spreading it
       here overwrote `k:'i'`, the message kind, with 0 or 1 -- so the host
       dropped every input a guest ever sent. */
    sendInput(inp){
      const s=JSON.stringify(inp);
      if(s===lastSent || !hostConn || !hostConn.open) return;
      lastSent=s;
      hostConn.send(JSON.stringify({k:'i', i:inp}));
    },
    /* Lobby chatter: a typed name, a ready toggle. */
    send(obj){
      if(!hostConn || !hostConn.open) return;
      hostConn.send(JSON.stringify(obj));
    }
  };
}
