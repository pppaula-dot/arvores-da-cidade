/* Árvores Urbanas — site: monta textos e galeria a partir de conteudo.js. */
(function () {
  'use strict';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var tag = '<span class="exemplo">exemplo</span>';
  var arv = window.ARVORES || [], fotos = window.FOTOS || [];
  document.getElementById('lista-arvores').innerHTML = arv.length ? arv.map(function (a) {
    return '<article><h3>' + esc(a.nome) + ' ' + (a.exemplo ? tag : '') + '</h3>' + (a.cient ? '<span class="cient">' + esc(a.cient) + '</span>' : '') + '<p>' + esc(a.texto) + '</p></article>';
  }).join('') : '<p class="nota">Os primeiros textos chegam em breve.</p>';
  var folha = '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 6c14 10 20 22 14 36-4 9-11 14-14 16-3-2-10-7-14-16C12 28 18 16 32 6z" fill="#4f7a3b"/><path d="M32 14v46" stroke="#fffaf0" stroke-width="2.5" fill="none"/></svg>';
  var rots = ['-1.5deg', '1deg', '-0.5deg', '1.5deg'];
  document.getElementById('lista-fotos').innerHTML = fotos.length ? fotos.map(function (f, i) {
    var img = f.arquivo ? '<img src="' + esc(f.arquivo) + '" alt="' + esc(f.arvore) + ', foto de ' + esc(f.autor) + '" loading="lazy">' : '<div class="foto">' + folha + '</div>';
    return '<figure style="--r:' + rots[i % rots.length] + '">' + img + '<figcaption><b>' + esc(f.arvore) + ' ' + (f.exemplo ? tag : '') + '</b>Foto: ' + esc(f.autor) + '<br>' + esc(f.lugar) + (f.data ? ' · ' + esc(f.data) : '') + '</figcaption></figure>';
  }).join('') : '<p class="nota">As primeiras fotos chegam em breve.</p>';

  var b = document.getElementById('copiar'), frase = document.getElementById('frase');
  b.addEventListener('click', function () {
    function ok() { b.textContent = 'Frase copiada'; setTimeout(function () { b.textContent = 'Copiar a frase'; }, 2500); }
    function sel() { var r = document.createRange(); r.selectNodeContents(frase); var s = getSelection(); s.removeAllRanges(); s.addRange(r); b.textContent = 'Frase selecionada: toque em Copiar'; }
    try { navigator.clipboard.writeText(frase.textContent).then(ok, sel); } catch (e) { sel(); }
  });

  // Botão de instalar, quando o navegador oferece (Chrome no Android e no computador).
  var pedido = null, inst = document.getElementById('instalar');
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); pedido = e; inst.hidden = false; });
  inst.addEventListener('click', function () { if (!pedido) return; pedido.prompt(); pedido.userChoice.then(function () { pedido = null; inst.hidden = true; }, function () {}); });

  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(function () {});
})();
