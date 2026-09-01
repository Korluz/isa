(()=>{
  'use strict';
  const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const brl=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const date=v=>{if(!v)return '';const m=String(v).match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[3]}/${m[2]}/${m[1]}`:String(v)};
  window.printAuditPDF=function(){
    try{
      const rows=typeof window.auditRows==='function'?window.auditRows():[];
      const total=rows.reduce((a,r)=>a+Number(r.commission||0),0);
      const dbx=window.db||{};
      const sellerName=dbx.sellerProfile?.name||dbx.seller||'Vendedor';
      const w=window.open('','_blank');
      if(!w){alert('O navegador bloqueou a janela do PDF. Permita pop-ups para este site e tente novamente.');return;}
      const bodyRows=rows.map(r=>`<tr><td>${h(date(r.date))}</td><td>${h(r.voucher)}</td><td>${h(r.client)}</td><td>${h(r.tour)}</td><td>${h(r.adt)}</td><td>${h(r.chd)}</td><td>${h(brl(r.saleValue))}</td><td>${h(brl(r.commission))}</td><td>${h(r.rule)}</td></tr>`).join('');
      w.document.open();
      w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório de Comissões</title><style>
        @page{size:A4 landscape;margin:12mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#172033;margin:0}h1{font-size:22px;margin:0 0 6px}.meta{font-size:11px;color:#5d6874;margin-bottom:14px}table{width:100%;border-collapse:collapse;font-size:9px}th,td{border:1px solid #d9e0e7;padding:6px 7px;vertical-align:top}th{background:#eef2f6;text-align:left}.num{text-align:right}.total td{font-weight:700;background:#f6f8fa}.footer{font-size:9px;color:#7a8592;margin-top:8px}@media print{button{display:none}}
      </style></head><body><h1>Relatório de Comissões</h1><div class="meta">Vendedor: ${h(sellerName)} • Emitido em: ${h(new Date().toLocaleString('pt-BR'))}</div><table><thead><tr><th>Data</th><th>Voucher</th><th>Cliente</th><th>Passeio</th><th>ADT</th><th>CHD</th><th>Valor venda</th><th>Comissão</th><th>Regra</th></tr></thead><tbody>${bodyRows}<tr class="total"><td colspan="7">TOTAL</td><td>${h(brl(total))}</td><td></td></tr></tbody></table><div class="footer">ISA by Korluz • Relatório gerado a partir dos filtros atualmente selecionados.</div><script>window.onload=()=>setTimeout(()=>window.print(),120)<\/script></body></html>`);
      w.document.close();
    }catch(e){console.error('Falha ao gerar PDF de comissões',e);alert('Não foi possível gerar o PDF: '+(e?.message||e));}
  };
})();
