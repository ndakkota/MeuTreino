// Registra o Service Worker especificando o escopo correto do GitHub Pages
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/MeuTreino/sw.js', { scope: '/MeuTreino/' })
    .catch((err) => console.log('SW error:', err));
}

// Banco de Frases Motivacionais
const MOTIVATIONAL_QUOTES = [
  '"O único treino ruim é aquele que não aconteceu."',
  '"A dor que você sente hoje é a força que você sente amanhã."',
  '"Desafie-se todos os dias!"',
  '"Disciplina é fazer o que precisa ser feito, mesmo sem vontade."',
  '"Pequenos progressos diários resultam em grandes conquistas."',
  '"O seu único limite é você."'
];

// Estado da Aplicação
let currentWorkout = 'A';
let timerInterval = null;
let timerSeconds = 60;
let watchId = null;

let cardioData = {
  isTracking: false,
  distanceKm: 0,
  seconds: 0,
  steps: 0,
  calories: 0,
  speed: 0,
  positions: [],
  intervalId: null
};

let workouts = JSON.parse(localStorage.getItem('powerfit_workouts')) || {
  A: [],
  B: [],
  C: []
};

let history = JSON.parse(localStorage.getItem('powerfit_history')) || [];

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
  displayRandomQuote();
  updateDashboard();
  renderExercises(workouts[currentWorkout]);
  initPedometer();
});

function displayRandomQuote() {
  const randomIndex = Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length);
  const quoteEl = document.getElementById('motivational-quote');
  if (quoteEl) quoteEl.innerText = MOTIVATIONAL_QUOTES[randomIndex];
}

function saveWorkouts() {
  localStorage.setItem('powerfit_workouts', JSON.stringify(workouts));
}

function saveHistory() {
  localStorage.setItem('powerfit_history', JSON.stringify(history));
}

function switchWorkout(workout) {
  currentWorkout = workout;

  document.getElementById("exercise-list").style.display = "none";
  document.getElementById("btn-add").style.display = "none";
  document.getElementById("cardio-panel").style.display = "none";
  document.getElementById("history-list").style.display = "none";
  document.querySelector(".buttons-group").style.display = "flex";

  document.querySelectorAll(".tabs button").forEach(btn => btn.classList.remove("active"));
  document.getElementById(`btn-tab-${workout}`).classList.add("active");

  if (workout === "Cardio") {
    document.getElementById("cardio-panel").style.display = "block";
    document.getElementById("btn-add").style.display = "none";
    document.getElementById("btn-conclude").style.display = "none";
    document.getElementById("progress").innerText = "Atividade de Cardio";
    
    // Redesenha a rota no Canvas ao mudar para a aba Cardio
    drawRoute("cardio-route-canvas", cardioData.positions);
  } else {
    document.getElementById("exercise-list").style.display = "block";
    document.getElementById("btn-add").style.display = "block";
    document.getElementById("btn-conclude").style.display = "block";
    renderExercises(workouts[currentWorkout]);
  }
}

function renderExercises(list) {
  const container = document.getElementById("exercise-list");
  container.innerHTML = "";

  if (!list || list.length === 0) {
    container.innerHTML = `<p style="color:#666; text-align:center; padding: 20px;">Nenhum exercício cadastrado no Treino ${currentWorkout}.</p>`;
    updateProgress();
    return;
  }

  list.forEach((ex, index) => {
    const card = document.createElement("div");
    card.className = "exercise";

    let seriesHTML = "";
    for (let i = 0; i < (ex.series || 3); i++) {
      const isChecked = ex.completedSeries && ex.completedSeries[i];
      seriesHTML += `<input type="checkbox" class="round-checkbox" ${isChecked ? "checked" : ""} onchange="toggleSeries(${index}, ${i})">`;
    }

    card.innerHTML = `
      <button class="delete-btn" onclick="removeExercise(${index})">✕</button>
      <label>Exercício</label>
      <input type="text" value="${ex.name || ''}" onchange="updateExerciseData(${index}, 'name', this.value)" placeholder="Nome do exercício">
      
      <div style="display: flex; gap: 10px;">
        <div style="flex:1;">
          <label>Carga (kg)</label>
          <input type="number" value="${ex.weight || ''}" onchange="updateExerciseData(${index}, 'weight', this.value)" placeholder="0">
        </div>
        <div style="flex:1;">
          <label>Séries</label>
          <input type="number" value="${ex.series || 3}" min="1" max="10" onchange="updateExerciseData(${index}, 'series', parseInt(this.value))">
        </div>
      </div>

      <label>Séries Concluídas</label>
      <div class="series-container">${seriesHTML}</div>
    `;

    container.appendChild(card);
  });

  updateProgress();
}

