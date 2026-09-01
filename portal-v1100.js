(()=>{
  'use strict';
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmtDT=v=>{if(!v)return'';try{return new Date(v).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})}catch{return String(v)}};
  const client=()=>window.ISA_SUPABASE||null;
  const saleById=id=>(window.db?.sales||[]).find(s=>String(s.id)===String(id));

  async function getActiveAccess(saleId){
    const c=client();if(!c)return null;
    const {data,error}=await c.from('customer_trip_access')
      .select('id,status,created_at,expires_at,first_viewed_at,last_viewed_at,view_count,acknowledgements')
      .eq('sale_id',String(saleId)).eq('status','active').order('created_at',{ascending:false}).limit(1);
    if(error){console.warn('Portal cliente:',error.message);return null}
    return data?.[0]||null;
  }

  function portalUrl(token){const u=new URL('viagem.html',location.href);u.search='';u.searchParams.set('t',token);return u.toString()}
  function shareText(sale,link){const first=String(sale?.name||'').trim().split(/\s+/)[0]||'Olá';return `${first}, seu acesso Indômito está disponível 🌙\n\nAcompanhe seus passeios, horários e pontos de encontro por aqui:\n${link}`}

  function openLinkModal(sale,link,expires){
    let back=$('customerPortalModal');if(back)back.remove();
    back=document.createElement('div');back.id='customerPortalModal';back.className='modalback open';back.style.zIndex='10020';
    back.innerHTML=`<div class="modal" style="width:min(650px,100%)"><div class="modalhead"><div><strong>🌙 Indômito • Minha Viagem</strong><div class="meta">Acesso do cliente</div></div><button class="close" type="button" data-close>×</button></div><div class="modalbody"><div class="alertbox ok"><strong>Link criado com segurança.</strong><div style="margin-top:5px">Este link mostra somente a viagem de <b>${esc(sale?.name||'cliente')}</b> e acompanha as atualizações de horários em tempo real.</div></div><label style="font-size:12px;font-weight:900;display:block;margin:15px 0 6px">LINK DO CLIENTE</label><textarea id="customerPortalLink" readonly style="width:100%;min-height:92px;border:1px solid var(--line);border-radius:11px;padding:11px;background:#f8fafc">${esc(link)}</textarea><div class="meta" style="margin-top:7px">Validade: ${esc(fmtDT(expires))}. Gerar outro link revoga este automaticamente.</div><div id="customerPortalFeedback" class="meta" style="margin-top:10px"></div></div><div class="modalfoot" style="flex-wrap:wrap"><button class="btn light" type="button" data-open>👁 Abrir como cliente</button><button class="btn light" type="button" data-copy>Copiar link</button><button class="btn gold" type="button" data-share>Compartilhar</button></div></div>`;
    document.body.appendChild(back);
    const close=()=>back.remove();back.querySelector('[data-close]').onclick=close;back.addEventListener('click',e=>{if(e.target===back)close()});
    back.querySelector('[data-open]').onclick=()=>window.open(link,'_blank','noopener');
    back.querySelector('[data-copy]').onclick=async()=>{try{await navigator.clipboard.writeText(link);$('customerPortalFeedback').textContent='✓ Link copiado.'}catch{$('customerPortalLink').select();document.execCommand('copy');$('customerPortalFeedback').textContent='✓ Link copiado.'}};
    back.querySelector('[data-share]').onclick=async()=>{const text=shareText(sale,link);if(navigator.share){try{await navigator.share({title:'Indômito • Minha Viagem',text,url:link});return}catch(e){if(e?.name==='AbortError')return}}window.open('https://wa.me/?text='+encodeURIComponent(text),'_blank','noopener')};
  }

  async function createAccess(saleId){
    const c=client();if(!c)return alert('Supabase ainda não inicializou. Tente novamente em alguns segundos.');
    const sale=saleById(saleId);if(!sale)return alert('Venda não encontrada.');
    const existing=await getActiveAccess(saleId);
    if(existing){const ack=Object.keys(existing.acknowledgements||{}).length;const status=existing.last_viewed_at?`já foi visualizado ${existing.view_count||0} vez(es) e possui ${ack} confirmação(ões)`:'ainda não foi visualizado';if(!confirm(`Já existe um acesso ativo para ${sale.name} e ele ${status}.\n\nGerar um novo link? O link anterior será revogado.`))return;}
    const {data,error}=await c.rpc('create_customer_trip_access',{p_sale_id:String(saleId),p_expires_days:180});
    if(error)return alert('Não foi possível criar o acesso do cliente: '+error.message);
    if(!data?.token)return alert('O Supabase não retornou o token do acesso.');
    openLinkModal(sale,portalUrl(data.token),data.expires_at);
    setTimeout(()=>refreshBadge(saleId),400);
  }

  async function refreshBadge(saleId){
    const host=$('customerPortalStatus');if(!host)return;
    host.textContent='Consultando acesso do cliente…';
    const a=await getActiveAccess(saleId);if(!host.isConnected)return;
    if(!a){host.innerHTML='<span class="badge b-gray">Sem acesso criado</span>';return}
    const ack=Object.keys(a.acknowledgements||{}).length;
    const seen=a.last_viewed_at?`👁 Visualizado ${a.view_count||0}x`:'Ainda não visualizado';
    host.innerHTML=`<span class="badge ${a.last_viewed_at?'b-blue':'b-warn'}">${esc(seen)}</span> <span class="badge ${ack?'b-ok':'b-gray'}">✓ ${ack} ciência(s)</span><div class="meta" style="margin-top:5px">Último acesso: ${esc(a.last_viewed_at?fmtDT(a.last_viewed_at):'—')}</div>`;
  }

  function inject(saleId){
    const body=$('detailBody');if(!body)return;
    const actions=body.querySelector('.detail-actions');if(actions&&!$('customerPortalButton')){const b=document.createElement('button');b.id='customerPortalButton';b.type='button';b.className='btn light icon-btn';b.innerHTML='🌙 Acesso do cliente';b.onclick=()=>createAccess(saleId);actions.appendChild(b)}
    if(!$('customerPortalStatus')){const hero=body.querySelector('.detail-hero');if(hero){const box=document.createElement('div');box.id='customerPortalStatus';box.style.marginTop='10px';hero.appendChild(box)}}
    refreshBadge(saleId);
  }

  function hook(){
    if(typeof window.openDetail!=='function')return setTimeout(hook,500);
    if(window.openDetail.__portalV1100)return;
    const old=window.openDetail;
    const wrapped=function(id){const r=old.apply(this,arguments);setTimeout(()=>inject(id),0);return r};
    wrapped.__portalV1100=true;window.openDetail=wrapped;
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',hook);else hook();
})();
