const U='https://muztiuctajofocbxklox.supabase.co';
// Chave pública (anon): pode ficar no front-end. A segurança vem do RLS no banco.
const K='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11enRpdWN0YWpvZm9jYnhrbG94Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4MTEyMjIsImV4cCI6MjEwMzM4NzIyMn0.ooDj6nm66mcPxIWasC9YuIHqhUuhiFHnvZMB82OIAeA';

const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const mins=t=>{const[a,b]=t.split(':');return +a*60+ +b};
const hm=m=>`${String(m/60|0).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;

async function api(p,o={}){
  const r=await fetch(U+p,{...o,headers:{apikey:K,Authorization:'Bearer '+K,'Content-Type':'application/json',...o.headers}});
  const t=await r.text(),j=t?JSON.parse(t):null;
  if(!r.ok)throw j||{};
  return j;
}

let hours={},items={},mode,cur,day,dayDate,slot;
const dlg=$('#dlg'),msg=$('#msg');
const say=(t,ok)=>{msg.textContent=t;msg.className=ok?'ok':''};

async function init(){
  try{
    const[s,p,h]=await Promise.all([
      api('/rest/v1/services?active=eq.true&order=price'),
      api('/rest/v1/membership_packages?active=eq.true&order=price'),
      api('/rest/v1/business_hours?active=eq.true')
    ]);
    hours=Object.fromEntries(h.map(x=>[x.weekday,x]));
    items={svc:s,pkg:p};
    $('#services').innerHTML=s.map((x,i)=>`<li><button class="row" data-m="svc" data-i="${i}"><span><b>${esc(x.name)}</b>${x.description?`<small>${esc(x.description)}</small>`:''}</span><span class="pr">${money(x.price)}<em>Agendar</em></span></button></li>`).join('')||'<li class="note">Nenhum serviço disponível.</li>';
    $('#packages').innerHTML=p.map((x,i)=>`<article><h3>${esc(x.name)}</h3><p>${esc(x.description)}</p><p class="big">${money(x.price)} <small>${esc(x.period)}</small></p><button class="btn" data-m="pkg" data-i="${i}">Assinar pacote</button></article>`).join('');
  }catch{
    $('#services').innerHTML='<li class="note">Não foi possível carregar os serviços. Atualize a página.</li>';
  }
}

document.addEventListener('click',e=>{
  const b=e.target.closest('[data-m]');
  if(b)openDlg(b.dataset.m,items[b.dataset.m][b.dataset.i]);
});

function openDlg(m,it){
  mode=m;cur=it;day=dayDate=slot=null;say('');
  $('#dt').textContent=it.name;
  $('#dsub').textContent=money(it.price)+(m==='pkg'?' '+it.period:'');
  $('#pick').hidden=m==='pkg';
  $('#go').textContent=m==='pkg'?'Assinar pacote':'Confirmar agendamento';
  $('#days').innerHTML='';
  $('#slots').innerHTML='<span class="note">Escolha um dia.</span>';
  if(m==='svc')buildDays();
  dlg.showModal();
}

function press(box,btn){box.querySelectorAll('.chip').forEach(c=>c.setAttribute('aria-pressed',c===btn))}

function buildDays(){
  const box=$('#days'),n=new Date();
  for(let i=0;i<14;i++){
    const d=new Date(n.getFullYear(),n.getMonth(),n.getDate()+i);
    if(!hours[d.getDay()])continue;
    const b=document.createElement('button');
    b.type='button';b.className='chip';b.setAttribute('aria-pressed','false');
    b.innerHTML=`${d.toLocaleDateString('pt-BR',{weekday:'short'}).replace('.','')}<b>${d.getDate()}/${d.getMonth()+1}</b>`;
    b.onclick=()=>{day=iso(d);dayDate=d;slot=null;press(box,b);loadSlots(d)};
    box.append(b);
  }
  if(!box.children.length)box.textContent='Sem horários nos próximos dias.';
}

async function loadSlots(d){
  const box=$('#slots');
  box.innerHTML='<span class="note">Carregando…</span>';
  try{
    const rows=await api('/rest/v1/public_appointment_slots?select=time&date=eq.'+iso(d));
    const taken=new Set(rows.map(r=>r.time.slice(0,5)));
    const h=hours[d.getDay()],now=new Date();
    const today=iso(d)===iso(now),nowM=now.getHours()*60+now.getMinutes();
    box.innerHTML='';
    for(let m=mins(h.open_time);m+30<=mins(h.close_time);m+=30){
      const t=hm(m);
      if(taken.has(t)||(today&&m<=nowM))continue;
      const b=document.createElement('button');
      b.type='button';b.className='chip';b.textContent=t;b.setAttribute('aria-pressed','false');
      b.onclick=()=>{slot=t;press(box,b)};
      box.append(b);
    }
    if(!box.children.length)box.innerHTML='<span class="note">Sem horários livres neste dia.</span>';
  }catch{
    box.innerHTML='<span class="note">Não foi possível carregar os horários.</span>';
  }
}

$('#f').addEventListener('submit',async e=>{
  e.preventDefault();
  const name=$('#nm').value.trim(),phone=$('#ph').value.replace(/\D/g,'');
  if(phone.length<10)return say('Informe o telefone com DDD.');
  if(mode==='svc'&&(!day||!slot))return say('Escolha o dia e o horário.');
  const btn=$('#go');btn.disabled=true;say('');
  try{
    if(mode==='svc'){
      await api('/rest/v1/appointments',{method:'POST',headers:{Prefer:'return=minimal'},
        body:JSON.stringify({client_name:name,phone,service_id:cur.id,date:day,time:slot+':00'})});
      say(`Agendado para ${dayDate.toLocaleDateString('pt-BR')} às ${slot}. Até lá!`,true);
      slot=null;loadSlots(dayDate);
    }else{
      await api('/rest/v1/rpc/subscribe_to_package',{method:'POST',
        body:JSON.stringify({p_phone:phone,p_client_name:name,p_package_id:cur.id})});
      say('Assinatura registrada. O barbeiro confirma o pagamento e entra em contato.',true);
    }
  }catch(err){
    if(err.code==='23505'){say('Esse horário acabou de ser ocupado. Escolha outro.');if(dayDate)loadSlots(dayDate)}
    else say(err.message||'Não foi possível concluir. Tente de novo.');
  }
  btn.disabled=false;
});

$('#x').onclick=()=>dlg.close();
dlg.addEventListener('click',e=>{if(e.target===dlg)dlg.close()});

const nav=$('#nav'),mb=$('#menu');
mb.onclick=()=>{const o=nav.classList.toggle('open');mb.setAttribute('aria-expanded',o)};
nav.onclick=e=>{if(e.target.tagName==='A'){nav.classList.remove('open');mb.setAttribute('aria-expanded',false)}};

init();
