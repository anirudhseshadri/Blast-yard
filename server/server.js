/* Blast Yard game server.

   Every client is the same: it sends its key state and draws the snapshots it
   gets back. The server runs the match and owns the truth, so nobody has to
   host and closing a tab no longer kills the game.

   Node 20+ and the `ws` package. Nothing else. Rooms live in memory; there is
   no database and nothing is written to disk. */

import http from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import {
  createRoom, makeCode, addPlayer, removePlayer, cleanName,
  roomMessage, broadcastRoom, beginCountdown, canStart, tick,
  isExpired, needsTick, MAX_ROOMS
} from './rooms.js';
import { mapById } from '../src/maps/index.js';

const PORT = process.env.PORT || 8080;
const TICK_MS = 1000/30;            // 30 ticks a second
const SWEEP_MS = 10000;             // how often dead rooms are cleared out
const CREATE_COOLDOWN_MS = 10000;   // one new room per address per 10 seconds

const rooms = new Map();            // code -> room
const lastCreate = new Map();       // address -> timestamp

const server = http.createServer((req,res)=>{
  // a health check is all the plain HTTP this needs, so no Express
  if(req.url==='/health'){
    res.writeHead(200,{'content-type':'application/json'});
    res.end(JSON.stringify({ ok:true, rooms:rooms.size, uptime:Math.round(process.uptime()) }));
    return;
  }
  res.writeHead(404); res.end('Blast Yard server. The game itself is served elsewhere.');
});

const wss = new WebSocketServer({ server });

/* Behind a host like Render the socket address is the proxy, so prefer the
   forwarded address. It can be spoofed by a determined client; this only
   paces room creation, so that is an acceptable trade here. */
function addressOf(req){
  const fwd = req.headers['x-forwarded-for'];
  if(typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim();
  return req.socket.remoteAddress || 'unknown';
}

wss.on('connection',(ws, req)=>{
  const address = addressOf(req);
  let room = null, player = null;

  const send = msg => { if(ws.readyState===WebSocket.OPEN) ws.send(JSON.stringify(msg)); };
  const fail = reason => send({ t:'error', reason });

  ws.on('message', raw=>{
    let m;
    try { m = JSON.parse(raw); } catch { return; }      // ignore anything unreadable
    if(!m || typeof m.t !== 'string') return;

    switch(m.t){
      case 'create': {
        if(room) return fail('You are already in a room.');
        const since = Date.now() - (lastCreate.get(address) || 0);
        if(since < CREATE_COOLDOWN_MS){
          return fail('Give it a moment before making another room.');
        }
        if(rooms.size >= MAX_ROOMS) return fail('The server is full. Try again shortly.');

        let code = makeCode();
        while(rooms.has(code)) code = makeCode();
        lastCreate.set(address, Date.now());

        room = createRoom(code);
        rooms.set(code, room);
        const r = addPlayer(room, m.name, send);
        player = r.player;
        broadcastRoom(room);
        break;
      }

      case 'join': {
        if(room) return fail('You are already in a room.');
        const target = rooms.get(String(m.code||'').trim().toUpperCase());
        if(!target) return fail('No room with that code.');
        const r = addPlayer(target, m.name, send);
        if(r.error) return fail(r.error);
        room = target; player = r.player;
        broadcastRoom(room);
        break;
      }

      case 'name': {
        if(!player) return;
        player.name = cleanName(m.name);
        broadcastRoom(room);
        break;
      }

      case 'ready': {
        if(!player) return;
        player.ready = !!m.value;
        broadcastRoom(room);
        break;
      }

      // Not in the Phase A list, but the lobby already had a map picker and
      // the server owns lobby state now, so the choice has to live here.
      case 'map': {
        if(!player || !player.owner) return;
        if(room.phase!=='lobby') return;
        room.mapId = mapById(m.id).id;
        broadcastRoom(room);
        break;
      }

      case 'start': {
        if(!player || !player.owner) return fail('Only the player who made the room can start it.');
        if(!canStart(room)) return fail('Two players need to be ready first.');
        beginCountdown(room);
        break;
      }

      case 'input': {
        if(!player) return;
        player.input = {
          u:+!!m.u, d:+!!m.d, l:+!!m.l, r:+!!m.r, b:+!!m.b, k:+!!m.k
        };
        break;
      }

      case 'leave': {
        if(room && player){ removePlayer(room, player); broadcastRoom(room); }
        room = null; player = null;
        break;
      }
    }
  });

  ws.on('close',()=>{
    if(room && player){
      removePlayer(room, player);
      broadcastRoom(room);
    }
    room = null; player = null;
  });

  ws.on('error',()=>{ /* the close handler does the cleanup */ });
});

/* One timer drives every live room. The brief asks for a tick per active room;
   rooms sitting in the lobby have nothing to simulate, so they cost nothing. */
setInterval(()=>{
  for(const room of rooms.values()){
    if(needsTick(room)) tick(room);
  }
}, TICK_MS);

setInterval(()=>{
  for(const [code, room] of rooms){
    if(isExpired(room)) rooms.delete(code);
  }
  const cutoff = Date.now() - CREATE_COOLDOWN_MS;
  for(const [address, at] of lastCreate){
    if(at < cutoff) lastCreate.delete(address);
  }
}, SWEEP_MS);

server.listen(PORT, ()=>{
  console.log(`Blast Yard server listening on ${PORT}`);
});
