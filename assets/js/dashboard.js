import {
  db, collection, addDoc, getDocs, query, orderBy, limit,
  doc, getDoc, setDoc, deleteDoc
} from "./firebase.js";
import { criarEventoGoogleAgenda, removerEventoGoogleAgenda } from "./google.js";

let graficoCategorias = null;
let graficoMensal = null;

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
const tipoCategoriaInput = document.getElementById("tipo"); // select do tipo de lançamento

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
  carregarCategorias(formLancamento.tipo.value); // já filtra pelo tipo atual
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
async function carregarCategorias(tipoLancamento = null) {
  selectCategoria.innerHTML = "";
  const snapshot = await getDocs(collection(db, "categorias"));
  snapshot.forEach(docSnap => {
    const cat = docSnap.data();
    // Mostra se for do tipo correto ou "ambos" ou se não estiver filtrando
    if (
      !tipoLancamento ||
      cat.tipo === "ambos" ||
      cat.tipo === tipoLancamento ||
      !cat.tipo // para categorias antigas sem tipo
    ) {
      const option = document.createElement("option");
      option.value = cat.nome;
      option.textContent = cat.nome;
      selectCategoria.appendChild(option);
    }
  });
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
      gerarGraficos([]);
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
    gerarGraficos(lancamentos);

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
          <button class="text-red-600 hover:underline btn-excluir ml-2" data-id="${lanc.id}">🗑️</button>
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

// Função para excluir lançamento (com remoção do evento Google Agenda, se existir)
async function excluirLancamento(id) {
  if (!confirm("Tem certeza que deseja excluir este lançamento?")) return;

  try {
    const ref = doc(db, "lancamentos", id);
    const snap = await getDoc(ref);

    if (snap.exists()) {
      const lancamento = snap.data();

      // Tenta remover do Google Agenda se tiver eventId
      if (lancamento.eventId) {
        try {
          await removerEventoGoogleAgenda(lancamento.eventId);
          console.log("Evento removido do Google Agenda.");
        } catch (e) {
          console.warn("Erro ao remover do Google Agenda:", e);
        }
      }

      await deleteDoc(ref);
      alert("Lançamento excluído!");
      carregarLancamentos();
    }
  } catch (err) {
    console.error("Erro ao excluir:", err);
    alert("Erro ao excluir lançamento.");
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

  // Debug: veja tudo que veio do Firebase
  console.log("Dados do lançamento para edição:", lanc);

  formLancamento.descricao.value = lanc.descricao || "";
  formLancamento.valor.value = lanc.valor || "";
  // Corrige campo data para aceitar apenas "YYYY-MM-DD"
  formLancamento.data.value = lanc.data ? lanc.data.split("T")[0] : "";
  formLancamento.tipo.value = lanc.tipo || "receita";
  formLancamento.status.value = lanc.status || "pendente";
  selectConta.value = lanc.conta || "";
  selectCategoria.value = lanc.categoria || "";

  // Marca o checkbox do Google Agenda se o lançamento tinha evento
  if (chkAgenda) {
    chkAgenda.checked = !!lanc.eventId;
  }

  // Corrige recorrência
  if (lanc.recorrente) {
    chkRecorrente.checked = true;
    divRecorrenciaConfig.classList.remove("hidden");
    formLancamento.frequencia.value = lanc.frequencia || "";
    formLancamento.repeticoes.value = lanc.repeticoes || "";
    if (campoOutros && lanc.frequencia === "outros") {
      campoOutros.classList.remove("hidden");
      frequenciaOutrosInput.value = lanc.frequenciaOutros || "";
    } else if (campoOutros) {
      campoOutros.classList.add("hidden");
      frequenciaOutrosInput.value = "";
    }
  } else {
    chkRecorrente.checked = false;
    divRecorrenciaConfig.classList.add("hidden");
    if (campoOutros) campoOutros.classList.add("hidden");
    if (frequenciaOutrosInput) frequenciaOutrosInput.value = "";
  }

  editandoId = id;
  abrirModal();
}

// Salvar lançamento
async function salvarLancamento(e) {
  e.preventDefault();

  const dados = {
    descricao: formLancamento.descricao.value.trim(),
    valor: parseFloat(formLancamento.valor.value),
    data: formLancamento.data.value,
    conta: selectConta.value,
    categoria: selectCategoria.value,
    tipo: formLancamento.tipo.value,
    status: formLancamento.status.value || "pendente",
    criadoEm: new Date().toISOString()
  };

  if (chkRecorrente.checked) {
    dados.recorrente = true;
    dados.frequencia = formLancamento.frequencia.value;
    dados.repeticoes = parseInt(formLancamento.repeticoes.value) || 1;
    if (dados.frequencia === "outros" && frequenciaOutrosInput) {
      dados.frequenciaOutros = parseInt(frequenciaOutrosInput.value) || 1;
    }
  }

  if (!dados.descricao || isNaN(dados.valor) || !dados.data || !dados.conta || !dados.categoria) {
    alert("Preencha todos os campos corretamente.");
    return;
  }

  try {
    if (editandoId) {
      const docRef = doc(db, "lancamentos", editandoId);
      const snap = await getDoc(docRef);

      if (snap.exists()) {
        const dadosAntigos = snap.data();

        // Se o lançamento anterior tinha um evento Google, remover
        if (dadosAntigos.eventId) {
          try {
            await removerEventoGoogleAgenda(dadosAntigos.eventId);
            console.log("Evento antigo removido com sucesso");
          } catch (err) {
            console.warn("Falha ao remover evento antigo:", err.message);
          }
        }

        // Se marcado para adicionar à agenda, cria novo evento
        if (chkAgenda && chkAgenda.checked) {
          const novoEvento = await criarEventoGoogleAgenda(dados);
          if (novoEvento?.result?.id) {
            dados.eventId = novoEvento.result.id;
          }
        }
      }

      await setDoc(docRef, dados);
      alert("Lançamento atualizado!");
    } else {
      // Novo lançamento
      if (chkAgenda && chkAgenda.checked) {
        const eventId = await criarEventoGoogleAgenda(dados);
        if (eventId) {
          dados.eventId = eventId;
        }
      }

      await addDoc(collection(db, "lancamentos"), dados);
      alert("Lançamento salvo!");
    }

    fecharModal();
    carregarLancamentos();
  } catch (err) {
    alert("Erro ao salvar: " + err.message);
  }
}

// Form submit
formLancamento.addEventListener("submit", salvarLancamento);

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

// ===== MODAL DE NOVA CONTA =====

const modalNovaConta = document.getElementById("modal-nova-conta");
const formNovaConta = document.getElementById("form-nova-conta");
const btnCancelarConta = document.querySelector(".btn-cancelar-conta");
const inputNomeConta = document.getElementById("nova-conta-nome");
const selectTipoConta = document.getElementById("nova-conta-tipo");

// Abrir modal de conta
btnAddConta.addEventListener("click", () => {
  inputNomeConta.value = "";
  selectTipoConta.value = "";
  modalNovaConta.classList.remove("hidden");
  inputNomeConta.focus();
});

// Cancelar modal de conta
btnCancelarConta.addEventListener("click", () => {
  modalNovaConta.classList.add("hidden");
});

// Submeter nova conta
formNovaConta.addEventListener("submit", async (e) => {
  e.preventDefault();

  const nome = inputNomeConta.value.trim();
  const tipo = selectTipoConta.value;

  if (!nome || !tipo) {
    alert("Preencha todos os campos.");
    return;
  }

  try {
    await addDoc(collection(db, "contas"), {
      nome,
      tipo,
      criadoEm: new Date().toISOString()
    });

    alert("Conta criada com sucesso!");
    modalNovaConta.classList.add("hidden");
    await carregarContas(); // Atualiza o select no formulário principal
    selectConta.value = nome; // Deixa a nova conta já selecionada
  } catch (err) {
    console.error("Erro ao criar conta:", err);
    alert("Erro ao salvar a conta.");
  }
});

// ===== MODAL DE NOVA CATEGORIA =====

const modalNovaCategoria = document.getElementById("modal-nova-categoria");
const formNovaCategoria = document.getElementById("form-nova-categoria");
const inputNomeCategoria = document.getElementById("nova-categoria-nome");
const btnCancelarCategoria = document.querySelector(".btn-cancelar-categoria");

// Abrir modal
btnAddCategoria.addEventListener("click", () => {
  inputNomeCategoria.value = "";
  modalNovaCategoria.classList.remove("hidden");
  inputNomeCategoria.focus();
});

// Cancelar modal
btnCancelarCategoria.addEventListener("click", () => {
  modalNovaCategoria.classList.add("hidden");
});

// Salvar nova categoria
formNovaCategoria.addEventListener("submit", async (e) => {
  e.preventDefault();

  const nome = inputNomeCategoria.value.trim();
  const tipo = tipoCategoriaInput ? tipoCategoriaInput.value : "ambos";

  if (!nome) {
    alert("Preencha o nome da categoria.");
    return;
  }

  try {
    await addDoc(collection(db, "categorias"), {
      nome,
      tipo,
      criadoEm: new Date().toISOString()
    });

    alert("Categoria criada com sucesso!");
    modalNovaCategoria.classList.add("hidden");
    await carregarCategorias(tipo);
    selectCategoria.value = nome;
  } catch (err) {
    console.error("Erro ao criar categoria:", err);
    alert("Erro ao salvar a categoria.");
  }
});

formModalCategoria.addEventListener("submit", async (e) => {
  e.preventDefault();
  const nome = nomeModalCategoria.value.trim();
  const tipo = tipoModalCategoria.value;

  if (!nome || !tipo) {
    alert("Preencha todos os campos.");
    return;
  }

  try {
    await addDoc(collection(db, "categorias"), {
      nome,
      tipo,
      criadoEm: new Date().toISOString()
    });
    alert("Categoria criada!");
    modalCategoria.classList.add("hidden");
    carregarCategorias(tipo);
    setTimeout(() => {
      selectCategoria.value = nome;
    }, 300);
  } catch (err) {
    alert("Erro ao criar categoria.");
  }
});

formLancamento.tipo.addEventListener("change", () => {
  carregarCategorias(formLancamento.tipo.value);
});

// Inicializa os filtros e dados
atualizarBotaoFiltro();
carregarLancamentos();

// Função para formatar data para dd/mm/yyyy
function formatarData(dataISO) {
  const d = new Date(dataISO);
  return d.toLocaleDateString("pt-BR");
}

// Botão WhatsApp para inserir via modelo
document.getElementById("btn-whatsapp").addEventListener("click", () => {
  const modelo = encodeURIComponent("DESPESA | 45.90 | 2025-06-21 | Mercado | Alimentação | Pago | Conta PF");
  window.open(`https://wa.me/?text=${modelo}`, "_blank");
});

// Botão para upload de XML
document.getElementById("btn-cupom-xml").addEventListener("click", () => {
  document.getElementById("xml-upload").click();
});

document.getElementById("xml-upload").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function () {
    const xml = new DOMParser().parseFromString(reader.result, "text/xml");

    const emitente = xml.querySelector("emit xNome")?.textContent || "Desconhecido";
    const total = parseFloat(xml.querySelector("ICMSTot vNF")?.textContent || "0");
    const data = xml.querySelector("ide dhEmi")?.textContent?.split("T")[0];

    formLancamento.descricao.value = `Compra em ${emitente}`;
    formLancamento.valor.value = total;
    formLancamento.data.value = data;
    formLancamento.tipo.value = "despesa";
    chkRecorrente.checked = false;

    alert("Dados carregados do cupom fiscal.");
    abrirModal(); // Abre o modal já preenchido
  };

  reader.readAsText(file);
});

