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

/* CONFIG */
const firebaseConfig = {
  apiKey: "AIzaSyB6CjAR96_xSatBqX1R8p8spcD50cepC1I",
  authDomain: "enxoval-wendyeleo.firebaseapp.com",
  projectId: "enxoval-wendyeleo",
  storageBucket: "enxoval-wendyeleo.firebasestorage.app",
  messagingSenderId: "1081201549340",
  appId: "1:1081201549340:web:8c13ac3959156e0605bfd9"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const giftsCol = collection(db, "gifts");

/* DOM */
const grid = document.getElementById("grid");
const err = document.getElementById("err");
const statusPill = document.getElementById("statusPill");
const adminBtn = document.getElementById("adminBtn");

/* ADMIN */
const ADMIN_PASSWORD = "150821";

adminBtn.onclick = () => {
  const pass = prompt("Senha:");
  if (pass === ADMIN_PASSWORD) {
    localStorage.setItem("admin", "1");
    alert("Admin ativado");
  }
};

function isAdmin() {
  return localStorage.getItem("admin") === "1";
}

/* ID */
function getAnonId() {
  let id = localStorage.getItem("id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("id", id);
  }
  return id;
}

const anonId = getAnonId();

/* LOAD */
async function loadItems() {
  const res = await fetch("./items.json");
  return await res.json();
}

/* SEED */
async function seed() {
  const items = await loadItems();

  for (const g of items) {
    const ref = doc(db, "gifts", g.id);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      await setDoc(ref, {
        name: g.name,
        price: g.price,
        url: g.url,
        reserved: false,
        reservedBy: null
      });
    }
  }
}

/* BOTÃO BONITO */
function createButton() {
  const btn = document.createElement("button");

  btn.style.padding = "12px 14px";
  btn.style.border = "none";
  btn.style.borderRadius = "14px";
  btn.style.cursor = "pointer";
  btn.style.fontWeight = "700";
  btn.style.fontSize = "13px";
  btn.style.color = "#FAF7F2";
  btn.style.boxShadow = "0 10px 18px rgba(17,17,17,.15)";
  btn.style.transition = "0.2s";

  btn.onmouseover = () => btn.style.transform = "translateY(-2px)";
  btn.onmouseout = () => btn.style.transform = "translateY(0)";

  return btn;
}

/* RENDER */
function render(list) {
  grid.innerHTML = "";

  list.forEach(it => {
    const div = document.createElement("div");
    div.className = "card";

    div.innerHTML = `
      <div class="title">${it.name}</div>
      <div class="price">R$ ${it.price}</div>
      <a href="${it.url}" target="_blank">Abrir produto</a>
    `;

    const btn = createButton();

    if (!it.reserved) {
      btn.textContent = "Reservar";
      btn.style.background = "linear-gradient(180deg,#111,#000)";
      btn.onclick = () => reservar(it.id);

    } else if (it.reservedBy === anonId || isAdmin()) {
      btn.textContent = "Cancelar";
      btn.style.background = "linear-gradient(180deg,#B91C1C,#991B1B)";
      btn.onclick = () => cancelar(it.id);

    } else {
      btn.textContent = "Indisponível";
      btn.disabled = true;
      btn.style.background = "#999";
    }

    div.appendChild(btn);
    grid.appendChild(div);
  });
}

/* RESERVAR */
async function reservar(id) {
  const ref = doc(db, "gifts", id);

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);

      if (snap.data().reserved) throw "Já reservado";

      tx.update(ref, {
        reserved: true,
        reservedBy: anonId
      });
    });
  } catch (e) {
    err.innerText = e;
  }
}

/* CANCELAR */
async function cancelar(id) {
  const ref = doc(db, "gifts", id);

  await runTransaction(db, async (tx) => {
    tx.update(ref, {
      reserved: false,
      reservedBy: null
    });
  });
}

/* MAIN */
async function main() {
  statusPill.innerText = "Carregando...";

  await seed();

  onSnapshot(giftsCol, (snap) => {
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    render(list);
    statusPill.innerText = "Online";
  });
}

main();
