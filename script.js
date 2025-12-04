// ===========================
// Camera Setup
// ===========================
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

let currentStream;
let usingFrontCamera = false;

async function startCamera() {
  if (currentStream) {
    currentStream.getTracks().forEach(t => t.stop());
  }

  try {
    currentStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: usingFrontCamera ? "user" : "environment" }
    });

    video.srcObject = currentStream;
    video.play();
  } catch (err) {
    alert("Camera access blocked.");
  }
}

startCamera();

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

resizeCanvas();
window.addEventListener("resize", resizeCanvas);

// ===========================
// Drawing State
// ===========================
let mode = "dot"; // dot | vert | hori | angle
let lines = [];
let selectedId = null;

function drawEverything() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  lines.forEach(l => {
    ctx.lineWidth = 3;
    ctx.strokeStyle = l.id === selectedId ? "#4da3ff" : "white";
    ctx.beginPath();
    ctx.moveTo(l.x1, l.y1);
    ctx.lineTo(l.x2, l.y2);
    ctx.stroke();

    if (l.type === "dot") {
      ctx.beginPath();
      ctx.arc(l.x1, l.y1, 6, 0, Math.PI * 2);
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fill();
    }
  });
}

// ===========================
// Line Creation
// ===========================
canvas.addEventListener("click", (e) => {
  const x = e.clientX;
  const y = e.clientY;

  if (mode === "dot") {
    lines.push({ id: Date.now(), type: "dot", x1: x, y1: y, x2: x, y2: y });
  }

  if (mode === "vert") {
    lines.push({ id: Date.now(), type: "vert", x1: x, y1: 0, x2: x, y2: canvas.height });
  }

  if (mode === "hori") {
    lines.push({ id: Date.now(), type: "hori", x1: 0, y1: y, x2: canvas.width, y2: y });
  }

  if (mode === "angle") {
    lines.push({ id: Date.now(), type: "angle", x1: x - 80, y1: y + 80, x2: x + 80, y2: y - 80 });
  }

  drawEverything();
});

// ===========================
// Selection & Deletion
// ===========================
function distancePointToLine(px, py, x1, y1, x2, y2) {
  const A = px - x1;
  const B = py - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  const param = lenSq ? dot / lenSq : -1;

  let xx, yy;

  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }

  const dx = px - xx;
  const dy = py - yy;
  return Math.sqrt(dx * dx + dy * dy);
}

canvas.addEventListener("mousedown", (e) => {
  const x = e.clientX;
  const y = e.clientY;

  selectedId = null;

  lines.forEach(l => {
    const d = distancePointToLine(x, y, l.x1, l.y1, l.x2, l.y2);
    if (d < 15) selectedId = l.id;
  });

  drawEverything();
  document.getElementById("deleteBtn").style.display = selectedId ? "block" : "none";
});

document.getElementById("deleteBtn").addEventListener("click", () => {
  lines = lines.filter(l => l.id !== selectedId);
  selectedId = null;
  document.getElementById("deleteBtn").style.display = "none";
  drawEverything();
});

// ===========================
// UI Buttons
// ===========================
const modes = {
  dotBtn: "dot",
  vertBtn: "vert",
  horiBtn: "hori",
  angleBtn: "angle"
};

for (let id in modes) {
  document.getElementById(id).addEventListener("click", () => {
    mode = modes[id];
    document.querySelectorAll(".btn").forEach(b => b.classList.remove("active"));
    document.getElementById(id).classList.add("active");
  });
}

// Aspect ratios
const ratioBtns = document.querySelectorAll(".ratioBtn");
const ratioDisplay = document.getElementById("currentRatio");

ratioBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    const ratio = eval(btn.dataset.r);
    const h = window.innerHeight;
    const w = h * ratio;
    canvas.style.width = w + "px";
    canvas.style.margin = "0 auto";
    ratioDisplay.textContent = btn.textContent;
  });
});

// ===========================
// Capture
// ===========================
document.getElementById("captureBtn").addEventListener("click", () => {
  const temp = document.createElement("canvas");
  temp.width = canvas.width;
  temp.height = canvas.height;
  const tctx = temp.getContext("2d");

  tctx.drawImage(video, 0, 0, temp.width, temp.height);
  tctx.drawImage(canvas, 0, 0);

  const link = document.createElement("a");
  link.download = "viewfinder.png";
  link.href = temp.toDataURL("image/png");
  link.click();
});

// ===========================
// Switch Camera
// ===========================
document.getElementById("switchBtn").addEventListener("click", () => {
  usingFrontCamera = !usingFrontCamera;
  startCamera();
});

// ===========================
// Animation Loop
// ===========================
function animate() {
  drawEverything();
  requestAnimationFrame(animate);
}

animate();
