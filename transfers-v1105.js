(()=>{
  'use strict';

  const SERVICES=[
    {name:'TRANSFER IN',direction:'in'},
    {name:'TRANSFER OUT',direction:'out'}
  ];
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();

  function transferInfo(name){
    const n=norm(name);
    if(/(^| )transfer in($| )/.test(' '+n+' '))return {name:'TRANSFER IN',direction:'in'};
    if(/(^| )transfer out($| )/.test(' '+n+' '))return {name:'TRANSFER OUT',direction:'out'};
    return null;
  }
  window.ISA_transferInfo=transferInfo;
  window.ISA_isTransfer=name=>!!transferInfo(name);

  function normalizeService(t){
    if(!t||typeof t!=='object')return false;
    const info=transferInfo(t.name);
    if(!info)return false;
    let changed=false;
    if(norm(t.name)===norm(info.name) && t.name!==info.name){t.name=info.name;changed=true;}
    if(t.serviceType!=='transfer'){t.serviceType='transfer';changed=true;}
    if(t.transferDirection!==info.direction){t.transferDirection=info.direction;changed=true;}
    if(t.ticket==null){t.ticket=false;changed=true;}
    return changed;
  }

  function ensureTransfers(){
    const db=window.db;
    if(!db||!Array.isArray(db.catalog))return false;
    let changed=false;
    SERVICES.forEach(spec=>{
      let item=db.catalog.find(x=>norm(x?.name)===norm(spec.name));
      if(!item){
        db.catalog.push({
          name:spec.name,
          ticket:false,
          adultPrice:null,
          childPrice:null,
          adultCommission:null,
          childCommission:null,
          serviceType:'transfer',
          transferDirection:spec.direction
        });
        changed=true;
      }else{
        if(item.serviceType!=='transfer'){item.serviceType='transfer';changed=true;}
        if(item.transferDirection!==spec.direction){item.transferDirection=spec.direction;changed=true;}
        if(item.ticket!==false){item.ticket=false;changed=true;}
      }
    });
    (db.sales||[]).forEach(s=>(s.tours||[]).forEach(t=>{if(normalizeService(t))changed=true;}));
    if(changed&&typeof window.save==='function')window.save();
    return changed;
  }

  function normalizeVoucher(v){
    if(v&&Array.isArray(v.tours))v.tours.forEach(normalizeService);
    return v;
  }

  function wrapParser(name){
    const old=window[name];
    if(typeof old!=='function'||old.__isaTransferWrapped)return;
    const wrapped=function(...args){return normalizeVoucher(old.apply(this,args));};
    wrapped.__isaTransferWrapped=true;
    wrapped.__isaTransferOriginal=old;
    window[name]=wrapped;
  }

  function decorateCatalog(){
    const box=document.getElementById('catalogList');
    if(!box)return;
    [...box.querySelectorAll('.catalog-edit-card strong,.catalogitem')].forEach(el=>{
      const txt=el.textContent||'';
      if(transferInfo(txt)&&!txt.trim().startsWith('🚐'))el.textContent='🚐 '+txt.trim();
    });
  }

  function install(){
    ensureTransfers();
    wrapParser('parseVoucherNovo');
    wrapParser('parseVoucher');
    decorateCatalog();

    if(typeof window.renderCatalog==='function'&&!window.renderCatalog.__isaTransferWrapped){
      const old=window.renderCatalog;
      const wrapped=function(...args){const r=old.apply(this,args);ensureTransfers();setTimeout(decorateCatalog,0);return r;};
      wrapped.__isaTransferWrapped=true;
      window.renderCatalog=wrapped;
    }

    if(typeof window.renderAll==='function'&&!window.renderAll.__isaTransferWrapped){
      const old=window.renderAll;
      const wrapped=function(...args){ensureTransfers();const r=old.apply(this,args);setTimeout(decorateCatalog,0);return r;};
      wrapped.__isaTransferWrapped=true;
      window.renderAll=wrapped;
    }
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{install();[250,900,2200].forEach(ms=>setTimeout(install,ms));});
  else{install();[250,900,2200].forEach(ms=>setTimeout(install,ms));}
})();
