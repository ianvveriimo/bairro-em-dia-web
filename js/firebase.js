// Conexão com o Firebase Firestore. Preencha firebaseConfig (veja o README.md).
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { initializeFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, arrayUnion }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const firebaseConfig = {
  apiKey: "AIzaSyDp402NceSncQ8cBISTNv44M6PoDCxkEhc",
  authDomain: "bairro-em-dia-ab3f2.firebaseapp.com",
  projectId: "bairro-em-dia-ab3f2",
  storageBucket: "bairro-em-dia-ab3f2.firebasestorage.app",
  messagingSenderId: "988417442030",
  appId: "1:988417442030:web:0e64dc4cf99d4440d473ff"
};

export const configurado = !Object.values(firebaseConfig).some(function (v) { return String(v).indexOf("COLE_AQUI") === 0; });
// experimentalAutoDetectLongPolling: evita que o envio fique "pendurado" em redes/antivírus/extensões que bloqueiam o canal padrão do Firestore.
const db = configurado ? initializeFirestore(initializeApp(firebaseConfig), { experimentalAutoDetectLongPolling: true }) : null;
const COLECAO = "ocorrencias";

export const SITUACOES = { pendente: "Pendente", analise: "Em análise", andamento: "Em andamento", resolvida: "Resolvida" };
export const CATEGORIAS = ["Buracos nas ruas", "Iluminação pública", "Limpeza urbana", "Esgoto a céu aberto", "Vazamentos", "Praças públicas", "Calçadas danificadas"];

// Evita ficar "Enviando…" para sempre e traduz o erro mais comum de permissão.
function comTempo(promessa) {
  var limite = new Promise(function (_, rejeitar) {
    setTimeout(function () { rejeitar(new Error("O Firestore não respondeu em 10 s. Confira se o banco foi criado (Build > Firestore Database > Criar banco de dados), se as regras foram publicadas e se há internet.")); }, 10000);
  });
  return Promise.race([promessa, limite]).catch(function (e) {
    if (e && e.code === "permission-denied") throw new Error("Permissão negada pelo Firestore. Publique as regras do arquivo firestore.rules na aba Regras do console.");
    throw e;
  });
}

function exigirBanco() {
  if (!db) throw new Error("Firebase não configurado. Preencha js/firebase.js (veja o README).");
}


/* ---------- Plano B: armazenamento local (localStorage) ----------
   Se o Firestore não responder, a ocorrência fica salva no navegador, ganha protocolo
   e aparece nas contagens. Ela é enviada ao Firestore automaticamente quando a conexão voltar. */
var CHAVE_PENDENTES = "bed_ocorrencias_pendentes";
var CHAVE_MINHAS = "bed_meus_protocolos";
var erroRemotoAtual = null;

function lsLer(chave) {
  try { var v = JSON.parse(localStorage.getItem(chave)); return Array.isArray(v) ? v : []; } catch (e) { return []; }
}
function lsGravar(chave, valor) {
  try { localStorage.setItem(chave, JSON.stringify(valor)); return true; } catch (e) { return false; }
}

// Quantas ocorrências estão guardadas só neste navegador (ainda não enviadas ao Firestore).
export function contarPendentes() { return lsLer(CHAVE_PENDENTES).length; }

// Motivo do último problema de conexão com o Firestore (ou null se está tudo certo).
export function erroRemoto() { return erroRemotoAtual; }

// Protocolos registrados neste aparelho (mais recentes primeiro).
export function meusProtocolos() { return lsLer(CHAVE_MINHAS); }
function lembrarProtocolo(protocolo, local) {
  var lista = lsLer(CHAVE_MINHAS).filter(function (m) { return m.protocolo !== protocolo; });
  lista.unshift({ protocolo: protocolo, data: Date.now(), local: !!local });
  lsGravar(CHAVE_MINHAS, lista.slice(0, 30));
}
function marcarEnviado(protocolo) {
  var lista = lsLer(CHAVE_MINHAS).map(function (m) { if (m.protocolo === protocolo) m.local = false; return m; });
  lsGravar(CHAVE_MINHAS, lista);
}

// Tenta enviar ao Firestore as ocorrências que ficaram só no navegador (roda em segundo plano).
async function sincronizarPendentes(remotas) {
  var existentes = {};
  remotas.forEach(function (o) { existentes[o.protocolo] = true; });
  var pendentes = lsLer(CHAVE_PENDENTES), enviados = [];
  for (var i = 0; i < pendentes.length; i++) {
    var o = pendentes[i];
    try {
      if (!existentes[o.protocolo]) {
        var limpo = Object.assign({}, o); delete limpo.local;
        await comTempo(setDoc(doc(db, COLECAO, o.protocolo), limpo));
      }
      lsGravar(CHAVE_PENDENTES, lsLer(CHAVE_PENDENTES).filter(function (x) { return x.protocolo !== o.protocolo; }));
      marcarEnviado(o.protocolo);
      var enviado = Object.assign({}, o); delete enviado.local;
      enviados.push(enviado);
    } catch (e) { return enviados; } // sem conexão/permissão: tenta de novo na próxima visita
  }
  return enviados;
}

function sufixoAleatorio() {
  var letras = "ABCDEFGHJKMNPQRSTUVWXYZ23456789", s = "";
  var bytes = crypto.getRandomValues(new Uint8Array(6));
  for (var i = 0; i < 6; i++) s += letras[bytes[i] % letras.length];
  return s;
}

