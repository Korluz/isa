(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis,function(root){
  'use strict';

  const VERSION='11.0.12';
  const PASSWORD_MIN_LENGTH=8;
  const REGISTER_COOLDOWN_KEY='isa_register_cooldown_until_v11012';
  let registerBusy=false;
  let loginBusy=false;
  let registrationCompleted=false;
  let passwordTarget=null;
  let passwordBusy=false;
  let cooldownTimer=null;

  function friendlyAuthError(error,context='login'){
    const code=String(error?.code||'').toLowerCase();
    const raw=String(error?.message||error||'').trim();
    if(code==='invalid_credentials'||/invalid login credentials/i.test(raw))return'E-mail ou senha não conferem. Confira os dados ou use “Esqueci minha senha”.';
    if(code==='email_not_confirmed'||/email not confirmed/i.test(raw))return'Seu e-mail ainda não foi confirmado. Abra a mensagem de confirmação mais recente antes de entrar.';
    if(code==='over_email_send_rate_limit'||/email rate limit|rate limit exceeded/i.test(raw))return'O limite temporário de e-mails foi atingido. Aguarde uma hora antes de tentar novamente e não repita o clique.';
    if(code==='over_request_rate_limit'||/too many requests/i.test(raw))return'Muitas tentativas em pouco tempo. Aguarde alguns minutos antes de tentar novamente.';
    if(code==='weak_password'||/password.*weak/i.test(raw))return'A senha escolhida é muito fraca. Use pelo menos 8 caracteres, com letras e números.';
    if(code==='user_already_exists'||/already registered|already exists/i.test(raw))return'Este e-mail já possui conta. Use “Entrar” ou “Esqueci minha senha”.';
    if(code==='signup_disabled')return'A criação de novas contas está temporariamente desativada.';
    if(code==='unexpected_failure'&&context==='register')return'O cadastro encontrou uma tentativa duplicada. Aguarde um minuto, atualize a página e tente apenas uma vez.';
    return raw||'Não foi possível concluir a autenticação agora.';
  }

  function validateAdminPassword(password){
    if(typeof password!=='string'||password.length<PASSWORD_MIN_LENGTH)return`A senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`;
    if(!/\p{L}/u.test(password)||!/\d/.test(password))return'A senha deve conter pelo menos uma letra e um número.';
    if(password.length>72)return'A senha deve ter no máximo 72 caracteres.';
    return'';
  }

  const api={VERSION,PASSWORD_MIN_LENGTH,friendlyAuthError,validateAdminPassword};
  if(!root?.document)return api;

  const document=root.document;
  const el=id=>document.getElementById(id);
  const authMessage=(text,ok=false)=>{const box=el('authMessage');if(box){box.textContent=text;box.style.color=ok?'#15803d':'var(--danger,#bf2433)'}};
  const getClient=()=>root.ISA_SUPABASE||root.__ISA_AUTH_FALLBACK_SB||null;

  function buttonFor(pane){return document.querySelector(`#${pane} .auth-submit`)}
  function setBusy(button,busy,label){
    if(!button)return;
    if(!button.dataset.idleLabel)button.dataset.idleLabel=button.textContent.trim();
    button.disabled=busy;
    button.textContent=busy?label:button.dataset.idleLabel;
  }
  function isRateLimit(error){return String(error?.code||'')==='over_email_send_rate_limit'||/email rate limit|rate limit exceeded/i.test(String(error?.message||error||''))}

  function applyRegisterCooldown(){
    clearTimeout(cooldownTimer);
    const button=buttonFor('registerPane');
    const until=Number(root.localStorage?.getItem(REGISTER_COOLDOWN_KEY)||0);
    const remaining=until-Date.now();
    if(remaining<=0){
      root.localStorage?.removeItem(REGISTER_COOLDOWN_KEY);
      if(!registerBusy&&!registrationCompleted)setBusy(button,false,'');
      return;
    }
    const minutes=Math.ceil(remaining/60000);
    if(button){button.disabled=true;button.textContent=`Aguarde ${minutes} min`;}
    cooldownTimer=setTimeout(applyRegisterCooldown,Math.min(30000,remaining));
  }

  root.registerLocal=async function(){
    if(registerBusy||registrationCompleted)return;
    const cooldownUntil=Number(root.localStorage?.getItem(REGISTER_COOLDOWN_KEY)||0);
    if(cooldownUntil>Date.now())return applyRegisterCooldown();
    const client=getClient();
    if(!client)return authMessage('Não foi possível iniciar a conexão com o Supabase. Atualize a página.');
    const fullName=(el('registerName')?.value||'').trim();
    const email=(el('registerEmail')?.value||'').trim().toLowerCase();
    const password=el('registerPassword')?.value||'';
    const confirmation=el('registerConfirm')?.value||'';
    if(!fullName||!email||password.length<6)return authMessage('Preencha nome, e-mail e senha com ao menos 6 caracteres.');
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return authMessage('Confira se o e-mail foi digitado corretamente.');
    if(password!==confirmation)return authMessage('As senhas não conferem.');
    registerBusy=true;
    const button=buttonFor('registerPane');
    setBusy(button,true,'Criando conta...');
    authMessage('Criando sua conta. Aguarde...',true);
    try{
      const redirect=root.location.origin+root.location.pathname+'?confirmed=1';
      const{data,error}=await client.auth.signUp({email,password,options:{data:{full_name:fullName},emailRedirectTo:redirect}});
      if(error){
        authMessage(friendlyAuthError(error,'register'));
        if(isRateLimit(error))root.localStorage?.setItem(REGISTER_COOLDOWN_KEY,String(Date.now()+60*60*1000));
        else if(String(error.code||'')==='unexpected_failure')root.localStorage?.setItem(REGISTER_COOLDOWN_KEY,String(Date.now()+60*1000));
        registerBusy=false;
        applyRegisterCooldown();
        return;
      }
      registrationCompleted=true;
      authMessage(data?.session?'Conta criada e conectada.':'Conta criada. Confirme o e-mail mais recente antes de entrar.',true);
      if(button){button.disabled=true;button.textContent=data?.session?'Conta criada':'E-mail enviado';}
    }catch(error){
      authMessage(friendlyAuthError(error,'register'));
      registerBusy=false;
      setBusy(button,false,'');
    }
  };

  root.loginLocal=async function(){
    if(loginBusy)return;
    const client=getClient();
    if(!client)return authMessage('Não foi possível iniciar a conexão com o Supabase. Atualize a página.');
    const email=(el('loginEmail')?.value||'').trim().toLowerCase();
    const password=el('loginPassword')?.value||'';
    if(!email||!password)return authMessage('Informe e-mail e senha.');
    loginBusy=true;
    const button=buttonFor('loginPane');
    setBusy(button,true,'Entrando...');
    authMessage('Conferindo seus dados...',true);
    try{
      const{error}=await client.auth.signInWithPassword({email,password});
      if(error){authMessage(friendlyAuthError(error,'login'));loginBusy=false;setBusy(button,false,'');return;}
      authMessage('Login confirmado. Abrindo o ISA...',true);
    }catch(error){
      authMessage(friendlyAuthError(error,'login'));
      loginBusy=false;
      setBusy(button,false,'');
    }
  };

  function addPasswordToggle(input){
    if(!input||input.closest('.isa-password-wrap'))return;
    const wrap=document.createElement('div');wrap.className='isa-password-wrap';
    input.parentNode.insertBefore(wrap,input);wrap.appendChild(input);
    const button=document.createElement('button');button.type='button';button.className='isa-password-toggle';button.textContent='Mostrar';button.setAttribute('aria-label','Mostrar senha');
    button.onclick=()=>{const show=input.type==='password';input.type=show?'text':'password';button.textContent=show?'Ocultar':'Mostrar';button.setAttribute('aria-label',show?'Ocultar senha':'Mostrar senha')};
    wrap.appendChild(button);
  }

  function createAdminPasswordModal(){
    if(el('adminPasswordModal'))return;
    const modal=document.createElement('div');modal.id='adminPasswordModal';modal.className='modalback';
    modal.innerHTML=`<div class="modal isa-admin-password-modal"><div class="modalhead"><h2 style="margin:0">Alterar senha do usuário</h2><button class="close" type="button" data-close-admin-password>✕</button></div><div class="modalbody"><div class="quick-warning"><strong id="adminPasswordTargetName">Usuário</strong><br>O administrador não vê a senha atual. Esta operação apenas define uma nova senha e não envia e-mail.</div><div class="field" style="margin-top:14px"><label>Nova senha</label><input id="adminPasswordNew" type="password" minlength="8" maxlength="72" autocomplete="new-password"></div><div class="field" style="margin-top:10px"><label>Confirmar nova senha</label><input id="adminPasswordConfirm" type="password" minlength="8" maxlength="72" autocomplete="new-password"></div><div id="adminPasswordMessage" class="auth-message" aria-live="polite"></div></div><div class="modalfoot"><button class="btn light" type="button" data-close-admin-password>Cancelar</button><button class="btn gold" id="adminPasswordSave" type="button">Salvar nova senha</button></div></div>`;
    document.body.appendChild(modal);
    modal.querySelectorAll('[data-close-admin-password]').forEach(button=>button.onclick=closeAdminPasswordModal);
    modal.addEventListener('click',event=>{if(event.target===modal)closeAdminPasswordModal()});
    el('adminPasswordSave').onclick=saveAdminPassword;
    addPasswordToggle(el('adminPasswordNew'));addPasswordToggle(el('adminPasswordConfirm'));
  }

  function adminPasswordMessage(text,ok=false){const box=el('adminPasswordMessage');if(box){box.textContent=text;box.style.color=ok?'#15803d':'var(--danger,#bf2433)'}}
  function closeAdminPasswordModal(){
    if(passwordBusy)return;
    el('adminPasswordModal')?.classList.remove('open');
    if(el('adminPasswordNew'))el('adminPasswordNew').value='';
    if(el('adminPasswordConfirm'))el('adminPasswordConfirm').value='';
    adminPasswordMessage('');passwordTarget=null;
  }
  root.closeAdminPasswordModal=closeAdminPasswordModal;

  function openAdminPasswordModal(target){
    createAdminPasswordModal();passwordTarget=target;
    el('adminPasswordTargetName').textContent=target.name||'Usuário';
    el('adminPasswordModal').classList.add('open');
    adminPasswordMessage('Use pelo menos 8 caracteres, com letras e números.');
    setTimeout(()=>el('adminPasswordNew')?.focus(),0);
  }

  async function functionErrorMessage(error){
    try{
      if(error?.context&&typeof error.context.json==='function'){
        const payload=await error.context.json();
        if(payload?.error)return payload.error;
      }
    }catch(_){/* resposta sem JSON */}
    return String(error?.message||error||'Não foi possível alterar a senha.');
  }

  async function saveAdminPassword(){
    if(passwordBusy||!passwordTarget)return;
    const password=el('adminPasswordNew')?.value||'';
    const confirmation=el('adminPasswordConfirm')?.value||'';
    const validation=validateAdminPassword(password);
    if(validation)return adminPasswordMessage(validation);
    if(password!==confirmation)return adminPasswordMessage('As senhas não conferem.');
    if(!root.confirm(`Alterar a senha de ${passwordTarget.name||'este usuário'}?`))return;
    const client=getClient();if(!client)return adminPasswordMessage('Supabase ainda não está conectado.');
    passwordBusy=true;const button=el('adminPasswordSave');setBusy(button,true,'Alterando...');adminPasswordMessage('Alterando a senha com segurança...',true);
    try{
      const{data,error}=await client.functions.invoke('admin-set-user-password',{body:{target_user_id:passwordTarget.id,password}});
      if(error)throw new Error(await functionErrorMessage(error));
      if(!data?.ok)throw new Error(data?.error||'Não foi possível alterar a senha.');
      const note=data.email_confirmed===false?' A conta ainda precisa confirmar o e-mail antes do login.':'';
      root.alert(`Senha alterada com sucesso.${note}`);
      passwordBusy=false;setBusy(button,false,'');closeAdminPasswordModal();
    }catch(error){
      adminPasswordMessage(String(error?.message||error||'Não foi possível alterar a senha.'));
      passwordBusy=false;setBusy(button,false,'');
    }
  }

  function getAdminTarget(){
    const box=el('adminSellerDetail');if(!box)return null;
    const anchor=box.querySelector('button[onclick*="adminSetUserStatus"]')||box.querySelector('button[onclick*="adminSetUserRole"]');
    if(!anchor)return null;
    const match=(anchor.getAttribute('onclick')||'').match(/adminSetUser(?:Status|Role)\('([^']+)'/);
    if(!match)return null;
    return{id:match[1],name:(box.querySelector('h2')?.textContent||'Usuário').trim()};
  }

  function enhanceAdminPassword(){
    if(root.ISA_ROLE!=='admin')return;
    const box=el('adminSellerDetail');if(!box||box.querySelector('[data-admin-password]'))return;
    const target=getAdminTarget();if(!target)return;
    const host=box.querySelector('.admin-actions');if(!host)return;
    const button=document.createElement('button');button.type='button';button.className='btn light sm';button.dataset.adminPassword='';button.textContent='🔑 Alterar senha';button.onclick=()=>openAdminPasswordModal(target);host.appendChild(button);
  }

  function install(){
    ['loginPassword','registerPassword','registerConfirm','newPassword','newPasswordConfirm'].forEach(id=>addPasswordToggle(el(id)));
    const style=document.createElement('style');style.textContent='.isa-password-wrap{position:relative}.isa-password-wrap input{width:100%;padding-right:70px}.isa-password-toggle{position:absolute;right:8px;top:50%;transform:translateY(-50%);border:0;background:transparent;color:#315b79;font-size:11px;font-weight:800;cursor:pointer}.isa-password-toggle:focus-visible{outline:2px solid var(--gold);border-radius:5px}.isa-admin-password-modal{max-width:520px}.auth-submit:disabled,#adminPasswordSave:disabled{opacity:.65;cursor:not-allowed}';document.head.appendChild(style);
    createAdminPasswordModal();applyRegisterCooldown();enhanceAdminPassword();
    const box=el('adminSellerDetail');if(box)new MutationObserver(enhanceAdminPassword).observe(box,{childList:true,subtree:true});
    document.addEventListener('click',event=>{if(event.target.closest?.('[data-view="admin"]'))setTimeout(enhanceAdminPassword,250)});
  }

  root.ISA_AUTH_HOTFIX=api;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
  return api;
});
