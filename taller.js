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
    else { elP
