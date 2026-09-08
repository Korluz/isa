'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const api=require('../financial-reconciliation-v1120.js');

assert.equal(api.VERSION,'11.2.0');

assert.deepEqual(api.allocateCents(1000,[10000,20000,30000]),[167,333,500]);
assert.equal(api.allocateCents(1001,[1,1,1]).reduce((sum,value)=>sum+value,0),1001,'arredondamento deve preservar cada centavo');

const originalTours=[
  {name:'Passeio A',priceCents:10000,commissionCents:1500},
  {name:'Passeio B',priceCents:20000,commissionCents:2500}
];
const discounted=api.applySaleDiscount(originalTours,3000,'Condição comercial','Lucas');
assert.equal(discounted.reduce((sum,tour)=>sum+tour.discountCents,0),3000);
assert.equal(discounted.reduce((sum,tour)=>sum+tour.priceCents,0),27000);
assert.equal(discounted.reduce((sum,tour)=>sum+tour.commissionCents,0),4000,'o desconto não pode alterar a comissão já calculada');
assert.ok(discounted.every(tour=>tour.discountReason==='Condição comercial'));
assert.ok(discounted.every(tour=>tour.discountAuthorizedBy==='Lucas'));

const transfer={name:'TRANSFER IN',standardPriceCents:25900,discountCents:2900,priceCents:23000};
assert.equal(api.commissionBaseCents(transfer),25900,'a base da comissão deve ser o valor padrão, não o valor com desconto');

const sale={valueCents:27000,paidCents:20000,tours:discounted};
let summary=api.summarizeSale(sale);
assert.equal(summary.gross,30000);
assert.equal(summary.discounts,3000);
assert.equal(summary.calculatedNet,27000);
assert.equal(summary.balance,7000);
assert.equal(summary.status,'ok');

sale.tours[1].cancelled=true;sale.tours[1].cancelChecked=true;
api.reconcileSale(sale);summary=api.summarizeSale(sale);
assert.equal(sale.valueCents,9000,'cancelamento deve retirar apenas o valor final do serviço ativo');
assert.equal(summary.unallocatedReceived,11000,'valor já recebido não pode desaparecer após cancelamento');
assert.equal(sale.tours[0].commissionCents,1500,'conciliação financeira não recalcula nem reduz comissão por desconto');

const legacy={valueCents:9000,paidCents:5000,tours:[{name:'A',priceCents:6000},{name:'B',priceCents:6000}]};
summary=api.summarizeSale(legacy);
assert.equal(summary.status,'unclassified_discount');
assert.equal(summary.delta,-3000);

const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'financial-reconciliation-v1120.css'),'utf8');
const transferSource=fs.readFileSync(path.join(root,'transfer-commission-v1108.js'),'utf8');
assert.match(html,/financial-reconciliation-v1120\.css\?v=1120/);
assert.match(html,/financial-reconciliation-v1120\.js\?v=1120/);
assert.match(css,/\.fr-sale-summary/);
assert.match(transferSource,/standardPriceCents/);

console.log('financial-reconciliation-v1120: descontos, comissão e cancelamentos verificados');
