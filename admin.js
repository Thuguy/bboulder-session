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
let phaseActuelle = "qualifs";

// DECONNEXION
window.deconnexion = () => {
    clearSession();
    window.location.href = "index.html";
};

// PHASE
const phaseRef = doc(db, "config", "event");
async function rechargerScores() {
    const promises = tousLesParticipants.map(async (p) => {
        const scoreSnap = await getDoc(doc(db, "scores", p.id));
        p.scores = scoreSnap.exists() ? scoreSnap.data() : null;
        return p;
    });

    tousLesParticipants = await Promise.all(promises);
    afficherParticipants();
}

onSnapshot(phaseRef, (snap) => {
    phaseActuelle = snap.data()?.phase || "qualifs";
    const labels = { qualifs: "QUALIFICATIONS", demis: "DEMI-FINALES", finale: "FINALE" };
    document.getElementById("phase-actuelle").textContent = labels[phaseActuelle] || phaseActuelle.toUpperCase();
    rechargerScores();
});
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
        const scorePhase = p.scores?.[phaseActuelle];
        const soumis = scorePhase?.submitted ? "Soumis" : "En attente";
        const score = scorePhase?.score ?? "-";

        return `
      <div class="card participant-card">
        <div class="participant-info">
          <span class="participant-nom">${p.prenom.toUpperCase()} ${p.nom.toUpperCase()}</span>
          <span class="participant-meta">${p.categorie.toUpperCase()} &#8212; ${p.role.toUpperCase()}</span>
          <span class="participant-meta">Mot de passe : ${p.password}</span>
        </div>
        <div class="participant-score">
<span class="score-badge ${scorePhase?.submitted ? 'badge-success' : 'badge-pending'}">${soumis}</span>
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

    const NB_BLOCS = phaseActuelle === "qualifs" ? 20 : 4;
    const modal = document.getElementById("modal");
    const body = document.getElementById("modal-body");
    const scorePhase = participantAModifier.scores?.[phaseActuelle];

    let html = `<p class="modal-participant">${participantAModifier.prenom.toUpperCase()} ${participantAModifier.nom.toUpperCase()}</p>`;
    html += `<div class="modal-blocs">`;

    for (let i = 1; i <= NB_BLOCS; i++) {
        const bloc = scorePhase?.blocs?.find(b => b.id === i);
        const essais = bloc?.essais ?? 0;
        const zone = bloc?.zone ? "checked" : "";
        const top = (bloc?.top || bloc?.completed) ? "checked" : "";

        html += `
      <div class="modal-bloc-row">
        <span>BLOC ${i}</span>
        ${phaseActuelle !== "qualifs" ? `
        <div class="toggle-group">
          <span class="label">ZONE</span>
          <label class="toggle">
            <input type="checkbox" id="modal-zone-${i}" ${zone} onchange="majScoreModal()"/>
            <span class="slider"></span>
          </label>
        </div>
        ` : ""}
        <div class="toggle-group">
          <span class="label">TOP</span>
          <label class="toggle">
            <input type="checkbox" id="modal-top-${i}" ${top} onchange="majScoreModal()"/>
            <span class="slider"></span>
          </label>
        </div>
        <div class="counter">
          <span class="label">ESSAIS</span>
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
    const next = Math.max(0, parseInt(el.textContent) + delta);
    el.textContent = next;
    majScoreModal();
};

window.majScoreModal = () => {
    const NB_BLOCS = phaseActuelle === "qualifs" ? 20 : 4;
    let score = 0;
    for (let i = 1; i <= NB_BLOCS; i++) {
        const essais = parseInt(document.getElementById(`modal-attempts-${i}`).textContent);
        const top = document.getElementById(`modal-top-${i}`)?.checked ?? false;
        const zone = phaseActuelle !== "qualifs"
            ? (document.getElementById(`modal-zone-${i}`)?.checked ?? false)
            : false;

        if (top) score += 25 - (essais * 0.1);
        else if (zone) score += 10 - (essais * 0.1);
        else score -= essais * 0.1;
    }
    document.getElementById("modal-score").textContent = score.toFixed(1);
};