// Protocolo único: o ID do documento é o próprio protocolo; repete até achar um livre.
export async function gerarProtocolo() {
  exigirBanco();
  for (var t = 0; t < 10; t++) {
    var p = "BED-" + new Date().getFullYear() + "-" + sufixoAleatorio();
    var existente = await comTempo(getDoc(doc(db, COLECAO, p)));
    if (!existente.exists()) return p;
  }
  throw new Error("Não foi possível gerar um protocolo único. Tente novamente.");
}

// Retorna { protocolo, local, motivo }. local=true quando só foi possível guardar no navegador.
export async function salvarOcorrencia(dados) {
  exigirBanco();
  var agora = Date.now();
  var base = Object.assign({}, dados, {
    situacao: "pendente",
    criadoEm: agora,
    historico: [{ situacao: "pendente", nota: "Ocorrência registrada pelo cidadão.", data: agora }]
  });
  try {
    var protocolo = await gerarProtocolo();
    await comTempo(setDoc(doc(db, COLECAO, protocolo), Object.assign({}, base, { protocolo: protocolo })));
    lembrarProtocolo(protocolo, false);
    erroRemotoAtual = null;
    return { protocolo: protocolo, local: false, motivo: null };
  } catch (e) {
    console.error("Firestore indisponível, salvando localmente:", e);
    var motivo = (e && e.message) || "falha desconhecida";
    var p = "BED-" + new Date().getFullYear() + "-" + sufixoAleatorio();
    var registro = Object.assign({}, base, { protocolo: p, local: true });
    var pendentes = lsLer(CHAVE_PENDENTES);
    pendentes.push(registro);
    if (!lsGravar(CHAVE_PENDENTES, pendentes)) {
      throw new Error(motivo + " (e o navegador não tem espaço para guardar a ocorrência localmente; tente uma foto menor)");
    }
    lembrarProtocolo(p, true);
    erroRemotoAtual = motivo;
    return { protocolo: p, local: true, motivo: motivo };
  }
}

export async function listarOcorrencias() {
  var remotas = [];
  erroRemotoAtual = null;
  if (db) {
    try {
      var snap = await comTempo(getDocs(collection(db, COLECAO)));
      snap.forEach(function (d) { remotas.push(d.data()); });
      var enviados = await sincronizarPendentes(remotas); // envia ao banco o que ficou só no navegador
      enviados.forEach(function (o) { if (!remotas.some(function (r) { return r.protocolo === o.protocolo; })) remotas.push(o); });
    } catch (e) { console.error("Erro ao listar do Firestore:", e); erroRemotoAtual = e.message; }
  }
  var jaTem = {};
  remotas.forEach(function (o) { jaTem[o.protocolo] = true; });
  var locais = lsLer(CHAVE_PENDENTES).filter(function (o) { return !jaTem[o.protocolo]; });
  return remotas.concat(locais).sort(function (a, b) { return b.criadoEm - a.criadoEm; });
}

export async function buscarPorProtocolo(protocolo) {
  var p = protocolo.trim().toUpperCase();
  var local = lsLer(CHAVE_PENDENTES).find(function (o) { return o.protocolo === p; });
  if (local) return local;
  exigirBanco();
  var snap = await comTempo(getDoc(doc(db, COLECAO, p)));
  return snap.exists() ? snap.data() : null;
}

export async function atualizarSituacao(protocolo, situacao, nota) {
  var pendentes = lsLer(CHAVE_PENDENTES), alvo = pendentes.find(function (o) { return o.protocolo === protocolo; });
  if (alvo) {
    alvo.situacao = situacao;
    alvo.historico.push({ situacao: situacao, nota: nota || "Situação atualizada.", data: Date.now() });
    lsGravar(CHAVE_PENDENTES, pendentes);
    return;
  }
  exigirBanco();
  await comTempo(updateDoc(doc(db, COLECAO, protocolo), {
    situacao: situacao,
    historico: arrayUnion({ situacao: situacao, nota: nota || "Situação atualizada.", data: Date.now() })
  }));
}

// Grava 3 ocorrências reais de demonstração no Firestore (usa as imagens da pasta images/).
export async function criarExemplos() {
  exigirBanco();
  var base = [
    { titulo: "Buracos e lixo na rua", categoria: "Buracos nas ruas", bairro: "Centro", rua: "Rua das Palmeiras", numero: "120", foto: "images/ocorrencias/02_buracos_e_lixo.webp", situacao: "analise", descricao: "Vários buracos no asfalto e galhos acumulados na calçada, dificultando a passagem de carros e pedestres." },
    { titulo: "Cratera em cruzamento", categoria: "Buracos nas ruas", bairro: "São José", rua: "Rua da Matriz", numero: "45", foto: "images/ocorrencias/03_rua_danificada.jpg", situacao: "andamento", descricao: "Buraco grande com água acumulada no cruzamento. Equipe já sinalizou com barreira de obras." },
    { titulo: "Entulho acumulado na esquina", categoria: "Limpeza urbana", bairro: "Novo Horizonte", rua: "Rua Dois", numero: "300", foto: "images/ocorrencias/04_lixo_urbano.jpg", situacao: "pendente", descricao: "Galhos, entulho e lixo descartados irregularmente há mais de uma semana." }
  ];
  for (var i = 0; i < base.length; i++) {
    var o = base[i], p = await gerarProtocolo(), t = Date.now() - (i + 1) * 86400000 * 2;
    var hist = [{ situacao: "pendente", nota: "Ocorrência registrada pelo cidadão.", data: t }];
    if (o.situacao !== "pendente") hist.push({ situacao: o.situacao, nota: "Situação atualizada pela equipe.", data: t + 86400000 });
    await setDoc(doc(db, COLECAO, p), Object.assign({ nome: "Exemplo", cep: "64180-000", cidade: "Esperantina", estado: "PI", protocolo: p, criadoEm: t, historico: hist }, o));
  }
}
