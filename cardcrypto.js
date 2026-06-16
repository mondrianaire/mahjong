/* Generic WebCrypto decrypt for the password-locked card blob. No card data, no password. */
(function (root) {
  'use strict';
  var enc = new TextEncoder(), dec = new TextDecoder();
  function ub64(s) { var b = atob(s), a = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; }
  async function deriveKey(pw, salt, iter, hash) {
    var base = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt, iterations: iter, hash: hash }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  }
  async function decrypt(blob, pw) {
    var key = await deriveKey(pw, ub64(blob.salt), blob.iter, blob.hash);
    var pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ub64(blob.iv) }, key, ub64(blob.ct));
    return dec.decode(pt);
  }
  root.CardCrypto = { decrypt: decrypt };
})(typeof window !== 'undefined' ? window : this);
