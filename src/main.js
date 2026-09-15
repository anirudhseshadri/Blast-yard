/* Entry point: wires the parts together and runs the frame loop.

   The modules do not know about each other. This file is the only place that
   knows whether this browser is playing locally, hosting, or guesting.

   The lobby is host-authoritative, like the match. The host owns `lobbyState`
   and sends it to everyone after every change, so nobody renders a room that
   only they can see. */

import { newGame, restart, step, buildView, idleView } from './game.js';
import { DEFAULT_MAP, mapById } from './maps/index.js';
import * as render from './render.js';
import * as input from './input.js';
import * as ui from './ui.js';
import { createHost, createGuest, peerReady } from './net.js';

const SNAPSHOT_INTERVAL = 0.05;   // seconds between snapshots, so about 20 a second
const ROUND_END_PAUSE = 4;        // seconds the win message shows before the lobby returns
const MAX_PLAYERS = 4;
const HOST_ID = 'host';           // the host's own row in the lobby

let G = null;              // authoritative state (host and local only)
let mode = 'menu';         // menu | local | host | guest
let view = null;           // latest snapshot, guests only
let lerpView = null;       // smoothed copy that guests actually draw
let myslot = 0;
let myId = HOST_ID;        // which lobby row is this browser
let host = null, guest = null;
let roundScored = false, endTimer = 0;

let lobbyState = { code:'', mapId:DEFAULT_MAP.id, players:[] };

render.attach(document.getElementById('cv'));

input.init({
  canvas: document.getElementById('cv'),
  onRestart(){
    // online rounds return to the lobby on their own, so R is local play only
    if(G && G.phase==='over' && mode==='local') G = restart(G);
  }
});

ui.init({
  onLocal(){
    mode='local';
    // no names on a shared keyboard, so the win message uses the slot colours
    G=newGame([{name:''},{name:''},{name:''},{name:''}]);
    ui.hideMenu();
  },
  onHost: startHost,
  onJoin: startGuest,
  onStart(){
    if(mode!=='host') return;
    if(lobbyState.players.filter(p=>p.ready).length < 2) return;
    startMatch();
  },
  onReady(){
    const me = lobbyState.players.find(p=>p.id===myId);
    if(!me) return;
    if(mode==='host'){ me.ready=!me.ready; pushLobby(); }
    else if(mode==='guest' && guest) guest.send({k:'ready', ready:!me.ready});
  },
  onName(name){
    if(mode==='host'){
      const me = lobbyState.players.find(p=>p.id===HOST_ID);
      if(me){ me.name=name; pushLobby(); }
    }else if(mode==='guest' && guest){
      guest.send({k:'name', name});
    }
  },
  onMap(id){
    if(mode!=='host') return;
    lobbyState.mapId=id;
    pushLobby();
  }
});

/* ---------------- the shared lobby ---------------- */

/* Render it here and send the same object to everyone else. */
function pushLobby(){
  ui.renderLobby(lobbyState, myId);
  if(host) host.send({k:'lobby', code:lobbyState.code, mapId:lobbyState.mapId, players:lobbyState.players});
}

/* Slots decide spawn corner and colour, and a new match needs them to run
   0,1,2..., so close the gaps left by anyone who quit. Only safe between
   rounds: during a match the slots have to keep matching the live game. */
function compactSlots(){
  lobbyState.players.forEach((p,i)=>{ p.slot=i; });
}

function freeSlot(){
  const used = new Set(lobbyState.players.map(p=>p.slot));
  for(let i=0;i<MAX_PLAYERS;i++) if(!used.has(i)) return i;
  return null;
}

function startMatch(){
  const defs = lobbyState.players.map(p=>({
    name: p.name,
    peer: p.id===HOST_ID ? null : p.id
  }));
  G = newGame(defs, mapById(lobbyState.mapId));
  roundScored=false;
  ui.hideLobby();
  host.send({k:'go'});
}

function backToLobby(){
  G=null;
  compactSlots();
  ui.showLobby();
  pushLobby();
}

/* ---------------- online ---------------- */

function needPeer(){
  if(!peerReady()){
    ui.setNote('Could not load the connection library. Check your internet, then reload.');
    return false;
  }
  return true;
}

