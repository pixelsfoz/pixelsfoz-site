(()=>{
  'use strict';
  const button=document.querySelector('header [data-pixels-toggle]');
  const links=document.querySelector('header [data-pixels-nav]');
  if(!button||!links)return;
  const header=button.closest('header');
  header.classList.add('pixels-nav-ready');
  const close=()=>{links.classList.remove('open','mobile-open','px-open');button.setAttribute('aria-expanded','false');button.setAttribute('aria-label','Abrir menu')};
  const label=()=>button.setAttribute('aria-label',button.getAttribute('aria-expanded')==='true'?'Fechar menu':'Abrir menu');
  new MutationObserver(label).observe(button,{attributes:true,attributeFilter:['aria-expanded']});
  label();
  document.addEventListener("click",event=>{if(event.target.closest("[data-pixels-toggle]")!==button)return;event.preventDefault();event.stopImmediatePropagation();const open=button.getAttribute("aria-expanded")!=="true";close();button.setAttribute("aria-expanded",String(open));},true);
  links.addEventListener('click',event=>{if(event.target.closest('a'))close()});
  document.addEventListener('click',event=>{if(!header.contains(event.target))close()});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&button.getAttribute('aria-expanded')==='true'){close();button.focus()}});
  header.addEventListener('focusout',event=>{if(!header.contains(event.relatedTarget))close()});
  matchMedia('(max-width:1180px)').addEventListener('change',close);
})();
