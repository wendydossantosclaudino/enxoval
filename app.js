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
  authDomain: "enxoval-wendyeleo.firebaseapp.com",
  projectId: "enxoval-wendyeleo",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const giftsCol = collection(db, "gifts");

const grid = document.getElementById("grid");
const err = document.getElementById("err");
const statusPill = document.getElementById("statusPill");
const adminBtn = document.getElementById("adminBtn");

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

function getAnonId() {
  let id = localStorage.getItem("id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("id", id);
  }
  return id;
}

const anonId = getAnonId();

async function loadItems() {
  const res = await fetch("./items.json");
  return await res.json();
}

async function seed() {
  const items = await loadItems();

  for (const g of items) {
    const ref = doc(db, "gifts", g.id);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      await setDoc(ref, {
        ...g,
        reserved: false,
        reservedBy: null
      });
    }
  }
}

function render(list) {
  grid.innerHTML = "";

  list.forEach(it => {
    const div = document.createElement("div");
    div.className = "card";

    div.innerHTML = `
      <b>${it.name}</b><br>
      R$ ${it.price}<br>
      <a href="${it.url}" target="_blank">Ver produto</a><br><br>
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

async function cancelar(id) {
  const ref = doc(db, "gifts", id);

  await runTransaction(db, async (tx) => {
    tx.update(ref, {
      reserved: false,
      reservedBy: null
    });
  });
}

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
