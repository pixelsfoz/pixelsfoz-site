(() => {
  'use strict';
  const data = JSON.parse(document.getElementById('catalog-data').textContent);
  const normalize = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const byId = new Map(data.map(p => [p.id, p]));
  const cards = [...document.querySelectorAll('.product')];
  const search = document.getElementById('search');
  const filterButtons = [...document.querySelectorAll('[data-filter]')];
  let category = 'Todos', limit = 12;
  function render() {
    const query = normalize(search.value.trim());
    const matches = data.filter(p => (category === 'Todos' || p.category === category) && normalize([p.name,p.id,p.category,p.keywords].join(' ')).includes(query));
    const visible = new Set(matches.slice(0, limit).map(p => p.id));
    cards.forEach(card => card.hidden = !visible.has(card.dataset.product));
    filterButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filter === category)));
    document.getElementById('result-count').textContent = `${matches.length} ${matches.length === 1 ? 'item' : 'itens'}`;
    document.querySelector('.empty-state').hidden = !!matches.length;
    document.querySelector('.more-row').hidden = matches.length === 0;
    document.getElementById('show-more').hidden = limit >= matches.length;
    document.getElementById('page-count').textContent = `${Math.min(limit,matches.length)} de ${matches.length} ${matches.length === 1 ? 'item' : 'itens'}`;
  }
  document.querySelector('.catalog-tools').hidden = false;
  search.addEventListener('input', () => { limit = 12; render(); });
  filterButtons.forEach(b => b.addEventListener('click', () => { category = b.dataset.filter; limit = 12; render(); }));
  document.getElementById('clear-filters').addEventListener('click', () => { category = 'Todos'; search.value = ''; limit = 12; render(); search.focus(); });
  document.getElementById('show-more').addEventListener('click', () => {
    const previous = new Set(cards.filter(c => !c.hidden)); limit += 12; render();
    const next = cards.find(c => !c.hidden && !previous.has(c));
    if(next) next.querySelector('a').focus({preventScroll:true});
  });
  const menu = document.querySelector('.menu-toggle'), nav = document.getElementById('navigation');
  const closeMenu = () => { nav.classList.remove('open'); menu.setAttribute('aria-expanded','false'); menu.setAttribute('aria-label','Abrir menu'); };
  menu.addEventListener('click', () => { const open = nav.classList.toggle('open'); menu.setAttribute('aria-expanded',String(open)); menu.setAttribute('aria-label',open?'Fechar menu':'Abrir menu'); });
  nav.addEventListener('click', e => { if(e.target.closest('a')) closeMenu(); });
  document.addEventListener('keydown', e => {if(e.key==='Escape')closeMenu();});
  const dialog = document.getElementById('product-dialog');
  let active = null, photoIndex = 0, opener = null;
  const path = 'assets/catalogo-3d/';
  function updatePhoto() {
    const img = document.getElementById('detail-photo');
    img.src = path + active.photos[photoIndex]; img.alt = `${active.name} — foto ${photoIndex+1} de ${active.photos.length}`;
    document.getElementById('photo-count').textContent = `${photoIndex+1} / ${active.photos.length}`;
    document.getElementById('detail-original').href = img.src;
    document.getElementById('photo-prev').disabled = active.photos.length < 2;
    document.getElementById('photo-next').disabled = active.photos.length < 2;
    [...document.querySelectorAll('#thumbnails button')].forEach((b,i) => b.setAttribute('aria-pressed',String(i===photoIndex)));
  }
  function openProduct(id, target) {
    active = byId.get(id); if(!active) return;
    opener = target; photoIndex = 0;
    document.getElementById('detail-category').textContent = active.category;
    document.getElementById('detail-title').textContent = active.name;
    document.getElementById('detail-code').textContent = active.id;
    document.getElementById('detail-description').textContent = active.description;
    const measure = document.getElementById('detail-measure'); measure.replaceChildren();
    if(active.measure) { const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent='Altura';dd.textContent='1,70 m · 170 cm';measure.append(dt,dd); }
    document.getElementById('detail-whatsapp').href = 'https://wa.me/5545991364519?text=' + encodeURIComponent(`Olá, Pixels! Gostaria de consultar valores e detalhes de ${active.name} (${active.id}).`);
    const thumbs = document.getElementById('thumbnails'); thumbs.replaceChildren();
    active.photos.forEach((photo,i) => { const button=document.createElement('button'); button.type='button';button.setAttribute('aria-label',`Ver foto ${i+1}`);const image=document.createElement('img');image.src=path+photo;image.alt='';button.append(image);button.addEventListener('click',()=>{photoIndex=i;updatePhoto();});thumbs.append(button); });
    thumbs.hidden = active.photos.length < 2; updatePhoto();
    dialog.showModal(); dialog.scrollTop = 0; document.body.style.overflow = 'hidden';
    document.querySelector('.dialog-close').focus({preventScroll:true});
  }
  document.addEventListener('click', e => {const trigger=e.target.closest('[data-open]');if(trigger){e.preventDefault();openProduct(trigger.dataset.open,trigger);}});
  document.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', e => {if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
  dialog.addEventListener('close', () => { document.body.style.overflow='';opener?.focus({preventScroll:true}); });
  const changePhoto = delta => { if(active){photoIndex=(photoIndex+delta+active.photos.length)%active.photos.length;updatePhoto();} };
  document.getElementById('photo-prev').addEventListener('click',()=>changePhoto(-1));
  document.getElementById('photo-next').addEventListener('click',()=>changePhoto(1));
  dialog.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'){e.preventDefault();changePhoto(-1);}if(e.key==='ArrowRight'){e.preventDefault();changePhoto(1);}});
  document.querySelectorAll('video').forEach(v=>v.addEventListener('play',()=>document.querySelectorAll('video').forEach(other=>{if(other!==v)other.pause();})));
  render();
})();
