/* Menu, lobby and scoreboard screens.

   This is the only module that touches the menu DOM. It reports button
   presses back through the handlers passed to `init`, and exposes a few
   small functions for the rest of the game to change what is on screen. */

import { SLOT_NAME } from './constants.js';

const el = id => document.getElementById(id);

let menu, lobby, roomCodeEl, playerList, lobbyTitle, lobbySub, btnStart, menuNote;

const CONTROLS_HINT = '<li>Arrow keys or WASD to move, space to drop a bomb.</li>';

export function init({ onLocal, onHost, onJoin, onStart }){
  menu=el('menu'); lobby=el('lobby');
  roomCodeEl=el('roomCode'); playerList=el('playerList');
  lobbyTitle=el('lobbyTitle'); lobbySub=el('lobbySub');
  btnStart=el('btnStart'); menuNote=el('menuNote');

  el('btnLocal').onclick = onLocal;
  el('btnHost').onclick  = onHost;
  el('btnJoin').onclick  = ()=>{
    const code = el('joinCode').value.trim().toUpperCase();
    if(code.length<3){ setNote('Enter the 5 letter code the host gave you.'); return; }
    onJoin(code);
  };
  el('btnCopy').onclick  = ()=>navigator.clipboard?.writeText(roomCodeEl.textContent);
  el('btnLeave').onclick = ()=>location.reload();
  btnStart.onclick = onStart;
}

export function setNote(text){ menuNote.textContent = text; }

export function hideMenu(){ menu.classList.add('hide'); }

export function showHostLobby(code, players){
  menu.classList.add('hide');
  lobby.classList.remove('hide');
  roomCodeEl.textContent = code;
  renderLobby(players);
}

export function showGuestLobby(code){
  menu.classList.add('hide');
  lobby.classList.remove('hide');
  lobbyTitle.textContent='You are in';
  lobbySub.textContent='Waiting for the host to start.';
  roomCodeEl.textContent=code;
  btnStart.disabled=true;
  playerList.innerHTML=CONTROLS_HINT;
}

export function hideLobby(){ lobby.classList.add('hide'); }

export function renderLobby(players){
  playerList.innerHTML = players
    .map((p,i)=>`<li>${SLOT_NAME[i]}: ${i===0?'you (host)':p.name}</li>`)
    .join('') + CONTROLS_HINT;
}
