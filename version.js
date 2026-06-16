/* version.js — single source of truth for the displayed app version.
 * Keep in sync with package.json "version". Stamps the number (only) into any
 * element with class "app-version". */
(function () {
  var V = '1.0.2';
  if (typeof module !== 'undefined' && module.exports) { module.exports = V; return; }
  window.APP_VERSION = V;
  function stamp() {
    var els = document.querySelectorAll('.app-version');
    for (var i = 0; i < els.length; i++) els[i].textContent = V;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', stamp);
  else stamp();
})();
