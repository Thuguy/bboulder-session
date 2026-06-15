import { db, getSession, clearSession, requireAuth } from "./auth.js";
import {
    collection, doc, getDoc, getDocs, setDoc, updateDoc, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const user = requireAuth();
if (!user || (user.role !== "juge" && user.role !== "admin")) {
    window.location.href = "index.html";
}

let tousLesParticipants = [];
let filtreActuel = "tous";
let participantAModifier = null;

// DECONNEXION
window.deconnexion = () => {
    clearSession();
    window.location.href = "index.html";
};

// PHASE
const phaseRef = doc(db, "config", "event");

onSnapshot(collection(db, "users"), (snapshot) => {
    const promises = snapshot.docs.map(async (docSnap) => {
        const data = docSnap.data();
        const scoreSnap = await getDoc(doc(db, "scores", docSnap.id));
        return {
            id: docSnap.id,
            ...data,
            scores: scoreSnap.exists() ? scoreSnap.data() : null
        };
    });

    Promise.all(promises).then((participants) => {
        // Deduplique par ID
        const seen = new Set();
        tousLesParticipants = participants.filter(p => {
            if (seen.has(p.id)) return false;
            seen.add(p.id);
            return true;
        });
        afficherParticipants();
    });
});
window.changerPhase = async (nouvellePhase) => {
    const PHASES_VALIDES = ["qualifs", "demis", "finale"];
    if (!PHASES_VALIDES.includes(nouvellePhase)) return;

    const labels = { qualifs: "QUALIFICATIONS", demis: "DEMI-FINALES", finale: "FINALE" };
    const confirme = confirm("Passer en phase : " + labels[nouvellePhase] + " ?");
    if (!confirme) return;

    try {
        await updateDoc(doc(db, "config", "event"), { phase: nouvellePhase });
    } catch (e) {
        console.error(e);
        alert("Erreur lors du changement de phase.");
    }
};

// CREATION PARTICIPANT
window.creerParticipant = async () => {
    const prenom = document.getElementById("new-prenom").value.trim();
    const nom = document.getElementById("new-nom").value.trim();
    const categorie = document.getElementById("new-categorie").value;
    const role = document.getElementById("new-role").value;
    const feedback = document.getElementById("create-feedback");

    if (!prenom || !nom) {
        feedback.className = "feedback error";
        feedback.textContent = "Merci de remplir le prenom et le nom.";
        feedback.classList.remove("hidden");
        return;
    }

    const password = genererMotDePasse();
    const userId = (prenom + "-" + nom).toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "-");

    try {
        await setDoc(doc(db, "users", userId), {
            prenom,
            nom,
            categorie,
            role,
            password,
            submitted: false,
            createdAt: serverTimestamp()
        });

        feedback.className = "feedback success";
        feedback.textContent =
            prenom + " " + nom + " cree avec le mot de passe : " + password;
        feedback.classList.remove("hidden");

        document.getElementById("new-prenom").value = "";
        document.getElementById("new-nom").value = "";

    } catch (e) {
        console.error(e);
        feedback.className = "feedback error";
        feedback.textContent = "Erreur lors de la creation. Reessaie.";
        feedback.classList.remove("hidden");
    }
};

function genererMotDePasse() {
    const nombre = Math.floor(1000 + Math.random() * 9000);
    return "BBS-" + nombre;
}

// LISTE PARTICIPANTS
onSnapshot(collection(db, "users"), async (snapshot) => {
    tousLesParticipants = [];
    for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        const scoreSnap = await getDoc(doc(db, "scores", docSnap.id));
        tousLesParticipants.push({
            id: docSnap.id,
            ...data,
            scores: scoreSnap.exists() ? scoreSnap.data() : null
        });
    }
    afficherParticipants();
});

window.filtrer = (filtre, btnElement) => {
    filtreActuel = filtre;
    document.querySelectorAll(".btn-filter").forEach(b => b.classList.remove("active"));
    btnElement.classList.add("active");
    afficherParticipants();
};

