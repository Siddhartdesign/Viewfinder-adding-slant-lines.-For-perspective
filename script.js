// Layout Lens — Add Angle Line (two endpoints) + dragging endpoints + delete

const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const dotBtn = document.getElementById('dotBtn');
const vertBtn = document.getElementById('vertBtn');
const horiBtn = document.getElementById('horiBtn');
const angleBtn = document.getElementById('angleBtn');
const ratioBtns = Array.from(document.querySelectorAll('.ratioBtn'));

const deleteBtn = document.getElementById('deleteBtn');
const captureBtn = document.getElementById('captureBtn');
const switchBtn = document.getElementById('switchBtn');

const currentRatioLabel = document.getElementById('currentRatio');

let mode = 'dot'; // dot | vertical | horizontal | angle
let dots = [];
let lines = [];
let selected = null;
let isDragging = false;
let dragInfo = null;

let devices = [];
let currentDeviceIndex = 0;
let stream = null;

let frame = { x:0, y:0, w:0, h:0, ratio:1 };

// ---------- camera ----------
async function enumerateDevices(){
  try {
    const all = await navigator.mediaDevices.enumerateDevices();
    devices = all.filter(d=>d.kind==='videoinput');
  } catch(e){ devices=[] }
}

async function startCameraPreferRear(){
  try {
    const s = await navigator.mediaDevices.getUserMedia({
      video:{ facingMode:{ ideal:'environment' } }
    });
    attachStream(s);
    await enumerateDevices();
    return;
  } catch(e){}

  try {
    const s2 = await navigator.mediaDevices.getUserMedia({ video:true });
    attachStream(s2);
    await enumerateDevices();
  } catch(e2){
    alert('Camera error');
  }
}

function attachStream(s){
  if(stream) stream.getTracks().forEach(t=>t.stop());
  stream = s;
  video.srcObject = s;
}

async function switchCamera(){
  await enumerateDevices();
  if(!devices.length) return;

  currentDeviceIndex = (currentDeviceIndex+1)%devices.length;
  const id = devices[currentDeviceIndex].deviceId;

  try {
    const s = await navigator.mediaDevices.getUserMedia({
      video:{ deviceId:{ exact:id } }
    });
    attachStream(s);
  } catch(e){
    await startCameraPreferRear();
  }
}

// ---------- frame ----------
function computeFrame(ratio){
  const W=canvas.width, H=canvas.height, margin=0.92;
  let boxW, boxH;
  if (W/H > ratio){
    boxH = H*margin;
    boxW = boxH*ratio;
  } else {
    boxW = W*margin;
    boxH = boxW/ratio;
  }
  const x = Math.round((W-boxW)/2), y = Math.round((H-boxH)/2);
  frame = { x, y, w: Math.round(boxW), h: Math.round(boxH), ratio };
  currentRatioLabel.textContent = ratio===1.618 ? 'Golden' : (Math.round(ratio*1000)/1000);
}

// ---------- drawing ----------
function drawMaskAndBorder(){
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0,0,canvas.width,frame.y);
  ctx.fillRect(0,frame.y+frame.h,canvas.width,canvas.height-(frame.y+frame.h));
  ctx.fillRect(0,frame.y,frame.x,frame.h);
  ctx.fillRect(frame.x+frame.w,frame.y,canvas.width-(frame.x+frame.w),frame.h);

  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = 3;
  ctx.strokeRect(frame.x+1.5,frame.y+1.5,frame.w-3,frame.h-3);
}

