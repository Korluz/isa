(()=>{
  'use strict';

  const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const esc=v=>clean(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const nowBR=()=>new Date().toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'medium'});
  const safeFile=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9_-]+/gi,'_').replace(/^_+|_+$/g,'').slice(0,50)||'vendedor';
  let xlsxPromise=null;

  function getReport(){
    const table=document.querySelector('#auditTableWrap table');
    if(!table)return null;
    const headers=[...table.querySelectorAll('thead th')].map(th=>clean(th.textContent));
    const rows=[...table.querySelectorAll('tbody tr')]
      .filter(tr=>!tr.classList.contains('audit-total'))
      .map(tr=>[...tr.children].map(td=>clean(td.textContent)));
    const total=clean(table.querySelector('tbody tr.audit-total td:nth-child(2)')?.textContent||'');
    const seller=clean(document.getElementById('sellerNameTop')?.textContent||window.db?.sellerProfile?.name||window.db?.seller||'Vendedor');
    const start=document.getElementById('auditStart')?.value||'';
    const end=document.getElementById('auditEnd')?.value||'';
    const search=document.getElementById('auditSearch')?.value||'';
    const status=document.getElementById('auditStatus')?.selectedOptions?.[0]?.textContent||'';
    return{table,headers,rows,total,seller,start,end,search,status,generated:nowBR()};
  }

  function fmtIso(v){
    const m=String(v||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m?`${m[3]}/${m[2]}/${m[1]}`:(v||'—');
  }
  function periodLabel(r){return `${fmtIso(r.start)} a ${fmtIso(r.end)}`}

  window.printAuditPDF=function(){
    try{
      const r=getReport();
      if(!r||!r.rows.length)return alert('Nenhum lançamento disponível no período selecionado.');
      const w=window.open('','_blank');
      if(!w)return alert('O navegador bloqueou a janela do PDF. Permita pop-ups para este site e tente novamente.');
      const body=r.rows.map(row=>`<tr>${row.map((v,i)=>`<td class="${i>=4&&i<=9?'num':''}">${esc(v)}</td>`).join('')}</tr>`).join('');
      const meta=[`Vendedor: ${r.seller}`,`Período: ${periodLabel(r)}`,r.status?`Filtro: ${r.status}`:'',r.search?`Busca: ${r.search}`:'',`Gerado em: ${r.generated}`].filter(Boolean);
      w.document.open();
      w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório de Comissões — ISA</title><style>
        @page{size:A4 landscape;margin:11mm}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#172033;margin:0}.brand{display:flex;align-items:center;gap:10px;border-bottom:2px solid #dfa82f;padding-bottom:10px;margin-bottom:10px}.mark{width:34px;height:34px;border-radius:9px;background:#dfa82f;color:#0b2136;display:grid;place-items:center;font-weight:900;font-size:13px}.brand h1{font-size:19px;margin:0}.brand small{display:block;color:#687483;margin-top:2px}.meta{font-size:9px;color:#5d6874;margin-bottom:10px;display:flex;gap:12px;flex-wrap:wrap}.meta span{white-space:nowrap}table{width:100%;border-collapse:collapse;font-size:7.7px;table-layout:auto}th,td{border:1px solid #d9e0e7;padding:4px 5px;vertical-align:top}th{background:#eef2f6;text-align:left;font-size:7.5px}.num{text-align:right;white-space:nowrap}.total td{font-weight:700;background:#fff8e8}.footer{font-size:8px;color:#7a8592;margin-top:8px;display:flex;justify-content:space-between}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
      </style></head><body><div class="brand"><div class="mark">ISA</div><div><h1>Relatório de Comissões</h1><small>Indômito Seller Assistant</small></div></div><div class="meta">${meta.map(x=>`<span>${esc(x)}</span>`).join('')}</div><table><thead><tr>${r.headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${body}<tr class="total"><td colspan="9">TOTAL DE COMISSÕES</td><td>${esc(r.total||'—')}</td><td colspan="2"></td></tr></tbody></table><div class="footer"><span>ISA by Korluz</span><span>Documento gerado em ${esc(r.generated)}</span></div><script>window.onload=()=>setTimeout(()=>window.print(),180)<\/script></body></html>`);
      w.document.close();
    }catch(e){console.error('Falha ao gerar PDF de comissões',e);alert('Não foi possível gerar o PDF: '+(e?.message||e));}
  };

  function loadXLSX(){
    if(window.XLSX)return Promise.resolve(window.XLSX);
    if(xlsxPromise)return xlsxPromise;
    xlsxPromise=new Promise((resolve,reject)=>{
      const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';s.async=true;
      s.onload=()=>window.XLSX?resolve(window.XLSX):reject(new Error('Biblioteca Excel não inicializou.'));
      s.onerror=()=>reject(new Error('Não foi possível carregar o módulo Excel.'));
      document.head.appendChild(s);
    });
    return xlsxPromise;
  }
  function money(v){
    const s=clean(v).replace(/R\$\s*/gi,'').replace(/\./g,'').replace(',','.').replace(/[^0-9.-]/g,'');const n=Number(s);return Number.isFinite(n)?n:null;
  }
  function dateCell(v){const m=clean(v).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);return m?new Date(+m[3],+m[2]-1,+m[1]):clean(v)}

  window.exportAuditCSV=async function(){
    const btn=[...document.querySelectorAll('button')].find(b=>/Exportar Excel/i.test(b.textContent||''));const original=btn?.textContent||'';
    try{
      const r=getReport();if(!r||!r.rows.length)return alert('Nenhum lançamento disponível no período selecionado.');
      if(btn){btn.disabled=true;btn.textContent='Gerando Excel…'}
      const XLSX=await loadXLSX();
      const data=[
        ['ISA','Indômito Seller Assistant — Relatório de Comissões'],
        ['Gerado em',r.generated],
        ['Vendedor',r.seller,'Período',periodLabel(r)],
        ['Filtro',r.status||'Todos','Busca',r.search||'—'],
        r.headers
      ];
      let total=0;
      r.rows.forEach(c=>{
        const row=[dateCell(c[0]),c[1],c[2],c[3],Number(c[4]||0),Number(c[5]||0),money(c[6]),c[7]==='—'?null:money(c[7]),c[8]==='—'?null:money(c[8]),money(c[9]),c[10],c[11]];
        total+=Number(row[9]||0);data.push(row);
      });
      data.push(['','','','','','','','','TOTAL',total,'','']);
      const ws=XLSX.utils.aoa_to_sheet(data,{cellDates:true,dateNF:'dd/mm/yyyy'});
      ws['!merges']=[XLSX.utils.decode_range('B1:L1')];
      ws['!cols']=[{wch:14},{wch:13},{wch:30},{wch:38},{wch:8},{wch:8},{wch:17},{wch:17},{wch:17},{wch:19},{wch:30},{wch:13}];
      ws['!autofilter']={ref:`A5:L${5+r.rows.length}`};
      ws['!freeze']={xSplit:0,ySplit:5,topLeftCell:'A6',activePane:'bottomLeft',state:'frozen'};
      const ref=(c,row)=>XLSX.utils.encode_cell({c,r:row});
      for(let rr=5;rr<5+r.rows.length;rr++){
        const d=ws[ref(0,rr)];if(d&&d.t==='d')d.z='dd/mm/yyyy';
        for(let c=6;c<=9;c++){const cell=ws[ref(c,rr)];if(cell&&cell.v!=null)cell.z='R$ #,##0.00';}
      }
      const totalRow=5+r.rows.length;const totalCell=ws[ref(9,totalRow)];if(totalCell)totalCell.z='R$ #,##0.00';
      const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Comissões');
      wb.Props={Title:'Relatório de Comissões — ISA',Subject:`Gerado em ${r.generated}`,Author:'ISA by Korluz',Company:'ISA by Korluz',CreatedDate:new Date()};
      const suffix=[r.start,r.end].filter(Boolean).join('_a_');
      XLSX.writeFile(wb,`relatorio_comissoes_${safeFile(r.seller)}${suffix?'_'+suffix:''}.xlsx`,{compression:true});
    }catch(e){console.error('Falha ao gerar Excel',e);alert('Não foi possível gerar o Excel: '+(e?.message||e));}
    finally{if(btn){btn.disabled=false;btn.textContent=original||'Exportar Excel (.xlsx)'}}
  };
})();