function addExercise() {
  if (!workouts[currentWorkout]) workouts[currentWorkout] = [];
  workouts[currentWorkout].push({
    name: "",
    weight: "",
    series: 3,
    completedSeries: [false, false, false]
  });
  saveWorkouts();
  renderExercises(workouts[currentWorkout]);
}

function removeExercise(index) {
  workouts[currentWorkout].splice(index, 1);
  saveWorkouts();
  renderExercises(workouts[currentWorkout]);
}

function updateExerciseData(index, field, value) {
  workouts[currentWorkout][index][field] = value;
  if (field === 'series') {
    workouts[currentWorkout][index].completedSeries = new Array(value).fill(false);
  }
  saveWorkouts();
  updateProgress();
}

function toggleSeries(exIndex, seriesIndex) {
  const ex = workouts[currentWorkout][exIndex];
  if (!ex.completedSeries) ex.completedSeries = [];
  ex.completedSeries[seriesIndex] = !ex.completedSeries[seriesIndex];
  
  saveWorkouts();
  updateProgress();

  if (ex.completedSeries[seriesIndex]) {
    startRestTimer();
  }
}

function updateProgress() {
  const list = workouts[currentWorkout];
  if (!list || list.length === 0) {
    document.getElementById("progress").innerText = "Progresso: 0% concluído";
    return;
  }

  let totalSeries = 0;
  let doneSeries = 0;

  list.forEach(ex => {
    const total = ex.series || 3;
    totalSeries += total;
    for (let i = 0; i < total; i++) {
      if (ex.completedSeries && ex.completedSeries[i]) doneSeries++;
    }
  });

  const percent = totalSeries === 0 ? 0 : Math.round((doneSeries / totalSeries) * 100);
  document.getElementById("progress").innerText = `Progresso: ${percent}% concluído`;
}

// Timer de Descanso
function startRestTimer() {
  clearInterval(timerInterval);
  timerSeconds = 60;
  const banner = document.getElementById("rest-timer-banner");
  const countEl = document.getElementById("timer-countdown");
  
  banner.style.display = "flex";
  countEl.innerText = `${timerSeconds}s`;

  timerInterval = setInterval(() => {
    timerSeconds--;
    countEl.innerText = `${timerSeconds}s`;
    if (timerSeconds <= 0) {
      skipTimer();
    }
  }, 1000);
}

function skipTimer() {
  clearInterval(timerInterval);
  document.getElementById("rest-timer-banner").style.display = "none";
}

// GPS e Rastreamento de Cardio
function toggleCardioTracking() {
  const btn = document.getElementById("btn-toggle-cardio");
  if (!cardioData.isTracking) {
    cardioData.isTracking = true;
    btn.innerText = "⏹ Parar e Salvar Atividade";
    btn.classList.add("active");

    cardioData.intervalId = setInterval(() => {
      cardioData.seconds++;
      updateCardioUI();
    }, 1000);

    if ("geolocation" in navigator) {
      watchId = navigator.geolocation.watchPosition(
        handleGPSPosition,
        (err) => console.log(err),
        { enableHighAccuracy: true, maximumAge: 1000 }
      );
    }
  } else {
    cardioData.isTracking = false;
    btn.innerText = "▶ Iniciar Atividade";
    btn.classList.remove("active");

    clearInterval(cardioData.intervalId);
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);

    saveCardioHistory();
  }
}

