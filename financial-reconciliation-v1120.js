(function(factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(typeof window!=='undefined'){
    window.ISA_FINANCIAL_RECONCILIATION=api;
    const start=()=>api.install(window);
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  }
})(function(){
  'use strict';

  const VERSION='11.2.0';
  const MODEL_VERSION='1.0';
  const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
  const cents=value=>{const n=Math.round(Number(value)||0);return Number.isFinite(n)?Math.max(0,n):0};
  const hasOwn=(object,key)=>Object.prototype.hasOwnProperty.call(object||{},key);
  const isCancelled=tour=>!!(tour?.cancelled||tour?.cancelChecked===true||/cancel/i.test(clean(tour?.status)));
  const standardPriceCents=tour=>{
    if(hasOwn(tour,'standardPriceCents'))return cents(tour.standardPriceCents);
    const finalValue=cents(tour?.priceCents),discount=cents(tour?.discountCents);
    return finalValue+discount;
  };
  const discountCents=tour=>Math.min(standardPriceCents(tour),cents(tour?.discountCents));
  const finalPriceCents=tour=>{
    if(hasOwn(tour,'standardPriceCents'))return Math.max(0,standardPriceCents(tour)-discountCents(tour));
    return cents(tour?.priceCents);
  };
  const commissionBaseCents=tour=>standardPriceCents(tour);

  function allocateCents(total,weights){
    const target=cents(total),list=(Array.isArray(weights)?weights:[]).map(cents);
    if(!list.length)return[];
    const weightTotal=list.reduce((sum,value)=>sum+value,0);
    if(!weightTotal){
      const base=Math.floor(target/list.length),remainder=target-(base*list.length);
      return list.map((_,index)=>base+(index<remainder?1:0));
    }
    const raw=list.map((weight,index)=>({index,value:target*weight/weightTotal}));
    const result=raw.map(item=>Math.floor(item.value));
    let remainder=target-result.reduce((sum,value)=>sum+value,0);
    raw.sort((a,b)=>(b.value-Math.floor(b.value))-(a.value-Math.floor(a.value))||a.index-b.index);
    for(let i=0;i<remainder;i++)result[raw[i%raw.length].index]++;
    return result;
  }

  function summarizeSale(sale){
    const tours=Array.isArray(sale?.tours)?sale.tours:[];
    const active=tours.filter(tour=>!isCancelled(tour));
    const cancelled=tours.filter(isCancelled);
    const gross=active.reduce((sum,tour)=>sum+standardPriceCents(tour),0);
    const discounts=active.reduce((sum,tour)=>sum+discountCents(tour),0);
    const calculatedNet=active.reduce((sum,tour)=>sum+finalPriceCents(tour),0);
    const declaredNet=cents(sale?.valueCents);
    const paid=cents(sale?.paidCents);
    const explicit=sale?.financialModelVersion===MODEL_VERSION||active.some(tour=>hasOwn(tour,'standardPriceCents')||cents(tour?.discountCents)>0);
    const delta=declaredNet-calculatedNet;
    const status=Math.abs(delta)<=1?'ok':delta<0?'unclassified_discount':'missing_value';
    return{
      active,cancelled,gross,discounts,calculatedNet,declaredNet,paid,delta,status,explicit,
      balance:Math.max(0,declaredNet-paid),
      received:Math.min(declaredNet,paid),
      unallocatedReceived:Math.max(0,paid-declaredNet),
      cancelledValue:cancelled.reduce((sum,tour)=>sum+finalPriceCents(tour),0)
    };
  }

  function normalizeTour(tour){
    const standard=standardPriceCents(tour),discount=Math.min(standard,discountCents(tour));
    return{...tour,standardPriceCents:standard,discountCents:discount,priceCents:standard-discount};
  }

  function reconcileSale(sale){
    if(!sale||typeof sale!=='object')return sale;
    sale.tours=(Array.isArray(sale.tours)?sale.tours:[]).map(normalizeTour);
    const summary=summarizeSale(sale);
    sale.grossValueCents=summary.gross;
    sale.discountCents=summary.discounts;
    sale.valueCents=summary.calculatedNet;
    sale.financialModelVersion=MODEL_VERSION;
    sale.financialReconciliationStatus='ok';
    sale.financialReconciledAt=new Date().toISOString();
    sale.unallocatedReceivedCents=Math.max(0,cents(sale.paidCents)-sale.valueCents);
    return sale;
  }

  function applySaleDiscount(tours,totalDiscount,reason='',authorizedBy=''){
    const list=(Array.isArray(tours)?tours:[]).map(normalizeTour),activeIndexes=[];
    list.forEach((tour,index)=>{if(!isCancelled(tour))activeIndexes.push(index)});
    const standards=activeIndexes.map(index=>standardPriceCents(list[index]));
    const discount=Math.min(cents(totalDiscount),standards.reduce((sum,value)=>sum+value,0));
    const allocated=allocateCents(discount,standards);
    activeIndexes.forEach((tourIndex,index)=>{
      const tour=list[tourIndex],value=allocated[index];
      tour.discountCents=value;
      tour.priceCents=standardPriceCents(tour)-value;
      tour.discountReason=value?clean(reason):'';
      tour.discountAuthorizedBy=value?clean(authorizedBy):'';
    });
    return list;
  }

  const browser={win:null,installed:false,currentSale:null};
  const money=value=>(cents(value)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const escapeHtml=value=>clean(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

  function bindMoney(input,onChange){
    if(!input||input.dataset.frMoneyBound)return;
    input.dataset.frMoneyBound='1';
    input.addEventListener('input',event=>{
      const raw=event.target.value.replace(/\D/g,'');
      event.target.dataset.cents=raw||'0';
      event.target.value=money(raw);
      if(onChange)onChange();
    });
  }

  function rowIsActive(row){
    const value=row.querySelector('.tr-cancel')?.value||'';
    return value!=='yes';
  }

  function rowValues(row){
    const standard=cents(row.querySelector('.tr-price')?.dataset.cents);
    const discount=Math.min(standard,cents(row.querySelector('.fr-tour-discount')?.dataset.cents));
    return{standard,discount,final:standard-discount};
  }

  function enhanceTourRow(row,data){
    if(!row||row.dataset.frEnhanced)return;
    row.dataset.frEnhanced='1';row.classList.add('fr-tourrow');row.__isaOriginalTour=data&&typeof data==='object'?data:null;
    const price=row.querySelector('.tr-price'),label=price?.closest('.field')?.querySelector('label');
    if(label)label.textContent='Valor padrão';
    const standard=standardPriceCents(data||{priceCents:cents(price?.dataset.cents)});
    if(price){price.dataset.cents=String(standard);price.value=standard?money(standard):''}
    const discount=discountCents(data||{}),adjust=document.createElement('div');
    adjust.className='fr-tour-adjustment';
    adjust.innerHTML=`<div class="field"><label>Desconto</label><input class="fr-tour-discount" inputmode="numeric" data-cents="${discount}" value="${discount?money(discount):''}" placeholder="R$ 0,00"></div><div class="field"><label>Valor final</label><output class="fr-tour-final">${money(Math.max(0,standard-discount))}</output></div><div class="field"><label>Motivo do desconto</label><input class="fr-discount-reason" value="${escapeHtml(data?.discountReason||'')}" placeholder="Ex.: condição comercial"></div><div class="field"><label>Autorizado por</label><input class="fr-discount-authorizer" value="${escapeHtml(data?.discountAuthorizedBy||'')}" placeholder="Nome do responsável"></div>`;
    row.appendChild(adjust);
    bindMoney(price,refreshEditorSummary);bindMoney(adjust.querySelector('.fr-tour-discount'),refreshEditorSummary);
    row.querySelector('.tr-cancel')?.addEventListener('change',refreshEditorSummary);
    row.querySelector('button')?.addEventListener('click',()=>setTimeout(refreshEditorSummary,0));
    refreshRow(row);
  }

  function refreshRow(row){
    const values=rowValues(row),output=row.querySelector('.fr-tour-final'),discount=row.querySelector('.fr-tour-discount');
    if(discount&&cents(discount.dataset.cents)>values.standard){discount.dataset.cents=String(values.standard);discount.value=money(values.standard)}
    if(output)output.textContent=money(values.final);
    row.classList.toggle('fr-cancelled-row',!rowIsActive(row));
    return values;
  }

  function ensureEditorSummary(){
    const w=browser.win,modal=w.document.getElementById('saleModal'),footer=modal?.querySelector('.modalfoot');if(!modal||!footer)return null;
    let panel=w.document.getElementById('frSaleSummary');
    if(panel)return panel;
    panel=w.document.createElement('section');panel.id='frSaleSummary';panel.className='fr-sale-summary';
    panel.innerHTML=`<div class="fr-summary-grid"><div><small>Valor padrão</small><strong data-fr-gross>R$ 0,00</strong></div><div><small>Descontos</small><strong data-fr-discount>R$ 0,00</strong></div><div><small>Valor final</small><strong data-fr-net>R$ 0,00</strong></div><div><small>Diferença</small><strong data-fr-delta>R$ 0,00</strong></div></div><div class="fr-reconciliation-message" data-fr-message></div><div class="fr-summary-actions"><button class="btn light sm" type="button" data-fr-distribute>Distribuir diferença como desconto</button></div>`;
    footer.before(panel);
    panel.querySelector('[data-fr-distribute]').onclick=distributeEditorDiscount;
    return panel;
  }

  function editorTotals(){
    const rows=[...browser.win.document.querySelectorAll('#tourRows .tourrow')].filter(row=>rowIsActive(row));
    const values=rows.map(refreshRow),gross=values.reduce((sum,item)=>sum+item.standard,0),discount=values.reduce((sum,item)=>sum+item.discount,0),net=values.reduce((sum,item)=>sum+item.final,0);
    const input=browser.win.document.getElementById('fValue'),hasTarget=!!clean(input?.value),target=hasTarget?cents(input.dataset.cents):net;
    return{rows,values,gross,discount,net,target,delta:target-net,hasTarget};
  }

  function refreshEditorSummary(){
    const w=browser.win,panel=ensureEditorSummary();if(!panel)return;
    const totals=editorTotals(),input=w.document.getElementById('fValue');
    if(input&&!totals.hasTarget){input.dataset.cents=String(totals.net);input.value=totals.net?money(totals.net):''}
    panel.querySelector('[data-fr-gross]').textContent=money(totals.gross);
    panel.querySelector('[data-fr-discount]').textContent=money(totals.discount);
    panel.querySelector('[data-fr-net]').textContent=money(totals.net);
    panel.querySelector('[data-fr-delta]').textContent=(totals.delta>0?'+':'')+money(Math.abs(totals.delta));
    const message=panel.querySelector('[data-fr-message]'),button=panel.querySelector('[data-fr-distribute]');
    panel.classList.toggle('has-error',Math.abs(totals.delta)>1);
    if(Math.abs(totals.delta)<=1){message.textContent='Conferido: a soma dos passeios corresponde ao valor final da venda.';button.hidden=true}
    else if(totals.delta<0){message.textContent=`Há ${money(-totals.delta)} de diferença que pode ser registrada como desconto.`;button.hidden=false}
    else{message.textContent=`Faltam ${money(totals.delta)} nos passeios. Adicione o serviço ou corrija o valor padrão antes de salvar.`;button.hidden=true}
  }

  function distributeEditorDiscount(){
    const w=browser.win,totals=editorTotals(),amount=totals.gross-totals.target;
    if(amount<0)return w.alert(`O valor final supera a soma dos passeios em ${money(-amount)}. Inclua o serviço ou corrija os valores.`);
    if(amount===0)return refreshEditorSummary();
    const reason=clean(w.prompt('Informe o motivo do desconto:','Condição comercial')||'');if(!reason)return;
    const fallback=clean(w.db?.sellerProfile?.name||w.db?.seller||'');
    const authorizedBy=clean(w.prompt('Quem autorizou o desconto?',fallback)||'');if(!authorizedBy)return;
    const allocated=allocateCents(amount,totals.values.map(item=>item.standard));
    totals.rows.forEach((row,index)=>{
      const input=row.querySelector('.fr-tour-discount'),value=allocated[index];input.dataset.cents=String(value);input.value=value?money(value):'';
      row.querySelector('.fr-discount-reason').value=value?reason:'';row.querySelector('.fr-discount-authorizer').value=value?authorizedBy:'';
    });
    refreshEditorSummary();
  }

  function enhanceSaleEditor(){
    const w=browser.win,id=browser.currentSaleId,sale=id?(w.db?.sales||[]).find(item=>String(item.id)===String(id)):null;browser.currentSale=sale||null;
    const value=w.document.getElementById('fValue'),label=value?.closest('.field')?.querySelector('label');
    if(label)label.textContent='Valor final da venda';
    bindMoney(value,refreshEditorSummary);
    [...w.document.querySelectorAll('#tourRows .tourrow')].forEach((row,index)=>enhanceTourRow(row,sale?.tours?.[index]||null));
    ensureEditorSummary();refreshEditorSummary();
  }

  function buildTourFromRow(row){
    const w=browser.win,old=row.__isaOriginalTour||{},values=rowValues(row),cancelValue=row.querySelector('.tr-cancel')?.value||'';
    const discountReason=clean(row.querySelector('.fr-discount-reason')?.value),discountAuthorizedBy=clean(row.querySelector('.fr-discount-authorizer')?.value);
    if(values.discount&&!discountReason)throw new Error(`Informe o motivo do desconto em ${row.querySelector('.tr-name')?.value||'um passeio'}.`);
    if(values.discount&&!discountAuthorizedBy)throw new Error(`Informe quem autorizou o desconto em ${row.querySelector('.tr-name')?.value||'um passeio'}.`);
    const cancelled=cancelValue==='yes'||old.cancelled===true;
    return{...old,
      name:row.querySelector('.tr-name')?.value||'',date:row.querySelector('.tr-date')?.value||'',
      standardPriceCents:values.standard,discountCents:values.discount,priceCents:values.final,
      discountReason:values.discount?discountReason:'',discountAuthorizedBy:values.discount?discountAuthorizedBy:'',
      commissionCents:cents(row.querySelector('.tr-commission')?.dataset.cents),
      cancelChecked:cancelValue==='yes'?true:cancelValue==='no'?false:(old.cancelChecked??null),cancelled,
      hour:row.querySelector('.tr-hour')?.value||old.hour||'',location:row.querySelector('.tr-location')?.value||old.location||'',messageSent:(row.querySelector('.tr-sent')?.value||'0')==='1'
    };
  }

  function saveSaleManaged(){
    const w=browser.win,rows=[...w.document.querySelectorAll('#tourRows .tourrow')];
    let tours;try{tours=rows.map(buildTourFromRow).filter(tour=>tour.name&&tour.date)}catch(error){return w.alert(error.message)}
    if(!clean(w.document.getElementById('fName')?.value)||!clean(w.document.getElementById('fPhone')?.value)||!tours.length)return w.alert('Preencha nome, WhatsApp e ao menos um passeio com data.');
    const active=tours.filter(tour=>!isCancelled(tour)),gross=active.reduce((sum,tour)=>sum+standardPriceCents(tour),0),discount=active.reduce((sum,tour)=>sum+discountCents(tour),0),net=active.reduce((sum,tour)=>sum+finalPriceCents(tour),0);
    const targetInput=w.document.getElementById('fValue'),target=clean(targetInput?.value)?cents(targetInput.dataset.cents):net,delta=target-net;
    if(Math.abs(delta)>1){
      const explanation=delta<0?`Registre os ${money(-delta)} como desconto usando o botão de distribuição.`:`Ainda faltam ${money(delta)} nos passeios.`;
      return w.alert(`A venda não está conciliada. ${explanation}`);
    }
    const editingId=browser.currentSaleId,old=editingId?(w.db?.sales||[]).find(item=>String(item.id)===String(editingId)):null;
    const sale={...(old||{}),
      id:editingId||Date.now(),name:clean(w.document.getElementById('fName').value),phone:clean(w.document.getElementById('fPhone').value),hotel:clean(w.document.getElementById('fHotel').value),type:w.document.getElementById('fType').value,
      adults:Number(w.document.getElementById('fAdults').value)||0,children:Number(w.document.getElementById('fChildren').value)||0,babies:Number(w.document.getElementById('fBabies').value)||0,
      grossValueCents:gross,discountCents:discount,valueCents:net,paidCents:cents(w.document.getElementById('fPaidValue').dataset.cents),
      paymentMethod:w.document.getElementById('fPaymentMethod').value,paymentDate:w.document.getElementById('fPaymentDate').value,
      commissionReceivedCents:cents(w.document.getElementById('fCommissionReceived').dataset.cents),commissionDate:w.document.getElementById('fCommissionDate').value,
      status:w.document.getElementById('fStatus').value,notes:clean(w.document.getElementById('fNotes').value),tours,history:Array.isArray(old?.history)?old.history:[],
      financialModelVersion:MODEL_VERSION,financialReconciliationStatus:'ok',financialReconciledAt:new Date().toISOString()
    };
    const calculation=typeof w.calcSaleCommission==='function'?w.calcSaleCommission(sale):null;
    if(calculation){sale.commissionCents=Math.round(Number(calculation.total||0)*100);(calculation.details||[]).forEach(detail=>{if(detail.tour)detail.tour.commissionCents=Math.round(Number(detail.total||0)*100)})}
    else sale.commissionCents=tours.reduce((sum,tour)=>sum+cents(tour.commissionCents),0);
    const text=`${editingId?'Venda atualizada':'Venda criada'} — padrão ${money(gross)}, desconto ${money(discount)}, final ${money(net)}. Comissão preservada pela regra dos passeios.`;
    if(typeof w.addHistory==='function')w.addHistory(sale,text);
    else{sale.history.unshift({at:new Date().toISOString(),text});sale.history=sale.history.slice(0,100)}
    if(editingId)w.db.sales=w.db.sales.map(item=>String(item.id)===String(editingId)?sale:item);else w.db.sales.unshift(sale);
    w.save();w.closeSale();
  }

  function markLegacyReconciliation(sale){
    if(!sale||sale.financialModelVersion===MODEL_VERSION)return;
    const summary=summarizeSale(sale);
    sale.financialReconciliationStatus=summary.status;
    sale.financialReconciliationDeltaCents=summary.delta;
  }

  function synchronizeAfterCancellation(sale,before){
    if(!sale)return;
    const changed=(sale.tours||[]).some((tour,index)=>isCancelled(tour)!==!!before?.[index]);if(!changed)return;
    (sale.tours||[]).forEach((tour,index)=>{
      if(isCancelled(tour)&&!before?.[index]){tour.cancelledValueCents=finalPriceCents(tour);tour.cancelledFinancialAt=new Date().toISOString()}
    });
    if(sale.financialModelVersion===MODEL_VERSION){
      const previous=cents(sale.valueCents);reconcileSale(sale);
      const difference=previous-cents(sale.valueCents);
      if(typeof browser.win.addHistory==='function')browser.win.addHistory(sale,`Conciliação automática do cancelamento: valor da venda ajustado em ${money(Math.abs(difference))}. Valores recebidos não foram apagados.`);
    }else markLegacyReconciliation(sale);
  }

  function decorateDetail(saleId){
    const w=browser.win,sale=(w.db?.sales||[]).find(item=>String(item.id)===String(saleId));if(!sale)return;
    const summary=summarizeSale(sale),body=w.document.getElementById('detailBody');if(!body)return;
    let panel=body.querySelector('.fr-detail-summary');if(panel)panel.remove();
    panel=w.document.createElement('div');panel.className='infobox fr-detail-summary';
    const pending=summary.status!=='ok'?`<div class="fr-pending">⚠ Diferença de ${money(Math.abs(summary.delta))} entre o total da venda e os passeios. Abra “Editar dados” para classificar e conciliar.</div>`:'';
    const excess=summary.unallocatedReceived?`<div class="fr-pending">Há ${money(summary.unallocatedReceived)} recebido acima do valor final. Registre a destinação como reembolso, crédito ou retenção.</div>`:'';
    panel.innerHTML=`<h3>Conciliação financeira</h3><div class="fr-detail-grid"><div><small>Valor padrão</small><strong>${money(summary.gross)}</strong></div><div><small>Descontos</small><strong>${money(summary.discounts)}</strong></div><div><small>Valor final</small><strong>${money(summary.declaredNet)}</strong></div><div><small>Recebido</small><strong>${money(summary.paid)}</strong></div><div><small>Saldo</small><strong>${money(summary.balance)}</strong></div><div><small>Comissão</small><strong>${money(sale.commissionCents)}</strong></div></div>${pending}${excess}`;
    const first=body.querySelector('.infobox');first?.after(panel);
  }

  function decorateFinance(){
    const w=browser.win,section=w.document.getElementById('financeiro'),grid=section?.querySelector('.financegrid');if(!section||!grid)return;
    const all=w.db?.sales||[],active=all.filter(sale=>sale.status!=='Cancelado'),summaries=active.map(summarizeSale);
    const gross=summaries.reduce((sum,item)=>sum+item.gross,0),discounts=summaries.reduce((sum,item)=>sum+(item.explicit?item.discounts:Math.max(0,-item.delta)),0),issues=summaries.filter(item=>item.status!=='ok').length;
    const net=active.reduce((sum,sale)=>sum+cents(sale.valueCents),0),received=active.reduce((sum,sale)=>sum+Math.min(cents(sale.paidCents),cents(sale.valueCents)),0),commission=active.reduce((sum,sale)=>sum+cents(sale.commissionCents),0);
    const soldNode=w.document.getElementById('finSold'),receivedNode=w.document.getElementById('finReceived'),balanceNode=w.document.getElementById('finBalance'),commissionNode=w.document.getElementById('finCommission');
    if(soldNode)soldNode.textContent=money(net);if(receivedNode)receivedNode.textContent=money(received);if(balanceNode)balanceNode.textContent=money(Math.max(0,net-received));if(commissionNode)commissionNode.textContent=money(commission);
    let extras=grid.querySelectorAll('.fr-finance-extra');extras.forEach(item=>item.remove());
    const cards=[['Valor padrão',money(gross)],['Descontos registrados',money(discounts)],['Conciliações pendentes',String(issues)]];
    cards.forEach(([label,value])=>{const card=w.document.createElement('div');card.className='moneycard fr-finance-extra';card.innerHTML=`<small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong>`;grid.appendChild(card)});
    const list=w.document.getElementById('financeList');if(!list)return;
    [...list.querySelectorAll('.sale')].forEach((card,index)=>{
      const filtered=all.filter(sale=>{
        const q=clean(w.document.getElementById('financeSearch')?.value).toLowerCase(),status=w.document.getElementById('financeStatus')?.value||'';
        return (!q||clean(sale.name).toLowerCase().includes(q))&&(!status||w.paymentState(sale)===status);
      });
      const sale=filtered[index];if(!sale)return;const summary=summarizeSale(sale);
      if(summary.status!=='ok'){const warning=w.document.createElement('div');warning.className='quick-warning fr-pending';warning.textContent=`Conciliação pendente: diferença de ${money(Math.abs(summary.delta))}. Abra “Editar valores”.`;card.querySelector('.formgrid')?.after(warning)}
    });
  }

  function installCommissionBase(){
    const w=browser.win,previous=w.calcSaleCommission;if(typeof previous!=='function'||previous.__isaDiscountSafe)return;
    const wrapped=function(sale){
      const original=new Map();(sale?.tours||[]).forEach(tour=>{original.set(tour,tour.priceCents);tour.priceCents=commissionBaseCents(tour)});
      try{return previous(sale)}finally{original.forEach((value,tour)=>{tour.priceCents=value})}
    };
    wrapped.__isaDiscountSafe=true;wrapped.__isaPrevious=previous;w.calcSaleCommission=wrapped;
    if(typeof w.updateCommissions==='function')w.updateCommissions();
  }

  function wrapBrowserFunctions(){
    const w=browser.win;if(w.__ISA_FINANCIAL_RECONCILIATION_V1120)return;w.__ISA_FINANCIAL_RECONCILIATION_V1120=true;
    const oldOpen=w.openSale,oldAdd=w.addTourRow,oldDetail=w.openDetail,oldFinance=w.renderFinance,oldSaveDetail=w.saveDetailV24,oldCancelWhole=w.cancelWholeSale,oldMarkCancel=w.markCancel;
    if(typeof oldOpen==='function')w.openSale=function(id=null){browser.currentSaleId=id;const result=oldOpen.apply(this,arguments);setTimeout(enhanceSaleEditor,0);return result};
    if(typeof oldAdd==='function')w.addTourRow=function(data){const result=oldAdd.apply(this,arguments),rows=w.document.querySelectorAll('#tourRows .tourrow');enhanceTourRow(rows[rows.length-1],data||null);refreshEditorSummary();return result};
    w.saveSale=saveSaleManaged;
    if(typeof oldDetail==='function')w.openDetail=function(id){const result=oldDetail.apply(this,arguments);setTimeout(()=>decorateDetail(id),20);return result};
    if(typeof oldFinance==='function')w.renderFinance=function(){const result=oldFinance.apply(this,arguments);decorateFinance();return result};
    if(typeof oldSaveDetail==='function')w.saveDetailV24=function(id){const sale=(w.db?.sales||[]).find(item=>String(item.id)===String(id)),before=(sale?.tours||[]).map(isCancelled),result=oldSaveDetail.apply(this,arguments);const after=()=>{synchronizeAfterCancellation(sale,before);if(typeof w.updateCommissions==='function')w.updateCommissions();w.save()};if(result&&typeof result.then==='function')return result.then(value=>{after();return value});after();return result};
    if(typeof oldCancelWhole==='function')w.cancelWholeSale=async function(id){const sale=(w.db?.sales||[]).find(item=>String(item.id)===String(id)),before=(sale?.tours||[]).map(isCancelled),result=await oldCancelWhole.apply(this,arguments);synchronizeAfterCancellation(sale,before);if(typeof w.updateCommissions==='function')w.updateCommissions();w.save();return result};
    if(typeof oldMarkCancel==='function')w.markCancel=async function(id){const sale=(w.db?.sales||[]).find(item=>String(item.id)===String(id)),before=(sale?.tours||[]).map(isCancelled),result=await oldMarkCancel.apply(this,arguments);synchronizeAfterCancellation(sale,before);if(typeof w.updateCommissions==='function')w.updateCommissions();w.save();return result};
  }

  function auditLegacy(){(browser.win.db?.sales||[]).forEach(markLegacyReconciliation)}

  function install(w){
    if(!w?.document)return;browser.win=w;installCommissionBase();auditLegacy();wrapBrowserFunctions();
    if(browser.installed)return;browser.installed=true;
    setTimeout(()=>{installCommissionBase();auditLegacy();if(typeof w.renderFinance==='function')w.renderFinance()},120);
  }

  return{VERSION,MODEL_VERSION,isCancelled,standardPriceCents,discountCents,finalPriceCents,commissionBaseCents,allocateCents,summarizeSale,normalizeTour,reconcileSale,applySaleDiscount,install};
});
