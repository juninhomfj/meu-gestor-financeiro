// assets/js/relatorios.js
import { db, collection, getDocs, query, where, orderBy } from "./firebase.js";

const form = document.getElementById("form-filtros");
const tabela = document.getElementById("tabela-relatorios");
const selectConta = document.getElementById("filtro-conta");
const totalRelatorio = document.getElementById("total-relatorio");

// Carregar contas no select
async function carregarContas() {
  const snapshot = await getDocs(collection(db, "contas"));
  selectConta.innerHTML = '<option value="">Todas</option>';
  snapshot.forEach(doc => {
    const nome = doc.data().nome;
    const option = document.createElement("option");
    option.value = nome;
    option.textContent = nome;
    selectConta.appendChild(option);
  });
}

// Aplicar filtros e mostrar lançamentos
async function aplicarFiltros(e) {
  if (e) e.preventDefault();

  const tipo = document.getElementById("filtro-tipo").value;
  const conta = document.getElementById("filtro-conta").value;
  const dataInicio = document.getElementById("filtro-data-inicio").value;
  const dataFim = document.getElementById("filtro-data-fim").value;

  const snapshot = await getDocs(query(collection(db, "lancamentos"), orderBy("data", "desc")));

  tabela.innerHTML = "";
  let total = 0;
  let encontrados = 0;

  snapshot.forEach(doc => {
    const l = doc.data();
    if (
      (tipo === "" || l.tipo === tipo) &&
      (conta === "" || l.conta === conta) &&
      (dataInicio === "" || l.data >= dataInicio) &&
      (dataFim === "" || l.data <= dataFim)
    ) {
      const tr = document.createElement("tr");
      tr.classList.add("border-b");
      tr.innerHTML = `
        <td class="py-2">${formatarData(l.data)}</td>
        <td>${l.descricao}</td>
        <td>${l.tipo}</td>
        <td class="${l.tipo === 'despesa' ? 'text-red-600' : 'text-green-600'} font-semibold">R$ ${l.valor.toFixed(2)}</td>
        <td>${l.conta}</td>
        <td>${l.status || "-"}</td>
      `;
      tabela.appendChild(tr);
      total += l.valor;
      encontrados++;
    }
  });

  totalRelatorio.textContent = `${encontrados} lançamento(s) encontrados. Total: R$ ${total.toFixed(2)}`;
}

function formatarData(dataStr) {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(dataStr));
}

form.addEventListener("submit", aplicarFiltros);

window.addEventListener("DOMContentLoaded", async () => {
  await carregarContas();
  aplicarFiltros(); // mostra todos ao abrir
});
