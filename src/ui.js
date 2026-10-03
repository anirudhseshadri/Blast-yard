/* Menu, lobby and scoreboard screens.

   This is the only module that touches the menu DOM. It reports button presses
   back through the handlers passed to `init`.

   The lobby is rendered straight from the server's `room` message. The server
   owns that state, so every player is drawing the same thing from the same
   source; this module decides nothing about the room. */

import { SLOT_COLOR, SLOT_NAME } from './constants.js';
import { MAPS } from './maps/index.js';
import { pickupIcon } from './render.js';

const el = id => document.getElementById(id);
const NAME_KEY = 'blastyard.name';
const HELP_KEY = 'blastyard.seenHelp';

/* What each powerup does, in the order the guide lists them. These describe
   the rules in game.js `grant`; change one and change the other. */
const POWERUPS = [
  ['bomb',   'Extra bomb',   'Have one more bomb out at a time. Up to 4.'],
  ['range',  'Bigger blast', 'Your blast reaches one tile further. Up to 8.'],
  ['speed',  'Speed',        'Walk faster. Stacks three times.'],
  ['shield', 'Shield',       'Survive one blast. The ring around you shows it is on.'],
  ['kick',   'Kick',         'Walk into a bomb and press kick to send it sliding until it hits something.'],
  ['fuse',   'Short fuse',   'Your bombs go off sooner, so they are harder to dodge. Watch yourself too.'],
  ['skull',  'Curse',        'Bad one. Your controls are reversed for 8 seconds. Purple border means avoid it.'],
  ['random', 'Mystery',      'Usually a random good power-up. About one time in seven it wipes everything you have collected.']
];

let menu, lobby, roomCodeEl, playerList, lobbyTitle, lobbySub, lobbyNote;
let btnStart, btnReady, menuNote, nameInput, mapPick, bestPick, netStatus;
let scoreboard, sbTitle, sbSub, sbList, sbNext, sbAwards;
let help, statsEl, btnCancel, menuButtons, lastStats = '';

export function init({ onLocal, onCreate, onJoin, onCancel, onStart, onReady, onName, onMap, onBestOf, onLeave }){
  menu=el('menu'); lobby=el('lobby');
  roomCodeEl=el('roomCode'); playerList=el('playerList');
  lobbyTitle=el('lobbyTitle'); lobbySub=el('lobbySub'); lobbyNote=el('lobbyNote');
  btnStart=el('btnStart'); btnReady=el('btnReady'); menuNote=el('menuNote');
  nameInput=el('nameInput'); mapPick=el('mapPick'); bestPick=el('bestPick');
  netStatus=el('netStatus');
  scoreboard=el('scoreboard'); sbTitle=el('sbTitle'); sbSub=el('sbSub');
  sbList=el('sbList'); sbNext=el('sbNext'); sbAwards=el('sbAwards');
  help=el('help'); statsEl=el('stats'); btnCancel=el('btnCancel');
  menuButtons=[el('btnLocal'), el('btnHost'), el('btnJoin'), el('joinCode')];

  el('btnLocal').onclick  = onLocal;
  el('btnHost').onclick   = onCreate;
  const join = ()=>{
    const code = el('joinCode').value.trim().toUpperCase();
    if(code.length<3){ setNote('Enter the 5 letter code you were given.'); return; }
    onJoin(code);
  };
  el('btnJoin').onclick = join;
  el('joinCode').onkeydown = e=>{ if(e.key==='Enter') join(); };
  btnCancel.onclick = onCancel;

  // the guide: the icons are drawn by the same code that draws the board
  const list = el('puList');
  POWERUPS.forEach(([type, name, text])=>{
    const dt = document.createElement('dt');
    dt.appendChild(pickupIcon(type));
    const dd = document.createElement('dd');
    if(type==='skull') dd.className = 'bad';
    dd.innerHTML = `<b>${name}.</b> ${text}`;
    list.append(dt, dd);
  });
  el('btnHelp').onclick = showHelp;
  el('btnHelp2').onclick = showHelp;
  el('btnHelpClose').onclick = hideHelp;
  // first visit on this device: open the guide before anything else
  // An invite link opens straight into the room, so do not put the guide in
  // the way. It is one tap away on the menu and in the lobby.
  if(!seenHelp() && !invitedCode()) showHelp();
  sync();
  // invites: a link that opens the game and joins the room in one tap
  el('btnWhatsApp').onclick = ()=>{
    const code = roomCodeEl.textContent;
    const text = `Join my Blast Yard game! Tap to play: ${inviteLink(code)}  (room code ${code})`;
    window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
  };
  el('btnCopy').onclick = async ()=>{
    const btn = el('btnCopy'), link = inviteLink(roomCodeEl.textContent);
    try { await navigator.clipboard.writeText(link); btn.textContent = 'Link copied'; }
    catch { window.prompt('Copy this link:', link); }
    setTimeout(()=>{ btn.textContent = 'Copy invite link'; }, 2000);
  };
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

/* The room code from an invite link (?room=ABCDE), if this page came from one. */
export function invitedCode(){
  const code = new URLSearchParams(location.search).get('room');
  return code && /^[A-Z0-9]{5}$/i.test(code) ? code.toUpperCase() : null;
}

function inviteLink(code){
  return location.origin + location.pathname + '?room=' + encodeURIComponent(code);
}

/* The name is remembered on this device so nobody retypes it every time. */
export function loadName(){
  try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; }
}
function saveName(name){
  try { localStorage.setItem(NAME_KEY, name); } catch { /* private mode, no matter */ }
}

