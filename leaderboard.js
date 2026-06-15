import { db } from "./auth.js";
import {
    collection, doc, onSnapshot, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let phaseActuelle = "qualifs";

// PHASE EN COURS
onSnapshot(doc(db, "config", "event"), (snap) => {
    phaseActuelle = snap.data()?.phase || "qualifs";
    const labels = { qualifs: "QUALIFICATIONS", demis: "DEMI-FINALES", finale: "FINALE" };
    document.getElementById("phase-label").textContent = labels[phaseActuelle] || phaseActuelle.toUpperCase();
});

// CLASSEMENT EN TEMPS REEL
onSnapshot(collection(db, "users"), async (snapshot) => {
    const hommes = [];
    const femmes = [];

    for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        if (data.role !== "participant") continue;

        const scoreSnap = await getDocs(collection(db, "scores"));
        const scoreDoc = scoreSnap.docs.find(s => s.id === docSnap.id);
        const scores = scoreDoc?.data();
        const phase = scores?.[phaseActuelle];

        if (!phase?.submitted) continue;

        const entry = {
            nom: data.prenom + " " + data.nom,
            totalTops: phase.totalTops ?? 0,
            totalEssais: phase.totalEssais ?? 0,
            score: phase.score ?? 0
        };

        if (data.categorie === "homme") hommes.push(entry);
        else femmes.push(entry);
    }

    const trier = (liste) => liste.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (b.totalTops !== a.totalTops) return b.totalTops - a.totalTops;
        return a.totalEssais - b.totalEssais;
    });

    afficherClassement(trier(hommes), "tbody-homme");
    afficherClassement(trier(femmes), "tbody-femme");
});

function afficherClassement(liste, tbodyId) {
    const tbody = document.getElementById(tbodyId);

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