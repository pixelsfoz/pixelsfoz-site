(()=>{
  'use strict';
  const button=document.querySelector('header [data-pixels-toggle]');
  const links=document.querySelector('header [data-pixels-nav]');
  if(!button||!links)return;
  const header=button.closest('header');
  const mobile=matchMedia('(max-width:1180px)');
  const setOpen=open=>{
    links.classList.remove('open','mobile-open','px-open');
    button.setAttribute('aria-expanded',String(open));
    button.setAttribute('aria-label',open?'Fechar menu':'Abrir menu');
  };
  header.classList.add('pixels-nav-ready');
  setOpen(false);
  // Capture once, before legacy page-specific menu listeners.
  document.addEventListener('click',event=>{
    if(event.target.closest('[data-pixels-toggle]')!==button)return;
    event.preventDefault();event.stopImmediatePropagation();
    setOpen(button.getAttribute('aria-expanded')!=='true');
  },true);
  links.addEventListener('click',event=>{if(event.target.closest('a'))setOpen(false)});
  document.addEventListener('click',event=>{if(!header.contains(event.target))setOpen(false)});
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&button.getAttribute('aria-expanded')==='true'){
      setOpen(false);button.focus();
    }
  });
  header.addEventListener('focusout',event=>{if(!header.contains(event.relatedTarget))setOpen(false)});
  mobile.addEventListener('change',()=>setOpen(false));
  const measure=()=>document.documentElement.style.setProperty('--pixels-header-height',Math.ceil(header.getBoundingClientRect().height)+'px');
  if('ResizeObserver' in window)new ResizeObserver(measure).observe(header);
  measure();
})();
