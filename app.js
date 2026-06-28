// ==========================================
// CONFIGURAÇÕES E VARIÁVEIS GLOBAIS
// ==========================================
let workouts = { A: [], B: [], C: [] };
let currentWorkout = "A";
let countdownInterval = null;

// VARIÁVEIS RASTREADOR CARDIO, PERCURSO E SENSORES
let cardioInterval = null;
let watchId = null;
let cardioActive = false;
let wakeLock = null;

// Parâmetros do Acelerômetro para Filtro de Passos
let lastAcceleration = { x: 0, y: 0, z: 0 };
let stepThreshold = 11.5; 
let lastStepTime = 0;

let cardioData = { 
  distance: 0, 
  startTime: null, 
  elapsedSeconds: 0, 
  positions: [],
  steps: 0,
  calories: 0
};

// ==========================================
// INICIALIZAÇÃO DO APLICATIVO
// ==========================================
window.onload = function() {
  loadWorkouts();
  checkInactivity();
  updateDashboard();
  
  const userId = getOrCreateUserId(); 
  initServiceWorker(userId);
  
  clearCanvas("cardio-route-canvas");

  if (localStorage.getItem("cardioActive") === "true") {
    restoreCardioTracking();
  }

  document.addEventListener("visibilitychange", handleVisibilityChange);
};

function getOrCreateUserId() {
  let userId = localStorage.getItem("powerfit_user_id");
  if (!userId) {
    userId = 'user_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    localStorage.setItem("powerfit_user_id", userId);
  }
  return userId;
}

// ==========================================
// GERENCIAMENTO DE EXERCÍCIOS E SÉRIES
// ==========================================
function addExercise() {
  const container = document.getElementById('exercise-list');
  const div = document.createElement('div');
  div.classList.add('exercise');
  div.innerHTML = `
    <button class="delete-btn" onclick="deleteExercise(this)">✖</button>
    <label>Exercício:</label>
    <input type="text" placeholder="Digite o exercício" oninput="saveWorkouts()">
    <label>Séries:</label>
    <input type="number" min="1" max="10" value="3" onchange="generateCheckboxes(this)">
    <label>Repetições:</label>
    <input type="number" min="1" max="30" value="12" oninput="saveWorkouts()">
    <div class="series-container"></div>
  `;
  container.appendChild(div);
  generateCheckboxes(div.querySelector('input[type=number]'));
}

function deleteExercise(button) {
  button.parentElement.remove();
  saveWorkouts();
}

function generateCheckboxes(input) {
  let count = parseInt(input.value) || 1;
  if (count > 10) count = 10;
  
  const container = input.parentElement.querySelector(".series-container");
  container.innerHTML = "";
  
  for (let i = 0; i < count; i++) {
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.classList.add("round-checkbox");
    cb.onchange = function() {
      if (this.checked) startRestTimer(60);
      updateProgress(); 
      saveWorkouts(); 
    };
    container.appendChild(cb);
  }
  updateProgress();
  saveWorkouts();
}

// ==========================================
// TIMER DE DESCANSO AUTOMÁTICO
// ==========================================
function startRestTimer(seconds) {
  clearInterval(countdownInterval);
  const banner = document.getElementById("rest-timer-banner");
  const display = document.getElementById("timer-countdown");
  
  let timeLeft = seconds;
  display.innerText = `${timeLeft}s`;
  banner.style.display = "flex";

  countdownInterval = setInterval(() => {
    timeLeft--;
    display.innerText = `${timeLeft}s`;
    if (timeLeft <= 0) {
      clearInterval(countdownInterval);
      banner.style.display = "none";
      if (window.navigator.vibrate) window.navigator.vibrate([200, 100, 200]);
    }
  }, 1000);
}

function skipTimer() {
  clearInterval(countdownInterval);
  document.getElementById("rest-timer-banner").style.display = "none";
}

// ==========================================
// PERSISTÊNCIA DE DADOS (LOCALSTORAGE)
// ==========================================
function saveWorkouts() {
  const exercises = [];
  document.querySelectorAll('.exercise').forEach(ex => {
    const name = ex.querySelector('input[type=text]').value;
    const series = ex.querySelectorAll('input[type=number]')[0].value;
    const reps = ex.querySelectorAll('input[type=number]')[1].value;
    const done = Array.from(ex.querySelectorAll('.round-checkbox')).map(cb => cb.checked);
    exercises.push({ name, series, reps, done });
  });
  workouts[currentWorkout] = exercises;
  localStorage.setItem("workouts", JSON.stringify(workouts));
}

