(()=>{
  'use strict';
  const E=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));

  function getTarget(){
    const box=E('adminSellerDetail');
    if(!box)return null;
    const anchor=box.querySelector('button[onclick*="adminSetUserStatus"]')||box.querySelector('button[onclick*="adminSetUserRole"]');
    if(!anchor)return null;
    const raw=anchor.getAttribute('onclick')||'';
    const m=raw.match(/adminSetUser(?:Status|Role)\('([^']+)'/);
    if(!m)return null;
    const name=(box.querySelector('h2')?.textContent||'esta conta').trim();
    return{id:m[1],name};
  }

  function enhanceAdmin(){
    const box=E('adminSellerDetail');
    if(!box||box.querySelector('.admin-account-lifecycle'))return;
    const target=getTarget();
    if(!target)return; // própria conta do admin não recebe ações destrutivas
    const host=box.querySelector('.admin-actions');
    if(!host)return;
    const wrap=document.createElement('div');
    wrap.className='admin-account-lifecycle';
    wrap.style.cssText='display:flex;gap:7px;flex-wrap:wrap;width:100%;margin-top:6px;padding-top:10px;border-top:1px solid var(--line)';
    wrap.innerHTML=`<button class="btn light sm" type="button" data-account-reset>↺ Resetar conta</button><button class="btn red sm" type="button" data-account-delete>🗑 Excluir conta</button><span class="admin-note" style="width:100%">Resetar mantém o login e zera os dados operacionais. Excluir remove o login e os dados vinculados.</span>`;
    wrap.querySelector('[data-account-reset]').onclick=()=>window.adminResetAccount(target.id,target.name);
    wrap.querySelector('[data-account-delete]').onclick=()=>window.adminDeleteAccount(target.id,target.name);
    host.appendChild(wrap);
  }

  async function rpc(name,id){
    const sb=window.ISA_SUPABASE;
    if(!sb)throw new Error('Supabase ainda não está conectado.');
    const{data,error}=await sb.rpc(name,{p_target:id});
    if(error)throw error;
    return data;
  }

  window.adminResetAccount=async function(id,name){
    if(!id)return;
    const label=name||'esta conta';
    if(!confirm(`Resetar ${label}?\n\nO login será mantido, mas vendas, configurações pessoais e solicitações de assinatura desta conta serão zeradas.`))return;
    try{
      await rpc('admin_reset_user_data',id);
      alert('Conta resetada. No próximo acesso, ela abrirá com os dados operacionais zerados.');
      if(typeof window.loadAdminPanel==='function')await window.loadAdminPanel(true);
    }catch(err){alert('Não foi possível resetar a conta: '+String(err?.message||err));}
  };

  window.adminDeleteAccount=async function(id,name){
    if(!id)return;
    const label=name||'esta conta';
    if(!confirm(`Excluir ${label}?\n\nIsso removerá o login e os dados vinculados. Essa ação não pode ser desfeita.`))return;
    if(!confirm(`Confirma a EXCLUSÃO DEFINITIVA de ${label}?`))return;
    try{
      await rpc('admin_delete_user_account',id);
      alert('Conta excluída. O mesmo e-mail poderá passar pelo fluxo de Criar conta novamente.');
      if(typeof window.loadAdminPanel==='function')await window.loadAdminPanel(true);
    }catch(err){alert('Não foi possível excluir a conta: '+String(err?.message||err));}
  };

  const observer=new MutationObserver(()=>enhanceAdmin());
  function boot(){
    const box=E('adminSellerDetail');
    if(box)observer.observe(box,{childList:true,subtree:true});
    document.addEventListener('click',e=>{if(e.target.closest?.('[data-view="admin"]'))setTimeout(enhanceAdmin,250)});
    enhanceAdmin();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