function seenHelp(){
  try { return !!localStorage.getItem(HELP_KEY); } catch { return false; }
}
export function showHelp(){ help.classList.remove('hide'); help.scrollTop = 0; sync(); }
function hideHelp(){
  help.classList.add('hide');
  try { localStorage.setItem(HELP_KEY, '1'); } catch { /* private mode, no matter */ }
  sync();
}

/* While any screen is up, the touch pad and the stats line hide, so a thumb
   on the menu can never land on the stick underneath it. */
function sync(){
  const open = [menu, lobby, scoreboard, help].some(p=>!p.classList.contains('hide'));
  document.body.classList.toggle('menu-open', open);
}

export function setNote(text){ menuNote.textContent = text; menuNote.classList.remove('busy'); }

/* Connecting to the server, which can take up to a minute if it was asleep.
   The buttons lock so a second tap cannot get lost, and the note says what
   is happening instead of the screen looking frozen. */
export function setConnecting(text){
  const busy = !!text;
  menuButtons.forEach(b=>{ b.disabled = busy; });
  btnCancel.classList.toggle('hide', !busy);
  if(busy){ menuNote.textContent = text; menuNote.classList.add('busy'); }
  else menuNote.classList.remove('busy');
}

export function hideMenu(){ menu.classList.add('hide'); sync(); }
export function showMenu(){ setConnecting(''); menu.classList.remove('hide'); lobby.classList.add('hide'); scoreboard.classList.add('hide'); sync(); }
export function showLobby(){ setConnecting(''); menu.classList.add('hide'); lobby.classList.remove('hide'); sync(); }
export function hideLobby(){ lobby.classList.add('hide'); sync(); }
export function hideScoreboard(){ scoreboard.classList.add('hide'); sync(); }

