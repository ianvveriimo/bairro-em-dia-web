// Validação, busca de CEP (ViaCEP), foto comprimida e envio ao Firestore.
import { configurado, salvarOcorrencia, listarOcorrencias, meusProtocolos, contarPendentes, erroRemoto } from "./firebase.js";

var form = document.getElementById("form-ocorrencia");
var campos = ["nome", "categoria", "titulo", "descricao", "cep", "rua", "bairro", "numero", "cidade", "estado", "foto"];
var fotoBase64 = "";

function el(id) { return document.getElementById(id); }
function erro(id, msg) {
  el(id).classList.toggle("formulario__entrada--invalida", !!msg);
  el("erro-" + id).textContent = msg || "";
}

function validar() {
  var ok = true;
  campos.forEach(function (id) {
    var c = el(id), msg = "";
    if (id === "foto") { if (!fotoBase64) msg = "Anexe uma fotografia do problema."; }
    else if (!c.value.trim()) msg = "Preencha este campo.";
    else if (id === "cep" && c.value.replace(/\D/g, "").length !== 8) msg = "O CEP deve ter 8 números.";
    else if (id === "estado" && !/^[A-Za-z]{2}$/.test(c.value.trim())) msg = "Use a sigla do estado (ex.: PI).";
    else if (id === "descricao" && c.value.trim().length < 15) msg = "Descreva com pelo menos 15 caracteres.";
    erro(id, msg);
    if (msg) ok = false;
  });
  return ok;
}

// Reduz a foto para caber no limite de 1 MB de um documento do Firestore.
function comprimir(arquivo) {
  return new Promise(function (resolve, reject) {
    var leitor = new FileReader();
    leitor.onerror = reject;
    leitor.onload = function () {
      var img = new Image();
      img.onerror = reject;
      img.onload = function () {
        var escala = Math.min(1, 900 / Math.max(img.width, img.height));
        var cv = document.createElement("canvas");
        cv.width = Math.round(img.width * escala); cv.height = Math.round(img.height * escala);
        cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
        resolve(cv.toDataURL("image/jpeg", 0.7));
      };
      img.src = leitor.result;
    };
    leitor.readAsDataURL(arquivo);
  });
}


/* ---------- Contador e "minhas ocorrências" ---------- */
var totalAtual = 0;
function dataHoraCurta(ms) { return new Date(ms).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }); }

function desenharMinhas() {
  var lista = meusProtocolos(), caixa = el("minhas"), ul = el("minhas-lista");
  el("contador-minhas").textContent = lista.length;
  caixa.hidden = lista.length === 0;
  ul.innerHTML = "";
  lista.slice(0, 5).forEach(function (m) {
    var li = document.createElement("li");
    var a = document.createElement("a");
    a.href = "acompanhar.html?protocolo=" + encodeURIComponent(m.protocolo);
    a.textContent = m.protocolo;
    li.appendChild(a);
    li.appendChild(document.createTextNode(" — " + dataHoraCurta(m.data) + (m.local ? " (aguardando envio ao banco)" : "")));
    ul.appendChild(li);
  });
}

async function atualizarContador(minimo) {
  // 1) mostra na hora o que já se sabe (inclusive o que está só neste navegador)...
  totalAtual = Math.max(totalAtual, minimo || 0, contarPendentes());
  el("contador-total").textContent = totalAtual;
  desenharMinhas();
  // 2) ...e corrige com o total real do banco assim que ele responder.
  try {
    var lista = await listarOcorrencias();
    totalAtual = Math.max(lista.length, minimo || 0);
  } catch (e) { /* mantém o valor local */ }
  el("contador-total").textContent = totalAtual;
  var motivo = erroRemoto(), a = el("aviso-conexao");
  a.hidden = !motivo;
  if (motivo) a.textContent = "Atenção: não foi possível conectar ao banco online (" + motivo + "). As ocorrências estão sendo guardadas neste navegador e serão enviadas quando a conexão voltar.";
  desenharMinhas();
}

el("foto").addEventListener("change", async function (ev) {
  var f = ev.target.files[0];
  fotoBase64 = "";
  el("previa").hidden = true;
  if (!f) return;
  if (f.type.indexOf("image/") !== 0) { erro("foto", "O arquivo precisa ser uma imagem."); return; }
  try {
    fotoBase64 = await comprimir(f);
    el("previa").src = fotoBase64; el("previa").hidden = false; erro("foto", "");
  } catch (e) { erro("foto", "Não foi possível ler a imagem."); }
});

el("cep").addEventListener("input", function (ev) {
  var n = ev.target.value.replace(/\D/g, "").slice(0, 8);
  ev.target.value = n.length > 5 ? n.slice(0, 5) + "-" + n.slice(5) : n;
});

el("cep").addEventListener("blur", async function () {
  var n = el("cep").value.replace(/\D/g, "");
  if (n.length !== 8) return;
  try {
    var r = await fetch("https://viacep.com.br/ws/" + n + "/json/");
    var d = await r.json();
    if (d.erro) { erro("cep", "CEP não encontrado. Preencha o endereço manualmente."); return; }
    el("rua").value = d.logradouro || el("rua").value; el("bairro").value = d.bairro || el("bairro").value;
    el("cidade").value = d.localidade || ""; el("estado").value = d.uf || "";
    erro("cep", "");
  } catch (e) { /* sem internet: o usuário preenche manualmente */ }
});

form.addEventListener("submit", async function (ev) {
  ev.preventDefault();
  var aviso = el("aviso-envio");
  aviso.hidden = true;
  if (!validar()) { form.querySelector(".formulario__entrada--invalida").focus(); return; }
  if (!configurado) { aviso.hidden = false; aviso.className = "aviso aviso--erro"; aviso.textContent = "Firebase não configurado: preencha js/firebase.js (veja o README)."; return; }
  var botao = el("enviar");
  botao.disabled = true; botao.textContent = "Enviando…";
  try {
    var r = await salvarOcorrencia({
      nome: el("nome").value.trim(), categoria: el("categoria").value, titulo: el("titulo").value.trim(),
      descricao: el("descricao").value.trim(), cep: el("cep").value, rua: el("rua").value.trim(),
      bairro: el("bairro").value.trim(), numero: el("numero").value.trim(), cidade: el("cidade").value.trim(),
      estado: el("estado").value.trim().toUpperCase(), foto: fotoBase64
    });
    form.hidden = true;
    el("protocolo-gerado").textContent = r.protocolo;
    el("link-acompanhar").href = "acompanhar.html?protocolo=" + encodeURIComponent(r.protocolo);
    var local = el("aviso-local");
    local.hidden = !r.local;
    if (r.local) local.textContent = "O banco online não respondeu (" + r.motivo + "). Sua ocorrência foi guardada neste navegador com o protocolo acima e será enviada automaticamente quando a conexão voltar. Anote o protocolo!";
    el("confirmacao").hidden = false;
    el("confirmacao").scrollIntoView({ behavior: "smooth" });
    atualizarContador(totalAtual + 1);
  } catch (e) {
    console.error("Erro ao salvar ocorrência:", e);
    aviso.hidden = false; aviso.className = "aviso aviso--erro";
    aviso.textContent = "Não foi possível enviar: " + e.message;
    botao.disabled = false; botao.textContent = "Enviar ocorrência";
  }
});

atualizarContador(0);

window.__bedPronto = true;