function redraw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  drawMaskAndBorder();

  // dots
  for(const d of dots){
    ctx.fillStyle = '#4da3ff';
    ctx.beginPath();
    ctx.arc(d.x,d.y,8,0,Math.PI*2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // lines
  for(let i=0;i<lines.length;i++){
    const l = lines[i];
    const sel = (i===selected);

    if (sel){
      ctx.shadowColor = 'cyan';
      ctx.shadowBlur = 14;
      ctx.strokeStyle = 'cyan';
      ctx.lineWidth = 4;
    } else {
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'lime';
      ctx.lineWidth = 3;
    }

    ctx.beginPath();
    if (l.type==='vertical'){
      ctx.moveTo(l.x, frame.y);
      ctx.lineTo(l.x, frame.y+frame.h);
    } else if (l.type==='horizontal'){
      ctx.moveTo(frame.x, l.y);
      ctx.lineTo(frame.x+frame.w, l.y);
    } else if (l.type==='angle'){
      ctx.moveTo(l.x1, l.y1);
      ctx.lineTo(l.x2, l.y2);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // draw endpoints when selected
    if (sel && l.type==='angle'){
      drawHandle(l.x1, l.y1);
      drawHandle(l.x2, l.y2);
    }
  }
}

function drawHandle(x,y){
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(x,y,8,0,Math.PI*2);
  ctx.fill();

  ctx.fillStyle = '#4da3ff';
  ctx.beginPath();
  ctx.arc(x,y,5,0,Math.PI*2);
  ctx.fill();
}

// ---------- hit detection ----------
function dist2(x1,y1,x2,y2){
  const dx=x1-x2, dy=y1-y2;
  return Math.sqrt(dx*dx+dy*dy);
}

function findHit(x,y){
  const threshold = 18;

  // check endpoints first
  for(let i=0;i<lines.length;i++){
    const l = lines[i];
    if (l.type==='angle'){
      if (dist2(x,y,l.x1,l.y1) < threshold) return { idx:i, kind:'endpoint', which:1 };
      if (dist2(x,y,l.x2,l.y2) < threshold) return { idx:i, kind:'endpoint', which:2 };
    }
  }

  // check line proximity
  for(let i=0;i<lines.length;i++){
    const l = lines[i];

    if (l.type==='vertical'){
      if (Math.abs(x-l.x) < threshold && y>=frame.y && y<=frame.y+frame.h)
        return { idx:i, kind:'line' };
    }

    else if (l.type==='horizontal'){
      if (Math.abs(y-l.y) < threshold && x>=frame.x && x<=frame.x+frame.w)
        return { idx:i, kind:'line' };
    }

    else if (l.type==='angle'){
      // distance from point to segment
      const A={x:l.x1,y:l.y1}, B={x:l.x2,y:l.y2};
      const vx=B.x-A.x, vy=B.y-A.y;
      const wx=x-A.x, wy=y-A.y;

      const c1 = vx*wx + vy*wy;
      const c2 = vx*vx + vy*vy;

      let t = (c2===0 ? 0 : c1/c2);
      t = Math.max(0, Math.min(1,t));

      const px = A.x + vx*t;
      const py = A.y + vy*t;

      const d = dist2(x,y,px,py);
      if (d < threshold) return { idx:i, kind:'line' };
    }
  }

  return null;
}

function insideFrame(x,y){
  return (x>=frame.x && x<=frame.x+frame.w &&
          y>=frame.y && y<=frame.y+frame.h);
}

// ---------- pointer events ----------
canvas.addEventListener('pointerdown', (e)=>{
  const x=e.clientX, y=e.clientY;
  const hit = findHit(x,y);

  if (hit){
    if (hit.kind==='endpoint'){
      if (selected===hit.idx){
        isDragging = true;
        dragInfo = { kind:'endpoint', idx:hit.idx, which:hit.which };
      } else {
        selected = hit.idx;
        deleteBtn.style.display = 'inline-block';
      }
      redraw(); return;
    }

    if (hit.kind==='line'){
      if (selected===hit.idx){
        const l = lines[hit.idx];
        isDragging = true;
        dragInfo = {
          kind:'line',
          idx:hit.idx,
          startX:x,
          startY:y,
          orig: JSON.parse(JSON.stringify(l))
        };
      } else {
        selected = hit.idx;
        deleteBtn.style.display='inline-block';
      }
      redraw(); return;
    }
  }

  // empty tap
  selected = null;
  deleteBtn.style.display = 'none';

  if (!insideFrame(x,y)){ redraw(); return; }

  if (mode==='dot'){
    dots.push({x,y});
    redraw(); return;
  }

  if (mode==='vertical'){
    const cx = Math.max(frame.x, Math.min(frame.x+frame.w, x));
    lines.push({ type:'vertical', x:cx });
    selected = lines.length-1; deleteBtn.style.display='inline-block'; redraw(); return;
  }

  if (mode==='horizontal'){
    const cy = Math.max(frame.y, Math.min(frame.y+frame.h, y));
    lines.push({ type:'horizontal', y:cy });
    selected = lines.length-1; deleteBtn.style.display='inline-block'; redraw(); return;
  }

  if (mode==='angle'){
    if (!window._pendingAngle){
      window._pendingAngle = { x1:x, y1:y };
      redraw();
      return;
    } else {
      const p = window._pendingAngle;
      lines.push({
        type:'angle',
        x1:p.x1, y1:p.y1,
        x2:x,    y2:y
      });
      window._pendingAngle = null;
      selected = lines.length-1;
      deleteBtn.style.display='inline-block';
      redraw();
      return;
    }
  }
});

canvas.addEventListener('pointermove', (e)=>{
  if (!isDragging || !dragInfo) return;
  const x=e.clientX, y=e.clientY;
  const info = dragInfo;
  const l = lines[info.idx];

  if (info.kind==='endpoint' && l.type==='angle'){
    if (info.which===1){
      l.x1 = Math.max(frame.x, Math.min(frame.x+frame.w, x));
      l.y1 = Math.max(frame.y, Math.min(frame.y+frame.h, y));
    } else {
      l.x2 = Math.max(frame.x, Math.min(frame.x+frame.w, x));
      l.y2 = Math.max(frame.y, Math.min(

Below is the **complete script.js**, fully concatenated and finished.  
The message exceeded length previously, so here it is **again from the top**, clean and complete.

Just **replace your entire script.js** with this.

It matches your working version + the new Angle tool, drag endpoints, drag line body, delete, dots, vertical/horizontal lines, capture, switch camera fallback, frame ratios, glow, everything.

No missing lines.  
No cuts.  
No placeholders.

---

# ✅ **FULL script.js (FINAL, COMPLETE)**

```javascript
// Layout Lens — Add Angle Line (two endpoints) + dragging endpoints + delete

const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const dotBtn = document.getElementById('dotBtn');
const vertBtn = document.getElementById('vertBtn');
const horiBtn = document.getElementById('horiBtn');
const angleBtn = document.getElementById('angleBtn');
const ratioBtns = Array.from(document.querySelectorAll('.ratioBtn'));

const deleteBtn = document.getElementById('deleteBtn');
const captureBtn = document.getElementById('captureBtn');
const switchBtn = document.getElementById('switchBtn');

const currentRatioLabel = document.getElementById('currentRatio');

let mode = 'dot'; // dot | vertical | horizontal | angle
let dots = [];
let lines = [];
let selected = null;
let isDragging = false;
let dragInfo = null;

let devices = [];
let currentDeviceIndex = 0;
let stream = null;

let frame = { x:0, y:0, w:0, h:0, ratio:1 };

// ---------- camera ----------
async function enumerateDevices(){
  try {
    const all = await navigator.mediaDevices.enumerateDevices();
    devices = all.filter(d=>d.kind==='videoinput');
  } catch(e){ devices=[] }
}

async function startCameraPreferRear(){
  try {
    const s = await navigator.mediaDevices.getUserMedia({
      video:{ facingMode:{ ideal:'environment' } }
    });
    attachStream(s);
    await enumerateDevices();
    return;
  } catch(e){}

  try {
    const s2 = await navigator.mediaDevices.getUserMedia({ video:true });
    attachStream(s2);
    await enumerateDevices();
  } catch(e2){
    alert('Camera error');
  }
}

function attachStream(s){
  if(stream) stream.getTracks().forEach(t=>t.stop());
  stream = s;
  video.srcObject = s;
}

async function switchCamera(){
  await enumerateDevices();
  if(!devices.length) return;

  currentDeviceIndex = (currentDeviceIndex+1)%devices.length;
  const id = devices[currentDeviceIndex].deviceId;

  try {
    const s = await navigator.mediaDevices.getUserMedia({
      video:{ deviceId:{ exact:id } }
    });
    attachStream(s);
  } catch(e){
    await startCameraPreferRear();
  }
}

// ---------- frame ----------
function computeFrame(ratio){
  const W=canvas.width, H=canvas.height, margin=0.92;
  let boxW, boxH;
  if (W/H > ratio){
    boxH = H*margin;
    boxW = boxH*ratio;
  } else {
    boxW = W*margin;
    boxH = boxW/ratio;
  }
  const x = Math.round((W-boxW)/2), y = Math.round((H-boxH)/2);
  frame = { x, y, w: Math.round(boxW), h: Math.round(boxH), ratio };
  currentRatioLabel.textContent = ratio===1.618 ? 'Golden' : (Math.round(ratio*1000)/1000);
}

// ---------- drawing ----------
function drawMaskAndBorder(){
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0,0,canvas.width,frame.y);
  ctx.fillRect(0,frame.y+frame.h,canvas.width,canvas.height-(frame.y+frame.h));
  ctx.fillRect(0,frame.y,frame.x,frame.h);
  ctx.fillRect(frame.x+frame.w,frame.y,canvas.width-(frame.x+frame.w),frame.h);

  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = 3;
  ctx.strokeRect(frame.x+1.5,frame.y+1.5,frame.w-3,frame.h-3);
}

function redraw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  drawMaskAndBorder();

  // dots
  for(const d of dots){
    ctx.fillStyle = '#4da3ff';
    ctx.beginPath();
    ctx.arc(d.x,d.y,8,0,Math.PI*2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // lines
  for(let i=0;i<lines.length;i++){
    const l = lines[i];
    const sel = (i===selected);

    if (sel){
      ctx.shadowColor = 'cyan';
      ctx.shadowBlur = 14;
      ctx.strokeStyle = 'cyan';
      ctx.lineWidth = 4;
    } else {
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'lime';
      ctx.lineWidth = 3;
    }

    ctx.beginPath();
    if (l.type==='vertical'){
      ctx.moveTo(l.x, frame.y);
      ctx.lineTo(l.x, frame.y+frame.h);
    } else if (l.type==='horizontal'){
      ctx.moveTo(frame.x, l.y);
      ctx.lineTo(frame.x+frame.w, l.y);
    } else if (l.type==='angle'){
      ctx.moveTo(l.x1, l.y1);
      ctx.lineTo(l.x2, l.y2);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // draw endpoints when selected
    if (sel && l.type==='angle'){
      drawHandle(l.x1, l.y1);
      drawHandle(l.x2, l.y2);
    }
  }
}

function drawHandle(x,y){
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(x,y,8,0,Math.PI*2);
  ctx.fill();

  ctx.fillStyle = '#4da3ff';
  ctx.beginPath();
  ctx.arc(x,y,5,0,Math.PI*2);
  ctx.fill();
}

// ---------- hit detection ----------
function dist2(x1,y1,x2,y2){
  const dx=x1-x2, dy=y1-y2;
  return Math.sqrt(dx*dx+dy*dy);
}

function findHit(x,y){
  const threshold = 18;

  // check endpoints first
  for(let i=0;i<lines.length;i++){
    const l = lines[i];
    if (l.type==='angle'){
      if (dist2(x,y,l.x1,l.y1) < threshold) return { idx:i, kind:'endpoint', which:1 };
      if (dist2(x,y,l.x2,l.y2) < threshold) return { idx:i, kind:'endpoint', which:2 };
    }
  }

  // check line proximity
  for(let i=0;i<lines.length;i++){
    const l = lines[i];

    if (l.type==='vertical'){
      if (Math.abs(x-l.x) < threshold && y>=frame.y && y<=frame.y+frame.h)
        return { idx:i, kind:'line' };
    }

    else if (l.type==='horizontal'){
      if (Math.abs(y-l.y) < threshold && x>=frame.x && x<=frame.x+frame.w)
        return { idx:i, kind:'line' };
    }

    else if (l.type==='angle'){
      // distance from point to segment
      const A={x:l.x1,y:l.y1}, B={x:l.x2,y:l.y2};
      const vx=B.x-A.x, vy=B.y-A.y;
      const wx=x-A.x, wy=y-A.y;

      const c1 = vx*wx + vy*wy;
      const c2 = vx*vx + vy*vy;

      let t = (c2===0 ? 0 : c1/c2);
      t = Math.max(0, Math.min(1,t));

      const px = A.x + vx*t;
      const py = A.y + vy*t;

      const d = dist2(x,y,px,py);
      if (d < threshold) return { idx:i, kind:'line' };
    }
  }

  return null;
}

function insideFrame(x,y){
  return (x>=frame.x && x<=frame.x+frame.w &&
          y>=frame.y && y<=frame.y+frame.h);
}

// ---------- pointer events ----------
canvas.addEventListener('pointerdown', (e)=>{
  const x=e.clientX, y=e.clientY;
  const hit = findHit(x,y);

  if (hit){
    if (hit.kind==='endpoint'){
      if (selected===hit.idx){
        isDragging = true;
        dragInfo = { kind:'endpoint', idx:hit.idx, which:hit.which };
      } else {
        selected = hit.idx;
        deleteBtn.style.display = 'inline-block';
      }
      redraw(); return;
    }

    if (hit.kind==='line'){
      if (selected===hit.idx){
        const l = lines[hit.idx];
        isDragging = true;
        dragInfo = {
          kind:'line',
          idx:hit.idx,
          startX:x,
          startY:y,
          orig: JSON.parse(JSON.stringify(l))
        };
      } else {
        selected = hit.idx;
        deleteBtn.style.display='inline-block';
      }
      redraw(); return;
    }
  }

  // empty tap
  selected = null;
  deleteBtn.style.display = 'none';

  if (!insideFrame(x,y)){ redraw(); return; }

  if (mode==='dot'){
    dots.push({x,y});
    redraw(); return;
  }

  if (mode==='vertical'){
    const cx = Math.max(frame.x, Math.min(frame.x+frame.w, x));
    lines.push({ type:'vertical', x:cx });
    selected = lines.length-1; deleteBtn.style.display='inline-block'; redraw(); return;
  }

  if (mode==='horizontal'){
    const cy = Math.max(frame.y, Math.min(frame.y+frame.h, y));
    lines.push({ type:'horizontal', y:cy });
    selected = lines.length-1; deleteBtn.style.display='inline-block'; redraw(); return;
  }

  if (mode==='angle'){
    if (!window._pendingAngle){
      window._pendingAngle = { x1:x, y1:y };
      redraw();
      return;
    } else {
      const p = window._pendingAngle;
      lines.push({
        type:'angle',
        x1:p.x1, y1:p.y1,
        x2:x,    y2:y
      });
      window._pendingAngle = null;
      selected = lines.length-1;
      deleteBtn.style.display='inline-block';
      redraw();
      return;
    }
  }
});

canvas.addEventListener('pointermove', (e)=>{
  if (!isDragging || !dragInfo) return;
  const x=e.clientX, y=e.clientY;
  const info = dragInfo;
  const l = lines[info.idx];

  if (info.kind==='endpoint' && l.type==='angle'){
    if (info.which===1){
      l.x1 = Math.max(frame.x, Math.min(frame.x+frame.w, x));
      l.y1 = Math.max(frame.y, Math.min(frame.y+frame.h, y));
    } else {
      l.x2 = Math.max(frame.x, Math.min(frame.x+frame.w, x));
      l.y2 = Math.max(frame.y, Math.min(frame.y+frame.h, y));
    }
    redraw();
    return;
  }

  if (info.kind==='line'){
    if (l.type === 'vertical'){
      l.x = Math.max(frame.x, Math.min(frame.x+frame.w, x));
    } else if (l.type === 'horizontal'){
      l.y = Math.max(frame.y, Math.min(frame.y+frame.h, y));
    } else if (l.type === 'angle'){
      const dx = x - info.startX;
      const dy = y - info.startY;
      l.x1 = Math.max(frame.x, Math.min(frame.x+frame.w, info.orig.x1 + dx));
      l.y1 = Math.max(frame.y, Math.min(frame.y+frame.h, info.orig.y1 + dy));
      l.x2 = Math.max(frame.x, Math.min(frame.x+frame.w, info.orig.x2 + dx));
      l.y2 = Math.max(frame.y, Math.min(frame.y+frame.h, info.orig.y2 + dy));
    }
    redraw();
    return;
  }
});

canvas.addEventListener('pointerup', ()=>{
  isDragging = false;
  dragInfo = null;
});

// ---------- modes ----------
function setMode(m, id){
  mode = m;
  [dotBtn, vertBtn, horiBtn, angleBtn].forEach(b=>b.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window._pendingAngle = null;
  redraw();
}
dotBtn.onclick = ()=> setMode('dot','dotBtn');
vertBtn.onclick = ()=> setMode('vertical','vertBtn');
horiBtn.onclick = ()=> setMode('horizontal','horiBtn');
angleBtn.onclick = ()=> setMode('angle','angleBtn');

ratioBtns.forEach(btn=>{
  btn.onclick = ()=>{
    ratioBtns.forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const v = btn.dataset.r;
    const ratio = v.includes('/') ? eval(v) : parseFloat(v);
    computeFrame(ratio); redraw();
  };
});

// ---------- delete ----------
deleteBtn.onclick = ()=>{
  if (selected!==null){
    lines.splice(selected,1);
    selected = null;
    deleteBtn.style.display = 'none';
    redraw();
  }
};

// ---------- capture ----------
captureBtn.onclick = ()=>{
  const tmp = document.createElement('canvas');
  tmp.width = canvas.width;
  tmp.height = canvas.height;
  const tctx = tmp.getContext('2d');

  tctx.drawImage(video,0,0,tmp.width,tmp.height);

  tctx.fillStyle='rgba(0,0,0,0.45)';
  tctx.fillRect(0,0,tmp.width, frame.y);
  tctx.fillRect(0,frame.y+frame.h, tmp.width, tmp.height-(frame.y+frame.h));
  tctx.fillRect(0,frame.y, frame.x, frame.h);
  tctx.fillRect(frame.x+frame.w,frame.y, tmp.width-(frame.x+frame.w), frame.h);

  tctx.strokeStyle='rgba(255,255,255,0.95)';
  tctx.lineWidth=3;
  tctx.strokeRect(frame.x+1.5,frame.y+1.5,frame.w-3,frame.h-3);

  for(const d of dots){
    tctx.fillStyle='#4da3ff';
    tctx.beginPath(); tctx.arc(d.x,d.y,8,0,Math.PI*2); tctx.fill();
    tctx.strokeStyle='#fff';
    tctx.lineWidth=2;
    tctx.stroke();
  }

  for(const l of lines){
    tctx.strokeStyle='lime';
    tctx.lineWidth=4;
    tctx.beginPath();
    if (l.type==='vertical'){
      tctx.moveTo(l.x,frame.y);
      tctx.lineTo(l.x,frame.y+frame.h);
    } else if (l.type==='horizontal'){
      tctx.moveTo(frame.x,l.y);
      tctx.lineTo(frame.x+frame.w,l.y);
    } else if (l.type==='angle'){
      tctx.moveTo(l.x1,l.y1);
      tctx.lineTo(l.x2,l.y2);
    }
    tctx.stroke();
  }

  const url = tmp.toDataURL('image/png');
  const win = window.open();
  win.document.write(`<img src="${url}" style="width:100%;">`);
};

// ---------- init/resize loop ----------
function resize(){
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  computeFrame(frame.ratio || 1);
  redraw();
}
window.addEventListener('resize', resize);

(async function init(){
  await startCameraPreferRear();
  await enumerateDevices();
  computeFrame(1);
  resize();
  function loop(){
    if (window._pendingAngle){
      redraw();
      ctx.fillStyle='rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.arc(window._pendingAngle.x1, window._pendingAngle.y1,7,0,Math.PI*2);
      ctx.fill();
    }
    requestAnimationFrame(loop);
  }
  loop();
})();
