import {
  db, collection, addDoc, getDocs, query, orderBy, limit,
  doc, getDoc, setDoc, deleteDoc // IMPORTANTE: adicionar deleteDoc aqui
} from "./firebase.js";
import { criarEventoGoogleAgenda } from "./google.js";

// Elementos globais
const modal = document.getElementById("modal-lancamento");
const btnAbrirModal = document.getElementById("btn-abrir-modal");
const btnFecharModal = document.getElementById("btn-fechar-modal");
const btnCancelar = document.getElementById("btn-cancelar");
const formLancamento = document.getElementById("form-lancamento");

const selectConta = document.getElementById("select-conta");
const selectCategoria = document.getElementById("select-categoria");
const btnAddConta = document.getElementById("btn-add-conta");
const btnAddCategoria = document.getElementById("btn-add-categoria");

const chkRecorrente = document.getElementById("recorrente");
const divRecorrenciaConfig = document.getElementById("recorrencia-config");
const chkAgenda = document.getElementById("adicionar-agenda");
const campoOutros = document.getElementById("campo-outros");
const frequenciaSelect = document.getElementById("frequencia");
const frequenciaOutrosInput = document.getElementById("frequencia-outros");

const saldoPFEl = document.getElementById("saldo-pf");
const saldoPJEl = document.getElementById("saldo-pj");
const despesasMesEl = document.getElementById("despesas-mes");
const receitasMesEl = document.getElementById("receitas-mes");
const despesasPendentesMesEl = document.getElementById("despesas-pendentes-mes");
const despesasFuturas30El = document.getElementById("despesas-futuras-30dias");
const todasDespesasEl = document.getElementById("todas-despesas");
const listaLancamentosEl = document.getElementById("lista-lancamentos");

const btnFiltroTodos = document.getElementById("filtro-todos");
const btnFiltroPF = document.getElementById("filtro-pf");
const btnFiltroPJ = document.getElementById("filtro-pj");

let editandoId = null;
let tiposContas = {}; // { nomeConta: "pf" ou "pj" }
let filtroAtual = "todos"; // "todos", "pf", "pj"

// Função para mudar estilo dos botões filtro
function atualizarBotaoFiltro() {
  const botoes = [btnFiltroTodos, btnFiltroPF, btnFiltroPJ];
  botoes.forEach(btn => {
    btn.classList.remove("bg-blue-700", "text-white");
    btn.classList.add("bg-gray-300", "text-gray-800");
  });

  if (filtroAtual === "todos") {
    btnFiltroTodos.classList.add("bg-blue-700", "text-white");
  } else if (filtroAtual === "pf") {
    btnFiltroPF.classList.add("bg-blue-700", "text-white");
  } else if (filtroAtual === "pj") {
    btnFiltroPJ.classList.add("bg-blue-700", "text-white");
  }
}

// Ações dos botões filtro
btnFiltroTodos.addEventListener("click", () => {
  filtroAtual = "todos";
  atualizarBotaoFiltro();
  carregarLancamentos();
});
btnFiltroPF.addEventListener("click", () => {
  filtroAtual = "pf";
  atualizarBotaoFiltro();
  carregarLancamentos();
});
btnFiltroPJ.addEventListener("click", () => {
  filtroAtual = "pj";
  atualizarBotaoFiltro();
  carregarLancamentos();
});

function abrirModal() {
  modal.classList.remove("hidden");
  carregarContas();
  carregarCategorias();
}

function fecharModal() {
  modal.classList.add("hidden");
  formLancamento.reset();
  editandoId = null;
  divRecorrenciaConfig.classList.add("hidden");
  if (campoOutros) campoOutros.classList.add("hidden");
}

