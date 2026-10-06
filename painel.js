const U='https://muztiuctajofocbxklox.supabase.co';
// Chave pública (anon). Quem manda no acesso é o login + as regras RLS (só admin).
const K='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11enRpdWN0YWpvZm9jYnhrbG94Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4MTEyMjIsImV4cCI6MjEwMzM4NzIyMn0.ooDj6nm66mcPxIWasC9YuIHqhUuhiFHnvZMB82OIAeA';

const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const br=s=>s.slice(8,10)+'/'+s.slice(5,7)+'/'+s.slice(0,4);
const ST={booked:'Agendado',confirmed:'Confirmado',completed:'Concluído',cancelled:'Cancelado'};
const MIN={Prefer:'return=minimal'};

const TITLE='Painel — Fagundes Barbearia';
let T=sessionStorage.getItem('t'),cur='agenda',agDate,fnMonth,fnData,cache={},poll,seen,pend={a:[],s:[]};

async function api(p,o={}){
  const r=await fetch(U+p,{...o,headers:{apikey:K,Authorization:'Bearer '+(T||K),'Content-Type':'application/json',...o.headers}});
  const t=await r.text(),j=t?JSON.parse(t):null;
  if(!r.ok){if(r.status===401)logout();throw j||{}}
  return j;
}
const say=(t,ok)=>{$('#tm').textContent=t;$('#tm').className=ok?'ok':''};
async function run(fn,okMsg){
  say('');
  try{await fn();if(okMsg)say(okMsg,true)}catch(e){say(e.message||'Não foi possível concluir. Tente de novo.')}
}

/* ---------- login ---------- */
function show(on){$('#login').hidden=on;$('#app').hidden=!on;$('#out').hidden=!on}
function logout(){T=null;sessionStorage.removeItem('t');clearInterval(poll);clearNew();show(false)}
$('#out').onclick=logout;
$('#lf').onsubmit=async e=>{
  e.preventDefault();$('#lm').textContent='';
  try{
    const r=await fetch(U+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:K,'Content-Type':'application/json'},
      body:JSON.stringify({email:$('#em').value.trim(),password:$('#pw').value})});
    const j=await r.json();if(!r.ok)throw j;
    T=j.access_token;sessionStorage.setItem('t',T);$('#pw').value='';start();
  }catch{$('#lm').textContent='E-mail ou senha incorretos.'}
};
function start(){show(true);tab('agenda');watch()}

/* ---------- abas ---------- */
$('#tabs').onclick=e=>{const b=e.target.closest('[data-t]');if(b)tab(b.dataset.t)};
async function tab(n){
  cur=n;say('');
  document.querySelectorAll('#tabs button').forEach(b=>b.setAttribute('aria-selected',b.dataset.t===n));
  $('#v').innerHTML='<p class="note">Carregando…</p>';
  try{await tabs[n]()}catch(e){$('#v').innerHTML='<p class="err">Não foi possível carregar. '+esc(e.message||'')+'</p>'}
}

