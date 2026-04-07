// app.js (FINAL CORRIGIDO)

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  onSnapshot,
  runTransaction,
  setDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/* =========================
   CONFIG
   ========================= */
const firebaseConfig = {
  apiKey: "AIzaSyB6CjAR96_xSatBqX1R8p8spcD50cepC1I",
  authDomain: "enxoval-wendyeleo.firebaseapp.com",
  projectId: "enxoval-wendyeleo",
  storageBucket: "enxoval-wendyeleo.firebasestorage.app",
  messagingSenderId: "1081201549340",
  appId: "1:1081201549340:web:8c13ac3959156e0605bfd9"
};

/* =========================
   DOM
   ========================= */
const $ = (id) => document.getElementById(id);

const grid = $("grid");
const err = $("err");
const statusPill = $("statusPill");
const adminBtn = $("adminBtn");

/* =========================
   ADMIN (mantido igual)
   ========================= */
const ADMIN_KEY = "wendy";
const ADMIN_PASSWORD = "150821";

function isAdmin() {
  return localStorage.getItem(ADMIN_KEY) === "1";
}

function adminLogin() {
  const pass = prompt("Senha de admin:");
  if (pass == null) return;

  if (pass === ADMIN_PASSWORD) {
    localStorage.setItem(ADMIN_KEY, "1");
    alert("Modo admin ativado ✅");
    location.reload();
  } else {
    alert("Senha incorreta.");
  }
}

if (adminBtn) adminBtn.addEventListener("click", adminLogin);

/* =========================
   ID anônimo
   ========================= */
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

/* =========================
   FIREBASE
   ========================= */
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const giftsCol = collection(db, "gifts");

/* =========================
   UTILS
   ========================= */
function money(v) {
  if (v == null) return "—";
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/* =========================
   LOAD ITEMS
   ========================= */
async function loadItems() {
  const res = await fetch("./items.json", { cache: "no-store" });
  if (!res.ok) throw new Error("Erro ao carregar items.json");
  return await res.json();
}

/* =========================
   SEED
   ========================= */
async function ensureSeed() {
  const seedGifts = await loadItems();
  if (!seedGifts.length) return;

  statusPill.textContent = "Sincronizando…";

  await Promise.all(seedGifts.map(async (g) => {
    const ref = doc(db, "gifts", g.id);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      await setDoc(ref, {
        name: g.name,
        price: g.price ?? null,
        url: g.url,
        reserved: !!g.initialReserved,
        reservedAt: null,
        reservedBy: null,
      });
    }
  }));
}

/* =========================
   RENDER
   ========================= */
let currentDocs = [];

function render() {
  if (!grid) return;

  grid.innerHTML = "";

  let list = currentDocs.map(d => ({ id: d.id, ...d.data() }));

  list.sort((a, b) => {
    if (a.reserved !== b.reserved) return a.reserved ? 1 : -1;
    return (Number(a.price) || 999999) - (Number(b.price) || 999999);
  });

  for (const it of list) {
    const mine = it.reserved && it.reservedBy === anonId;
    const canCancel = mine || isAdmin();

    const card = document.createElement("div");
    card.className = "card";

    const date = it.reservedAt
      ? new Date(it.reservedAt).toLocaleDateString("pt-BR")
      : null;

    card.innerHTML = `
      <div class="row">
        <div>
          <div class="title">${it.name}</div>
          <div class="meta">
            <a class="link" href="${it.url}" target="_blank">Abrir link</a>
          </div>
        </div>
        <div style="text-align:right">
          <div class="price">${money(it.price)}</div>
          <div class="meta">${it.reserved ? "Reservado" : "Disponível"}</div>
        </div>
      </div>

      <div class="badge ${it.reserved ? "lock" : "ok"}">
        ${it.reserved
          ? (mine
            ? `Reservado por você ${date ? "em " + date : ""}`
            : "Reservado")
          : "Disponível"}
      </div>
    `;

    const actions = document.createElement("div");
    actions.className = "actions";

    if (!it.reserved) {
      const btn = document.createElement("button");
      btn.textContent = "Reservar";
      btn.className = "actionBtn";

      btn.onclick = async () => {
        btn.textContent = "Reservando...";
        btn.disabled = true;
        await reserve(it.id);
      };

      actions.appendChild(btn);

    } else if (canCancel) {
      const btn = document.createElement("button");
      btn.textContent = mine ? "Cancelar" : "Liberar";
      btn.className = "actionBtn danger";

      btn.onclick = async () => {
        btn.textContent = "Processando...";
        btn.disabled = true;
        await unreserve(it.id);
      };

      actions.appendChild(btn);

    } else {
      const disabled = document.createElement("button");
      disabled.textContent = "Indisponível";
      disabled.className = "actionBtn";
      disabled.disabled = true;
      actions.appendChild(disabled);
    }

    card.appendChild(actions);
    grid.appendChild(card);
  }
}

/* =========================
   RESERVA
   ========================= */
async function reserve(id) {
  err.textContent = "";

  try {
    await runTransaction(db, async (tx) => {
      const ref = doc(db, "gifts", id);
      const snap = await tx.get(ref);

      if (!snap.exists()) throw new Error("Item não encontrado.");
      if (snap.data().reserved) throw new Error("Alguém já reservou!");

      tx.update(ref, {
        reserved: true,
        reservedBy: anonId,
        reservedAt: new Date().toISOString(),
      });
    });

    err.style.color = "green";
    err.textContent = "Reservado com sucesso 💛";

  } catch (e) {
    err.style.color = "#B91C1C";
    err.textContent = e.message;
  }
}

/* =========================
   CANCELAR
   ========================= */
async function unreserve(id) {
  err.textContent = "";

  try {
    await runTransaction(db, async (tx) => {
      const ref = doc(db, "gifts", id);
      const snap = await tx.get(ref);

      if (!snap.exists()) throw new Error("Item não encontrado.");

      const data = snap.data();

      if (!isAdmin() && data.reservedBy !== anonId) {
        throw new Error("Só pode cancelar no mesmo aparelho.");
      }

      tx.update(ref, {
        reserved: false,
        reservedBy: null,
        reservedAt: null,
      });
    });

    err.style.color = "green";
    err.textContent = "Reserva cancelada 👍";

  } catch (e) {
    err.style.color = "#B91C1C";
    err.textContent = e.message;
  }
}

/* =========================
   MAIN
   ========================= */
async function main() {
  statusPill.textContent = "Conectando…";

  try {
    await ensureSeed();
  } catch (e) {
    statusPill.textContent = "Erro";
    err.textContent = "Problema no Firebase ou items.json";
    return;
  }

  onSnapshot(giftsCol, (snap) => {
    currentDocs = snap.docs;
    statusPill.textContent = `Online • ${snap.size} itens`;
    render();
  });
}

// CHAMADA FINAL
main();
