/* Árvores Urbanas — help.js
   "Como usar": manual em formato de mapa mental, "O que mudou" por versão e versão para imprimir (A4). */
(function (root) {
  'use strict';
  const AC = (root.AC = root.AC || {});
  const { esc, icon } = AC.ui;

  // Um ramo por assunto. Para cada versão nova: ajustar os textos e acrescentar em CHANGES.
  const BRANCHES = [
    { c: '#4f7d3a', t: 'Cadastrar uma árvore', l: [
      'Toque em <b>Nova árvore</b>.', 'Tire a foto na hora ou escolha uma da galeria.',
      'O GPS (ou a foto) já preenche coordenada, cidade, bairro e rua.', 'Digite o nome: o app sugere espécies. Se não souber, deixe em branco.',
      'Tudo é salvo sozinho, não tem botão “salvar”.'] },
    { c: '#c98a1a', t: 'Achar as árvores', l: [
      'Na tela inicial: <b>Cidades · Espécies · Bairros</b>.', 'Atalhos: <b>Favoritas</b>, <b>Com flores</b>, <b>Com frutos</b>.',
      '<b>Perto de mim</b> (menu ⋮) lista das mais próximas.', 'Dentro da cidade: Lista, Mapa e Números.', 'A lupa busca por espécie, rua ou bairro.'] },
    { c: '#b5533c', t: 'Voltar à mesma árvore', l: [
      'Abra a árvore e toque em <b>Nova visita</b>.', 'O app guarda o histórico: data, fotos, floração e frutos.',
      'Se você cadastrar uma árvore já registrada ali perto, ele avisa.'] },
    { c: '#2f7f86', t: 'Mapas e Google Earth', l: [
      'O mapa do app mostra seus pontos.', 'Em cada árvore: abrir no <b>Google Earth</b>, Google Maps, Waze ou app de mapas.',
      'Em <b>Exportar</b>: arquivo KMZ para o Earth, planilha e fotos.'] },
    { c: '#7a5aa6', t: 'Compartilhar', l: [
      'Na árvore: <b>Enviar a outra pessoa</b> gera um arquivo com fotos e coordenadas.',
      'Mande pelo WhatsApp (Meus Arquivos › Compartilhar).', 'A outra pessoa abre <b>Carimbo, backup e sobre › Restaurar</b>.',
      'Também dá para gerar a ficha em PDF.'] },
    { c: '#a63d5a', t: 'Backup (importante!)', l: [
      'Os dados ficam só no seu celular.', 'Faça backup de vez em quando: <b>Fazer agora</b> na tela inicial.',
      'Guarde o arquivo no Drive, OneDrive ou mande para você mesma.', 'Troca de celular? Restaure o backup no app novo.'] },
    { c: '#5b6b73', t: 'Instalar e usar sem internet', l: [
      'Android: menu do Chrome › <b>Instalar app</b>.', 'iPhone: Compartilhar › <b>Adicionar à Tela de Início</b>.',
      'Depois de instalado, funciona sem internet.', 'Cidade e bairro são descobertos quando a internet voltar.'] },
  ];
  const DONTS = ['Não apague o app sem fazer backup.', 'Não limpe os dados do navegador sem backup.', 'Não precisa ficar online para cadastrar.'];
  const CHANGES = [
    { v: 'V1', d: '10/10/2026', l: ['Primeira versão para compartilhar.', 'Cadastro com foto, GPS e carimbo na foto.', 'Cidades, Espécies, Bairros, Perto de mim, mapa e números.',
      'Histórico de visitas, aviso de árvore repetida, favoritas, flores e frutos.', 'Google Earth, KMZ, planilha, PDF e envio de árvore para outra pessoa.', 'Backup e restauração.'] },
  ];

  function mapHTML(print) {
    const br = BRANCHES.map((b) => '<div class="hp-b" style="--bc:' + b.c + '"><h3>' + b.t + '</h3><ul>' + b.l.map((x) => '<li>' + x + '</li>').join('') + '</ul></div>').join('');
    return '<div class="hp"><div class="hp-center"><b>Árvores Urbanas</b><small>caderno de campo · ' + esc(AC.VERSION) + '</small></div><div class="hp-grid">' + br + '</div>' +
      '<div class="hp-b hp-dont" style="--bc:#8a3b2e"><h3>Cuidados</h3><ul>' + DONTS.map((x) => '<li>' + x + '</li>').join('') + '</ul></div></div>';
  }
  function changesHTML() {
    return CHANGES.map((c) => '<div class="hp-ch"><h3>' + c.v + ' <small>' + c.d + '</small></h3><ul>' + c.l.map((x) => '<li>' + x + '</li>').join('') + '</ul></div>').join('');
  }

  function renderHelp() {
    const el = document.getElementById('app');
    el.innerHTML = AC.topBar('Como usar', 'Manual rápido', { back: true }) + '<main class="page">' + mapHTML() +
      '<section class="card"><h3>O que mudou</h3>' + changesHTML() + '</section>' +
      '<button class="btn block" data-act="help-print">' + icon('download') + ' Salvar manual em PDF (A4)</button>' +
      '<p class="credit">Criado por @paulapmiranda · © ' + new Date().getFullYear() + '</p></main>';
  }
  const actions = {
    'help-print': () => AC.more.printHTML('<div class="hp-print"><h1>Árvores Urbanas · como usar</h1><p class="sub">Criado por @paulapmiranda · © ' + new Date().getFullYear() + ' · ' + esc(AC.VERSION) + '</p>' + mapHTML(true) + '<h2>O que mudou</h2>' + changesHTML() + '</div>'),
  };
  AC.help = { renderHelp, actions };
})(typeof window !== 'undefined' ? window : globalThis);