function startHost(){
  if(!needPeer()) return;
  mode='host'; myslot=0; myId=HOST_ID;
  lobbyState = {
    code:'', mapId:DEFAULT_MAP.id,
    players:[{id:HOST_ID, slot:0, name:ui.loadName(), ready:false, wins:0, isHost:true}]
  };

  host = createHost({
    onOpen(code){
      lobbyState.code=code;
      ui.showLobby();
      pushLobby();
    },
    onError(e){ ui.setNote('Connection problem: '+e.type); },
    onJoin(peerId){
      const slot = lobbyState.players.length>=MAX_PLAYERS ? null : freeSlot();
      if(slot===null) return null;                 // room full, turn them away
      lobbyState.players.push({id:peerId, slot, name:'', ready:false, wins:0, isHost:false});
      pushLobby();
      return slot;
    },
    onLeave(peerId){
      if(G){ const p=G.players.find(x=>x.peer===peerId); if(p) p.alive=false; }
      lobbyState.players = lobbyState.players.filter(p=>p.id!==peerId);
      if(!G) compactSlots();
      pushLobby();
    },
    onInput(peerId, inp){
      if(!G) return;
      const p=G.players.find(x=>x.peer===peerId);
      if(p) p.input=inp;
    },
    onName(peerId, name){
      const p=lobbyState.players.find(x=>x.id===peerId);
      if(p){ p.name=name; pushLobby(); }
    },
    onReady(peerId, ready){
      const p=lobbyState.players.find(x=>x.id===peerId);
      if(p){ p.ready=ready; pushLobby(); }
    }
  });
}

function startGuest(code){
  if(!needPeer()) return;
  mode='guest';
  ui.setNote('Connecting...');

  guest = createGuest(code, {
    onOpen(id){
      myId=id;
      const name=ui.loadName();
      if(name) guest.send({k:'name', name});
    },
    onSlot(slot){ myslot=slot; },
    onLobby(state){
      lobbyState=state;
      const me=state.players.find(p=>p.id===myId);
      if(me) myslot=me.slot;
      view=null; lerpView=null;      // drop the old round so the next one starts clean
      ui.showLobby();
      ui.renderLobby(state, myId);
    },
    onStart(){ ui.hideLobby(); },
    onFull(){ ui.setNote('That room is full. Four players is the limit.'); mode='menu'; },
    onSnapshot(v){
      view=v;
      if(!lerpView) lerpView=JSON.parse(JSON.stringify(view));
    },
    onClose(){ alert('Host disconnected.'); location.reload(); },
    onError(){ ui.setNote('Could not join that room. Check the code.'); mode='menu'; }
  });
}

/* ---------------- loop ---------------- */

function hintFor(){
  return mode==='local' ? 'Press R for another round' : 'Back to the lobby in a moment';
}

function show(v){
  render.draw(v, hintFor());
  const slot = mode==='local' ? 0 : myslot;
  const me = v.players.find(p=>p.slot===slot);
  input.setKickVisible(!!(me && me.alive && me.kick));
}

/* One round has ended: count the win, then hand everyone back to the lobby. */
function endOfRound(dt){
  if(!roundScored){
    roundScored=true;
    endTimer=ROUND_END_PAUSE;
    if(G.winner!=null){
      const w=lobbyState.players.find(p=>p.slot===G.winner);
      if(w) w.wins++;
    }
  }
  endTimer-=dt;
  if(endTimer<=0) backToLobby();
}

let last=performance.now(), netT=0;
function frame(now){
  const dt=Math.min(0.05,(now-last)/1000); last=now;

  if(mode==='local' && G){
    G.players.forEach((p,i)=>{ p.input=input.readLocal(i); });
    step(G,dt);
    show(buildView(G));
  }else if(mode==='host' && G){
    const me=G.players.find(p=>p.slot===myslot);
    if(me) me.input=input.readMine();
    step(G,dt);
    const v=buildView(G);
    show(v);
    netT+=dt;
    if(netT>SNAPSHOT_INTERVAL){ netT=0; host.broadcast(v); }
    if(G.phase==='over') endOfRound(dt);
  }else if(mode==='guest'){
    guest.sendInput(input.readMine());
    if(view){
      lerpView = render.smooth(lerpView, view, dt);
      show(lerpView);
    }
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// idle art so the canvas is not blank behind the menu
render.draw(idleView());
