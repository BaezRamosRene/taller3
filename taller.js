// URL de tu API en Render (deja esta o poné la tuya)
const API_BASE = 'https://server-jzk9.onrender.com';

// Colores de filtro para cada opción (mapea a op1..op4 del backend)
const FILTERS = {
  op1: "#FACC15", // Amarillo
  op2: "#EF4444", // Rojo
  op3: "#F97316", // Naranja
  op4: "#3B82F6", // Azul
};

let selected = null, objectURL = null, totals = {}, hasVoted = false;

// Refs pantalla 1
const screen1 = document.getElementById("screen1");
const voteButtons = screen1.querySelectorAll(".vote-btn");

// Refs pantalla 2
const screen2 = document.getElementById("screen2");
const elFile = document.getElementById("fileInput");
const elPreview = document.getElementById("preview");
const elPreviewImg = document.getElementById("previewImg");
const elOverlay = document.getElementById("overlay");
const elConfirm = document.getElementById("confirmBtn");
const elReset = document.getElementById("resetBtn");
const elResults = document.getElementById("results");
const elTotalVotes = document.getElementById("totalVotes");
const elCanvas = document.getElementById("renderCanvas");
const elShare = document.getElementById("shareBtn");
const elPlaceholder = document.getElementById("placeholderText");

// ★ NUEVO: refs para título fuera del orbe y textarea centrada
const elMessageTitle = document.getElementById("messageTitle");
const elMessageInput = document.getElementById("messageInput");

// API
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
      body: JSON.stringify({ optionId }) // optionId = "op1".."op4"
    });
    if (!r.ok) throw new Error('POST vote failed');
    const data = await r.json();
    return data.totals;
  }
};

// INIT
init();
async function init(){
  voteButtons.forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const id = btn.getAttribute('data-opt'); // op1..op4
      selected = id;

      // intento de voto; si falla, muestro alerta pero igual paso de pantalla
      try { totals = await VoteService.addVote(id); }
      catch (e) { alert('No me pude conectar a la API para registrar el voto. Probá de nuevo más tarde.'); }

      renderOverlay();
      renderResults();
      goToScreen(2);
    });
  });

  try { totals = await VoteService.getTotals(); }
  catch { totals = { op1:0, op2:0, op3:0, op4:0 }; }

  bindScreen2Events();
}

// Navegación
function goToScreen(n){
  if (n === 1){ screen1.classList.add('active'); screen2.classList.remove('active'); }
  else { screen1.classList.remove('active'); screen2.classList.add('active'); }
}

function bindScreen2Events(){
  elFile.addEventListener("change", onFileChange);
  elConfirm.addEventListener("click", onSubmit);

  if (elReset) elReset.addEventListener("click", resetFlow);

  elPreview.addEventListener("dragover", e=>e.preventDefault());
  elPreview.addEventListener("drop", e=>{
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) readFile(f);
  });

  elShare.addEventListener("click", shareCurrentImage);
}

// Carga imagen
function onFileChange(e){ const f=e.target.files?.[0]; if(f) readFile(f); }
function readFile(file){
  if(objectURL) URL.revokeObjectURL(objectURL);
  objectURL = URL.createObjectURL(file);
  elPreviewImg.src = objectURL;
  elPreviewImg.hidden = false;
  if(elPlaceholder) elPlaceholder.style.display="none";
  elPreview.classList.remove('is-empty');
  renderOverlay();
  composePreviewToImg();

  // ★ Mostrar título + textarea cuando hay imagen
  if (elMessageTitle) elMessageTitle.style.display = 'block';
  if (elMessageInput) elMessageInput.style.display = 'block';
}

// Aplicar filtro
function renderOverlay(){
  const color = FILTERS[selected] || null;
  if (color){
    const supportsBlend = CSS && CSS.supports && CSS.supports('mix-blend-mode', 'multiply');
    if (supportsBlend){
      elOverlay.style.mixBlendMode='multiply';
      elOverlay.style.opacity='0.35';
      elOverlay.style.background = hexToRGBA(color,1);
    } else {
      elOverlay.style.background='transparent';
      composePreviewToImg();
    }
  } else {
    elOverlay.style.background='transparent';
  }
}

