/* assets/js/main.js — shared JS for tuningdigital.com */

// ─── Dial mark (brand) + score gauge renderers ────────────
// Both render after DOM is parsed. The dial is the tuning-dial brand mark
// (circle + needle + four tick marks) injected into every `<span class="dial-slot">`.
// The gauge is the same primitive repurposed as a 0-10 score readout for review
// cards / leaderboards (`<div class="gauge" data-score="8.7" data-size="52">`).
(function(){
  function dialSVG(size, tone){
    var line = tone === 'paper' ? '#ffffff' : 'currentColor';
    var accent = 'var(--accent, #6ec5d6)';
    var cx = 24, cy = 24, ang = -45 * Math.PI / 180;
    var ux = Math.cos(ang), uy = Math.sin(ang);
    var tipX = cx + 13 * ux, tipY = cy + 13 * uy;
    var tailX = cx - 5 * ux, tailY = cy - 5 * uy;
    var ticks = '';
    [0,90,180,270].forEach(function(a){
      var rad = (a - 90) * Math.PI / 180;
      var r1 = 20.5, r2 = 23;
      ticks += '<line x1="' + (cx + r1 * Math.cos(rad)) + '" y1="' + (cy + r1 * Math.sin(rad))
            + '" x2="' + (cx + r2 * Math.cos(rad)) + '" y2="' + (cy + r2 * Math.sin(rad))
            + '" stroke="' + line + '" stroke-width="2" opacity="0.4" stroke-linecap="round"/>';
    });
    return '<svg class="dial" width="' + size + '" height="' + size + '" viewBox="0 0 48 48" fill="none" aria-hidden="true">'
         + '<circle cx="' + cx + '" cy="' + cy + '" r="17" stroke="' + line + '" stroke-width="2.8" opacity="0.92"/>'
         + ticks
         + '<line x1="' + tailX + '" y1="' + tailY + '" x2="' + tipX + '" y2="' + tipY + '" stroke="' + accent + '" stroke-width="3.4" stroke-linecap="round"/>'
         + '<circle cx="' + cx + '" cy="' + cy + '" r="3" fill="' + line + '"/>'
         + '</svg>';
  }
  function renderDials(){
    document.querySelectorAll('.dial-slot').forEach(function(el){
      var size = parseInt(el.dataset.dial || '22', 10);
      var tone = el.dataset.tone || 'ink';
      el.innerHTML = dialSVG(size, tone);
    });
  }
  function drawGauge(el){
    var score = parseFloat(el.dataset.score);
    if (isNaN(score)) return;
    // Scale defaults to /10 (matches the new design's leaderboard convention);
    // tool reviews using TOOL_BANK use data-max="5".
    var max = parseFloat(el.dataset.max || '10');
    var S = parseInt(el.dataset.size || '52', 10);
    var r = S / 2 - 5;
    var c = 2 * Math.PI * r;
    var frac = Math.max(0, Math.min(1, score / max));
    var cx = S / 2, cy = S / 2;
    var endAng = -90 + frac * 360;
    var er = endAng * Math.PI / 180;
    var dotX = cx + r * Math.cos(er), dotY = cy + r * Math.sin(er);
    var ticks = '';
    [0,90,180,270].forEach(function(a){
      var rad = (a - 90) * Math.PI / 180, r1 = S / 2 - 2.5, r2 = S / 2;
      ticks += '<line x1="' + (cx + r1 * Math.cos(rad)) + '" y1="' + (cy + r1 * Math.sin(rad))
            + '" x2="' + (cx + r2 * Math.cos(rad)) + '" y2="' + (cy + r2 * Math.sin(rad))
            + '" stroke="var(--line-2)" stroke-width="1.4" stroke-linecap="round"/>';
    });
    var num = (Math.round(score * 10) / 10).toFixed(1);
    var maxLabel = Number.isInteger(max) ? String(max) : max.toFixed(1);
    el.style.width = S + 'px';
    el.style.height = S + 'px';
    el.innerHTML =
      '<svg width="' + S + '" height="' + S + '" viewBox="0 0 ' + S + ' ' + S + '" fill="none">'
        + ticks
        + '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" stroke="var(--paper-3)" stroke-width="4"/>'
        + '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" stroke="var(--accent)" stroke-width="4" stroke-linecap="round"'
        + ' stroke-dasharray="' + c + '" stroke-dashoffset="' + (c * (1 - frac)) + '" transform="rotate(-90 ' + cx + ' ' + cy + ')"/>'
        + '<circle cx="' + dotX + '" cy="' + dotY + '" r="3.4" fill="var(--accent)" stroke="var(--paper)" stroke-width="1.5"/>'
      + '</svg>'
      + '<div class="val"><b style="font-size:' + (S * 0.30) + 'px">' + num + '</b>'
      +   (S >= 58 ? '<small>/ ' + maxLabel + '</small>' : '') + '</div>';
  }
  function renderGauges(){
    document.querySelectorAll('.gauge[data-score]').forEach(drawGauge);
  }
  function init(){
    renderDials();
    renderGauges();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

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
// Newsletter signup — AJAX POST to /api/subscribe (Cloudflare Worker → Resend).
// Worker code lives in /cloudflare-worker/. Subscribe runs on tuningdigital.com;
// the welcome email's unsubscribe link points at unsub.tuningdigital.com (Worker
// Custom Domain, set up via CF dashboard — not in wrangler.toml).
(function(){
  var form = document.getElementById('newsletterForm');
  if(!form) return;

  var status = document.getElementById('newsletterStatus');
  var emailInput = form.querySelector('input[name="email"]');
  var submitBtn = form.querySelector('button[type="submit"]');
  var originalBtnText = submitBtn ? submitBtn.textContent : 'Subscribe';

  function setStatus(msg, kind){
    if(!status) return;
    status.textContent = msg || '';
    status.className = 'newsletter-status' + (kind ? ' ' + kind : '');
  }

  form.addEventListener('submit', function(e){
    e.preventDefault();
    var email = ((emailInput && emailInput.value) || '').trim();
    var honeypotField = form.querySelector('input[name="website"]');
    var honeypot = (honeypotField && honeypotField.value) || '';

    if(!email){
      setStatus('Please enter your email.', 'error');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Subscribing…';
    setStatus('', '');

    fetch('/api/subscribe', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ email: email, website: honeypot })
    })
    .then(function(resp){
      return resp.json().catch(function(){ return {}; }).then(function(data){
        return { ok: resp.ok, data: data };
      });
    })
    .then(function(r){
      if(r.ok && r.data && r.data.success){
        if(r.data.already_subscribed){
          setStatus('You\'re already subscribed — nothing to do.', 'success');
        } else {
          setStatus('You\'re in. Check your inbox for a welcome email.', 'success');
        }
        form.reset();
        if(typeof gtag !== 'undefined'){
          gtag('event', 'newsletter_subscribe', { event_category: 'engagement' });
        }
      } else {
        var detail = (r.data && (r.data.detail || r.data.error)) || 'Subscription failed. Try again?';
        setStatus(detail, 'error');
      }
    })
    .catch(function(){
      setStatus('Network error. Check your connection and try again.', 'error');
    })
    .then(function(){
      submitBtn.disabled = false;
      submitBtn.textContent = originalBtnText;
    });
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


// ─── Cookie Consent Banner ────────────────────────────────
(function(){
  if(localStorage.getItem('td_cookie_consent')) return;

  var banner = document.createElement('div');
  banner.id = 'cookie-banner';
  banner.innerHTML = `
    <div style="
      position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:9999;
      background:#ffffff;border:1px solid #e2e0d8;border-radius:16px;
      padding:20px 24px;max-width:680px;width:calc(100% - 48px);
      display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap;
      box-shadow:0 8px 40px rgba(13,13,18,.12);
      font-family:'DM Sans',sans-serif;
    ">
      <div style="flex:1;min-width:240px">
        <p style="
          font-size:.85rem;color:#6b6a64;margin:0;line-height:1.55;max-width:none;
        ">
          🍪 We use cookies for analytics (GA4) and personalised ads (AdSense).
          See our <a href="/privacy-policy.html#cookies" style="color:#0052ff;text-decoration:underline">Cookie Policy</a>.
        </p>
      </div>
      <div style="display:flex;gap:10px;flex-shrink:0">
        <button id="cookie-decline" style="
          font-family:'DM Sans',sans-serif;font-size:.82rem;font-weight:500;
          padding:9px 18px;border-radius:8px;border:1px solid #e2e0d8;
          background:none;color:#6b6a64;cursor:pointer;transition:all .2s;
        ">Decline</button>
        <button id="cookie-accept" style="
          font-family:'DM Sans',sans-serif;font-size:.82rem;font-weight:600;
          padding:9px 18px;border-radius:8px;border:none;
          background:#0052ff;color:#ffffff;cursor:pointer;transition:all .2s;
        ">Accept All</button>
      </div>
    </div>
  `;
  document.body.appendChild(banner);

  function dismiss(consent){
    localStorage.setItem('td_cookie_consent', consent);
    banner.style.opacity = '0';
    banner.style.transition = 'opacity .3s';
    setTimeout(function(){ banner.remove(); }, 300);
    if(typeof gtag === 'undefined') return;
    // Google Consent Mode v2 — update all four signals.
    // Default state (set in each page's <head>) is denied; only accept switches to granted.
    if(consent === 'accepted'){
      gtag('consent', 'update', {
        ad_storage: 'granted',
        ad_user_data: 'granted',
        ad_personalization: 'granted',
        analytics_storage: 'granted'
      });
    } else {
      // Explicit deny — same as default, but reasserted so any granted state from a
      // previous session that's been revoked propagates correctly.
      gtag('consent', 'update', {
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
        analytics_storage: 'denied'
      });
    }
  }

  document.getElementById('cookie-accept').addEventListener('click', function(){ dismiss('accepted'); });
  document.getElementById('cookie-decline').addEventListener('click', function(){ dismiss('declined'); });
})();

// ─── "Manage cookies" link — re-opens the consent banner ────
(function(){
  // Bind on any element with .manage-cookies class (typically in the footer).
  document.addEventListener('click', function(e){
    var trigger = e.target && e.target.closest && e.target.closest('.manage-cookies');
    if(!trigger) return;
    e.preventDefault();
    // Clear stored consent + reassert default-denied so AdSense/GA4 stop
    // personalising immediately, even before reload.
    try { localStorage.removeItem('td_cookie_consent'); } catch(e){}
    if(typeof gtag !== 'undefined'){
      gtag('consent', 'update', {
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
        analytics_storage: 'denied'
      });
    }
    // Reload so the banner re-injects with a clean slate.
    location.reload();
  });
})();