window.sauvegarderCorrection = async () => {
    if (!participantAModifier) return;

    const NB_BLOCS = phaseActuelle === "qualifs" ? 20 : 4;
    const blocs = [];

    for (let i = 1; i <= NB_BLOCS; i++) {
        const essais = parseInt(document.getElementById(`modal-attempts-${i}`).textContent);
        const top = document.getElementById(`modal-top-${i}`)?.checked ?? false;
        const zone = phaseActuelle !== "qualifs"
            ? (document.getElementById(`modal-zone-${i}`)?.checked ?? false)
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

    try {
        await setDoc(doc(db, "scores", participantAModifier.id), {
            [phaseActuelle]: {
                blocs,
                totalTops,
                totalZones,
                totalEssais,
                score: parseFloat(score.toFixed(1)),
                submitted: true,
                modifiedAt: serverTimestamp()
            }
        }, { merge: true });

        // Met a jour le participant localement sans recharger
        const idx = tousLesParticipants.findIndex(p => p.id === participantAModifier.id);
        if (idx !== -1) {
            tousLesParticipants[idx].scores = tousLesParticipants[idx].scores || {};
            tousLesParticipants[idx].scores[phaseActuelle] = {
                blocs,
                totalTops,
                totalZones,
                totalEssais,
                score: parseFloat(score.toFixed(1)),
                submitted: true
            };
            afficherParticipants();
        }
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

window.genererTestData = async () => {
    const participants = [
        // HOMMES
        { prenom: "Pierre", nom: "Fissure", categorie: "homme" },
        { prenom: "Rocky", nom: "Leboulder", categorie: "homme" },
        { prenom: "Max", nom: "Grip", categorie: "homme" },
        { prenom: "Kevin", nom: "Delafalaise", categorie: "homme" },
        { prenom: "Dylan", nom: "Lacrique", categorie: "homme" },
        { prenom: "Tom", nom: "Boulderak", categorie: "homme" },
        { prenom: "Sam", nom: "Escalados", categorie: "homme" },
        { prenom: "Jack", nom: "Crashpad", categorie: "homme" },
        { prenom: "Ben", nom: "Lamagnet", categorie: "homme" },
        { prenom: "Nico", nom: "Priseenmain", categorie: "homme" },
        { prenom: "Alex", nom: "Delavertical", categorie: "homme" },
        { prenom: "Hugo", nom: "Chalkboard", categorie: "homme" },
        { prenom: "Marc", nom: "Sommet", categorie: "homme" },
        { prenom: "Luc", nom: "Lacrux", categorie: "homme" },
        { prenom: "Paul", nom: "Dedales", categorie: "homme" },
        { prenom: "Chris", nom: "Magnesia", categorie: "homme" },
        { prenom: "Fred", nom: "Lapierre", categorie: "homme" },
        { prenom: "Greg", nom: "Toplevel", categorie: "homme" },
        { prenom: "Rob", nom: "Highball", categorie: "homme" },
        { prenom: "Dan", nom: "Blocmasters", categorie: "homme" },
        // FEMMES
        { prenom: "Emma", nom: "Lacrimpette", categorie: "femme" },
        { prenom: "Lea", nom: "Delaparoi", categorie: "femme" },
        { prenom: "Sara", nom: "Crashpadette", categorie: "femme" },
        { prenom: "Julie", nom: "Lazone", categorie: "femme" },
        { prenom: "Marie", nom: "Magnesia", categorie: "femme" },
        { prenom: "Clara", nom: "Highballeuse", categorie: "femme" },
        { prenom: "Nina", nom: "Lafalaise", categorie: "femme" },
        { prenom: "Lucie", nom: "Delagrip", categorie: "femme" },
        { prenom: "Jade", nom: "Blockeuse", categorie: "femme" },
        { prenom: "Zoe", nom: "Sommetale", categorie: "femme" },
        { prenom: "Alice", nom: "Lacrux", categorie: "femme" },
        { prenom: "Chloe", nom: "Topzone", categorie: "femme" },
        { prenom: "Manon", nom: "Lavertical", categorie: "femme" },
        { prenom: "Lola", nom: "Priseenfleur", categorie: "femme" },
        { prenom: "Camille", nom: "Delamontagne", categorie: "femme" },
        { prenom: "Anais", nom: "Chalkette", categorie: "femme" },
        { prenom: "Elisa", nom: "Boulderina", categorie: "femme" },
        { prenom: "Oceane", nom: "Lapiton", categorie: "femme" },
        { prenom: "Pauline", nom: "Grimpeuse", categorie: "femme" },
        { prenom: "Marine", nom: "Lacaillou", categorie: "femme" },
    ];

    let count = 0;
    for (const p of participants) {
        const nombre = Math.floor(1000 + Math.random() * 9000);
        const password = "BBS-" + nombre;
        const userId = (p.prenom + "-" + p.nom).toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/\s+/g, "-");

        await setDoc(doc(db, "users", userId), {
            prenom: p.prenom,
            nom: p.nom,
            categorie: p.categorie,
            role: "participant",
            password,
            submitted: false
        });
        count++;
        console.log("Cree : " + p.prenom + " " + p.nom + " — " + password);
    }
    alert(count + " participants crees !");
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