function hexToRGBA(hex, alpha=0.35){
  const m = hex.replace('#','');
  const bigint = parseInt(m.length===3 ? m.split('').map(c=>c+c).join('') : m, 16);
  const r = (bigint >> 16) & 255, g = (bigint >> 8) & 255, b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

async function composePreviewToImg(){
  if (!elPreviewImg || elPreviewImg.hidden || !elPreviewImg.src) return;
  const w = elPreviewImg.naturalWidth || 1280;
  const h = elPreviewImg.naturalHeight || 720;
  elCanvas.width = w; elCanvas.height = h;
  const ctx = elCanvas.getContext('2d');

  await new Promise(resolve=>{
    if (elPreviewImg.complete){ ctx.drawImage(elPreviewImg,0,0,w,h); resolve(); }
    else { elPreviewImg.onload=()=>{ ctx.drawImage(elPreviewImg,0,0,w,h); resolve(); }; }
  });

  const color = FILTERS[selected];
  if (color){
    ctx.globalCompositeOperation='multiply';
    ctx.fillStyle = hexToRGBA(color, 0.35);
    ctx.fillRect(0,0,w,h);
    ctx.globalCompositeOperation='source-over';
  }
  elPreviewImg.src = elCanvas.toDataURL('image/jpeg', 0.92);
}

// Confirmar (por si querés reconfirmar desde pantalla 2)
async function onSubmit(){
  if (!selected) return alert("Elegí una opción primero.");
  if (elPreviewImg.hidden || !elPreviewImg.src) return alert("Subí una foto antes de confirmar.");

  // Tomar la frase del usuario (placeholder “escribe...”)
  const mensaje = (elMessageInput?.value || "").trim();
  if (!mensaje){
    alert("Por favor, escribí algo en el campo (escribe...).");
    return;
  }
  console.log("Mensaje del usuario:", mensaje);

  try { totals = await VoteService.addVote(selected); }
  catch { /* ya se votó antes; si falla ahora, seguimos igual */ }

  hasVoted = true;
  renderResults();
  alert("¡Gracias por participar!");
}

// Resultados
function sum(obj){ return Object.values(obj || {}).reduce((a,b)=>a+b,0); }
function pct(n,total){ return !total ? 0 : Math.round((n/total)*100); }
function renderResults(){
  const total = sum(totals);
  elTotalVotes.textContent = `Votos totales: ${total}`;
  elResults.innerHTML = "";

  const items = [
    { id:'op1', label:'Amarillo', color:FILTERS.op1 },
    { id:'op2', label:'Rojo',     color:FILTERS.op2 },
    { id:'op3', label:'Naranja',  color:FILTERS.op3 },
    { id:'op4', label:'Azul',     color:FILTERS.op4 },
  ];

  items.forEach(it=>{
    const count = totals?.[it.id] || 0;
    const percentage = pct(count, total);
    const row = document.createElement("div");
    row.style.marginBottom="10px";
    const top = document.createElement("div"); top.className="between";
    const left = document.createElement("span"); left.textContent = it.label;
    const right = document.createElement("span"); right.textContent = `${percentage}% (${count})`;
    top.appendChild(left); top.appendChild(right);
    const bar = document.createElement("div"); bar.className="bar";
    const fill = document.createElement("div"); fill.style.width = percentage + "%"; fill.style.background = it.color;
    bar.appendChild(fill);
    row.appendChild(top); row.appendChild(bar);
    elResults.appendChild(row);
  });
}

// Compartir
async function getFinalImageBlob(){
  if (!elPreviewImg || elPreviewImg.hidden || !elPreviewImg.src)
    throw new Error('No hay imagen para compartir.');
  const w = elPreviewImg.naturalWidth || 1280;
  const h = elPreviewImg.naturalHeight || 720;
  elCanvas.width = w; elCanvas.height = h;
  const ctx = elCanvas.getContext('2d');

  await new Promise(resolve=>{
    if (elPreviewImg.complete){ ctx.drawImage(elPreviewImg,0,0,w,h); resolve(); }
    else { elPreviewImg.onload=()=>{ ctx.drawImage(elPreviewImg,0,0,w,h); resolve(); }; }
  });

  const color = FILTERS[selected];
  if (color){
    ctx.globalCompositeOperation='multiply';
    ctx.fillStyle = hexToRGBA(color, 0.35);
    ctx.fillRect(0,0,w,h);
    ctx.globalCompositeOperation='source-over';
  }
  return new Promise(resolve=> elCanvas.toBlob(b=>resolve(b),'image/jpeg',0.95));
}
async function shareCurrentImage(){
  try{
    const blob = await getFinalImageBlob();
    const file = new File([blob],'voto.jpg',{ type:'image/jpeg' });
    if (!(navigator.canShare && navigator.canShare({ files:[file] }))){
      alert('Tu navegador no permite compartir archivos.');
      return;
    }
    await navigator.share({ files:[file], title:'Mi voto', text:'Mi voto con filtro 💅' });
  }catch(e){ alert(e.message); }
}

// Reset → vuelve a pantalla 1 (dejamos la función intacta)
function resetFlow(){
  selected = null; hasVoted = false;
  if (objectURL) URL.revokeObjectURL(objectURL);
  objectURL = null;
  elFile.value = "";
  elPreviewImg.src = ""; elPreviewImg.hidden = true;
  if (elPlaceholder) elPlaceholder.style.display="block";
  elPreview.classList.add('is-empty');
  renderOverlay(); renderResults();
  goToScreen(1);

  // Ocultar título + textarea y limpiar
  if (elMessageTitle) elMessageTitle.style.display = 'none';
  if (elMessageInput){
    elMessageInput.style.display = 'none';
    elMessageInput.value = '';
  }
}
