(()=>{
  'use strict';
  const digits=v=>String(v||'').replace(/\D/g,'');
  const fmtCPF=v=>{const d=digits(v).slice(0,11);return d.length<=3?d:d.length<=6?`${d.slice(0,3)}.${d.slice(3)}`:d.length<=9?`${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`:`${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`};
  const fmtDate=v=>{const d=digits(v).slice(0,8);return d.length<=2?d:d.length<=4?`${d.slice(0,2)}/${d.slice(2)}`:`${d.slice(0,2)}/${d.slice(2,4)}/${d.slice(4)}`};
  const fmtCEP=v=>{const d=digits(v).slice(0,8);return d.length<=5?d:`${d.slice(0,5)}-${d.slice(5)}`};
  const fmtPhone=v=>{
    const d=digits(v).slice(0,13);
    if(d.startsWith('55')&&(d.length===12||d.length===13)){
      const n=d.slice(2);return n.length===11?`+55 (${n.slice(0,2)}) ${n.slice(2,7)}-${n.slice(7)}`:`+55 (${n.slice(0,2)}) ${n.slice(2,6)}-${n.slice(6)}`;
    }
    if(d.length===11)return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
    if(d.length===10)return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
    if(d.length<=2)return d;
    if(d.length<=7)return `(${d.slice(0,2)}) ${d.slice(2)}`;
    if(d.length<=11){const body=d.slice(2);const cut=body.length>8?body.length-4:Math.max(4,body.length-4);return `(${d.slice(0,2)}) ${body.slice(0,cut)}-${body.slice(cut)}`;}
    return '+'+d;
  };
  const moneyBR=v=>{
    const raw=String(v||'').trim(); if(!raw)return '';
    const normalized=raw.replace(/R\$\s*/gi,'').replace(/\./g,'').replace(',','.').replace(/[^0-9.-]/g,'');
    const n=Number(normalized); return Number.isFinite(n)?n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):raw;
  };
  function validCPF(v){
    const d=digits(v); if(d.length!==11||/^(\d)\1{10}$/.test(d))return false;
    const calc=len=>{let sum=0;for(let i=0;i<len;i++)sum+=Number(d[i])*(len+1-i);const r=(sum*10)%11;return r===10?0:r};
    return calc(9)===Number(d[9])&&calc(10)===Number(d[10]);
  }
  function setStatus(msg){const e=document.getElementById('status');if(e)e.textContent=msg}
  function bindMask(id,fn,max,inputMode='numeric'){
    const e=document.getElementById(id);if(!e)return;
    if(max)e.maxLength=max;e.inputMode=inputMode;
    const apply=()=>{const nv=fn(e.value);if(e.value!==nv)e.value=nv};
    e.addEventListener('input',apply);apply();
  }
  async function pdfText(file){
    if(!window.pdfjsLib)throw new Error('Leitor de PDF não carregou.');
    const data=await file.arrayBuffer(),doc=await pdfjsLib.getDocument({data}).promise;let out='';
    for(let i=1;i<=doc.numPages;i++){const page=await doc.getPage(i),content=await page.getTextContent();out+=' '+content.items.map(x=>x.str).join(' ')}
    return out.replace(/\s+/g,' ').trim();
  }
  function findCPF(text){
    const s=String(text||'');
    const labeled=[...s.matchAll(/\bCPF\b\s*[:\-]?\s*(\d{3}[.\s]?\d{3}[.\s]?\d{3}[-\s]?\d{2}|\d{11})/gi)].map(m=>m[1]);
    const general=[...s.matchAll(/\b\d{3}[.]?\d{3}[.]?\d{3}-?\d{2}\b/g)].map(m=>m[0]);
    return [...labeled,...general].find(validCPF)||'';
  }
  function applyHandoffCPF(){
    try{
      const raw=localStorage.getItem('isa_contract_handoff');if(!raw)return;
      const d=JSON.parse(raw),e=document.getElementById('cpf');
      if(e&&d.cpf)e.value=fmtCPF(d.cpf);
    }catch(_){ }
  }
  async function voucherChanged(e){
    const file=e.target.files?.[0];if(!file||!/\.pdf$/i.test(file.name)&&file.type!=='application/pdf')return;
    const cpf=document.getElementById('cpf');
    if(cpf&&digits(cpf.value).length===11)return;
    try{
      setStatus('Lendo dados do voucher…');
      const found=findCPF(await pdfText(file));
      if(found&&cpf){cpf.value=fmtCPF(found);cpf.dispatchEvent(new Event('input',{bubbles:true}));setStatus('CPF identificado no voucher e preenchido automaticamente.');}
      else setStatus('Voucher carregado. CPF não identificado automaticamente neste PDF.');
    }catch(err){console.warn(err);setStatus('Voucher carregado. Não foi possível ler o CPF automaticamente.');}
  }

  document.addEventListener('DOMContentLoaded',()=>{
    applyHandoffCPF();
    bindMask('cpf',fmtCPF,14);
    bindMask('nascimento',fmtDate,10);
    bindMask('cep',fmtCEP,9);
    bindMask('telefone',fmtPhone,19,'tel');
    const valor=document.getElementById('valor');if(valor){valor.inputMode='decimal';valor.addEventListener('blur',()=>{valor.value=moneyBR(valor.value)});}
    document.getElementById('voucher')?.addEventListener('change',voucherChanged);
    const btn=document.getElementById('createSignatureLink');
    btn?.addEventListener('click',e=>{const cpf=document.getElementById('cpf');if(digits(cpf?.value).length!==11){e.preventDefault();e.stopImmediatePropagation();alert('O CPF deve ter exatamente 11 dígitos.');cpf?.focus();}},true);
    const oldPayload=window.contractPayload;
    if(typeof oldPayload==='function')window.contractPayload=function(){const p=oldPayload();p.contractVersion='10.6.1';return p};
    [50,300,900].forEach(ms=>setTimeout(()=>{bindMask('cpf',fmtCPF,14);bindMask('nascimento',fmtDate,10);bindMask('cep',fmtCEP,9);bindMask('telefone',fmtPhone,19,'tel')},ms));
  });
})();