// Carregar contas do banco e guardar tipos
async function carregarContas() {
  selectConta.innerHTML = "";
  tiposContas = {};

  const contasSnapshot = await getDocs(collection(db, "contas"));
  contasSnapshot.forEach((doc) => {
    const data = doc.data();
    const nome = data.nome;
    const tipo = data.tipo ? data.tipo.toLowerCase() : "pf";

    tiposContas[nome] = tipo;

    if (filtroAtual === "todos" || filtroAtual === tipo) {
      const option = document.createElement("option");
      option.value = nome;
      option.textContent = nome + (tipo === "pf" ? " (PF)" : " (PJ)");
      selectConta.appendChild(option);
    }
  });

  // Se não tiver conta depois do filtro, deixar um option vazio
  if (!selectConta.children.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Nenhuma conta disponível para filtro selecionado";
    selectConta.appendChild(option);
  }
}

// Carregar categorias do banco
async function carregarCategorias() {
  selectCategoria.innerHTML = "";
  const categoriasSnapshot = await getDocs(collection(db, "categorias"));
  categoriasSnapshot.forEach((doc) => {
    const option = document.createElement("option");
    option.value = doc.data().nome;
    option.textContent = doc.data().nome;
    selectCategoria.appendChild(option);
  });
}

// Adicionar nova conta com tipo (PF ou PJ)
async function adicionarConta() {
  const nomeConta = prompt("Digite o nome da nova conta:");
  if (!nomeConta || !nomeConta.trim()) return;

  let tipoConta = prompt("Digite o tipo da conta:\n1 - Pessoa Física (PF)\n2 - Pessoa Jurídica (PJ)");
  if (!tipoConta) return;

  tipoConta = tipoConta.trim();
  if (tipoConta !== "1" && tipoConta !== "2") {
    alert("Tipo inválido. Use 1 para PF ou 2 para PJ.");
    return;
  }

  const tipo = tipoConta === "1" ? "pf" : "pj";

  await addDoc(collection(db, "contas"), {
    nome: nomeConta.trim(),
    tipo: tipo,
    criadoEm: new Date().toISOString()
  });

  carregarContas();
  selectConta.value = nomeConta.trim();
}

// Adicionar nova categoria
async function adicionarCategoria() {
  const nomeCategoria = prompt("Digite o nome da nova categoria:");
  if (nomeCategoria && nomeCategoria.trim()) {
    await addDoc(collection(db, "categorias"), { nome: nomeCategoria.trim(), criadoEm: new Date().toISOString() });
    carregarCategorias();
    selectCategoria.value = nomeCategoria.trim();
  }
}

// Carregar lançamentos com botão editar e excluir
async function carregarLancamentos() {
  listaLancamentosEl.innerHTML = "";

  try {
    const q = query(collection(db, "lancamentos"), orderBy("criadoEm", "desc"), limit(50));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      listaLancamentosEl.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-gray-500">Nenhum lançamento encontrado.</td></tr>`;
      atualizarCards([]);
      return;
    }

    let lancamentos = [];

    snapshot.forEach((docSnap) => {
      const lanc = docSnap.data();
      lanc.id = docSnap.id;
      // Aplica filtro de PF/PJ para o dashboard e tabela
      const tipoContaLanc = tiposContas[lanc.conta] || "pf";

      if (filtroAtual === "todos" || filtroAtual === tipoContaLanc) {
        lancamentos.push(lanc);
      }
    });

    atualizarCards(lancamentos);

    listaLancamentosEl.innerHTML = "";

    lancamentos.forEach((lanc) => {
      const tipoContaLanc = tiposContas[lanc.conta] || "pf";

      const linha = document.createElement("tr");
      linha.id = `lancamento-${lanc.id}`;
      linha.classList.add("border-b");
      linha.innerHTML = `
        <td class="py-2">${formatarData(lanc.data)}</td>
        <td>${lanc.descricao}</td>
        <td>${lanc.tipo}</td>
        <td class="${lanc.tipo === 'despesa' ? 'text-red-600' : 'text-green-600'} font-semibold">R$ ${lanc.valor.toFixed(2)}</td>
        <td>${lanc.conta} (${tipoContaLanc === "pf" ? "PF" : "PJ"})</td>
        <td>${lanc.status || "pendente"}</td>
        <td>
          <button class="text-blue-600 hover:underline btn-editar" data-id="${lanc.id}">✏️</button>
          <button class="text-red-600 hover:underline btn-excluir ml-2" data-id="${lanc.id}">❌</button>
        </td>
      `;
      listaLancamentosEl.appendChild(linha);
    });

    document.querySelectorAll(".btn-editar").forEach(btn => {
      btn.addEventListener("click", () => editarLancamento(btn.dataset.id));
    });

    document.querySelectorAll(".btn-excluir").forEach(btn => {
      btn.addEventListener("click", () => excluirLancamento(btn.dataset.id));
    });
  } catch (err) {
    console.error("Erro ao carregar lançamentos:", err);
  }
}

