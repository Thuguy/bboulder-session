import { db, requireAuth } from "./auth.js";
import {
    doc, getDoc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const user = requireAuth("participant");
if (!user) throw new Error("Non autorise");

// Affiche les infos du participant
document.getElementById("user-info").textContent =
    user.prenom.toUpperCase() + " " + user.nom.toUpperCase() + " &#8212; " + user.categorie.toUpperCase();

const NB_BLOCS = 20;

// Verifie si deja soumis
const scoreRef = doc(db, "scores", user.id);
const scoreSnap = await getDoc(scoreRef);

if (scoreSnap.exists() && scoreSnap.data().qualifs?.submitted) {
    document.getElementById("form-container").classList.add("hidden");
    document.getElementById("already-submitted").classList.remove("hidden");
} else {
    construireFormulaire();
}

function construireFormulaire() {
    const container = document.getElementById("blocs-container");

    for (let i = 1; i <= NB_BLOCS; i++) {
        const card = document.createElement("div");
        card.className = "card bloc-card";
        card.innerHTML = `
      <div class="bloc-header">
        <span class="bloc-name">BLOC ${i}</span>
        <label class="toggle">
          <input type="checkbox" id="check-${i}" onchange="toggleBloc(${i})"/>
          <span class="slider"></span>
        </label>
      </div>
      <div class="attempts-row hidden" id="attempts-row-${i}">
        <span class="label">ESSAIS</span>
        <div class="counter">
          <button type="button" onclick="changeAttempts(${i}, -1)">-</button>
          <span id="attempts-${i}">1</span>
          <button type="button" onclick="changeAttempts(${i}, +1)">+</button>
        </div>
      </div>
    `;
        container.appendChild(card);
    }
}

window.toggleBloc = (id) => {
    const checked = document.getElementById(`check-${id}`).checked;
    document.getElementById(`attempts-row-${id}`).classList.toggle("hidden", !checked);
    calculerScore();
};

window.changeAttempts = (id, delta) => {
    const el = document.getElementById(`attempts-${id}`);
    const next = Math.max(1, parseInt(el.textContent) + delta);
    el.textContent = next;
    calculerScore();
};

function calculerScore() {
    let score = 0;
    for (let i = 1; i <= NB_BLOCS; i++) {
        const completed = document.getElementById(`check-${i}`).checked;
        if (completed) {
            const essais = parseInt(document.getElementById(`attempts-${i}`).textContent);
            score += 25 - (essais * 0.1);
        }
    }
    document.getElementById("score-display").textContent = score.toFixed(1);
}

window.soumettre = async () => {
    const blocs = [];
    for (let i = 1; i <= NB_BLOCS; i++) {
        const completed = document.getElementById(`check-${i}`).checked;
        const essais = completed
            ? parseInt(document.getElementById(`attempts-${i}`).textContent)
            : 0;
        blocs.push({ id: i, completed, essais });
    }

    const totalTops = blocs.filter(b => b.completed).length;
    const totalEssais = blocs.reduce((sum, b) => sum + b.essais, 0);
    const score = blocs.reduce((sum, b) => {
        if (b.completed) return sum + 25 - (b.essais * 0.1);
        return sum;
    }, 0);

    const btn = document.getElementById("submit-btn");
    btn.disabled = true;
    btn.textContent = "ENVOI EN COURS...";

    try {
        await setDoc(scoreRef, {
            qualifs: {
                blocs,
                totalTops,
                totalEssais,
                score: parseFloat(score.toFixed(1)),
                submitted: true,
                timestamp: serverTimestamp()
            }
        }, { merge: true });

        document.getElementById("feedback").className = "feedback success";
        document.getElementById("feedback").textContent =
            "Resultats enregistres avec succes !";
        document.getElementById("feedback").classList.remove("hidden");
        btn.classList.add("hidden");

    } catch (e) {
        console.error(e);
        document.getElementById("feedback").className = "feedback error";
        document.getElementById("feedback").textContent =
            "Erreur lors de l'envoi. Reessaie.";
        document.getElementById("feedback").classList.remove("hidden");
        btn.disabled = false;
        btn.textContent = "VALIDER MES RESULTATS";
    }
};