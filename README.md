# Bairro em Dia

Plataforma de participação cidadã: moradores registram problemas urbanos (buracos, lixo, iluminação etc.), recebem um **protocolo único** e acompanham a resolução. Projeto do Trabalho Final de Programação Web Coding (AV2) — HTML5, CSS3 e Firebase Firestore (pontuação extra).

## Problema social e objetivo
Problemas urbanos ficam sem solução por falta de um canal simples e rastreável. O objetivo é permitir o registro com foto e endereço, gerar protocolo, mostrar o andamento em linha do tempo e oferecer indicadores à gestão.

## Tecnologias
HTML5 semântico · CSS3 (BEM, Flexbox, Grid, Media Queries) · JavaScript (módulos ES) · Firebase Firestore · ViaCEP (preenche o endereço pelo CEP).

## Estrutura
```
bairro-em-dia/
├── index.html  registrar.html  ocorrencias.html  acompanhar.html  sobre.html
├── css/style.css
├── js/ main.js · firebase.js · ocorrencias.js · formularios.js
├── images/ banner/ · ocorrencias/ · plataforma/ · dashboards/
├── firestore.rules
└── README.md
```

## Como executar
Os scripts usam módulos ES, que **não funcionam abrindo o arquivo direto (file://)**. No VS Code, instale a extensão **Live Server** e clique em *Go Live* em `index.html`.

## Configurar o Firebase (obrigatório para salvar e ler dados)
1. Acesse https://console.firebase.google.com e crie um projeto.
2. *Build > Firestore Database > Criar banco de dados* (modo de teste para desenvolvimento).
3. *Configurações do projeto > Seus apps > Web (`</>`)*: registre o app e copie o objeto `firebaseConfig`.
4. Cole os valores em `js/firebase.js` no lugar de `COLE_AQUI`.
5. Em *Firestore > Regras*, publique o conteúdo de `firestore.rules`.
6. Abra `ocorrencias.html`: com o banco vazio aparece o botão **Criar ocorrências de exemplo**.

**Plano B (sem conexão com o Firestore):** se o banco não responder (não criado, regras não publicadas, rede bloqueada), a ocorrência é guardada no `localStorage` do navegador, recebe protocolo normalmente e é enviada ao Firestore sozinha na próxima vez que a conexão funcionar. O motivo da falha aparece na tela e no Console (F12). `registrar.html` mostra o total de ocorrências e os protocolos registrados no aparelho.

**Fotos:** ficam no próprio documento do Firestore, reduzidas para até 900 px em JPEG (limite de 1 MB por documento). Não é usado o Firebase Storage.

**Atualizar situação:** abra `ocorrencias.html?gestor=1`, clique em *Ver detalhes* e escolha a nova situação. É um modo para demonstração: sem autenticação, qualquer pessoa com o link pode usá-lo. Para uso real, adicione Firebase Authentication e restrinja `update` nas regras.

## Onde está cada requisito
**Flexbox** (`display:flex`, `flex-direction`, `justify-content`, `align-items`, `flex-wrap`, `gap`): `.cabecalho__conteudo` e `.cabecalho__menu` (menu); `.passos` e `.passo` (cartões de informação); `.apresentacao` (imagem + texto em sobre.html); `.filtros`; `.rodape__conteudo`.

**Grid** (`display:grid`, `grid-template-columns`, `gap`, `repeat`, `minmax`, `auto-fit`/`auto-fill`, `grid-template-areas`): `.painel` (áreas nomeadas dos indicadores); `.categorias` (7 cartões, `auto-fit`); `.ocorrencias` (cards, `auto-fill`); `.formulario` (6 colunas); `.resultado`.

**Media Queries** (3 blocos `@media screen` no fim de `css/style.css`): `min-width:769px` (menu horizontal), `max-width:768px` (menu recolhido, painel 2 colunas, formulário em uma coluna lateral abaixo) e `max-width:480px` (tudo em 1 coluna, botões largos).

**BEM:** `.card`, `.card__imagem`, `.card__titulo`, `.card__rodape`; `.cabecalho__link--ativo`; `.indicador--resolvidas`; `.selo--pendente`; `.formulario__entrada--invalida`; `.linha-tempo__item--atual`.

**Firestore:** salvar (`salvarOcorrencia`), protocolo único (`gerarProtocolo`), listar, consultar por protocolo e atualizar situação — todos em `js/firebase.js`.

## Capturas de tela
Abra o site no Live Server, use o DevTools (F12 > modo dispositivo) nas larguras 375, 768 e 1366 px, salve as capturas em `docs/` e inclua aqui:
```
![375px](docs/375.png)  ![768px](docs/768.png)  ![1366px](docs/1366.png)
```

## Créditos das imagens
Banner (foto aérea, Pexels), ruas danificadas e lixo (portais de notícia/prefeitura), cidadão com aplicativo e dashboards (referências de terceiros). Confirme a fonte e a licença de cada arquivo e liste aqui os autores antes de publicar. `04_lixo_urbano.jpg` é um recorte de `02_buracos_e_lixo.webp`; `05` e `06` usam a mesma fotografia em recortes diferentes.
