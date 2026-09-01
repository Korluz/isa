(()=>{
  'use strict';
  const KEY='isa_release_notes_seen';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function appReady(){
    const auth=document.querySelector('.auth-screen');
    if(!auth)return true;
    const st=getComputedStyle(auth);
    return st.display==='none'||st.visibility==='hidden'||Number(st.opacity)===0;
  }
  function currentVersion(){
    const txt=(document.getElementById('appVersionBadge')?.textContent||document.title||'').match(/v?(\d+\.\d+\.\d+)/i);
    return txt?txt[1]:'';
  }
  function close(box,version){
    localStorage.setItem(KEY,version);
    box.classList.remove('open');
    setTimeout(()=>box.remove(),180);
  }
  function show(info){
    const version=String(info.version||currentVersion());
    if(!version||localStorage.getItem(KEY)===version||document.getElementById('isaReleaseNotes'))return;
    const features=(Array.isArray(info.features)?info.features:[]).slice(0,5);
    const overlay=document.createElement('div');overlay.id='isaReleaseNotes';overlay.innerHTML=`
      <style>
        #isaReleaseNotes{position:fixed;inset:0;z-index:12000;background:rgba(4,15,27,.52);display:flex;align-items:center;justify-content:center;padding:18px;opacity:0;transition:.18s ease;font-family:Inter,Segoe UI,Arial,sans-serif}
        #isaReleaseNotes.open{opacity:1}#isaReleaseNotes .rn-card{width:min(520px,100%);background:#fff;border-radius:22px;box-shadow:0 30px 90px rgba(0,0,0,.28);overflow:hidden;transform:translateY(12px) scale(.985);transition:.18s ease}
        #isaReleaseNotes.open .rn-card{transform:none}.rn-head{background:linear-gradient(135deg,#0b2136,#173f5e);color:#fff;padding:22px 22px 19px;position:relative}.rn-kicker{font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:#f1c758;font-weight:900}.rn-head h2{font-size:23px;margin:7px 0 4px}.rn-head p{margin:0;color:#c9d5df;font-size:13px;line-height:1.45}.rn-version{position:absolute;right:18px;top:18px;background:#dfa82f;color:#0b2136;border-radius:999px;padding:6px 9px;font-size:11px;font-weight:900}.rn-body{padding:20px 22px}.rn-list{display:grid;gap:10px}.rn-item{display:flex;gap:10px;align-items:flex-start;padding:11px 12px;background:#f6f8fb;border:1px solid #e2e8ef;border-radius:12px;color:#253447;font-size:13px;line-height:1.4}.rn-dot{width:23px;height:23px;border-radius:7px;background:#fff1c9;color:#8a5e00;display:grid;place-items:center;flex:0 0 auto;font-weight:900}.rn-actions{display:flex;justify-content:flex-end;padding-top:16px}.rn-btn{border:0;border-radius:11px;background:#dfa82f;color:#0b2136;padding:11px 16px;font-weight:900;cursor:pointer}
      </style>
      <div class="rn-card" role="dialog" aria-modal="true" aria-labelledby="rnTitle">
        <div class="rn-head"><div class="rn-kicker">✨ ISA atualizado</div><div class="rn-version">v${esc(version)}</div><h2 id="rnTitle">O que mudou</h2><p>${esc(info.release||'Uma nova versão do ISA já está ativa.')}</p></div>
        <div class="rn-body"><div class="rn-list">${features.length?features.map(f=>`<div class="rn-item"><span class="rn-dot">✓</span><span>${esc(f)}</span></div>`).join(''):'<div class="rn-item"><span class="rn-dot">✓</span><span>Melhorias e correções já estão disponíveis.</span></div>'}</div><div class="rn-actions"><button class="rn-btn" type="button">Entendi</button></div></div>
      </div>`;
    overlay.querySelector('.rn-btn').onclick=()=>close(overlay,version);
    overlay.addEventListener('click',e=>{if(e.target===overlay)close(overlay,version)});
    document.body.appendChild(overlay);requestAnimationFrame(()=>overlay.classList.add('open'));
  }
  async function boot(){
    try{
      const res=await fetch('VERSION.json?_='+Date.now(),{cache:'no-store'});if(!res.ok)return;
      const info=await res.json();
      const cur=currentVersion();if(!cur||String(info.version)!==cur)return;
      let tries=0;const wait=()=>{if(appReady())return setTimeout(()=>show(info),650);if(tries++<240)setTimeout(wait,500)};wait();
    }catch(e){console.warn('Release notes indisponíveis',e)}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,700));else setTimeout(boot,700);
})();
