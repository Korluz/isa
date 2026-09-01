(()=>{
  'use strict';

  const legacyExport=window.exportAuditCSV;
  let xlsxPromise=null;

  function loadXLSX(){
    if(window.XLSX)return Promise.resolve(window.XLSX);
    if(xlsxPromise)return xlsxPromise;
    xlsxPromise=new Promise((resolve,reject)=>{
      const s=document.createElement('script');
      s.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
      s.async=true;
      s.onload=()=>window.XLSX?resolve(window.XLSX):reject(new Error('Biblioteca Excel não inicializou.'));
      s.onerror=()=>reject(new Error('Não foi possível carregar o módulo Excel.'));
      document.head.appendChild(s);
    });
    return xlsxPromise;
  }

  function clean(v){return String(v??'').replace(/\s+/g,' ').trim()}
  function brMoney(v){
    const s=clean(v).replace(/R\$\s*/gi,'').replace(/\./g,'').replace(',','.').replace(/[^0-9.-]/g,'');
    const n=Number(s);return Number.isFinite(n)?n:0;
  }
  function brDate(v){
    const m=clean(v).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    return m?new Date(Number(m[3]),Number(m[2])-1,Number(m[1])):clean(v);
  }
  function safeFile(v){return clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9_-]+/gi,'_').replace(/^_+|_+$/g,'').slice(0,50)||'vendedor'}
  function ref(c,r){return window.XLSX.utils.encode_cell({c,r})}

  window.exportAuditCSV=async function(){
    const btn=[...document.querySelectorAll('button')].find(b=>/Exportar Excel/i.test(b.textContent||''));
    const original=btn?.textContent||'';
    try{
      if(btn){btn.disabled=true;btn.textContent='Gerando Excel…'}
      const table=document.querySelector('#auditTableWrap table');
      if(!table)return alert('Nenhum relatório disponível para exportar.');
      const trs=[...table.querySelectorAll('tbody tr')].filter(tr=>!tr.classList.contains('audit-total'));
      if(!trs.length)return alert('Nenhum lançamento no período selecionado.');

      const XLSX=await loadXLSX();
      const headers=[...table.querySelectorAll('thead th')].map(th=>clean(th.textContent));
      const data=[headers];
      let total=0;
      trs.forEach(tr=>{
        const c=[...tr.children].map(td=>clean(td.textContent));
        const row=[
          brDate(c[0]),
          c[1],
          c[2],
          c[3],
          Number(c[4]||0),
          Number(c[5]||0),
          brMoney(c[6]),
          c[7]==='—'?null:brMoney(c[7]),
          c[8]==='—'?null:brMoney(c[8]),
          brMoney(c[9]),
          c[10],
          c[11]
        ];
        total+=Number(row[9]||0);
        data.push(row);
      });
      data.push(['','','','','','','','','TOTAL',total,'','']);

      const ws=XLSX.utils.aoa_to_sheet(data,{cellDates:true,dateNF:'dd/mm/yyyy'});
      ws['!cols']=[
        {wch:13},{wch:12},{wch:28},{wch:36},{wch:8},{wch:8},
        {wch:16},{wch:16},{wch:16},{wch:18},{wch:28},{wch:13}
      ];
      ws['!autofilter']={ref:`A1:L${trs.length+1}`};
      ws['!rows']=[{hpt:22}];

      for(let r=1;r<=trs.length;r++){
        const d=ws[ref(0,r)];if(d&&d.t==='d')d.z='dd/mm/yyyy';
        for(let c=6;c<=9;c++){
          const cell=ws[ref(c,r)];if(cell&&cell.v!=null)cell.z='R$ #,##0.00';
        }
      }
      const totalRow=trs.length+1;
      const totalCell=ws[ref(9,totalRow)];if(totalCell)totalCell.z='R$ #,##0.00';

      const wb=XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb,ws,'Comissões');
      wb.Props={Title:'Relatório de Comissões — ISA',Subject:'Auditoria de comissões',Author:'ISA by Korluz',CreatedDate:new Date()};

      const seller=document.getElementById('sellerNameTop')?.textContent||'vendedor';
      const start=document.getElementById('auditStart')?.value||'';
      const end=document.getElementById('auditEnd')?.value||'';
      const suffix=[start,end].filter(Boolean).join('_a_');
      XLSX.writeFile(wb,`relatorio_comissoes_${safeFile(seller)}${suffix?'_'+suffix:''}.xlsx`,{compression:true});
    }catch(e){
      console.error('Falha ao gerar Excel',e);
      const fallback=typeof legacyExport==='function'&&confirm('Não foi possível gerar o arquivo Excel formatado. Deseja baixar o CSV de emergência?');
      if(fallback)legacyExport();else alert('Não foi possível gerar o Excel: '+(e?.message||e));
    }finally{
      if(btn){btn.disabled=false;btn.textContent=original||'Exportar Excel (.xlsx)'}
    }
  };

  function relabel(){
    [...document.querySelectorAll('button')].forEach(b=>{if(/Exportar Excel\/CSV/i.test(b.textContent||''))b.textContent='Exportar Excel (.xlsx)'});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',relabel);else relabel();
})();