function handleGPSPosition(pos) {
  const { latitude, longitude } = pos.coords;
  const newPos = { lat: latitude, lng: longitude };

  if (cardioData.positions.length > 0) {
    const lastPos = cardioData.positions[cardioData.positions.length - 1];
    const dist = calculateDistance(lastPos.lat, lastPos.lng, newPos.lat, newPos.lng);
    cardioData.distanceKm += dist;
  }

  cardioData.positions.push(newPos);
  drawRoute("cardio-route-canvas", cardioData.positions);
  updateCardioUI();
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function updateCardioUI() {
  document.getElementById("cardio-distance").innerText = cardioData.distanceKm.toFixed(2);
  
  const mins = Math.floor(cardioData.seconds / 60).toString().padStart(2, '0');
  const secs = (cardioData.seconds % 60).toString().padStart(2, '0');
  document.getElementById("cardio-duration").innerText = `${mins}:${secs}`;

  const hours = cardioData.seconds / 3600;
  const speed = hours > 0 ? (cardioData.distanceKm / hours).toFixed(1) : "0.0";
  document.getElementById("cardio-speed").innerText = speed;

  cardioData.calories = Math.round(cardioData.distanceKm * 60);
  document.getElementById("cardio-calories").innerText = cardioData.calories;
}

// Desenho da rota no Canvas
function drawRoute(canvasId, positions) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!positions || positions.length < 2) {
    ctx.fillStyle = "#666";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Trajeto aparecerá aqui durante o Cardio", canvas.width / 2, canvas.height / 2);
    return;
  }

  let minLat = positions[0].lat, maxLat = positions[0].lat;
  let minLng = positions[0].lng, maxLng = positions[0].lng;

  positions.forEach(p => {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  });

  const padding = 20;
  const mapWidth = canvas.width - (padding * 2);
  const mapHeight = canvas.height - (padding * 2);

  const latDiff = maxLat - minLat || 0.0001;
  const lngDiff = maxLng - minLng || 0.0001;

  ctx.beginPath();
  ctx.strokeStyle = "#fd7e14";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  positions.forEach((p, index) => {
    const x = padding + ((p.lng - minLng) / lngDiff) * mapWidth;
    const y = canvas.height - (padding + ((p.lat - minLat) / latDiff) * mapHeight);

    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });

  ctx.stroke();
}

function initPedometer() {
  if ('DeviceOrientationEvent' in window) {
    window.addEventListener('devicemotion', (e) => {
      if (!cardioData.isTracking) return;
      const acc = e.accelerationIncludingGravity;
      if (acc) {
        const totalAcc = Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z);
        if (totalAcc > 12) {
          cardioData.steps++;
          document.getElementById("cardio-steps").innerText = cardioData.steps;
        }
      }
    }, true);
  }
}

function updateDashboard() {
  const now = new Date();
  const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
  startOfWeek.setHours(0,0,0,0);

  const weeklyCount = history.filter(item => new Date(item.timestamp) >= startOfWeek).length;
  document.getElementById("weekly-progress").innerText = `Treinos concluídos na semana: ${weeklyCount}`;

  if (history.length > 0) {
    const last = history[history.length - 1];
    document.getElementById("last-workout").innerText = `Último treino: ${last.date} (${last.title})`;
  } else {
    document.getElementById("last-workout").innerText = "Último treino: nenhum";
  }
}

function generateWorkout() {
  const list = workouts[currentWorkout];
  if (!list || list.length === 0) return alert("Adicione ao menos um exercício.");

  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR');

  history.push({
    title: `Treino ${currentWorkout}`,
    date: dateStr,
    timestamp: now.getTime(),
    type: 'strength',
    exercisesCount: list.length
  });

  saveHistory();
  updateDashboard();
  alert(`Treino ${currentWorkout} concluído com sucesso! 💪`);
}

