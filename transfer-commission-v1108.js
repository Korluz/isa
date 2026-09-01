(()=>{
  'use strict';

  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
  const isTransfer=name=>typeof window.ISA_isTransfer==='function'?window.ISA_isTransfer(name):/(^| )transfer (in|out)($| )/.test(' '+norm(name)+' ');
  const isCancelled=t=>!!(t?.cancelled||t?.cancelChecked===true);
  const serviceValue=t=>Math.max(0,Number(t?.priceCents||0)/100);

  function installCommission(){
    const previous=window.calcSaleCommission;
    if(typeof previous!=='function'||previous.__isaTransfer5Pct)return;

    const wrapped=function(sale){
      const base=previous(sale)||{total:0,details:[],unmapped:[]};
      const byTour=new Map((base.details||[]).map(d=>[d.tour,d]));
      let total=0;
      const unmapped=[];
      const details=(sale?.tours||[]).map(t=>{
        let d=byTour.get(t)||{tour:t,total:0,p:{adults:Number(t.adults??sale?.adults??0),children:Number(t.children??sale?.children??0),babies:Number(t.babies??sale?.babies??0)}};
        if(isTransfer(t.name)){
          const baseValue=serviceValue(t);
          const value=isCancelled(t)?0:Math.round(baseValue*5)/100;
          d={...d,
            tour:t,
            total:value,
            adult:0,
            child:0,
            unmapped:false,
            commissionBase:baseValue,
            rule:{name:'Transfer — 5% do valor',adult:null,child:null,percentage:5}
          };
        }
        total+=Number(d.total||0);
        if(d.unmapped)unmapped.push(t.name);
        return d;
      });
      return {...base,total,details,unmapped};
    };
    wrapped.__isaTransfer5Pct=true;
    wrapped.__isaPrevious=previous;
    window.calcSaleCommission=wrapped;
  }

  function decorateCatalog(){
    const cards=[...document.querySelectorAll('#catalogList .catalog-edit-card')];
    cards.forEach(card=>{
      const title=card.querySelector('strong')?.textContent||'';
      if(!isTransfer(title))return;
      let note=card.querySelector('.transfer-commission-note');
      if(!note){
        note=document.createElement('small');
        note.className='transfer-commission-note';
        note.style.cssText='display:block;margin-top:5px;color:#166534;font-weight:800';
        card.querySelector('div')?.appendChild(note);
      }
      note.textContent='Comissão automática: 5% do valor do transfer';
    });
  }

  function refresh(){
    installCommission();
    if(typeof window.updateCommissions==='function')window.updateCommissions();
    if(typeof window.renderAuditReport==='function')window.renderAuditReport();
    decorateCatalog();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{refresh();[300,1000,2400].forEach(ms=>setTimeout(refresh,ms));});
  else{refresh();[300,1000,2400].forEach(ms=>setTimeout(refresh,ms));}
})();