// Botão para leitura de QR Code
document.getElementById("btn-cupom-qr").addEventListener("click", () => {
  document.getElementById("qr-reader").classList.toggle("hidden");
  // Aqui você pode inicializar o html5-qrcode se ainda não estiver rodando
});

// Leitura de XML para NFC-e
document.getElementById("input-xml-nfce").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const reader = new FileReader();
    reader.onload = function (e) {
      const parser = new DOMParser();
      const xml = parser.parseFromString(e.target.result, "text/xml");

      const total = xml.querySelector("vNF")?.textContent || "";
      const data = xml.querySelector("dhEmi")?.textContent || xml.querySelector("dEmi")?.textContent || "";
      const emitente = xml.querySelector("xNome")?.textContent || "Cupom Fiscal";
      const produtos = [...xml.querySelectorAll("det")].map(item => {
        const nome = item.querySelector("xProd")?.textContent;
        const valor = item.querySelector("vProd")?.textContent;
        return `${nome} - R$ ${valor}`;
      });

      // Variáveis para log
      const descricao = `Compra: ${emitente}`;
      const valor = total;
      const conta = ""; // Não extraído do XML
      const categoria = ""; // Não extraído do XML

      console.log("Conteúdo extraído do XML:", {
        descricao,
        valor,
        data,
        conta,
        categoria
      });

      formLancamento.descricao.value = descricao;
      formLancamento.valor.value = valor;
      formLancamento.data.value = data.split("T")[0]; // Formata para yyyy-mm-dd
      formLancamento.tipo.value = "despesa";
      formLancamento.status.value = "pendente";
      document.getElementById("recorrente").checked = false;

      alert("Cupom fiscal carregado com sucesso!");
    };
    reader.readAsText(file);
  } catch (err) {
    console.error("Erro ao processar XML:", err);
    alert("Erro ao ler cupom fiscal.");
  }
});
