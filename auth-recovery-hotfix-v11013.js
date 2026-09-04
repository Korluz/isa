(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root?.document)api.install(root);
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';

  const VERSION='11.0.13';
  const COOLDOWN_MS=60*60*1000;
  const RETRY_COOLDOWN_MS=60*1000;
  const COOLDOWN_KEY='isa_password_recovery_cooldown_until_v11013';

  function normalizeEmail(value){return String(value||'').trim().toLowerCase()}
  function isValidEmail(value){return/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value))}
  function isRateLimit(error){
    const code=String(error?.code||'').toLowerCase();
    const raw=String(error?.message||error||'');
    return code==='over_email_send_rate_limit'||code==='over_request_rate_limit'||/rate limit|too many requests/i.test(raw);
  }
  function friendlyRecoveryError(error){
    const raw=String(error?.message||error||'').trim();
    if(isRateLimit(error))return'O limite temporário de e-mails foi atingido. Aguarde uma hora antes de solicitar outro link.';
    if(/redirect/i.test(raw))return'A URL de recuperação foi recusada. Avise o administrador da plataforma.';
    if(/email/i.test(raw)&&/invalid/i.test(raw))return'Confira se o e-mail informado está correto.';
    return'Não foi possível solicitar a recuperação agora. Aguarde um momento e tente novamente.';
  }

  function createRecoveryGuard({send,storage=null,now=()=>Date.now(),cooldownMs=COOLDOWN_MS,retryCooldownMs=RETRY_COOLDOWN_MS,cooldownKey=COOLDOWN_KEY}){
    if(typeof send!=='function')throw new TypeError('send deve ser uma função');
    let busy=false;
    let completed=false;
    let memoryCooldownUntil=0;

    function cooldownUntil(){
      try{
        const stored=Number(storage?.getItem(cooldownKey)||0);
        return Math.max(memoryCooldownUntil,Number.isFinite(stored)?stored:0);
      }catch(_){return memoryCooldownUntil}
    }
    function setCooldown(until){
      memoryCooldownUntil=until;
      try{storage?.setItem(cooldownKey,String(until))}catch(_){/* armazenamento indisponível */}
    }
    function remainingMs(){return Math.max(0,cooldownUntil()-now())}
    function status(){
      const remaining=remainingMs();
      if(completed&&remaining<=0)completed=false;
      return{busy,completed,remainingMs:remaining};
    }

    async function request(email,redirectTo){
      if(busy)return{ok:false,ignored:true,reason:'busy',message:'A solicitação já está sendo enviada. Aguarde.'};
      const normalized=normalizeEmail(email);
      if(!isValidEmail(normalized))return{ok:false,reason:'invalid_email',message:'Digite um e-mail válido primeiro.'};
      const remaining=remainingMs();
      if(remaining>0)return{ok:false,ignored:true,reason:'cooldown',remainingMs:remaining,message:'Um link já foi solicitado. Aguarde antes de pedir outro.'};

      busy=true;
      try{
        const result=await send(normalized,{redirectTo});
        if(result?.error){
          if(isRateLimit(result.error)){
            setCooldown(now()+cooldownMs);
            return{ok:false,reason:'rate_limit',remainingMs:cooldownMs,message:friendlyRecoveryError(result.error)};
          }
          setCooldown(now()+retryCooldownMs);
          return{ok:false,reason:'error',remainingMs:retryCooldownMs,message:friendlyRecoveryError(result.error)};
        }
        completed=true;
        setCooldown(now()+cooldownMs);
        return{ok:true,reason:'sent',message:'Link enviado. Confira a caixa de entrada e também o spam.'};
      }catch(error){
        if(isRateLimit(error)){
          setCooldown(now()+cooldownMs);
          return{ok:false,reason:'rate_limit',remainingMs:cooldownMs,message:friendlyRecoveryError(error)};
        }
        setCooldown(now()+retryCooldownMs);
        return{ok:false,reason:'error',remainingMs:retryCooldownMs,message:friendlyRecoveryError(error)};
      }finally{
        busy=false;
      }
    }

    return{request,status};
  }

  function install(root){
    const document=root.document;
    const el=id=>document.getElementById(id);
    const button=()=>document.querySelector('#loginPane .auth-secondary');
    const message=(text,ok=false)=>{const box=el('authMessage');if(box){box.textContent=text;box.style.color=ok?'#15803d':'var(--danger,#bf2433)'}};
    const getClient=()=>root.ISA_SUPABASE||root.__ISA_AUTH_FALLBACK_SB||null;
    let storage=null;
    try{storage=root.localStorage}catch(_){/* armazenamento indisponível */}
    let timer=null;
    const cancelTimer=id=>(root.clearTimeout||clearTimeout)(id);
    const scheduleTimer=(callback,delay)=>(root.setTimeout||setTimeout)(callback,delay);
    const guard=createRecoveryGuard({
      storage,
      send:(email,options)=>getClient().auth.resetPasswordForEmail(email,options)
    });

    function renderButton(){
      cancelTimer(timer);
      const control=button();
      if(!control)return;
      if(!control.dataset.idleLabel)control.dataset.idleLabel=control.textContent.trim();
      const state=guard.status();
      if(state.busy){control.disabled=true;control.textContent='Enviando...';return}
      if(state.completed){
        control.disabled=true;
        control.textContent='Link enviado';
        timer=scheduleTimer(renderButton,Math.min(30000,state.remainingMs));
        return;
      }
      if(state.remainingMs>0){
        control.disabled=true;
        control.textContent=`Aguarde ${Math.ceil(state.remainingMs/60000)} min`;
        timer=scheduleTimer(renderButton,Math.min(30000,state.remainingMs));
        return;
      }
      control.disabled=false;
      control.textContent=control.dataset.idleLabel;
    }

    root.resetCloudPassword=async function(){
      const client=getClient();
      if(!client)return message('Não foi possível iniciar a conexão com o Supabase. Atualize a página.');
      const email=el('loginEmail')?.value||'';
      const pending=guard.request(email,'https://korluz.github.io/isa/');
      if(guard.status().busy)message('Enviando um único link de recuperação...',true);
      renderButton();
      const result=await pending;
      message(result.message,result.ok);
      renderButton();
    };

    const style=document.createElement('style');
    style.textContent='.auth-secondary:disabled{opacity:.55;cursor:not-allowed}';
    document.head.appendChild(style);
    renderButton();
  }

  return{VERSION,COOLDOWN_MS,RETRY_COOLDOWN_MS,COOLDOWN_KEY,normalizeEmail,isValidEmail,isRateLimit,friendlyRecoveryError,createRecoveryGuard,install};
});
