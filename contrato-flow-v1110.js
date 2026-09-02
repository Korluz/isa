(()=>{
  'use strict';
  function backToISA(){
    const base=location.pathname.replace(/contrato\.html$/,'');
    location.href=base||'./';
  }
  function addBackButton(actions,beforeNode){
    if(!actions||actions.querySelector('.back-isa-v1110'))return;
    const b=document.createElement('button');
    b.type='button';b.className='secondary back-isa-v1110';b.textContent='← Voltar ao ISA';b.onclick=backToISA;
    actions.insertBefore(b,beforeNode||actions.firstChild);
  }
  function install(){
    const gerar=document.getElementById('gerar');
    const limpar=document.getElementById('limpar');
    const note=document.querySelector('#remoteSignPanel')?.previousElementSibling;
    const requestId=new URLSearchParams(location.search).get('request');
    const actions=gerar?.parentElement;
    if(note&&note.classList.contains('note')){
      note.textContent=requestId
        ?'A assinatura será validada antes de liberar o PDF final assinado.'
        :'Confira os dados. Se desejar enviar uma cópia antes da assinatura, gere o PDF para conferência. Depois, crie o link exclusivo e envie ao cliente pelo WhatsApp.';
    }
    if(requestId){
      if(gerar){gerar.textContent='Validando assinatura...';gerar.className='primary';gerar.disabled=true}
      if(limpar)limpar.style.display='none';
      addBackButton(actions,gerar);return;
    }
    if(gerar){gerar.textContent='Gerar PDF para conferência';gerar.className='secondary'}
    addBackButton(actions,gerar);
    if(limpar)limpar.textContent='Limpar formulário';
    const panel=document.getElementById('remoteSignPanel');
    if(panel&&!panel.querySelector('.flow-hint-v1110')){
      const hint=document.createElement('div');
      hint.className='note flow-hint-v1110';hint.style.marginTop='12px';
      hint.innerHTML='<strong>Fluxo recomendado:</strong> gerar PDF para conferência → enviar ao cliente → criar link → enviar o link → voltar ao ISA → aguardar assinatura → abrir contrato assinado → gerar PDF assinado.';
      panel.appendChild(hint);
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
