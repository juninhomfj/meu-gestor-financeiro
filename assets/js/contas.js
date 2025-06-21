import { db, collection, addDoc, getDocs, query, orderBy, where, deleteDoc, doc, setDoc } from "./firebase.js";

// Elementos globais
const corpo = document.getElementById("lista-contas");
const formConta = document.getElementById("form-conta");
const filtroTipoConta = document.getElementById("filtro-tipo-conta");
const buscaConta = document.getElementById("busca-conta");
const totalContasEl = document.getElementById("total-contas");

// Exibir saldo total de todas as contas
let totalSaldoEl = document.getElementById("total-saldo");
if (!totalSaldoEl) {
  totalSaldoEl = document.createElement("span");
  totalSaldoEl.id = "total-saldo";
  totalSaldoEl.className = "block mt-2 font-bold text-blue-700";
  if (corpo && corpo.parentElement) {
    corpo.parentElement.insertBefore(totalSaldoEl, corpo.nextSibling);
  }
}

// Carregar contas com saldo, filtro e busca
async function carregarContas() {
  corpo.innerHTML = "";
  let contas = [];
  let saldoTotal = 0;

  try {
    let ref = collection(db, "contas");
    let q = query(ref, orderBy("criadoEm", "desc"));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      corpo.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-gray-500">Nenhuma conta cadastrada.</td></tr>';
      if (totalContasEl) totalContasEl.textContent = "Total de contas: 0";
      if (totalSaldoEl) totalSaldoEl.textContent = "Saldo total: R$ 0,00";
      return;
    }

    // Filtro por tipo
    snapshot.forEach(docSnap => {
      const c = docSnap.data();
      c.id = docSnap.id;
      contas.push(c);
    });

    // Filtro por tipo de conta (PF/PJ)
    const tipoFiltro = filtroTipoConta ? filtroTipoConta.value : "";
    if (tipoFiltro) {
      contas = contas.filter(c => (c.titularidade || "").toLowerCase() === tipoFiltro);
    }

    // Busca por nome
    const termoBusca = buscaConta ? buscaConta.value.trim().toLowerCase() : "";
    if (termoBusca) {
      contas = contas.filter(c => c.nome.toLowerCase().includes(termoBusca));
    }

    if (totalContasEl) totalContasEl.textContent = `Total de contas: ${contas.length}`;

    // Exibir cada conta com saldo, botão de excluir e editar
    for (const c of contas) {
      // Buscar lançamentos efetivados (status "pago" ou "recebido") vinculados a esta conta
      const lancSnapshot = await getDocs(
        query(
          collection(db, "lancamentos"),
          where("conta", "==", c.nome),
          where("status", "in", ["pago", "recebido"])
        )
      );

      let saldo = 0;
      lancSnapshot.forEach(lanc => {
        const l = lanc.data();
        if (l.tipo === "receita") saldo += l.valor;
        else if (l.tipo === "despesa") saldo -= l.valor;
      });

      saldoTotal += saldo;

      const dataCriado = c.criadoEm
        ? new Date(c.criadoEm).toLocaleDateString("pt-BR", { timeZone: "UTC" })
        : "-";

      const tr = document.createElement("tr");
      tr.classList.add("border-b");
      tr.innerHTML = `
        <td class="py-2">${c.nome}</td>
        <td>${c.titularidade || "—"}</td>
        <td>${c.tipo || "—"}</td>
        <td>${dataCriado}</td>
        <td class="${saldo < 0 ? "text-red-600" : "text-green-600"} font-semibold">R$ ${saldo.toFixed(2)}</td>
        <td>
          <button class="btn-editar bg-yellow-400 text-white px-2 rounded mr-1" data-id="${c.id}">Editar</button>
          <button class="btn-excluir bg-red-500 text-white px-2 rounded" data-id="${c.id}" data-nome="${c.nome}">Excluir</button>
        </td>
      `;
      corpo.appendChild(tr);
    }

    // Atualiza saldo total
    if (totalSaldoEl) totalSaldoEl.textContent = `Saldo total: R$ ${saldoTotal.toFixed(2)}`;

    // Eventos de exclusão
    corpo.querySelectorAll(".btn-excluir").forEach(btn => {
      btn.addEventListener("click", async () => {
        // Verifica se há lançamentos vinculados
        const lancSnapshot = await getDocs(query(collection(db, "lancamentos"), where("conta", "==", btn.dataset.nome)));
        if (!lancSnapshot.empty) {
          alert("Não é possível excluir: existem lançamentos vinculados a esta conta.");
          return;
        }
        if (confirm("Deseja realmente excluir esta conta?")) {
          await deleteDoc(doc(db, "contas", btn.dataset.id));
          carregarContas();
        }
      });
    });

    // Eventos de edição
    corpo.querySelectorAll(".btn-editar").forEach(btn => {
      btn.addEventListener("click", async () => {
        const contaId = btn.dataset.id;
        const contaSnap = await getDocs(query(collection(db, "contas"), where("__name__", "==", contaId)));
        if (!contaSnap.empty) {
          const c = contaSnap.docs[0].data();
          document.getElementById("nome-conta").value = c.nome;
          document.getElementById("titularidade").value = c.titularidade || "";
          document.getElementById("tipo-conta").value = c.tipo || "";
          formConta.setAttribute("data-edit-id", contaId);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      });
    });

  } catch (err) {
    console.error("Erro ao carregar contas:", err);
  }
}

