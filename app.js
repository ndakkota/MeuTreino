// ==========================================
// CONFIGURAÇÕES E VARIÁVEIS GLOBAIS
// ==========================================
let workouts = { A: [], B: [], C: [] };
let currentWorkout = "A";
let countdownInterval = null;

// ==========================================
// INICIALIZAÇÃO DO APLICATIVO (window.onload)
// ==========================================
window.onload = function() {
  loadWorkouts();
  checkInactivity();
  updateDashboard();
  
  // Recupera ou cria um ID exclusivo para este dispositivo/usuário
  const userId = getOrCreateUserId(); 
  initServiceWorker(userId);
};

// ==========================================
// GESTÃO DE USUÁRIO (Prevenção de conflito de IDs)
// ==========================================
function getOrCreateUserId() {
  let userId = localStorage.getItem("powerfit_user_id");
  
  // Se o usuário ainda não tem um ID salvo neste celular, gera um identificador único
  if (!userId) {
    userId = 'user_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    localStorage.setItem("powerfit_user_id", userId);
  }
  
  return userId;
}

// ==========================================
// GERENCIAMENTO DE EXERCÍCIOS e SÉRIES
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

  const seriesInput = div.querySelector('input[type=number]');
  generateCheckboxes(seriesInput);
}

// Nova função adicionada
function deleteExercise(button) {
  button.parentElement.remove();
  saveWorkouts();
}

function generateCheckboxes(input) {
  let count = parseInt(input.value) || 1;
  if (count > 10) count = 10; // Evita problemas visuais por excesso de séries
  
  const container = input.parentElement.querySelector(".series-container");
  container.innerHTML = "";
  
  for (let i = 0; i < count; i++) {
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.classList.add("round-checkbox");
    cb.onchange = function() {
      // O cronômetro só inicia se o usuário marcar a série como concluída
      if (this.checked) {
        startRestTimer(60); 
      }
      updateProgress(); 
      saveWorkouts(); 
    };
    container.appendChild(cb);
  }
  updateProgress();
  saveWorkouts();
}

// ==========================================
// LÓGICA DO TIMER DE DESCANSO AUTOMÁTICO
// ==========================================
function startRestTimer(seconds) {
  // Reseta qualquer timer que já esteja rodando para evitar duplicações
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
      
      // Feedback físico sutil de vibração no celular (se suportado pelo aparelho)
      if (window.navigator.vibrate) {
        window.navigator.vibrate([200, 100, 200]);
      }
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
  if (saved) {
    workouts = JSON.parse(saved);
  }
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

  // Garante que a lista de exercícios e o botão de adicionar voltem a aparecer
  document.getElementById("exercise-list").style.display = "block";
  document.getElementById("btn-add").style.display = "block";
  
  // Reexibe o grupo completo de botões de ação do treino
  document.querySelector(".buttons-group").style.display = "flex";

  // Esconde a tela do histórico
  document.getElementById("history-list").style.display = "none";

  // Atualiza visualmente qual aba está ativa
  document.querySelectorAll(".tabs button").forEach(btn => btn.classList.remove("active"));
  document.getElementById(`btn-tab-${workout}`).classList.add("active");

  // Renderiza os exercícios do treino selecionado
  renderExercises(workouts[currentWorkout]);
}

// ==========================================
// MÉTRICAS, PROGRESSO E DASHBOARD
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
    alert("Adicione exercícios antes de gerar o treino!");
    return;
  }

  let resultText = "";
  let htmlResult = `<h3>🔥 Treino ${currentWorkout} 🔥</h3>`;
  
  exercises.forEach(ex => {
    const item = `${ex.name || 'Sem nome'} — ${ex.series} séries de ${ex.reps} repetições`;
    htmlResult += `<p>${item}</p>`;
    resultText += item + "\n";
  });
  
  const outDiv = document.getElementById('output');
  outDiv.innerHTML = htmlResult;
  outDiv.style.display = "block";

  saveHistory(resultText, currentWorkout);
  updateDashboard();
}

function confirmReset() {
  if (confirm("Tem certeza que deseja redefinir o treino atual?")) {
    document.getElementById('exercise-list').innerHTML = "";
    document.getElementById('output').innerHTML = "";
    document.getElementById('output').style.display = "none";
    workouts[currentWorkout] = [];
    saveWorkouts();
    updateProgress();
  }
}

function checkInactivity() {
  const lastAccess = localStorage.getItem("lastAccess");
  const now = Date.now();

  if (lastAccess) {
    const diffDays = Math.floor((now - parseInt(lastAccess)) / (1000 * 60 * 60 * 24));
    if (diffDays >= 2) {
      alert("⚠️ Você está há " + diffDays + " dias sem treinar! Bora focar!");
    }
  }
  localStorage.setItem("lastAccess", now);
}

// ==========================================
// COMPARTILHAMENTO DE IMAGENS (ESTILO STRAVA)
// ==========================================
function fillShareCardData() {
  const exercises = workouts[currentWorkout] || [];
  
  document.getElementById("share-workout-title").innerText = `TREINO ${currentWorkout}`;
  document.getElementById("share-stat-exercises").innerText = exercises.length;
  
  const checkboxes = document.querySelectorAll('.round-checkbox');
  const total = checkboxes.length;
  const done = document.querySelectorAll('.round-checkbox:checked').length;
  const percent = total ? Math.round((done / total) * 100) : 0;
  document.getElementById("share-stat-progress").innerText = `${percent}%`;
  
  document.getElementById("share-card-date").innerText = new Date().toLocaleDateString('pt-BR');
}

