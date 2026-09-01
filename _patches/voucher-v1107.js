function parseVoucherNovo(raw){
  const lines=String(raw||'').replace(/\r/g,'\n').split('\n').map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean),joined=lines.join(' ');
  const pick=(re)=>((joined.match(re)||[])[1]||'').trim();
  const money=v=>{let n=String(v||'').replace(/[^\d,.-]/g,'').replace(/\./g,'').replace(',','.');return Math.round((Number(n)||0)*100)};
  const maskPhone=v=>{let d=String(v||'').replace(/\D/g,'');if(d.startsWith('55')&&(d.length===12||d.length===13))d=d.slice(2);if(d.length===11)return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;if(d.length===10)return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;return String(v||'').trim()};
  const canonicalServiceName=v=>{const s=String(v||'').replace(/\s+/g,' ').trim();if(/^transfer\s*in$/i.test(s))return 'TRANSFER IN';if(/^transfer\s*out$/i.test(s))return 'TRANSFER OUT';return s};
  const file=pick(/\bFILE\s*:\s*(\d+)/i);
  const client=pick(/COMPRADOR\s*:\s*(.+?)\s+TELEFONE\s+COMPRADOR\s*:/i);
  const phone=maskPhone(pick(/TELEFONE\s+COMPRADOR\s*:\s*(.+?)(?=\s+(?:PAX\s+TITULAR|QTD\s+PAX|VENDEDOR|DATA\s+CRIA))/i));
  const seller=pick(/VENDEDOR\s*:\s*(.+?)(?=\s+DATA\s+CRIA)/i);
  const launch=pick(/DATA\s+CRIA[^:]{0,8}:\s*(\d{2}\/\d{2}\/\d{4}\s+\d{1,2}:\d{2})/i);

  const passengerText=(joined.split(/LISTA\s+DE\s+PASSAGEIROS/i)[1]||'').split(/LISTA\s+DE\s+SERVI[CÇ]OS/i)[0]||'';
  let passengers=[],seen=new Set(),m;
  const pr=/(.+?)\s*\((adt|chd|inf|snr|sen|free)\)\s*\/\s*([A-Z0-9.\-]{5,})(?=\s+(?:.+?\s*\((?:adt|chd|inf|snr|sen|free)\)\s*\/|$))/gi;
  while((m=pr.exec(passengerText))){const name=m[1].replace(/^[:\-\s]+/,'').trim(),doc=m[3].trim(),key=(name+'|'+doc).toLowerCase();if(name&&!seen.has(key)){seen.add(key);passengers.push({name,document:doc,age:'',type:m[2].toLowerCase()==='snr'?'sen':m[2].toLowerCase()})}}
  if(!passengers.length){for(const line of lines){const x=line.match(/^(.+?)\s*\((adt|chd|inf|snr|sen|free)\)\s*\/\s*([A-Z0-9.\-]{5,})\s*$/i);if(x)passengers.push({name:x[1].trim(),document:x[3].trim(),age:'',type:x[2].toLowerCase()==='snr'?'sen':x[2].toLowerCase()})}}

  const listStart=lines.findIndex(x=>/LISTA\s+DE\s+SERVI[CÇ]OS/i.test(x));
  const firstDetail=lines.findIndex((x,i)=>i>(listStart<0?0:listStart)&&/^FILE\s*:\s*\d+\s*\/\s*\d+/i.test(x));
  const summaryLines=lines.slice(listStart>=0?listStart+1:0,firstDetail>=0?firstDetail:lines.length);
  const summaryEnd=summaryLines.findIndex(x=>/FORMA\s+DE\s+PAGAMENTO/i.test(x));
  const serviceSummary=summaryEnd>=0?summaryLines.slice(0,summaryEnd):summaryLines;
  const priceForDate=dateBR=>{
    const idx=serviceSummary.findIndex(x=>x.includes(dateBR));if(idx<0)return 0;
    let end=serviceSummary.length;
    for(let i=idx+1;i<serviceSummary.length;i++)if(/\b\d{2}\/\d{2}\/\d{4}\b/.test(serviceSummary[i])){end=i;break}
    let chunk=serviceSummary.slice(idx,end).join(' ');
    const statusAt=chunk.search(/\b(?:Pago|Pendente|Cancelado)\b/i);if(statusAt>=0)chunk=chunk.slice(0,statusAt);
    const vals=[...chunk.matchAll(/R\$\s*([\d.]+,\d{2})/g)].map(x=>x[1]);
    return vals.length?money(vals[vals.length-1]):0;
  };

  const detailStarts=[];
  lines.forEach((x,i)=>{if(/^FILE\s*:\s*\d+\s*\/\s*\d+/i.test(x))detailStarts.push(i)});
  let tours=[];
  const isBoundaryLine=x=>/^(?:Voucher|SERVI[CÇ]O|PARA:|PAX\s+TITULAR|CONTATO:|CNPJ:|OBSERVA|Emiss[aã]o)/i.test(x)||/^FILE\s*:/i.test(x);
  for(let bi=0;bi<detailStarts.length;bi++){
    const st=detailStarts[bi],en=bi+1<detailStarts.length?detailStarts[bi+1]:lines.length,block=lines.slice(st,en),blockText=block.join(' ');
    let free=block.findIndex(x=>/^FREE$/i.test(x));
    let name='';
    if(free>=0){for(let i=free+1;i<Math.min(block.length,free+5);i++){const cand=block[i];if(!cand||isBoundaryLine(cand)||/^ADT\b|^DATA\s*\/\s*HORA/i.test(cand)||/^\d{2}\/\d{2}\/\d{4}\b/.test(cand)||/Local\s+de\s+Embarque/i.test(cand))continue;name=cand;break}}
    if(!name){const sm=blockText.match(/FREE\s+(.+?)(?=\s+Local\s+de\s+Embarque|\s+\d{2}\/\d{2}\/\d{4})/i);name=(sm?.[1]||'').trim()}
    name=canonicalServiceName(name);if(!name)continue;
    const dm=blockText.match(/\b(\d{2}\/\d{2}\/\d{4})\b/);if(!dm)continue;const dateBR=dm[1];
    const cm=blockText.match(/\b\d+\s*\((\d+)-(\d+)-(\d+)-(\d+)-(\d+)\)/);const adt=+(cm?.[1]||0),chd=+(cm?.[2]||0),inf=+(cm?.[3]||0),sen=+(cm?.[4]||0);
    let base='';
    for(const line of block){const lm=line.match(/Local\s+de\s+Embarque\s*:\s*(.*)$/i);if(lm){base=lm[1].trim();break}}
    let hotel='',address='';
    const ai=block.findIndex(x=>/Endere[cç]o\s*:/i.test(x));
    if(ai>=0){
      const parts=block[ai].split(/Endere[cç]o\s*:/i);hotel=(parts[0]||'').trim().replace(/^OUTROS\d+\s*\/\s*\d{1,2}:\d{2}\s*/i,'').replace(/\s*[-–—]\s*$/,'').trim();address=(parts.slice(1).join('Endereço:')||'').trim();
      for(let j=ai+1;j<Math.min(block.length,ai+3);j++){const nxt=block[j];if(isBoundaryLine(nxt)||/^\d{2}\/\d{2}\/\d{4}\b/.test(nxt))break;if(/(?:Regi[oó]n|Metropolitana|Providencia|Chile)/i.test(nxt))address+=(address?' ':'')+nxt;else break}
    }
    const location=[base,hotel,address?`Endereço: ${address}`:''].filter(Boolean).join(' ').replace(/\s+/g,' ').trim();
    tours.push({date:isoBR(dateBR),name,adults:adt,children:chd,babies:inf,seniors:sen,hour:'',location,messageSent:false,cancelChecked:null,cancelled:false,priceCents:priceForDate(dateBR),commissionCents:0});
  }

  if(!tours.length){
    const servicePart=(joined.split(/LISTA\s+DE\s+SERVI[CÇ]OS/i)[1]||'').split(/FORMA\s+DE\s+PAGAMENTO/i)[0]||'';
    const tr=/(\d{2}\/\d{2}\/\d{4})\s+---\s+(.+?)\s+(\d+)\s*\((\d+)-(\d+)-(\d+)-(\d+)-(\d+)\)\s+R\$\s*([\d.]+,\d{2})\s+R\$\s*([\d.]+,\d{2})\s+R\$\s*([\d.]+,\d{2})(?=\s+(?:Pago|Pendente|Cancelado|\d{2}\/\d{2}\/\d{4}|R\$|$))/gi;
    while((m=tr.exec(servicePart)))tours.push({date:isoBR(m[1]),name:canonicalServiceName(m[2]),adults:+m[4],children:+m[5],babies:+m[6],seniors:+m[7],hour:'',location:'',messageSent:false,cancelChecked:null,cancelled:false,priceCents:money(m[11]),commissionCents:0});
    if(!tours.length){for(const line of lines){const x=line.match(/^(\d{2}\/\d{2}\/\d{4})\s+---\s+(.+?)\s+(\d+)\s*\((\d+)-(\d+)-(\d+)-(\d+)-(\d+)\).*?R\$\s*([\d.]+,\d{2})\s+R\$\s*([\d.]+,\d{2})\s+R\$\s*([\d.]+,\d{2})/i);if(x)tours.push({date:isoBR(x[1]),name:canonicalServiceName(x[2]),adults:+x[4],children:+x[5],babies:+x[6],seniors:+x[7],hour:'',location:'',messageSent:false,cancelChecked:null,cancelled:false,priceCents:money(x[11]),commissionCents:0})}}
  }

  const unique=[];const tourSeen=new Set();for(const t of tours){const k=`${t.date}|${String(t.name).toLowerCase()}`;if(!tourSeen.has(k)){tourSeen.add(k);unique.push(t)}}tours=unique;
  const meet=(tours.find(t=>t.location)||{}).location||pick(/Airbnb\s+Endere[cç]o\s*:\s*(.+?)(?=\s+\d+\s*\(\d+-\d+-\d+-\d+-\d+\)|\s+Voucher|$)/i)||pick(/Local\s+de\s+Embarque\s*:\s*(.+?)(?=\s+Airbnb\s+Endere[cç]o|\s+\d{2}\/\d{2}\/\d{4}|\s+Voucher|$)/i);
  if(meet)tours.forEach(t=>{if(!t.location)t.location=meet});
  const valueCents=money(pick(/\bTOTAL\s*:\s*R\$\s*([\d.]+,\d{2})/i));
  const paidCents=money(pick(/TOTAL\s+PAGO\s*:\s*R\$\s*([\d.]+,\d{2})/i));
  const payPart=(joined.split(/FORMA\s+DE\s+PAGAMENTO/i)[1]||'').split(/SUBTOTAL\s*:/i)[0]||'';
  let payments=[],payRe=/R\$\s*([\d.]+,\d{2})\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{1,2}:\d{2})\s+(.+?)(?=\s+R\$\s*[\d.]+,\d{2}\s+\d{2}\/\d{2}\/\d{4}|$)/gi;
  while((m=payRe.exec(payPart)))payments.push({valueCents:money(m[1]),date:m[2],time:m[3],type:m[4].trim()});
  const payTypes=[...new Set(payments.map(p=>p.type).filter(Boolean))];
  const paymentMethod=payTypes.length===1?(/cart[aã]o/i.test(payTypes[0])?'Cartão':/pix/i.test(payTypes[0])?'PIX':/dinheiro/i.test(payTypes[0])?'Dinheiro':/transfer/i.test(payTypes[0])?'Transferência':'Outro'):(payTypes.length?'Outro':'');
  const paymentDate=payments.length?isoBR(payments[payments.length-1].date):'';
  const counts={adults:0,children:0,babies:0};
  if(passengers.length){counts.adults=passengers.filter(p=>p.type==='adt').length;counts.children=passengers.filter(p=>p.type==='chd').length;counts.babies=passengers.filter(p=>p.type==='inf').length}else tours.forEach(t=>{counts.adults=Math.max(counts.adults,t.adults);counts.children=Math.max(counts.children,t.children);counts.babies=Math.max(counts.babies,t.babies)});
  return{voucherFile:file,name:client,email:'',phone,sellerName:seller,launchDate:launch,hotel:meet,tours,passengers,...counts,type:'Regular',valueCents,paidCents,paymentMethod,paymentDate,voucherFormat:'novo'};
}
