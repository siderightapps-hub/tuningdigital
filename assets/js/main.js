/* assets/js/main.js — shared JS for tuningdigital.com */

// ─── Mobile Nav ───────────────────────────────────────────
(function(){
  const toggle = document.getElementById('mobileToggle');
  const nav    = document.getElementById('mobileNav');
  if(!toggle || !nav) return;
  toggle.addEventListener('click', function(){
    nav.classList.toggle('open');
    const spans = toggle.querySelectorAll('span');
    if(nav.classList.contains('open')){
      spans[0].style.transform = 'rotate(45deg) translate(5px,5px)';
      spans[1].style.opacity   = '0';
      spans[2].style.transform = 'rotate(-45deg) translate(5px,-5px)';
    } else {
      spans[0].style.transform = '';
      spans[1].style.opacity   = '';
      spans[2].style.transform = '';
    }
  });
  document.addEventListener('click', function(e){
    if(!toggle.contains(e.target) && !nav.contains(e.target)){
      nav.classList.remove('open');
    }
  });
})();

// ─── Tool Grid Filter ─────────────────────────────────────
(function(){
  const pills = document.getElementById('filterPills');
  const grid  = document.getElementById('toolsGrid');
  if(!pills || !grid) return;
  pills.querySelectorAll('.pill').forEach(function(btn){
    btn.addEventListener('click', function(){
      pills.querySelectorAll('.pill').forEach(function(b){ b.classList.remove('active'); });
      btn.classList.add('active');
      var f = btn.dataset.filter;
      grid.querySelectorAll('[data-category]').forEach(function(card){
        if(f === 'all' || card.dataset.category === f){
          card.style.display = '';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });
})();

// ─── Newsletter Form ──────────────────────────────────────
(function(){
  var form = document.getElementById('newsletterForm');
  if(!form) return;
  form.addEventListener('submit', function(e){
    var btn = form.querySelector('button[type=submit]');
    if(btn) btn.textContent = 'Subscribing...';
    // Analytics event
    if(typeof gtag !== 'undefined'){
      gtag('event', 'newsletter_subscribe', { event_category: 'engagement' });
    }
    // Form will submit naturally to action URL
  });
})();

// ─── Scroll-triggered animations ─────────────────────────
(function(){
  if(!window.IntersectionObserver) return;
  var observer = new IntersectionObserver(function(entries){
    entries.forEach(function(entry){
      if(entry.isIntersecting){
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.tool-card, .blog-card, .card').forEach(function(el){
    el.style.opacity = '0';
    el.style.transform = 'translateY(16px)';
    el.style.transition = 'opacity .4s ease, transform .4s ease';
    observer.observe(el);
  });
})();

// ─── Reading Progress Bar (articles only) ────────────────
(function(){
  if(!document.querySelector('.article-body')) return;
  var bar = document.createElement('div');
  bar.style.cssText = 'position:fixed;top:64px;left:0;height:2px;background:var(--accent);z-index:200;width:0;transition:width .1s;box-shadow:0 0 8px var(--accent);';
  document.body.appendChild(bar);
  window.addEventListener('scroll', function(){
    var article = document.querySelector('.article-body');
    if(!article) return;
    var rect = article.getBoundingClientRect();
    var total = article.offsetHeight + rect.top - window.innerHeight + window.scrollY;
    var pct = Math.min(100, Math.max(0, (window.scrollY - (rect.top + window.scrollY - window.innerHeight)) / article.offsetHeight * 100));
    bar.style.width = pct + '%';
  });
})();

// ─── External link tracking ───────────────────────────────
(function(){
  document.querySelectorAll('a[target="_blank"]').forEach(function(a){
    a.addEventListener('click', function(){
      if(typeof gtag !== 'undefined'){
        gtag('event', 'outbound_click', {
          event_category: 'outbound',
          event_label: a.href
        });
      }
    });
  });
})();

// ─── Active nav link highlight ────────────────────────────
(function(){
  var path = window.location.pathname;
  document.querySelectorAll('.nav-links a').forEach(function(a){
    if(a.getAttribute('href') !== '/' && path.startsWith(a.getAttribute('href'))){
      a.classList.add('active');
    }
  });
})();

// ─── Lazy load ad slots ───────────────────────────────────
(function(){
  if(!window.IntersectionObserver) return;
  var adObserver = new IntersectionObserver(function(entries){
    entries.forEach(function(entry){
      if(entry.isIntersecting){
        var ins = entry.target.querySelector('ins.adsbygoogle');
        if(ins && !ins.getAttribute('data-ad-status')){
          try{(window.adsbygoogle = window.adsbygoogle || []).push({});}catch(e){}
        }
        adObserver.unobserve(entry.target);
      }
    });
  }, { rootMargin: '200px' });
  document.querySelectorAll('.ad-slot').forEach(function(slot){
    adObserver.observe(slot);
  });
})();

// ─── Smooth scroll for anchor links ──────────────────────
(function(){
  document.querySelectorAll('a[href^="#"]').forEach(function(a){
    a.addEventListener('click', function(e){
      var id = a.getAttribute('href').slice(1);
      var target = document.getElementById(id);
      if(target){
        e.preventDefault();
        var offset = 80;
        var y = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    });
  });
})();
