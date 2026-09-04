'use strict';

const assert=require('node:assert/strict');

class FakeElement{
  constructor({value='',textContent=''}={}){this.value=value;this.textContent=textContent;this.innerHTML='';this.className='';this.disabled=false;this.dataset={};this.style={};this.listeners={};}
  addEventListener(type,fn){this.listeners[type]=fn;}
  appendChild(){}
  querySelector(){return null;}
}

const elements={
  validatorSale:new FakeElement({value:'1'}),
  validatorExpected:new FakeElement(),
  validatorMessage:new FakeElement(),
  validatorResult:new FakeElement(),
  analyze:new FakeElement({textContent:'Analisar mensagem'})
};
const ready=[];
global.window=global;
Object.defineProperty(global,'navigator',{value:{vibrate(){}},configurable:true});
global.document={
  readyState:'loading',
  head:{appendChild(){}},
  addEventListener(type,fn){if(type==='DOMContentLoaded')ready.push(fn);},
  getElementById(id){return elements[id]||null;},
  querySelectorAll(selector){return selector==='button'?[elements.analyze]:[];},
  createElement(){return new FakeElement();}
};
global.alert=()=>{};

function tomorrowISO(){const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()+1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function brDate(iso){const [y,m,d]=iso.split('-');return `${d}/${m}/${y}`;}

const tomorrow=tomorrowISO(),wrong=new Date(`${tomorrow}T12:00:00`);wrong.setDate(wrong.getDate()-1);
const wrongISO=`${wrong.getFullYear()}-${String(wrong.getMonth()+1).padStart(2,'0')}-${String(wrong.getDate()).padStart(2,'0')}`;

global.db={catalog:[{name:'Hop On Hop Off',ticket:true}],sales:[{
  id:1,name:'Cliente teste',hotel:'Hotel Plaza',adults:2,children:0,babies:0,
  attachments:[{kind:'ticket',name:'hop-on-hop-off.pdf',path:'u/1/ticket.pdf',mime:'application/pdf',size:123,createdAt:'2026-09-04T12:00:00Z'}],
  tours:[{name:'Hop On Hop Off',date:tomorrow,adults:2,children:0,babies:0,hour:'',location:'Hotel Plaza',messageSent:false}],history:[]
}]};
global.__ticketText=`HOP ON HOP OFF\nFecha de visita: ${brDate(wrongISO)}\nHorario: 09:30`;
global.ISA_SUPABASE={storage:{from(){return {
  async download(){return {data:new Blob(['pdf'],{type:'application/pdf'}),error:null};},
  async createSignedUrl(){return {data:{signedUrl:'about:blank'},error:null};}
};}}};
global.pdfjsLib={GlobalWorkerOptions:{},getDocument(){return {promise:Promise.resolve({numPages:1,async getPage(){return {async getTextContent(){return {items:global.__ticketText.split('\n').map((s,i)=>({str:s,transform:[1,0,0,1,0,100-i*10]}))};}};}})};}};
global.addHistory=(sale,text)=>sale.history.unshift({at:new Date().toISOString(),text});
global.save=()=>{};
elements.validatorMessage.value=`HOP ON HOP OFF\n${brDate(tomorrow)}\n2 ADT\nHotel: Hotel Plaza\nHorario: 09:30`;

require('../ticket-validator-v11011.js');
ready.forEach(fn=>fn());

(async()=>{
  await global.validateMessage();
  assert.match(elements.validatorResult.innerHTML,/NÃO ENVIAR/);
  assert.match(elements.validatorResult.innerHTML,/Data do ticket/);
  assert.match(elements.validatorResult.innerHTML,new RegExp(brDate(wrongISO).replaceAll('/','\\/')));

  global.__ticketText=`HOP ON HOP OFF\nFecha de visita: ${brDate(tomorrow)}\nHorario: 09:30`;
  global.db.sales[0].attachments[0].size=124; // nova chave de cache
  await global.validateMessage();
  assert.match(elements.validatorResult.innerHTML,/MENSAGEM E TICKET COMPATÍVEIS/);
  assert.match(elements.validatorResult.innerHTML,/Data do ticket/);

  global.db.sales[0].attachments=[];
  await global.validateMessage();
  assert.match(elements.validatorResult.innerHTML,/NÃO ENVIAR/);
  assert.match(elements.validatorResult.innerHTML,/Ticket obrigatório ainda não anexado/);

  global.db.catalog[0].ticket=false;
  await global.validateMessage();
  assert.match(elements.validatorResult.innerHTML,/MENSAGEM COMPATÍVEL/,'passeio sem ticket deve preservar o fluxo anterior');
  console.log('ticket-validator-v11011 integração: divergência bloqueada e ticket correto aprovado');
})().catch(e=>{console.error(e);process.exitCode=1;});
