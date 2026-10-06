let tokenClient;
let accessToken = null;

const cfg = window.PFC_CONFIG || {};
const $ = id => document.getElementById(id);

function setStatus(msg){ $('status').textContent = msg; }
function setProgress(p){ $('bar').style.width = `${Math.max(0,Math.min(100,p))}%`; }
function pad(n){ return String(n).padStart(2,'0'); }
function monthName(m){ return new Date(2000,m-1,1).toLocaleString('en-US',{month:'long'}); }

function initSelectors(){
  const now = new Date();
  for(let m=1;m<=12;m++) $('month').add(new Option(monthName(m),m));
  $('month').value = now.getMonth()+1;
  for(let y=now.getFullYear()-5;y<=now.getFullYear()+1;y++) $('year').add(new Option(y,y));
  $('year').value = now.getFullYear();
}

function initGoogle(){
  if(!cfg.GOOGLE_CLIENT_ID || cfg.GOOGLE_CLIENT_ID.includes('PASTE_')){
    setStatus('Add your Google OAuth Web Client ID in config.js first.');
    $('generate').disabled = true;
    return;
  }
  const wait = () => {
    if(window.google?.accounts?.oauth2){
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: cfg.GOOGLE_CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/gmail.readonly',
        callback: async (response) => {
          if(response.error){ setStatus('Google sign-in failed: '+response.error); $('generate').disabled=false; return; }
          accessToken = response.access_token;
          await generate();
        }
      });
      $('generate').disabled = false;
    } else setTimeout(wait,200);
  };
  wait();
}

async function gmail(path, options={}){
  const r=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/'+path,{...options,headers:{...(options.headers||{}),Authorization:'Bearer '+accessToken}});
  if(!r.ok){ const t=await r.text(); throw new Error(`Gmail API ${r.status}: ${t}`); }
  return r.json();
}

async function listMessages(q){
  let out=[], pageToken='';
  do{
    const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
    url.searchParams.set('q',q); url.searchParams.set('maxResults','500');
    if(pageToken) url.searchParams.set('pageToken',pageToken);
    const r=await fetch(url,{headers:{Authorization:'Bearer '+accessToken}});
    if(!r.ok) throw new Error('Could not list Gmail messages: '+await r.text());
    const data=await r.json(); out.push(...(data.messages||[])); pageToken=data.nextPageToken||'';
  }while(pageToken);
  return out;
}

function header(headers,name){ return headers.find(h=>h.name.toLowerCase()===name.toLowerCase())?.value||''; }
function decodeBase64Url(s){
  if(!s) return '';
  s=s.replace(/-/g,'+').replace(/_/g,'/');
  while(s.length%4) s+='=';
  try{ return decodeURIComponent(escape(atob(s))); }catch{ try{return atob(s)}catch{return '';} }
}
function stripHtml(s){ const d=document.createElement('div'); d.innerHTML=s; return (d.textContent||d.innerText||'').replace(/\s+/g,' ').trim(); }
function bodyText(payload){
  let plain='', html='';
  function walk(p){
    if(!p) return;
    const data=decodeBase64Url(p.body?.data||'');
    if(p.mimeType==='text/plain') plain += ' '+data;
    if(p.mimeType==='text/html') html += ' '+data;
    (p.parts||[]).forEach(walk);
  }
  walk(payload);
  return (plain||stripHtml(html)).replace(/\s+/g,' ').trim();
}

function classify(text){
  const t=text.toLowerCase();
  if(/\b(error|issue|problem|failed|failure|not working|incorrect|wrong|exception|unable|does not|not showing|mismatch|bug|discrepancy|difference)\b/.test(t)) return 'ERROR RECTIFICATION';
  if(/\b(develop|development|new module|new screen|new functionality|new feature|create a module|create a screen)\b/.test(t)) return 'DEVELOPMENT';
  return 'MODIFICATION';
}

function cleanTask(subject, body){
  let s=(subject||'').replace(/^(re|fw|fwd):\s*/ig,'').trim();
  if(!s || s.length<5) s=body.slice(0,180);
  return s.replace(/\s+/g,' ').trim();
}