// Função para excluir lançamento
async function excluirLancamento(id) {
  try {
    const confirma = confirm("Tem certeza que deseja excluir este lançamento?");
    if (!confirma) return;

    await deleteDoc(doc(db, "lancamentos", id));

    // Remove da tabela para atualização imediata
    const linha = document.getElementById(`lancamento-${id}`);
    if (linha) linha.remove();

    alert("Lançamento excluído com sucesso!");
  } catch (error) {
    console.error("Erro ao excluir lançamento:", error);
    alert("Erro ao excluir lançamento. Tente novamente.");
  }
}

// Atualizar os cartões de resumo no dashboard
function atualizarCards(lancamentos) {
  const now = new Date();
  const mesAtual = now.getMonth();
  const anoAtual = now.getFullYear();

  const inicioMes = new Date(anoAtual, mesAtual, 1);
  const fimMes = new Date(anoAtual, mesAtual + 1, 0);
  const hoje = new Date();

  let saldoPF = 0;
  let saldoPJ = 0;
  let receitasMes = 0;
  let despesasMes = 0;
  let despesasPendentesMes = 0;
  let despesasFuturas30 = 0;
  let todasDespesas = 0;

  lancamentos.forEach((lanc) => {
    const dataLanc = new Date(lanc.data);
    const tipoContaLanc = tiposContas[lanc.conta] || "pf";

    if (tipoContaLanc === "pf") {
      if (lanc.tipo === "receita") saldoPF += lanc.valor;
      else if (lanc.tipo === "despesa") saldoPF -= lanc.valor;
    } else if (tipoContaLanc === "pj") {
      if (lanc.tipo === "receita") saldoPJ += lanc.valor;
      else if (lanc.tipo === "despesa") saldoPJ -= lanc.valor;
    }

    if (dataLanc >= inicioMes && dataLanc <= fimMes) {
      if (lanc.tipo === "receita") receitasMes += lanc.valor;
      else if (lanc.tipo === "despesa") despesasMes += lanc.valor;

      if (lanc.tipo === "despesa" && lanc.status === "pendente") {
        despesasPendentesMes += lanc.valor;
      }
    }

    if (lanc.tipo === "despesa" && dataLanc > hoje && dataLanc <= addDias(hoje, 30)) {
      despesasFuturas30 += lanc.valor;
    }

    if (lanc.tipo === "despesa") {
      todasDespesas += lanc.valor;
    }
  });

  saldoPFEl.textContent = `R$ ${saldoPF.toFixed(2)}`;
  saldoPJEl.textContent = `R$ ${saldoPJ.toFixed(2)}`;
  receitasMesEl.textContent = `R$ ${receitasMes.toFixed(2)}`;
  despesasMesEl.textContent = `R$ ${despesasMes.toFixed(2)}`;
  if (despesasPendentesMesEl) despesasPendentesMesEl.textContent = `R$ ${despesasPendentesMes.toFixed(2)}`;
  if (despesasFuturas30El) despesasFuturas30El.textContent = `R$ ${despesasFuturas30.toFixed(2)}`;
  if (todasDespesasEl) todasDespesasEl.textContent = `R$ ${todasDespesas.toFixed(2)}`;
}

// Função utilitária para somar dias a uma data
function addDias(data, dias) {
  const nova = new Date(data);
  nova.setDate(nova.getDate() + dias);
  return nova;
}

