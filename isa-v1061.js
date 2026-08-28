(()=>{
  'use strict';
  const digits=v=>String(v||'').replace(/\D/g,'');
  const fmtCPF=v=>{const d=digits(v).slice(0,11);return d.length<=3?d:d.length<=6?`${d.slice(0,3)}.${d.slice(3)}`:d.length<=9?`${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`:`${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`};
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  function validCPF(v){
    const d=digits(v); if(d.length!==11||/^(\d)\1{10}$/.test(d))return false;
    const calc=len=>{let sum=0;for(let i=0;i<len;i++)sum+=Number(d[i])*(len+1-i);const r=(sum*10)%11;return r===10?0:r};
    return calc(9)===Number(d[9])&&calc(10)===Number(d[10]);
  }
  function cpfFromSale(s){
    if(!s)return '';
    if(validCPF(s.cpf))return fmtCPF(s.cpf);
    const list=(s.passengers||[]).map((p,i)=>({p,i,cpf:digits(p.document||p.cpf||'')})).filter(x=>validCPF(x.cpf));
    if(!list.length)return '';
    const target=norm(s.name);
    const best=list.find(x=>{const n=norm(x.p.name);return n&&target&&(n===target||n.includes(target)||target.includes(n))})||list[0];
    return fmtCPF(best.cpf);
  }
  window.isaFormatCPF=fmtCPF;
  window.isaInferCPF=cpfFromSale;

  const originalOpen=window.openContractForSaleId;
  if(typeof originalOpen==='function'){
    window.openContractForSaleId=function(id){
      const s=((typeof db!=='undefined'&&db?.sales)||[]).find(x=>String(x.id)===String(id));
      if(!s)return alert('Venda não encontrada.');
      const cpf=cpfFromSale(s);
      if(cpf&&!s.cpf)s.cpf=cpf;
      const handoff={
        saleId:s.id,
        nome:s.name||'',
        cpf:cpf||s.cpf||'',
        telefone:s.phone||'',
        email:s.email||'',
        endereco:s.hotel||s.address||'',
        valor:Number(s.valueCents||0)/100,
        pagamento:s.paymentMethod||'',
        tours:(s.tours||[]).map(t=>{
          const item=window.findCatalogItem?window.findCatalogItem(t.name):null;
          return {name:t.name||'',date:t.date||'',price:Number(t.priceCents||0)/100,ticketNonRefundable:!!item?.nonRefundableTicket};
        })
      };
      localStorage.setItem('isa_contract_handoff',JSON.stringify(handoff));
      window.open((typeof window.getContractUrl==='function'?window.getContractUrl():'contrato.html')+'?v=1061','_blank');
    };
  }

  if(typeof window.openBlankContract==='function')window.openBlankContract=function(){localStorage.removeItem('isa_contract_handoff');window.open('contrato.html?v=1061','_blank')};
  const oldSaveImported=window.saveImportedVoucher;
  if(typeof oldSaveImported==='function'){
    window.saveImportedVoucher=function(){
      const r=oldSaveImported.apply(this,arguments);
      setTimeout(()=>{
        const s=(typeof db!=='undefined'&&db?.sales)?db.sales[0]:null; if(!s)return;
        const cpf=cpfFromSale(s); if(cpf&&s.cpf!==cpf){s.cpf=cpf; if(typeof window.save==='function')window.save();}
      },0);
      return r;
    };
  }

  const oldSave=window.save;
  if(typeof oldSave==='function'){
    window.save=function(){
      ((typeof db!=='undefined'&&db?.sales)||[]).forEach(s=>{if(!s.cpf){const c=cpfFromSale(s);if(c)s.cpf=c}});
      return oldSave.apply(this,arguments);
    };
  }
})();
