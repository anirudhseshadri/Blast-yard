/* Entry point: wires the parts together and runs the frame loop.

   The modules do not know about each other. This file is the only place that
   knows whether this browser is playing locally, hosting, or guesting. */

import { newGame, restart, step, buildView, idleView } from './game.js';
import * as render from './render.js';
import * as input from './input.js';
import * as ui from './ui.js';
import { createHost, createGuest, peerReady } from './net.js';

const SNAPSHOT_INTERVAL = 0.05;   // seconds between snapshots, so about 20 a second

let G = null;              // authoritative state (host and local only)
let mode = 'menu';         // menu | local | host | guest
let view = null;           // latest snapshot, guests only
let lerpView = null;       // smoothed copy that guests actually draw
let myslot = 0;
let host = null, guest = null;
let lobbyPlayers = [];

render.attach(document.getElementById('cv'));

input.init({
  canvas: document.getElementById('cv'),
  onRestart(){
    if(G && G.phase==='over' && (mode==='local'||mode==='host')) G = restart(G);
  }
});

ui.init({
  onLocal(){
    mode='local';
    G=newGame([{name:'P1'},{name:'P2'},{name:'P3'},{name:'P4'}]);
    ui.hideMenu();
  },
  onHost: startHost,
  onJoin: startGuest,
  onStart(){
    if(mode!=='host') return;
    G=newGame(lobbyPlayers);
    ui.hideLobby();
    host.send({k:'go'});
  }
});

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
  mode='host'; myslot=0;
  lobbyPlayers=[{name:'You'}];

  host = createHost({
    onOpen(code){ ui.showHostLobby(code, lobbyPlayers); },
    onError(e){ ui.setNote('Connection problem: '+e.type); },
    onJoin(peerId){
      if(lobbyPlayers.length>=4) return null;       // room full, turn them away
      const slot=lobbyPlayers.length;
      lobbyPlayers.push({name:'Player '+(slot+1), peer:peerId});
      ui.renderLobby(lobbyPlayers);
      return slot;
    },
    onLeave(peerId){
      if(G){ const p=G.players.find(x=>x.peer===peerId); if(p) p.alive=false; }
      lobbyPlayers=lobbyPlayers.filter(p=>p.peer!==peerId);
      ui.renderLobby(lobbyPlayers);
    },
    onInput(peerId, inp){
      if(!G) return;
      const p=G.players.find(x=>x.peer===peerId);
      if(p) p.input=inp;
    }
  });
}

function startGuest(code){
  if(!needPeer()) return;
  mode='guest';
  ui.setNote('Connecting...');

  guest = createGuest(code, {
    onOpen(){ ui.showGuestLobby(code); },
    onSlot(slot){ myslot=slot; },
    onStart(){ ui.hideLobby(); },
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
  return mode==='guest'
    ? 'Waiting for the host to start the next round'
    : 'Press R for another round';
}

function show(v){
  render.draw(v, hintFor());
  const slot = mode==='local' ? 0 : myslot;
  const me = v.players.find(p=>p.slot===slot);
  input.setKickVisible(!!(me && me.alive && me.kick));
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
