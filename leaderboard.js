import { db } from "./auth.js";
import {
    collection, doc, onSnapshot, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const PHASES = ["qualifs", "demis", "finale"];
const LABELS = { qualifs: "QUALIFICATIONS", demis: "DEMI-FINALES", finale: "FINALE" };

let phaseActuelle = "qualifs";
let tousLesScores = {};

function calculerScore(phase, scoreData) {
    if (!scoreData?.blocs) return 0;
    return scoreData.blocs.reduce((sum, b) => {
        if (!b.completed) return sum;
        if (phase === "qualifs") return sum + 25 - (b.essais * 0.1);
        return sum + 25 + (b.zone ? 10 : 0) - (b.essais * 0.1);
    }, 0);
}

function trier(liste) {
    return liste.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (b.totalTops !== a.totalTops) return b.totalTops - a.totalTops;
        return a.totalEssais - b.totalEssais;
    });
}

function afficherTableau(tbodyId, liste) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;

    if (liste.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5">Aucun resultat pour l'instant.</td></tr>`;
        return;
    }

    tbody.innerHTML = liste.map((r, i) => `
    <tr class="${i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : ''}">
      <td>${i + 1}</td>
      <td>${r.nom.toUpperCase()}</td>
      <td>${r.totalTops}</td>
      <td>${r.totalEssais}</td>
      <td>${r.score.toFixed(1)}</td>
    </tr>
  `).join("");
}

function afficherPhase(phase, users) {
    const hommes = [];
    const femmes = [];

    users.forEach(u => {
        if (u.role !== "participant") return;
        const scoreData = tousLesScores[u.id]?.[phase];
        if (!scoreData?.submitted) return;

        const entry = {
            nom: u.prenom + " " + u.nom,
            totalTops: scoreData.totalTops ?? 0,
            totalEssais: scoreData.totalEssais ?? 0,
            score: scoreData.score ?? calculerScore(phase, scoreData)
        };

        if (u.categorie === "homme") hommes.push(entry);
        else femmes.push(entry);
    });

    const suffix = phase === "qualifs" ? "qualifs" : phase === "demis" ? "demis" : "finale";
    afficherTableau(`tbody-${suffix}-homme`, trier(hommes));
    afficherTableau(`tbody-${suffix}-femme`, trier(femmes));

    // Si c'est la phase en cours, on duplique aussi dans la section en cours
    if (phase === phaseActuelle) {
        afficherTableau("tbody-encours-homme", trier([...hommes]));
        afficherTableau("tbody-encours-femme", trier([...femmes]));
    }
}

function mettreAJourInterface(users) {
    // Badge phase en cours
    document.getElementById("phase-en-cours-label").textContent = "EN COURS : " + LABELS[phaseActuelle];
    document.getElementById("titre-en-cours").textContent = LABELS[phaseActuelle];

    // Affiche toutes les phases
    PHASES.forEach(phase => afficherPhase(phase, users));

    // Masque la section en cours dans les sections historiques
    document.getElementById("section-qualifs").style.display = phaseActuelle === "qualifs" ? "none" : "block";
    document.getElementById("section-demis").style.display = phaseActuelle === "demis" ? "none" : "block";
    document.getElementById("section-finale").style.display = phaseActuelle === "finale" ? "none" : "block";
}

// Ecoute la phase
onSnapshot(doc(db, "config", "event"), (snap) => {
    phaseActuelle = snap.data()?.phase || "qualifs";
    if (Object.keys(tousLesScores).length > 0) {
        mettreAJourInterface(tousLesUsers);
    }
});

// Ecoute les scores et users
let tousLesUsers = [];

onSnapshot(collection(db, "users"), (snapshot) => {
    tousLesUsers = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

    const promises = tousLesUsers
        .filter(u => u.role === "participant")
        .map(async (u) => {
            const scoreSnap = await getDocs(collection(db, "scores"));
            const scoreDoc = scoreSnap.docs.find(s => s.id === u.id);
            tousLesScores[u.id] = scoreDoc?.data() ?? null;
        });

    Promise.all(promises).then(() => {
        mettreAJourInterface(tousLesUsers);
    });
});