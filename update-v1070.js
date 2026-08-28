(()=>{
  'use strict';
  let latest='';
  function currentVersion(){
    const badge=document.getElementById('appVersionBadge');
    const txt=(badge?.textContent||document.title||'').match(/v?(\d+\.\d+\.\d+)/i);
    return txt?txt[1]:'0.0.0';
  }
  function parts(v){return String(v||'0.0.0').split('.').map(n=>Number(n)||0)}
  function newer(a,b){const A=parts(a),B=parts(b);for(let i=0;i<3;i++){if(A[i]>B[i])return true;if(A[i]<B[i])return false}return false}
  function banner(version){
    if(document.getElementById('isaUpdateBanner'))return;
    latest=version;
    const box=document.createElement('div');box.id='isaUpdateBanner';
    box.style.cssText='position:fixed;left:12px;right:12px;bottom:18px;z-index:10050;background:#0b2136;color:#fff;border:1px solid rgba(255,255,255,.2);border-radius:14px;padding:12px 14px;box-shadow:0 14px 40px rgba(0,0,0,.28);display:flex;align-items:center;justify-content:space-between;gap:12px;font:13px/1.35 Inter,Segoe UI,Arial,sans-serif';
    box.innerHTML=`<div><strong style="display:block">🚀 Nova versão disponível</strong><span style="opacity:.8">ISA v${version} já está online.</span></div><button type="button" style="border:0;border-radius:10px;background:#dfa82f;color:#0b2136;padding:9px 12px;font-weight:900;white-space:nowrap">Atualizar agora</button>`;
    box.querySelector('button').onclick=()=>{
      const u=new URL(location.href);u.searchParams.set('v',String(latest).replace(/\D/g,''));u.searchParams.set('_refresh',Date.now());location.replace(u.toString());
    };
    document.body.appendChild(box);
  }
  async function check(){
    try{
      const r=await fetch('VERSION.json?_='+Date.now(),{cache:'no-store'});if(!r.ok)return;
      const j=await r.json(),remote=String(j.version||'');const cur=currentVersion();
      if(remote&&newer(remote,cur))banner(remote);
    }catch(e){}
  }
  function boot(){setTimeout(check,1800);setInterval(check,10*60*1000);window.addEventListener('focus',check);document.addEventListener('visibilitychange',()=>{if(!document.hidden)check()})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
