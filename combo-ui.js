(() => {
  "use strict";

  const COMBOS = [
    ["pulse", "Импульс", "Мины", "40% шанс каждые 5 секунд установить мину на дороге", "Уничтожает всех врагов в радиусе мины"],
    ["rail", "Рельсотрон", "Пробой", "35% шанс пробить несколько самых опасных врагов", "Мощный пробивающий удар"],
    ["frost", "Криоузел", "Крио-волна", "45% шанс заморозить группу врагов", "Массовая заморозка"],
    ["blast", "Разлом", "Метеор", "35% шанс вызвать мощный взрыв на дороге", "Мощный метеоритный удар"],
    ["arc", "Дуга", "Цепная буря", "35% шанс поразить цепью до 6 врагов", "Цепная атака"],
    ["titan", "Титан", "Орбитальный удар", "30% шанс ударить по самой плотной группе", "Орбитальный удар"],
    ["nova", "Нова", "Сверхновая", "25% шанс нанести урон всем врагам на дороге", "Глобальный взрыв"],
    ["devastator", "Опустошитель", "Аннигиляция", "20% шанс сильно ослабить всех врагов", "Аннигиляционный удар"],
    ["singularity", "Нуль-коллайдер", "Сингулярность", "15% шанс создать чёрную дыру", "Чёрная дыра"]
  ];

  const CSS = `
    .combo-trigger{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-width:112px;height:44px;padding:0 12px;border:1px solid rgba(99,230,255,.34);border-radius:12px;background:linear-gradient(135deg,rgba(18,34,52,.94),rgba(10,18,30,.94));color:#dffcff;font:700 13px/1 system-ui,sans-serif;cursor:pointer;box-shadow:0 0 18px rgba(99,230,255,.08);transition:.18s ease;white-space:nowrap}
    .combo-trigger:hover{border-color:rgba(99,230,255,.7);box-shadow:0 0 22px rgba(99,230,255,.18);transform:translateY(-1px)}
    .combo-trigger .combo-trigger-icon{font-size:17px}
    .combo-modal{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(2,7,14,.72);backdrop-filter:blur(7px)}
    .combo-modal.hidden{display:none}
    .combo-card{width:min(760px,calc(100vw - 32px));max-height:min(82vh,720px);overflow:hidden;border:1px solid rgba(99,230,255,.34);border-radius:20px;background:linear-gradient(180deg,rgba(13,24,38,.98),rgba(6,13,23,.99));box-shadow:0 18px 70px rgba(0,0,0,.55),0 0 35px rgba(99,230,255,.12);color:#ecfbff}
    .combo-head{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px 20px;border-bottom:1px solid rgba(255,255,255,.08)}
    .combo-head h2{margin:0;font:800 20px/1.2 system-ui,sans-serif}
    .combo-head p{margin:5px 0 0;color:#86a9b7;font:500 12px/1.4 system-ui,sans-serif}
    .combo-close{width:36px;height:36px;border:1px solid rgba(255,255,255,.12);border-radius:10px;background:rgba(255,255,255,.05);color:#fff;font-size:20px;cursor:pointer}
    .combo-list{padding:14px 16px 18px;display:grid;gap:10px;overflow:auto;max-height:calc(min(82vh,720px) - 82px)}
    .combo-row{display:grid;grid-template-columns:minmax(250px,1fr) minmax(180px,.7fr);gap:12px;align-items:center;padding:12px;border:1px solid rgba(255,255,255,.07);border-radius:14px;background:rgba(255,255,255,.025)}
    .combo-flow{display:flex;align-items:center;gap:7px;min-width:0}
    .combo-icons{display:flex;align-items:center;gap:3px}
    .combo-icons .tower-icon{width:38px;height:38px;flex:none}
    .combo-plus{color:#6d8794;font-weight:800}
    .combo-arrow{margin:0 3px;color:#63e6ff;font-size:20px;font-weight:900}
    .combo-result{display:flex;align-items:center;gap:9px;min-width:0}
    .combo-result-badge{width:42px;height:42px;display:grid;place-items:center;flex:none;border:1px solid rgba(99,230,255,.32);border-radius:12px;background:radial-gradient(circle,rgba(99,230,255,.18),rgba(99,230,255,.025));font-size:19px;box-shadow:inset 0 0 15px rgba(99,230,255,.06)}
    .combo-result strong{display:block;font:800 14px/1.2 system-ui,sans-serif}
    .combo-result small{display:block;margin-top:3px;color:#83a2ae;font:500 11px/1.35 system-ui,sans-serif}
    .combo-desc{color:#a9c0c9;font:500 11px/1.45 system-ui,sans-serif;text-align:right}
    @media (max-width:650px){.combo-trigger{min-width:92px;padding:0 9px}.combo-row{grid-template-columns:1fr}.combo-desc{text-align:left}.combo-card{max-height:88vh}.combo-list{max-height:calc(88vh - 82px)}}
  `;

  function addStyles(){
    if(document.getElementById('combo-ui-styles')) return;
    const style=document.createElement('style'); style.id='combo-ui-styles'; style.textContent=CSS; document.head.appendChild(style);
  }

  function cloneTowerIcon(type){
    const source=document.querySelector(`.tower-card[data-tower="${type}"] .tower-icon`);
    if(!source) return null;
    const icon=source.cloneNode(true);
    icon.removeAttribute('hidden');
    icon.setAttribute('aria-hidden','true');
    return icon;
  }

  function buildModal(){
    if(document.getElementById('comboModal')) return;
    const modal=document.createElement('div'); modal.id='comboModal'; modal.className='combo-modal hidden'; modal.setAttribute('role','dialog'); modal.setAttribute('aria-modal','true');
    const card=document.createElement('div'); card.className='combo-card';
    const head=document.createElement('div'); head.className='combo-head';
    head.innerHTML='<div><h2>Комбинации башен</h2><p>Три одинаковые башни 8 уровня рядом запускают особую комбинацию.</p></div><button class="combo-close" type="button" aria-label="Закрыть">×</button>';
    const list=document.createElement('div'); list.className='combo-list';
    for(const [type,name,result,description,effect] of COMBOS){
      const row=document.createElement('div'); row.className='combo-row';
      const flow=document.createElement('div'); flow.className='combo-flow';
      const icons=document.createElement('div'); icons.className='combo-icons';
      for(let i=0;i<3;i++){ const icon=cloneTowerIcon(type); if(icon){ if(i) { const plus=document.createElement('span'); plus.className='combo-plus'; plus.textContent='+'; icons.appendChild(plus); } icons.appendChild(icon); } }
      const arrow=document.createElement('span'); arrow.className='combo-arrow'; arrow.textContent='→';
      const resultBox=document.createElement('div'); resultBox.className='combo-result';
      const badge=document.createElement('span'); badge.className='combo-result-badge'; badge.textContent= type==='pulse'?'✹':type==='rail'?'╳':type==='frost'?'❄':type==='blast'?'✦':type==='arc'?'ϟ':type==='titan'?'◉':type==='nova'?'✺':type==='devastator'?'✹':'◉';
      const labels=document.createElement('div'); labels.innerHTML=`<strong>${result}</strong><small>${effect}</small>`;
      resultBox.append(badge,labels); flow.append(icons,arrow,resultBox);
      const desc=document.createElement('div'); desc.className='combo-desc'; desc.textContent=description;
      row.append(flow,desc); list.appendChild(row);
    }
    card.append(head,list); modal.appendChild(card); document.body.appendChild(modal);
    const close=()=>modal.classList.add('hidden'); head.querySelector('.combo-close').addEventListener('click',close); modal.addEventListener('click',e=>{if(e.target===modal) close();}); document.addEventListener('keydown',e=>{if(e.key==='Escape') close();});
  }

  function addButton(){
    const strip=document.querySelector('.status-strip'); const cash=document.querySelector('.cash-status');
    if(!strip||!cash||document.getElementById('comboTrigger')) return false;
    const btn=document.createElement('button'); btn.id='comboTrigger'; btn.className='combo-trigger'; btn.type='button'; btn.innerHTML='<span class="combo-trigger-icon">✦</span><span>Комбинации</span>'; btn.title='Показать все комбинации башен';
    btn.addEventListener('click',()=>{buildModal(); document.getElementById('comboModal').classList.remove('hidden');}); strip.insertBefore(btn,cash); return true;
  }

  function patchMineFetch(){
    if(window.__neonComboMinePatch) return;
    const nativeFetch=window.fetch;
    window.fetch=function(...args){
      return nativeFetch.apply(this,args).then(response=>{
        try{
          const url=typeof args[0]==='string'?args[0]:args[0]?.url||'';
          if(url.includes('game-core.js')){
            return response.clone().text().then(source=>{
              const patched=source.replace(/\.sort\(\(a, b\) => b\.distance - a\.distance\)\.slice\(0, 5\)/g,'.sort((a, b) => b.distance - a.distance)');
              if(patched!==source) return new Response(patched,{status:response.status,statusText:response.statusText,headers:response.headers});
              return response;
            });
          }
        }catch(e){}
        return response;
      });
    };
    window.__neonComboMinePatch=true;
  }

  function init(){
    addStyles(); patchMineFetch();
    let attempts=0;
    const timer=setInterval(()=>{ attempts++; if(addButton()||attempts>120) clearInterval(timer); },100);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
})();
