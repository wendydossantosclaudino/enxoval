// app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore, collection, doc, onSnapshot, runTransaction, setDoc, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const $ = (id) => document.getElementById(id);
const grid = $("grid");
const err = $("err");
const statusPill = $("statusPill");

const qEl = $("q");
const priceEl = $("price");
const showEl = $("show");

// 1) COLE AQUI SUA CONFIG DO FIREBASE (Firebase Console -> Add app -> Web)
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB6CjAR96_xSatBqX1R8p8spcD50cepC1I",
  authDomain: "enxoval-wendyeleo.firebaseapp.com",
  projectId: "enxoval-wendyeleo",
  storageBucket: "enxoval-wendyeleo.firebasestorage.app",
  messagingSenderId: "1081201549340",
  appId: "1:1081201549340:web:8c13ac3959156e0605bfd9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
// 2) ID anônimo por dispositivo (ninguém vê)
function getAnonId() {
  const key = "gift_anon_id_v1";
  let v = localStorage.getItem(key);
  if (!v) {
    v = crypto.randomUUID();
    localStorage.setItem(key, v);
  }
  return v;
}
const anonId = getAnonId();

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const giftsCol = collection(db, "gifts");

function money(v) {
  if (v == null || Number.isNaN(Number(v))) return "—";
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function inPriceRange(price, min, max) {
  const p = Number(price);
  if (Number.isNaN(p)) return false;
  return p >= min && p <= max;
}

function parseRange(s) {
  const [a, b] = s.split("-").map(Number);
  return { min: a, max: b };
}

let currentDocs = [];

async function loadItems() {
  const res = await fetch("./items.json", { cache: "no-store" });
  if (!res.ok) throw new Error("Não consegui carregar items.json");
  return await res.json();
}

// Semear lista (só cria se ainda não existir)
async function ensureSeed() {
  const seedGifts = await loadItems();
  if (!seedGifts.length) return;

  const first = seedGifts[0];
  const firstRef = doc(db, "gifts", first.id);
  const snap = await getDoc(firstRef);
  if (snap.exists()) return;

  statusPill.textContent = "Inicializando lista…";

  for (const g of seedGifts) {
    await setDoc(doc(db, "gifts", g.id), {
      name: g.name,
      price: g.price ?? null,
      url: g.url,
      reserved: !!g.initialReserved,
      reservedAt: null,
      reservedBy: null,
    });
  }
}

function render() {
  const q = (qEl.value || "").trim().toLowerCase();
  const show = showEl.value;
  const { min, max } = parseRange(priceEl.value);

  let list = currentDocs.map(d => ({ id: d.id, ...d.data() }));

  // filtro preço
  list = list.filter(it => {
    if (priceEl.value === "0-9999") return true;
    return inPriceRange(it.price, min, max);
  });

  // filtro status
  if (show === "available") list = list.filter(it => !it.reserved);
  if (show === "reserved") list = list.filter(it => it.reserved);

  // busca
  if (q) list = list.filter(it => (it.name || "").toLowerCase().includes(q));

  // ordenação: disponíveis primeiro, depois por preço
  list.sort((a, b) => {
    if (a.reserved !== b.reserved) return a.reserved ? 1 : -1;
    return (Number(a.price)||999999) - (Number(b.price)||999999);
  });

  grid.innerHTML = "";
  for (const it of list) {
    const mine = it.reserved && it.reservedBy === anonId;

    const card = document.createElement("div");
    card.className = "card";

    const top = document.createElement("div");
    top.className = "row";
    top.innerHTML = `
      <div>
        <div class="title">${it.name ?? "Item"}</div>
        <div class="meta"><a class="link" href="${it.url}" target="_blank" rel="noopener">Abrir link</a></div>
      </div>
      <div style="text-align:right">
        <div class="price">${money(it.price)}</div>
        <div class="meta">${it.reserved ? "Reservado" : "Disponível"}</div>
      </div>
    `;

    const badge = document.createElement("div");
    badge.className = `badge ${it.reserved ? "lock" : "ok"}`;
    badge.textContent = it.reserved ? (mine ? "Reservado por você" : "Reservado") : "Disponível";

    const actions = document.createElement("div");
    actions.className = "actions";

    if (!it.reserved) {
      const btn = document.createElement("button");
      btn.textContent = "Reservar";
      btn.className = "primary";
      btn.onclick = () => reserve(it.id);
      actions.appendChild(btn);
    } else if (mine) {
      const btn = document.createElement("button");
      btn.textContent = "Cancelar";
      btn.className = "danger";
      btn.onclick = () => unreserve(it.id);
      actions.appendChild(btn);
    } else {
      const disabled = document.createElement("button");
      disabled.textContent = "Indisponível";
      disabled.disabled = true;
      actions.appendChild(disabled);
    }

    card.appendChild(top);
    card.appendChild(badge);
    card.appendChild(actions);
    grid.appendChild(card);
  }
}

async function reserve(id) {
  err.textContent = "";
  const ref = doc(db, "gifts", id);

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error("Item não encontrado.");
      const data = snap.data();
      if (data.reserved) throw new Error("Ops! Alguém acabou de reservar esse item.");

      tx.update(ref, {
        reserved: true,
        reservedBy: anonId,
        reservedAt: new Date().toISOString(),
      });
    });
  } catch (e) {
    err.textContent = e.message || "Não foi possível reservar agora.";
  }
}

async function unreserve(id) {
  err.textContent = "";
  const ref = doc(db, "gifts", id);

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error("Item não encontrado.");
      const data = snap.data();

      if (!data.reserved) return;
      if (data.reservedBy !== anonId) throw new Error("Você só pode cancelar reservas feitas neste aparelho.");

      tx.update(ref, {
        reserved: false,
        reservedBy: null,
        reservedAt: null,
      });
    });
  } catch (e) {
    err.textContent = e.message || "Não foi possível cancelar agora.";
  }
}

async function main() {
  statusPill.textContent = "Conectando…";

  try {
    await ensureSeed();
  } catch (e) {
    statusPill.textContent = "Configuração necessária";
    err.textContent = "Cole sua configuração do Firebase no app.js (firebaseConfig). Depois recarregue a página.";
    console.error(e);
    return;
  }

  onSnapshot(giftsCol, (snap) => {
    currentDocs = snap.docs;
    statusPill.textContent = `Online • ${snap.size} itens`;
    render();
  }, (e) => {
    statusPill.textContent = "Erro";
    err.textContent = "Falha ao conectar. Verifique sua configuração do Firebase.";
    console.error(e);
  });

  qEl.addEventListener("input", render);
  priceEl.addEventListener("change", render);
  showEl.addEventListener("change", render);
}

main();