function saveCardioHistory() {
  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR');

  history.push({
    title: 'Cardio 🏃‍♂️',
    date: dateStr,
    timestamp: now.getTime(),
    type: 'cardio',
    distance: cardioData.distanceKm.toFixed(2),
    duration: document.getElementById("cardio-duration").innerText,
    positions: [...cardioData.positions]
  });

  saveHistory();
  updateDashboard();
  alert("Atividade de Cardio salva no histórico!");
}

function renderHistory() {
  document.querySelectorAll(".tabs button").forEach(btn => btn.classList.remove("active"));
  document.getElementById("btn-tab-Hist").classList.add("active");

  document.getElementById("exercise-list").style.display = "none";
  document.getElementById("cardio-panel").style.display = "none";
  document.querySelector(".buttons-group").style.display = "none";
  
  const container = document.getElementById("history-list");
  container.style.display = "block";
  container.innerHTML = "";

  if (history.length === 0) {
    container.innerHTML = `<p style="color:#666; text-align:center; padding:20px;">Nenhum histórico registrado.</p>`;
    return;
  }

  history.slice().reverse().forEach(item => {
    const div = document.createElement("div");
    div.className = "exercise";
    div.innerHTML = `
      <strong style="color: #fd7e14;">${item.title}</strong> - <small style="color:#aaa;">${item.date}</small>
      <p style="margin-top: 6px; font-size:0.85rem; color:#ccc;">
        ${item.type === 'cardio' ? `Distância: ${item.distance} km \vert{} Tempo:${item.duration}` : `Exercícios: ${item.exercisesCount}`}
      </p>
    `;
    container.appendChild(div);
  });
}

function shareActivity() {
  const now = new Date();
  document.getElementById("share-card-date").innerText = now.toLocaleDateString('pt-BR');
  document.getElementById("share-workout-title").innerText = currentWorkout === 'Cardio' ? 'CARDIO 🏃‍♂️' : `TREINO ${currentWorkout}`;

  if (currentWorkout === 'Cardio') {
    document.getElementById("share-lbl-exercises").innerText = "Distância";
    document.getElementById("share-stat-exercises").innerText = `${cardioData.distanceKm.toFixed(2)} km`;
    document.getElementById("share-lbl-progress").innerText = "Tempo";
    document.getElementById("share-stat-progress").innerText = document.getElementById("cardio-duration").innerText;
    
    document.getElementById("share-map-container").style.display = "block";
    drawRoute("share-route-canvas", cardioData.positions);
  } else {
    document.getElementById("share-map-container").style.display = "none";
    document.getElementById("share-lbl-exercises").innerText = "Exercícios";
    document.getElementById("share-stat-exercises").innerText = workouts[currentWorkout].length;
    document.getElementById("share-lbl-progress").innerText = "Progresso";
    document.getElementById("share-stat-progress").innerText = "100%";
  }

  const card = document.getElementById("instagram-share-card");
  html2canvas(card, { backgroundColor: null }).then(canvas => {
    canvas.toBlob(blob => {
      const file = new File([blob], "treino.png", { type: "image/png" });
      if (navigator.share) {
        navigator.share({ files: [file], title: 'PowerFit', text: 'Treino pago! 🔥' });
      } else {
        const link = document.createElement('a');
        link.download = 'treino.png';
        link.href = canvas.toDataURL();
        link.click();
      }
    });
  });
}

function confirmReset() {
  if (confirm("Deseja redefinir os treinos do dia?")) {
    workouts[currentWorkout].forEach(ex => {
      ex.completedSeries = new Array(ex.series || 3).fill(false);
    });
    saveWorkouts();
    renderExercises(workouts[currentWorkout]);
  }
}
