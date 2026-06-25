import { db, requireAuth } from "./auth.js";
import {
    doc, getDoc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const user = requireAuth("participant");
if (!user) throw new Error("Non autorise");

document.getElementById("user-info").textContent =
    user.prenom.toUpperCase() + " " + user.nom.toUpperCase() + " — " + user.categorie.toUpperCase();

const scoreRef = doc(db, "scores", user.id);
let scoreData = null;

// Charge les scores existants et determine quelle vague afficher
async function init() {
    const snap = await getDoc(scoreRef);
    scoreData = snap.exists() ? snap.data() : {};

    const vague1 = scoreData?.qualifs?.vague1;
    const vague2 = scoreData?.qualifs?.vague2;
    const qualifie = scoreData?.qualifs?.qualifieVague2;

    if (vague1?.submitted && vague2?.submitted) {
        // Tout soumis
        afficherTermine();
    } else if (vague1?.submitted && qualifie && !vague2?.submitted) {
        // Vague 1 ok, qualifie pour vague 2
        afficherVague(2);
    } else if (vague1?.submitted && !qualifie) {
        // Vague 1 ok, pas qualifie
        afficherNonQualifie(vague1.score);
    } else {
        // Vague 1 pas encore soumise
        afficherVague(1);
    }
}

function afficherVague(numero) {
    const debut = numero === 1 ? 1 : 11;
    const fin = numero === 1 ? 10 : 20;

    document.getElementById("vague-label").textContent = "VAGUE " + numero + " — BLOCS " + debut + " A " + fin;
    document.getElementById("submit-btn").textContent = "VALIDER VAGUE " + numero;

    const container = document.getElementById("blocs-container");
    container.innerHTML = "";

    for (let i = debut; i <= fin; i++) {
        const blocsExistants = scoreData?.qualifs?.["vague" + numero]?.blocs;
        const bloc = blocsExistants?.find(b => b.id === i);
        const checked = bloc?.completed ? "checked" : "";
        const essais = bloc?.essais ?? 1;

        const card = document.createElement("div");
        card.className = "card bloc-card";
        card.innerHTML = `
      <div class="bloc-header">
        <span class="bloc-name">BLOC ${i}</span>
        <label class="toggle">
          <input type="checkbox" id="check-${i}" ${checked} onchange="toggleBloc(${i})"/>
          <span class="slider"></span>
        </label>
      </div>
      <div class="attempts-row ${bloc?.completed ? '' : 'hidden'}" id="attempts-row-${i}">
        <span class="label">ESSAIS</span>
        <div class="counter">
          <button type="button" onclick="changeAttempts(${i}, -1)">-</button>
          <span id="attempts-${i}">${essais}</span>
          <button type="button" onclick="changeAttempts(${i}, +1)">+</button>
        </div>
      </div>
    `;
        container.appendChild(card);
    }

    calculerScore(numero);
    document.getElementById("form-container").classList.remove("hidden");
    document.getElementById("already-submitted").classList.add("hidden");
    document.getElementById("non-qualifie").classList.add("hidden");
    document.getElementById("termine").classList.add("hidden");

    // Stocke la vague en cours
    window._vagueEnCours = numero;
}

function afficherNonQualifie(score) {
    document.getElementById("form-container").classList.add("hidden");
    document.getElementById("already-submitted").classList.add("hidden");
    document.getElementById("termine").classList.add("hidden");
    document.getElementById("non-qualifie").classList.remove("hidden");
    document.getElementById("score-final-v1").textContent = score.toFixed(1);
}

function afficherTermine() {
    const scoreTotal = scoreData?.qualifs?.scoreTotal ?? 0;
    document.getElementById("form-container").classList.add("hidden");
    document.getElementById("already-submitted").classList.add("hidden");
    document.getElementById("non-qualifie").classList.add("hidden");
    document.getElementById("termine").classList.remove("hidden");
    document.getElementById("score-final-total").textContent = scoreTotal.toFixed(1);
}

window.toggleBloc = (id) => {
    const checked = document.getElementById(`check-${id}`).checked;
    document.getElementById(`attempts-row-${id}`).classList.toggle("hidden", !checked);
    calculerScore(window._vagueEnCours);
};

window.changeAttempts = (id, delta) => {
    const el = document.getElementById(`attempts-${id}`);
    const next = Math.max(1, parseInt(el.textContent) + delta);
    el.textContent = next;
    calculerScore(window._vagueEnCours);
};

function calculerScore(vague) {
    const debut = vague === 1 ? 1 : 11;
    const fin = vague === 1 ? 10 : 20;
    let score = 0;

    for (let i = debut; i <= fin; i++) {
        const checked = document.getElementById(`check-${i}`)?.checked;
        if (checked) {
            const essais = parseInt(document.getElementById(`attempts-${i}`).textContent);
            score += 25 - (essais * 0.1);
        }
    }
    document.getElementById("score-display").textContent = score.toFixed(1);
}

window.soumettre = async () => {
    const vague = window._vagueEnCours;
    const debut = vague === 1 ? 1 : 11;
    const fin = vague === 1 ? 10 : 20;

    const blocs = [];
    for (let i = debut; i <= fin; i++) {
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
        const vagueKey = "vague" + vague;
        const qualifieV2 = vague === 1 && totalTops === 10;
        const scoreV1 = vague === 1 ? score : (scoreData?.qualifs?.vague1?.score ?? 0);
        const scoreV2 = vague === 2 ? score : 0;
        const scoreTotal = parseFloat((scoreV1 + scoreV2).toFixed(1));

        const updateData = {
            qualifs: {
                ...scoreData?.qualifs,
                [vagueKey]: {
                    blocs,
                    totalTops,
                    totalEssais,
                    score: parseFloat(score.toFixed(1)),
                    submitted: true,
                    timestamp: serverTimestamp()
                },
                scoreTotal,
                submitted: vague === 2 ? true : (qualifieV2 ? false : true)
            }
        };

        if (vague === 1) {
            updateData.qualifs.qualifieVague2 = qualifieV2;
        }

        await setDoc(scoreRef, updateData, { merge: true });
        scoreData = updateData;

        if (vague === 1 && qualifieV2) {
            // Affiche message transition vers vague 2
            document.getElementById("feedback").className = "feedback success";
            document.getElementById("feedback").textContent =
                "Vague 1 validee ! Tu es qualifie pour la vague 2. Pret ?";
            document.getElementById("feedback").classList.remove("hidden");

            setTimeout(() => {
                afficherVague(2);
                document.getElementById("feedback").classList.add("hidden");
            }, 2500);

        } else if (vague === 1 && !qualifieV2) {
            afficherNonQualifie(score);
        } else {
            afficherTermine();
        }

    } catch (e) {
        console.error(e);
        document.getElementById("feedback").className = "feedback error";
        document.getElementById("feedback").textContent = "Erreur lors de l'envoi. Reessaie.";
        document.getElementById("feedback").classList.remove("hidden");
        btn.disabled = false;
        btn.textContent = "VALIDER VAGUE " + vague;
    }
};

init();