function loadWorkouts() {
  const saved = localStorage.getItem("workouts");
  if (saved) workouts = JSON.parse(saved);
  renderExercises(workouts[currentWorkout]);
}

function renderExercises(exercises) {
  const container = document.getElementById('exercise-list');
  container.innerHTML = "";
  if (!exercises || exercises.length === 0) {
    updateProgress();
    return;
  }
  
  exercises.forEach(ex => {
    const div = document.createElement('div');
    div.classList.add('exercise');
    div.innerHTML = `
      <button class="delete-btn" onclick="deleteExercise(this)">✖</button>
      <label>Exercício:</label>
      <input type="text" value="${ex.name}" oninput="saveWorkouts()">
      <label>Séries:</label>
      <input type="number" min="1" max="10" value="${ex.series}" onchange="generateCheckboxes(this)">
      <label>Repetições:</label>
      <input type="number" min="1" max="30" value="${ex.reps}" oninput="saveWorkouts()">
      <div class="series-container"></div>
    `;
    container.appendChild(div);
    
    const seriesContainer = div.querySelector(".series-container");
    for (let i = 0; i < ex.series; i++) {
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.classList.add("round-checkbox");
      cb.checked = ex.done[i] || false;
      cb.onchange = function() {
        if (this.checked) startRestTimer(60);
        updateProgress(); 
        saveWorkouts(); 
      };
      seriesContainer.appendChild(cb);
    }
  });
  updateProgress();
}

// ==========================================
// NAVEGAÇÃO ENTRE ABAS
// ==========================================
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
    document.querySelectorAll(".buttons-group button.main")[1].style.display = "none"; 
  } else {
    document.getElementById("exercise-list").style.display = "block";
    document.getElementById("btn-add").style.display = "block";
    document.querySelectorAll(".buttons-group button.main")[1].style.display = "block"; 
    renderExercises(workouts[currentWorkout]);
  }
}

// ==========================================
// DASHBOARD E RESET
// ==========================================
function updateProgress() {
  const checkboxes = document.querySelectorAll('.round-checkbox');
  const total = checkboxes.length;
  const done = document.querySelectorAll('.round-checkbox:checked').length;
  const percent = total ? Math.round((done / total) * 100) : 0;
  document.getElementById('progress').innerHTML = `Progresso: ${percent}% concluído`;
}

function generateWorkout() {
  const exercises = workouts[currentWorkout];
  if(!exercises || exercises.length === 0) {
    alert("Adicione exercícios antes de gerar o treino!"); return;
  }
  let resultText = "";
  let htmlResult = `<h3>🔥 Treino ${currentWorkout} 🔥</h3>`;
  exercises.forEach(ex => {
    const item = `${ex.name || 'Sem nome'} — ${ex.series} séries de ${ex.reps} repetições`;
    htmlResult += `<p>${item}</p>`; resultText += item + "\n";
  });
  const outDiv = document.getElementById('output');
  outDiv.innerHTML = htmlResult; outDiv.style.display = "block";
  saveHistory(resultText, currentWorkout); updateDashboard();
}

function confirmReset() {
  if (confirm("Tem certeza que deseja redefinir a atividade atual?")) {
    if(currentWorkout === "Cardio") {
      stopCardioTrackingEngine();
      cardioData = { distance: 0, startTime: null, elapsedSeconds: 0, positions: [], steps: 0, calories: 0 };
      localStorage.removeItem("cardioActive");
      localStorage.removeItem("cardioStartTime");
      localStorage.removeItem("cardioPositions");
      localStorage.removeItem("cardioDistance");
      localStorage.removeItem("cardioSteps");
      localStorage.removeItem("cardioCalories");
      
      document.getElementById("cardio-distance").innerText = "0.00";
      document.getElementById("cardio-duration").innerText = "00:00";
      document.getElementById("cardio-speed").innerText = "0.0";
      document.getElementById("cardio-steps").innerText = "0";
      document.getElementById("cardio-calories").innerText = "0";
      clearCanvas("cardio-route-canvas");
    } else {
      document.getElementById('exercise-list').innerHTML = "";
      document.getElementById('output').innerHTML = "";
      document.getElementById('output').style.display = "none";
      workouts[currentWorkout] = []; saveWorkouts(); updateProgress();
    }
  }
}