const tabs={
  async agenda(){
    const d=agDate||(agDate=iso(new Date()));
    const rows=await api(`/rest/v1/appointments?select=*,services(name,price),membership_packages(name)&date=eq.${d}&order=time`);
    cache=Object.fromEntries(rows.map(a=>[a.id,a]));
    $('#v').innerHTML=`<div class="bar"><label class="lab" for="ad" style="margin:0">Dia</label><input type="date" id="ad" value="${d}"></div><ul class="list">`+
      (rows.map(a=>{
        const nm=a.services?.name||'Pacote: '+(a.membership_packages?.name||'');
        const b=(s,l,c='')=>`<button class="sm ${c}" data-a="st" data-id="${a.id}" data-s="${s}">${l}</button>`;
        const acts=(a.status==='booked'?b('confirmed','Confirmar'):'')+(a.status==='booked'||a.status==='confirmed'?b('completed','Concluir')+b('cancelled','Cancelar','no'):'')+(a.package_id?'':`<button class="sm no" data-a="delap" data-id="${a.id}">Excluir</button>`);
        return `<li class="ap ${a.status}"><div><b>${a.time.slice(0,5)} — ${esc(a.client_name)}</b><small>${esc(nm)} · <a href="https://wa.me/55${a.phone.replace(/\D/g,'')}" target="_blank" rel="noopener">${esc(a.phone)}</a></small></div><div class="acts"><span class="tag ${a.status}">${ST[a.status]}</span>${acts}</div></li>`;
      }).join('')||'<li class="note" style="padding:1rem .5rem">Nenhum agendamento neste dia.</li>')+'</ul>';
    $('#ad').onchange=e=>{if(e.target.value){agDate=e.target.value;tab('agenda')}};
  },

  async servicos(){
    const s=await api('/rest/v1/services?order=name');
    $('#v').innerHTML=`<form id="sf" class="inl"><input id="sn" placeholder="Nome do serviço" required><input id="sp" type="number" step="0.01" min="0" placeholder="Preço (R$)" required><input id="sd" placeholder="Descrição (opcional)"><button class="btn">Adicionar</button></form><ul class="list">`+
      s.map(x=>`<li class="ap ${x.active?'':'cancelled'}"><div><b>${esc(x.name)}</b><small>${esc(x.description||'')}</small></div><div class="acts"><input class="pin" type="number" step="0.01" min="0" value="${x.price}" data-a="price" data-id="${x.id}" aria-label="Preço de ${esc(x.name)}"><button class="sm" data-a="tog" data-id="${x.id}" data-v="${!x.active}">${x.active?'Desativar':'Ativar'}</button></div></li>`).join('')+'</ul>';
    $('#sf').onsubmit=e=>{e.preventDefault();run(async()=>{
      await api('/rest/v1/services',{method:'POST',headers:MIN,body:JSON.stringify({name:$('#sn').value.trim(),price:+$('#sp').value,description:$('#sd').value.trim()||null})});
      await tab('servicos');say('Serviço adicionado.',true);
    })};
  },

  async financeiro(){
    const m=fnMonth||(fnMonth=iso(new Date()).slice(0,7));
    const[y,mo]=m.split('-').map(Number),to=iso(new Date(y,mo,1));
    const r=await api(`/rest/v1/financial_transactions?transaction_date=gte.${m}-01&transaction_date=lt.${to}&order=transaction_date.desc,created_at.desc`);
    const sum=t=>r.filter(x=>x.type===t).reduce((a,x)=>a+Number(x.amount),0),i=sum('income'),o=sum('expense');
    fnData={r,m,i,o};
    $('#v').innerHTML=`<div class="bar"><label class="lab" for="fm" style="margin:0">Mês</label><input type="month" id="fm" value="${m}"><button class="sm" data-a="fech">Fechamento do mês</button></div>
      <div class="sum"><div><small>Entradas</small><b class="inc">${money(i)}</b></div><div><small>Saídas</small><b class="exp">${money(o)}</b></div><div><small>Saldo</small><b>${money(i-o)}</b></div></div>
      <form id="ff" class="inl"><select id="ft" aria-label="Tipo"><option value="income">Entrada</option><option value="expense">Saída</option></select><input id="fc" placeholder="Categoria" required><input id="fd" placeholder="Descrição"><input id="fa" type="number" step="0.01" min="0.01" placeholder="Valor" required><input id="fdt" type="date" value="${iso(new Date())}" required><button class="btn">Lançar</button></form>
      <ul class="list">`+(r.map(x=>`<li class="ap"><div><b>${esc(x.category)}</b><small>${br(x.transaction_date)}${x.description?' — '+esc(x.description):''}</small></div><div class="acts"><span class="${x.type==='income'?'inc':'exp'}">${x.type==='income'?'+':'−'} ${money(x.amount)}</span><button class="sm no" data-a="del" data-id="${x.id}">Excluir</button></div></li>`).join('')||'<li class="note" style="padding:1rem .5rem">Sem lançamentos neste mês.</li>')+'</ul>';
    $('#fm').onchange=e=>{if(e.target.value){fnMonth=e.target.value;tab('financeiro')}};
    $('#ff').onsubmit=e=>{e.preventDefault();run(async()=>{
      await api('/rest/v1/financial_transactions',{method:'POST',headers:MIN,body:JSON.stringify({type:$('#ft').value,category:$('#fc').value.trim(),description:$('#fd').value.trim()||null,amount:+$('#fa').value,transaction_date:$('#fdt').value})});
      fnMonth=$('#fdt').value.slice(0,7);await tab('financeiro');say('Lançamento salvo.',true);
    })};
  },
  async pix(){
    const r=(await api('/rest/v1/business_settings?select=*'))[0]||{};
    $('#v').innerHTML=`<form id="pf" class="lf"><label class="lab" for="pk">Chave Pix</label><input id="pk" value="${esc(r.pix_key||'')}" placeholder="CPF, e-mail, telefone ou chave aleatória" required><label class="lab" for="pn">Nome do recebedor</label><input id="pn" value="${esc(r.pix_receiver_name||'')}" required><label class="lab" for="pc">Cidade</label><input id="pc" value="${esc(r.pix_city||'')}" required><button class="btn wide">Salvar chave Pix</button></form>`;
    $('#pf').onsubmit=e=>{e.preventDefault();run(async()=>{
      await api('/rest/v1/business_settings?id=eq.true',{method:'PATCH',headers:MIN,body:JSON.stringify({pix_key:$('#pk').value.trim(),pix_receiver_name:$('#pn').value.trim(),pix_city:$('#pc').value.trim(),updated_at:new Date().toISOString()})});
      say('Chave Pix salva.',true);
    })};
  },
  async assinaturas(){
    const r=await api('/rest/v1/package_subscriptions?select=*,membership_packages(name,price)&order=period_month.desc,created_at.desc');
    cache=Object.fromEntries(r.map(x=>[x.id,x]));
    $('#v').innerHTML='<ul class="list">'+(r.map(x=>{
      const mes=x.period_month.slice(5,7)+'/'+x.period_month.slice(0,4);
      const tag=x.status==='cancelled'?'<span class="tag cancelled">Cancelada</span>':x.paid?'<span class="tag paid">Pago</span>':'<span class="tag wait">Aguardando pagamento</span>';
      const pay=x.status==='active'&&!x.paid?`<button class="sm" data-a="pay" data-id="${x.id}">Confirmar pagamento</button>`:'';
      const del=`<button class="sm no" data-a="delsub" data-id="${x.id}">Excluir</button>`;
      return `<li class="ap ${x.status==='cancelled'?'cancelled':''}"><div><b>${esc(x.client_name)} — ${esc(x.membership_packages?.name||'')}</b><small>${mes} · <a href="https://wa.me/55${x.phone.replace(/\D/g,'')}" target="_blank" rel="noopener">${esc(x.phone)}</a>${x.cancel_requested?' · pediu cancelamento (vale no mês seguinte)':''}</small></div><div class="acts">${tag}${pay}${del}</div></li>`;
    }).join('')||'<li class="note" style="padding:1rem .5rem">Nenhuma assinatura ainda.</li>')+'</ul>';
  }
};

