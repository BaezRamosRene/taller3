// === CONFIG: URL de tu API en Render ===
const API_BASE = 'https://server-jzk9.onrender.com'; // cambiá si la tuya es distinta

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

  // Mejor UX: tocar el video saca foto
  elVideo.addEventListener('click', takePhoto);
  elVideo.addEventListener('playing', () => { elSnap.disabled = false; elCloseCam.disabled = false; }, { once:true });

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
  composePreviewToImg(); // fallback asegura vista correcta
}

// === Overlay/Filtro visual (con fallback) ===
function renderOverlay() {
  const opt = OPTIONS.find(o => o.id === selected) || null;

  if (opt) {
    const supportsBlend = CSS && CSS.supports && CSS.supports('mix-blend-mode', 'multiply');
    if (supportsBlend) {
      elOverlay.style.mixBlendMode = 'multiply';
      elOverlay.style.opacity = '0.35';
      elOverlay.style.background = hexToRGBA(opt.color, 1); // sólido, alpha por opacity
      elFilterInfo.textContent = `Filtro aplicado: ${opt.label} (${opt.color})`;
    } else {
      elOverlay.style.background = 'transparent';
      composePreviewToImg();
      elFilterInfo.textContent = `Filtro aplicado (canvas): ${opt.label} (${opt.color})`;
    }
  } else {
    elOverlay.style.background = 'transparent';
    elFilterInfo.textContent = '';
  }
}

// Utilidades para preview en canvas
function hexToRGBA(hex, alpha=0.35){
  const m = hex.replace('#','');
  const bigint = parseInt(m.length===3 ? m.split('').map(c=>c+c).join('') : m, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
async function composePreviewToImg(){
  if (!elPreviewImg || elPreviewImg.hidden || !elPreviewImg.src) return;
  const w = elPreviewImg.naturalWidth || elPreviewImg.width || 1280;
  const h = elPreviewImg.naturalHeight || elPreviewImg.height || 720;
  elCanvas.width = w; elCanvas.height = h;
  const ctx = elCanvas.getContext('2d');

  await new Promise(resolve=>{
    if (elPreviewImg.complete) { ctx.drawImage(elPreviewImg, 0, 0, w, h); resolve(); }
    else { elPreviewImg.onload = ()=>{ ctx.drawImage(elPreviewImg, 0, 0, w, h); resolve(); }; }
  });

  const opt = OPTIONS.find(o=>o.id===selected);
  if (opt){
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = hexToRGBA(opt.color, 0.35);
    ctx.fillRect(0,0,w,h);
    ctx.globalCompositeOperation = 'source-over';
  }

  elPreviewImg.src = elCanvas.toDataURL('image/jpeg', 0.92);
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
      video: { facingMode: { ideal: "environment" } },
      audio: false
    });

    elVideo.srcObject = stream;
    elVideo.hidden = false;
    elPreviewImg.hidden = true;

    // habilitar botones ya
    elSnap.disabled = false;
    elCloseCam.disabled = false;

    elVideo.onloadedmetadata = () => {
      elVideo.play().catch(()=>{});
      elSnap.disabled = false;
      elCloseCam.disabled = false;
    };

    elVideo.addEventListener('canplay', () => {
      elSnap.disabled = false;
      elCloseCam.disabled = false;
    }, { once: true });

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
  if (!stream || elVideo.hidden) {
    alert('Primero activá la cámara.');
    return;
  }
  const w = elVideo.videoWidth || 1280;
  const h = elVideo.videoHeight || 720;
  if (!w || !h) { setTimeout(takePhoto, 100); return; }

  elCanvas.width = w; elCanvas.height = h;
  const ctx = elCanvas.getContext('2d');

  // 1) frame de la cámara
  ctx.drawImage(elVideo, 0, 0, w, h);

  // 2) filtro color
  const opt = OPTIONS.find(o => o.id === selected);
  if (opt) {
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = hexToRGBA(opt.color, 0.35);
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
  }

  elCanvas.toBlob(blob => {
    if (!blob) { alert('No pude generar la foto. Intentá de nuevo.'); return; }
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
  if (!elPreviewImg || elPreviewImg.hidden || !elPreviewImg.src) {
    if (stream && !elVideo.hidden) takePhoto();
  }
  if (!elPreviewImg || elPreviewImg.hidden || !elPreviewImg.src) {
    throw new Error('No hay imagen para compartir. Subí una foto o usá la cámara.');
  }

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
    ctx.fillStyle = hexToRGBA(opt.color, 0.35);
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
  }

  return new Promise(resolve => elCanvas.toBlob(b => resolve(b), 'image/jpeg', 0.95));
}

// === Compartir por Web Share API (no descarga) ===
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