function afficherParticipants() {
    const liste = document.getElementById("participants-list");
    let filtres = tousLesParticipants;

    if (filtreActuel === "tous") {
        filtres = tousLesParticipants.filter(p => p.role === "participant");
    } else if (filtreActuel === "juge") {
        filtres = tousLesParticipants.filter(p => p.role === "juge");
    } else {
        filtres = tousLesParticipants.filter(p => p.categorie === filtreActuel && p.role === "participant");
    }

    if (filtres.length === 0) {
        liste.innerHTML = "<div class='card text-center'>Aucun participant.</div>";
        return;
    }

    liste.innerHTML = filtres.map(p => {
        const qualifs = p.scores?.qualifs;
        const soumis = qualifs?.submitted ? "Soumis" : "En attente";
        const score = qualifs?.score ?? "-";

        return `
      <div class="card participant-card">
        <div class="participant-info">
          <span class="participant-nom">${p.prenom.toUpperCase()} ${p.nom.toUpperCase()}</span>
          <span class="participant-meta">${p.categorie.toUpperCase()} &#8212; ${p.role.toUpperCase()}</span>
          <span class="participant-meta">Mot de passe : ${p.password}</span>
        </div>
        <div class="participant-score">
          <span class="score-badge ${qualifs?.submitted ? 'badge-success' : 'badge-pending'}">${soumis}</span>
          <span class="score-value">${score}</span>
          <button class="btn-small btn-red" onclick="ouvrirModal('${p.id}')">MODIFIER</button>
        </div>
      </div>
    `;
    }).join("");
}

// MODAL CORRECTION
window.ouvrirModal = async (userId) => {
    participantAModifier = tousLesParticipants.find(p => p.id === userId);
    if (!participantAModifier) return;

    const modal = document.getElementById("modal");
    const body = document.getElementById("modal-body");
    const qualifs = participantAModifier.scores?.qualifs;

    let html = `<p class="modal-participant">${participantAModifier.prenom.toUpperCase()} ${participantAModifier.nom.toUpperCase()}</p>`;
    html += `<div class="modal-blocs">`;

    for (let i = 1; i <= 20; i++) {
        const bloc = qualifs?.blocs?.find(b => b.id === i);
        const checked = bloc?.completed ? "checked" : "";
        const essais = bloc?.essais ?? 1;
        html += `
      <div class="modal-bloc-row">
        <span>BLOC ${i}</span>
        <label class="toggle">
          <input type="checkbox" id="modal-check-${i}" ${checked} onchange="majScoreModal()"/>
          <span class="slider"></span>
        </label>
        <div class="counter">
          <button type="button" onclick="changeModalAttempts(${i}, -1)">-</button>
          <span id="modal-attempts-${i}">${essais}</span>
          <button type="button" onclick="changeModalAttempts(${i}, +1)">+</button>
        </div>
      </div>
    `;
    }

    html += `</div>`;
    html += `<div class="score-preview"><span class="label">SCORE</span><span id="modal-score" class="score-value">0.0</span></div>`;

    body.innerHTML = html;
    modal.classList.remove("hidden");
    majScoreModal();
};

window.changeModalAttempts = (id, delta) => {
    const el = document.getElementById(`modal-attempts-${id}`);
    const next = Math.max(1, parseInt(el.textContent) + delta);
    el.textContent = next;
    majScoreModal();
};

window.majScoreModal = () => {
    let score = 0;
    for (let i = 1; i <= 20; i++) {
        const checked = document.getElementById(`modal-check-${i}`)?.checked;
        if (checked) {
            const essais = parseInt(document.getElementById(`modal-attempts-${i}`).textContent);
            score += 25 - (essais * 0.1);
        }
    }
    document.getElementById("modal-score").textContent = score.toFixed(1);
};

window.sauvegarderCorrection = async () => {
    if (!participantAModifier) return;

    const blocs = [];
    for (let i = 1; i <= 20; i++) {
        const completed = document.getElementById(`modal-check-${i}`).checked;
        const essais = parseInt(document.getElementById(`modal-attempts-${i}`).textContent);
        blocs.push({ id: i, completed, essais: completed ? essais : 0 });
    }

    const totalTops = blocs.filter(b => b.completed).length;
    const totalEssais = blocs.reduce((sum, b) => sum + b.essais, 0);
    const score = blocs.reduce((sum, b) => {
        if (b.completed) return sum + 25 - (b.essais * 0.1);
        return sum;
    }, 0);

    try {
        await setDoc(doc(db, "scores", participantAModifier.id), {
            qualifs: {
                blocs,
                totalTops,
                totalEssais,
                score: parseFloat(score.toFixed(1)),
                submitted: true,
                modifiedAt: serverTimestamp()
            }
        }, { merge: true });

        fermerModal();

    } catch (e) {
        console.error(e);
        alert("Erreur lors de la sauvegarde.");
    }
};

window.fermerModal = () => {
    document.getElementById("modal").classList.add("hidden");
    participantAModifier = null;
};

window.deconnexion = deconnexion;
window.changerPhase = changerPhase;
window.creerParticipant = creerParticipant;
window.filtrer = filtrer;
window.ouvrirModal = ouvrirModal;
window.fermerModal = fermerModal;
window.sauvegarderCorrection = sauvegarderCorrection;
window.changeModalAttempts = changeModalAttempts;
window.majScoreModal = majScoreModal;