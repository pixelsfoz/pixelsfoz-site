(()=>{
  const root=document.getElementById('pixels-ps4');
  if(!root)return;
  root.classList.add('px-ready');
  const menu=root.querySelector('.px-menu');
  const links=root.querySelector('.px-links');
  const setMenu=open=>{menu.setAttribute('aria-expanded',String(open));links.classList.toggle('px-open',open)};
  menu.addEventListener('click',()=>setMenu(menu.getAttribute('aria-expanded')!=='true'));
  root.addEventListener('keydown',event=>{if(event.key==='Escape'&&menu.getAttribute('aria-expanded')==='true'){setMenu(false);menu.focus()}});
  document.addEventListener('click',event=>{if(!root.querySelector('.px-nav').contains(event.target))setMenu(false)});
  const embedded=new URLSearchParams(location.search).get('embed')==='1';
  if(embedded)root.dataset.embedded='true';
  if(embedded&&window.parent!==window&&location.origin!=='null'){
    let previous=0,frame=0;
    const report=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{const height=Math.ceil(root.getBoundingClientRect().height);if(height!==previous){previous=height;window.parent.postMessage({type:'pixels-ps4-height',height},location.origin)}})};
    if('ResizeObserver'in window)new ResizeObserver(report).observe(root);
    window.addEventListener('load',report);window.addEventListener('resize',report);report();
  }
})();
