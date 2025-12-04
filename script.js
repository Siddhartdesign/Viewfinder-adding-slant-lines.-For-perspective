<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Layout Lens</title>

<style>
  html, body {
    margin: 0;
    padding: 0;
    overflow: hidden;
    background: #000;
    height: 100%;
  }

  video, canvas {
    position: absolute;
    top: 0; left: 0;
    width: 100vw;
    height: 100vh;
    object-fit: cover;
  }

  #toolbar {
    position: fixed;
    bottom: 14px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 8px;
    background: rgba(0,0,0,0.55);
    padding: 10px 12px;
    border-radius: 14px;
    backdrop-filter: blur(6px);
    z-index: 50;
  }

  .btn {
    padding: 8px 12px;
    border-radius: 8px;
    border: none;
    background: rgba(255,255,255,0.85);
    font-size: 14px;
    font-weight: 600;
  }

  .btn.active {
    background: #4da3ff;
    color: #fff;
  }

  #deleteBtn {
    display: none;
  }

  #note {
    position: fixed;
    top: 12px;
    left: 12px;
    padding: 6px 10px;
    font-size: 14px;
    background: rgba(0,0,0,0.45);
    color: #fff;
    border-radius: 8px;
    z-index: 40;
  }
</style>
</head>

<body>

<video id="video" autoplay playsinline muted></video>
<canvas id="canvas"></canvas>

<div id="note">
  Frame: <span id="currentRatio">1:1</span>
</div>

<div id="toolbar">
  <button id="dotBtn" class="btn active">Dot</button>
  <button id="vertBtn" class="btn">│</button>
  <button id="horiBtn" class="btn">—</button>
  <button id="angleBtn" class="btn">Angle</button>

  <!-- ratios -->
  <button class="btn ratioBtn" data-r="1">1:1</button>
  <button class="btn ratioBtn" data-r="5/7">5:7</button>
  <button class="btn ratioBtn" data-r="4/5">4:5</button>
  <button class="btn ratioBtn" data-r="1.618">Golden</button>

  <!-- delete appears only when line selected -->
  <button id="deleteBtn" class="btn">🗑</button>

  <button id="captureBtn" class="btn">📸</button>
  <button id="switchBtn" class="btn">Switch</button>
</div>

<script src="script.js"></script>

</body>
</html>