// NOTIFICAÇÃO LOCAL DE INATIVIDADE (SISTEMA MOBILE)
function checkInactivity() {
  const lastAccess = localStorage.getItem("lastAccess");
  const now = Date.now();
  if (lastAccess) {
    const diffDays = Math.floor((now - parseInt(lastAccess)) / (1000 * 60 * 60 * 24));
    if (diffDays >= 2) {
      // Disparar popup nativo do sistema do celular
      if ("Notification" in window) {
        if (Notification.permission === "granted") {
          showInactivityNotification(diffDays);
        } else if (Notification.permission !== "denied") {
          Notification.requestPermission().then(permission => {
            if (permission === "granted") showInactivityNotification(diffDays);
          });
        }
      }
    }
  }
  localStorage.setItem("lastAccess", now);
}

function showInactivityNotification(days) {
  navigator.serviceWorker.ready.then(registration => {
    registration.showNotification("POWERFIT ⚡", {
      body: `⚠️ Você está há ${days} dias sem treinar! Bora focar e pagar o treino de hoje!`,
      icon: "icons/icon-192x192.png", // Altere para o caminho do seu ícone se necessário
      badge: "icons/icon-192x192.png",
      vibrate: [200, 100, 200],
      tag: "inactivity-alert",
      renotify: true
    });
  });
}

// ==========================================
// RASTREAMENTO DE CARDIO (GPS + PASSOS + KCAL)
// ==========================================
function toggleCardioTracking() {
  if (!cardioActive) {
    if (!navigator.geolocation) { alert("Seu aparelho não suporta GPS!"); return; }
    
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      DeviceMotionEvent.requestPermission()
        .then(permissionState => {
          if (permissionState === 'granted') window.addEventListener('devicemotion', handleMotion);
        }).catch(() => console.log("Permissão de acelerômetro negada."));
    } else {
      window.addEventListener('devicemotion', handleMotion);
    }

    cardioActive = true;
    cardioData.startTime = Date.now();
    cardioData.distance = 0;
    cardioData.positions = [];
    cardioData.elapsedSeconds = 0;
    cardioData.steps = 0;
    cardioData.calories = 0;
    
    localStorage.setItem("cardioActive", "true");
    localStorage.setItem("cardioStartTime", cardioData.startTime.toString());
    localStorage.setItem("cardioPositions", JSON.stringify([]));
    localStorage.setItem("cardioDistance", "0");
    localStorage.setItem("cardioSteps", "0");
    localStorage.setItem("cardioCalories", "0");

    document.getElementById("cardio-distance").innerText = "0.00";
    document.getElementById("cardio-duration").innerText = "00:00";
    document.getElementById("cardio-speed").innerText = "0.0";
    document.getElementById("cardio-steps").innerText = "0";
    document.getElementById("cardio-calories").innerText = "0";
    clearCanvas("cardio-route-canvas");
    
    startCardioTrackingEngine();
    requestWakeLock();
  } else {
    cardioActive = false;
    localStorage.removeItem("cardioActive");
    localStorage.removeItem("cardioStartTime");
    localStorage.removeItem("cardioPositions");
    localStorage.removeItem("cardioDistance");
    localStorage.removeItem("cardioSteps");
    localStorage.removeItem("cardioCalories");

    const btn = document.getElementById("btn-toggle-cardio");
    btn.innerText = "▶ Iniciar Atividade";
    btn.classList.remove("active");
    
    stopCardioTrackingEngine();
    releaseWakeLock();
    window.removeEventListener('devicemotion', handleMotion);
    
    const durationText = document.getElementById("cardio-duration").innerText;
    const finalDistance = cardioData.distance.toFixed(2);
    
    const summary = `Distância: ${finalDistance} km\nDuração: ${durationText}\nPassos: ${cardioData.steps}\nGasto Calórico: ${cardioData.calories} kcal`;
    saveHistory(summary, "CARDIO 🏃‍♂️"); 
    updateDashboard();
    alert("Cardio salvo com sucesso!");
  }
}

