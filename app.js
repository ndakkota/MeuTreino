let workouts = { A: [], B: [], C: [] };
let currentWorkout = "A";
let countdownInterval = null;

// Inicialização única do sistema ao carregar a página
window.onload = function() {
  loadWorkouts();
  checkInactivity();
  updateDashboard();
  initServiceWorker();
};

function addExercise() {
  const container = document.getElementById('exercise-list');
  const div = document.createElement('div');
  div.classList.add('exercise');
  div.innerHTML = `
    <button class="delete-btn" onclick="deleteExercise(this)">✖</button>
    <label>Exercício:</label>
    <input type="text" placeholder="Digite o exercício" oninput="saveWorkouts()">
    <label>Séries:</label>
    <input type="number" min="1" max="15" value="1" onchange="generateCheckboxes(this)">
    <label>Repetições:</label>
    <input type="number" min="1" max="30" value="1" oninput="saveWorkouts()">
    <div class="series-container"></div>
  `;
  container.appendChild(div);

  const seriesInput = div.querySelector('input[type=number]');
  generateCheckboxes(seriesInput);
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
      // Dispara o timer apenas se a caixa for marcada como CONCLUÍDA
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

// LÓGICA DO TIMER DE DESCANSO AUTOMÁTICO
function startRestTimer(seconds) {
  // Limpa qualquer timer anterior ativo para não encavalar o tempo
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
      // Opcional: Efeito sonoro nativo sutil de bipes do sistema
      if (window.navigator.vibrate) window.navigator.vibrate([200, 100, 200]);
    }
  }, 1000);
}

function skipTimer() {
  clearInterval(countdownInterval);
  document.getElementById("rest-timer-banner").style.display = "none";
}

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

function switchWorkout(workout) {
  currentWorkout = workout;

  document.getElementById("exercise-list").style.display = "block";
  document.getElementById("history-list").style.display = "none";
  document.getElementById("btn-add").style.display = "block";

  document.querySelectorAll(".tabs button").forEach(btn => btn.classList.remove("active"));
  document.getElementById(`btn-tab-${workout}`).classList.add("active");

  renderExercises(workouts[currentWorkout]);
}

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

function sendToWhatsApp() {
  const exercises = workouts[currentWorkout];
  if(!exercises || exercises.length === 0) {
    alert("Não há treinos para enviar.");
    return;
  }
  let message = `🔥 Ficha de Treino ${currentWorkout} 🔥\n\n`;
  exercises.forEach(ex => {
    message += `${ex.name || 'Exercício'} — ${ex.series} séries de ${ex.reps} repetições\n`;
  });

  const url = "https://wa.me/?text=" + encodeURIComponent(message);
  window.open(url, "_blank");
}

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
  container.style.display = "block";

  document.querySelectorAll(".tabs button").forEach(btn => btn.classList.remove("active"));
  document.getElementById("btn-tab-Hist").classList.add("active");

  container.innerHTML = "<h3>📜 Histórico de Treinos</h3>";
  if(history.length === 0) {
    container.innerHTML += "<p>Nenhum treino salvo ainda.</p>";
    return;
  }

  history.slice().reverse().forEach(h => {
    const dateStr = new Date(h.timestamp).toLocaleDateString();
    container.innerHTML += `
      <div style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 8px; margin-bottom: 8px; border-left: 3px solid silver;">
        <strong>${dateStr} - Treino ${h.type || ''}</strong>
        <p style="white-space: pre-line; margin: 5px 0 0 0; font-size: 0.9em; color: #ccc;">${h.text}</p>
      </div>
    `;
  });
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

function initServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").then(reg => {
      console.log("Service Worker ativo.");
    }).catch(err => console.error("Erro SW:", err));
  }
}