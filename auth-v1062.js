(()=>{
  'use strict';
  const SUPABASE_URL='https://cajrgongdxhzfudbheiv.supabase.co';
  const SUPABASE_KEY='sb_publishable_6ydTiQ192A9XfGzIAUtIrw_R7zBbq7h';
  const el=id=>document.getElementById(id);
  const show=(text,ok=false)=>{const box=el('authMessage');if(box){box.textContent=text;box.style.color=ok?'#15803d':'#bf2433'}};
  function client(){
    if(window.ISA_SUPABASE)return window.ISA_SUPABASE;
    if(window.__ISA_AUTH_FALLBACK_SB)return window.__ISA_AUTH_FALLBACK_SB;
    if(!window.supabase?.createClient)return null;
    window.__ISA_AUTH_FALLBACK_SB=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    return window.__ISA_AUTH_FALLBACK_SB;
  }
  async function fallbackLogin(){
    const sb=client();if(!sb)return show('Não foi possível iniciar a conexão com o Supabase. Atualize a página.');
    const email=(el('loginEmail')?.value||'').trim().toLowerCase(),password=el('loginPassword')?.value||'';
    if(!email||!password)return show('Informe e-mail e senha.');
    show('Entrando...',true);
    try{
      const{error}=await sb.auth.signInWithPassword({email,password});
      if(error)return show(error.message);
      show('Login confirmado. Abrindo o ISA...',true);
      setTimeout(()=>location.reload(),180);
    }catch(err){show('Não foi possível entrar: '+String(err?.message||err));}
  }
  async function fallbackRegister(){
    const sb=client();if(!sb)return show('Não foi possível iniciar a conexão com o Supabase.');
    const full_name=(el('registerName')?.value||'').trim(),email=(el('registerEmail')?.value||'').trim().toLowerCase(),password=el('registerPassword')?.value||'',confirm=el('registerConfirm')?.value||'';
    if(!full_name||!email||password.length<6)return show('Preencha nome, e-mail e senha com ao menos 6 caracteres.');
    if(password!==confirm)return show('As senhas não conferem.');
    const redirect=location.origin+location.pathname+'?confirmed=1';
    try{const{data,error}=await sb.auth.signUp({email,password,options:{data:{full_name},emailRedirectTo:redirect}});if(error)return show(error.message);show(data?.session?'Conta criada e conectada.':'Conta criada. Confirme o e-mail recebido.',true);}catch(err){show(String(err?.message||err));}
  }
  async function fallbackReset(){
    const sb=client();if(!sb)return show('Não foi possível iniciar a conexão com o Supabase.');
    const email=(el('loginEmail')?.value||'').trim().toLowerCase();if(!email)return show('Digite seu e-mail primeiro.');
    try{show('Enviando link de recuperação...',true);const redirect=location.origin+location.pathname+'?recovery=1';const{error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:redirect});if(error)return show(error.message);show('Link enviado. Confira a caixa de entrada e o spam.',true);}catch(err){show(String(err?.message||err));}
  }
  // Define fallbacks cedo. O módulo principal pode substituí-los depois; se ele falhar,
  // estes continuam disponíveis para os botões de autenticação.
  if(typeof window.loginLocal!=='function')window.loginLocal=fallbackLogin;
  if(typeof window.registerLocal!=='function')window.registerLocal=fallbackRegister;
  if(typeof window.resetCloudPassword!=='function')window.resetCloudPassword=fallbackReset;
})();
