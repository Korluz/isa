const assert=require('node:assert/strict');
const hotfix=require('../auth-recovery-hotfix-v11013.js');

function memoryStorage(){
  const values=new Map();
  return{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,String(value)),values};
}

assert.equal(hotfix.VERSION,'11.0.13');
assert.equal(hotfix.isValidEmail(' ANA@Example.com '),true);
assert.equal(hotfix.isValidEmail('ana@'),false);
assert.match(hotfix.friendlyRecoveryError({code:'over_email_send_rate_limit'}),/uma hora/);
assert.doesNotMatch(hotfix.friendlyRecoveryError({message:'internal auth detail'}),/internal auth detail/);

(async()=>{
  let currentTime=1_000_000;
  let releaseFirst;
  const calls=[];
  const storage=memoryStorage();
  const guard=hotfix.createRecoveryGuard({
    storage,
    now:()=>currentTime,
    send:async(email,options)=>{
      calls.push({email,options});
      if(calls.length===1)await new Promise(resolve=>{releaseFirst=resolve});
      return{data:{},error:null};
    }
  });

  const invalid=await guard.request('ana@','https://korluz.github.io/isa/');
  assert.equal(invalid.reason,'invalid_email');
  assert.equal(calls.length,0);

  const first=guard.request(' ANA@Example.com ','https://korluz.github.io/isa/');
  const duplicate=await guard.request('ana@example.com','https://korluz.github.io/isa/');
  assert.equal(duplicate.ignored,true);
  assert.equal(duplicate.reason,'busy');
  assert.equal(calls.length,1);

  releaseFirst();
  const sent=await first;
  assert.equal(sent.ok,true);
  assert.equal(calls[0].email,'ana@example.com');
  assert.equal(guard.status().remainingMs,hotfix.COOLDOWN_MS);

  const duringCooldown=await guard.request('ana@example.com','https://korluz.github.io/isa/');
  assert.equal(duringCooldown.reason,'cooldown');
  assert.equal(calls.length,1);

  let reloadCalls=0;
  const afterReload=hotfix.createRecoveryGuard({
    storage,
    now:()=>currentTime,
    send:async()=>{reloadCalls++;return{data:{},error:null}}
  });
  const reloadResult=await afterReload.request('ana@example.com','https://korluz.github.io/isa/');
  assert.equal(reloadResult.reason,'cooldown');
  assert.equal(reloadCalls,0);

  currentTime+=hotfix.COOLDOWN_MS+1;
  assert.equal(guard.status().completed,false);
  const afterCooldown=await guard.request('ana@example.com','https://korluz.github.io/isa/');
  assert.equal(afterCooldown.ok,true);
  assert.equal(calls.length,2);

  let limitedTime=2_000_000;
  const limitedStorage=memoryStorage();
  const limited=hotfix.createRecoveryGuard({
    storage:limitedStorage,
    now:()=>limitedTime,
    send:async()=>({error:{code:'over_email_send_rate_limit',message:'email rate limit exceeded'}})
  });
  const limitedResult=await limited.request('ana@example.com','https://korluz.github.io/isa/');
  assert.equal(limitedResult.reason,'rate_limit');
  assert.equal(limited.status().remainingMs,hotfix.COOLDOWN_MS);

  const failed=hotfix.createRecoveryGuard({
    now:()=>3_000_000,
    send:async()=>({error:{message:'temporary failure'}})
  });
  const failedResult=await failed.request('ana@example.com','https://korluz.github.io/isa/');
  assert.equal(failedResult.reason,'error');
  assert.equal(failed.status().remainingMs,hotfix.RETRY_COOLDOWN_MS);

  let uiRelease;
  let uiCalls=0;
  const uiButton={textContent:'Esqueci minha senha',disabled:false,dataset:{}};
  const uiEmail={value:'ana@example.com'};
  const uiMessage={textContent:'',style:{}};
  const uiRoot={
    document:{
      getElementById:id=>({loginEmail:uiEmail,authMessage:uiMessage}[id]||null),
      querySelector:selector=>selector==='#loginPane .auth-secondary'?uiButton:null,
      createElement:()=>({textContent:''}),
      head:{appendChild:()=>{}}
    },
    localStorage:memoryStorage(),
    setTimeout:()=>1,
    clearTimeout:()=>{},
    ISA_SUPABASE:{auth:{resetPasswordForEmail:async()=>{
      uiCalls++;
      await new Promise(resolve=>{uiRelease=resolve});
      return{data:{},error:null};
    }}}
  };
  hotfix.install(uiRoot);
  const uiFirst=uiRoot.resetCloudPassword();
  const uiDuplicate=uiRoot.resetCloudPassword();
  assert.equal(uiCalls,1);
  assert.equal(uiButton.disabled,true);
  assert.equal(uiButton.textContent,'Enviando...');
  await uiDuplicate;
  uiRelease();
  await uiFirst;
  assert.equal(uiCalls,1);
  assert.equal(uiButton.textContent,'Link enviado');
  assert.match(uiMessage.textContent,/Link enviado/);

  console.log('auth-recovery-hotfix-v11013: clique duplicado e cooldown testados');
})().catch(error=>{console.error(error);process.exitCode=1});
