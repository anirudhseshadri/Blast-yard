/* Menu, lobby and scoreboard screens.

   This is the only module that touches the menu DOM. It reports button presses
   back through the handlers passed to `init`.

   The lobby is rendered straight from the server's `room` message. The server
   owns that state, so every player is drawing the same thing from the same
   source; this module decides nothing about the room. */

import { SLOT_COLOR, SLOT_NAME } from './constants.js';
import { MAPS } from './maps/index.js';

const el = id => document.getElementById(id);
const NAME_KEY = 'blastyard.name';

let menu, lobby, roomCodeEl, playerList, lobbyTitle, lobbySub, lobbyNote;
let btnStart, btnReady, menuNote, nameInput, mapPick, netStatus;

export function init({ onLocal, onCreate, onJoin, onStart, onReady, onName, onMap, onLeave }){
  menu=el('menu'); lobby=el('lobby');
  roomCodeEl=el('roomCode'); playerList=el('playerList');
  lobbyTitle=el('lobbyTitle'); lobbySub=el('lobbySub'); lobbyNote=el('lobbyNote');
  btnStart=el('btnStart'); btnReady=el('btnReady'); menuNote=el('menuNote');
  nameInput=el('nameInput'); mapPick=el('mapPick'); netStatus=el('netStatus');

  el('btnLocal').onclick  = onLocal;
  el('btnHost').onclick   = onCreate;
  el('btnJoin').onclick   = ()=>{
    const code = el('joinCode').value.trim().toUpperCase();
    if(code.length<3){ setNote('Enter the 5 letter code you were given.'); return; }
    onJoin(code);
  };
  el('btnCopy').onclick  = ()=>navigator.clipboard?.writeText(roomCodeEl.textContent);
  el('btnLeave').onclick = onLeave;
  btnStart.onclick = onStart;
  btnReady.onclick = onReady;

  mapPick.innerHTML = MAPS.map(m=>`<option value="${m.id}">${m.name}</option>`).join('');
  mapPick.onchange = ()=>onMap(mapPick.value);

  nameInput.value = loadName();
  nameInput.oninput = ()=>{
    const name = nameInput.value.slice(0,12);
    saveName(name);
    onName(name);
  };
}

/* The name is remembered on this device so nobody retypes it every time. */
export function loadName(){
  try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; }
}
function saveName(name){
  try { localStorage.setItem(NAME_KEY, name); } catch { /* private mode, no matter */ }
}

export function setNote(text){ menuNote.textContent = text; }
export function hideMenu(){ menu.classList.add('hide'); }
export function showMenu(){ menu.classList.remove('hide'); lobby.classList.add('hide'); }
export function showLobby(){ menu.classList.add('hide'); lobby.classList.remove('hide'); }
export function hideLobby(){ lobby.classList.add('hide'); }

/* A line across the top of the board for anything about the connection:
   waking the server, reconnecting, counting down to the start. */
export function setStatus(text){
  netStatus.textContent = text || '';
  netStatus.classList.toggle('hide', !text);
}

/* Draw the shared lobby from the server's room message. `state.you` is this
   browser's slot, which is how a row knows it is yours. */
export function renderLobby(state){
  const me = state.players.find(p=>p.slot===state.you);
  const iOwn = !!(me && me.owner);
  const readyCount = state.players.filter(p=>p.ready).length;
  const played = state.players.some(p=>p.wins>0);

  roomCodeEl.textContent = state.code;
  lobbyTitle.textContent = played ? 'Next round' : (iOwn ? 'Room open' : 'You are in');
  lobbySub.textContent = iOwn
    ? 'Send this code to your cousins.'
    : 'Everyone here sees the same screen.';

  playerList.innerHTML = state.players.map(p=>{
    const tags = [
      p.owner ? '<span class="tag">owner</span>' : '',
      p.wins ? `<span class="tag wins">${p.wins} ${p.wins===1?'win':'wins'}</span>` : '',
      p.ready ? '<span class="tag ready">ready</span>' : '<span class="tag">not ready</span>'
    ].join('');
    const label = (p.name || SLOT_NAME[p.slot]) + (p.slot===state.you ? ' (you)' : '');
    return `<li class="${p.slot===state.you?'me':''}">`
         + `<span class="dot" style="background:${SLOT_COLOR[p.slot]}"></span>`
         + `<span class="pname">${esc(label)}</span>${tags}</li>`;
  }).join('');

  btnReady.textContent = me && me.ready ? 'Ready' : 'Not ready';
  btnReady.classList.toggle('on', !!(me && me.ready));
  if(me && nameInput.value !== me.name && document.activeElement !== nameInput){
    nameInput.value = me.name;
  }

  // the map and the start button belong to whoever made the room
  mapPick.value = state.mapId;
  mapPick.disabled = !iOwn;
  btnStart.classList.toggle('hide', !iOwn);
  btnStart.disabled = readyCount < 2;
  btnStart.textContent = played ? 'Start next round' : 'Start match';

  lobbyNote.textContent = iOwn
    ? (readyCount < 2 ? 'Two players need to be ready before you can start.' : '')
    : 'Waiting for the room owner to start.';
}

/* Names come from other people's browsers, so never trust them as markup. */
function esc(s){
  return s.replace(/[&<>"']/g, c => (
    {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]
  ));
}
