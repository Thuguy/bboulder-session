import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp }
    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { requireAuth } from "./auth.js";

requireAuth();

const firebaseConfig = {
    apiKey: "AIzaSyBit-EicoYOmKIlTjY5jvgov-RbHw_9t2o",
    authDomain: "bboulder-bd2a7.firebaseapp.com",
    projectId: "bboulder-bd2a7",
    storageBucket: "bboulder-bd2a7.firebasestorage.app",
    messagingSenderId: "67306427535",
    appId: "1:67306427535:web:e19b983e3bfe4feb624cfa"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const BLOCS = [
    { id: 1, name: "Bloc 1", couleur: "#FFD700" },
    { id: 2, name: "Bloc 2", couleur: "#32CD32" },
    { id: 3, name: "Bloc 3", couleur: "#1E90FF" },
    { id: 4, name: "Bloc 4", couleur: "#FF4500" },
    { id: 5, name: "Bloc 5", couleur: "#ffffff" },
    { id: 6, name: "Bloc 6", couleur: "#9400D3" },
    { id: 7, name: "Bloc 7", couleur: "#FF8C00" },
    { id: 8, name: "Bloc 8", couleur: "#FF69B4" },
    { id: 9, name: "Bloc 9", couleur: "#00CED1" },
    { id: 10, name: "Bloc 10", couleur: "#FF0000" },
];

const container = document.getElementById("blocs-container");

BLOCS.forEach(bloc => {
    const card = document.createElement("div");
    card.className = "card bloc-card";
    card.innerHTML = `
    <div class="bloc-header" style="border-left: 4px solid ${bloc.couleur}">
      <span class="bloc-name">${bloc.name}</span>
      <label class="toggle">
        <input type="checkbox" id="check-${bloc.id}" onchange="toggleBloc(${bloc.id})" />
        <span class="slider"></span>
      </label>
    </div>
    <div class="attempts-row hidden" id="attempts-row-${bloc.id}">
      <label>Nombre d'essais</label>
      <div class="counter">
        <button type="button" onclick="changeAttempts(${bloc.id}, -1)">-</button>
        <span id="attempts-${bloc.id}">1</span>
        <button type="button" onclick="changeAttempts(${bloc.id}, +1)">+</button>
      </div>
    </div>
  `;
    container.appendChild(card);
});

window.toggleBloc = (id) => {
    const checked = document.getElementById(`check-${id}`).checked;
    document.getElementById(`attempts-row-${id}`).classList.toggle("hidden", !checked);
};

window.changeAttempts = (id, delta) => {
    const el = document.getElementById(`attempts-${id}`);
    const next = Math.max(1, parseInt(el.textContent) + delta);
    el.textContent = next;
};

window.submitScore = async () => {
    const name = document.getElementById("name").value.trim();
    if (!name) {
        alert("Merci d'entrer ton nom !");
        return;
    }

    const blocs = BLOCS.map(bloc => {
        const completed = document.getElementById(`check-${bloc.id}`).checked;
        const attempts = completed
            ? parseInt(document.getElementById(`attempts-${bloc.id}`).textContent)
            : 0;
        return { id: bloc.id, name: bloc.name, completed, attempts };
    });

    const btn = document.getElementById("submit-btn");
    btn.disabled = true;
    btn.textContent = "Envoi en cours...";

    try {
        await addDoc(collection(db, "scores"), {
            name,
            blocs,
            timestamp: serverTimestamp()
        });

        const feedback = document.getElementById("feedback");
        feedback.className = "feedback success";
        feedback.textContent = "Bien joue " + name + " ! Tes resultats ont ete enregistres.";
        btn.classList.add("hidden");

    } catch (error) {
        console.error(error);
        const feedback = document.getElementById("feedback");
        feedback.className = "feedback error";
        feedback.textContent = "Erreur lors de l'envoi. Reessaie !";
        btn.disabled = false;
        btn.textContent = "Valider mes resultats";
    }
};