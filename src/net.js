/* The connection to the game server.

   Every client is the same now. There is no host and no guest: this browser
   sends what its player is pressing and draws the snapshots that come back.
   The server runs the match.

   Messages this sends:
     {t:'create', name}          make a room
     {t:'join', code, name}      join one
     {t:'name', name}            rename yourself
     {t:'ready', value}          ready toggle
     {t:'map', id}               room owner picks the map
     {t:'start'}                 room owner starts the match
     {t:'input', u,d,l,r,b,k}    what you are pressing
     {t:'leave'}                 leave the room

   Messages it expects back:
     {t:'room', ...}      the lobby, as everyone sees it
     {t:'starting', inSeconds}
     {t:'snap', s:{...}}  a picture of the world
     {t:'ended', ...}     the round result
     {t:'error', reason}

   A dropped socket is retried for ten seconds before giving up, because phones
   suspend tabs and wifi drops. */

import { unpack } from './snapshot.js';
import { serverUrl } from './config.js';

/* Two different waits, because they are two different situations.

   The first connection may be waking a sleeping free server, which takes
   around half a minute, so give it a minute before giving up. A socket that
   drops after we were already talking is a real problem, so ten seconds is
   plenty there, as MULTIPLAYER.md asks. */
const WAKE_WINDOW_MS = 60000;    // first connection: the server may be asleep
const RETRY_WINDOW_MS = 10000;   // after that: a drop is a drop
const RETRY_EVERY_MS = 1000;

export function connect({ onOpen, onRoom, onStarting, onSnapshot, onEnded,
                          onServerError, onWaking, onReconnecting, onLost }){
  let ws = null;
  let lastInput = '';
  let closedByUs = false;
  let everConnected = false;
  let retryingSince = 0;
  let retryTimer = null;

  // what to send again after a reconnect, so the socket coming back is enough
  // to put you in a room rather than back at the menu
  let myCode = null, myName = '';
  let rejoinPending = false;
  // what we were asked to do before the socket was ready. A sleeping server
  // means the first attempt usually fails, so this has to survive until some
  // later attempt gets through, or the click is silently lost.
  let pendingFirst = null;

  function open(){
    ws = new WebSocket(serverUrl());

    ws.onopen = ()=>{
      retryingSince = 0;
      everConnected = true;
      if(myCode){
        // Phase A rejoin: ask for the room again by code. This is not slot
        // recovery -- if the match moved on without you, the server says so
        // and you land back on the menu. Holding your slot is Phase B.
        rejoinPending = true;
        ws.send(JSON.stringify({t:'join', code:myCode, name:myName}));
      }else if(pendingFirst){
        ws.send(JSON.stringify(pendingFirst));
      }
      onOpen();
    };

    ws.onmessage = e=>{
      let m;
      try { m = JSON.parse(e.data); } catch { return; }
      if(m.t==='room'){
        myCode = m.code;               // remember how to get back if this drops
        pendingFirst = null;           // we are in, so stop trying to get in
        rejoinPending = false;
        onRoom(m);
      }
      else if(m.t==='starting') onStarting(m.inSeconds);
      else if(m.t==='snap') onSnapshot(unpack(m.s));
      else if(m.t==='ended') onEnded(m);
      else if(m.t==='error'){
        // an error answering our rejoin means the room is not there for us any
        // more, so stop retrying and say why
        if(rejoinPending){ rejoinPending=false; closedByUs=true; onLost(m.reason); }
        else onServerError(m.reason);
      }
    };

    ws.onclose = ()=>{
      if(closedByUs) return;
      if(!retryingSince) retryingSince = Date.now();
      const waiting = Date.now() - retryingSince;

      if(!everConnected){
        if(waiting > WAKE_WINDOW_MS){
          onLost('Could not reach the server. It may be starting up, so try again in a minute.');
          return;
        }
        onWaking();
      }else{
        if(waiting > RETRY_WINDOW_MS){
          onLost('Lost the connection to the server.');
          return;
        }
        onReconnecting();
      }
      retryTimer = setTimeout(open, RETRY_EVERY_MS);
    };

    // onerror is always followed by onclose, which does the retrying
    ws.onerror = ()=>{};
  }
  open();

  const send = obj => {
    if(ws && ws.readyState===WebSocket.OPEN) ws.send(JSON.stringify(obj));
  };

  return {
    /* These two queue themselves if the socket is not up yet, which is the
       normal case while a free server is waking. */
    create(name){
      myCode=null; myName=name;
      pendingFirst={t:'create', name};
      send(pendingFirst);
    },
    join(code, name){
      myCode=null; myName=name;
      pendingFirst={t:'join', code, name};
      send(pendingFirst);
    },
    setName(name){ myName=name; send({t:'name', name}); },
    setReady(value){ send({t:'ready', value}); },
    setMap(id){ send({t:'map', id}); },
    start(){ send({t:'start'}); },
    leave(){ send({t:'leave'}); },

    /* Only send when something actually changed. */
    sendInput(inp){
      const s = JSON.stringify(inp);
      if(s===lastInput) return;
      lastInput = s;
      send({t:'input', ...inp});
    },

    close(){
      closedByUs = true;
      clearTimeout(retryTimer);
      if(ws) ws.close();
    }
  };
}