function startCardioTrackingEngine() {
  const btn = document.getElementById("btn-toggle-cardio");
  btn.innerText = "⏹ Finalizar e Salvar Atividade";
  btn.classList.add("active");

  cardioInterval = setInterval(() => {
    if (!cardioData.startTime) return;
    
    cardioData.elapsedSeconds = Math.floor((Date.now() - cardioData.startTime) / 1000);
    
    const mins = Math.floor(cardioData.elapsedSeconds / 60).toString().padStart(2, '0');
    const secs = (cardioData.elapsedSeconds % 60).toString().padStart(2, '0');
    document.getElementById("cardio-duration").innerText = `${mins}:${secs}`;
    
    let speed = 0;
    if (cardioData.distance > 0 && cardioData.elapsedSeconds > 0) {
      const hours = cardioData.elapsedSeconds / 3600;
      speed = cardioData.distance / hours;
      document.getElementById("cardio-speed").innerText = speed.toFixed(1);
    }

    if (cardioData.elapsedSeconds > 0) {
      let metValue = speed > 6.5 ? 7.5 : 4.0;
      if (speed === 0) metValue = 1.2;
      const caloriesPerSecond = (metValue * 3.5 * 75) / (200 * 60);
      cardioData.calories = Math.round(caloriesPerSecond * cardioData.elapsedSeconds);
      document.getElementById("cardio-calories").innerText = cardioData.calories;
      localStorage.setItem("cardioCalories", cardioData.calories.toString());
    }
  }, 1000);

  watchId = navigator.geolocation.watchPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      const newPos = { lat: latitude, lng: longitude };
      
      if (cardioData.positions.length > 0) {
        const lastPos = cardioData.positions[cardioData.positions.length - 1];
        const distIncrement = calculateDistance(lastPos.lat, lastPos.lng, newPos.lat, newPos.lng);
        
        if (distIncrement > 0.001) { 
          cardioData.distance += distIncrement;
          document.getElementById("cardio-distance").innerText = cardioData.distance.toFixed(2);
          localStorage.setItem("cardioDistance", cardioData.distance.toString());
        }
      }
      cardioData.positions.push(newPos);
      localStorage.setItem("cardioPositions", JSON.stringify(cardioData.positions));
      drawRoute("cardio-route-canvas", cardioData.positions);
    },
    (err) => console.log(err), 
    { enableHighAccuracy: true, distanceFilter: 1 }
  );
}

function handleMotion(event) {
  if (!cardioActive) return;
  const acc = event.accelerationIncludingGravity;
  if (!acc) return;

  const magnitude = Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z);
  const delta = Math.abs(magnitude - lastAcceleration.total);
  const now = Date.now();

  if (magnitude > stepThreshold && (now - lastStepTime) > 300 && delta > 2) {
    cardioData.steps++;
    document.getElementById("cardio-steps").innerText = cardioData.steps;
    localStorage.setItem("cardioSteps", cardioData.steps.toString());
    lastStepTime = now;
  }
  lastAcceleration = { x: acc.x, y: acc.y, z: acc.z, total: magnitude };
}

function stopCardioTrackingEngine() {
  clearInterval(cardioInterval);
  if (watchId) navigator.geolocation.clearWatch(watchId);
}

function restoreCardioTracking() {
  cardioActive = true;
  cardioData.startTime = parseInt(localStorage.getItem("cardioStartTime"));
  cardioData.distance = parseFloat(localStorage.getItem("cardioDistance")) || 0;
  cardioData.steps = parseInt(localStorage.getItem("cardioSteps")) || 0;
  cardioData.calories = parseInt(localStorage.getItem("cardioCalories")) || 0;
  cardioData.positions = JSON.parse(localStorage.getItem("cardioPositions")) || [];
  
  document.getElementById("cardio-distance").innerText = cardioData.distance.toFixed(2);
  document.getElementById("cardio-steps").innerText = cardioData.steps;
  document.getElementById("cardio-calories").innerText = cardioData.calories;
  drawRoute("cardio-route-canvas", cardioData.positions);
  
  window.addEventListener('devicemotion', handleMotion);
  switchWorkout("Cardio");
  startCardioTrackingEngine();
  requestWakeLock();
}

