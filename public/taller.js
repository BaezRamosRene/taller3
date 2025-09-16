// public/taller.js
// Frontend que llama a la API del mismo servidor (sin CORS ni instalaciones extra).

const OPTIONS = [
  { id: "op1", label: "Opción 1", color: "#E11D48" },
  { id: "op2", label: "Opción 2", color: "#2563EB" },
  { id: "op3", label: "Opción 3", color: "#059669" },
  { id: "op4", label: "Opción 4", color: "#A855F7" },
];

// ---- Estado simple ----
let selected = null;
let objectURL = null;
let totals = {};
let hasVoted = false;

// ---- DOM ----
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
const elHint = document.getElementById("hint");

// ---- API ----
const VoteService = {
  async getTotals() {
    const r = await fetch('/api/poll/totals');
    return r.json();
  },
  async addVote(optionId) {
    const r = await fetch('/api/poll/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ optionId })
    });
    const data = await r.json();
    return data.totals;
  }
};

// ---- Init ----
init();
async function init() {
  renderOptions();
  totals = await VoteService.getTotals();
  renderResults();
  bindEvents();
}

function bindEvents() {
  elFile.addEventListener("change", onFileChange);
  elConfirm.addEventListener("click", onSubmit);
  elReset.addEventListener("click", resetFlow);

  // drag & drop
  elPreview.addEventListener("dragover", (e) => { e.preventDefault(); });
  elPreview.addEventListener("drop", (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) readFile(file);
  });
}

function renderOptions() {
  elOptions.innerHTML = "";
  OPTIONS.forEach(opt => {
    const btn = document.createElement("button");
    btn.className = "option";
    btn.type = "button";
    btn.setAttribute("data-id", opt.id);
    btn.setAttribute("aria-pressed", selected === opt.id ? "true" : "false");
    btn.innerHTML = `
      <span class="swatch" style="background:${opt.color}"></span>
      <span class="label" style="font-weight:600">${opt.label}</span>
      <div class="small" style="margin-top:6px">Color: ${opt.color}</div>
    `;
    btn.addEventListener("click", () => {
      selected = opt.id;
      renderOptions();
      renderOverlay();
    });
    elOptions.appendChild(btn);
  });
}

function onFileChange(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  readFile(file);
}

function readFile(file) {
  if (objectURL) URL.revokeObjectURL(objectURL);
  objectURL = URL.createObjectURL(file);
  elPreviewImg.src = objectURL;
  elPreviewImg.hidden = false;
  renderOverlay();
}

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

async function onSubmit() {
  if (!selected) {
    alert("Elegí una opción primero.");
    return;
  }
  if (!elPreviewImg || elPreviewImg.hidden) {
    alert("Subí una foto para aplicar el filtro.");
    return;
  }
  totals = await VoteService.addVote(selected);
  hasVoted = true;
  renderResults();
}

function resetFlow() {
  selected = null;
  hasVoted = false;
  if (objectURL) URL.revokeObjectURL(objectURL);
  objectURL = null;
  elFile.value = "";
  elPreviewImg.src = "";
  elPreviewImg.hidden = true;
  renderOptions();
  renderOverlay();
  renderResults();
}

function sum(obj) {
  return Object.values(obj || {}).reduce((a,b) => a + b, 0);
}

function pct(count, total) {
  if (!total) return 0;
  return Math.round((count / total) * 100);
}

function renderResults() {
  const total = sum(totals);
  elTotalVotes.textContent = `Votos totales: ${total}`;
  elResults.innerHTML = "";

  OPTIONS.forEach(opt => {
    const count = totals?.[opt.id] || 0;
    const percentage = pct(count, total);
    const active = hasVoted && selected === opt.id;

    const wrapper = document.createElement("div");
    wrapper.style.marginBottom = "10px";

    const top = document.createElement("div");
    top.className = "between";

    const left = document.createElement("span");
    left.textContent = opt.label;
    if (active) left.style.fontWeight = "600";

    const right = document.createElement("span");
    right.textContent = `${percentage}% (${count})`;
    if (active) right.style.fontWeight = "600";

    top.appendChild(left);
    top.appendChild(right);

    const bar = document.createElement("div");
    bar.className = "bar";
    const fill = document.createElement("div");
    fill.style.width = percentage + "%";
    fill.style.background = opt.color;
    bar.appendChild(fill);

    wrapper.appendChild(top);
    wrapper.appendChild(bar);
    elResults.appendChild(wrapper);
  });
}
