// assets/js/dashboard.js
import {
  db, collection, addDoc, getDocs, query, orderBy, limit,
  doc, getDoc, setDoc, deleteDoc
} from "./firebase.js";

document.addEventListener("DOMContentLoaded", () => {
  let tiposContas = {};
  let filtroAtual = "todos";
  let editandoId = null;

  // Elementos DOM
  const listaLancamentosEl = document.getElementById("lista-lancamentos");
  const selectConta = document.getElementById("select-conta");
  const selectCategoria = document.getElementById("select-categoria");
  const tipoCategoriaInput = document.getElementById("tipo");

  const btnFiltroTodos = document.getElementById("filtro-todos");
  const btnFiltroPF = document.getElementById("filtro-pf");
  const btnFiltroPJ = document.getElementById("filtro-pj");

  // Atualiza botão filtro
  function atualizarBotaoFiltro() {
    [btnFiltroTodos, btnFiltroPF, btnFiltroPJ].forEach(btn => {
      btn.classList.remove("bg-blue-700", "text-white");
      btn.classList.add("bg-gray-300", "text-gray-800");
    });
    if (filtroAtual === "todos") btnFiltroTodos.classList.add("bg-blue-700", "text-white");
    else if (filtroAtual === "pf") btnFiltroPF.classList.add("bg-blue-700", "text-white");
    else if (filtroAtual === "pj") btnFiltroPJ.classList.add("bg-blue-700", "text-white");
  }

  // Carregar contas e popular o objeto tiposContas
  async function carregarContas() {
    tiposContas = {};
    try {
      const snapshot = await getDocs(collection(db, "contas"));
      const contas = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        contas.push(data);
        tiposContas[data.nome] = data.tipo.toLowerCase();
      });
      localStorage.setItem("contas", JSON.stringify(contas));
      preencherContas(contas);
      return contas;
    } catch (err) {
      console.warn("Erro ao carregar contas, usando cache local.", err);
      const cache = localStorage.getItem("contas");
      if (cache) {
        const contasCache = JSON.parse(cache);
        preencherContas(contasCache);
        contasCache.forEach(c => tiposContas[c.nome] = c.tipo.toLowerCase());
        return contasCache;
      } else {
        selectConta.innerHTML = `<option value="">Nenhuma conta disponível</option>`;
        return [];
      }
    }
  }

  function preencherContas(contas) {
    selectConta.innerHTML = "";
    contas.forEach(conta => {
      const tipo = conta.tipo.toLowerCase();
      if (filtroAtual === "todos" || filtroAtual === tipo) {
        const option = document.createElement("option");
        option.value = conta.nome;
        option.textContent = `${conta.nome} (${tipo === "pf" ? "PF" : "PJ"})`;
        selectConta.appendChild(option);
      }
    });
    if (!selectConta.children.length) {
      selectConta.innerHTML = `<option value="">Nenhuma conta disponível</option>`;
    }
  }

  // Carregar categorias (igual ao seu código original)
  async function carregarCategorias(tipoLancamento = null) {
    selectCategoria.innerHTML = "";
    try {
      const snapshot = await getDocs(collection(db, "categorias"));
      const categorias = [];
      snapshot.forEach(doc => categorias.push(doc.data()));
      localStorage.setItem("categorias", JSON.stringify(categorias));
      preencherCategorias(categorias, tipoLancamento);
    } catch (err) {
      console.warn("Erro ao carregar categorias, usando cache local.", err);
      const cache = localStorage.getItem("categorias");
      if (cache) preencherCategorias(JSON.parse(cache), tipoLancamento);
      else selectCategoria.innerHTML = `<option value="">Nenhuma categoria disponível</option>`;
    }
  }

  function preencherCategorias(categorias, tipoLancamento) {
    selectCategoria.innerHTML = "";
    categorias.forEach(cat => {
      if (
        !tipoLancamento ||
        cat.tipo === "ambos" ||
        cat.tipo === tipoLancamento ||
        !cat.tipo
      ) {
        const option = document.createElement("option");
        option.value = cat.nome;
        option.textContent = cat.nome;
        selectCategoria.appendChild(option);
      }
    });
    if (!selectCategoria.children.length) {
      selectCategoria.innerHTML = `<option value="">Nenhuma categoria disponível</option>`;
    }
  }

  // Carrega lançamentos filtrando depois que contas já carregaram (importante!)
  async function carregarLancamentos() {
    listaLancamentosEl.innerHTML = "";
    try {
      // Aguarda carregar contas para ter tiposContas atualizado
      await carregarContas();

      const lancamentosRef = collection(db, "lancamentos");
      const q = query(lancamentosRef, orderBy("data", "desc"), limit(50));
      const snapshot = await getDocs(q);
      let lancamentos = [];

      snapshot.forEach(doc => {
        const data = doc.data();
        data.id = doc.id;
        lancamentos.push(data);
      });

      if (filtroAtual !== "todos") {
        lancamentos = lancamentos.filter(lan => {
          const tipoConta = tiposContas[lan.conta] || "";
          return tipoConta === filtroAtual;
        });
      }

      localStorage.setItem("lancamentos", JSON.stringify(lancamentos));
      preencherTabelaLancamentos(lancamentos);
    } catch (err) {
      console.warn("Erro ao carregar lançamentos, usando cache local.", err);
      const cache = localStorage.getItem("lancamentos");
      if (cache) {
        const lancamentosCache = JSON.parse(cache);
        preencherTabelaLancamentos(lancamentosCache);
      } else {
        listaLancamentosEl.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-gray-500">Nenhum lançamento disponível</td></tr>`;
      }
    }
  }

  function preencherTabelaLancamentos(lancamentos) {
    listaLancamentosEl.innerHTML = "";
    if (!lancamentos.length) {
      listaLancamentosEl.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-gray-500">Nenhum lançamento encontrado</td></tr>`;
      return;
    }
    lancamentos.forEach(lan => {
      const tr = document.createElement("tr");
      tr.classList.add("border-b");

      const dataFormatada = new Date(lan.data).toLocaleDateString("pt-BR");

      tr.innerHTML = `
        <td class="py-2">${dataFormatada}</td>
        <td>${lan.descricao}</td>
        <td>${lan.tipo}</td>
        <td>R$ ${Number(lan.valor).toFixed(2).replace(".", ",")}</td>
        <td>${lan.conta}</td>
        <td>${lan.status || ""}</td>
        <td>
          <button class="editar-lancamento text-blue-600 hover:underline cursor-pointer" data-id="${lan.id}">Editar</button>
          <button class="excluir-lancamento text-red-600 hover:underline cursor-pointer ml-2" data-id="${lan.id}">Excluir</button>
        </td>
      `;

      listaLancamentosEl.appendChild(tr);
    });

    // Listeners para editar e excluir (pode continuar igual)
  }

  // Eventos filtros
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

  // Inicializa a UI
  atualizarBotaoFiltro();
  carregarLancamentos();
});
