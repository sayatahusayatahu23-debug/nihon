
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const cameraBtn = document.getElementById("cameraBtn");

let stream = null;
let hands = null;
let running = false;
let busy = false;
let frameId = null;
let session = 0;

const connections = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [5,9],[9,10],[10,11],[11,12],
  [9,13],[13,14],[14,15],[15,16],
  [13,17],[17,18],[18,19],[19,20],
  [0,17]
];

function resizeCanvas() {
  if (!video.videoWidth || !video.videoHeight) return;

  if (canvas.width !== video.videoWidth ||
      canvas.height !== video.videoHeight) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  }
}

function drawResults(results) {
  resizeCanvas();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (const hand of results.multiHandLandmarks || []) {
    const pts = hand.map(p => ({
      x: (1 - p.x) * canvas.width,
      y: p.y * canvas.height
    }));

    ctx.beginPath();
    for (const [a, b] of connections) {
      ctx.moveTo(pts[a].x, pts[a].y);
      ctx.lineTo(pts[b].x, pts[b].y);
    }

    ctx.strokeStyle = "#00f0ff";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowColor = "#00f0ff";
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;

    for (let i = 0; i < pts.length; i++) {
      ctx.beginPath();
      ctx.arc(pts[i].x, pts[i].y, 3, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();

      ctx.beginPath();
      ctx.arc(pts[i].x, pts[i].y, 5, 0, Math.PI * 2);
      ctx.strokeStyle = "#00f0ff";
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  }
}

async function processFrame(mySession) {
  if (!running || mySession !== session) return;

  if (video.readyState >= 2 && !busy) {
    busy = true;

    try {
      await hands.send({ image: video });
    } catch (e) {
      console.error("Tracking error:", e);
    } finally {
      busy = false;
    }
  }

  if (running && mySession === session) {
    frameId = requestAnimationFrame(() => processFrame(mySession));
  }
}

async function startCamera() {
  if (running) return;

  const mySession = ++session;
  cameraBtn.disabled = true;

  try {
    if (!window.isSecureContext ||
        !navigator.mediaDevices?.getUserMedia) {
      throw new Error("Gunakan HTTPS atau localhost untuk kamera.");
    }

    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: "user",
        width: { ideal: 640 },
        height: { ideal: 960 }
      }
    });

    if (mySession !== session) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
      return;
    }

    video.srcObject = stream;
    await video.play();

    if (!hands) {
      hands = new Hands({
        locateFile: file =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
      });

      hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 0,
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.5
      });

      hands.onResults(drawResults);
    }

    running = true;
    cameraBtn.classList.add("active");
    cameraBtn.setAttribute("aria-label", "Matikan kamera");

    frameId = requestAnimationFrame(() => processFrame(mySession));
  } catch (e) {
    stopCamera();
    alert("Kamera tidak dapat dibuka: " + e.message);
  } finally {
    cameraBtn.disabled = false;
  }
}

function stopCamera() {
  session++;
  running = false;

  if (frameId !== null) {
    cancelAnimationFrame(frameId);
    frameId = null;
  }

  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }

  video.srcObject = null;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  cameraBtn.classList.remove("active");
  cameraBtn.setAttribute("aria-label", "Aktifkan kamera");
}

cameraBtn.addEventListener("click", () => {
  if (running) {
    stopCamera();
  } else {
    startCamera();
  }
});

window.addEventListener("pagehide", stopCamera);
