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

  // Renderiza do mais recente para o mais antigo
  // Passamos o index original (i) para saber exatamente qual item deletar
  history.slice().reverse().forEach((h, index) => {
    const originalIndex = history.length - 1 - index; // Ajusta o index por conta do reverse
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

// NOVA FUNÇÃO PARA REMOVER O ITEM DO LOCALSTORAGE
function deleteHistoryItem(index) {
  if (confirm("Deseja apagar este treino do histórico?")) {
    let history = JSON.parse(localStorage.getItem("history")) || [];
    
    // Remove o item selecionado da array
    history.splice(index, 1);
    
    // Salva a nova lista atualizada de volta no localStorage
    localStorage.setItem("history", JSON.stringify(history));
    
    // Atualiza a tela do histórico e os números do Dashboard
    renderHistory();
    updateDashboard();
  }
}