function parseVoucherNovo(raw){
  const lines=String(raw||'').replace(/\r/g,'\n').split('\n').map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean),joined=lines.join(' ');
  const pick=(re)=>((joined.match(re)||[])[1]||'').trim();
  const money=v=>{let n=String(v||'').replace(/[^\d,.-]/g,'').replace(/\./g,'').replace(',','.');return Math.round((Number(n)||0)*100)};
  const maskPhone=v=>{let d=String(v||'').replace(/\D/g,'');if(d.startsWith('55')&&(d.length===12||d.length===13))d=d.slice(2);if(d.length===11)return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;if(d.length===10)return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;return String(v||'').trim()};
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
  const servicePart=(joined.split(/LISTA\s+DE\s+SERVI[CÇ]OS/i)[1]||'').split(/FORMA\s+DE\s+PAGAMENTO/i)[0]||'';
  let tours=[];
  const tr=/(\d{2}\/\d{2}\/\d{4})\s+---\s+(.+?)\s+(\d+)\s*\((\d+)-(\d+)-(\d+)-(\d+)-(\d+)\)\s+R\$\s*([\d.]+,\d{2})\s+R\$\s*([\d.]+,\d{2})\s+R\$\s*([\d.]+,\d{2})(?=\s+(?:Pago|Pendente|Cancelado|\d{2}\/\d{2}\/\d{4}|R\$|$))/gi;
  while((m=tr.exec(servicePart)))tours.push({date:isoBR(m[1]),name:m[2].trim(),adults:+m[4],children:+m[5],babies:+m[6],seniors:+m[7],hour:'',location:'',messageSent:false,cancelChecked:null,cancelled:false,priceCents:money(m[11]),commissionCents:0});
  if(!tours.length){for(const line of lines){const x=line.match(/^(\d{2}\/\d{2}\/\d{4})\s+---\s+(.+?)\s+(\d+)\s*\((\d+)-(\d+)-(\d+)-(\d+)-(\d+)\).*?R\$\s*([\d.]+,\d{2})\s+R\$\s*([\d.]+,\d{2})\s+R\$\s*([\d.]+,\d{2})/i);if(x)tours.push({date:isoBR(x[1]),name:x[2].trim(),adults:+x[4],children:+x[5],babies:+x[6],seniors:+x[7],hour:'',location:'',messageSent:false,cancelChecked:null,cancelled:false,priceCents:money(x[11]),commissionCents:0})}}
  const detailStart=joined.search(/\bVoucher\s+SERVI[CÇ]O/i);
  const details=detailStart>=0?joined.slice(detailStart):joined;
  tours.forEach(t=>{const i=details.toLowerCase().indexOf(t.name.toLowerCase());if(i>=0){const near=details.slice(i,i+650),am=near.match(/Airbnb\s+Endere[cç]o\s*:\s*(.+?)(?=\s+\d+\s*\(\d+-\d+-\d+-\d+-\d+\)|\s+Voucher\s+SERVI[CÇ]O|\s+FILE\s*:|\s+CONTATO\s*:|$)/i),lm=near.match(/Local\s+de\s+Embarque\s*:\s*(.+?)(?=\s+Airbnb\s+Endere[cç]o|\s+\d{2}\/\d{2}\/\d{4}|\s+\d+\s*\(\d+-\d+-\d+-\d+-\d+\)|\s+Voucher\s+SERVI[CÇ]O|\s+FILE\s*:|$)/i);if(am)t.location=am[1].trim();else if(lm)t.location=lm[1].trim()}});
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