'use strict';

const assert=require('node:assert/strict');

global.window=global;
Object.defineProperty(global,'navigator',{value:{},configurable:true});
global.document={
  readyState:'loading',
  addEventListener(){},
  getElementById(){return null;}
};
global.alert=()=>{};

require('../ticket-validator-v11011.js');

const api=global.ISA_TICKET_VALIDATOR;
assert.ok(api,'API de teste não foi exposta');
assert.equal(api.VERSION,'11.0.11');

function analyze(text,expectedDate='2026-09-05',expectedTime='09:30'){
  return api.analyzeTicketText(text,{expectedDate,expectedTime,tourName:'Hop On Hop Off',fileName:'hop-on-hop-off.pdf'});
}

{
  const r=analyze('HOP ON HOP OFF\nFecha de visita: 05/09/2026\nHorario: 09:30');
  assert.equal(r.dateChoice.selected.iso,'2026-09-05');
  assert.equal(r.dateStatus,'ok');
  assert.equal(r.timeChoice.selected.value,'09:30');
  assert.equal(r.timeStatus,'ok');
}

{
  const r=analyze('HOP ON HOP OFF\nFecha de visita: 04/09/2026\nHorario: 09:30');
  assert.equal(r.dateChoice.selected.iso,'2026-09-04');
  assert.equal(r.dateStatus,'danger');
  assert.equal(r.overall,'danger');
}

{
  const r=analyze('Fecha de emisión: 04/09/2026\nFecha de visita: 05/09/2026\nHora: 09:30');
  assert.equal(r.dateChoice.selected.iso,'2026-09-05','data de uso deve prevalecer sobre emissão');
  assert.equal(r.dateStatus,'ok');
}

{
  const r=analyze('Visit date: September 5, 2026\nStart time: 09:30');
  assert.equal(r.dateChoice.selected.iso,'2026-09-05');
  assert.equal(r.timeStatus,'ok');
}

{
  const r=analyze('Data do passeio: 05 de setembro de 2026\nHorário: 10:00');
  assert.equal(r.dateChoice.selected.iso,'2026-09-05');
  assert.equal(r.timeStatus,'danger','horário diferente deve bloquear');
}

{
  const r=analyze('Fecha de emisión: 04/09/2026');
  assert.equal(r.dateChoice.selected,null,'data administrativa isolada não pode ser tratada como data de uso');
  assert.equal(r.dateChoice.administrativeOnly,true);
  assert.equal(r.dateStatus,'manual');
}

{
  const r=api.analyzeTicketText('',{expectedDate:'2026-09-05',expectedTime:'',tourName:'Hop On Hop Off',fileName:'ticket_05-09-2026.pdf'});
  assert.equal(r.dateChoice.selected.iso,'2026-09-05','nome do arquivo também deve ser usado como fallback');
  assert.equal(r.dateStatus,'ok');
}

{
  const candidates=api.extractDateCandidates('Data: 31/02/2026');
  assert.equal(candidates.length,0,'datas impossíveis devem ser rejeitadas');
}

console.log('ticket-validator-v11011: todos os testes passaram');
