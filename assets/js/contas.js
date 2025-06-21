import {
  db,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  where,
  deleteDoc,
  doc
} from "./firebase.js";

// Elementos globais
const corpo = document.getElementById("lista-contas");
const formConta = document.getElementById("form-conta");
const filtroTipoConta = document.getElementById("filtro-tipo-conta");
const buscaConta = document.getElementById("busca-conta");
const totalContasEl = document.getElementById("total-contas");

let totalSaldoEl = document.getElementById("total-saldo");
if (!totalSaldoEl && corpo?.parentElement) {
  totalSaldoEl = document.createElement("span");
  totalSaldoEl.id = "total-saldo";
  totalSaldoEl.className = "block mt-2 font-bold text-blue-700";
  corpo.parentElement.insertBefore(totalSaldoEl, corpo.nextSibling);
}

// 🔄 Função principal para carregar e exibir as contas
async function carregarContas() {
  corpo.innerHTML = "";
  let contas = [];
  let saldoTotal = 0;

  try {
    const ref = collection(db, "contas");
    const q = query(ref, orderBy("criadoEm", "desc"));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      corpo.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-gray-500">Nenhuma conta cadastrada.</td></tr>';
      totalContasEl.textContent = "Total de contas: 0";
      totalSaldoEl.textContent = "Saldo total: R$ 0,00";
      return;
    }

    snapshot.forEach(docSnap => {
      const c = docSnap.data();
      c.id = docSnap.id;
      contas.push(c);
    });

    // Aplica filtro PF/PJ
    const tipoFiltro = filtroTipoConta?.value || "";
    if (tipoFiltro) {
      contas = contas.filter(c => (c.tipo || "").toLowerCase() === tipoFiltro);
    }

    // Busca por nome
    const termoBusca = buscaConta?.value.trim().toLowerCase() || "";
    if (termoBusca) {
      contas = contas.filter(c => c.nome.toLowerCase().includes(termoBusca));
    }

    totalContasEl.textContent = `Total de contas: ${contas.length}`;

    for (const c of contas) {
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
        saldo += l.tipo === "receita" ? l.valor : -l.valor;
      });

      saldoTotal += saldo;

      const dataCriado = c.criadoEm
        ? new Date(c.criadoEm).toLocaleDateString("pt-BR", { timeZone: "UTC" })
        : "-";

      const tipoFormatado = c.tipo === "pf" ? "Pessoa Física"
                          : c.tipo === "pj" ? "Pessoa Jurídica"
                          : "—";

      const tr = document.createElement("tr");
      tr.classList.add("border-b");
      tr.innerHTML = `
        <td class="py-2">${c.nome}</td>
        <td>${tipoFormatado}</td>
        <td>${c.tipoConta || "—"}</td>
        <td>${dataCriado}</td>
        <td class="${saldo < 0 ? "text-red-600" : "text-green-600"} font-semibold">R$ ${saldo.toFixed(2)}</td>
        <td>
          <button class="btn-editar bg-yellow-400 text-white px-2 rounded mr-1" data-id="${c.id}">Editar</button>
          <button class="btn-excluir bg-red-500 text-white px-2 rounded" data-id="${c.id}" data-nome="${c.nome}">Excluir</button>
        </td>
      `;
      corpo.appendChild(tr);
    }

    totalSaldoEl.textContent = `Saldo total: R$ ${saldoTotal.toFixed(2)}`;

    // Botão excluir
    corpo.querySelectorAll(".btn-excluir").forEach(btn => {
      btn.addEventListener("click", async () => {
        const vinculos = await getDocs(query(collection(db, "lancamentos"), where("conta", "==", btn.dataset.nome)));
        if (!vinculos.empty) {
          return alert("Não é possível excluir: há lançamentos vinculados.");
        }
        if (confirm("Deseja excluir esta conta?")) {
          await deleteDoc(doc(db, "contas", btn.dataset.id));
          carregarContas();
        }
      });
    });

    // Botão editar
    corpo.querySelectorAll(".btn-editar").forEach(btn => {
      btn.addEventListener("click", async () => {
        const contaSnap = await getDocs(query(collection(db, "contas"), where("__name__", "==", btn.dataset.id)));
        if (!contaSnap.empty) {
          const c = contaSnap.docs[0].data();
          document.getElementById("nome-conta").value = c.nome;
          document.getElementById("titularidade").value = c.tipo || "";
          document.getElementById("tipo-conta").value = c.tipoConta || "";
          formConta.setAttribute("data-edit-id", btn.dataset.id);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      });
    });

  } catch (err) {
    console.error("Erro ao carregar contas:", err);
  }
}

// 📥 Salvar conta (nova ou edição)
formConta.addEventListener("submit", async function (e) {
  e.preventDefault();

  const nome = document.getElementById("nome-conta").value.trim();
  const tipo = document.getElementById("titularidade").value;
  const tipoConta = document.getElementById("tipo-conta").value;

  const novaConta = {
    nome,
    tipo,
    tipoConta,
    criadoEm: new Date().toISOString()
  };

  try {
    const editId = formConta.getAttribute("data-edit-id");
    if (editId) {
      await deleteDoc(doc(db, "contas", editId));
      await addDoc(collection(db, "contas"), novaConta);
      alert("Conta atualizada com sucesso!");
      formConta.removeAttribute("data-edit-id");
    } else {
      await addDoc(collection(db, "contas"), novaConta);
      alert("Conta salva com sucesso!");
    }
    this.reset();
    carregarContas();
  } catch (err) {
    console.error("Erro ao salvar conta:", err);
    alert("Erro ao salvar conta.");
  }
});

// 🎯 Filtros
if (filtroTipoConta) filtroTipoConta.addEventListener("change", carregarContas);
if (buscaConta) {
  buscaConta.addEventListener("input", () => {
    clearTimeout(buscaConta._debounce);
    buscaConta._debounce = setTimeout(carregarContas, 300);
  });
}

// ----------------------------------
// CATEGORIAS
// ----------------------------------

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

// 🚀 Inicialização
window.addEventListener("DOMContentLoaded", () => {
  carregarContas();
  carregarCategorias();
  const selectCategoria = document.getElementById("categoria-lancamento");
  if (selectCategoria) preencherCategorias(selectCategoria);
});

// Utilitário para preencher categorias em selects (se quiser usar fora)
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
