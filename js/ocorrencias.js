// Listagem, filtros, detalhes, indicadores, últimas ocorrências e consulta por protocolo.
import { configurado, SITUACOES, erroRemoto, listarOcorrencias, buscarPorProtocolo, atualizarSituacao, criarExemplos } from "./firebase.js";

var pagina = document.body.dataset.pagina;
function esc(t) { var d = document.createElement("div"); d.textContent = t == null ? "" : String(t); return d.innerHTML; }
function data(ms) { return new Date(ms).toLocaleDateString("pt-BR"); }
function dataHora(ms) { return new Date(ms).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }); }
function selo(s) { return '<span class="selo selo--' + esc(s) + '">' + esc(SITUACOES[s] || s) + "</span>"; }

function card(o) {
  return '<article class="card">' +
    '<img class="card__imagem" src="' + esc(o.foto) + '" alt="Foto da ocorrência: ' + esc(o.titulo) + '" loading="lazy">' +
    '<div class="card__conteudo">' +
    '<p class="card__categoria">' + esc(o.categoria) + "</p>" +
    '<h3 class="card__titulo">' + esc(o.titulo) + "</h3>" +
    '<p class="card__meta">' + esc(o.bairro) + " · " + data(o.criadoEm) + "</p>" +
    '<div class="card__rodape">' + selo(o.situacao) +
    '<button class="botao botao--contorno botao--pequeno" type="button" data-detalhes="' + esc(o.protocolo) + '">Ver detalhes</button></div>' +
    "</div></article>";
}

async function carregar(alvo, aoSucesso) {
  if (!configurado) return;
  try {
    var lista = await listarOcorrencias();
    var aviso = document.querySelector("[data-aviso-firebase]"), motivo = erroRemoto();
    if (aviso && motivo) { aviso.hidden = false; aviso.textContent = "Não foi possível conectar ao banco online (" + motivo + "). Mostrando apenas as ocorrências guardadas neste navegador."; }
    return lista;
  }
  catch (e) { alvo.innerHTML = '<p class="aviso aviso--erro">Não foi possível carregar os dados: ' + esc(e.message) + "</p>"; }
}

/* ---------- Página inicial ---------- */
async function iniciarInicio() {
  var alvo = document.querySelector("[data-ultimas]");
  var lista = await carregar(alvo);
  if (!lista) { alvo.innerHTML = '<p class="vazio">Configure o Firebase para exibir as ocorrências.</p>'; return; }
  var n = function (f) { return lista.filter(f).length; };
  document.querySelector("[data-total]").textContent = lista.length;
  document.querySelector("[data-pendentes]").textContent = n(function (o) { return o.situacao === "pendente"; });
  document.querySelector("[data-andamento]").textContent = n(function (o) { return o.situacao === "analise" || o.situacao === "andamento"; });
  document.querySelector("[data-resolvidas]").textContent = n(function (o) { return o.situacao === "resolvida"; });
  alvo.innerHTML = lista.length ? lista.slice(0, 3).map(card).join("") : '<p class="vazio">Nenhuma ocorrência registrada ainda. Seja o primeiro a registrar!</p>';
  ligarDetalhes(lista, false);
}

/* ---------- Página de ocorrências ---------- */
var todas = [];
function aplicarFiltros() {
  var cat = document.getElementById("filtro-categoria").value;
  var sit = document.getElementById("filtro-situacao").value;
  var filtradas = todas.filter(function (o) { return (!cat || o.categoria === cat) && (!sit || o.situacao === sit); });
  var alvo = document.querySelector("[data-lista]");
  alvo.innerHTML = filtradas.length ? filtradas.map(card).join("") : '<p class="vazio">Nenhuma ocorrência encontrada com esses filtros.</p>';
  document.querySelector("[data-contagem]").textContent = filtradas.length + " ocorrência(s)";
}

async function iniciarOcorrencias() {
  var alvo = document.querySelector("[data-lista]");
  var lista = await carregar(alvo);
  if (!lista) return;
  todas = lista;
  document.getElementById("filtro-categoria").addEventListener("change", aplicarFiltros);
  document.getElementById("filtro-situacao").addEventListener("change", aplicarFiltros);
  var exemplos = document.querySelector("[data-exemplos]");
  exemplos.hidden = lista.length > 0;
  exemplos.querySelector("button").addEventListener("click", async function (ev) {
    ev.target.disabled = true;
    try { await criarExemplos(); location.reload(); }
    catch (e) { ev.target.disabled = false; alert("Erro ao criar exemplos: " + e.message + "\nVerifique as regras do Firestore (README)."); }
  });
  aplicarFiltros();
  ligarDetalhes(null, new URLSearchParams(location.search).get("gestor") === "1");
}

