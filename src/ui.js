/* Menu, lobby and scoreboard screens.

   This is the only module that touches the menu DOM. It reports button presses
   back through the handlers passed to `init`.

   The lobby is rendered from one lobby-state object. The host builds that
   object and sends it to everyone, so host and guests draw the same screen
   through the same function. Nothing here decides anything about the room; it
   only shows what the state says and reports what was pressed. */

import { SLOT_COLOR, SLOT_NAME } from './constants.js';
import { MAPS } from './maps/index.js';

const el = id => document.getElementById(id);
const NAME_KEY = 'blastyard.name';

let menu, lobby, roomCodeEl, playerList, lobbyTitle, lobbySub, lobbyNote;
let btnStart, btnReady, menuNote, nameInput, mapPick;

export function init({ onLocal, onHost, onJoin, onStart, onReady, onName, onMap }){
  menu=el('menu'); lobby=el('lobby');
  roomCodeEl=el('roomCode'); playerList=el('playerList');
  lobbyTitle=el('lobbyTitle'); lobbySub=el('lobbySub'); lobbyNote=el('lobbyNote');
  btnStart=el('btnStart'); btnReady=el('btnReady'); menuNote=el('menuNote');
  nameInput=el('nameInput'); mapPick=el('mapPick');

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
  btnReady.onclick = onReady;

  mapPick.innerHTML = MAPS.map(m=>`<option value="${m.id}">${m.name}</option>`).join('');
  mapPick.onchange = ()=>onMap(mapPick.value);

  nameInput.value = loadName();
  // report on every keystroke so the others see the name as it is typed
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
export function showLobby(){ menu.classList.add('hide'); lobby.classList.remove('hide'); }
export function hideLobby(){ lobby.classList.add('hide'); }

/* Draw the shared lobby. `state` is what the host broadcast, `myId` says which
   row is this browser. Host and guest both come through here. */
export function renderLobby(state, myId){
  const me = state.players.find(p=>p.id===myId);
  const iAmHost = !!(me && me.isHost);
  const readyCount = state.players.filter(p=>p.ready).length;
  const played = state.players.some(p=>p.wins>0);

  roomCodeEl.textContent = state.code;
  lobbyTitle.textContent = played ? 'Next round' : (iAmHost ? 'Room open' : 'You are in');
  lobbySub.textContent = iAmHost
    ? 'Send this code to your cousins.'
    : 'Everyone here sees the same screen.';

  playerList.innerHTML = state.players.map(p=>{
    const tags = [
      p.isHost ? '<span class="tag">host</span>' : '',
      p.wins ? `<span class="tag wins">${p.wins} ${p.wins===1?'win':'wins'}</span>` : '',
      p.ready ? '<span class="tag ready">ready</span>' : '<span class="tag">not ready</span>'
    ].join('');
    const label = (p.name || SLOT_NAME[p.slot]) + (p.id===myId ? ' (you)' : '');
    return `<li class="${p.id===myId?'me':''}">`
         + `<span class="dot" style="background:${SLOT_COLOR[p.slot]}"></span>`
         + `<span class="pname">${esc(label)}</span>${tags}</li>`;
  }).join('');

  // your own controls
  btnReady.textContent = me && me.ready ? 'Ready' : 'Not ready';
  btnReady.classList.toggle('on', !!(me && me.ready));
  if(nameInput.value !== (me ? me.name : '') && document.activeElement !== nameInput){
    nameInput.value = me ? me.name : '';
  }

  // the map is the host's call, but everyone sees the choice
  mapPick.value = state.mapId;
  mapPick.disabled = !iAmHost;

  // starting is the host's call too
  btnStart.classList.toggle('hide', !iAmHost);
  btnStart.disabled = readyCount < 2;
  btnStart.textContent = played ? 'Start next round' : 'Start match';

  lobbyNote.textContent = iAmHost
    ? (readyCount < 2 ? 'Two players need to be ready before you can start.' : '')
    : 'Waiting for the host to start.';
}

/* Names come from other people's browsers, so never trust them as markup. */
function esc(s){
  return s.replace(/[&<>"']/g, c => (
    {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]
  ));
}