function parseSender(from){
  const m=from.match(/^\s*([^<]+)\s*<[^>]+>/);
  return (m?m[1]:from).replace(/"/g,'').trim();
}

// Many of your work emails are forwarded. In those emails, the Gmail sender can
// be different from the person who originally raised the task. Try to recover
// the original From/Subject from the forwarded content.
function extractForwardedDetails(body){
  const result={originalFrom:'', originalSubject:''};
  if(!body) return result;

  const fromMatch=body.match(/(?:^|\s)(?:From|De|Von|发件人)\s*:\s*([^\n\r]+?)(?=\s+(?:Sent|Date|To|Cc|Subject|Asunto|\n)\s*:|$)/i);
  const subjectMatch=body.match(/(?:^|\s)(?:Subject|Asunto)\s*:\s*([^\n\r]+)/i);
  if(fromMatch) result.originalFrom=fromMatch[1].trim();
  if(subjectMatch) result.originalSubject=subjectMatch[1].trim();
  return result;
}

function isExcludedMessage(msg){
  const excluded=cfg.EXCLUDED_LABELS || ['CATEGORY_PROMOTIONS','CATEGORY_SOCIAL','CATEGORY_FORUMS'];
  return (msg.labelIds||[]).some(x=>excluded.includes(x));
}

function fmtDate(d){ const x=new Date(d); return `${pad(x.getDate())}-${pad(x.getMonth()+1)}-${x.getFullYear()}`; }

async function generate(){
  $('generate').disabled=true; setProgress(5);
  const month=Number($('month').value), year=Number($('year').value);
  const after=`${year}/${pad(month)}/01`;
  const next=new Date(year,month,1);
  const before=`${next.getFullYear()}/${pad(next.getMonth()+1)}/01`;

  // Gmail's category filters remove common promotional/social mail before we
  // download full messages. We deliberately do NOT exclude CATEGORY_UPDATES,
  // because genuine work mail can be classified by Gmail as Updates.
  let q=`after:${after} before:${before} -category:promotions -category:social -category:forums`;
  if(cfg.EXTRA_GMAIL_QUERY) q+=' '+cfg.EXTRA_GMAIL_QUERY;

  try{
    setStatus('Searching Gmail for work emails...');
    const ids=await listMessages(q);
    if(!ids.length){ setStatus('No work emails found for this month.'); setProgress(100); return; }

    const rows=[];
    const seen=new Set();
    let skippedCategories=0;

    for(let i=0;i<ids.length;i++){
      setStatus(`Checking email ${i+1} of ${ids.length}...`);
      setProgress(10+Math.round((i/ids.length)*75));

      const msg=await gmail(`messages/${ids[i].id}?format=full`);
      if(isExcludedMessage(msg)){ skippedCategories++; continue; }

      const h=msg.payload?.headers||[];
      const date=header(h,'Date'), from=header(h,'From'), subject=header(h,'Subject');
      const key=msg.id;
      if(seen.has(key)) continue;
      seen.add(key);

      const body=bodyText(msg.payload);
      const forwarded=extractForwardedDetails(body);
      const originalFrom=forwarded.originalFrom || from;
      const originalSubject=forwarded.originalSubject || subject;
      const task=cleanTask(originalSubject,body);

      // Task date stays the date of the email in your mailbox. This avoids
      // moving an October forwarded task into an older month just because the
      // original message was sent earlier.
      rows.push({
        task,
        requirementBy:parseSender(originalFrom),
        department:cfg.DEPARTMENT||'PFC',
        taskDate:new Date(date),
        status:cfg.DEFAULT_STATUS||'COMPLETED',
        completionDate:'',
        handledBy:cfg.TASK_HANDLED_BY||'IWS',
        taskType:classify(originalSubject+' '+body)
      });
    }

    rows.sort((a,b)=>a.taskDate-b.taskDate);
    await createWorkbook(rows,month,year);
    setProgress(100);
    setStatus(`Done. ${rows.length} work tasks exported${skippedCategories ? ` (${skippedCategories} promotional/social emails skipped)` : ''}.`);
  }catch(e){
    console.error(e); setStatus(e.message||String(e)); setProgress(0);
  }finally{ $('generate').disabled=false; }
}

async function createWorkbook(rows,month,year){
  const wb=new ExcelJS.Workbook(); wb.creator='PFC Gmail Task Sheet Generator';
  const ws=wb.addWorksheet(`${monthName(month)} ${year}`);
  ws.mergeCells('A1:I1'); ws.getCell('A1').value=`PFC TASK SHEET - ${monthName(month).toUpperCase()} ${year}`;
  ws.getCell('A1').font={bold:true,size:14}; ws.getCell('A1').alignment={horizontal:'center',vertical:'middle'}; ws.getRow(1).height=24;
  const headers=['Sl.No','TASK','Requirement By','Department','Task Date','Status','Completion Date','Task Handled By','Task Type'];
  ws.addRow(headers);
  const hr=ws.getRow(2); hr.font={bold:true}; hr.alignment={horizontal:'center',vertical:'middle',wrapText:true}; hr.height=30;
  rows.forEach((r,i)=>ws.addRow([i+1,r.task,r.requirementBy,r.department,r.taskDate,r.status,r.completionDate,r.handledBy,r.taskType]));
  ws.eachRow((row,idx)=>{ if(idx>=3){ row.alignment={vertical:'top',wrapText:true}; row.getCell(5).numFmt='dd-mm-yyyy'; if(row.getCell(7).value instanceof Date) row.getCell(7).numFmt='dd-mm-yyyy'; }});
  const widths=[8,55,28,16,15,16,18,20,24]; widths.forEach((w,i)=>ws.getColumn(i+1).width=w);
  ws.views=[{state:'frozen',ySplit:2}]; ws.autoFilter='A2:I2';
  const buf=await wb.xlsx.writeBuffer();
  const blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`PFC TASK SHEET ${monthName(month).toUpperCase()} ${year}.xlsx`; a.click(); URL.revokeObjectURL(a.href);
}

$('generate').addEventListener('click',()=>{
  if(!accessToken){ $('generate').disabled=true; setStatus('Opening Google sign-in...'); tokenClient.requestAccessToken({prompt:'consent'}); }
  else generate();
});
initSelectors(); initGoogle();
