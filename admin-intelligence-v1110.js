(function(factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(typeof window!=='undefined'){
    window.ISA_ADMIN_INTELLIGENCE=api;
    const start=()=>api.install(window);
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  }
})(function(){
  'use strict';

  const VERSION='11.1.2';
  const CANCELLATION_REASONS=[
    'Desistência do cliente',
    'Falta de pagamento',
    'Condições climáticas',
    'Cancelado pelo operador',
    'Erro de cadastro',
    'Mudança de data',
    'Duplicidade',
    'Outro'
  ];

  const number=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
  const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const esc=v=>clean(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const pad=v=>String(v).padStart(2,'0');
  const iso=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const parseIso=v=>{
    const value=clean(v);
    let m=value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if(m)return `${m[1]}-${m[2]}-${m[3]}`;
    m=value.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/);
    return m?`${m[3]}-${m[2]}-${m[1]}`:'';
  };
  const dateFromIso=v=>{const m=parseIso(v).match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?new Date(+m[1],+m[2]-1,+m[3],12,0,0,0):null};
  const addDays=(value,days)=>{const d=dateFromIso(value);if(!d)return'';d.setDate(d.getDate()+days);return iso(d)};
  const daysBetween=(start,end)=>{const a=dateFromIso(start),b=dateFromIso(end);return a&&b?Math.max(0,Math.round((b-a)/86400000)):0};
  const moneyBRL=cents=>(number(cents)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const pct=v=>`${number(v).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})}%`;
  const dateBR=v=>{const m=parseIso(v).match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[3]}/${m[2]}/${m[1]}`:(clean(v)||'—')};
  const isSaleCancelled=s=>/cancel/.test(norm(s?.status));
  const isTourCancelled=(t,s)=>isSaleCancelled(s)||t?.cancelled===true||t?.cancelChecked===true||/cancel/.test(norm(t?.status));
  const tourKey=v=>norm(v)||'passeio sem nome';
  const hasOwn=(obj,key)=>Object.prototype.hasOwnProperty.call(obj||{},key);

  function previousRange(start,end){
    const length=daysBetween(start,end)+1;
    const previousEnd=addDays(start,-1);
    return{start:addDays(previousEnd,-Math.max(0,length-1)),end:previousEnd};
  }

  function validateCancellationReason(reason,detail=''){
    if(!CANCELLATION_REASONS.includes(clean(reason)))return'Selecione o motivo do cancelamento.';
    if(clean(reason)==='Outro'&&clean(detail).length<3)return'Descreva o motivo em pelo menos 3 caracteres.';
    return'';
  }

  function cancellationLabel(source){
    const code=clean(source?.cancellationReason||source?.cancellation_reason);
    const detail=clean(source?.cancellationReasonDetail||source?.cancellation_reason_detail);
    if(!code)return'';
    return code==='Outro'&&detail?`${code}: ${detail}`:detail?`${code}: ${detail}`:code;
  }

  function collectRows(members){
    const rows=[];
    (Array.isArray(members)?members:[]).forEach((member,memberIndex)=>{
      const state=member?.state&&typeof member.state==='object'?member.state:{};
      const sales=Array.isArray(state.sales)?state.sales:[];
      const sellerId=String(member?.id??memberIndex);
      const seller=clean(member?.full_name||state?.sellerProfile?.name||state?.seller||member?.email||'Sem nome');
      sales.forEach((sale,saleIndex)=>{
        const tours=Array.isArray(sale?.tours)?sale.tours:[];
        if(!tours.length)return;
        const knownRevenue=tours.reduce((sum,t)=>sum+Math.max(0,number(t?.priceCents)),0);
        const missing=tours.filter(t=>number(t?.priceCents)<=0).length;
        const saleValue=Math.max(0,number(sale?.valueCents));
        const remaining=Math.max(0,saleValue-knownRevenue);
        const missingShare=missing?(remaining||(!knownRevenue?saleValue:0))/missing:0;
        const allocated=tours.map(t=>Math.max(0,number(t?.priceCents))||missingShare);
        const allocatedTotal=allocated.reduce((a,v)=>a+v,0)||saleValue||tours.length;
        const paid=Math.max(0,number(sale?.paidCents));
        tours.forEach((tour,tourIndex)=>{
          const revenue=allocated[tourIndex]||0;
          const share=allocatedTotal?revenue/allocatedTotal:1/tours.length;
          const received=Math.min(revenue,paid*share);
          const cancelled=isTourCancelled(tour,sale);
          const reason=cancellationLabel(tour)||cancellationLabel(sale);
          const name=clean(tour?.name||tour?.tour_name_snapshot||'Passeio sem nome');
          const date=parseIso(tour?.date||tour?.tour_date);
          const counts=['adults','children','babies','seniors','free'].reduce((a,k)=>a+number(hasOwn(tour,k)?tour[k]:sale?.[k]),0);
          rows.push({
            sellerId,seller,
            saleKey:`${sellerId}|${String(sale?.id??saleIndex)}`,
            saleId:String(sale?.id??saleIndex),
            client:clean(sale?.name||sale?.clientName||'Cliente não informado'),
            voucher:clean(sale?.voucherFile||sale?.voucherNumber||sale?.external_reference),
            saleStatus:clean(sale?.status),
            tourIndex,name,tourKey:tourKey(name),date,cancelled,reason,
            revenue,received,balance:Math.max(0,revenue-received),
            commission:cancelled?0:Math.max(0,number(tour?.commissionCents)),
            passengers:counts,
            hasExplicitPrice:number(tour?.priceCents)>0,
            hasDate:!!date,
            cancelledAt:clean(tour?.cancelledAt||tour?.cancelled_at||sale?.cancelledAt||sale?.cancelled_at)
          });
        });
      });
    });
    return rows;
  }

  function filterRows(rows,filters={}){
    const start=parseIso(filters.start),end=parseIso(filters.end),sellerId=clean(filters.sellerId),key=clean(filters.tourKey),status=clean(filters.status||'all');
    return(Array.isArray(rows)?rows:[]).filter(row=>{
      if(start&&(!row.date||row.date<start))return false;
      if(end&&(!row.date||row.date>end))return false;
      if(sellerId&&sellerId!=='all'&&String(row.sellerId)!==sellerId)return false;
      if(key&&key!=='all'&&row.tourKey!==key)return false;
      if(status==='active'&&row.cancelled)return false;
      if(status==='cancelled'&&!row.cancelled)return false;
      return true;
    });
  }

  function computeMetrics(rows,today=iso(new Date())){
    const list=Array.isArray(rows)?rows:[];
    const active=list.filter(r=>!r.cancelled),cancelled=list.filter(r=>r.cancelled);
    const saleKeys=new Set(active.map(r=>r.saleKey));
    const revenue=active.reduce((a,r)=>a+r.revenue,0);
    const received=active.reduce((a,r)=>a+r.received,0);
    return{
      sales:saleKeys.size,
      totalSales:new Set(list.map(r=>r.saleKey)).size,
      tours:list.length,
      activeTours:active.length,
      occurred:active.filter(r=>r.date&&r.date<=today).length,
      future:active.filter(r=>r.date&&r.date>today).length,
      cancelled:cancelled.length,
      cancellationRate:list.length?cancelled.length/list.length*100:0,
      revenue,received,balance:Math.max(0,revenue-received),
      commission:active.reduce((a,r)=>a+r.commission,0),
      lostRevenue:cancelled.reduce((a,r)=>a+r.revenue,0),
      averageTicket:saleKeys.size?revenue/saleKeys.size:0,
      passengers:active.reduce((a,r)=>a+r.passengers,0),
      missingPrice:list.filter(r=>!r.hasExplicitPrice).length,
      missingDate:list.filter(r=>!r.hasDate).length,
      cancellationsWithoutReason:cancelled.filter(r=>!r.reason).length
    };
  }

  function aggregateTours(rows){
    const map=new Map();
    (Array.isArray(rows)?rows:[]).forEach(row=>{
      let item=map.get(row.tourKey);
      if(!item){item={key:row.tourKey,name:row.name,occurrences:0,active:0,cancelled:0,revenue:0,received:0,balance:0,commission:0,lostRevenue:0};map.set(row.tourKey,item)}
      item.occurrences++;
      if(row.cancelled){item.cancelled++;item.lostRevenue+=row.revenue}else{item.active++;item.revenue+=row.revenue;item.received+=row.received;item.balance+=row.balance;item.commission+=row.commission}
    });
    return[...map.values()].map(x=>({...x,cancellationRate:x.occurrences?x.cancelled/x.occurrences*100:0}));
  }

  function aggregateSellers(rows){
    const map=new Map();
    (Array.isArray(rows)?rows:[]).forEach(row=>{
      let item=map.get(row.sellerId);
      if(!item){item={id:row.sellerId,name:row.seller,saleKeys:new Set(),occurrences:0,active:0,cancelled:0,revenue:0,received:0,balance:0,commission:0,lostRevenue:0};map.set(row.sellerId,item)}
      item.occurrences++;
      if(row.cancelled){item.cancelled++;item.lostRevenue+=row.revenue}else{item.active++;item.saleKeys.add(row.saleKey);item.revenue+=row.revenue;item.received+=row.received;item.balance+=row.balance;item.commission+=row.commission}
    });
    return[...map.values()].map(x=>({id:x.id,name:x.name,sales:x.saleKeys.size,occurrences:x.occurrences,active:x.active,cancelled:x.cancelled,revenue:x.revenue,received:x.received,balance:x.balance,commission:x.commission,lostRevenue:x.lostRevenue,cancellationRate:x.occurrences?x.cancelled/x.occurrences*100:0}));
  }

  function buildDataset(members,filters={},today=iso(new Date())){
    const allRows=collectRows(members);
    const rows=filterRows(allRows,filters);
    const range=previousRange(filters.start,filters.end);
    const previousFilters={...filters,start:range.start,end:range.end};
    const previousRows=filterRows(allRows,previousFilters);
    return{
      allRows,rows,metrics:computeMetrics(rows,today),previous:computeMetrics(previousRows,today),previousRange:range,
      tours:aggregateTours(rows),sellers:aggregateSellers(rows)
    };
  }

  function groupSales(rows){
    const map=new Map();
    rows.forEach(row=>{
      let item=map.get(row.saleKey);
      if(!item){item={saleKey:row.saleKey,seller:row.seller,client:row.client,voucher:row.voucher,dates:[],tours:[],active:0,cancelled:0,revenue:0,received:0,balance:0,commission:0,lostRevenue:0};map.set(row.saleKey,item)}
      if(row.date)item.dates.push(row.date);item.tours.push(row.name);
      if(row.cancelled){item.cancelled++;item.lostRevenue+=row.revenue}else{item.active++;item.revenue+=row.revenue;item.received+=row.received;item.balance+=row.balance;item.commission+=row.commission}
    });
    return[...map.values()].map(x=>({...x,date:x.dates.sort()[0]||'',status:x.active?'Ativa':'Cancelada',tourNames:[...new Set(x.tours)].join(', ')}));
  }

  function buildReport(dataset,type='tours'){
    const data=dataset||{rows:[],tours:[],sellers:[]};
    if(type==='cancellations'){
      const rows=(data.rows||[]).filter(r=>r.cancelled).slice().sort((a,b)=>(a.date||'').localeCompare(b.date||'')).map(r=>[r.date,r.seller,r.client,r.voucher,r.name,r.revenue,r.reason||'Não informado (registro anterior)']);
      return{type,title:'Relatório de cancelamentos',columns:[['Data','date'],['Vendedor','text'],['Cliente','text'],['Voucher','text'],['Passeio','text'],['Faturamento perdido','money'],['Motivo','text']],rows};
    }
    if(type==='sales'){
      const rows=groupSales(data.rows||[]).sort((a,b)=>(a.date||'').localeCompare(b.date||'')).map(x=>[x.date,x.seller,x.client,x.voucher,x.tourNames,x.status,x.revenue,x.received,x.balance,x.commission,x.lostRevenue]);
      return{type,title:'Relatório de vendas e recebimentos',columns:[['Data','date'],['Vendedor','text'],['Cliente','text'],['Voucher','text'],['Passeios','text'],['Status','text'],['Faturamento','money'],['Recebido','money'],['Saldo','money'],['Comissão','money'],['Cancelado','money']],rows};
    }
    if(type==='sellers'){
      const rows=(data.sellers||[]).slice().sort((a,b)=>b.revenue-a.revenue).map(x=>[x.name,x.sales,x.occurrences,x.cancelled,x.cancellationRate,x.revenue,x.received,x.balance,x.commission]);
      return{type,title:'Relatório de desempenho por vendedor',columns:[['Vendedor','text'],['Vendas','integer'],['Passeios','integer'],['Cancelados','integer'],['Taxa de cancelamento','percent'],['Faturamento','money'],['Recebido','money'],['Saldo','money'],['Comissão','money']],rows};
    }
    const rows=(data.tours||[]).slice().sort((a,b)=>b.revenue-a.revenue||b.occurrences-a.occurrences).map(x=>[x.name,x.occurrences,x.active,x.cancelled,x.cancellationRate,x.revenue,x.received,x.balance,x.commission,x.lostRevenue]);
    return{type:'tours',title:'Relatório de desempenho dos passeios',columns:[['Passeio','text'],['Total','integer'],['Ativos','integer'],['Cancelados','integer'],['Taxa de cancelamento','percent'],['Faturamento','money'],['Recebido','money'],['Saldo','money'],['Comissão','money'],['Faturamento perdido','money']],rows};
  }

  function trend(rows,start,end){
    const monthly=daysBetween(start,end)>62,map=new Map();
    rows.forEach(r=>{
      if(!r.date)return;const key=monthly?r.date.slice(0,7):r.date;
      const item=map.get(key)||{key,revenue:0,cancelled:0};
      if(r.cancelled)item.cancelled++;else item.revenue+=r.revenue;map.set(key,item);
    });
    return[...map.values()].sort((a,b)=>a.key.localeCompare(b.key));
  }

  function formatValue(value,type){
    if(type==='money')return moneyBRL(value);
    if(type==='percent')return pct(value);
    if(type==='date')return dateBR(value);
    if(type==='integer')return number(value).toLocaleString('pt-BR',{maximumFractionDigits:0});
    return clean(value)||'—';
  }

  const browser={win:null,installed:false,landed:false,dataset:null,reportType:'tours',filters:null,landingTimer:null};

  function defaultFilters(){const d=new Date(),today=iso(d);return{start:`${d.getFullYear()}-${pad(d.getMonth()+1)}-01`,end:today,sellerId:'all',tourKey:'all',status:'all'}}

  function setSelectOptions(select,items,value){
    if(!select)return;
    select.innerHTML='';
    items.forEach(item=>{const option=document.createElement('option');option.value=String(item.value);option.textContent=item.label;select.appendChild(option)});
    select.value=items.some(x=>String(x.value)===String(value))?String(value):String(items[0]?.value||'');
  }

  function ensureRoot(){
    const w=browser.win,admin=w?.document?.getElementById('admin');if(!admin)return null;
    let root=w.document.getElementById('adminIntelligenceV1110');
    if(root)return root;
    root=w.document.createElement('div');root.id='adminIntelligenceV1110';root.className='ai-shell';
    root.innerHTML=`
      <section class="ai-head">
       <div class="ai-head-row"><div><div class="ai-kicker">Visão gerencial • V11.1</div><h2>Central de Inteligência</h2><p>Decisões comerciais e operacionais reunidas em uma leitura única. O período usa a data de cada passeio e exclui cancelados do faturamento efetivo.</p></div>
       <div class="ai-head-actions"><button class="btn light sm" type="button" data-ai-refresh>↻ Atualizar dados</button><button class="btn light sm" type="button" data-ai-pdf>Gerar PDF</button><button class="btn gold sm" type="button" data-ai-excel>Exportar Excel</button></div></div>
      </section>
      <section class="ai-filterbar" aria-label="Filtros da Central de Inteligência">
       <div class="ai-filter"><label for="aiStart">Data inicial</label><input id="aiStart" type="date"></div>
       <div class="ai-filter"><label for="aiEnd">Data final</label><input id="aiEnd" type="date"></div>
       <div class="ai-filter"><label for="aiSeller">Vendedor</label><select id="aiSeller"></select></div>
       <div class="ai-filter"><label for="aiTour">Passeio</label><select id="aiTour"></select></div>
       <div class="ai-filter"><label for="aiStatus">Situação</label><select id="aiStatus"><option value="all">Ativos e cancelados</option><option value="active">Somente ativos</option><option value="cancelled">Somente cancelados</option></select></div>
       <div class="ai-filter-actions"><button class="btn light sm" type="button" data-ai-today>Hoje</button><button class="btn light sm" type="button" data-ai-month>Mês atual</button></div>
      </section>
      <div class="ai-data-note" id="aiDataNote"></div>
      <section class="ai-kpi-grid" id="aiKpis"></section>
      <section class="ai-insights" id="aiInsights"></section>
      <section class="ai-analytics-grid"><article class="ai-card"><div class="ai-card-head"><div><h3>Evolução do faturamento</h3><p>Receita efetiva por data do passeio; o ponto vermelho identifica cancelamentos.</p></div><span class="ai-card-tag" id="aiTrendTag">Período</span></div><div id="aiTrend"></div></article><article class="ai-card"><div class="ai-card-head"><div><h3>Maior faturamento</h3><p>Passeios que mais geraram receita no período.</p></div><span class="ai-card-tag">Top 5</span></div><div class="ai-rank-list" id="aiTopRevenue"></div></article></section>
      <section class="ai-rank-grid">
       <article class="ai-card"><div class="ai-card-head"><div><h3>Menor faturamento</h3><p>Leia junto com o volume para não confundir baixa procura com baixo valor.</p></div><span class="ai-card-tag">5 menores</span></div><div class="ai-rank-list" id="aiLowRevenue"></div></article>
       <article class="ai-card"><div class="ai-card-head"><div><h3>Mais vendidos</h3><p>Quantidade de passeios registrados no período.</p></div><span class="ai-card-tag">Top 5</span></div><div class="ai-rank-list" id="aiTopVolume"></div></article>
       <article class="ai-card"><div class="ai-card-head"><div><h3>Mais cancelados</h3><p>Quantidade e taxa proporcional de cancelamento.</p></div><span class="ai-card-tag">Risco</span></div><div class="ai-rank-list" id="aiTopCancellation"></div></article>
       <article class="ai-card"><div class="ai-card-head"><div><h3>Vendedores por faturamento</h3><p>Visão comparativa da equipe no mesmo período.</p></div><span class="ai-card-tag">Equipe</span></div><div class="ai-rank-list" id="aiSellerRanking"></div></article>
      </section>
      <section class="ai-card"><div class="ai-card-head"><div><h3>Central de Relatórios</h3><p>Use os mesmos filtros acima e gere documentos gerenciais em PDF ou Excel.</p></div><span class="ai-card-tag">PDF + XLSX</span></div><div class="ai-report-toolbar"><select id="aiReportType"><option value="tours">Desempenho dos passeios</option><option value="cancellations">Cancelamentos e motivos</option><option value="sales">Vendas e recebimentos</option><option value="sellers">Desempenho dos vendedores</option></select><div class="ai-report-actions"><button class="btn light sm" type="button" data-ai-pdf>Gerar PDF</button><button class="btn gold sm" type="button" data-ai-excel>Exportar Excel</button></div></div><div id="aiReport"></div></section>`;
    const hero=admin.querySelector('.admin-hero');if(hero)hero.after(root);else admin.prepend(root);
    const legacy=admin.querySelector('.admin-kpis');
    if(legacy&&!w.document.getElementById('aiOperationTitle')){
      const title=w.document.createElement('div');title.id='aiOperationTitle';title.className='ai-operation-title';title.innerHTML='<div><h2>Equipe e operação imediata</h2><p>Contas, pendências de amanhã e acompanhamento individual.</p></div><span class="ai-card-tag">Operação</span>';legacy.before(title);
    }
    root.addEventListener('change',event=>{
      if(['aiStart','aiEnd','aiSeller','aiTour','aiStatus'].includes(event.target.id))render();
      if(event.target.id==='aiReportType'){browser.reportType=event.target.value;renderReport()}
    });
    root.addEventListener('click',event=>{
      const target=event.target.closest('[data-ai-refresh],[data-ai-pdf],[data-ai-excel],[data-ai-today],[data-ai-month],[data-ai-tour]');if(!target)return;
      if(target.hasAttribute('data-ai-refresh'))return typeof w.loadAdminPanel==='function'&&w.loadAdminPanel(true);
      if(target.hasAttribute('data-ai-pdf'))return exportPDF();
      if(target.hasAttribute('data-ai-excel'))return exportExcel();
      if(target.hasAttribute('data-ai-today')){const d=iso(new Date());w.document.getElementById('aiStart').value=d;w.document.getElementById('aiEnd').value=d;return render()}
      if(target.hasAttribute('data-ai-month')){const f=defaultFilters();w.document.getElementById('aiStart').value=f.start;w.document.getElementById('aiEnd').value=f.end;return render()}
      if(target.hasAttribute('data-ai-tour')){const select=w.document.getElementById('aiTour');if(select){select.value=target.getAttribute('data-ai-tour');render();select.scrollIntoView({behavior:'smooth',block:'center'})}}
    });
    return root;
  }

  function deltaLabel(current,previous,inverse=false){
    const a=number(current),b=number(previous);
    if(!a&&!b)return'<span class="ai-delta neutral">sem movimento anterior</span>';
    if(!b)return`<span class="ai-delta ${inverse?'down':'up'}">novo no período</span>`;
    const change=(a-b)/Math.abs(b)*100;
    if(Math.abs(change)<.05)return'<span class="ai-delta neutral">estável</span>';
    const positive=change>0,good=inverse?!positive:positive;
    return`<span class="ai-delta ${good?'up':'down'}">${positive?'▲':'▼'} ${Math.abs(change).toLocaleString('pt-BR',{maximumFractionDigits:0})}% vs. anterior</span>`;
  }

  function renderKpis(dataset){
    const box=browser.win.document.getElementById('aiKpis');if(!box)return;
    const m=dataset.metrics,p=dataset.previous;
    const items=[
      ['Faturamento efetivo',moneyBRL(m.revenue),'Passeios ativos no período','green','R$',deltaLabel(m.revenue,p.revenue)],
      ['Valor recebido',moneyBRL(m.received),m.revenue?`${pct(m.received/m.revenue*100)} do faturamento`:'Sem faturamento','green','✓',deltaLabel(m.received,p.received)],
      ['Saldo a receber',moneyBRL(m.balance),'Valor ainda pendente','gold','⌛',deltaLabel(m.balance,p.balance,true)],
      ['Vendas',m.sales.toLocaleString('pt-BR'),`${m.activeTours} passeio(s) ativo(s)`,'','▣',deltaLabel(m.sales,p.sales)],
      ['Passeios ocorridos',m.occurred.toLocaleString('pt-BR'),'Data já passou e não foi cancelado','purple','◆',deltaLabel(m.occurred,p.occurred)],
      ['Passeios futuros',m.future.toLocaleString('pt-BR'),'Programados após hoje','','→',deltaLabel(m.future,p.future)],
      ['Cancelados',m.cancelled.toLocaleString('pt-BR'),`${pct(m.cancellationRate)} do total`,'red','×',deltaLabel(m.cancelled,p.cancelled,true)],
      ['Faturamento perdido',moneyBRL(m.lostRevenue),'Valor dos serviços cancelados','red','!',deltaLabel(m.lostRevenue,p.lostRevenue,true)],
      ['Ticket médio',moneyBRL(m.averageTicket),'Média por venda ativa','gold','◉',deltaLabel(m.averageTicket,p.averageTicket)],
      ['Comissão prevista',moneyBRL(m.commission),'Cancelados não entram no total','purple','R$',deltaLabel(m.commission,p.commission)]
    ];
    box.innerHTML=items.map(x=>`<article class="ai-kpi ${x[3]}"><div class="ai-kpi-label"><span>${esc(x[0])}</span><span>${esc(x[4])}</span></div><div class="ai-kpi-value">${esc(x[1])}</div><div class="ai-kpi-sub">${esc(x[2])}</div>${x[5]}</article>`).join('');
  }

  function renderInsights(dataset){
    const box=browser.win.document.getElementById('aiInsights');if(!box)return;
    const m=dataset.metrics,products=dataset.tours.slice().sort((a,b)=>b.revenue-a.revenue),items=[];
    if(products[0]&&m.revenue){const share=products[0].revenue/m.revenue*100;items.push({tone:'ok',icon:'↗',title:'Líder de faturamento',text:`${products[0].name} representa ${pct(share)} da receita do período.`})}
    else items.push({tone:'',icon:'i',title:'Período sem faturamento',text:'Ajuste as datas ou aguarde novos passeios sincronizados.'});
    if(!m.cancelled)items.push({tone:'ok',icon:'✓',title:'Nenhum cancelamento',text:'Não há passeio cancelado dentro dos filtros selecionados.'});
    else if(m.cancellationRate>=15)items.push({tone:'danger',icon:'!',title:'Cancelamentos pedem atenção',text:`A taxa chegou a ${pct(m.cancellationRate)}; abra o relatório para identificar os motivos.`});
    else items.push({tone:'warn',icon:'×',title:'Cancelamentos monitorados',text:`${m.cancelled} cancelamento(s), equivalentes a ${moneyBRL(m.lostRevenue)} em faturamento perdido.`});
    if(m.cancellationsWithoutReason)items.push({tone:'warn',icon:'?',title:'Histórico sem motivo',text:`${m.cancellationsWithoutReason} cancelamento(s) antigo(s) ainda não possui(em) motivo estruturado.`});
    else if(m.balance>0)items.push({tone:'warn',icon:'⌛',title:'Recebimentos pendentes',text:`Há ${moneyBRL(m.balance)} a receber no período selecionado.`});
    else items.push({tone:'ok',icon:'●',title:'Dados prontos para análise',text:'Datas, valores e cancelamentos do período estão consistentes para esta leitura.'});
    box.innerHTML=items.slice(0,3).map(x=>`<article class="ai-insight ${x.tone}"><div class="ai-insight-icon">${esc(x.icon)}</div><div><strong>${esc(x.title)}</strong><span>${esc(x.text)}</span></div></article>`).join('');
  }

  function rankHtml(items,valueFn,labelFn,color=''){const max=Math.max(0,...items.map(valueFn));return items.length?items.map(item=>`<button class="ai-rank-row" type="button" data-ai-tour="${esc(item.key)}" title="Filtrar por ${esc(item.name)}"><span class="ai-rank-name">${esc(item.name)}</span><span class="ai-rank-value">${esc(labelFn(item))}</span><span class="ai-rank-track"><span class="ai-rank-fill ${color}" style="width:${max?Math.max(3,valueFn(item)/max*100):0}%"></span></span></button>`).join(''):'<div class="ai-empty">Ainda não há dados suficientes neste período.</div>'}
  function sellerRankHtml(items){const max=Math.max(0,...items.map(x=>x.revenue));return items.length?items.map(item=>`<div class="ai-rank-row"><span class="ai-rank-name">${esc(item.name)}</span><span class="ai-rank-value">${esc(moneyBRL(item.revenue))}</span><span class="ai-rank-track"><span class="ai-rank-fill green" style="width:${max?Math.max(3,item.revenue/max*100):0}%"></span></span></div>`).join(''):'<div class="ai-empty">Nenhum vendedor com faturamento no período.</div>'}

  function renderRankings(dataset){
    const positive=dataset.tours.filter(x=>x.revenue>0),top=positive.slice().sort((a,b)=>b.revenue-a.revenue).slice(0,5),low=positive.slice().sort((a,b)=>a.revenue-b.revenue).slice(0,5),volume=dataset.tours.slice().sort((a,b)=>b.occurrences-a.occurrences||b.revenue-a.revenue).slice(0,5),cancel=dataset.tours.filter(x=>x.cancelled>0).sort((a,b)=>b.cancellationRate-a.cancellationRate||b.cancelled-a.cancelled).slice(0,5),sellers=dataset.sellers.filter(x=>x.revenue>0).sort((a,b)=>b.revenue-a.revenue).slice(0,5);
    browser.win.document.getElementById('aiTopRevenue').innerHTML=rankHtml(top,x=>x.revenue,x=>moneyBRL(x.revenue));
    browser.win.document.getElementById('aiLowRevenue').innerHTML=rankHtml(low,x=>x.revenue,x=>`${moneyBRL(x.revenue)} • ${x.occurrences} un.`, 'gold');
    browser.win.document.getElementById('aiTopVolume').innerHTML=rankHtml(volume,x=>x.occurrences,x=>`${x.occurrences} passeio(s)`,'green');
    browser.win.document.getElementById('aiTopCancellation').innerHTML=cancel.length?rankHtml(cancel,x=>x.cancellationRate,x=>`${x.cancelled} • ${pct(x.cancellationRate)}`,'red'):'<div class="ai-empty">Excelente: nenhum cancelamento foi registrado neste período.</div>';
    browser.win.document.getElementById('aiSellerRanking').innerHTML=sellerRankHtml(sellers);
  }

  function renderTrend(dataset,filters){
    const box=browser.win.document.getElementById('aiTrend'),points=trend(dataset.rows,filters.start,filters.end),max=Math.max(0,...points.map(x=>x.revenue));if(!box)return;
    browser.win.document.getElementById('aiTrendTag').textContent=daysBetween(filters.start,filters.end)>62?'Por mês':'Por dia';
    if(!points.length){box.innerHTML='<div class="ai-chart-empty">Sem movimento no período selecionado.</div>';return}
    box.innerHTML=`<div class="ai-chart-scroll"><div class="ai-chart">${points.map(x=>{const h=max?Math.max(2,x.revenue/max*145):2,label=x.key.length===7?`${x.key.slice(5)}/${x.key.slice(2,4)}`:`${x.key.slice(8)}/${x.key.slice(5,7)}`;return`<div class="ai-chart-column" title="${esc(dateBR(x.key))}: ${esc(moneyBRL(x.revenue))}${x.cancelled?` • ${x.cancelled} cancelado(s)`:''}"><span class="ai-chart-value">${esc(moneyBRL(x.revenue))}</span><span class="ai-chart-bar ${x.cancelled?'has-cancel':''}" style="height:${h}px"></span><span class="ai-chart-label">${esc(label)}</span></div>`}).join('')}</div></div><div class="ai-chart-legend"><span><i></i> Faturamento</span><span><i class="red"></i> Dia com cancelamento</span></div>`;
  }

  function renderReport(){
    const box=browser.win?.document?.getElementById('aiReport');if(!box||!browser.dataset)return;
    const report=buildReport(browser.dataset,browser.reportType),select=browser.win.document.getElementById('aiReportType');if(select)select.value=browser.reportType;
    browser.currentReport=report;
    if(!report.rows.length){box.innerHTML='<div class="ai-empty">Nenhum registro encontrado com os filtros atuais.</div>';return}
    box.innerHTML=`<div class="ai-table-wrap"><table class="ai-table"><thead><tr>${report.columns.map(c=>`<th>${esc(c[0])}</th>`).join('')}</tr></thead><tbody>${report.rows.map(row=>`<tr>${row.map((v,i)=>`<td class="${['money','percent','integer'].includes(report.columns[i][1])?'num':''}">${i===0&&report.columns[i][1]==='text'?`<strong>${esc(formatValue(v,report.columns[i][1]))}</strong>`:esc(formatValue(v,report.columns[i][1]))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }

  function readFilters(){
    const d=defaultFilters(),doc=browser.win.document;
    return{start:doc.getElementById('aiStart')?.value||d.start,end:doc.getElementById('aiEnd')?.value||d.end,sellerId:doc.getElementById('aiSeller')?.value||'all',tourKey:doc.getElementById('aiTour')?.value||'all',status:doc.getElementById('aiStatus')?.value||'all'};
  }

  function render(){
    const w=browser.win;if(!w||String(w.ISA_ROLE||'').toLowerCase()!=='admin')return;
    const root=ensureRoot();if(!root)return;
    const cache=w.ISA_ADMIN_CACHE||{},members=Array.isArray(cache.members)?cache.members:[];
    const doc=w.document,d=browser.filters||defaultFilters();
    if(!doc.getElementById('aiStart').value)doc.getElementById('aiStart').value=d.start;
    if(!doc.getElementById('aiEnd').value)doc.getElementById('aiEnd').value=d.end;
    const allRows=collectRows(members),current=readFilters();
    const sellerItems=[{value:'all',label:'Toda a equipe'},...members.map(m=>({value:String(m.id),label:clean(m.full_name||m.state?.sellerProfile?.name||m.state?.seller||m.email||'Sem nome')})).sort((a,b)=>a.label.localeCompare(b.label,'pt-BR'))];
    const productMap=new Map();allRows.forEach(r=>{if(!productMap.has(r.tourKey))productMap.set(r.tourKey,r.name)});
    const tourItems=[{value:'all',label:'Todos os passeios'},...[...productMap].map(([value,label])=>({value,label})).sort((a,b)=>a.label.localeCompare(b.label,'pt-BR'))];
    setSelectOptions(doc.getElementById('aiSeller'),sellerItems,current.sellerId);
    setSelectOptions(doc.getElementById('aiTour'),tourItems,current.tourKey);
    doc.getElementById('aiStatus').value=current.status;
    browser.filters=readFilters();browser.dataset=buildDataset(members,browser.filters,iso(new Date()));
    const range=browser.dataset.previousRange,m=browser.dataset.metrics;
    doc.getElementById('aiDataNote').innerHTML=`<span>ⓘ</span><span><strong>${m.tours} passeio(s)</strong> analisado(s). Comparação automática com ${esc(dateBR(range.start))} a ${esc(dateBR(range.end))}. Faturamento usa o preço individual do passeio; cancelados permanecem no histórico, mas ficam fora da receita efetiva.</span>`;
    renderKpis(browser.dataset);renderInsights(browser.dataset);renderTrend(browser.dataset,browser.filters);renderRankings(browser.dataset);renderReport();
  }

  function reportMeta(){const f=browser.filters||defaultFilters();return{period:`${dateBR(f.start)} a ${dateBR(f.end)}`,generated:new Date().toLocaleString('pt-BR'),seller:browser.win.document.getElementById('aiSeller')?.selectedOptions?.[0]?.textContent||'Toda a equipe',tour:browser.win.document.getElementById('aiTour')?.selectedOptions?.[0]?.textContent||'Todos os passeios',status:browser.win.document.getElementById('aiStatus')?.selectedOptions?.[0]?.textContent||'Todos'}}
  function safeFile(v){return norm(v).replace(/\s+/g,'_').slice(0,55)||'relatorio'}

  function exportPDF(){
    const w=browser.win,report=browser.currentReport||buildReport(browser.dataset,browser.reportType);if(!report.rows.length)return w.alert('Nenhum registro disponível para este relatório.');
    const meta=reportMeta(),popup=w.open('','_blank');if(!popup)return w.alert('O navegador bloqueou a janela do PDF. Permita pop-ups e tente novamente.');
    const head=report.columns.map(c=>`<th>${esc(c[0])}</th>`).join(''),body=report.rows.map(row=>`<tr>${row.map((v,i)=>`<td class="${['money','percent','integer'].includes(report.columns[i][1])?'num':''}">${esc(formatValue(v,report.columns[i][1]))}</td>`).join('')}</tr>`).join('');
    popup.document.open();popup.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(report.title)} — ISA</title><style>@page{size:A4 landscape;margin:10mm}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#172033;margin:0}.brand{display:flex;align-items:center;gap:10px;border-bottom:2px solid #dfa82f;padding-bottom:9px;margin-bottom:9px}.mark{width:34px;height:34px;border-radius:9px;background:#dfa82f;color:#0b2136;display:grid;place-items:center;font-weight:900}.brand h1{font-size:18px;margin:0}.brand small,.meta,.footer{color:#697786;font-size:8px}.meta{display:flex;gap:11px;flex-wrap:wrap;margin:0 0 9px}table{width:100%;border-collapse:collapse;font-size:7.5px}th,td{border:1px solid #dbe3ea;padding:4px 5px;vertical-align:top}th{background:#edf3f7;text-align:left}.num{text-align:right;white-space:nowrap}.summary{display:flex;gap:8px;margin-bottom:9px}.pill{border:1px solid #dbe3ea;border-radius:8px;padding:6px 8px;font-size:8px}.pill strong{display:block;font-size:11px;margin-top:2px}.footer{display:flex;justify-content:space-between;margin-top:7px}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><div class="brand"><div class="mark">ISA</div><div><h1>${esc(report.title)}</h1><small>Central de Inteligência Administrativa</small></div></div><div class="meta"><span>Período: ${esc(meta.period)}</span><span>Vendedor: ${esc(meta.seller)}</span><span>Passeio: ${esc(meta.tour)}</span><span>Situação: ${esc(meta.status)}</span></div><div class="summary"><div class="pill">Faturamento<strong>${esc(moneyBRL(browser.dataset.metrics.revenue))}</strong></div><div class="pill">Recebido<strong>${esc(moneyBRL(browser.dataset.metrics.received))}</strong></div><div class="pill">Cancelamentos<strong>${browser.dataset.metrics.cancelled}</strong></div><div class="pill">Comissão<strong>${esc(moneyBRL(browser.dataset.metrics.commission))}</strong></div></div><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table><div class="footer"><span>Cancelados são preservados no histórico e não compõem o faturamento efetivo.</span><span>Gerado em ${esc(meta.generated)} • ISA V${VERSION}</span></div><script>window.onload=()=>setTimeout(()=>window.print(),180)<\/script></body></html>`);popup.document.close();
  }

  function loadXLSX(){
    const w=browser.win;if(w.XLSX)return Promise.resolve(w.XLSX);if(browser.xlsxPromise)return browser.xlsxPromise;
    browser.xlsxPromise=new Promise((resolve,reject)=>{const script=w.document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';script.async=true;script.onload=()=>w.XLSX?resolve(w.XLSX):reject(new Error('O módulo de Excel não inicializou.'));script.onerror=()=>reject(new Error('Não foi possível carregar o módulo de Excel.'));w.document.head.appendChild(script)});return browser.xlsxPromise;
  }

  async function exportExcel(){
    const w=browser.win,report=browser.currentReport||buildReport(browser.dataset,browser.reportType);if(!report.rows.length)return w.alert('Nenhum registro disponível para este relatório.');
    try{
      const XLSX=await loadXLSX(),meta=reportMeta(),data=[['ISA',report.title],['Gerado em',meta.generated],['Período',meta.period,'Vendedor',meta.seller],['Passeio',meta.tour,'Situação',meta.status],report.columns.map(c=>c[0])];
      report.rows.forEach(row=>data.push(row.map((v,i)=>report.columns[i][1]==='money'?number(v)/100:report.columns[i][1]==='percent'?number(v)/100:v)));
      const ws=XLSX.utils.aoa_to_sheet(data);ws['!merges']=[XLSX.utils.decode_range(`B1:${String.fromCharCode(64+Math.min(26,report.columns.length))}1`)];ws['!autofilter']={ref:`A5:${String.fromCharCode(64+Math.min(26,report.columns.length))}${4+report.rows.length}`};ws['!freeze']={xSplit:0,ySplit:5,topLeftCell:'A6',activePane:'bottomLeft',state:'frozen'};ws['!cols']=report.columns.map((c,i)=>({wch:Math.min(42,Math.max(c[0].length+3,i===0?24:13))}));
      report.rows.forEach((row,r)=>report.columns.forEach((column,c)=>{const cell=ws[XLSX.utils.encode_cell({r:r+5,c})];if(!cell)return;if(column[1]==='money')cell.z='R$ #,##0.00';if(column[1]==='percent')cell.z='0.0%'}));
      const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Relatório');wb.Props={Title:`${report.title} — ISA`,Author:'ISA',Company:'ISA',CreatedDate:new Date()};XLSX.writeFile(wb,`${safeFile(report.title)}_${browser.filters.start}_a_${browser.filters.end}.xlsx`,{compression:true});
    }catch(error){console.error('Falha ao exportar relatório gerencial',error);w.alert('Não foi possível gerar o Excel: '+clean(error?.message||error))}
  }

  function ensureCancellationModal(){
    const w=browser.win;let modal=w.document.getElementById('aiCancellationModal');if(modal)return modal;
    modal=w.document.createElement('div');modal.id='aiCancellationModal';modal.className='ai-cancel-backdrop';modal.setAttribute('aria-hidden','true');modal.innerHTML=`<div class="ai-cancel-dialog" role="dialog" aria-modal="true" aria-labelledby="aiCancelTitle"><div class="ai-cancel-head"><h2 id="aiCancelTitle">Registrar cancelamento</h2><p id="aiCancelSubtitle">O motivo ficará disponível nos indicadores e relatórios gerenciais.</p></div><div class="ai-cancel-body"><label>Motivo do cancelamento<select id="aiCancelReason"><option value="">Selecione...</option>${CANCELLATION_REASONS.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('')}</select></label><label id="aiCancelDetailWrap" hidden>Detalhes<textarea id="aiCancelDetail" placeholder="Descreva o motivo"></textarea></label><div class="ai-cancel-error" id="aiCancelError"></div></div><div class="ai-cancel-actions"><button class="btn light" type="button" data-ai-cancel-close>Voltar</button><button class="btn red" type="button" data-ai-cancel-confirm>Confirmar cancelamento</button></div></div>`;w.document.body.appendChild(modal);return modal;
  }

  function requestCancellationReason(context='',initial={}){
    const modal=ensureCancellationModal(),w=browser.win,select=modal.querySelector('#aiCancelReason'),detail=modal.querySelector('#aiCancelDetail'),wrap=modal.querySelector('#aiCancelDetailWrap'),error=modal.querySelector('#aiCancelError');
    modal.querySelector('#aiCancelSubtitle').textContent=context?`${context}. O motivo ficará disponível nos indicadores e relatórios gerenciais.`:'O motivo ficará disponível nos indicadores e relatórios gerenciais.';
    select.value=CANCELLATION_REASONS.includes(clean(initial.reason))?clean(initial.reason):initial.reason?'Outro':'';detail.value=clean(initial.detail||(select.value==='Outro'&&!CANCELLATION_REASONS.includes(clean(initial.reason))?initial.reason:''));wrap.hidden=select.value!=='Outro';error.textContent='';modal.classList.add('open');modal.setAttribute('aria-hidden','false');select.focus();
    return new Promise(resolve=>{
      const close=value=>{modal.classList.remove('open');modal.setAttribute('aria-hidden','true');select.onchange=null;modal.querySelector('[data-ai-cancel-close]').onclick=null;modal.querySelector('[data-ai-cancel-confirm]').onclick=null;modal.onclick=null;resolve(value)};
      select.onchange=()=>{wrap.hidden=select.value!=='Outro';error.textContent='';if(select.value==='Outro')detail.focus()};
      modal.querySelector('[data-ai-cancel-close]').onclick=()=>close(null);
      modal.querySelector('[data-ai-cancel-confirm]').onclick=()=>{const message=validateCancellationReason(select.value,detail.value);if(message){error.textContent=message;return}close({reason:select.value,detail:select.value==='Outro'?clean(detail.value):'',label:select.value==='Outro'?`Outro: ${clean(detail.value)}`:select.value})};
      modal.onclick=event=>{if(event.target===modal)close(null)};
    });
  }

  function liveSale(id){return(browser.win?.db?.sales||[]).find(s=>String(s.id)===String(id))}
  function liveHistory(sale,text){if(typeof browser.win.addHistory==='function')browser.win.addHistory(sale,text);else{sale.history=Array.isArray(sale.history)?sale.history:[];sale.history.unshift({at:new Date().toISOString(),text})}}
  function applyReason(target,payload){target.cancellationReason=payload.reason;target.cancellationReasonDetail=payload.detail||'';target.cancelledAt=new Date().toISOString()}
  function liveSave(){if(typeof browser.win.save==='function')browser.win.save()}

  async function cancelWholeSaleManaged(id,closeDetail=false){
    const sale=liveSale(id);if(!sale)return false;const payload=await requestCancellationReason(`Venda de ${sale.name||'cliente não informado'}`);if(!payload)return false;
    applyReason(sale,payload);(sale.tours||[]).forEach(t=>{const wasCancelled=t?.cancelled===true||t?.cancelChecked===true||/cancel/.test(norm(t?.status));t.cancelled=true;t.cancelChecked=true;if(!wasCancelled||!cancellationLabel(t))applyReason(t,payload)});sale.status='Cancelado';liveHistory(sale,`Venda inteira cancelada — motivo: ${payload.label}`);liveSave();if(closeDetail&&typeof browser.win.closeDetail==='function')browser.win.closeDetail();return true;
  }

  async function cancelTourManaged(saleId,tourName){
    const sale=liveSale(saleId),tour=sale?.tours?.find(t=>String(t.name)===String(tourName));if(!sale||!tour)return false;const payload=await requestCancellationReason(`${tour.name} • ${sale.name||'cliente não informado'}`);if(!payload)return false;
    tour.cancelled=true;tour.cancelChecked=true;applyReason(tour,payload);if((sale.tours||[]).every(t=>isTourCancelled(t,sale)))sale.status='Cancelado';liveHistory(sale,`Passeio cancelado: ${tour.name} — motivo: ${payload.label}`);liveSave();return true;
  }

  function reasonParts(target){const raw=clean(target?.cancellationReason||target?.cancellation_reason),detail=clean(target?.cancellationReasonDetail||target?.cancellation_reason_detail);if(!raw)return{reason:'',detail:''};return CANCELLATION_REASONS.includes(raw)?{reason:raw,detail}:{reason:'Outro',detail:detail||raw}}
  function enhanceDetailCancellation(id){
    const w=browser.win,sale=liveSale(id);if(!sale)return;
    (sale.tours||[]).forEach((tour,i)=>{
      const status=w.document.getElementById(`dc_${i}`),row=status?.closest('.tour-control-row');if(!status||!row||row.querySelector(`[data-ai-reason-index="${i}"]`))return;
      const parts=reasonParts(tour),field=w.document.createElement('div');field.className='field ai-inline-reason';field.dataset.aiReasonIndex=String(i);field.innerHTML=`<label for="dcr_${i}">Motivo do cancelamento</label><select id="dcr_${i}"><option value="">Selecione...</option>${CANCELLATION_REASONS.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('')}</select><div class="ai-inline-reason-detail" id="dcrd_${i}" hidden><label for="dcd_${i}" style="margin-top:8px">Detalhes</label><input id="dcd_${i}" placeholder="Descreva o motivo"></div><div class="ai-cancel-error" id="dcre_${i}"></div>`;row.appendChild(field);
      const reason=w.document.getElementById(`dcr_${i}`),detail=w.document.getElementById(`dcd_${i}`),detailWrap=w.document.getElementById(`dcrd_${i}`),paint=()=>{field.hidden=status.value!=='cancelled';detailWrap.hidden=reason.value!=='Outro';w.document.getElementById(`dcre_${i}`).textContent=''};
      reason.value=parts.reason;detail.value=parts.detail;status.addEventListener('change',paint);reason.addEventListener('change',paint);paint();
    });
  }

  function wrapCancellationFlows(){
    const w=browser.win;if(w.__ISA_CANCEL_REASON_V1110)return;w.__ISA_CANCEL_REASON_V1110=true;
    const oldMarkCancel=w.markCancel,oldOpenDetail=w.openDetail,oldSaveDetail=w.saveDetailV24,oldRenderDashboard=w.renderDashboard;
    w.markCancelled=id=>cancelWholeSaleManaged(id,false);
    w.cancelWholeSale=id=>cancelWholeSaleManaged(id,true);
    w.markCancel=(saleId,tourName,value)=>value===true?cancelTourManaged(saleId,tourName):typeof oldMarkCancel==='function'?oldMarkCancel(saleId,tourName,value):undefined;
    if(typeof oldOpenDetail==='function')w.openDetail=function(id){const result=oldOpenDetail.apply(this,arguments);setTimeout(()=>enhanceDetailCancellation(id),0);return result};
    if(typeof oldSaveDetail==='function')w.saveDetailV24=function(id){
      const sale=liveSale(id);if(!sale)return oldSaveDetail.apply(this,arguments);const pending=[];
      for(let i=0;i<(sale.tours||[]).length;i++){
        const tour=sale.tours[i],status=w.document.getElementById(`dc_${i}`);if(!status)continue;const was=isTourCancelled(tour,{status:''}),now=status.value==='cancelled',reason=w.document.getElementById(`dcr_${i}`),detail=w.document.getElementById(`dcd_${i}`),error=w.document.getElementById(`dcre_${i}`);
        if(now&&(!was||clean(reason?.value))){const message=validateCancellationReason(reason?.value,detail?.value);if(message&& !was){if(error)error.textContent=message;reason?.focus();return}if(!message&&reason?.value)pending.push({tour,payload:{reason:reason.value,detail:reason.value==='Outro'?clean(detail?.value):'',label:reason.value==='Outro'?`Outro: ${clean(detail?.value)}`:reason.value},newCancellation:!was})}
      }
      pending.forEach(x=>{applyReason(x.tour,x.payload);if(x.newCancellation)liveHistory(sale,`Motivo do cancelamento de ${x.tour.name}: ${x.payload.label}`)});return oldSaveDetail.apply(this,arguments);
    };
    if(typeof oldRenderDashboard==='function')w.renderDashboard=function(){const result=oldRenderDashboard.apply(this,arguments);setTimeout(()=>{
      const buttons=[...w.document.querySelectorAll('#alertsList .alertitem.orange button.btn.red')].filter(b=>/cancel/i.test(b.textContent||''));buttons.forEach((button,index)=>{button.onclick=event=>{event.preventDefault();event.stopPropagation();const pending=typeof w.duePayItems==='function'?w.duePayItems()[index]:null;if(pending?.sale)cancelWholeSaleManaged(pending.sale.id,false)}});
    },0);return result};
  }

  function wrapAdminRender(){
    const w=browser.win;if(typeof w.renderAdminDashboard==='function'&&!w.renderAdminDashboard.__intelligence){const old=w.renderAdminDashboard;const wrapped=function(){const result=old.apply(this,arguments);setTimeout(render,0);return result};wrapped.__intelligence=true;w.renderAdminDashboard=wrapped}
    if(typeof w.loadAdminPanel==='function'&&!w.loadAdminPanel.__intelligence){const old=w.loadAdminPanel;const wrapped=async function(){const result=await old.apply(this,arguments);render();return result};wrapped.__intelligence=true;w.loadAdminPanel=wrapped}
    if(typeof w.applyAdminAccess==='function'&&!w.applyAdminAccess.__intelligence){const old=w.applyAdminAccess;const wrapped=function(){const result=old.apply(this,arguments);setTimeout(maybeAutoLand,0);return result};wrapped.__intelligence=true;w.applyAdminAccess=wrapped}
  }

  function visible(element){if(!element)return false;const style=browser.win.getComputedStyle?browser.win.getComputedStyle(element):element.style;return style.display!=='none'&&style.visibility!=='hidden'&&!element.hidden}
  function maybeAutoLand(){
    const w=browser.win;if(browser.landed||String(w?.ISA_ROLE||'').toLowerCase()!=='admin'||w.ISA_ACTIVE===false||w.ISA_STATUS==='blocked')return false;
    if(visible(w.document.getElementById('authScreen'))||w.document.getElementById('recoveryScreen')?.classList.contains('open'))return false;
    browser.landed=true;if(typeof w.goV23==='function')w.goV23('admin');else{w.document.querySelectorAll('.view').forEach(x=>x.classList.toggle('active',x.id==='admin'));if(typeof w.loadAdminPanel==='function')w.loadAdminPanel()}
    return true;
  }

  function install(w){
    if(!w?.document)return;browser.win=w;ensureRoot();wrapAdminRender();wrapCancellationFlows();
    if(browser.installed){render();return}browser.installed=true;
    let attempts=0;const wait=()=>{wrapAdminRender();if(maybeAutoLand()||attempts++>150)return;browser.landingTimer=w.setTimeout(wait,100)};wait();
    if(String(w.ISA_ROLE||'').toLowerCase()==='admin')render();
  }

  return{VERSION,CANCELLATION_REASONS,previousRange,validateCancellationReason,collectRows,filterRows,computeMetrics,aggregateTours,aggregateSellers,buildDataset,buildReport,install,render,exportPDF,exportExcel,requestCancellationReason};
});
