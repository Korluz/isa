(()=>{
  'use strict';
  const digits=v=>String(v||'').replace(/\D/g,'').slice(0,11);
  const fmt=v=>{const d=digits(v);return d.length<=3?d:d.length<=6?`${d.slice(0,3)}.${d.slice(3)}`:d.length<=9?`${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`:`${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`};
  const bind=()=>{const e=document.getElementById('cpfConfirm');if(!e||e.dataset.masked1061)return;e.dataset.masked1061='1';e.maxLength=14;e.placeholder='000.000.000-00';e.addEventListener('input',()=>e.value=fmt(e.value));e.value=fmt(e.value)};
  new MutationObserver(bind).observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded',bind);setTimeout(bind,300);
})();
