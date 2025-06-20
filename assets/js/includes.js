async function incluir(id, arquivo) {
  const container = document.getElementById(id);
  if (container) {
    const resposta = await fetch(arquivo);
    const html = await resposta.text();
    container.innerHTML = html;
  }
}

window.addEventListener("DOMContentLoaded", () => {
  incluir("menu-container", "partials/menu.html");
  incluir("header-container", "partials/header.html");
  incluir("footer-container", "partials/footer.html");
});
