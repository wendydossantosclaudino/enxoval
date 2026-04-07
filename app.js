// FIREBASE (CDN correto para navegador)
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

/* INIT */
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

/* ID ANÔNIMO */
function getAnonId() {
  let id = localStorage.getItem("id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("id", id);
  }
  return id;
}

const anonId = getAnonId();

/* LOAD JSON */
async function loadItems() {
  const res = await fetch("./items.json");
  if (!res.ok) throw new Error("Erro ao carregar items.json");
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

    const btn = document.createElement("button");

    if (!it.reserved) {
      btn.textContent = "Reservar";
      btn.onclick = () => reservar(it.id);
    } else if (it.reservedBy === anonId || isAdmin()) {
      btn.textContent = "Cancelar";
      btn.className = "danger";
      btn.onclick = () => cancelar(it.id);
    } else {
      btn.textContent = "Indisponível";
      btn.disabled = true;
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

      if (!snap.exists()) throw new Error("Item não existe");
      if (snap.data().reserved) throw new Error("Já reservado");

      tx.update(ref, {
        reserved: true,
        reservedBy: anonId
      });
    });
  } catch (e) {
    err.innerText = e.message;
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

  try {
    await seed();
  } catch (e) {
    err.innerText = "Erro ao carregar items.json";
    return;
  }

  onSnapshot(giftsCol, (snap) => {
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    render(list);
    statusPill.innerText = "Online";
  });
}

main();
