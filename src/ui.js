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
let btnStart, btnReady, menuNote, nameInput, mapPick, bestPick, netStatus;
let scoreboard, sbTitle, sbSub, sbList, sbNext;

export function init({ onLocal, onCreate, onJoin, onStart, onReady, onName, onMap, onBestOf, onLeave }){
  menu=el('menu'); lobby=el('lobby');
  roomCodeEl=el('roomCode'); playerList=el('playerList');
  lobbyTitle=el('lobbyTitle'); lobbySub=el('lobbySub'); lobbyNote=el('lobbyNote');
  btnStart=el('btnStart'); btnReady=el('btnReady'); menuNote=el('menuNote');
  nameInput=el('nameInput'); mapPick=el('mapPick'); bestPick=el('bestPick');
  netStatus=el('netStatus');
  scoreboard=el('scoreboard'); sbTitle=el('sbTitle'); sbSub=el('sbSub');
  sbList=el('sbList'); sbNext=el('sbNext');

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
  bestPick.onchange = ()=>onBestOf(Number(bestPick.value));

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
export function hideScoreboard(){ scoreboard.classList.add('hide'); }

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
  const played = state.players.some(p=>p.matches>0);

  roomCodeEl.textContent = state.code;
  lobbyTitle.textContent = played ? 'Next match' : (iOwn ? 'Room open' : 'You are in');
  lobbySub.textContent = iOwn
    ? 'Send this code to your cousins.'
    : 'Everyone here sees the same screen.';

  playerList.innerHTML = state.players.map(p=>{
    const tags = [
      p.owner ? '<span class="tag">owner</span>' : '',
      p.matches ? `<span class="tag wins">${p.matches} ${p.matches===1?'match':'matches'}</span>` : '',
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

  // The server is the one that runs the maps, so it decides what is on offer.
  // Building the picker from its list means a server older than this page can
  // never be asked for a map it does not have.
  if(state.maps && state.maps.length){
    const ids = state.maps.map(m=>m.id).join(',');
    if(mapPick.dataset.ids !== ids){
      mapPick.dataset.ids = ids;
      mapPick.innerHTML = state.maps
        .map(m=>`<option value="${esc(m.id)}">${esc(m.name)}</option>`).join('');
    }
  }

  // the map, the round count and the start button belong to whoever made the room
  mapPick.value = state.mapId;
  mapPick.disabled = !iOwn;
  bestPick.value = String(state.bestOf);
  bestPick.disabled = !iOwn;
  btnStart.classList.toggle('hide', !iOwn);
  btnStart.disabled = readyCount < 2;
  btnStart.textContent = played ? 'Start another match' : 'Start match';

  lobbyNote.textContent = iOwn
    ? (readyCount < 2 ? 'Two players need to be ready before you can start.' : '')
    : 'Waiting for the room owner to start.';
}

/* The scoreboard between rounds. One pip per round it takes to win the match,
   filled in as they are won, so the state of the match reads at a glance. */
export function showScoreboard(end, mySlot){
  menu.classList.add('hide');
  lobby.classList.add('hide');
  scoreboard.classList.remove('hide');

  sbTitle.textContent = end.matchOver
    ? `${end.champion || SLOT_NAME[end.championSlot]} wins the match`
    : (end.winner || end.winnerSlot===null
        ? `${end.winner || SLOT_NAME[end.winnerSlot]} takes the round`
        : 'Nobody survived');
  if(end.winnerSlot===null && !end.matchOver) sbTitle.textContent = 'Nobody survived';

  sbSub.textContent = `Round ${end.round} of best of ${end.bestOf}`;

  sbList.innerHTML = end.scores.map(p=>{
    const pips = Array.from({length:end.target}, (_,i)=>
      `<span class="pip${i<p.wins?' won':''}"${i<p.wins?` style="background:${SLOT_COLOR[p.slot]}"`:''}></span>`
    ).join('');
    const mine = p.slot===mySlot ? ' me' : '';
    const champ = end.matchOver && p.slot===end.championSlot ? ' champ' : '';
    return `<li class="${(mine+champ).trim()}">`
         + `<span class="dot" style="background:${SLOT_COLOR[p.slot]}"></span>`
         + `<span class="pname">${esc(p.name || SLOT_NAME[p.slot])}</span>`
         + `<span class="pips">${pips}</span></li>`;
  }).join('');
}

export function setScoreboardCountdown(seconds, matchOver){
  if(seconds<=0){ sbNext.textContent = ''; return; }
  sbNext.textContent = matchOver
    ? `Back to the lobby in ${seconds}`
    : `Next round in ${seconds}`;
}

/* Names come from other people's browsers, so never trust them as markup. */
function esc(s){
  return s.replace(/[&<>"']/g, c => (
    {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]
  ));
}