/* The line under the board: what this player is carrying right now. */
export function setStats(p, label){
  let html = '';
  if(p && p.alive && p.bombs!=null){
    const chips = [
      `<span class="who">${esc(label)}</span>`,
      `<span>Bombs ${p.bombs}</span>`,
      `<span>Blast ${p.range}</span>`,
      p.speed ? `<span class="good">Speed +${p.speed}</span>` : '',
      p.fuse < 2.6 ? `<span class="good">Fuse ${p.fuse.toFixed(1)}s</span>` : '',
      p.kick ? '<span class="good">Kick</span>' : '',
      p.shield ? '<span class="good">Shield</span>' : '',
      p.curse ? '<span class="bad">Reversed</span>' : ''
    ];
    html = chips.join('');
  }else if(p && !p.alive){
    html = `<span class="who">${esc(label)}</span><span>Out this round</span>`;
  }
  if(html === lastStats) return;     // runs every frame, so only touch the DOM on a change
  lastStats = html;
  statsEl.innerHTML = html;
}

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
    ? 'Invite friends on WhatsApp, or share the code.'
    : 'Everyone here sees the same screen.';

  playerList.innerHTML = state.players.map(p=>{
    const tags = [
      p.owner ? '<span class="tag">owner</span>' : '',
      p.matches ? `<span class="tag wins">${p.matches} ${p.matches===1?'match':'matches'}</span>` : '',
      p.ready ? '<span class="tag ready">&#10003; ready</span>' : '<span class="tag">waiting</span>'
    ].join('');
    const label = (p.name || SLOT_NAME[p.slot]) + (p.slot===state.you ? ' (you)' : '');
    return `<li class="${p.slot===state.you?'me':''}">`
         + `<span class="dot" style="background:${SLOT_COLOR[p.slot]}"></span>`
         + `<span class="pname">${esc(label)}</span>${tags}</li>`;
  }).join('');

  // The button says what tapping it does, not what state you are in. A label
  // that reads "Not ready" looked like a status, so nobody knew to tap it.
  const iReady = !!(me && me.ready);
  btnReady.innerHTML = iReady ? '&#10003; I\'m ready <small>(tap to undo)</small>' : 'Tap when you\'re ready';
  btnReady.classList.toggle('on', iReady);
  btnReady.classList.toggle('ghost', false);
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

  // one line that always says who is holding things up and what to do next
  const owner = state.players.find(p=>p.owner);
  const ownerName = owner ? (owner.name || SLOT_NAME[owner.slot]) : 'the room owner';
  const total = state.players.length;
  const count = `${readyCount} of ${total} ready. `;
  let next;
  if(total < 2)        next = 'Share the code. You need at least one more player.';
  else if(!iReady)     next = iOwn ? 'Tap the yellow button when you\'re ready, then start the match.'
                                   : `Tap the yellow button when you're ready, so ${ownerName} can start.`;
  else if(readyCount < 2) next = 'Waiting for one more player to get ready.';
  else                 next = iOwn ? 'Everyone set? Start the match.'
                                   : `Waiting for ${ownerName} to start.`;
  lobbyNote.textContent = count + next;
}

/* The scoreboard between rounds. One pip per round it takes to win the match,
   filled in as they are won, so the state of the match reads at a glance. */
export function showScoreboard(end, mySlot){
  menu.classList.add('hide');
  lobby.classList.add('hide');
  scoreboard.classList.remove('hide');
  sync();

  sbTitle.textContent = end.matchOver
    ? `${end.champion || SLOT_NAME[end.championSlot]} wins the match`
    : (end.winner || end.winnerSlot===null
        ? `${end.winner || SLOT_NAME[end.winnerSlot]} takes the round`
        : 'Nobody survived');
  if(end.winnerSlot===null && !end.matchOver) sbTitle.textContent = 'Nobody survived';

  sbSub.textContent = `Round ${end.round} of best of ${end.bestOf}`;

  // the end of a match: who did what, the bit people screenshot
  const awards = end.matchOver && end.awards ? end.awards : [];
  sbAwards.classList.toggle('hide', !awards.length);
  sbAwards.innerHTML = awards.length ? '<h2>Awards</h2>' + awards.map(a=>{
    const who = a.slots.map((slot,i)=>esc(a.names[i] || SLOT_NAME[slot])).join(' & ');
    return `<div class="award"><span class="medal">${MEDALS[a.title]||'🏅'}</span>`
         + `<div><b>${esc(a.title)}: ${who}</b><span>${esc(a.detail)}</span></div></div>`;
  }).join('') : '';

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

const MEDALS = {
  'Demolition expert':'💥', 'Own worst enemy':'🤦', 'Flattened':'🧱',
  'Collector':'🎁', 'Bomb happy':'💣'
};

/* Names come from other people's browsers, so never trust them as markup. */
function esc(s){
  return s.replace(/[&<>"']/g, c => (
    {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]
  ));
}