/* ---------- ações (botões e campos das listas) ---------- */
$('#v').addEventListener('click',e=>{
  const b=e.target.closest('[data-a]');if(!b||b.tagName!=='BUTTON')return;
  const id=b.dataset.id,a=b.dataset.a;
  if(a==='fech')return fechamento();
if(a==='fechback')return tab('financeiro');
if(a==='print')return window.print();
  if(a==='st')run(async()=>{
    const x=cache[id],s=b.dataset.s;
    await api('/rest/v1/appointments?id=eq.'+id,{method:'PATCH',headers:MIN,body:JSON.stringify({status:s})});
    if(s==='completed'&&x.services&&x.services.price>0)
      await api('/rest/v1/financial_transactions',{method:'POST',headers:MIN,body:JSON.stringify({type:'income',category:'Serviço',description:`${x.services.name} — ${x.client_name}`,amount:x.services.price,appointment_id:id,transaction_date:x.date})});
    await tab('agenda');say(s==='completed'?'Concluído e lançado no financeiro.':'Atualizado.',true);
  });
  if(a==='tog')run(async()=>{
    await api('/rest/v1/services?id=eq.'+id,{method:'PATCH',headers:MIN,body:JSON.stringify({active:b.dataset.v==='true'})});
    await tab('servicos');
  });
  if(a==='del'&&confirm('Excluir este lançamento?'))run(async()=>{
    await api('/rest/v1/financial_transactions?id=eq.'+id,{method:'DELETE',headers:MIN});
    await tab('financeiro');say('Lançamento excluído.',true);
  });
  if(a==='delap'&&confirm('Excluir este agendamento? Se ele já foi concluído, o valor lançado no financeiro também será removido.'))run(async()=>{
    await api('/rest/v1/financial_transactions?appointment_id=eq.'+id,{method:'DELETE',headers:MIN});
    await api('/rest/v1/appointments?id=eq.'+id,{method:'DELETE',headers:MIN});
    await tab('agenda');say('Agendamento excluído.',true);
  });
  if(a==='delsub'){
    const x=cache[id],p=x.membership_packages,mes=x.period_month.slice(5,7)+'/'+x.period_month.slice(0,4);
    if(confirm(x.paid?'Excluir esta assinatura? O pagamento lançado no financeiro também será removido.':'Excluir esta assinatura?'))run(async()=>{
      if(x.paid&&p)await api('/rest/v1/financial_transactions?type=eq.income&category=eq.Pacote&description=eq.'+encodeURIComponent(`${p.name} — ${x.client_name} (${mes})`),{method:'DELETE',headers:MIN});
      await api('/rest/v1/package_subscriptions?id=eq.'+id,{method:'DELETE',headers:MIN});
      await tab('assinaturas');say('Assinatura excluída.',true);
    });
  }
  if(a==='pay')run(async()=>{
    const x=cache[id],p=x.membership_packages,mes=x.period_month.slice(5,7)+'/'+x.period_month.slice(0,4);
    await api('/rest/v1/package_subscriptions?id=eq.'+id,{method:'PATCH',headers:MIN,body:JSON.stringify({paid:true})});
    if(p&&p.price>0)
      await api('/rest/v1/financial_transactions',{method:'POST',headers:MIN,body:JSON.stringify({type:'income',category:'Pacote',description:`${p.name} — ${x.client_name} (${mes})`,amount:p.price})});
    await tab('assinaturas');say('Pagamento confirmado e lançado no financeiro.',true);
  });
});
$('#v').addEventListener('change',e=>{
  const i=e.target;if(i.dataset.a!=='price')return;
  run(()=>api('/rest/v1/services?id=eq.'+i.dataset.id,{method:'PATCH',headers:MIN,body:JSON.stringify({price:+i.value})}),'Preço atualizado.');
});
/* ---------- fechamento do mês ---------- */
function fechamento(){
  const{r,m,i,o}=fnData,lucro=i-o,[y,mo]=m.split('-');
  const meses=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  const lista=t=>{
    const c={};r.filter(x=>x.type===t).forEach(x=>c[x.category]=(c[x.category]||0)+Number(x.amount));
    return Object.entries(c).sort((a,b)=>b[1]-a[1]).map(([n,v])=>`<li class="ap"><div><b>${esc(n)}</b></div><div class="acts">${money(v)}</div></li>`).join('')||'<li class="note" style="padding:1rem .5rem">Nada neste mês.</li>';
  };
  $('#v').innerHTML=`<div class="bar"><button class="sm" data-a="fechback">← Voltar</button><button class="sm" data-a="print">Imprimir / Salvar PDF</button></div>
    <h3>Fechamento de ${meses[mo-1]} de ${y}</h3>
    <div class="sum"><div><small>Faturamento</small><b class="inc">${money(i)}</b></div><div><small>Gastos</small><b class="exp">${money(o)}</b></div><div><small>Lucro</small><b class="${lucro<0?'exp':'inc'}">${money(lucro)}</b></div></div>
    <h4>Entradas por categoria</h4><ul class="list">${lista('income')}</ul>
    <h4>Saídas por categoria</h4><ul class="list">${lista('expense')}</ul>`;
}
/* ---------- aviso de novidades + atualização a cada 30 s ---------- */
const latest=async t=>(await api(`/rest/v1/${t}?select=created_at&order=created_at.desc&limit=1`))[0]?.created_at||'1970-01-01T00:00:00Z';
function watch(){
  clearInterval(poll);seen=null;
  Promise.all([latest('appointments'),latest('package_subscriptions')]).then(([a,s])=>{seen={a,s}}).catch(()=>{});
  poll=setInterval(tick,30000);
}
async function tick(){
  if(!T||!seen)return;
  try{
    const[a,s]=await Promise.all([
      api('/rest/v1/appointments?select=client_name,date,time,created_at&order=created_at&created_at=gt.'+encodeURIComponent(seen.a)),
      api('/rest/v1/package_subscriptions?select=client_name,created_at&order=created_at&created_at=gt.'+encodeURIComponent(seen.s))
    ]);
    if(a.length)seen.a=a[a.length-1].created_at;
    if(s.length)seen.s=s[s.length-1].created_at;
    if(a.length||s.length){pend.a.push(...a);pend.s.push(...s);showNew()}
    const busy=document.activeElement&&document.activeElement.id==='ad';
    if(cur==='agenda'&&!busy)await tabs.agenda();
    else if(cur==='assinaturas'&&s.length)await tabs.assinaturas();
  }catch{}
}
function showNew(){
  const n=pend.a.length,m=pend.s.length,t=[];
  if(n)t.push(n===1?`Novo agendamento: ${pend.a[0].client_name} — ${br(pend.a[0].date)} às ${pend.a[0].time.slice(0,5)}`:`${n} novos agendamentos`);
  if(m)t.push(m===1?`Nova assinatura: ${pend.s[0].client_name}`:`${m} novas assinaturas`);
  let b=$('#nb');
  if(!b){b=document.createElement('div');b.id='nb';b.className='nb';b.setAttribute('role','alert');$('#tabs').before(b)}
  b.innerHTML=`<span>${esc(t.join(' · '))}</span><button class="sm" data-go="${n?'agenda':'assinaturas'}">Ver</button><button class="sm" aria-label="Fechar aviso">×</button>`;
  b.hidden=false;document.title='(!) '+TITLE;beep();
}
function clearNew(){pend={a:[],s:[]};const b=$('#nb');if(b)b.hidden=true;document.title=TITLE}
function beep(){
  try{const c=new(window.AudioContext||window.webkitAudioContext)(),o=c.createOscillator(),g=c.createGain();
    o.connect(g);g.connect(c.destination);o.frequency.value=880;
    g.gain.setValueAtTime(.15,c.currentTime);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+.4);
    o.start();o.stop(c.currentTime+.4)}catch{}
}
document.addEventListener('click',e=>{
  const b=e.target.closest('#nb button');if(!b)return;
  const go=b.dataset.go;
  if(go==='agenda'&&pend.a.length)agDate=pend.a[pend.a.length-1].date;
  clearNew();
  if(go)tab(go);
});

if(T)start();
