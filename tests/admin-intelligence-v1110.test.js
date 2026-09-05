'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const api=require('../admin-intelligence-v1110.js');

assert.equal(api.VERSION,'11.1.2');

const members=[
  {
    id:'seller-a',full_name:'Ana',state:{sales:[
      {id:'sale-a',name:'Cliente A',voucherFile:'V-1',status:'Reserva feita',valueCents:30000,paidCents:20000,tours:[
        {name:'Passeio A',date:'2026-09-02',priceCents:10000,commissionCents:1000},
        {name:'Passeio B',date:'2026-09-04',priceCents:20000,commissionCents:2000,cancelled:true,cancelChecked:true,cancellationReason:'Condições climáticas'}
      ]}
    ]}
  },
  {
    id:'seller-b',full_name:'Bruno',state:{sales:[
      {id:'sale-b',name:'Cliente B',voucherFile:'V-2',status:'Pago',valueCents:30000,paidCents:30000,tours:[
        {name:'Passeio A',date:'2026-09-03',priceCents:30000,commissionCents:3000}
      ]},
      {id:'sale-c',name:'Cliente C',voucherFile:'V-3',status:'Cancelado',valueCents:10000,paidCents:0,cancellationReason:'Falta de pagamento',tours:[
        {name:'Passeio C',date:'2026-09-05',priceCents:10000,commissionCents:900}
      ]}
    ]}
  }
];

const filters={start:'2026-09-01',end:'2026-09-05',sellerId:'all',tourKey:'all',status:'all'};
const dataset=api.buildDataset(members,filters,'2026-09-05');

assert.equal(dataset.rows.length,4);
assert.equal(dataset.metrics.sales,2,'apenas vendas com passeio ativo entram em vendas efetivas');
assert.equal(dataset.metrics.activeTours,2);
assert.equal(dataset.metrics.cancelled,2);
assert.equal(dataset.metrics.cancellationRate,50);
assert.equal(dataset.metrics.revenue,40000);
assert.ok(Math.abs(dataset.metrics.received-36666.666666666664)<0.01,'recebimento da venda com pacote deve ser rateado entre os passeios');
assert.ok(Math.abs(dataset.metrics.balance-3333.333333333334)<0.01);
assert.equal(dataset.metrics.lostRevenue,30000);
assert.equal(dataset.metrics.commission,4000,'comissões canceladas não entram no total');
assert.equal(dataset.metrics.occurred,2);

const tourA=dataset.tours.find(x=>x.name==='Passeio A');
assert.equal(tourA.occurrences,2);
assert.equal(tourA.revenue,40000);
assert.equal(tourA.cancelled,0);

const sellerB=dataset.sellers.find(x=>x.id==='seller-b');
assert.equal(sellerB.sales,1);
assert.equal(sellerB.cancelled,1);
assert.equal(sellerB.revenue,30000);

const cancelled=api.buildReport(dataset,'cancellations');
assert.equal(cancelled.rows.length,2);
assert.ok(cancelled.rows.some(row=>row.at(-1)==='Condições climáticas'));
assert.ok(cancelled.rows.some(row=>row.at(-1)==='Falta de pagamento'));

const onlySellerA=api.buildDataset(members,{...filters,sellerId:'seller-a'},'2026-09-05');
assert.equal(onlySellerA.metrics.revenue,10000);
assert.equal(onlySellerA.metrics.cancelled,1);

const onlyActive=api.buildDataset(members,{...filters,status:'active'},'2026-09-05');
assert.equal(onlyActive.rows.length,2);
assert.equal(onlyActive.metrics.cancelled,0);

assert.deepEqual(api.previousRange('2026-09-01','2026-09-05'),{start:'2026-08-27',end:'2026-08-31'});
assert.match(api.validateCancellationReason(''),/Selecione/);
assert.match(api.validateCancellationReason('Outro','x'),/3 caracteres/);
assert.equal(api.validateCancellationReason('Outro','Mudança solicitada pela família'), '');
assert.equal(api.validateCancellationReason('Falta de pagamento'), '');

const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'admin-intelligence-v1110.css'),'utf8');
const intelligenceSource=fs.readFileSync(path.join(root,'admin-intelligence-v1110.js'),'utf8');
const version=JSON.parse(fs.readFileSync(path.join(root,'VERSION.json'),'utf8'));
assert.match(html,/admin-intelligence-v1110\.css\?v=1110/);
assert.match(html,/admin-intelligence-v1110\.js\?v=1112/);
assert.match(html,/window\.ISA_ADMIN_CACHE=adminCache/);
assert.match(intelligenceSource,/\['Comissão prevista',[\s\S]*?'purple','R\$'/);
assert.doesNotMatch(intelligenceSource,/\['Comissão prevista',[\s\S]*?'purple','%'/);
assert.match(css,/\.ai-kpi-grid/);
assert.match(css,/@media\(max-width:520px\)/,'o painel precisa manter adaptação mobile');
assert.match(version.version,/^11\.1\./,'a versão atual deve preservar a Central de Inteligência da V11.1.0');

console.log('admin-intelligence-v1110: métricas, filtros, relatórios e integração verificados');
