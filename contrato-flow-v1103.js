(()=>{
  'use strict';
  function backToISA(){
    const base=location.pathname.replace(/contrato\.html$/,'');
    location.href=base||'./';
  }
  function install(){
    const gerar=document.getElementById('gerar');
    const limpar=document.getElementById('limpar');
    const note=document.querySelector('#remoteSignPanel')?.previousElementSibling;
    const requestId=new URLSearchParams(location.search).get('request');

    if(note&&note.classList.contains('note')){
      note.textContent=requestId
        ?'Este contrato já está assinado. Gere o PDF final para arquivar ou enviar ao cliente.'
        :'Preencha e confira os dados, crie o link de assinatura e envie ao cliente. Depois, volte ao ISA. Quando o cliente assinar, abra o contrato assinado pelo acompanhamento e gere somente então o PDF final.';
    }

    if(requestId){
      if(gerar)gerar.textContent='Gerar PDF assinado';
      if(limpar)limpar.style.display='none';
      const actions=gerar?.parentElement;
      if(actions&&!actions.querySelector('.back-isa-v1103')){
        const b=document.createElement('button');
        b.type='button';b.className='secondary back-isa-v1103';b.textContent='← Voltar ao ISA';b.onclick=backToISA;actions.insertBefore(b,gerar);
      }
      return;
    }

    if(gerar){
      const clone=gerar.cloneNode(true);
      clone.id='voltarISA';clone.textContent='← Voltar ao ISA';clone.className='secondary';clone.onclick=backToISA;
      gerar.replaceWith(clone);
    }
    if(limpar)limpar.textContent='Limpar formulário';

    const panel=document.getElementById('remoteSignPanel');
    if(panel&&!panel.querySelector('.flow-hint-v1103')){
      const hint=document.createElement('div');
      hint.className='note flow-hint-v1103';hint.style.marginTop='12px';
      hint.innerHTML='<strong>Fluxo recomendado:</strong> Criar link → enviar ao cliente → voltar ao ISA → aguardar assinatura → abrir contrato assinado → gerar PDF assinado.';
      panel.appendChild(hint);
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
