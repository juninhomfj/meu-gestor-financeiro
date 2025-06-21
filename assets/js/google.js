// assets/js/google.js

// Configurações do seu projeto Google Cloud
const CLIENT_ID = "813088641053-8u4q897ss0lhhi9rmnscphahr402lfga.apps.googleusercontent.com";
const SCOPES = "https://www.googleapis.com/auth/calendar.events";
let tokenClient;
let gapiIniciado = false;

// Carregar a biblioteca da Google API
function carregarBibliotecasGoogle() {
  return new Promise((resolve) => {
    if (window.gapi && window.google) return resolve();
    const script1 = document.createElement("script");
    script1.src = "https://accounts.google.com/gsi/client";
    script1.onload = () => {
      const script2 = document.createElement("script");
      script2.src = "https://apis.google.com/js/api.js";
      script2.onload = resolve;
      document.body.appendChild(script2);
    };
    document.body.appendChild(script1);
  });
}

// Inicializar GAPI
function inicializarGapi() {
  return new Promise((resolve) => {
    gapi.load("client", async () => {
      await gapi.client.init({});
      gapiIniciado = true;
      resolve();
    });
  });
}

// Inicializar autenticação
async function autenticarGoogle() {
  if (!gapiIniciado) await inicializarGapi();

  return new Promise((resolve, reject) => {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (tokenResponse) => {
        if (tokenResponse?.access_token) {
          gapi.client.setToken(tokenResponse);
          resolve();
        } else {
          reject("Falha na autenticação.");
        }
      },
    });

    tokenClient.requestAccessToken();
  });
}

// Função para criar evento no Google Agenda
export async function criarEventoGoogleAgenda(dados) {
  try {
    await carregarBibliotecasGoogle();
    await autenticarGoogle();

    const dataEvento = new Date(dados.data);
    const dataFim = new Date(dataEvento);
    dataFim.setHours(dataEvento.getHours() + 1);

    const evento = {
      summary: `${dados.tipo.toUpperCase()} - ${dados.descricao}`,
      description: `Valor: R$ ${dados.valor.toFixed(2)}\nConta: ${dados.conta}\nCategoria: ${dados.categoria}`,
      start: { dateTime: dataEvento.toISOString(), timeZone: "America/Sao_Paulo" },
      end: { dateTime: dataFim.toISOString(), timeZone: "America/Sao_Paulo" },
    };

    await gapi.client.load("calendar", "v3");
    const request = gapi.client.calendar.events.insert({ calendarId: "primary", resource: evento });
    const response = await request;
    console.log("Evento criado:", response);
    alert("✅ Evento adicionado ao Google Agenda!");
  } catch (err) {
    console.error("Erro ao criar evento na Agenda:", err);
    alert("❌ Não foi possível adicionar ao Google Agenda.");
  }
}

// Carregar as bibliotecas quando a página carregar
window.addEventListener("DOMContentLoaded", carregarBibliotecasGoogle);