// Submissão do formulário de conta (adicionar ou editar)
formConta.addEventListener("submit", async function (e) {
  e.preventDefault();

  const nome = document.getElementById("nome-conta").value.trim();
  const titularidade = document.getElementById("titularidade").value;
  const tipo = document.getElementById("tipo-conta").value;
  const editId = formConta.getAttribute("data-edit-id");

  if (!nome || !titularidade || !tipo) return alert("Preencha todos os campos.");

  const novaConta = {
    nome,
    titularidade,
    tipo,
    criadoEm: new Date().toISOString()
  };

  try {
    if (editId) {
      // Atualizar conta existente
      await deleteDoc(doc(db, "contas", editId));
      await addDoc(collection(db, "contas"), novaConta);
      alert("Conta atualizada com sucesso!");
      formConta.removeAttribute("data-edit-id");
    } else {
      // Nova conta
      await addDoc(collection(db, "contas"), novaConta);
      alert("Conta salva com sucesso!");
    }
    this.reset();
    carregarContas();
  } catch (err) {
    console.error("Erro ao salvar conta:", err);
    alert("Erro ao salvar. Veja o console.");
  }
});

// Filtro por tipo de conta
if (filtroTipoConta) {
  filtroTipoConta.addEventListener("change", carregarContas);
}

// Busca por nome
if (buscaConta) {
  buscaConta.addEventListener("input", () => {
    clearTimeout(buscaConta._debounce);
    buscaConta._debounce = setTimeout(carregarContas, 300);
  });
}

window.addEventListener("DOMContentLoaded", () => {
  carregarContas();
  carregarCategorias(); // ← aqui carregamos as categorias também
});

// ------------------------------
// GERENCIAMENTO DE CATEGORIAS
// ------------------------------

const formCategoria = document.getElementById("form-categoria");
const listaCategorias = document.getElementById("lista-categorias");

async function carregarCategorias() {
  listaCategorias.innerHTML = "";
  const snapshot = await getDocs(collection(db, "categorias"));

  snapshot.forEach(docSnap => {
    const c = docSnap.data();
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="py-2">${c.nome}</td>
      <td class="capitalize">${c.tipo}</td>
      <td>
        <button class="btn-excluir-cat bg-red-500 text-white px-2 rounded" data-id="${docSnap.id}">Excluir</button>
      </td>
    `;
    listaCategorias.appendChild(tr);
  });

  listaCategorias.querySelectorAll(".btn-excluir-cat").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (confirm("Excluir esta categoria?")) {
        await deleteDoc(doc(db, "categorias", btn.dataset.id));
        carregarCategorias();
      }
    });
  });
}

formCategoria.addEventListener("submit", async function (e) {
  e.preventDefault();
  const nome = document.getElementById("nome-categoria").value.trim();
  const tipo = document.getElementById("tipo-categoria").value;

  if (!nome || !tipo) return alert("Preencha todos os campos!");

  try {
    await addDoc(collection(db, "categorias"), {
      nome,
      tipo,
      criadoEm: new Date().toISOString()
    });
    alert("Categoria salva!");
    formCategoria.reset();
    carregarCategorias();
  } catch (err) {
    console.error("Erro ao salvar categoria:", err);
    alert("Erro ao salvar categoria.");
  }
});

// Preencher categorias no formulário de lançamento
async function preencherCategorias(selectCategoria) {
  const snapshot = await getDocs(collection(db, "categorias"));
  selectCategoria.innerHTML = '<option value="">Selecione</option>';
  snapshot.forEach(docSnap => {
    const c = docSnap.data();
    const option = document.createElement("option");
    option.value = c.nome;
    option.textContent = c.nome;
    selectCategoria.appendChild(option);
  });
}

// Chamar preencherCategorias onde necessário, por exemplo, ao abrir o formulário de lançamento
window.addEventListener("DOMContentLoaded", () => {
  carregarContas();
  carregarCategorias();
  const selectCategoria = document.getElementById("categoria-lancamento");
  if (selectCategoria) {
    preencherCategorias(selectCategoria);
  }
});