/* ---------- Detalhes + atualização de situação (modo gestor) ---------- */
function ligarDetalhes(listaFixa, comGestor) {
  var dlg = document.querySelector("[data-dialogo]");
  if (!dlg) return;
  document.addEventListener("click", async function (ev) {
    var b = ev.target.closest("[data-detalhes]");
    if (!b) return;
    var o = (listaFixa || todas).find(function (x) { return x.protocolo === b.dataset.detalhes; });
    if (!o) return;
    var opcoes = Object.keys(SITUACOES).map(function (k) { return '<option value="' + k + '"' + (k === o.situacao ? " selected" : "") + ">" + SITUACOES[k] + "</option>"; }).join("");
    var gestor = comGestor ? '<div class="detalhes__gestor"><strong>Atualizar situação (gestor)</strong>' +
      '<select class="formulario__entrada" id="nova-situacao" aria-label="Nova situação">' + opcoes + "</select>" +
      '<input class="formulario__entrada" id="nova-nota" type="text" placeholder="Observação para o histórico">' +
      '<button class="botao botao--primario botao--pequeno" type="button" id="salvar-situacao">Salvar situação</button></div>' : "";
    dlg.innerHTML = '<img class="detalhes__foto" src="' + esc(o.foto) + '" alt="Foto da ocorrência: ' + esc(o.titulo) + '">' +
      '<div class="detalhes__corpo"><p class="card__categoria">' + esc(o.categoria) + "</p><h2>" + esc(o.titulo) + "</h2>" + selo(o.situacao) +
      "<p><br>" + esc(o.descricao) + "</p>" +
      "<p><strong>Local:</strong> " + esc(o.rua) + ", " + esc(o.numero) + " — " + esc(o.bairro) + ", " + esc(o.cidade) + "/" + esc(o.estado) + "<br>" +
      "<strong>Registrada em:</strong> " + data(o.criadoEm) + "<br><strong>Protocolo:</strong> " + esc(o.protocolo) + "</p>" + gestor +
      '<p><br><a class="botao botao--contorno botao--pequeno" href="acompanhar.html?protocolo=' + encodeURIComponent(o.protocolo) + '">Acompanhar andamento</a> ' +
      '<button class="botao botao--primario botao--pequeno" type="button" data-fechar>Fechar</button></p></div>';
    dlg.showModal();
    var salvar = document.getElementById("salvar-situacao");
    if (salvar) salvar.addEventListener("click", async function () {
      salvar.disabled = true;
      try {
        await atualizarSituacao(o.protocolo, document.getElementById("nova-situacao").value, document.getElementById("nova-nota").value);
        location.reload();
      } catch (e) { salvar.disabled = false; alert("Erro ao atualizar: " + e.message); }
    });
  });
  dlg.addEventListener("click", function (ev) { if (ev.target === dlg || ev.target.hasAttribute("data-fechar")) dlg.close(); });
}

/* ---------- Acompanhar protocolo ---------- */
var ETAPAS = ["pendente", "analise", "andamento", "resolvida"];
function renderizarResultado(o) {
  var indice = ETAPAS.indexOf(o.situacao);
  var feitas = {};
  o.historico.forEach(function (h) { feitas[h.situacao] = h; });
  var etapas = ETAPAS.map(function (e, i) {
    var classe = i < indice ? " linha-tempo__item--feito" : i === indice ? " linha-tempo__item--feito linha-tempo__item--atual" : "";
    var h = feitas[e];
    return '<li class="linha-tempo__item' + classe + '"><span class="linha-tempo__titulo">' + SITUACOES[e] + "</span>" +
      (h ? '<span class="linha-tempo__data">' + dataHora(h.data) + " — " + esc(h.nota) + "</span>" : '<span class="linha-tempo__data">Aguardando</span>') + "</li>";
  }).join("");
  return '<div class="resultado__bloco"><img class="resultado__foto" src="' + esc(o.foto) + '" alt="Foto da ocorrência ' + esc(o.protocolo) + '">' +
    '<dl class="resultado__lista"><dt>Protocolo</dt><dd>' + esc(o.protocolo) + "</dd><dt>Título</dt><dd>" + esc(o.titulo) + "</dd>" +
    "<dt>Descrição</dt><dd>" + esc(o.descricao) + "</dd><dt>Localização</dt><dd>" + esc(o.rua) + ", " + esc(o.numero) + " — " + esc(o.bairro) + ", " + esc(o.cidade) + "/" + esc(o.estado) + "</dd>" +
    "<dt>Data</dt><dd>" + data(o.criadoEm) + "</dd><dt>Categoria</dt><dd>" + esc(o.categoria) + "</dd><dt>Situação</dt><dd>" + selo(o.situacao) + "</dd></dl></div>" +
    '<div class="resultado__bloco"><h2>Linha do tempo</h2><ol class="linha-tempo">' + etapas + "</ol></div>";
}

async function consultar(protocolo) {
  var saida = document.querySelector("[data-resultado]");
  if (!configurado) return;
  if (!protocolo.trim()) { saida.innerHTML = '<p class="aviso aviso--erro">Digite o número do protocolo.</p>'; return; }
  saida.innerHTML = "<p>Consultando…</p>";
  try {
    var o = await buscarPorProtocolo(protocolo);
    saida.innerHTML = o ? renderizarResultado(o) : '<p class="aviso aviso--erro">Nenhuma ocorrência encontrada para este protocolo. Confira o código e tente de novo.</p>';
  } catch (e) { saida.innerHTML = '<p class="aviso aviso--erro">Erro na consulta: ' + esc(e.message) + "</p>"; }
}

function iniciarAcompanhar() {
  var form = document.querySelector("[data-consulta]");
  var campo = document.getElementById("protocolo");
  form.addEventListener("submit", function (ev) { ev.preventDefault(); consultar(campo.value); });
  var param = new URLSearchParams(location.search).get("protocolo");
  if (param) { campo.value = param; consultar(param); }
}

if (pagina === "inicio") iniciarInicio();
if (pagina === "ocorrencias") iniciarOcorrencias();
if (pagina === "acompanhar") iniciarAcompanhar();
