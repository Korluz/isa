(()=>{
'use strict';
const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const money=v=>{const s=clean(v).replace(/R\$\s*/gi,'').replace(/\./g,'').replace(',','.').replace(/[^0-9.-]/g,'');const n=Number(s);return Number.isFinite(n)?n:0};
const brl=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const esc=v=>clean(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nowBR=()=>new Date().toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'medium'});
const fmtIso=v=>{const m=String(v||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[3]}/${m[2]}/${m[1]}`:(v||'—')};
const safeFile=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9_-]+/gi,'_').replace(/^_+|_+$/g,'').slice(0,50)||'vendedor';
let xlsxPromise=null;
function decorateAudit(){
 const table=document.querySelector('#auditTableWrap table');if(!table)return;
 const rows=[...table.querySelectorAll('tbody tr')].filter(tr=>!tr.classList.contains('audit-total'));
 let activeTotal=0;
 rows.forEach(tr=>{
   const cells=[...tr.children],status=clean(cells.at(-1)?.textContent).toLowerCase(),cancelled=status.includes('cancelado');
   tr.dataset.cancelled=cancelled?'true':'false';
   tr.classList.toggle('isa-audit-cancelled',cancelled);
   const commissionCell=cells[9];
   if(commissionCell){commissionCell.classList.toggle('isa-commission-cancelled',cancelled);commissionCell.title=cancelled?'Comissão cancelada — não contabilizada no total':'';}
   if(!cancelled)activeTotal+=money(commissionCell?.textContent);
 });
 const totalRow=table.querySelector('tbody tr.audit-total');if(totalRow&&totalRow.children[1])totalRow.children[1].textContent=brl(activeTotal);
 const kpi=document.getElementById('auditCommissionTotal');if(kpi)kpi.textContent=brl(activeTotal);
 if(!document.getElementById('isaAuditCancelStyle')){
   const st=document.createElement('style');st.id='isaAuditCancelStyle';st.textContent=`
   .audit-table tr.isa-audit-cancelled td{background:#fff7f7;color:#7b8794}.audit-table tr.isa-audit-cancelled td:last-child{color:#b42318;font-weight:800}
   .audit-table .isa-commission-cancelled,.audit-table .isa-commission-cancelled strong{text-decoration:line-through;text-decoration-thickness:2px;color:#9b1c1c!important}
   .audit-table .isa-commission-cancelled:after{content:'  não contabilizada';text-decoration:none;display:inline-block;margin-left:5px;font-size:10px;color:#9b1c1c;font-weight:700}`;document.head.appendChild(st);
 }
}
const priorRender=window.renderAuditReport;
if(typeof priorRender==='function')window.renderAuditReport=function(){const out=priorRender.apply(this,arguments);decorateAudit();return out};
function setDefault(){const sel=document.getElementById('auditStatus');if(sel&&sel.value==='active'){sel.value='all';window.renderAuditReport?.()}else decorateAudit();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(setDefault,80));else setTimeout(setDefault,80);
function report(){
 const table=document.querySelector('#auditTableWrap table');if(!table)return null;
 const headers=[...table.querySelectorAll('thead th')].map(th=>clean(th.textContent));
 const rows=[...table.querySelectorAll('tbody tr')].filter(tr=>!tr.classList.contains('audit-total')).map(tr=>({cells:[...tr.children].map(td=>clean(td.textContent).replace(/\s+não contabilizada$/i,'')),cancelled:tr.dataset.cancelled==='true'||/cancelado/i.test(tr.lastElementChild?.textContent||'')}));
 const seller=clean(document.getElementById('sellerNameTop')?.textContent||window.db?.sellerProfile?.name||window.db?.seller||'Vendedor');
 const start=document.getElementById('auditStart')?.value||'',end=document.getElementById('auditEnd')?.value||'',search=document.getElementById('auditSearch')?.value||'',status=document.getElementById('auditStatus')?.selectedOptions?.[0]?.textContent||'';
 const total=rows.reduce((a,r)=>a+(r.cancelled?0:money(r.cells[9])),0);
 return{headers,rows,seller,start,end,search,status,total,generated:nowBR()};
}
window.printAuditPDF=function(){
 try{
  const r=report();if(!r||!r.rows.length)return alert('Nenhum lançamento disponível no período selecionado.');
  const w=window.open('','_blank');if(!w)return alert('O navegador bloqueou a janela do PDF. Permita pop-ups e tente novamente.');
  const body=r.rows.map(row=>`<tr class="${row.cancelled?'cancelled':''}">${row.cells.map((v,i)=>`<td class="${i>=4&&i<=9?'num':''} ${row.cancelled&&i===9?'strike':''}">${esc(v)}</td>`).join('')}</tr>`).join('');
  const meta=[`Vendedor: ${r.seller}`,`Período: ${fmtIso(r.start)} a ${fmtIso(r.end)}`,r.status?`Filtro: ${r.status}`:'',r.search?`Busca: ${r.search}`:'',`Gerado em: ${r.generated}`].filter(Boolean);
  w.document.open();w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório de Comissões — ISA</title><style>@page{size:A4 landscape;margin:11mm}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#172033;margin:0}.brand{display:flex;align-items:center;gap:10px;border-bottom:2px solid #dfa82f;padding-bottom:10px;margin-bottom:10px}.mark{width:34px;height:34px;border-radius:9px;background:#dfa82f;color:#0b2136;display:grid;place-items:center;font-weight:900;font-size:13px}.brand h1{font-size:19px;margin:0}.brand small{display:block;color:#687483;margin-top:2px}.meta{font-size:9px;color:#5d6874;margin-bottom:10px;display:flex;gap:12px;flex-wrap:wrap}table{width:100%;border-collapse:collapse;font-size:7.7px}th,td{border:1px solid #d9e0e7;padding:4px 5px;vertical-align:top}th{background:#eef2f6;text-align:left}.num{text-align:right;white-space:nowrap}.cancelled td{background:#fff4f4;color:#7b8794}.cancelled td:last-child{color:#b42318;font-weight:700}.strike{text-decoration:line-through;text-decoration-thickness:1.5px;color:#9b1c1c!important}.total td{font-weight:700;background:#fff8e8}.footer{font-size:8px;color:#7a8592;margin-top:8px;display:flex;justify-content:space-between}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><div class="brand"><div class="mark">ISA</div><div><h1>Relatório de Comissões</h1><small>Indômito Seller Assistant</small></div></div><div class="meta">${meta.map(x=>`<span>${esc(x)}</span>`).join('')}</div><table><thead><tr>${r.headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${body}<tr class="total"><td colspan="9">TOTAL DE COMISSÕES ATIVAS</td><td>${esc(brl(r.total))}</td><td colspan="2"></td></tr></tbody></table><div class="footer"><span>Comissões de passeios cancelados são exibidas apenas para histórico e não entram no total.</span><span>Gerado em ${esc(r.generated)}</span></div><script>window.onload=()=>setTimeout(()=>window.print(),180)<\/script></body></html>`);w.document.close();
 }catch(e){console.error(e);alert('Não foi possível gerar o PDF: '+(e?.message||e));}
};
function loadXLSX(){if(window.XLSX)return Promise.resolve(window.XLSX);if(xlsxPromise)return xlsxPromise;xlsxPromise=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';s.async=true;s.onload=()=>window.XLSX?resolve(window.XLSX):reject(new Error('Biblioteca Excel não inicializou.'));s.onerror=()=>reject(new Error('Não foi possível carregar o módulo Excel.'));document.head.appendChild(s)});return xlsxPromise}
function dateCell(v){const m=clean(v).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);return m?new Date(+m[3],+m[2]-1,+m[1]):clean(v)}
window.exportAuditCSV=async function(){
 const btn=[...document.querySelectorAll('button')].find(b=>/Exportar Excel/i.test(b.textContent||'')),original=btn?.textContent||'';
 try{
  const r=report();if(!r||!r.rows.length)return alert('Nenhum lançamento disponível no período selecionado.');if(btn){btn.disabled=true;btn.textContent='Gerando Excel…'}
  const XLSX=await loadXLSX(),data=[['ISA','Indômito Seller Assistant — Relatório de Comissões'],['Gerado em',r.generated],['Vendedor',r.seller,'Período',`${fmtIso(r.start)} a ${fmtIso(r.end)}`],['Filtro',r.status||'Todos','Busca',r.search||'—'],r.headers];
  r.rows.forEach(row=>{const c=row.cells;data.push([dateCell(c[0]),c[1],c[2],c[3],Number(c[4]||0),Number(c[5]||0),money(c[6]),c[7]==='—'?null:money(c[7]),c[8]==='—'?null:money(c[8]),money(c[9]),c[10],row.cancelled?'Cancelado — comissão não contabilizada':c[11]])});
  data.push(['','','','','','','','','TOTAL DE COMISSÕES ATIVAS',r.total,'','']);
  const ws=XLSX.utils.aoa_to_sheet(data,{cellDates:true,dateNF:'dd/mm/yyyy'});ws['!merges']=[XLSX.utils.decode_range('B1:L1')];ws['!cols']=[{wch:14},{wch:13},{wch:30},{wch:38},{wch:8},{wch:8},{wch:17},{wch:17},{wch:17},{wch:22},{wch:30},{wch:34}];ws['!autofilter']={ref:`A5:L${5+r.rows.length}`};
  const ref=(c,row)=>XLSX.utils.encode_cell({c,r:row});for(let rr=5;rr<5+r.rows.length;rr++){const d=ws[ref(0,rr)];if(d&&d.t==='d')d.z='dd/mm/yyyy';for(let c=6;c<=9;c++){const cell=ws[ref(c,rr)];if(cell&&cell.v!=null)cell.z='R$ #,##0.00';}if(r.rows[rr-5].cancelled){const cell=ws[ref(9,rr)];if(cell)cell.s={font:{strike:true,color:{rgb:'9B1C1C'}}};}}
  const tc=ws[ref(9,5+r.rows.length)];if(tc)tc.z='R$ #,##0.00';const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Comissões');wb.Props={Title:'Relatório de Comissões — ISA',Subject:`Gerado em ${r.generated}`,Author:'ISA by Korluz',CreatedDate:new Date()};const suffix=[r.start,r.end].filter(Boolean).join('_a_');XLSX.writeFile(wb,`relatorio_comissoes_${safeFile(r.seller)}${suffix?'_'+suffix:''}.xlsx`,{compression:true,cellStyles:true});
 }catch(e){console.error(e);alert('Não foi possível gerar o Excel: '+(e?.message||e));}finally{if(btn){btn.disabled=false;btn.textContent=original||'Exportar Excel (.xlsx)'}}
};
})();