function handleVisibilityChange() {
  if (document.visibilityState === "visible" && cardioActive) {
    if (cardioData.startTime) {
      cardioData.elapsedSeconds = Math.floor((Date.now() - cardioData.startTime) / 1000);
    }
    requestWakeLock();
  }
}

async function requestWakeLock() {
  if ('wakeLock' in navigator) {
    try { wakeLock = await navigator.wakeLock.request('screen'); } catch (err) {}
  }
}

function releaseWakeLock() {
  if (wakeLock !== null) { wakeLock.release().then(() => wakeLock = null); }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}

function drawRoute(canvasId, positions) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (positions.length < 2) return;

  let lats = positions.map(p => p.lat), lngs = positions.map(p => p.lng);
  let minLat = Math.min(...lats), maxLat = Math.max(...lats);
  let minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  let latRange = maxLat - minLat || 0.0001, lngRange = maxLng - minLng || 0.0001;

  ctx.beginPath(); ctx.strokeStyle = "#fd7e14"; ctx.lineWidth = 5; ctx.lineCap = "round"; ctx.lineJoin = "round";
  positions.forEach((pos, i) => {
    let x = 30 + ((pos.lng - minLng) / lngRange) * (canvas.width - 60);
    let y = (canvas.height - 30) - ((pos.lat - minLat) / latRange) * (canvas.height - 60);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function clearCanvas(canvasId) {
  const canvas = document.getElementById(canvasId);
  if(canvas) canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
}

// ==========================================
// COMPARTILHAMENTO CUSTOMIZADO (IMAGEM)
// ==========================================
function fillShareCardData() {
  const mapContainer = document.getElementById("share-map-container");
  
  if (currentWorkout === "Cardio") {
    document.getElementById("share-workout-title").innerText = "DIA DE CARDIO";
    mapContainer.style.display = "block";
    drawRoute("share-route-canvas", cardioData.positions);
    
    const durationText = document.getElementById("cardio-duration").innerText;
    document.getElementById("share-stat-exercises").innerText = durationText;
    document.getElementById("share-lbl-exercises").innerText = "Tempo";
    
    document.getElementById("share-stat-progress").innerText = cardioData.steps;
    document.getElementById("share-lbl-progress").innerText = "Passos";
  } else {
    document.getElementById("share-workout-title").innerText = `TREINO ${currentWorkout}`;
    mapContainer.style.display = "none";
    const exercises = workouts[currentWorkout] || [];
    
    document.getElementById("share-stat-exercises").innerText = exercises.length;
    document.getElementById("share-lbl-exercises").innerText = "Exercícios";
    
    const checkboxes = document.querySelectorAll('.round-checkbox');
    const total = checkboxes.length;
    const done = document.querySelectorAll('.round-checkbox:checked').length;
    const percent = total ? Math.round((done / total) * 100) : 0;
    
    document.getElementById("share-stat-progress").innerText = `${percent}%`;
    document.getElementById("share-lbl-progress").innerText = "Progresso";
  }
  document.getElementById("share-card-date").innerText = new Date().toLocaleDateString('pt-BR');
}

function shareActivity() {
  if (currentWorkout !== "Cardio" && (workouts[currentWorkout] || []).length === 0) {
    alert("Monte um treino antes de compartilhar!"); return;
  }
  fillShareCardData();
  const card = document.getElementById("instagram-share-card");
  html2canvas(card, { scale: 1, logging: false, useCORS: true, backgroundColor: "#0e0e12" }).then(canvas => {
    canvas.toBlob(blob => {
      const nomeArquivo = currentWorkout === "Cardio" ? "dia_de_cardio.png" : `treino_${currentWorkout}.png`;
      const file = new File([blob], nomeArquivo, { type: "image/png" });
      const textoMensagem = currentWorkout === "Cardio" 
        ? `Dia de cardio concluído! 🔥 Rumei aos objetivos. #PowerFit` 
        : `Treino ${currentWorkout} pago! 🏋️‍♂️💪 #PowerFit`;

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: 'PowerFit', text: textoMensagem }).catch(() => {});
      } else {
        const link = document.createElement('a'); link.download = nomeArquivo; link.href = canvas.toDataURL("image/png"); link.click();
        alert("Imagem do seu cardio salva! Agora é só postar! 🚀");
      }
    }, "image/png");
  });
}

