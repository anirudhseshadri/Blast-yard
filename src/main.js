/* Entry point: wires the parts together and runs the frame loop.

   Two ways to play:
     local   up to four players on one keyboard, simulated right here
     online  the server runs the match; this browser sends input and draws
             the snapshots it gets back

   Online there is no host and no guest. Every client does the same thing, so
   closing a tab costs that player and nothing else. */

import { newGame, restart, step, buildView, idleView } from './game.js';
import * as render from './render.js';
import * as input from './input.js';
import * as ui from './ui.js';
import { connect } from './net.js';

let G = null;          // local play only: the simulation lives here
let mode = 'menu';     // menu | local | online
let view = null;       // latest snapshot from the server
let lerpView = null;   // smoothed copy that actually gets drawn
let mySlot = 0;
let net = null;
let inLobby = false;   // online: showing the lobby rather than the board

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
  onCreate(){ goOnline(n=>n.create(ui.loadName())); },
  onJoin(code){ goOnline(n=>n.join(code, ui.loadName())); },
  onName(name){ if(net) net.setName(name); },
  onReady(){ if(net) net.setReady(!amReady()); },
  onMap(id){ if(net) net.setMap(id); },
  onStart(){ if(net) net.start(); },
  onLeave(){ if(net) net.leave(); location.reload(); }
});

let room = null;
function amReady(){
  const me = room && room.players.find(p=>p.slot===room.you);
  return !!(me && me.ready);
}

/* ---------------- online ---------------- */

/* `first` is what to send once the socket is up: create a room, or join one. */
function goOnline(first){
  if(net) return;
  mode='online';
  // a free server sleeps when idle and takes a while to wake, so say so rather
  // than leaving a dead-looking button
  ui.setNote('Reaching the server...');

  net = connect({
    onOpen(isRetry){
      ui.setStatus('');
      if(!isRetry) first(net);
    },
    onRoom(state){
      room = state;
      mySlot = state.you;
      view=null; lerpView=null;     // drop the old round so the next starts clean
      inLobby = true;
      ui.setStatus('');
      ui.showLobby();
      ui.renderLobby(state);
    },
    onStarting(seconds){
      let left = seconds;
      ui.setStatus('Starting in ' + left);
      const id = setInterval(()=>{
        left--;
        if(left>0){ ui.setStatus('Starting in ' + left); return; }
        clearInterval(id);
        ui.setStatus('');
        inLobby = false;
        ui.hideLobby();
      }, 1000);
    },
    onSnapshot(v){
      inLobby = false;
      ui.hideLobby();
      view = v;
      if(!lerpView) lerpView = JSON.parse(JSON.stringify(view));
    },
    onEnded(){ /* the last snapshot carries the result; the lobby follows */ },
    onServerError(reason){
      ui.setNote(reason);
      if(!room){ mode='menu'; net.close(); net=null; ui.showMenu(); }
    },
    onReconnecting(){ ui.setStatus('Reconnecting...'); },
    onLost(reason){
      ui.setStatus('');
      ui.setNote(reason || 'Lost the connection to the server.');
      mode='menu'; net=null; room=null; view=null; lerpView=null;
      ui.showMenu();
    }
  });
}

/* ---------------- loop ---------------- */

function hintFor(){
  return mode==='local' ? 'Press R for another round' : 'Back to the lobby in a moment';
}

function show(v){
  render.draw(v, hintFor());
  const slot = mode==='local' ? 0 : mySlot;
  const me = v.players.find(p=>p.slot===slot);
  input.setKickVisible(!!(me && me.alive && me.kick));
}

let last=performance.now();
function frame(now){
  const dt=Math.min(0.05,(now-last)/1000); last=now;

  if(mode==='local' && G){
    G.players.forEach((p,i)=>{ p.input=input.readLocal(i); });
    step(G,dt);
    show(buildView(G));
  }else if(mode==='online' && net){
    if(!inLobby) net.sendInput(input.readMine());
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
