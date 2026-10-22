const $ = id => document.getElementById(id);
const number = n => new Intl.NumberFormat('en-US', {maximumFractionDigits:2}).format(n);
const usd = n => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
const disclaimer = 'Unofficial community simulation. For fun only. Assumptions are editable; rewards and token prices are not guaranteed.';
let current, theme = 'forest';
const palettes = {forest:['#1A6B4A','#ffffff','#bcebd1'],mint:['#d9f5e7','#0a3625','#275d46'],midnight:['#06271e','#ffffff','#9cdeb9']};
export function renderAirdropCard(state, result, link) {
  current = {state:structuredClone(state),result:structuredClone(result)};
  const valid = result.valid;
  $('card-download').disabled = !valid; $('card-flip').disabled = !valid;
  $('card-x').setAttribute('aria-disabled',String(!valid));
  if(!valid) { $('card-tokens').textContent='—'; $('card-usd').textContent='Check assumptions'; $('card-x').removeAttribute('href'); $('card-feedback').textContent='Correct the calculator inputs to create a valid card.'; $('hero-estimate').textContent='—'; $('card-back').hidden=true; $('card-front').hidden=false; $('card-flip').setAttribute('aria-pressed','false'); $('card-flip').textContent='View card assumptions ↻'; return; }
  $('card-feedback').textContent='Card updated with your current calculation.';
  const main=result.selected.find(r=>r.kind==='main');
  $('card-role').textContent=main.name; $('hero-role').textContent=main.name;
  $('hero-estimate').textContent=number(result.tokens);
  $('card-tokens').textContent=number(result.tokens); $('card-usd').textContent=usd(result.usd); $('card-price').textContent=`at $${number(state.price)} / token`;
  $('card-extras').replaceChildren(...result.selected.filter(r=>r.kind==='extra').map(r=>{const el=document.createElement('span');el.textContent=r.name;return el;}));
  $('card-assumptions').replaceChildren();
  for(const [key,value] of [['Total pool',`${number(state.pool)} tokens`],['Modelled share',`${state.share}%`],['Assumed price',`$${number(state.price)}`],['Your roles',result.selected.map(r=>r.name).join(' + ')]]) {const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=key;dd.textContent=value;$('card-assumptions').append(dt,dd);}
  const intent=new URL('https://twitter.com/intent/tweet');
  intent.searchParams.set('text',`My Ritual airdrop what-if ✦\n${main.name}${state.extras.length ? ` + ${state.extras.length} extra roles` : ''}\n${number(result.tokens)} hypothetical RITUAL · ${usd(result.usd)}\nUnofficial community simulation. For fun only; rewards and prices are not guaranteed.\ngRitual 💚`);
  intent.searchParams.set('url',link()); $('card-x').href=intent.href;
  document.querySelectorAll('[data-hero-role]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.heroRole===state.main));b.disabled=state.roles[b.dataset.heroRole].count===0;});
}
document.querySelectorAll('[data-card-theme]').forEach(b=>b.addEventListener('click',()=>{theme=b.dataset.cardTheme;$('airdrop-card').dataset.theme=theme;document.querySelectorAll('[data-card-theme]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));}));
document.querySelectorAll('[data-hero-role]').forEach(b=>b.addEventListener('click',()=>{const input=document.querySelector(`input[name="main-role"][value="${b.dataset.heroRole}"]`);if(input&&!input.disabled){input.checked=true;input.dispatchEvent(new Event('change',{bubbles:true}));}}));
$('card-flip').addEventListener('click',()=>{const back=$('card-back').hidden;$('card-back').hidden=!back;$('card-front').hidden=back;$('card-flip').setAttribute('aria-pressed',String(back));$('card-flip').textContent=back?'Show my airdrop ↻':'View card assumptions ↻';});
$('card-x').addEventListener('click',e=>{if(!current?.result.valid)e.preventDefault();});
const card=$('airdrop-card');
card.addEventListener('pointermove',e=>{if(e.pointerType!=='mouse'||matchMedia('(prefers-reduced-motion: reduce)').matches)return;const r=card.getBoundingClientRect();card.style.setProperty('--tilt-x',`${-(e.clientY-r.top-r.height/2)/70}deg`);card.style.setProperty('--tilt-y',`${(e.clientX-r.left-r.width/2)/70}deg`);});
card.addEventListener('pointerleave',()=>{card.style.setProperty('--tilt-x','0deg');card.style.setProperty('--tilt-y','0deg');});
$('card-download').addEventListener('click',async()=>{
 if(!current?.result.valid)return;
 const {state,result}=structuredClone(current), colors=palettes[theme];
 $('card-download').disabled=true;
 try {
  const logo=new Image();logo.src='assets/ritual-logo.jpg';await logo.decode();
  const c=document.createElement('canvas');c.width=1200;c.height=1320;const ctx=c.getContext('2d');if(!ctx)throw Error();
  ctx.fillStyle=colors[0];ctx.fillRect(0,0,c.width,c.height);ctx.strokeStyle=colors[2]+'26';
  for(let x=0;x<1200;x+=60){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,1320);ctx.stroke();}
  ctx.drawImage(logo,70,65,110,110);ctx.fillStyle=colors[1];ctx.font='bold 58px Arial';ctx.fillText('ritual',205,123);ctx.font='18px Arial';ctx.fillText('AIRDROP PLAYGROUND · COMMUNITY EDITION',205,162);
  function fit(text,x,y,size,width){while(size>14){ctx.font=`bold ${size}px Arial`;if(ctx.measureText(text).width<=width)break;size-=2;}ctx.fillText(text,x,y);}
  ctx.fillStyle=colors[2];ctx.font='20px Arial';ctx.fillText('MY RITUAL AIRDROP SCENARIO',70,265);
  ctx.fillStyle=colors[1];fit(result.selected.find(r=>r.kind==='main').name,70,340,62,1060);fit(number(result.tokens),65,485,112,1060);
  ctx.font='22px Arial';ctx.fillText('RITUAL · HYPOTHETICAL TOKENS',70,532);fit(usd(result.usd),70,625,60,1060);
  ctx.fillStyle=colors[2];ctx.font='24px Arial';ctx.fillText(`at an assumed $${number(state.price)} / token`,70,670);
  ctx.font='22px Arial';let y=746;for(const r of result.selected){ctx.fillText(`${r.name}  ·  ${number(r.perHolder)} RITUAL`,70,y);y+=35;}
  ctx.font='20px Arial';ctx.fillText(`Pool: ${number(state.pool)} tokens · Modelled share: ${state.share}%`,70,1050);ctx.fillText('Exponential weights · Additional roles stack independently',70,1085);
  ctx.fillStyle=colors[1];ctx.font='bold 38px Georgia';ctx.fillText('gRitual',70,1160);
  ctx.font='22px Arial';let line='',dy=1220;for(const word of disclaimer.split(' ')){const next=line+word+' ';if(ctx.measureText(next).width>1060){ctx.fillText(line,70,dy);dy+=30;line=word+' ';}else line=next;}ctx.fillText(line,70,dy);
  const blob=await new Promise(resolve=>c.toBlob(resolve,'image/png'));if(!blob)throw Error();const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='my-ritual-airdrop-card.png';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),15000);$('card-feedback').textContent='PNG downloaded. Attach it to your X draft to share your card.';
 }catch{$('card-feedback').textContent='The image could not download. Please retry, or use Copy my result.';}finally{$('card-download').disabled=!current?.result.valid;}
});
