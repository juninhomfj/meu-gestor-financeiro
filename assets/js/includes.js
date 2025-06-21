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

const THEMES = ['light', 'dark', 'darkblue'];

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);

  // Atualiza ícone/texto do botão
  const icon = document.getElementById('icon-theme');
  const label = document.getElementById('label-theme');
  if (icon && label) {
    if (theme === 'dark') {
      icon.textContent = '☀️';
      label.textContent = 'Modo Claro';
    } else if (theme === 'darkblue') {
      icon.textContent = '🌌';
      label.textContent = 'Dark Blue';
    } else {
      icon.textContent = '🌙';
      label.textContent = 'Modo Escuro';
    }
  }
}

function initThemeButton() {
  const btnToggle = document.getElementById('btn-toggle-theme');
  if (btnToggle) {
    btnToggle.addEventListener('click', () => {
      const current = localStorage.getItem('theme') || 'light';
      const idx = THEMES.indexOf(current);
      const next = THEMES[(idx + 1) % THEMES.length];
      setTheme(next);
    });
  }
  // Aplica o tema salvo ao abrir a página
  const saved = localStorage.getItem('theme') || 'light';
  setTheme(saved);
}

// Aguarda o header ser carregado no DOM
document.addEventListener('DOMContentLoaded', () => {
  const tryInit = () => {
    if (document.getElementById('btn-toggle-theme')) {
      initThemeButton();
    } else {
      setTimeout(tryInit, 100);
    }
  };
  tryInit();

  // Sincronizar tema entre abas
  window.addEventListener('storage', (e) => {
    if (e.key === 'theme') {
      setTheme(e.newValue);
    }
  });
});
