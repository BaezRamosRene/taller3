// === CONFIG: URL de tu API en Render ===
// Si tu URL es otra, cambiala acá:
const API_BASE = 'https://server-jzk9.onrender.com';

// === Opciones ===
const OPTIONS = [
  { id: "op1", label: "Opción 1", color: "#E11D48" },
  { id: "op2", label: "Opción 2", color: "#2563EB" },
  { id: "op3", label: "Opción 3", color: "#059669" },
  { id: "op4", label: "Opción 4", color: "#A855F7" },
];

// === Estado y referencias ===
let selected = null, objectURL = null, totals = {}, hasVoted = false;
let stream = null; // cámara

const elOptions = document.getElementById("options");
const elFile = document.getElementById("fileInput");
const elPreview = document.getElementById("preview");
const elPreviewImg = document.getElementById("previewImg");
const elOverlay = document.getElementById("overlay");
const elFilterInfo = document.getElementById("filterInfo");
const elConfirm = document.getElementById("confirmBtn");
const elReset = document.getElementById("resetBtn");
const elResults = document.getElementById("results");
const elTotalVotes = document.getElementById("totalVotes");

const elOpenCam = document.getElementById("openCamBtn");
const elSnap = document.getElementById("snapBtn");
const elCloseCam = document.getElementById("closeCamBtn");
const elVideo = document.getElementById("camVideo");
const elCanvas = document.getElementById("renderCanvas");
const elShare = document.getElementById("shareBtn");

