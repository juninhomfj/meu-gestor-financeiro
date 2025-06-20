import {
  db,
  collection,
  getDocs,
  query,
  orderBy
} from "./firebase.js";

// Função auxiliar para formatar mês/ano
function formatarMesAno(dataStr) {
  const d = new Date(dataStr);
  return d.toLocaleString("pt-BR", { month: "short", year: "numeric" });
}

// Carrega e processa dados dos lançamentos
async function carregarDadosGrafico() {
  const snapshot = await getDocs(query(collection(db, "lancamentos"), orderBy("data", "asc")));
  const dadosMensais = {}; // { "jan/2024": { receitas: 0, despesas: 0 } }
  let totalReceitas = 0;
  let totalDespesas = 0;

  snapshot.forEach((doc) => {
    const l = doc.data();
    const mes = formatarMesAno(l.data);

    if (!dadosMensais[mes]) {
      dadosMensais[mes] = { receitas: 0, despesas: 0 };
    }

    if (l.tipo === "receita") {
      dadosMensais[mes].receitas += l.valor;
      totalReceitas += l.valor;
    } else if (l.tipo === "despesa") {
      dadosMensais[mes].despesas += l.valor;
      totalDespesas += l.valor;
    }
  });

  document.getElementById("totalReceitas").textContent = `R$ ${totalReceitas.toFixed(2)}`;
  document.getElementById("totalDespesas").textContent = `R$ ${totalDespesas.toFixed(2)}`;
  document.getElementById("saldo").textContent = `R$ ${(totalReceitas - totalDespesas).toFixed(2)}`;

  desenharGraficoPizza(totalReceitas, totalDespesas);
  desenharGraficoLinha(dadosMensais);
}

// Desenha o gráfico de pizza
function desenharGraficoPizza(receitas, despesas) {
  const ctx = document.getElementById("graficoPizza").getContext("2d");
  if (window.graficoPizza) window.graficoPizza.destroy();
  window.graficoPizza = new Chart(ctx, {
    type: "pie",
    data: {
      labels: ["Receitas", "Despesas"],
      datasets: [
        {
          data: [receitas, despesas],
          backgroundColor: ["#4ade80", "#f87171"]
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: "bottom" }
      }
    }
  });
}

// Desenha o gráfico de linha
function desenharGraficoLinha(dados) {
  const ctx = document.getElementById("graficoLinha").getContext("2d");
  const labels = Object.keys(dados);
  const receitas = labels.map((mes) => dados[mes].receitas);
  const despesas = labels.map((mes) => dados[mes].despesas);

  if (window.graficoLinha) window.graficoLinha.destroy();
  window.graficoLinha = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Receitas",
          data: receitas,
          borderColor: "#22c55e",
          backgroundColor: "#bbf7d0",
          tension: 0.4,
          fill: false
        },
        {
          label: "Despesas",
          data: despesas,
          borderColor: "#ef4444",
          backgroundColor: "#fecaca",
          tension: 0.4,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: "bottom" }
      },
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
}

// Executar ao carregar
window.addEventListener("DOMContentLoaded", carregarDadosGrafico);