// Editar lançamento
async function editarLancamento(id) {
  const ref = doc(db, "lancamentos", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return alert("Lançamento não encontrado!");

  const lanc = snap.data();

  formLancamento.descricao.value = lanc.descricao || "";
  formLancamento.valor.value = lanc.valor || "";
  formLancamento.data.value = lanc.data || "";
  formLancamento.tipo.value = lanc.tipo || "receita";
  formLancamento.status.value = lanc.status || "pendente";
  selectConta.value = lanc.conta || "";
  selectCategoria.value = lanc.categoria || "";

  if (lanc.recorrente) {
    chkRecorrente.checked = true;
    divRecorrenciaConfig.classList.remove("hidden");
    formLancamento.frequencia.value = lanc.frequencia;
    formLancamento.repeticoes.value = lanc.repeticoes;
    if (campoOutros && lanc.frequencia === "outros") {
      campoOutros.classList.remove("hidden");
      frequenciaOutrosInput.value = lanc.frequenciaOutros || "";
    }
  } else {
    chkRecorrente.checked = false;
    divRecorrenciaConfig.classList.add("hidden");
    if (campoOutros) campoOutros.classList.add("hidden");
  }

  editandoId = id;
  abrirModal();
}

// Form submit
formLancamento.addEventListener("submit", async (e) => {
  e.preventDefault();

  const dados = {
    descricao: formLancamento.descricao.value.trim(),
    valor: parseFloat(formLancamento.valor.value),
    data: formLancamento.data.value,
    tipo: formLancamento.tipo.value,
    status: formLancamento.status.value,
    conta: selectConta.value,
    categoria: selectCategoria.value,
    criadoEm: new Date().toISOString(),
    recorrente: chkRecorrente.checked,
    frequencia: frequenciaSelect.value,
    repeticoes: formLancamento.repeticoes ? parseInt(formLancamento.repeticoes.value) : 1,
    frequenciaOutros: frequenciaOutrosInput ? frequenciaOutrosInput.value.trim() : ""
  };

  if (!dados.descricao || isNaN(dados.valor) || !dados.data || !dados.tipo || !dados.conta) {
    alert("Preencha todos os campos obrigatórios.");
    return;
  }

  try {
    if (editandoId) {
      // Atualizar
      await setDoc(doc(db, "lancamentos", editandoId), dados);
      alert("Lançamento atualizado com sucesso!");
    } else {
      // Criar
      await addDoc(collection(db, "lancamentos"), dados);
      alert("Lançamento criado com sucesso!");
      // Só chama o Google Agenda se for novo lançamento e checkbox marcado
      if (chkAgenda && chkAgenda.checked) {
        criarEventoGoogleAgenda(dados);
      }
    }
    fecharModal();
    carregarLancamentos();
  } catch (error) {
    console.error("Erro ao salvar lançamento:", error);
    alert("Erro ao salvar lançamento. Tente novamente.");
  }
});

chkRecorrente.addEventListener("change", () => {
  if (chkRecorrente.checked) {
    divRecorrenciaConfig.classList.remove("hidden");
  } else {
    divRecorrenciaConfig.classList.add("hidden");
    if (campoOutros) campoOutros.classList.add("hidden");
  }
});

frequenciaSelect.addEventListener("change", () => {
  if (frequenciaSelect.value === "outros" && campoOutros) {
    campoOutros.classList.remove("hidden");
  } else if (campoOutros) {
    campoOutros.classList.add("hidden");
  }
});

btnAbrirModal.addEventListener("click", abrirModal);
btnFecharModal.addEventListener("click", fecharModal);
btnCancelar.addEventListener("click", fecharModal);

btnAddConta.addEventListener("click", adicionarConta);
btnAddCategoria.addEventListener("click", adicionarCategoria);

// Inicializa os filtros e dados
atualizarBotaoFiltro();
carregarLancamentos();

// Função para formatar data para dd/mm/yyyy
function formatarData(dataISO) {
  const d = new Date(dataISO);
  return d.toLocaleDateString("pt-BR");
}
