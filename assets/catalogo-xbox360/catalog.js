(()=>{
  'use strict';
  const root=document.getElementById('pixels-xbox360');if(!root)return;
  const menu=root.querySelector('.px-menu'),links=root.querySelector('.px-links');
  const setMenu=open=>{menu.setAttribute('aria-expanded',String(open));links.classList.toggle('px-open',open)};
  root.classList.add('px-ready');menu.addEventListener('click',()=>setMenu(menu.getAttribute('aria-expanded')!=='true'));
  root.addEventListener('keydown',event=>{if(event.key==='Escape'&&menu.getAttribute('aria-expanded')==='true'){setMenu(false);menu.focus()}});
  document.addEventListener('click',event=>{if(!root.querySelector('.px-nav').contains(event.target))setMenu(false)});
  const norm=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
  const cards=[...root.querySelectorAll('.px-game')].map(node=>({node,title:norm(node.querySelector('h3').textContent),search:norm(node.textContent)}));
  const input=root.querySelector('#px-search'),count=root.querySelector('#px-count'),letters=root.querySelector('.px-letters');
  const previous=root.querySelector('#px-prev'),next=root.querySelector('#px-next'),pageLabel=root.querySelector('#px-page');
  const state={page:1,letter:'TODOS',query:''},perPage=30;
  root.querySelector('.px-toolbar').hidden=false;root.querySelector('.px-pagination').hidden=false;
  const alphabet=['TODOS','#',...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];
  for(const letter of alphabet){const button=document.createElement('button');button.type='button';button.textContent=letter;button.dataset.letter=letter;button.setAttribute('aria-pressed',String(letter==='TODOS'));letters.append(button)}
  function render(){
    const found=cards.filter(card=>(!state.query||card.search.includes(state.query))&&(state.letter==='TODOS'||(state.letter==='#'?/^[^A-Z]/.test(card.title):card.title.startsWith(state.letter))));
    const pages=Math.max(1,Math.ceil(found.length/perPage));state.page=Math.min(state.page,pages);
    const visible=new Set(found.slice((state.page-1)*perPage,state.page*perPage));
    for(const card of cards)card.node.hidden=!visible.has(card);
    count.textContent=`${found.length} de ${cards.length} títulos`;
    pageLabel.textContent=found.length?`${state.page} / ${pages}`:'0 / 0';
    previous.disabled=state.page===1;next.disabled=state.page===pages;
    root.querySelector('.px-empty').hidden=found.length>0;
    for(const button of letters.children)button.setAttribute('aria-pressed',String(button.dataset.letter===state.letter));
  }
  input.addEventListener('input',()=>{state.query=norm(input.value.trim());state.page=1;render()});
  letters.addEventListener('click',event=>{const button=event.target.closest('button');if(!button)return;state.letter=button.dataset.letter;state.page=1;render()});
  function changePage(delta){state.page+=delta;render();root.querySelector('.px-toolbar').scrollIntoView({block:'start',behavior:'instant'});input.focus({preventScroll:true})}
  previous.addEventListener('click',()=>changePage(-1));next.addEventListener('click',()=>changePage(1));render();
})();
