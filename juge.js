import { db, getSession, clearSession, requireAuth } from "./auth.js";
import {
    collection, doc, getDoc, getDocs, setDoc, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const user = requireAuth();
if (!user || (user.role !== "juge" && user.role !== "admin")) {
    window.location.href = "index.html";
}

let tousLesParticipants = [];
let participantSelectionne = null;
let filtreActuel = "tous";

// DECONNEXION
window.deconnexion = () => {
    clearSession();
    window.location.href = "index.html";
};

// PHASE EN COURS
const phaseRef = doc(db, "config", "event");
let phaseActuelle = "qualifs";

onSnapshot(phaseRef, (snap) => {
    phaseActuelle = snap.data()?.phase || "qualifs";
    const labels = { qualifs: "QUALIFICATIONS", demis: "DEMI-FINALES", finale: "FINALE" };
    document.getElementById("phase-actuelle").textContent = labels[phaseActuelle] || phaseActuelle.toUpperCase();
});

// LISTE PARTICIPANTS
onSnapshot(collection(db, "users"), (snapshot) => {
    const promises = snapshot.docs
        .filter(docSnap => docSnap.data().role === "participant")
        .map(async (docSnap) => {
            const data = docSnap.data();
            const scoreSnap = await getDoc(doc(db, "scores", docSnap.id));
            return {
                id: docSnap.id,
                ...data,
                scores: scoreSnap.exists() ? scoreSnap.data() : null
            };
        });

    Promise.all(promises).then((participants) => {
        const seen = new Set();
        tousLesParticipants = participants.filter(p => {
            if (seen.has(p.id)) return false;
            seen.add(p.id);
            return true;
        });
        afficherParticipants();
    });
});

window.filtrerCategorie = (filtre, btnElement) => {
    filtreActuel = filtre;
    document.querySelectorAll(".btn-filter").forEach(b => b.classList.remove("active"));
    btnElement.classList.add("active");
    afficherParticipants();
};

function afficherParticipants() {
    const container = document.getElementById("participants-select");
    let filtres = tousLesParticipants;

    if (filtreActuel !== "tous") {
        filtres = tousLesParticipants.filter(p => p.categorie === filtreActuel);
    }

    if (filtres.length === 0) {
        container.innerHTML = "<div class='card text-center'>Aucun participant.</div>";
        return;
    }

    container.innerHTML = filtres.map(p => {
        const scorePhase = p.scores?.[phaseActuelle];
        const statut = scorePhase?.submitted
            ? "Saisi"
            : scorePhase?.validated
                ? "Valide"
                : "En attente";

        return `
      <div class="card participant-card" onclick="selectionnerParticipant('${p.id}')">
        <div class="participant-info">
          <span class="participant-nom">${p.prenom.toUpperCase()} ${p.nom.toUpperCase()}</span>
          <span class="participant-meta">${p.categorie.toUpperCase()}</span>
        </div>
        <span class="score-badge ${scorePhase?.submitted ? 'badge-success' : 'badge-pending'}">${statut}</span>
      </div>
    `;
    }).join("");
}

window.selectionnerParticipant = async (userId) => {
    participantSelectionne = tousLesParticipants.find(p => p.id === userId);
    if (!participantSelectionne) return;

    document.getElementById("participant-nom").textContent =
        participantSelectionne.prenom.toUpperCase() + " " + participantSelectionne.nom.toUpperCase();

    const NB_BLOCS = phaseActuelle === "qualifs" ? 20 : 4;
    const container = document.getElementById("blocs-juge");
    container.innerHTML = "";

    const scoreExistant = participantSelectionne.scores?.[phaseActuelle];

    for (let i = 1; i <= NB_BLOCS; i++) {
        const bloc = scoreExistant?.blocs?.find(b => b.id === i);
        const essais = bloc?.essais ?? 1;
        const zone = bloc?.zone ? "checked" : "";
        const top = bloc?.top ? "checked" : "";

        const card = document.createElement("div");
        card.className = "card bloc-card";

        let html = `
  <div class="bloc-header">
    <span class="bloc-name">BLOC ${i}</span>
  </div>
  <div class="bloc-saisie-row">
    ${phaseActuelle !== "qualifs" ? `
    <div class="toggle-group">
      <span class="label">ZONE</span>
      <label class="toggle">
        <input type="checkbox" id="zone-${i}" ${zone} onchange="majScoreJuge()"/>
        <span class="slider"></span>
      </label>
    </div>
    ` : ""}
    <div class="toggle-group">
      <span class="label">TOP</span>
      <label class="toggle">
        <input type="checkbox" id="top-${i}" ${top} onchange="majScoreJuge()"/>
        <span class="slider"></span>
      </label>
    </div>
    <div class="counter">
      <span class="label">ESSAIS</span>
      <button type="button" onclick="changeAttemptsJuge(${i}, -1)">-</button>
      <span id="attempts-${i}">${bloc?.essais ?? 0}</span>
      <button type="button" onclick="changeAttemptsJuge(${i}, +1)">+</button>
    </div>
  </div>
`;
        card.innerHTML = html;
        container.appendChild(card);
    }

    majScoreJuge();
    document.getElementById("saisie-container").classList.remove("hidden");
};

window.changeAttemptsJuge = (id, delta) => {
    const el = document.getElementById(`attempts-${id}`);
    const next = Math.max(0, parseInt(el.textContent) + delta);
    el.textContent = next;
    majScoreJuge();
};

window.majScoreJuge = () => {
    const NB_BLOCS = phaseActuelle === "qualifs" ? 20 : 4;
    let score = 0;

    for (let i = 1; i <= NB_BLOCS; i++) {
        const essais = parseInt(document.getElementById(`attempts-${i}`).textContent);
        const top = document.getElementById(`top-${i}`)?.checked ?? false;
        const zone = phaseActuelle !== "qualifs"
            ? (document.getElementById(`zone-${i}`)?.checked ?? false)
            : false;

        if (top) {
            score += 25 - (essais * 0.1);
        } else if (zone) {
            score += 10 - (essais * 0.1);
        } else {
            score += 0 - (essais * 0.1);
        }
    }

    document.getElementById("score-display").textContent = score.toFixed(1);
};

window.validerScore = async () => {
    if (!participantSelectionne) return;

    const NB_BLOCS = phaseActuelle === "qualifs" ? 20 : 4;
    const blocs = [];

    for (let i = 1; i <= NB_BLOCS; i++) {
        const essais = parseInt(document.getElementById(`attempts-${i}`).textContent);
        const top = document.getElementById(`top-${i}`)?.checked ?? false;
        const zone = phaseActuelle !== "qualifs"
            ? (document.getElementById(`zone-${i}`)?.checked ?? false)
            : false;
        blocs.push({ id: i, essais, top, zone });
    }

    const totalTops = blocs.filter(b => b.top).length;
    const totalZones = blocs.filter(b => b.zone).length;
    const totalEssais = blocs.reduce((sum, b) => sum + b.essais, 0);
    const score = blocs.reduce((sum, b) => {
        if (b.top) return sum + 25 - (b.essais * 0.1);
        if (b.zone) return sum + 10 - (b.essais * 0.1);
        return sum - (b.essais * 0.1);
    }, 0);

    const btn = document.getElementById("valider-btn");
    btn.disabled = true;
    btn.textContent = "ENVOI EN COURS...";

    try {
        await setDoc(doc(db, "scores", participantSelectionne.id), {
            [phaseActuelle]: {
                blocs,
                totalTops,
                totalZones,
                totalEssais,
                score: parseFloat(score.toFixed(1)),
                submitted: true,
                jugeId: user.id,
                timestamp: serverTimestamp()
            }
        }, { merge: true });

        document.getElementById("juge-feedback").className = "feedback success";
        document.getElementById("juge-feedback").textContent = "Score valide avec succes.";
        document.getElementById("juge-feedback").classList.remove("hidden");
        btn.disabled = false;
        btn.textContent = "VALIDER ET SOUMETTRE";

    } catch (e) {
        console.error(e);
        document.getElementById("juge-feedback").className = "feedback error";
        document.getElementById("juge-feedback").textContent = "Erreur lors de la validation.";
        document.getElementById("juge-feedback").classList.remove("hidden");
        btn.disabled = false;
        btn.textContent = "VALIDER ET SOUMETTRE";
    }
};

window.resetSaisie = () => {
    participantSelectionne = null;
    document.getElementById("saisie-container").classList.add("hidden");
    document.getElementById("juge-feedback").classList.add("hidden");
};