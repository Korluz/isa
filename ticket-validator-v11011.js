(()=>{
  'use strict';

  const VERSION='11.0.11';
  const OCR_SRC='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
  const ticketCache=new Map();
  const el=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const plain=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const norm=v=>plain(v).replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
  const fmtDate=v=>{const m=String(v||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[3]}/${m[2]}/${m[1]}`:String(v||'');};
  const active=t=>!(t?.cancelled||t?.cancelChecked===true);
  const localISO=offset=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()+Number(offset||0));return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};

  function validISO(year,month,day){
    year=Number(year);month=Number(month);day=Number(day);
    if(year<2000||year>2100||month<1||month>12||day<1||day>31)return '';
    const d=new Date(Date.UTC(year,month-1,day));
    if(d.getUTCFullYear()!==year||d.getUTCMonth()!==month-1||d.getUTCDate()!==day)return '';
    return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  }

  function scoreTour(name,text){
    const n=norm(name),m=norm(text);if(!n)return 0;if(m.includes(n))return 1;
    const stop=new Set(['tour','full','day','sunset','city','ticket','entrada','ingreso','de','da','do','das','dos','del','la','el','e']);
    const words=n.split(' ').filter(w=>w.length>=4&&!stop.has(w));
    return words.length?words.filter(w=>m.includes(w)).length/words.length:0;
  }

  const MONTHS={
    jan:1,janeiro:1,january:1,enero:1,
    fev:2,fevereiro:2,feb:2,february:2,febrero:2,
    mar:3,marco:3,march:3,marzo:3,
    abr:4,abril:4,apr:4,april:4,
    mai:5,maio:5,may:5,mayo:5,
    jun:6,junho:6,june:6,junio:6,
    jul:7,julho:7,july:7,julio:7,
    ago:8,agosto:8,aug:8,august:8,
    set:9,setembro:9,sep:9,september:9,septiembre:9,
    out:10,outubro:10,oct:10,october:10,octubre:10,
    nov:11,novembro:11,november:11,noviembre:11,
    dez:12,dezembro:12,dec:12,december:12,diciembre:12
  };
  const MONTH_PATTERN=Object.keys(MONTHS).sort((a,b)=>b.length-a.length).join('|');
  const DATE_POSITIVE=/(?:data|fecha|date)\s*(?:de|del|do|da|of)?\s*(?:uso|visita|visit|passeio|tour|servi[cç]o|service|atividade|activity|viagem|travel|entrada|ingreso|validade|validity)|(?:v[aá]lid[oa]|valid)\s*(?:em|para|on|for|hasta)|dia\s+do\s+passeio/;
  const DATE_GENERIC=/(?:data|fecha|date)\s*[:#-]?\s*$/;
  const DATE_NEGATIVE=/(?:emiss[aã]o|emisi[oó]n|emitido|issued|compra|purchase|pedido|order|gerado|generated|criado|created|pagamento|payment|fatura|factura)\s*(?:em|el|on|date|data|fecha)?\s*[:#-]?\s*$/;

  function dateContext(text,index,length){
    const before=text.slice(Math.max(0,index-72),index);
    const after=text.slice(index+length,Math.min(text.length,index+length+42));
    const around=before.slice(-48)+' '+after.slice(0,24);
    const positive=DATE_POSITIVE.test(around)||DATE_POSITIVE.test(before.slice(-64));
    const negative=DATE_NEGATIVE.test(before.slice(-52));
    const generic=!positive&&!negative&&DATE_GENERIC.test(before.slice(-28));
    return {before,after,positive,negative,generic};
  }

  function extractDateCandidates(input,expectedDate=''){
    const text=plain(input),found=[];
    const add=(match,index,length,iso,format)=>{
      if(!iso)return;
      const ctx=dateContext(text,index,length);
      let score=ctx.positive?9:ctx.generic?3:0;
      if(ctx.negative)score-=10;
      if(iso===expectedDate)score+=2;
      found.push({iso,index,format,score,positive:ctx.positive,negative:ctx.negative,context:(ctx.before.slice(-38)+' '+match+' '+ctx.after.slice(0,28)).replace(/\s+/g,' ').trim()});
    };
    let m;
    const ymd=/\b(20\d{2})[\/.\-](0?[1-9]|1[0-2])[\/.\-](0?[1-9]|[12]\d|3[01])\b/g;
    while((m=ymd.exec(text)))add(m[0],m.index,m[0].length,validISO(m[1],m[2],m[3]),'ymd');
    const dmy=/\b(0?[1-9]|[12]\d|3[01])[\/.\-](0?[1-9]|1[0-2])[\/.\-](\d{2}|20\d{2})\b/g;
    while((m=dmy.exec(text))){let y=Number(m[3]);if(y<100)y+=2000;add(m[0],m.index,m[0].length,validISO(y,m[2],m[1]),'dmy');}
    const dayMonth=new RegExp(`\\b(0?[1-9]|[12]\\d|3[01])\\s+(?:de\\s+)?(${MONTH_PATTERN})[,.]?\\s+(?:de\\s+)?(20\\d{2})\\b`,'g');
    while((m=dayMonth.exec(text)))add(m[0],m.index,m[0].length,validISO(m[3],MONTHS[m[2]],m[1]),'day-month');
    const monthDay=new RegExp(`\\b(${MONTH_PATTERN})\\s+(0?[1-9]|[12]\\d|3[01])(?:st|nd|rd|th)?[,]?\\s+(20\\d{2})\\b`,'g');
    while((m=monthDay.exec(text)))add(m[0],m.index,m[0].length,validISO(m[3],MONTHS[m[1]],m[2]),'month-day');

    const byISO=new Map();
    found.forEach(c=>{const current=byISO.get(c.iso);if(!current||c.score>current.score)byISO.set(c.iso,c);});
    return [...byISO.values()].sort((a,b)=>b.score-a.score||a.index-b.index);
  }

  function chooseDate(candidates,expectedDate=''){
    const positive=candidates.filter(x=>x.positive&&!x.negative);
    if(positive.length){
      const expected=positive.find(x=>x.iso===expectedDate);
      return {selected:expected||positive[0],ambiguous:false,administrativeOnly:false};
    }
    const usable=candidates.filter(x=>!x.negative);
    const expected=usable.find(x=>x.iso===expectedDate);
    if(expected)return {selected:expected,ambiguous:usable.length>1,administrativeOnly:false};
    if(usable.length===1)return {selected:usable[0],ambiguous:false,administrativeOnly:false};
    if(usable.length>1)return {selected:null,ambiguous:true,administrativeOnly:false};
    return {selected:null,ambiguous:false,administrativeOnly:candidates.length>0};
  }

  const TIME_POSITIVE=/(?:hor[aá]rio|hora|time|start|in[ií]cio|inicio|salida|departure|partida|entrada|ingreso|visita|slot|turno|embarque|check\s*in|pick\s*up|pickup)\s*[:#-]?\s*$/;
  const TIME_NEGATIVE=/(?:emiss[aã]o|emisi[oó]n|emitido|issued|compra|purchase|pedido|order|gerado|generated|criado|created|pagamento|payment)\s*(?:em|el|on|time|hora|hor[aá]rio)?\s*[:#-]?\s*$/;
  function extractTimeCandidates(input,expectedTime=''){
    const text=plain(input),found=[];
    const re=/\b([01]?\d|2[0-3])\s*([:h])\s*([0-5]\d)\b/g;let m;
    while((m=re.exec(text))){
      const value=`${String(m[1]).padStart(2,'0')}:${m[3]}`;
      const before=text.slice(Math.max(0,m.index-52),m.index);
      const positive=TIME_POSITIVE.test(before),negative=TIME_NEGATIVE.test(before);
      let score=positive?7:0;if(negative)score-=9;if(value===expectedTime)score+=1;
      found.push({value,index:m.index,score,positive,negative,context:(before.slice(-32)+' '+m[0]).replace(/\s+/g,' ').trim()});
    }
    const byValue=new Map();found.forEach(c=>{const cur=byValue.get(c.value);if(!cur||c.score>cur.score)byValue.set(c.value,c);});
    return [...byValue.values()].sort((a,b)=>b.score-a.score||a.index-b.index);
  }

  function chooseTime(candidates,expectedTime=''){
    const positive=candidates.filter(x=>x.positive&&!x.negative);
    if(positive.length){const expected=positive.find(x=>x.value===expectedTime);return {selected:expected||positive[0],ambiguous:positive.length>1};}
    const usable=candidates.filter(x=>!x.negative);
    if(usable.length===1)return {selected:usable[0],ambiguous:false};
    if(usable.length>1){const expected=usable.find(x=>x.value===expectedTime);return {selected:expected||null,ambiguous:true};}
    return {selected:null,ambiguous:false};
  }

  function analyzeTicketText(text,{expectedDate='',expectedTime='',tourName='',fileName=''}={}){
    const searchable=[text,String(fileName||'').replace(/_/g,' ')].filter(Boolean).join('\n');
    const dateCandidates=extractDateCandidates(searchable,expectedDate);
    const dateChoice=chooseDate(dateCandidates,expectedDate);
    const timeCandidates=extractTimeCandidates(searchable,expectedTime);
    const timeChoice=chooseTime(timeCandidates,expectedTime);
    let dateStatus='manual';
    if(dateChoice.selected)dateStatus=dateChoice.selected.iso===expectedDate?'ok':'danger';
    let timeStatus='missing';
    if(timeChoice.selected&&expectedTime)timeStatus=timeChoice.selected.value===expectedTime?'ok':'danger';
    else if(timeChoice.selected)timeStatus='found';
    else if(timeChoice.ambiguous)timeStatus='manual';
    const overall=dateStatus==='danger'||timeStatus==='danger'?'danger':dateStatus==='ok'?'ok':'manual';
    return {
      text,searchable,tourScore:scoreTour(tourName,searchable),dateCandidates,dateChoice,dateStatus,
      timeCandidates,timeChoice,timeStatus,overall
    };
  }

  function firstNum(text,patterns){for(const re of patterns){const m=String(text||'').match(re);if(m)return Number(m[1]);}return null;}
  function extractCounts(msg,expected){
    const text=String(msg||'');
    let adults=firstNum(text,[/\b(\d+)\s*ADT\b/i,/\bADT\b\s*[:=\-]?\s*(\d+)\b/i,/\(\s*ADT\s*\)\s*[:=\-]?\s*(\d+)\b/i]);
    let children=firstNum(text,[/\b(\d+)\s*CHD\b/i,/\bCHD\b\s*[:=\-]?\s*(\d+)\b/i,/\(\s*CHD\s*\)\s*[:=\-]?\s*(\d+)\b/i]);
    let babies=firstNum(text,[/\b(\d+)\s*INF\b/i,/\bINF\b\s*[:=\-]?\s*(\d+)\b/i,/\(\s*INF\s*\)\s*[:=\-]?\s*(\d+)\b/i]);
    const total=firstNum(text,[/Total\s+de\s+Pax\s*:\s*(\d+)/i,/Total\s+(?:de\s+)?passageiros\s*:\s*(\d+)/i]);
    let adultInferred=false,childInferred=false;
    if(children===null&&Number(expected.children||0)===0){children=0;childInferred=true;}
    if(babies===null&&Number(expected.babies||0)===0)babies=0;
    if(adults===null&&total!==null&&children!==null&&total-children===Number(expected.adults||0)){adults=Number(expected.adults||0);adultInferred=true;}
    return {adults,children,babies,total,adultInferred,childInferred};
  }
  function extractMessageDate(msg){const c=extractDateCandidates(msg);return c[0]?.iso||'';}
  function extractMessageTime(msg){const c=extractTimeCandidates(msg);const chosen=chooseTime(c);return chosen.selected?.value||(c.length===1?c[0].value:'');}
  function extractLocationParts(msg){
    const text=String(msg||'');
    const hotel=(text.match(/(?:^|\n)\s*Hotel\s*:\s*([^\n]+)/i)||[])[1]||'';
    const address=(text.match(/(?:^|\n)\s*Endere[cç]o\s*:\s*([^\n]+)/i)||[])[1]||'';
    return {hotel:hotel.trim(),address:address.trim(),combined:[hotel,address].filter(Boolean).join(' ')};
  }
  function candidateMatch(candidate,msg){
    const ex=norm(candidate),m=norm(msg);if(!ex)return null;if(m.includes(ex))return true;
    const stop=new Set(['hotel','endereco','ponto','encontro','punto','coleta','avenida','rua','calle','regiao','region','metropolitana','chile','providencia','numero','de','da','do','del','la','el','sta','santa']);
    const words=ex.split(' ').filter(w=>w.length>=4&&!stop.has(w)&&!/^\d+$/.test(w));
    const nums=String(candidate).match(/\d{2,}/g)||[],wordHits=words.filter(w=>m.includes(w)).length,numHits=nums.filter(n=>m.includes(n)).length;
    if(words.length&&wordHits/words.length>=0.5)return true;
    if(wordHits>=1&&numHits>=1)return true;
    if(nums.length>=1&&numHits===nums.length&&words.length<=2)return true;
    return false;
  }
  function hotelMatch(s,t,msg){
    const parts=extractLocationParts(msg),received=[parts.hotel,parts.address,parts.combined,msg].filter(Boolean),candidates=[t?.location,s?.hotel].filter(Boolean);
    if(!candidates.length)return null;
    for(const c of candidates)for(const r of received)if(candidateMatch(c,r)===true)return true;
    return false;
  }

  function ticketRequired(name){
    const db=window.db||{},direct=(db.catalog||[]).find(x=>norm(x?.name)===norm(name));
    if(direct)return !!direct.ticket;
    try{return !!window.findCatalogItem?.(name)?.ticket;}catch(_){return false;}
  }
  const ticketAttachments=s=>(s?.attachments||[]).map((a,index)=>({a,index})).filter(x=>x.a?.kind==='ticket');

  async function pdfText(blob){
    if(!window.pdfjsLib)throw new Error('Leitor de PDF não carregou.');
    window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const doc=await window.pdfjsLib.getDocument({data:await blob.arrayBuffer()}).promise,pages=[];
    for(let p=1;p<=doc.numPages;p++){
      const content=await (await doc.getPage(p)).getTextContent();
      const items=content.items.map(i=>({s:i.str,x:i.transform[4],y:i.transform[5]})).sort((a,b)=>Math.abs(b.y-a.y)>3?b.y-a.y:a.x-b.x);
      const lines=[];let line=[],last=null;
      items.forEach(i=>{if(last===null||Math.abs(i.y-last)<=3)line.push(i.s);else{lines.push(line.join(' '));line=[i.s];}last=i.y;});
      if(line.length)lines.push(line.join(' '));pages.push(lines.join('\n'));
    }
    return {text:pages.join('\n'),pages:doc.numPages};
  }

  function loadOCR(){
    if(window.Tesseract?.recognize)return Promise.resolve(window.Tesseract);
    if(window.ISA_TESSERACT_LOADING)return window.ISA_TESSERACT_LOADING;
    window.ISA_TESSERACT_LOADING=new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src=OCR_SRC;script.async=true;
      script.onload=()=>window.Tesseract?.recognize?resolve(window.Tesseract):reject(new Error('OCR não iniciou.'));
      script.onerror=()=>reject(new Error('OCR não pôde ser carregado.'));
      document.head.appendChild(script);
    });
    return window.ISA_TESSERACT_LOADING;
  }
  async function ocrImage(image){const T=await loadOCR(),r=await T.recognize(image,'eng');return r?.data?.text||'';}
  async function ocrPdf(blob,maxPages=3){
    if(!window.pdfjsLib)throw new Error('Leitor de PDF não carregou.');
    const doc=await window.pdfjsLib.getDocument({data:await blob.arrayBuffer()}).promise,out=[];
    for(let p=1;p<=Math.min(doc.numPages,maxPages);p++){
      const page=await doc.getPage(p),viewport=page.getViewport({scale:2}),canvas=document.createElement('canvas');
      canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
      await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
      out.push(await ocrImage(canvas));
    }
    return out.join('\n');
  }

  async function readTicket(item,expected){
    const a=item.a,key=[a.path,a.createdAt,a.size].join('|');if(ticketCache.has(key))return ticketCache.get(key);
    const promise=(async()=>{
      const sb=window.ISA_SUPABASE;if(!sb)throw new Error('Supabase ainda não está conectado.');
      if(!a.path)throw new Error('O ticket não possui caminho de armazenamento.');
      const {data,error}=await sb.storage.from('attachments').download(a.path);if(error)throw error;
      const type=String(a.mime||data?.type||'').toLowerCase(),name=String(a.name||'').toLowerCase();
      let text='',mode='';
      if(type.includes('pdf')||name.endsWith('.pdf')){
        const digital=await pdfText(data);text=digital.text;mode='PDF';
        const first=analyzeTicketText(text,{...expected,fileName:a.name});
        const weak=first.dateStatus==='manual'||(first.dateStatus==='danger'&&!first.dateChoice.selected?.positive);
        if(weak){try{const ocr=await ocrPdf(data);if(ocr.trim()){text+='\n'+ocr;mode='PDF + OCR';}}catch(_){/* o texto digital ainda pode ser utilizado */}}
      }else if(type.startsWith('image/')||/\.(png|jpe?g|webp|bmp)$/i.test(name)){
        text=await ocrImage(data);mode='OCR';
      }else if(type.startsWith('text/')||/\.(txt|csv)$/i.test(name)){
        text=await data.text();mode='texto';
      }else throw new Error('Formato de ticket não compatível com leitura automática.');
      return {...item,mode,analysis:analyzeTicketText(text,{...expected,fileName:a.name})};
    })();
    ticketCache.set(key,promise);try{return await promise;}catch(e){ticketCache.delete(key);throw e;}
  }

  function chooseTicket(results){
    const readable=results.filter(x=>x.analysis);if(!readable.length)return {best:null,ambiguous:false};
    readable.forEach((x,i)=>{x.rank=(x.analysis.dateStatus==='ok'?10:x.analysis.dateStatus==='danger'?3:0)+(x.analysis.timeStatus==='ok'?2:x.analysis.timeStatus==='danger'?-.5:0)+x.analysis.tourScore*5+i*.0001;});
    readable.sort((a,b)=>b.rank-a.rank);
    if(readable.length===1)return {best:readable[0],ambiguous:false};
    const best=readable[0],next=readable[1];
    const identified=best.analysis.tourScore>=.34||best.analysis.dateStatus==='ok';
    return {best:identified?best:null,ambiguous:!identified||Math.abs(best.rank-next.rank)<.3};
  }

  function vcard(title,state,body){const icon=state==='ok'?'✓':state==='danger'?'✕':'!';return `<div class="validatorcheck ${state}"><strong>${icon} ${esc(title)}</strong><span>${esc(body)}</span></div>`;}
  function setBusy(busy,text='Analisando mensagem e ticket...'){
    const btn=[...document.querySelectorAll('button')].find(b=>/analisar mensagem/i.test(b.textContent||''));
    if(btn){btn.disabled=busy;btn.dataset.originalText=btn.dataset.originalText||btn.textContent;btn.textContent=busy?'Analisando...':btn.dataset.originalText;}
    const box=el('validatorResult');if(busy&&box){box.className='alertbox warn';box.innerHTML=`<strong>⌛ ${esc(text)}</strong><div>Conferindo os dados da mensagem e o conteúdo do ticket anexado.</div>`;}
  }

  window.ISA_openTicketForValidation=async function(saleId,index){
    const s=(window.db?.sales||[]).find(x=>String(x.id)===String(saleId)),a=s?.attachments?.[index],sb=window.ISA_SUPABASE;if(!a||!sb)return;
    const {data,error}=await sb.storage.from('attachments').createSignedUrl(a.path,300);if(error)return alert('Não foi possível abrir o ticket: '+error.message);
    window.open(data.signedUrl,'_blank','noopener');
  };

  window.validateMessage=async function(){
    const db=window.db||{},s=(db.sales||[]).find(x=>String(x.id)===String(el('validatorSale')?.value)),msg=el('validatorMessage')?.value.trim();
    if(!s)return alert('Selecione uma venda.');if(!msg)return alert('Cole a mensagem da logística.');
    const expected=(s.tours||[]).filter(t=>active(t)&&t.date===localISO(1));
    if(!expected.length){el('validatorResult').className='alertbox validator-stop';el('validatorResult').innerHTML='<strong>✕ NÃO ENVIAR</strong><div>Nenhum passeio ativo desta venda está marcado para amanhã.</div>';return;}
    setBusy(true);
    try{
      const ranked=expected.map(t=>({t,score:scoreTour(t.name,msg)})).sort((a,b)=>b.score-a.score),best=ranked[0];
      const exp={adults:Number(best.t.adults??s.adults??0),children:Number(best.t.children??s.children??0),babies:Number(best.t.babies??s.babies??0)};
      const got=extractCounts(msg,exp),msgDate=extractMessageDate(msg),msgTime=extractMessageTime(msg),tourOk=best.score>=.45,dateOk=msgDate===best.t.date;
      const adultOk=got.adults!==null&&got.adults===exp.adults,childOk=got.children!==null&&got.children===exp.children,countsOk=adultOk&&childOk,hOk=hotelMatch(s,best.t,msg);
      const messageOk=tourOk&&dateOk&&countsOk&&!!msgTime&&(hOk!==false),needsTicket=ticketRequired(best.t.name),attachments=ticketAttachments(s);
      let selectedTicket=null,ticketProblem='',ticketAmbiguous=false;
      if(needsTicket&&attachments.length){
        const reads=[];
        for(const item of attachments){try{reads.push(await readTicket(item,{expectedDate:best.t.date,expectedTime:msgTime,tourName:best.t.name}));}catch(e){reads.push({...item,error:e?.message||String(e)});}}
        const chosen=chooseTicket(reads);selectedTicket=chosen.best;ticketAmbiguous=chosen.ambiguous;
        if(!selectedTicket){const reasons=reads.map(x=>x.error).filter(Boolean);ticketProblem=reasons[0]||'Não foi possível identificar com segurança qual ticket corresponde a este passeio.';}
      }else if(needsTicket)ticketProblem='Ticket obrigatório ainda não anexado à ficha.';
      const ta=selectedTicket?.analysis;
      const ticketOk=!needsTicket||(!!ta&&ta.dateStatus==='ok'&&ta.timeStatus!=='danger'&&!ticketAmbiguous);
      const essentialOk=messageOk&&ticketOk;
      const adultTxt=got.adults===null?'não identificado':`${got.adults} ADT${got.adultInferred?' (inferido pelo total)':''}`;
      const childTxt=got.children===null?'não identificado':`${got.children} CHD${got.childInferred?' (omitido na mensagem = 0)':''}`;
      const parts=extractLocationParts(msg),localDetail=hOk===true?`Local compatível${parts.hotel?' • '+parts.hotel:''}${parts.address?' • '+parts.address:''}`:hOk===false?'Hotel/endereço não conferem com o cadastro':'Não há local cadastrado para comparar';
      const messageCards=[
        vcard('Passeio',tourOk?'ok':'danger',tourOk?best.t.name:`Esperado: ${best.t.name}`),
        vcard('Data da mensagem',dateOk?'ok':'danger',`Esperada: ${fmtDate(best.t.date)} — Recebida: ${msgDate?fmtDate(msgDate):'não identificada'}`),
        vcard('Passageiros',countsOk?'ok':'danger',`Esperado: ${exp.adults} ADT / ${exp.children} CHD — Recebido: ${adultTxt} / ${childTxt}`),
        vcard('Hotel / coleta',hOk===true?'ok':hOk===false?'danger':'warn',localDetail),
        vcard('Horário da mensagem',msgTime?'ok':'danger',msgTime||'Não identificado')
      ];
      const ticketCards=[];let ticketActions='';
      if(needsTicket){
        if(selectedTicket){
          const d=ta.dateChoice.selected?.iso||'',time=ta.timeChoice.selected?.value||'';
          ticketCards.push(vcard('Ticket',ticketAmbiguous?'danger':'ok',ticketAmbiguous?'Há mais de um ticket possível; escolha/conferência manual necessária.':`${selectedTicket.a.name} • leitura ${selectedTicket.mode}`));
          ticketCards.push(vcard('Data do ticket',ta.dateStatus==='ok'?'ok':ta.dateStatus==='danger'?'danger':'warn',d?`Esperada: ${fmtDate(best.t.date)} — Ticket: ${fmtDate(d)}`:(ta.dateChoice.administrativeOnly?'Só foi encontrada data de emissão/compra; a data de uso não foi identificada.':'Data de uso não identificada no ticket.')));
          const timeState=ta.timeStatus==='danger'?'danger':ta.timeStatus==='ok'?'ok':'warn';
          ticketCards.push(vcard('Horário do ticket',timeState,time?`Mensagem: ${msgTime||'não identificada'} — Ticket: ${time}`:'O ticket não apresenta horário de uso identificável.'));
          ticketActions=`<button class="btn light sm" id="openValidatedTicketV11011">Abrir ticket</button>`;
        }else ticketCards.push(vcard('Ticket','danger',ticketProblem||'Ticket não identificado.'));
      }
      const title=essentialOk?(needsTicket?'✓ MENSAGEM E TICKET COMPATÍVEIS':'✓ MENSAGEM COMPATÍVEL'):'✕ NÃO ENVIAR';
      const reason=essentialOk?'Os dados essenciais conferem.':needsTicket&&!ticketOk?'O ticket precisa ser corrigido ou conferido antes do envio ao cliente.':'Há divergência em um ou mais dados essenciais.';
      const box=el('validatorResult');box.className='alertbox '+(essentialOk?'validator-ok-title':'validator-stop');
      box.innerHTML=`<strong>${title}</strong><div>${esc(reason)}</div><div class="isa-validator-group"><b>Mensagem da logística</b></div><div class="validator-result-stack">${messageCards.join('')}</div>${needsTicket?`<div class="isa-validator-group"><b>Ticket anexado</b></div><div class="validator-result-stack">${ticketCards.join('')}</div>`:''}<div class="actions">${ticketActions}${essentialOk?'<button class="btn gold" id="saveValidatedV11011">Salvar conferência</button>':''}</div>`;
      if(selectedTicket&&el('openValidatedTicketV11011'))el('openValidatedTicketV11011').onclick=()=>window.ISA_openTicketForValidation(s.id,selectedTicket.index);
      if(essentialOk&&el('saveValidatedV11011'))el('saveValidatedV11011').onclick=()=>{
        best.t.hour=msgTime;
        if(needsTicket&&selectedTicket){best.t.ticketValidation={status:'ok',attachmentPath:selectedTicket.a.path,attachmentName:selectedTicket.a.name,date:ta.dateChoice.selected?.iso||'',time:ta.timeChoice.selected?.value||'',validatedAt:new Date().toISOString(),validatorVersion:VERSION};}
        if(typeof window.addHistory==='function')window.addHistory(s,needsTicket?`Mensagem e ticket validados; ${best.t.name} em ${fmtDate(best.t.date)}${msgTime?' às '+msgTime:''}`:`Mensagem validada; horário ${msgTime} salvo em ${best.t.name}`);
        else if(Array.isArray(s.history))s.history.unshift({at:new Date().toISOString(),text:needsTicket?`Mensagem e ticket validados para ${best.t.name}`:`Mensagem validada para ${best.t.name}`});
        if(typeof window.save==='function')window.save();
        alert(needsTicket?'Mensagem e ticket conferidos. Horário salvo na venda.':'Horário salvo na venda.');
      };
      if(!essentialOk&&navigator.vibrate)navigator.vibrate([100,60,100]);
    }catch(e){
      console.error('ISA ticket validator',e);const box=el('validatorResult');box.className='alertbox validator-stop';box.innerHTML=`<strong>✕ NÃO FOI POSSÍVEL CONCLUIR</strong><div>${esc(e?.message||'Falha ao analisar o ticket.')}</div><div>Abra o ticket e faça a conferência manual antes de enviar.</div>`;
    }finally{setBusy(false);}
  };

  function decorateContext(){
    const db=window.db||{},s=(db.sales||[]).find(x=>String(x.id)===String(el('validatorSale')?.value)),box=el('validatorExpected');if(!s||!box)return;
    box.querySelector('#validatorTicketHintV11011')?.remove();
    const tomorrow=(s.tours||[]).filter(t=>active(t)&&t.date===localISO(1)),required=tomorrow.filter(t=>ticketRequired(t.name));if(!required.length)return;
    const count=ticketAttachments(s).length,hint=document.createElement('div');hint.id='validatorTicketHintV11011';hint.className='ticketflag';hint.style.marginTop='9px';
    hint.textContent=count?`🎟 ${count} ticket(s) anexado(s) — o conteúdo será conferido junto com a mensagem.`:'🎟 Ticket obrigatório não anexado — o validador impedirá a aprovação.';box.appendChild(hint);
  }
  function install(){
    const style=document.createElement('style');style.textContent='.isa-validator-group{margin:14px 0 7px;color:#0b2136;font-size:12px;text-transform:uppercase;letter-spacing:.04em}.validatorcheck.warn{border-color:#f0c36a;background:#fff8e8}.validatorcheck.danger{border-color:#ef9a9a}.validatorcheck.ok{border-color:#86d8a3}';document.head.appendChild(style);
    const old=window.updateValidatorContext;if(typeof old==='function'&&!old.__ticketV11011){const wrapped=function(...args){const r=old.apply(this,args);decorateContext();return r;};wrapped.__ticketV11011=true;window.updateValidatorContext=wrapped;}
    const btn=[...document.querySelectorAll('button')].find(b=>/analisar mensagem/i.test(b.textContent||''));if(btn)btn.onclick=window.validateMessage;
    el('validatorSale')?.addEventListener('change',()=>setTimeout(decorateContext,0));decorateContext();
  }

  window.ISA_TICKET_VALIDATOR={VERSION,extractDateCandidates,chooseDate,extractTimeCandidates,chooseTime,analyzeTicketText,scoreTour};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
