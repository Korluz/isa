(()=>{
  'use strict';

  const el=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
  const localISO=d=>{const x=new Date();x.setHours(12,0,0,0);x.setDate(x.getDate()+d);return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`};
  const fmtDate=v=>{const m=String(v||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[3]}/${m[2]}/${m[1]}`:String(v||'')};
  const active=t=>!(t?.cancelled||t?.cancelChecked===true);

  function scoreTour(name,msg){
    const n=norm(name),m=norm(msg);if(!n)return 0;if(m.includes(n))return 1;
    const stop=new Set(['tour','full','day','sunset','city','de','da','do','del','la','el']);
    const words=n.split(' ').filter(w=>w.length>=4&&!stop.has(w));
    return words.length?words.filter(w=>m.includes(w)).length/words.length:0;
  }

  function extractDate(msg){
    const m=String(msg||'').match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);
    return m?`${m[3]}-${m[2]}-${m[1]}`:'';
  }
  function extractTime(msg){
    const all=[...String(msg||'').matchAll(/\b([01]?\d|2[0-3]):([0-5]\d)\b/g)];
    return all.length?`${String(all[all.length-1][1]).padStart(2,'0')}:${all[all.length-1][2]}`:'';
  }
  function firstNum(text,patterns){
    for(const re of patterns){const m=String(text||'').match(re);if(m)return Number(m[1]);}
    return null;
  }
  function extractCounts(msg,expected){
    const text=String(msg||'');
    let adults=firstNum(text,[/\b(\d+)\s*ADT\b/i,/\bADT\b\s*[:=\-]?\s*(\d+)\b/i,/\(\s*ADT\s*\)\s*[:=\-]?\s*(\d+)\b/i]);
    let children=firstNum(text,[/\b(\d+)\s*CHD\b/i,/\bCHD\b\s*[:=\-]?\s*(\d+)\b/i,/\(\s*CHD\s*\)\s*[:=\-]?\s*(\d+)\b/i]);
    let babies=firstNum(text,[/\b(\d+)\s*INF\b/i,/\bINF\b\s*[:=\-]?\s*(\d+)\b/i,/\(\s*INF\s*\)\s*[:=\-]?\s*(\d+)\b/i]);
    const total=firstNum(text,[/Total\s+de\s+Pax\s*:\s*(\d+)/i,/Total\s+(?:de\s+)?passageiros\s*:\s*(\d+)/i]);
    let adultInferred=false,childInferred=false;
    if(children===null && Number(expected.children||0)===0){children=0;childInferred=true;}
    if(babies===null && Number(expected.babies||0)===0)babies=0;
    if(adults===null && total!==null && children!==null && total-children===Number(expected.adults||0)){adults=Number(expected.adults||0);adultInferred=true;}
    return {adults,children,babies,total,adultInferred,childInferred};
  }

  function extractLocationParts(msg){
    const text=String(msg||'');
    const hotel=(text.match(/(?:^|\n)\s*Hotel\s*:\s*([^\n]+)/i)||[])[1]||'';
    const address=(text.match(/(?:^|\n)\s*Endere[cç]o\s*:\s*([^\n]+)/i)||[])[1]||'';
    return {hotel:hotel.trim(),address:address.trim(),combined:[hotel,address].filter(Boolean).join(' ')};
  }
  function candidateMatch(candidate,msg){
    const ex=norm(candidate),m=norm(msg);if(!ex)return null;
    if(m.includes(ex))return true;
    const stop=new Set(['hotel','endereco','ponto','encontro','punto','coleta','avenida','rua','calle','regiao','region','metropolitana','chile','providencia','numero','n','de','da','do','del','la','el','sta','santa']);
    const words=ex.split(' ').filter(w=>w.length>=4&&!stop.has(w)&&!/^\d+$/.test(w));
    const nums=(String(candidate).match(/\d{2,}/g)||[]);
    const wordHits=words.filter(w=>m.includes(w)).length;
    const numHits=nums.filter(n=>m.includes(n)).length;
    if(words.length && wordHits/words.length>=0.5)return true;
    if(wordHits>=1 && numHits>=1)return true;
    if(nums.length>=1 && numHits===nums.length && words.length<=2)return true;
    return false;
  }
  function hotelMatch(s,t,msg){
    const parts=extractLocationParts(msg);
    const received=[parts.hotel,parts.address,parts.combined,msg].filter(Boolean);
    const candidates=[t?.location,s?.hotel].filter(Boolean);
    if(!candidates.length)return null;
    for(const c of candidates){for(const r of received){if(candidateMatch(c,r)===true)return true;}}
    return false;
  }

  function vcard(title,state,body){
    const icon=state==='ok'?'✓':state==='danger'?'✕':'!';
    return `<div class="validatorcheck ${state}"><strong>${icon} ${esc(title)}</strong><span>${esc(body)}</span></div>`;
  }

  window.validateMessage=function(){
    const db=window.db||{};
    const s=(db.sales||[]).find(x=>String(x.id)===String(el('validatorSale')?.value));
    const msg=el('validatorMessage')?.value.trim();
    if(!s)return alert('Selecione uma venda.');
    if(!msg)return alert('Cole a mensagem da logística.');

    const expected=(s.tours||[]).filter(t=>active(t)&&t.date===localISO(1));
    if(!expected.length){
      el('validatorResult').className='alertbox validator-stop';
      el('validatorResult').innerHTML='<strong>✕ NÃO ENVIAR</strong><div>Nenhum passeio ativo desta venda está marcado para amanhã.</div>';
      return;
    }

    const ranked=expected.map(t=>({t,score:scoreTour(t.name,msg)})).sort((a,b)=>b.score-a.score),best=ranked[0];
    const exp={adults:Number(best.t.adults??s.adults??0),children:Number(best.t.children??s.children??0),babies:Number(best.t.babies??s.babies??0)};
    const got=extractCounts(msg,exp),msgDate=extractDate(msg),msgTime=extractTime(msg);
    const tourOk=best.score>=0.45,dateOk=msgDate===best.t.date;
    const adultOk=got.adults!==null&&got.adults===exp.adults;
    const childOk=got.children!==null&&got.children===exp.children;
    const countsOk=adultOk&&childOk;
    const hOk=hotelMatch(s,best.t,msg);
    const essentialOk=tourOk&&dateOk&&countsOk&&!!msgTime&&(hOk!==false);

    const adultTxt=got.adults===null?'não identificado':`${got.adults} ADT${got.adultInferred?' (inferido pelo total)':''}`;
    const childTxt=got.children===null?'não identificado':`${got.children} CHD${got.childInferred?' (omitido na mensagem = 0)':''}`;
    const parts=extractLocationParts(msg);
    const localDetail=hOk===true?`Local compatível${parts.hotel?' • '+parts.hotel:''}${parts.address?' • '+parts.address:''}`:hOk===false?'Hotel/endereço não conferem com o cadastro':'Não há local cadastrado para comparar';
    const cards=[
      vcard('Passeio',tourOk?'ok':'danger',tourOk?best.t.name:`Esperado: ${best.t.name}`),
      vcard('Data',dateOk?'ok':'danger',`Esperada: ${fmtDate(best.t.date)} — Recebida: ${msgDate?fmtDate(msgDate):'não identificada'}`),
      vcard('Passageiros',countsOk?'ok':'danger',`Esperado: ${exp.adults} ADT / ${exp.children} CHD — Recebido: ${adultTxt} / ${childTxt}`),
      vcard('Hotel / coleta',hOk===true?'ok':hOk===false?'danger':'warn',localDetail),
      vcard('Horário',msgTime?'ok':'danger',msgTime||'Não identificado')
    ];
    const box=el('validatorResult');
    box.className='alertbox '+(essentialOk?'validator-ok-title':'validator-stop');
    box.innerHTML=`<strong>${essentialOk?'✓ MENSAGEM COMPATÍVEL':'✕ NÃO ENVIAR'}</strong><div>${essentialOk?'Os dados essenciais conferem.':'Há divergência em um ou mais dados essenciais.'}</div><div class="validator-result-stack">${cards.join('')}</div>${essentialOk?'<div class="actions"><button class="btn gold" id="saveValidatedV1103">Salvar horário</button></div>':''}`;
    if(essentialOk){el('saveValidatedV1103').onclick=()=>{if(typeof window.saveValidatedTimeV29==='function')window.saveValidatedTimeV29(s.id,best.t.name,msgTime);else{best.t.hour=msgTime;if(typeof window.save==='function')window.save();alert('Horário salvo na venda.');}};}
    if(!essentialOk&&navigator.vibrate)navigator.vibrate([100,60,100]);
  };

  const oldLoad=window.loadRemoteSignatures;
  window.deleteRemoteSignature=async function(id){
    const sb=window.ISA_SUPABASE;if(!sb)return alert('Supabase ainda não está conectado.');
    if(!confirm('Excluir este registro de assinatura? Use esta opção apenas para testes ou registros criados por engano.'))return;
    const typed=prompt('Para confirmar a exclusão definitiva, digite EXCLUIR:');
    if(typed!=='EXCLUIR')return;
    const{data,error}=await sb.rpc('delete_contract_signature_request',{p_request_id:id});
    if(error)return alert('Não foi possível excluir: '+error.message);
    if(data!==true)return alert('Registro não encontrado ou já excluído.');
    alert('Registro de assinatura excluído.');
    await window.loadRemoteSignatures(true);
  };
  if(typeof oldLoad==='function'){
    window.loadRemoteSignatures=async function(...args){
      await oldLoad(...args);
      const sb=window.ISA_SUPABASE,box=el('remoteSignatureList');if(!sb||!box)return;
      try{
        const{data,error}=await sb.from('contract_signature_requests').select('id').order('created_at',{ascending:false}).limit(50);
        if(error)return;
        const items=[...box.querySelectorAll('.sign-item')];
        (data||[]).forEach((r,i)=>{const actions=items[i]?.querySelector('.sign-actions');if(actions&&!actions.querySelector('.delete-sign-v1103')){const b=document.createElement('button');b.className='btn red sm delete-sign-v1103';b.textContent='Excluir registro';b.onclick=()=>window.deleteRemoteSignature(r.id);actions.appendChild(b);}});
        if(!box.querySelector('.delete-note-v1103')){const n=document.createElement('div');n.className='meta delete-note-v1103';n.style.marginTop='10px';n.textContent='Exclusão é definitiva. Use apenas para testes ou registros criados por engano.';box.appendChild(n);}
      }catch(_){ }
    };
  }

  document.addEventListener('DOMContentLoaded',()=>{
    const btn=[...document.querySelectorAll('button')].find(b=>/analisar mensagem/i.test(b.textContent||''));if(btn)btn.onclick=window.validateMessage;
  });
})();
