/* Keyboard and touch.

   Everything here produces the same little object the simulation understands:
   {u,d,l,r,b,k} where each value is 0 or 1. Nothing else in the game needs to
   know whether that came from a key, a thumb or a network packet. */

const keys = Object.create(null);

const LOCAL_MAP = [
  {u:'ArrowUp',d:'ArrowDown',l:'ArrowLeft',r:'ArrowRight',b:'Enter',k:'ShiftRight'},
  {u:'KeyW',d:'KeyS',l:'KeyA',r:'KeyD',b:'KeyQ',k:'KeyE'},
  {u:'KeyU',d:'KeyJ',l:'KeyH',r:'KeyK',b:'KeyN',k:'KeyM'},
  {u:'Numpad8',d:'Numpad5',l:'Numpad4',r:'Numpad6',b:'NumpadDecimal',k:'Numpad0'}
];

const touch={u:0,d:0,l:0,r:0,b:0,k:0};

let dpad=null, kickBtn=null;
const cells={};

/* `onRestart` fires on R and on a tap of the canvas. The caller decides
   whether a restart is allowed. */
export function init({ canvas, onRestart }){
  addEventListener('keydown',e=>{
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
    keys[e.code]=true;
    if(e.code==='KeyR') onRestart();
  });
  addEventListener('keyup',e=>{ keys[e.code]=false; });
  addEventListener('blur',()=>{ for(const k in keys) keys[k]=false; });

  canvas.addEventListener('pointerdown',()=>onRestart());

  if(matchMedia('(pointer: coarse)').matches || location.search.includes('pad')){
    document.body.classList.add('touch');
  }

  dpad=document.getElementById('dpad');
  kickBtn=document.getElementById('kickBtn');
  document.querySelectorAll('#dpad [data-k]').forEach(el=>{ cells[el.dataset.k]=el; });

  // d-pad: one touch surface. Direction comes from where your thumb is,
  // so you can slide between directions without lifting your finger.
  dpad.addEventListener('pointerdown',e=>{ e.preventDefault(); dpad.setPointerCapture(e.pointerId); setDir(e); });
  dpad.addEventListener('pointermove',e=>{ if(e.buttons||e.pointerType==='touch') setDir(e); });
  dpad.addEventListener('pointerup',e=>{ e.preventDefault(); clearDir(); });
  dpad.addEventListener('pointercancel',clearDir);
  dpad.addEventListener('contextmenu',e=>e.preventDefault());

  // action buttons
  document.querySelectorAll('#actions [data-k]').forEach(el=>{
    const k=el.dataset.k;
    el.addEventListener('pointerdown',e=>{ e.preventDefault(); el.setPointerCapture(e.pointerId); touch[k]=1; el.classList.add('on'); });
    const off=()=>{ touch[k]=0; el.classList.remove('on'); };
    el.addEventListener('pointerup',off);
    el.addEventListener('pointercancel',off);
    el.addEventListener('contextmenu',e=>e.preventDefault());
  });
  addEventListener('pointerup',()=>{
    touch.b=0; touch.k=0; clearDir();
    document.querySelectorAll('.on').forEach(el=>el.classList.remove('on'));
  });
}

function clearDir(){
  touch.u=touch.d=touch.l=touch.r=0;
  for(const k in cells) cells[k].classList.remove('on');
}

function setDir(e){
  const rect=dpad.getBoundingClientRect();
  const x=e.clientX-rect.left-rect.width/2;
  const y=e.clientY-rect.top-rect.height/2;
  const dead=rect.width*0.10;
  clearDir();
  if(Math.abs(x)<dead && Math.abs(y)<dead) return;
  const k = Math.abs(x)>Math.abs(y) ? (x>0?'r':'l') : (y>0?'d':'u');
  touch[k]=1;
  cells[k].classList.add('on');
}

/* Player `i` on a shared keyboard. Only player one also gets the touch pad. */
export function readLocal(i){
  const m = LOCAL_MAP[i];
  const t = i===0 ? touch : {u:0,d:0,l:0,r:0,b:0,k:0};
  return {
    u:+!!(keys[m.u]||t.u), d:+!!(keys[m.d]||t.d),
    l:+!!(keys[m.l]||t.l), r:+!!(keys[m.r]||t.r),
    b:+!!(keys[m.b]||t.b), k:+!!(keys[m.k]||t.k)
  };
}

/* This browser's own player, online. Accepts either arrow keys or WASD. */
export function readMine(){
  return {
    u:+!!(keys.ArrowUp||keys.KeyW||touch.u),
    d:+!!(keys.ArrowDown||keys.KeyS||touch.d),
    l:+!!(keys.ArrowLeft||keys.KeyA||touch.l),
    r:+!!(keys.ArrowRight||keys.KeyD||touch.r),
    b:+!!(keys.Space||keys.Enter||touch.b),
    k:+!!(keys.KeyK||keys.ShiftLeft||touch.k)
  };
}

/* The kick button only appears once you have picked kick up. */
export function setKickVisible(on){
  if(kickBtn) kickBtn.classList.toggle('hide', !on);
}