function sendToWhatsApp() {
  const exercises = workouts[currentWorkout] || [];
  if (exercises.length === 0) {
    alert("Monte um treino antes de compartilhar!");
    return;
  }

  fillShareCardData();
  const card = document.getElementById("instagram-share-card");
  
  html2canvas(card, { scale: 1, logging: false, useCORS: true, backgroundColor: "#0a0a0c" }).then(canvas => {
    canvas.toBlob(blob => {
      const file = new File([blob], `treino_${currentWorkout}.png`, { type: "image/png" });
      
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({
          files: [file],
          title: `Treino ${currentWorkout} Concluído`,
          text: 'Mais um pago no Status! 🔥 #PowerFit'
        });
      } else {
        const link = document.createElement('a');
        link.download = `meu_treino_${currentWorkout}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
        alert("Imagem baixada! Agora você já pode postar no seu Status do WhatsApp! 🏋️‍♂️");
      }
    }, "image/png");
  });
}

function shareToInstagram() {
  const exercises = workouts[currentWorkout] || [];
  if (exercises.length === 0) {
    alert("Monte um treino antes de compartilhar!");
    return;
  }

  fillShareCardData();
  const card = document.getElementById("instagram-share-card");
  
  html2canvas(card, { scale: 1, logging: false, useCORS: true, backgroundColor: "#0a0a0c" }).then(canvas => {
    canvas.toBlob(blob => {
      const file = new File([blob], `treino_${currentWorkout}.png`, { type: "image/png" });
      
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({
          files: [file],
          title: `Treino ${currentWorkout} Concluído`,
          text: 'Foco no objetivo! 🔥 #PowerFit'
        });
      } else {
        const link = document.createElement('a');
        link.download = `meu_treino_${currentWorkout}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
        alert("Imagem baixada! Agora você já pode postar nos seus Stories do Instagram! 🏋️‍♂️");
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
  
  // Esconde os botões inferiores para não gerar confusão visual no histórico
  document.querySelector(".buttons-group").style.display = "none"; 
  
  container.style.display = "block";

  document.querySelectorAll(".tabs button").forEach(btn => btn.classList.remove("active"));
  document.getElementById("btn-tab-Hist").classList.add("active");

  container.innerHTML = "<h3>📜 Histórico de Treinos</h3>";
  if(history.length === 0) {
    container.innerHTML += "<p>Nenhum treino salvo ainda.</p>";
    return;
  }

  history.slice().reverse().forEach((h, index) => {
    const originalIndex = history.length - 1 - index; 
    const dateStr = new Date(h.timestamp).toLocaleDateString();
    
    container.innerHTML += `
      <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 12px; margin-bottom: 12px; border-left: 3px solid silver; position: relative;">
        <button class="delete-btn" onclick="deleteHistoryItem(${originalIndex})" style="top: 12px; right: 12px;">✖</button>
        <strong>${dateStr} - Treino ${h.type || ''}</strong>
        <p style="white-space: pre-line; margin: 8px 0 0 0; font-size: 0.9em; color: #ccc;">${h.text}</p>
      </div>
    `;
  });
}

function deleteHistoryItem(index) {
  if (confirm("Deseja apagar este treino do histórico?")) {
    let history = JSON.parse(localStorage.getItem("history")) || [];
    history.splice(index, 1);
    localStorage.setItem("history", JSON.stringify(history));
    
    renderHistory();
    updateDashboard();
  }
}

function updateDashboard() {
  let history = JSON.parse(localStorage.getItem("history")) || [];
  const umDiaEmMs = 1000 * 60 * 60 * 24;
  const agora = Date.now();

  const weekly = history.filter(h => {
    const diffDays = (agora - h.timestamp) / umDiaEmMs;
    return diffDays <= 7;
  });

  document.getElementById("weekly-progress").innerText = `Treinos concluídos na semana: ${weekly.length}`;
  
  if (history.length > 0) {
    const ultimaData = new Date(history[history.length - 1].timestamp).toLocaleDateString();
    document.getElementById("last-workout").innerText = `Último treino: ${ultimaData}`;
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
      console.log("Service Worker ativo.");
      
      if (Notification.permission === "default") {
        Notification.requestPermission().then(permission => {
          if (permission === "granted") {
            subscribeUserToPush(reg, userId);
          }
        });
      } else if (Notification.permission === "granted") {
        subscribeUserToPush(reg, userId);
      }
    }).catch(err => console.error("Erro SW:", err));
  }
}

function subscribeUserToPush(reg, userId) {
  reg.pushManager.getSubscription().then(sub => {
    if (!sub) {
      reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: "SUA_PUBLIC_KEY_AQUI" 
      }).then(subscription => {
        sendSubscriptionToServer(subscription, userId);
      });
    } else {
      sendSubscriptionToServer(sub, userId);
    }
  });
}

function sendSubscriptionToServer(subscription, userId) {
  const url = window.location.hostname === "localhost" ? "http://localhost:3000" : "";
  
  fetch(`${url}/subscribe`, {
    method: "POST",
    body: JSON.stringify({ userId: userId, subscription: subscription }),
    headers: { "Content-Type": "application/json" }
  }).catch(e => console.log("Servidor offline: Rodando em modo local seguro."));

  fetch(`${url}/updateAccess`, {
    method: "POST",
    body: JSON.stringify({ userId: userId }),
    headers: { "Content-Type": "application/json" }
  }).catch(e => {});
}