// Menu responsivo, ano do rodapé e aviso de configuração do Firebase.
import { configurado } from "./firebase.js";

var botao = document.querySelector(".cabecalho__botao-menu");
var menu = document.querySelector(".cabecalho__menu");
if (botao && menu) {
  botao.addEventListener("click", function () {
    var aberto = menu.classList.toggle("cabecalho__menu--aberto");
    botao.setAttribute("aria-expanded", String(aberto));
  });
}
var ano = document.querySelector("[data-ano]");
if (ano) ano.textContent = new Date().getFullYear();

var avisoLocal = document.querySelector("[data-aviso-firebase]");
if (avisoLocal && !configurado) {
  avisoLocal.hidden = false;
  avisoLocal.innerHTML = "<strong>Firebase ainda não configurado.</strong> Abra <code>js/firebase.js</code>, cole as credenciais do seu projeto e recarregue (passo a passo no README.md).";
}
