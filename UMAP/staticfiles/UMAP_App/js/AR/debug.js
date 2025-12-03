// Centralized debug helpers for AR app
(function(){
  if (window._AR_DEBUG) return;
  window._AR_DEBUG = {};
  function log(msg) { try { console.log('[AR_DBG]', msg); const a = document.getElementById('mobile-log-area'); if (a) { const el = document.createElement('div'); el.textContent = msg; a.appendChild(el); a.scrollTop = a.scrollHeight; } } catch(e) { console.log('[AR_DBG]', msg); } }
  function error(msg) { try { console.error('[AR_DBG]', msg); const a = document.getElementById('mobile-log-area'); if (a) { const el = document.createElement('div'); el.style.color='salmon'; el.textContent = 'ERROR: ' + (msg && msg.message ? msg.message : String(msg)); a.appendChild(el); a.scrollTop = a.scrollHeight; } } catch(e) { console.error('[AR_DBG]', msg); } }
  function info(msg) { log(msg); }
  function setStatus(text) { try { const s = document.getElementById('dbg-status'); if (s) s.textContent = text; else log(text); } catch(e){ log(text); } }
  window._AR_DEBUG.log = log; window._AR_DEBUG.error = error; window._AR_DEBUG.info = info; window._AR_DEBUG.setStatus = setStatus;
})();