// ==========================================
// HISTÓRICO DE TREINOS E RELATÓRIOS
// ==========================================
function saveHistory(workoutText, type) {
  let history = JSON.parse(localStorage.getItem("history")) || [];
  history.push({ timestamp: Date.now(), text: workoutText, type: type });
  localStorage.setItem("history", JSON.stringify(history));
}

function renderHistory() {
  let history = JSON.parse(localStorage.getItem("history")) || [];
  const container = document.getElementById("history-list");
  
  document.getElementById("exercise-list").style.display = "none";
  document.getElementById("btn-add").style.display = "none";
  document.getElementById("cardio-panel").style.display = "none";
  document.querySelector(".buttons-group").style.display = "none"; 
  container.style.display = "block";

  document.querySelectorAll(".tabs button").forEach(btn => btn.classList.remove("active"));
  document.getElementById("btn-tab-Hist").classList.add("active");

  container.innerHTML = "<h3>📜 Histórico de Treinos</h3>";
  if(history.length === 0) { container.innerHTML += "<p>Nenhum treino salvo ainda.</p>"; return; }

  history.slice().reverse().forEach((h, index) => {
    const originalIndex = history.length - 1 - index; 
    const dateStr = new Date(h.timestamp).toLocaleDateString();
    container.innerHTML += `
      <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 12px; margin-bottom: 12px; border-left: 3px solid #fd7e14; position: relative;">
        <button class="delete-btn" onclick="deleteHistoryItem(${originalIndex})" style="top: 12px; right: 12px;">✖</button>
        <strong>${dateStr} - ${h.type || ''}</strong>
        <p style="white-space: pre-line; margin: 8px 0 0 0; font-size: 0.9em; color: #ccc;">${h.text}</p>
      </div>
    `;
  });
}

function deleteHistoryItem(index) {
  if (confirm("Deseja apagar este registro do histórico?")) {
    let history = JSON.parse(localStorage.getItem("history")) || [];
    history.splice(index, 1); localStorage.setItem("history", JSON.stringify(history));
    renderHistory(); updateDashboard();
  }
}

function updateDashboard() {
  let history = JSON.parse(localStorage.getItem("history")) || [];
  const weekly = history.filter(h => (Date.now() - h.timestamp) / (1000 * 60 * 60 * 24) <= 7);
  document.getElementById("weekly-progress").innerText = `Treinos concluídos na semana: ${weekly.length}`;
  if (history.length > 0) {
    document.getElementById("last-workout").innerText = `Último treino: ${new Date(history[history.length - 1].timestamp).toLocaleDateString()}`;
  } else {
    document.getElementById("last-workout").innerText = `Último treino: nenhum`;
  }
}

// ==========================================
// NOTIFICAÇÕES PUSH & SERVICE WORKER
// ==========================================
function initServiceWorker(userId) {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").then(reg => {
      if (Notification.permission === "default") {
        Notification.requestPermission().then(perm => { if (perm === "granted") subscribeUserToPush(reg, userId); });
      } else if (Notification.permission === "granted") {
        subscribeUserToPush(reg, userId);
      }
    }).catch(err => console.error(err));
  }
}

function subscribeUserToPush(reg, userId) {
  reg.pushManager.getSubscription().then(sub => {
    if (!sub) {
      reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: "SUA_PUBLIC_KEY_AQUI" })
         .then(subscription => sendSubscriptionToServer(subscription, userId));
    } else {
      sendSubscriptionToServer(sub, userId);
    }
  });
}

function sendSubscriptionToServer(subscription, userId) {
  const url = window.location.hostname === "localhost" ? "http://localhost:3000" : "";
  fetch(`${url}/subscribe`, { method: "POST", body: JSON.stringify({ userId, subscription }), headers: { "Content-Type": "application/json" } }).catch(() => {});
  fetch(`${url}/updateAccess`, { method: "POST", body: JSON.stringify({ userId }), headers: { "Content-Type": "application/json" } }).catch(() => {});
}
