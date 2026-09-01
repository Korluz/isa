(()=>{
  'use strict';
  const SUPABASE_URL='https://cajrgongdxhzfudbheiv.supabase.co';
  const SUPABASE_KEY='sb_publishable_6ydTiQ192A9XfGzIAUtIrw_R7zBbq7h';
  const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const token=new URL(location.href).searchParams.get('t')||new URL(location.href).searchParams.get('token')||'';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmtDate=d=>{if(!d)return'—';const m=String(d).match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[3]}/${m[2]}/${m[1]}`:String(d)};
  const fmtDT=v=>{if(!v)return'';try{return new Date(v).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})}catch{return String(v)}};
  const $=id=>document.getElementById(id);
  let lastData=null;

  function state(kind,title,text){$('loading').hidden=true;$('app').hidden=true;$('error').hidden=false;$('errorIcon').textContent=kind==='expired'?'⌛':'⚠️';$('errorTitle').textContent=title;$('errorText').textContent=text}
  function mapUrl(location){return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(location)}
  function tourCard(t){
    const hasInfo=!!(t.hour||t.message||t.location),confirmed=!!t.confirmed_at,cancelled=!!t.cancelled;
    let status=cancelled?'<span class="tag danger">Cancelado</span>':hasInfo?'<span class="tag ok">Informações disponíveis</span>':'<span class="tag wait">Aguardando horário</span>';
    return `<article class="tour ${cancelled?'cancelled':''}" data-key="${esc(t.key)}"><div class="tourTop"><div><div class="date">${esc(fmtDate(t.date))}</div><h2>${esc(t.name)}</h2></div>${status}</div>${cancelled?'<div class="notice dangerBox">Este passeio está marcado como cancelado. Em caso de dúvida, fale com seu vendedor.</div>':`<div class="infoGrid"><div class="infoBox"><span>HORÁRIO</span><strong>${esc(t.hour||'A confirmar')}</strong></div><div class="infoBox"><span>PONTO DE ENCONTRO</span><strong>${esc(t.location||'A confirmar')}</strong></div></div>${t.location?`<a class="mapBtn" href="${esc(mapUrl(t.location))}" target="_blank" rel="noopener">📍 Abrir no mapa</a>`:''}${t.message?`<div class="message"><span>INFORMAÇÕES DA OPERAÇÃO</span><pre>${esc(t.message)}</pre></div>`:''}${hasInfo?(confirmed?`<div class="confirmed">✓ Ciência confirmada em ${esc(fmtDT(t.confirmed_at))}</div>`:`<button class="confirmBtn" type="button" data-confirm="${esc(t.key)}">✓ Estou ciente do horário e informações</button>`):'<div class="waitingText">Quando a equipe publicar o horário, ele aparecerá aqui automaticamente.</div>'}`}</article>`
  }

  function render(data){
    lastData=data;$('loading').hidden=true;$('error').hidden=true;$('app').hidden=false;
    const first=String(data.client_name||'').trim().split(/\s+/)[0]||'viajante';
    $('hello').textContent=`Olá, ${first} 👋`;
    $('clientName').textContent=data.client_name||'Sua viagem';
    $('meta').textContent=[data.voucher_file?`Reserva ${data.voucher_file}`:'',data.total_pax?`${data.total_pax} passageiro(s)`:'' ].filter(Boolean).join(' • ');
    const tours=Array.isArray(data.tours)?data.tours:[];
    $('tourList').innerHTML=tours.length?tours.map(tourCard).join(''):'<div class="empty">Nenhum passeio encontrado nesta reserva.</div>';
    $('updatedAt').textContent='Atualizado às '+new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
    document.querySelectorAll('[data-confirm]').forEach(btn=>btn.onclick=()=>confirmTour(btn.dataset.confirm,btn));
  }

  async function load(silent=false){
    if(!token){state('invalid','Link inválido','Este acesso não possui um token válido. Peça um novo link ao seu vendedor.');return}
    if(!silent){$('loading').hidden=false;$('app').hidden=true;$('error').hidden=true}
    try{
      const {data,error}=await sb.rpc('get_customer_trip',{p_token:token});
      if(error)throw error;
      if(!data||data.status==='invalid'){state('invalid','Link inválido','Este link não foi reconhecido. Peça um novo acesso ao seu vendedor.');return}
      if(data.status==='expired'){state('expired','Link expirado','Este acesso expirou. Peça ao seu vendedor um novo link.');return}
      if(data.status==='revoked'){state('invalid','Link substituído','Este link foi substituído por um novo acesso. Peça o link mais recente ao seu vendedor.');return}
      if(data.status!=='active'){state('invalid','Acesso indisponível','Não foi possível carregar esta viagem agora. Fale com seu vendedor.');return}
      render(data);
    }catch(e){console.error(e);if(!silent)state('invalid','Não foi possível carregar','Confira sua internet e tente novamente em alguns instantes.')}
  }

  async function confirmTour(key,btn){
    if(!key)return;
    btn.disabled=true;btn.textContent='Confirmando…';
    try{
      const {data,error}=await sb.rpc('confirm_customer_trip_tour',{p_token:token,p_tour_key:key});
      if(error)throw error;
      await load(true);
    }catch(e){console.error(e);btn.disabled=false;btn.textContent='✓ Estou ciente do horário e informações';alert('Não foi possível registrar sua ciência. Tente novamente.')}
  }

  $('refreshBtn').onclick=()=>load(false);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)load(true)});
  window.addEventListener('focus',()=>load(true));
  setInterval(()=>load(true),60000);
  load(false);
})();