// === Servicio de API ===
const VoteService = {
  async getTotals() {
    const r = await fetch(`${API_BASE}/api/poll/totals`, { cache: 'no-store' });
    if (!r.ok) throw new Error('GET totals failed');
    return r.json();
  },
  async addVote(optionId) {
    const r = await fetch(`${API_BASE}/api/poll/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ optionId })
    });
    if (!r.ok) throw new Error('POST vote failed');
    const data = await r.json();
    return data.totals;
  }
};

// === Init ===
init();
async function init() {
  renderOptions();
  try { totals = await VoteService.getTotals(); }
  catch { totals = { op1:0, op2:0, op3:0, op4:0 }; }
  renderResults();
  bindEvents();
}

function bindEvents() {
  elFile.addEventListener("change", onFileChange);
  elConfirm.addEventListener("click", onSubmit);
  elReset.addEventListener("click", resetFlow);

  elPreview.addEventListener("dragover", (e)=>{e.preventDefault();});
  elPreview.addEventListener("drop", (e)=>{
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) readFile(f);
  });

  // Cámara
  elOpenCam.addEventListener("click", startCamera);
  elCloseCam.addEventListener("click", stopCamera);
  elSnap.addEventListener("click", takePhoto);

  // Compartir
  elShare.addEventListener("click", shareCurrentImage);
}

// === UI opciones ===
function renderOptions() {
  elOptions.innerHTML = "";
  OPTIONS.forEach(opt => {
    const btn = document.createElement("button");
    btn.className = "option"; btn.type = "button";
    btn.setAttribute("aria-pressed", selected === opt.id ? "true" : "false");
    btn.innerHTML = `
      <span class="swatch" style="background:${opt.color}"></span>
      <span class="label" style="font-weight:600">${opt.label}</span>
      <div class="small" style="margin-top:6px">Color: ${opt.color}</div>
    `;
    btn.addEventListener("click", ()=>{
      selected = opt.id;
      renderOptions();
      renderOverlay();
    });
    elOptions.appendChild(btn);
  });
}

// === Upload ===
function onFileChange(e) {
  const file = e.target.files?.[0];
  if (file) readFile(file);
}

function readFile(file) {
  if (objectURL) URL.revokeObjectURL(objectURL);
  objectURL = URL.createObjectURL(file);
  elPreviewImg.src = objectURL;
  elPreviewImg.hidden = false;
  elVideo.hidden = true;
  renderOverlay();
}

// === Overlay/Filtro visual ===
function renderOverlay() {
  const opt = OPTIONS.find(o => o.id === selected) || null;
  if (opt) {
    elOverlay.style.background = opt.color;
    elFilterInfo.textContent = `Filtro aplicado: ${opt.label} (${opt.color})`;
  } else {
    elOverlay.style.background = "transparent";
    elFilterInfo.textContent = "";
  }
}

// === Confirmar voto ===
async function onSubmit() {
  if (!selected) return alert("Elegí una opción primero.");
  if ((elPreviewImg.hidden || !elPreviewImg.src) && (elVideo.hidden || !stream)) {
    return alert("Subí una foto o usá la cámara antes de votar.");
  }
  try {
    const newTotals = await VoteService.addVote(selected);
    totals = newTotals;
  } catch (e) {
    alert('No pude conectarme a la API. Revisá la URL de API_BASE.');
    return;
  }
  hasVoted = true;
  renderResults();
}

// === Resultados ===
function sum(obj){ return Object.values(obj || {}).reduce((a,b)=>a+b,0); }
function pct(n,total){ return !total ? 0 : Math.round((n/total)*100); }

function renderResults() {
  const total = sum(totals);
  elTotalVotes.textContent = `Votos totales: ${total}`;
  elResults.innerHTML = "";
  OPTIONS.forEach(opt => {
    const count = totals?.[opt.id] || 0;
    const percentage = pct(count, total);
    const row = document.createElement("div");
    row.style.marginBottom = "10px";
    const top = document.createElement("div"); top.className = "between";
    const left = document.createElement("span"); left.textContent = opt.label;
    const right = document.createElement("span"); right.textContent = `${percentage}% (${count})`;
    top.appendChild(left); top.appendChild(right);
    const bar = document.createElement("div"); bar.className = "bar";
    const fill = document.createElement("div"); fill.style.width = percentage + "%"; fill.style.background = opt.color;
    bar.appendChild(fill);
    row.appendChild(top); row.appendChild(bar);
    elResults.appendChild(row);
  });
}

// === Cámara ===
async function startCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" }, audio: false
    });
    elVideo.srcObject = stream;
    elVideo.hidden = false;
    elPreviewImg.hidden = true;
    elSnap.disabled = true; // habilita luego de cargar metadatos
    elCloseCam.disabled = true;
    elVideo.onloadedmetadata = () => {
      elVideo.play();
      elSnap.disabled = false;
      elCloseCam.disabled = false;
    };
  } catch (e) {
    alert('No pude acceder a la cámara: ' + e.message);
  }
}

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
  elVideo.srcObject = null;
  elVideo.hidden = true;
  elSnap.disabled = true;
  elCloseCam.disabled = true;
}

function takePhoto() {
  if (!stream || elVideo.hidden) return alert('Primero activá la cámara.');
  const w = elVideo.videoWidth || 1280;
  const h = elVideo.videoHeight || 720;
  elCanvas.width = w; elCanvas.height = h;
  const ctx = elCanvas.getContext('2d');

  // 1) frame de la cámara
  ctx.drawImage(elVideo, 0, 0, w, h);

  // 2) filtro color
  const opt = OPTIONS.find(o => o.id === selected);
  if (opt) {
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = opt.color;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
  }

  elCanvas.toBlob(blob => {
    if (objectURL) URL.revokeObjectURL(objectURL);
    objectURL = URL.createObjectURL(blob);
    elPreviewImg.src = objectURL;
    elPreviewImg.hidden = false;
    elVideo.hidden = true;
    renderOverlay();
  }, 'image/jpeg', 0.92);
}

// === Componer imagen final (para compartir) ===
async function getFinalImageBlob() {
  // si hay video visible y activo, primero tomamos foto
  if (!elPreviewImg || elPreviewImg.hidden || !elPreviewImg.src) {
    if (stream && !elVideo.hidden) takePhoto();
  }
  if (!elPreviewImg || elPreviewImg.hidden || !elPreviewImg.src) {
    throw new Error('No hay imagen para compartir. Subí una foto o usá la cámara.');
  }

  // Generar imagen final al tamaño natural disponible
  const img = elPreviewImg;
  const w = img.naturalWidth || img.width || 1280;
  const h = img.naturalHeight || img.height || 720;

  elCanvas.width = w; elCanvas.height = h;
  const ctx = elCanvas.getContext('2d');

  await new Promise(resolve => {
    if (img.complete) { ctx.drawImage(img, 0, 0, w, h); resolve(); }
    else { img.onload = () => { ctx.drawImage(img, 0, 0, w, h); resolve(); }; }
  });

  const opt = OPTIONS.find(o => o.id === selected);
  if (opt) {
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = opt.color;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
  }

  return new Promise(resolve => elCanvas.toBlob(b => resolve(b), 'image/jpeg', 0.95));
}

// === Compartir por Web Share API (sin descargar) ===
async function shareCurrentImage() {
  try {
    const blob = await getFinalImageBlob();
    const file = new File([blob], 'voto.jpg', { type: 'image/jpeg' });

    if (!(navigator.canShare && navigator.canShare({ files: [file] }))) {
      alert('Tu navegador no permite compartir archivos desde la web. Probalo desde un celular con Instagram instalado.');
      return;
    }
    await navigator.share({
      files: [file],
      title: 'Mi voto',
      text: 'Mi voto con filtro 💅'
    });
    // En móviles, Instagram suele aparecer en la hoja de compartir si está instalado.
  } catch (e) {
    alert(e.message || 'No pude generar la imagen para compartir.');
  }
}

// === Reset ===
function resetFlow() {
  selected = null; hasVoted = false;
  if (objectURL) URL.revokeObjectURL(objectURL);
  objectURL = null;
  elFile.value = "";
  elPreviewImg.src = ""; elPreviewImg.hidden = true;
  stopCamera();
  renderOptions(); renderOverlay(); renderResults();
}
