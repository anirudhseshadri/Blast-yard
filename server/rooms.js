/* Rooms: the server's copy of a match.

   A room owns its lobby and, once started, the whole simulation. It imports
   the same `src/game.js` the browser used to run, so the rules are the rules
   wherever they execute. Nothing here knows about sockets; the caller hands in
   a `send` function per player and calls `tick` on a timer. */

import { newGame, step, buildView } from '../src/game.js';
import { mapById, DEFAULT_MAP } from '../src/maps/index.js';
import { pack } from '../src/snapshot.js';

export const MAX_PLAYERS = 4;
export const MAX_ROOMS = 50;
const SNAPSHOT_INTERVAL = 0.05;   // seconds, so 20 a second
const ROUND_END_PAUSE = 4;        // seconds the result shows before the lobby returns
const START_COUNTDOWN = 3;        // seconds between "start" and the first tick
const EMPTY_ROOM_TTL = 60000;     // a room dies a minute after its last player leaves
const CODE_LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   // no I, L, O, 0 or 1

export function makeCode(){
  return Array.from({length:5},()=>CODE_LETTERS[Math.floor(Math.random()*CODE_LETTERS.length)]).join('');
}

export function createRoom(code){
  return {
    code,
    players: [],          // {slot, name, ready, owner, wins, input, send}
    mapId: DEFAULT_MAP.id,
    phase: 'lobby',       // lobby | starting | playing | ended
    G: null,
    last: 0,              // timestamp of the previous tick
    snapT: 0,             // seconds since the last snapshot went out
    endT: 0,              // seconds left on the result screen
    startAt: 0,           // when the countdown finishes
    emptySince: Date.now()
  };
}

/* ---------------- lobby ---------------- */

function freeSlot(room){
  const used = new Set(room.players.map(p=>p.slot));
  for(let i=0;i<MAX_PLAYERS;i++) if(!used.has(i)) return i;
  return null;
}

/* Slots pick the spawn corner and the colour, and a new match needs them to
   run 0,1,2..., so close the gaps left by anyone who quit. Only safe in the
   lobby: mid-match the slots have to keep matching the live game. */
function compactSlots(room){
  room.players.sort((a,b)=>a.slot-b.slot).forEach((p,i)=>{ p.slot=i; });
}

export function addPlayer(room, name, send){
  if(room.phase!=='lobby') return { error:'That match has already started.' };
  const slot = freeSlot(room);
  if(slot===null) return { error:'That room is full. Four players is the limit.' };

  const player = {
    slot, name: cleanName(name), ready:false,
    owner: room.players.length===0,
    wins:0, input:{u:0,d:0,l:0,r:0,b:0,k:0}, send
  };
  room.players.push(player);
  compactSlots(room);
  room.emptySince = null;
  return { player };
}

export function removePlayer(room, player){
  // mid-match the body stays on the board and simply stops moving
  if(room.G){
    const p = room.G.players.find(x=>x.slot===player.slot);
    if(p) p.alive = false;
  }
  room.players = room.players.filter(p=>p!==player);
  if(room.phase==='lobby') compactSlots(room);

  // somebody has to be able to press start
  if(player.owner && room.players.length){
    room.players.sort((a,b)=>a.slot-b.slot)[0].owner = true;
  }
  if(!room.players.length) room.emptySince = Date.now();
}

export function cleanName(name){
  return String(name||'').replace(/\s+/g,' ').trim().slice(0,12);
}

export function readyCount(room){
  return room.players.filter(p=>p.ready).length;
}

export function canStart(room){
  return room.phase==='lobby' && readyCount(room) >= 2;
}

/* ---------------- messages out ---------------- */

export function roomMessage(room, forPlayer){
  return {
    t:'room',
    code: room.code,
    you: forPlayer ? forPlayer.slot : null,
    mapId: room.mapId,
    phase: room.phase,
    players: room.players
      .slice()
      .sort((a,b)=>a.slot-b.slot)
      .map(p=>({ slot:p.slot, name:p.name, ready:p.ready, owner:p.owner, wins:p.wins }))
  };
}

export function broadcastRoom(room){
  room.players.forEach(p=>p.send(roomMessage(room, p)));
}

export function broadcast(room, msg){
  room.players.forEach(p=>p.send(msg));
}

/* ---------------- match ---------------- */

export function beginCountdown(room){
  room.phase = 'starting';
  room.startAt = Date.now() + START_COUNTDOWN*1000;
  broadcast(room, { t:'starting', inSeconds: START_COUNTDOWN });
}

function beginMatch(room){
  const defs = room.players
    .slice()
    .sort((a,b)=>a.slot-b.slot)
    .map(p=>({ name:p.name }));
  room.G = newGame(defs, mapById(room.mapId));
  room.phase = 'playing';
  room.last = Date.now();
  room.snapT = 0;
  room.players.forEach(p=>{ p.input={u:0,d:0,l:0,r:0,b:0,k:0}; });
}

function endRound(room){
  room.phase = 'ended';
  room.endT = ROUND_END_PAUSE;
  // one last snapshot so everyone actually sees the result on the board: the
  // regular 20-a-second one may not land on the tick the round ended
  broadcast(room, { t:'snap', s: pack(buildView(room.G)) });
  const winnerSlot = room.G.winner;
  const winner = room.players.find(p=>p.slot===winnerSlot);
  if(winner) winner.wins++;
  broadcast(room, {
    t:'ended',
    winner: winner ? winner.name || null : null,
    winnerSlot: winnerSlot===undefined ? null : winnerSlot,
    scores: room.players.slice().sort((a,b)=>a.slot-b.slot)
      .map(p=>({ slot:p.slot, name:p.name, wins:p.wins }))
  });
}

function backToLobby(room){
  room.G = null;
  room.phase = 'lobby';
  compactSlots(room);
  broadcastRoom(room);
}

/* One step of the room's clock. Called about 30 times a second while a match
   is live; the caller stops calling once the room is back in the lobby. */
export function tick(room){
  if(room.phase==='starting'){
    if(Date.now() >= room.startAt) beginMatch(room);
    return;
  }
  if(room.phase==='ended'){
    const now = Date.now();
    const dt = Math.min(0.05, (now-room.last)/1000);
    room.last = now;
    room.endT -= dt;
    if(room.endT<=0) backToLobby(room);
    return;
  }
  if(room.phase!=='playing' || !room.G) return;

  const now = Date.now();
  const dt = Math.min(0.05, (now-room.last)/1000);   // same clamp the browser used
  room.last = now;

  room.players.forEach(p=>{
    const gp = room.G.players.find(x=>x.slot===p.slot);
    if(gp) gp.input = p.input;
  });

  step(room.G, dt);

  room.snapT += dt;
  if(room.snapT >= SNAPSHOT_INTERVAL){
    room.snapT = 0;
    broadcast(room, { t:'snap', s: pack(buildView(room.G)) });
  }

  if(room.G.phase==='over') endRound(room);
}

/* A room is busy while anyone is in it, or until its grace period runs out. */
export function isExpired(room){
  return room.emptySince !== null && Date.now() - room.emptySince > EMPTY_ROOM_TTL;
}

export function needsTick(room){
  return room.phase==='starting' || room.phase==='playing' || room.phase==='ended';
}
