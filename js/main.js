/* =============================================
   BK ALPES MOTORS — main.js (v3)
   ============================================= */

document.addEventListener('DOMContentLoaded', () => {

  /* ---- Deep links : /reservation et /reserver scrollent direct au wizard ---- */
  const deepPaths = ['/reservation', '/reserver'];
  if (deepPaths.includes(location.pathname.replace(/\/$/, ''))) {
    requestAnimationFrame(() => {
      const target = document.getElementById('reserver');
      if (target) {
        const top = target.getBoundingClientRect().top + window.scrollY - 90;
        window.scrollTo({ top, behavior: 'instant' in window ? 'instant' : 'auto' });
      }
    });
  }

  /* ---- Navbar scroll ---- */
  const navbar = document.getElementById('navbar');
  const onScroll = () => navbar.classList.toggle('scrolled', window.scrollY > 50);
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---- Mobile menu ---- */
  const burger = document.getElementById('navBurger');
  const navMobile = document.getElementById('navMobile');
  if (burger && navMobile) {
    burger.addEventListener('click', () => {
      navMobile.classList.toggle('open');
      burger.classList.toggle('open');
    });
    navMobile.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
      navMobile.classList.remove('open');
      burger.classList.remove('open');
    }));
  }

  /* ---- Reveal on scroll ---- */
  const revealObs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const siblings = Array.from(entry.target.parentElement.querySelectorAll('.reveal:not(.visible)'));
      entry.target.style.transitionDelay = `${siblings.indexOf(entry.target) * 0.08}s`;
      entry.target.classList.add('visible');
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -28px 0px' });
  document.querySelectorAll('.reveal').forEach(el => revealObs.observe(el));

  /* ---- Rain on glass canvas ---- */
  const rainCanvas = document.getElementById('rainCanvas');
  if (rainCanvas) {
    const rc = rainCanvas.getContext('2d');
    let RW, RH;

    const resize = () => {
      RW = rainCanvas.width = rainCanvas.offsetWidth;
      RH = rainCanvas.height = rainCanvas.offsetHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    // Condensation micro-drops (static background texture)
    const microDrops = Array.from({ length: 180 }, () => ({
      x: Math.random(), y: Math.random(),
      r: Math.random() * 1.8 + 0.5,
      a: Math.random() * 0.35 + 0.08
    }));

    class Drop {
      constructor(scatter) {
        this.reset(scatter);
      }
      reset(scatter) {
        this.x = Math.random() * RW;
        this.y = scatter ? Math.random() * RH : -10;
        this.r = Math.random() * 5 + 4;
        this.maxR = Math.random() * 10 + 8;
        this.growing = true;
        this.falling = false;
        this.vy = 0;
        this.vx = (Math.random() - 0.5) * 0.3;
        this.trail = [];
        this.opacity = 0.85 + Math.random() * 0.15;
      }
      update() {
        if (this.growing) {
          this.r += 0.05;
          if (this.r >= this.maxR) { this.growing = false; this.falling = true; this.vy = 1.2 + Math.random() * 2; }
        }
        if (this.falling) {
          this.trail.unshift({ x: this.x, y: this.y, r: this.r });
          if (this.trail.length > 18) this.trail.pop();
          this.y += this.vy;
          this.x += this.vx;
          this.vy += 0.07;
          this.r = Math.max(2.5, this.r - 0.06);
          if (this.y > RH + 40) this.reset(false);
        }
      }
      draw(ctx) {
        // Trail streak
        if (this.trail.length > 1) {
          for (let i = 0; i < this.trail.length - 1; i++) {
            const t = this.trail[i];
            const a = ((this.trail.length - i) / this.trail.length) * 0.22 * this.opacity;
            ctx.beginPath();
            ctx.moveTo(this.trail[i].x, this.trail[i].y);
            ctx.lineTo(this.trail[i+1].x, this.trail[i+1].y);
            ctx.strokeStyle = `rgba(100,210,170,${a})`;
            ctx.lineWidth = t.r * 0.9;
            ctx.lineCap = 'round';
            ctx.stroke();
          }
        }
        // Drop body with refraction highlight
        const grd = ctx.createRadialGradient(
          this.x - this.r * 0.32, this.y - this.r * 0.32, 0,
          this.x, this.y, this.r
        );
        grd.addColorStop(0,   `rgba(255,255,255,${this.opacity})`);
        grd.addColorStop(0.45,`rgba(140,230,195,${this.opacity * 0.65})`);
        grd.addColorStop(1,   `rgba(64,255,167,${this.opacity * 0.18})`);
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();
        // Specular highlight
        ctx.beginPath();
        ctx.arc(this.x - this.r * 0.3, this.y - this.r * 0.35, this.r * 0.28, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${this.opacity * 0.75})`;
        ctx.fill();
      }
    }

    const drops = Array.from({ length: 38 }, (_, i) => new Drop(i < 20));
    let mx = -9999, my = -9999;

    rainCanvas.addEventListener('mousemove', e => {
      const rect = rainCanvas.getBoundingClientRect();
      mx = e.clientX - rect.left;
      my = e.clientY - rect.top;
      drops.forEach(d => {
        const dx = d.x - mx, dy = d.y - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const repel = 72;
        if (dist < repel && dist > 0) {
          const force = (repel - dist) / repel;
          d.x += (dx / dist) * force * 5;
          d.y += (dy / dist) * force * 3;
          if (!d.falling) { d.falling = true; d.vy = 1.8 + force * 3; }
        }
      });
    });
    rainCanvas.addEventListener('mouseleave', () => { mx = -9999; my = -9999; });

    const rainLoop = () => {
      // Background
      const bg = rc.createLinearGradient(0, 0, 0, RH);
      bg.addColorStop(0, '#07096e');
      bg.addColorStop(1, '#030450');
      rc.fillStyle = bg;
      rc.fillRect(0, 0, RW, RH);

      // Subtle grid lines (glass texture)
      rc.strokeStyle = 'rgba(255,255,255,0.025)';
      rc.lineWidth = 1;
      for (let x = 0; x < RW; x += 60) { rc.beginPath(); rc.moveTo(x, 0); rc.lineTo(x, RH); rc.stroke(); }
      for (let y = 0; y < RH; y += 60) { rc.beginPath(); rc.moveTo(0, y); rc.lineTo(RW, y); rc.stroke(); }

      // Condensation texture
      microDrops.forEach(m => {
        rc.beginPath();
        rc.arc(m.x * RW, m.y * RH, m.r, 0, Math.PI * 2);
        rc.fillStyle = `rgba(180,240,215,${m.a})`;
        rc.fill();
      });

      // Main drops
      drops.forEach(d => { d.update(); d.draw(rc); });

      // Mouse wiper glow
      if (mx > 0) {
        const wg = rc.createRadialGradient(mx, my, 0, mx, my, 80);
        wg.addColorStop(0, 'rgba(64,255,167,0.12)');
        wg.addColorStop(1, 'rgba(64,255,167,0)');
        rc.fillStyle = wg;
        rc.beginPath();
        rc.arc(mx, my, 80, 0, Math.PI * 2);
        rc.fill();
      }

      requestAnimationFrame(rainLoop);
    };
    rainLoop();
  }

  /* ---- Prestige card bubble effect ---- */
  const prestigeCard = document.querySelector('.card-concession');
  if (prestigeCard) {
    let bubbleInterval = null;
    const spawnBubble = () => {
      const b = document.createElement('div');
      b.className = 'card-bubble';
      const size = Math.random() * 18 + 8;
      const dur = (Math.random() * 0.8 + 1.0).toFixed(2);
      b.style.cssText = `width:${size}px;height:${size}px;left:${Math.random()*90+5}%;bottom:${Math.random()*40+10}px;--dur:${dur}s;`;
      prestigeCard.appendChild(b);
      b.addEventListener('animationend', () => b.remove());
    };
    prestigeCard.addEventListener('mouseenter', () => {
      spawnBubble();
      bubbleInterval = setInterval(spawnBubble, 220);
    });
    prestigeCard.addEventListener('mouseleave', () => {
      clearInterval(bubbleInterval);
    });
  }

  /* ---- Onsite scenarios scroll effect ---- */
  const scenarios = document.querySelectorAll('.onsite-scenario');
  if (scenarios.length) {
    const updateScenarios = () => {
      const wh = window.innerHeight;
      const trigger = wh * 0.58;
      scenarios.forEach((card, i) => {
        const top = card.getBoundingClientRect().top;
        const next = scenarios[i + 1];
        const nextTop = next ? next.getBoundingClientRect().top : Infinity;
        card.classList.remove('is-active', 'is-past');
        if (top < trigger) {
          if (nextTop < trigger) {
            card.classList.add('is-past');
          } else {
            card.classList.add('is-active');
          }
        }
      });
    };
    window.addEventListener('scroll', updateScenarios, { passive: true });
    updateScenarios();
  }

  /* ---- (Photo section parallax supprimé : section #photoSection remplacée par #avant-apres) ---- */
  /* ---- (Processus card-stack supprimé : section #processus n'existe plus) ---- */

  /* ---- Counter animation ---- */
  const counters = document.querySelectorAll('.stat-num');
  const counterObs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = parseInt(el.dataset.target);
      let start = 0;
      const duration = 1200;
      const step = timestamp => {
        if (!start) start = timestamp;
        const progress = Math.min((timestamp - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.floor(eased * target);
        if (progress < 1) requestAnimationFrame(step);
        else el.textContent = target;
      };
      requestAnimationFrame(step);
      counterObs.unobserve(el);
    });
  }, { threshold: 0.5 });
  counters.forEach(c => counterObs.observe(c));

  /* ---- Wizard ---- */
  let preselectedFormula = null; // set when user clicks a pack card on the landing page
  let step2Skipped = false;

  // ---- Canapé configurator (simple — single selection) ----
  let canapeAngle = 'sans';
  let canapeSelection = null; // { places, angle, price, label }
  const CANAPE_PRICES = {
    sans: { 2: 79, 3: 99, 4: 119, 5: 139 },
    avec: { 2: 99, 3: 119, 4: 139, 5: 159 },
  };
  const step1Title = document.querySelector('#step1 .wstep-title');
  const doubtLink = document.querySelector('.doubt-link');

  const renderCanapePlaces = () => {
    const grid = document.getElementById('canapePlacesGrid');
    if (!grid) return;
    const prices = CANAPE_PRICES[canapeAngle];
    grid.innerHTML = [2, 3, 4, 5].map(n => `
      <button class="canape-place-card${canapeSelection?.places === n && canapeSelection?.angle === canapeAngle ? ' selected' : ''}" data-places="${n}" data-price="${prices[n]}">
        <span class="canape-place-num">${n}</span>
        <span class="canape-place-label">places</span>
        <span class="canape-place-price">${prices[n]}€</span>
      </button>
    `).join('');
    grid.querySelectorAll('.canape-place-card').forEach(card => {
      card.addEventListener('click', () => {
        const places = parseInt(card.dataset.places);
        const price = parseInt(card.dataset.price);
        canapeSelection = {
          places,
          angle: canapeAngle,
          price,
          label: `Canapé ${canapeAngle === 'avec' ? 'avec angle' : 'sans angle'} · ${places} places`,
        };
        renderCanapePlaces(); // refresh to show selected state
        document.getElementById('s1Next').disabled = false;
        setTimeout(() => document.getElementById('s1Next').click(), 300);
      });
    });
  };

  // Angle toggle
  document.querySelectorAll('.canape-angle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.canape-angle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      canapeAngle = btn.dataset.angle;
      canapeSelection = null;
      document.getElementById('s1Next').disabled = true;
      renderCanapePlaces();
    });
  });

  // "Devis groupé" link inside canape config
  document.getElementById('canapeToDevis')?.addEventListener('click', () => {
    // Switch to devis mode and go to step 2 form
    document.getElementById('canapeConfig').style.display = 'none';
    document.getElementById('washGrid').style.display = '';
    if (step1Title) step1Title.textContent = 'Que souhaitez-vous laver ?';
    if (doubtLink) doubtLink.style.display = '';
    selectedType = 'demande';
    selectedCategory = 'devis';
    canapeSelection = null;
    step2Auto.style.display = 'none';
    step2Service.style.display = '';
    document.getElementById('s2Next').style.display = 'none';
    document.getElementById('s2Back').style.display = '';
    selectedService = 'devis';
    selectedBasePrice = 0;
    setStep(2);
  });

  // Pack cards on landing page → preselect formula in wizard
  document.querySelectorAll('[data-preselect]').forEach(link => {
    link.addEventListener('click', () => {
      preselectedFormula = link.dataset.preselect;
    });
  });

  let selectedType = null;
  let selectedCategory = null;
  let selectedSurcharge = 0;
  let selectedService = null;
  let selectedBasePrice = 0;
  let selectedOptions = []; // array of {name, price}
  let selectedAddress = '';
  let selectedTravelFee = 0;
  let selectedTravelKm = 0;
  let selectedAddressCoords = null; // {lat, lon} pre-fetched from autocomplete
  let selectedDate = null;
  let selectedSlot = null;
  // Code promo appliqué
  let appliedPromo = null; // { code, type: 'percent'|'amount', value, discount, stripePromotionCodeId }
  // Prix manuel admin (override) — si >0, remplace totalement getTotal()
  let adminPriceOverride = null;
  // Mode de paiement admin : 'acompte' (15%) ou 'total' (100%)
  let adminPaymentMode = 'acompte';
  // Custom basket admin (catégorie 'custom') — array de { type, name, price }
  let customBasket = [];
  let currentStep = 1;

  const NIMES_LAT = 43.8367;
  const NIMES_LON = 4.3601;
  const FREE_ZONE_KM = 20;
  const KM_RATE = 1.5; // €/km beyond free zone
  const TOTAL_STEPS = 5;

  // Initialise le data-step pour que le CSS (.payment-info visible seulement à l'étape 5) soit correct au chargement
  const wizardWrap = document.getElementById('reserver');
  if (wizardWrap) wizardWrap.dataset.step = '1';

  const steps = {
    1: document.getElementById('step1'),
    2: document.getElementById('step2'),
    3: document.getElementById('step3'),
    4: document.getElementById('step4'),
    5: document.getElementById('step5'),
  };
  const dots = document.querySelectorAll('.wdot');
  const fill = document.getElementById('progressFill');
  const step2Auto = document.getElementById('step2Auto');
  const step2Service = document.getElementById('step2Service');

  // Clickable dots — navigate back to any completed step
  dots.forEach((dot, i) => {
    const stepNum = i + 1;
    dot.addEventListener('click', () => {
      if (dot.classList.contains('done') && stepNum < currentStep) {
        // Remove done from all dots after target
        for (let j = stepNum - 1; j < dots.length; j++) {
          dots[j].classList.remove('done');
        }
        setStep(stepNum);
      }
    });
  });

  function setStep(n, opts) {
    opts = opts || {};
    if (n === currentStep) return;
    // Clear toute erreur de validation au changement d'étape
    clearValidationErrors();
    steps[currentStep].classList.remove('active');
    dots[currentStep - 1].classList.remove('active');
    if (n > currentStep) dots[currentStep - 1].classList.add('done');
    else dots[currentStep - 1].classList.remove('done');
    currentStep = n;
    steps[currentStep].classList.add('active');
    dots[currentStep - 1].classList.add('active');
    // Retour à l'étape 1 : reset le stepper devis-mode + le formulaire devis
    // (évite le bug où les flèches 3/4/5 restent cachées après un détour par devis)
    if (n === 1) {
      const dotsWrap = document.querySelector('.wizard-dots');
      if (dotsWrap) dotsWrap.classList.remove('devis-mode');
      const step2Auto = document.getElementById('step2Auto');
      const step2Service = document.getElementById('step2Service');
      const s2NextBtn = document.getElementById('s2Next');
      if (step2Auto) step2Auto.style.display = '';
      if (step2Service) step2Service.style.display = 'none';
      if (s2NextBtn) s2NextBtn.style.display = '';
    }
    fill.style.width = ((currentStep - 1) / (TOTAL_STEPS - 1) * 100) + '%';
    const wrap = document.getElementById('reserver');
    if (wrap) wrap.dataset.step = String(currentStep);
    if (!opts.skipScroll) wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // Push dans l'historique (sauf si le changement vient de popstate)
    if (!opts.fromPopState && window.history && window.history.pushState) {
      try {
        window.history.pushState({ wizardStep: n }, '', window.location.pathname + '#etape-' + n + window.location.search);
      } catch (e) { /* ignore */ }
    }
  }

  // Browser back → step précédent (au lieu de quitter la page)
  window.addEventListener('popstate', (e) => {
    const wizardWrap = document.getElementById('reserver');
    if (!wizardWrap) return;
    const target = (e.state && e.state.wizardStep) || 1;
    if (target !== currentStep && target >= 1 && target <= TOTAL_STEPS) {
      setStep(target, { fromPopState: true, skipScroll: true });
    }
  });

  // Helpers pour les messages d'erreur de validation
  function clearValidationErrors() {
    document.querySelectorAll('.wstep-validation-error').forEach(el => el.remove());
    document.querySelectorAll('.wstep-input-error').forEach(el => el.classList.remove('wstep-input-error'));
  }

  // ---- Next buttons : on remplace `disabled` natif par `data-locked` pour qu'ils restent cliquables
  // (et puissent afficher un message de validation au lieu d'être muets) ----
  ['s1Next', 's2Next', 's3Next', 's4Next', 'devisWhatsappBtn'].forEach(id => {
    const btn = document.getElementById(id);
    if (!btn) return;
    let locked = btn.hasAttribute('disabled');
    Object.defineProperty(btn, 'disabled', {
      get() { return locked; },
      set(v) {
        locked = !!v;
        this.dataset.locked = locked ? 'true' : 'false';
        this.removeAttribute('disabled');
      },
      configurable: true,
    });
    btn.dataset.locked = locked ? 'true' : 'false';
    btn.removeAttribute('disabled');
  });
  function showValidationError(stepEl, message, opts) {
    opts = opts || {};
    if (!stepEl) return;
    // Retire les anciens messages
    stepEl.querySelectorAll('.wstep-validation-error').forEach(el => el.remove());
    const div = document.createElement('div');
    div.className = 'wstep-validation-error';
    div.setAttribute('role', 'alert');
    div.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><span>' + message + '</span>';
    // Insère avant le wstep-nav
    const nav = stepEl.querySelector('.wstep-nav');
    if (nav) nav.parentElement.insertBefore(div, nav);
    else stepEl.appendChild(div);
    // Highlight des champs si demandé
    if (opts.fields) {
      opts.fields.forEach(sel => {
        const el = stepEl.querySelector(sel);
        if (el) el.classList.add('wstep-input-error');
      });
    }
    // Auto-clear après 6s
    setTimeout(() => { if (div.parentElement) div.remove(); }, 6000);
    // Scroll vers l'erreur
    div.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // Step 1 — Catégories top-level (5 onglets : Voiture / Canapé / Tapis / Moto-scooter-utilitaire / Autre)
  document.querySelectorAll('.cat-card').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.cat-card').forEach(b => b.classList.remove('selected'));
      document.querySelectorAll('.wash-card').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');

      const cat = btn.dataset.cat;
      const vehicleSub = document.getElementById('vehicleSubGrid');
      const canapeConfig = document.getElementById('canapeConfig');
      const s1Next = document.getElementById('s1Next');

      // Reset UI + reset le stepper devis-mode à chaque changement de catégorie
      if (vehicleSub) vehicleSub.style.display = 'none';
      if (canapeConfig) canapeConfig.style.display = 'none';
      s1Next.disabled = true;
      selectedType = null;
      selectedCategory = cat;
      selectedSurcharge = 0;
      const dotsWrap = document.querySelector('.wizard-dots');
      if (dotsWrap) dotsWrap.classList.remove('devis-mode');

      // 🚗 Voiture : révèle la sous-grille des 4 types de véhicule
      if (cat === 'auto') {
        if (vehicleSub) vehicleSub.style.display = '';
        if (step1Title) step1Title.textContent = 'Quel type de véhicule ?';
        return;
      }

      // 🛋️ Canapé : affiche le configurator existant
      if (cat === 'canape') {
        if (canapeConfig) canapeConfig.style.display = '';
        if (step1Title) step1Title.textContent = 'Configurez votre canapé';
        if (doubtLink) doubtLink.style.display = 'none';
        selectedType = 'canape';
        canapeSelection = null;
        canapeAngle = 'sans';
        document.querySelectorAll('.canape-angle-btn').forEach(b => b.classList.toggle('active', b.dataset.angle === 'sans'));
        renderCanapePlaces();
        return;
      }

      // 🧹 🏍️ 📋 Devis : map data-devis-type → selectedType et auto-advance
      if (cat === 'devis') {
        const dt = btn.dataset.devisType || 'demande';
        // 'moto-scooter' et 'tapis-matelas' et 'demande' sont passés tels quels à l'API
        selectedType = dt === 'moto-scooter' ? 'demande' : dt;
        // Conserver une trace pour le placeholder du form devis
        btn._devisTypeLabel = btn.querySelector('.cat-label')?.textContent || '';
        s1Next.disabled = false;
        setTimeout(() => s1Next.click(), 280);
        return;
      }
    });
  });

  // Step 1 — Sous-choix véhicule + cartes admin (wash-cards)
  document.querySelectorAll('.wash-card').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.wash-card').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedType = btn.dataset.type;
      selectedCategory = btn.dataset.category;
      selectedSurcharge = parseInt(btn.dataset.surcharge) || 0;

      if (selectedCategory === 'canape') {
        document.getElementById('washGrid').style.display = 'none';
        document.getElementById('canapeConfig').style.display = '';
        if (step1Title) step1Title.textContent = 'Configurez votre canapé';
        if (doubtLink) doubtLink.style.display = 'none';
        canapeSelection = null;
        canapeAngle = 'sans';
        document.querySelectorAll('.canape-angle-btn').forEach(b => b.classList.toggle('active', b.dataset.angle === 'sans'));
        document.getElementById('s1Next').disabled = true;
        renderCanapePlaces();
        return;
      }

      if (selectedCategory === 'devis') {
        // Devis cards — auto-advance after short delay
        document.getElementById('s1Next').disabled = false;
        setTimeout(() => document.getElementById('s1Next').click(), 300);
        return;
      }

      // Custom (admin) : ouvre le panier de prestations sur devis
      if (selectedCategory === 'custom') {
        document.getElementById('washGrid').style.display = 'none';
        const cb = document.getElementById('customBasket');
        if (cb) cb.style.display = '';
        if (step1Title) step1Title.textContent = 'Demande spécifique';
        if (doubtLink) doubtLink.style.display = 'none';
        // Reset basket et ajoute une première ligne dans Voiture
        customBasket = [];
        renderCustomBasket();
        addBasketItem('voiture');
        return;
      }

      // Auto cards
      updatePrices();
      document.getElementById('s1Next').disabled = false;
      setTimeout(() => document.getElementById('s1Next').click(), 300);
    });
  });

  // ---- Custom basket (admin demande spécifique) — NOUVELLE VERSION SECTIONNÉE ----
  // Catalogue par section : Voiture / Textile / Autre
  const VOITURE_TYPES = [
    { value: 'citadine',    label: 'Citadine',         defaultPrice: 80  },
    { value: 'berline',     label: 'Berline',          defaultPrice: 95  },
    { value: 'suv',         label: 'SUV / 4×4',        defaultPrice: 110 },
    { value: 'premium',     label: 'Sportive',         defaultPrice: 120 },
    { value: 'utilitaire',  label: 'Utilitaire / Van', defaultPrice: 0   },
    { value: 'moto',        label: 'Moto',             defaultPrice: 0   },
    { value: 'scooter',     label: 'Scooter',          defaultPrice: 0   },
  ];
  const VOITURE_OPTIONS = [
    { name: 'Traitement cuir',           price: 15 },
    { name: 'Traitement alcantara',      price: 20 },
    { name: 'Traitement ozone',          price: 20 },
    { name: 'Traitement vapeur',         price: 15 },
    { name: 'Traitement anti-moisissure',price: 18 },
    { name: 'Traitement cuir hors siège',price: 12 },
    { name: 'Shampoing siège auto',      price: 15 },
    { name: 'Shampoing siège bébé',      price: 15 },
    { name: 'Shampoing coffre',          price: 12 },
    { name: 'Shampoing plafonnier',      price: 15 },
    { name: 'Véhicule non vidé',         price: 10 },
  ];
  const TEXTILE_TYPES = [
    { value: 'canape-2pl',  label: 'Canapé 2 places', defaultPrice: 60 },
    { value: 'canape-3pl',  label: 'Canapé 3 places', defaultPrice: 80 },
    { value: 'canape-angle',label: 'Canapé d\'angle', defaultPrice: 100 },
    { value: 'fauteuil',    label: 'Fauteuil',        defaultPrice: 40 },
    { value: 'matelas-1pl', label: 'Matelas 1 place', defaultPrice: 50 },
    { value: 'matelas-2pl', label: 'Matelas 2 places',defaultPrice: 70 },
    { value: 'moquette',    label: 'Moquette',        defaultPrice: 0  },
    { value: 'tapis',       label: 'Tapis',           defaultPrice: 0  },
  ];
  const TEXTILE_OPTIONS = [
    { name: 'Traitement cuir',         price: 20 },
    { name: 'Nettoyage vapeur',        price: 15 },
    { name: 'Nettoyage par coussin',   price: 10 },
    { name: 'Poils d\'animaux',        price: 20 },
  ];

  function renderCustomBasket() {
    ['voiture', 'textile', 'autre'].forEach(section => {
      const list = document.getElementById('basketList' + section[0].toUpperCase() + section.slice(1));
      if (!list) return;
      list.innerHTML = '';
      customBasket
        .map((it, idx) => ({ it, idx }))
        .filter(({ it }) => it.section === section)
        .forEach(({ it, idx }) => {
          list.appendChild(renderBasketItem(it, idx));
        });
    });
  }

  function renderBasketItem(item, idx) {
    const wrap = document.createElement('div');
    wrap.className = 'basket-item' + (item.section === 'autre' ? ' no-options' : '');
    const main = document.createElement('div');
    main.className = 'basket-item-main';

    if (item.section === 'autre') {
      // Champ libre + prix
      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.placeholder = 'Décrire la prestation (ex: Désinfection PVD complète)';
      nameInput.value = item.name || '';
      nameInput.addEventListener('input', () => { customBasket[idx].name = nameInput.value; });
      const dummySelect = document.createElement('input');
      dummySelect.type = 'text';
      dummySelect.placeholder = 'Détail / type (optionnel)';
      dummySelect.value = item.detail || '';
      dummySelect.addEventListener('input', () => { customBasket[idx].detail = dummySelect.value; });
      main.appendChild(nameInput);
      main.appendChild(dummySelect);
    } else {
      // Type select pour voiture / textile
      const types = item.section === 'voiture' ? VOITURE_TYPES : TEXTILE_TYPES;
      const typeSelect = document.createElement('select');
      types.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.value;
        opt.textContent = t.label;
        if (t.value === item.type) opt.selected = true;
        typeSelect.appendChild(opt);
      });
      typeSelect.addEventListener('change', () => {
        customBasket[idx].type = typeSelect.value;
        const t = types.find(x => x.value === typeSelect.value);
        if (t) {
          customBasket[idx].name = t.label;
          // Si le prix actuel = ancien defaultPrice ou 0, on remet le nouveau default
          customBasket[idx].price = t.defaultPrice;
        }
        renderCustomBasket();
        updateCustomBasketTotal();
      });
      // Champ détail libre (optionnel)
      const detailInput = document.createElement('input');
      detailInput.type = 'text';
      detailInput.placeholder = 'Détail (ex: BMW Série 3, taches…)';
      detailInput.value = item.detail || '';
      detailInput.addEventListener('input', () => { customBasket[idx].detail = detailInput.value; });
      main.appendChild(typeSelect);
      main.appendChild(detailInput);
    }

    // Prix
    const priceWrap = document.createElement('div');
    priceWrap.className = 'price-wrap';
    const priceInput = document.createElement('input');
    priceInput.type = 'number';
    priceInput.min = '0';
    priceInput.step = '1';
    priceInput.placeholder = '0';
    priceInput.value = item.price > 0 ? String(item.price) : '';
    priceInput.addEventListener('input', () => {
      customBasket[idx].price = parseFloat(priceInput.value) || 0;
      updateCustomBasketTotal();
    });
    priceWrap.appendChild(priceInput);
    main.appendChild(priceWrap);

    // Remove
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'basket-remove';
    remove.title = 'Retirer';
    remove.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="6" y1="18" x2="18" y2="6"/></svg>';
    remove.addEventListener('click', () => {
      customBasket.splice(idx, 1);
      renderCustomBasket();
      updateCustomBasketTotal();
    });
    main.appendChild(remove);
    wrap.appendChild(main);

    // Options (uniquement voiture + textile)
    if (item.section === 'voiture' || item.section === 'textile') {
      const opts = item.section === 'voiture' ? VOITURE_OPTIONS : TEXTILE_OPTIONS;
      const optsWrap = document.createElement('div');
      optsWrap.className = 'basket-options';
      const optsLabel = document.createElement('span');
      optsLabel.className = 'basket-options-label';
      optsLabel.textContent = 'Options';
      optsWrap.appendChild(optsLabel);
      const grid = document.createElement('div');
      grid.className = 'basket-options-grid';
      opts.forEach(o => {
        const lab = document.createElement('label');
        lab.className = 'basket-option';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        const isChecked = (item.options || []).some(x => x.name === o.name);
        cb.checked = isChecked;
        cb.addEventListener('change', () => {
          if (!customBasket[idx].options) customBasket[idx].options = [];
          if (cb.checked) {
            if (!customBasket[idx].options.some(x => x.name === o.name)) {
              customBasket[idx].options.push({ name: o.name, price: o.price });
            }
          } else {
            customBasket[idx].options = customBasket[idx].options.filter(x => x.name !== o.name);
          }
          updateCustomBasketTotal();
        });
        const span = document.createElement('span');
        span.className = 'opt-label';
        span.textContent = o.name;
        const price = document.createElement('span');
        price.className = 'opt-price';
        price.textContent = '+' + o.price + '€';
        lab.appendChild(cb);
        lab.appendChild(span);
        lab.appendChild(price);
        grid.appendChild(lab);
      });
      optsWrap.appendChild(grid);
      wrap.appendChild(optsWrap);
    }

    return wrap;
  }

  function addBasketItem(section) {
    let item;
    if (section === 'voiture') {
      const t = VOITURE_TYPES[0];
      item = { section, type: t.value, name: t.label, detail: '', price: t.defaultPrice, options: [] };
    } else if (section === 'textile') {
      const t = TEXTILE_TYPES[0];
      item = { section, type: t.value, name: t.label, detail: '', price: t.defaultPrice, options: [] };
    } else {
      item = { section, type: 'autre', name: '', detail: '', price: 0, options: [] };
    }
    customBasket.push(item);
    renderCustomBasket();
    updateCustomBasketTotal();
  }

  function getCustomBasketTotal() {
    return customBasket.reduce((sum, it) => {
      const itemPrice = Number.isFinite(it.price) ? it.price : 0;
      const optsPrice = (it.options || []).reduce((s, o) => s + (Number.isFinite(o.price) ? o.price : 0), 0);
      return sum + itemPrice + optsPrice;
    }, 0);
  }

  function updateCustomBasketTotal() {
    const v = getCustomBasketTotal();
    const totalEl = document.getElementById('customBasketTotalValue');
    if (totalEl) totalEl.textContent = `${v}€`;
    const nextBtn = document.getElementById('s1Next');
    if (nextBtn && selectedCategory === 'custom') {
      const valid = customBasket.length > 0 && customBasket.every(it => {
        const total = (Number.isFinite(it.price) ? it.price : 0)
          + (it.options || []).reduce((s, o) => s + (o.price || 0), 0);
        return total > 0 && (it.section !== 'autre' || (it.name && it.name.trim().length > 0));
      });
      nextBtn.disabled = !valid;
    }
  }

  // Bind add buttons par section
  document.querySelectorAll('[data-add-section]').forEach(btn => {
    btn.addEventListener('click', () => {
      addBasketItem(btn.dataset.addSection);
    });
  });

  function updatePrices() {
    [['confort', 80], ['concession', 119]].forEach(([k, base]) => {
      const el = document.getElementById(`p-${k}`);
      if (el) el.textContent = (base + selectedSurcharge) + '€';
    });
  }

  document.getElementById('s1Next').addEventListener('click', () => {
    // Validation : avant tout, vérifier qu'un type est sélectionné
    if (document.getElementById('s1Next').dataset.locked === 'true') {
      if (selectedCategory === 'custom') {
        showValidationError(steps[1], 'Ajoutez au moins une prestation avec un prix > 0€ avant de continuer.');
      } else if (selectedCategory === 'canape' && !canapeSelection) {
        showValidationError(steps[1], 'Choisissez la configuration de votre canapé.');
      } else if (!selectedType) {
        showValidationError(steps[1], 'Sélectionnez d\'abord ce que vous souhaitez laver.');
      } else {
        showValidationError(steps[1], 'Veuillez compléter cette étape avant de continuer.');
      }
      return;
    }
    // Custom (admin) : skip steps 2 + 3, go directement à step 4 (lieu)
    if (selectedCategory === 'custom') {
      // Total = somme du panier
      selectedService = 'custom';
      selectedBasePrice = getCustomBasketTotal();
      selectedSurcharge = 0;
      selectedOptions = [];
      step2Skipped = true;
      // Marquer steps 2 + 3 comme done
      dots[1].classList.add('done');
      dots[2].classList.add('done');
      // Restore wizard pour la prochaine ouverture
      document.getElementById('washGrid').style.display = '';
      const cb = document.getElementById('customBasket');
      if (cb) cb.style.display = 'none';
      if (step1Title) step1Title.textContent = 'Quel type de véhicule ?';
      setStep(4);
      return;
    }
    // Canape: skip step 2, go directly to step 3
    if (selectedCategory === 'canape') {
      selectedService = 'canape';
      selectedBasePrice = canapeSelection ? canapeSelection.price : 0;
      selectedSurcharge = 0;
      step2Skipped = true;
      selectedOptions = [];
      document.querySelectorAll('.option-item input').forEach(cb => cb.checked = false);
      dots[1].classList.add('done');
      dots[1].classList.remove('has-crown');
      // Restore step 1 for next time
      document.getElementById('washGrid').style.display = '';
      document.getElementById('canapeConfig').style.display = 'none';
      if (step1Title) step1Title.textContent = 'Que souhaitez-vous laver ?';
      if (doubtLink) doubtLink.style.display = '';
      // Show canape options, hide auto options
      document.getElementById('step3CanapeOptions').style.display = '';
      document.getElementById('step3AutoOptions').style.display = 'none';
      setStep(3);
      return;
    }

    // Devis: go to step 2 contact form
    if (selectedCategory === 'devis') {
      document.querySelector('.wizard-dots').classList.add('devis-mode');
      step2Auto.style.display = 'none';
      step2Service.style.display = '';
      document.getElementById('s2Next').style.display = 'none'; // WhatsApp replaces Next
      selectedService = 'devis';
      selectedBasePrice = 0;
      // Pre-fill devis type in description
      const devisDesc = document.getElementById('devisDesc');
      const typeHints = { utilitaire: 'Utilitaire / Van', 'tapis-matelas': 'Tapis, matelas ou moquette', demande: '' };
      if (devisDesc && typeHints[selectedType]) devisDesc.placeholder = `Ex : ${typeHints[selectedType]}, taches importantes...`;
      setStep(2);
      return;
    }

    // Auto + preselected formula from landing page
    if (selectedCategory === 'auto' && preselectedFormula) {
      const formulaBtn = document.querySelector(`.formula-item[data-service="${preselectedFormula}"]`);
      if (formulaBtn) {
        document.querySelectorAll('.formula-item').forEach(f => f.classList.remove('selected'));
        formulaBtn.classList.add('selected');
        selectedService = preselectedFormula;
        selectedBasePrice = parseInt(formulaBtn.dataset.base) || 0;
      }
      const wasConcession = selectedService === 'concession';
      preselectedFormula = null;
      step2Skipped = true;
      selectedOptions = [];
      document.querySelectorAll('.option-item input').forEach(cb => cb.checked = false);
      dots[1].classList.add('done');
      dots[1].classList.toggle('has-crown', wasConcession);
      setStep(3);
      return;
    }

    // Regular auto flow
    step2Auto.style.display = '';
    step2Service.style.display = 'none';
    document.getElementById('s2Next').disabled = true;
    document.getElementById('s2Next').style.display = '';
    document.querySelectorAll('.formula-item').forEach(f => f.classList.remove('selected'));
    selectedService = null;
    // Show auto options for step 3
    document.getElementById('step3CanapeOptions').style.display = 'none';
    document.getElementById('step3AutoOptions').style.display = '';
    setStep(2);
  });

  // Vehicle guide modal
  const vehicleGuideBtn = document.getElementById('vehicleGuideBtn');
  const vehicleGuideOverlay = document.getElementById('vehicleGuideOverlay');
  const vgmClose = document.getElementById('vgmClose');
  if (vehicleGuideBtn) {
    vehicleGuideBtn.addEventListener('click', () => { vehicleGuideOverlay.hidden = false; document.body.style.overflow = 'hidden'; });
  }
  if (vgmClose) {
    vgmClose.addEventListener('click', () => { vehicleGuideOverlay.hidden = true; document.body.style.overflow = ''; });
  }
  if (vehicleGuideOverlay) {
    vehicleGuideOverlay.addEventListener('click', (e) => {
      if (e.target === vehicleGuideOverlay) { vehicleGuideOverlay.hidden = true; document.body.style.overflow = ''; }
    });
  }

  // Step 2
  document.querySelectorAll('.formula-item').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.formula-item').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedService = btn.dataset.service;
      selectedBasePrice = parseInt(btn.dataset.base);
      document.getElementById('s2Next').disabled = false;
      setTimeout(() => document.getElementById('s2Next').click(), 300);
    });
  });

  document.getElementById('s2Back').addEventListener('click', () => {
    document.getElementById('s2Next').style.display = '';
    document.querySelector('.wizard-dots').classList.remove('devis-mode');
    setStep(1);
  });

  // Devis form validation + envoi via /api/submit-devis
  const devisFields = ['devisPrenom', 'devisTel', 'devisEmail', 'devisDesc'];
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const checkDevisForm = () => {
    const prenom = document.getElementById('devisPrenom')?.value.trim() || '';
    const tel = document.getElementById('devisTel')?.value.trim() || '';
    const email = document.getElementById('devisEmail')?.value.trim() || '';
    const desc = document.getElementById('devisDesc')?.value.trim() || '';
    const ok = prenom.length > 1 && tel.length >= 6 && emailRe.test(email) && desc.length > 3;
    const btn = document.getElementById('devisWhatsappBtn');
    if (btn) btn.disabled = !ok;
  };
  devisFields.forEach(id => {
    document.getElementById(id)?.addEventListener('input', checkDevisForm);
  });

  document.getElementById('devisWhatsappBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('devisWhatsappBtn');
    if (btn.disabled) return;

    const prenom = document.getElementById('devisPrenom').value.trim();
    const tel = document.getElementById('devisTel').value.trim();
    const email = document.getElementById('devisEmail').value.trim();
    const desc = document.getElementById('devisDesc').value.trim();

    const sentMsg = document.getElementById('devisSentMsg');
    const errorMsg = document.getElementById('devisErrorMsg');
    if (sentMsg) sentMsg.hidden = true;
    if (errorMsg) errorMsg.hidden = true;

    const originalLabel = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Envoi en cours…';

    try {
      const res = await fetch('/api/submit-devis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prenom, tel, email, desc, type: selectedType || 'demande' }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || 'Envoi échoué');
      }

      // Succès : on cache le form et on affiche le message de confirmation
      const form = document.querySelector('#step2Service .devis-form');
      if (form) {
        form.querySelectorAll('input, textarea, .devis-form-row, .fg:not(:has(#devisSentMsg)), .btn-envoyer').forEach(el => {
          if (el.id !== 'devisSentMsg' && el.id !== 'devisErrorMsg') el.style.display = 'none';
        });
      }
      if (sentMsg) sentMsg.hidden = false;
    } catch (err) {
      console.error('devis submit error', err);
      if (errorMsg) errorMsg.hidden = false;
      btn.disabled = false;
      btn.textContent = originalLabel;
    }
  });
  document.getElementById('s2Next').addEventListener('click', () => {
    if (document.getElementById('s2Next').dataset.locked === 'true') {
      showValidationError(steps[2], 'Choisissez une formule (Confort ou Prestige) avant de continuer.');
      return;
    }
    dots[1].classList.toggle('has-crown', selectedService === 'concession');
    selectedOptions = [];
    document.querySelectorAll('.option-item input').forEach(cb => cb.checked = false);
    if (selectedCategory === 'devis') {
      // Skip step 3 for devis — go directly to address
      dots[2].classList.add('done');
      setStep(4);
    } else {
      setStep(3);
    }
  });

  // Step 3: Options
  document.querySelectorAll('.option-item input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      selectedOptions = Array.from(document.querySelectorAll('.option-item input[type="checkbox"]:checked'))
        .map(c => ({ name: c.dataset.name, price: parseInt(c.dataset.price) }));
    });
  });

  document.getElementById('s3Back').addEventListener('click', () => {
    if (step2Skipped) {
      step2Skipped = false;
      dots[1].classList.remove('done', 'has-crown');
      setStep(1);
    } else setStep(2);
  });
  document.getElementById('s3Next').addEventListener('click', () => {
    selectedAddress = '';
    selectedTravelFee = 0;
    selectedTravelKm = 0;
    selectedAddressCoords = null;
    document.getElementById('address').value = '';
    document.getElementById('s4Next').disabled = true;
    setStep(4);
  });

  // Step 4: Lieu + Address
  let selectedLieu = '';
  const s4Next = document.getElementById('s4Next');
  const lieuAddressWrap = document.getElementById('lieuAddressWrap');
  const addressInput = document.getElementById('address');

  const lieuAutreWrap = document.getElementById('lieuAutreWrap');

  const checkS4Valid = () => {
    const addr = addressInput ? addressInput.value.trim() : '';
    s4Next.disabled = !selectedLieu || addr.length < 5;
  };

  document.querySelectorAll('.lieu-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.lieu-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      selectedLieu = card.dataset.lieu;
      lieuAutreWrap.style.display = selectedLieu === 'Autre' ? '' : 'none';
      if (addressInput) addressInput.focus();
      checkS4Valid();
    });
  });

  if (addressInput) {
    addressInput.addEventListener('input', () => {
      selectedAddress = addressInput.value.trim();
      selectedAddressCoords = null; // reset pre-fetched coords if user edits manually
      checkS4Valid();
    });
  }

  document.getElementById('s4Back').addEventListener('click', () => setStep(3));
  document.getElementById('s4Next').addEventListener('click', async () => {
    const btn = document.getElementById('s4Next');
    if (btn.dataset.locked === 'true') {
      const addr = addressInput ? addressInput.value.trim() : '';
      if (!selectedLieu) {
        showValidationError(steps[4], 'Choisissez où sera lavée la voiture (Domicile, Travail, Courses ou Autre).');
      } else if (addr.length < 5) {
        showValidationError(steps[4], 'Renseignez l\'adresse d\'intervention.', { fields: ['#address'] });
      } else {
        showValidationError(steps[4], 'Veuillez compléter cette étape.');
      }
      return;
    }
    const addr = addressInput ? addressInput.value.trim() : '';
    btn.disabled = true;
    btn.textContent = 'Calcul...';

    try {
      let lat, lon;
      if (selectedAddressCoords) {
        ({ lat, lon } = selectedAddressCoords);
      } else {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addr + ', France')}&limit=1&countrycodes=fr`;
        const res = await fetch(url, { headers: { 'Accept-Language': 'fr' } });
        const data = await res.json();
        if (data.length) { lat = parseFloat(data[0].lat); lon = parseFloat(data[0].lon); }
      }
      if (lat !== undefined) {
        const dist = haversineKm(NIMES_LAT, NIMES_LON, lat, lon);
        selectedTravelKm = Math.round(dist * 10) / 10;
        const extra = Math.max(0, dist - FREE_ZONE_KM);
        selectedTravelFee = extra > 0 ? Math.round(extra * KM_RATE) : 0;
      } else {
        selectedTravelKm = 0;
        selectedTravelFee = 0;
      }
    } catch {
      selectedTravelKm = 0;
      selectedTravelFee = 0;
    }

    btn.disabled = false;
    btn.textContent = 'Suivant';
    updateRecap();
    renderCalendar();
    setStep(5);
  });

  document.getElementById('s5Back').addEventListener('click', () => setStep(4));

  // Total calculation
  function getTotal() {
    // Mode admin : si prix manuel fourni, il remplace tout
    if (adminPriceOverride && adminPriceOverride > 0) return adminPriceOverride;
    const optionsTotal = selectedOptions.reduce((sum, o) => sum + o.price, 0);
    return selectedBasePrice + selectedSurcharge + optionsTotal + selectedTravelFee;
  }

  function getDiscount() {
    if (!appliedPromo) return 0;
    const total = getTotal();
    let d = 0;
    if (appliedPromo.type === 'percent') d = Math.round(total * (appliedPromo.value / 100) * 100) / 100;
    else d = Math.min(appliedPromo.value, total);
    return Math.max(0, Math.min(d, total));
  }

  function getTotalAfterDiscount() {
    return Math.max(0, Math.round((getTotal() - getDiscount()) * 100) / 100);
  }

  function getAcompte() {
    const total = getTotalAfterDiscount();
    // Mode admin "totalité" : le client paie 100% en ligne
    if (window.BK_ADMIN && adminPaymentMode === 'total') return total;
    return Math.ceil(total * 0.15);
  }

  // Step 5: Update recap
  function updateRecap() {
    const typeLabels = {
      citadine: 'Citadine', berline: 'Berline', suv: 'SUV / 4x4', moto: 'Moto', scooter: 'Scooter',
      utilitaire: 'Utilitaire', premium: 'Premium / Sport',
      canape: 'Canapé', 'tapis-matelas': 'Tapis / Matelas', demande: 'Demande spécifique',
    };
    const serviceLabels = { confort: 'Pack Confort · 80€', concession: 'Pack Prestige · 119€', devis: 'Personnalisé', canape: 'Personnalisé', custom: 'Demande spécifique' };
    const customVehicleLabel = selectedService === 'custom' ? 'Demande spécifique' : (typeLabels[selectedType] || selectedType || '-');

    document.getElementById('recapVehicle').textContent = customVehicleLabel;
    document.getElementById('recapFormule').textContent = serviceLabels[selectedService] || '-';
    document.getElementById('recapAdresse').textContent = selectedAddress || '-';

    // Horaire (date + slot) — affiché uniquement si les deux sont choisis
    const horaireRow = document.getElementById('recapHoraireRow');
    const horaireEl = document.getElementById('recapHoraire');
    if (horaireRow && horaireEl) {
      if (selectedDate && selectedSlot) {
        const jours = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
        const mois = ['jan','fév','mars','avr','mai','juin','juil','août','sep','oct','nov','déc'];
        const j = jours[selectedDate.getDay()];
        const d = selectedDate.getDate();
        const m = mois[selectedDate.getMonth()];
        horaireEl.innerHTML = `${j}. ${d} ${m} · ${selectedSlot}<span class="recap-line-hint">Durée ~ 2h30</span>`;
        horaireRow.hidden = false;
      } else {
        horaireRow.hidden = true;
      }
    }

    // Canape basket items in recap
    const optContainer = document.getElementById('recapOptionsContainer');
    if (optContainer) {
      if (selectedService === 'custom') {
        // Mode admin demande spécifique : chaque item + ses options détaillées
        optContainer.innerHTML = customBasket.map(it => {
          const baseLabel = (it.section === 'autre' ? (it.name || 'Prestation') : it.name)
            + (it.detail ? ` · ${it.detail}` : '');
          const itemLine = `<div class="recap-line recap-option-line"><span>${baseLabel}</span><strong>${it.price}€</strong></div>`;
          const optLines = (it.options || []).map(o =>
            `<div class="recap-line recap-option-line" style="padding-left:14px;color:var(--text-muted);font-size:0.86rem"><span>+ ${o.name}</span><strong>+${o.price}€</strong></div>`
          ).join('');
          return itemLine + optLines;
        }).join('');
      } else if (selectedService === 'canape' && canapeSelection) {
        optContainer.innerHTML = `<div class="recap-line recap-option-line">
            <span>${canapeSelection.label}</span>
            <strong>${canapeSelection.price}€</strong>
          </div>` + selectedOptions.map(o =>
          `<div class="recap-line recap-option-line">
            <span>${o.name}</span>
            <strong>+${o.price}€</strong>
          </div>`
        ).join('');
      } else {
        optContainer.innerHTML = selectedOptions.map(o =>
          `<div class="recap-line recap-option-line">
            <span>${o.name}</span>
            <strong>+${o.price}€</strong>
          </div>`
        ).join('');
      }
    }

    // Frais de déplacement
    const deplacementEl = document.getElementById('recapDeplacement');
    if (deplacementEl) {
      if (selectedTravelFee > 0) {
        const extraKm = Math.round(Math.max(0, selectedTravelKm - FREE_ZONE_KM) * 10) / 10;
        deplacementEl.textContent = `+${selectedTravelFee}€ · ${extraKm} km hors zone`;
        deplacementEl.style.color = '#92400e';
      } else {
        deplacementEl.textContent = selectedTravelKm > 0 ? `Inclus · ${selectedTravelKm} km` : 'Inclus';
        deplacementEl.style.color = '';
      }
    }

    const total = getTotal();
    const discount = getDiscount();
    const acompte = getAcompte();
    document.getElementById('recapTotal').textContent = total + '€';
    document.getElementById('recapAcompte').textContent = acompte + '€';

    // Ligne discount (visible uniquement si promo appliquée)
    const discRow = document.getElementById('recapDiscountRow');
    const discEl = document.getElementById('recapDiscount');
    const discCodeEl = document.getElementById('recapDiscountCode');
    if (discRow && discEl) {
      if (appliedPromo && discount > 0) {
        discEl.textContent = `−${discount}€`;
        if (discCodeEl) discCodeEl.textContent = appliedPromo.code;
        discRow.hidden = false;
      } else {
        discRow.hidden = true;
      }
    }

    // Label de l'acompte (change selon mode admin)
    const acompteLabel = document.getElementById('recapAcompteLabel');
    if (acompteLabel) {
      if (window.BK_ADMIN && adminPaymentMode === 'total') {
        acompteLabel.textContent = 'À régler en ligne (100%)';
      } else if (window.BK_ADMIN && adminPaymentMode === 'espece') {
        acompteLabel.textContent = 'À encaisser sur place (espèces)';
      } else {
        acompteLabel.textContent = 'Acompte à régler (15%)';
      }
    }

    const stripeBtn = document.getElementById('stripeBtn');
    if (stripeBtn) {
      let labelPrefix, amount;
      if (window.BK_ADMIN && adminPaymentMode === 'espece') {
        labelPrefix = 'Enregistrer la résa · espèces';
        amount = getTotalAfterDiscount(); // total entier, pas d'acompte
      } else {
        labelPrefix = window.BK_ADMIN ? 'Générer le lien Stripe' : 'Réserver mon lavage';
        amount = acompte;
      }
      stripeBtn.textContent = `${labelPrefix} · ${amount}€`;
    }

    // Affiche/masque le bloc "infos client" selon le mode de paiement admin
    const clientInfoBlock = document.getElementById('adminClientInfo');
    if (clientInfoBlock) {
      clientInfoBlock.classList.toggle('visible', window.BK_ADMIN && adminPaymentMode === 'espece');
    }
  }

  // ---- Code promo : toggle + application ----
  const promoToggle = document.getElementById('promoToggle');
  const promoForm = document.getElementById('promoForm');
  const promoInput = document.getElementById('promoInput');
  const promoApply = document.getElementById('promoApply');
  const promoFeedback = document.getElementById('promoFeedback');

  if (promoToggle && promoForm) {
    promoToggle.addEventListener('click', () => {
      const opening = promoForm.hidden;
      promoForm.hidden = !opening;
      promoToggle.classList.toggle('open', opening);
      if (opening && promoInput) setTimeout(() => promoInput.focus(), 50);
    });
  }

  const showPromoFeedback = (msg, type) => {
    if (!promoFeedback) return;
    promoFeedback.textContent = msg;
    promoFeedback.className = 'promo-feedback ' + (type === 'ok' ? 'ok' : 'err');
    promoFeedback.hidden = false;
  };

  const clearPromo = () => {
    appliedPromo = null;
    if (promoInput) promoInput.value = '';
    if (promoFeedback) promoFeedback.hidden = true;
  };

  async function applyPromo(codeArg) {
    const code = String((codeArg ?? promoInput?.value) || '').trim().toUpperCase();
    if (!code) {
      showPromoFeedback('Tapez un code avant de cliquer sur Appliquer.', 'err');
      return;
    }
    if (!promoApply) return;
    promoApply.disabled = true;
    const originalText = promoApply.textContent;
    promoApply.textContent = '…';
    try {
      const total = getTotal();
      const res = await fetch('/api/validate-promo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, total }),
      });
      const data = await res.json();
      if (data && data.valid) {
        appliedPromo = {
          code: data.code,
          type: data.type,
          value: data.value,
          discount: data.discount,
          stripePromotionCodeId: data.stripePromotionCodeId || null,
        };
        const label = data.type === 'percent' ? `−${data.value}%` : `−${data.value}€`;
        showPromoFeedback(`Code ${data.code} appliqué (${label}). Nouvel acompte recalculé.`, 'ok');
        updateRecap();
      } else {
        appliedPromo = null;
        showPromoFeedback((data && data.error) || 'Code promo invalide.', 'err');
        updateRecap();
      }
    } catch (err) {
      console.error('promo validation failed', err);
      showPromoFeedback('Erreur temporaire. Réessaie dans quelques secondes.', 'err');
    } finally {
      promoApply.disabled = false;
      promoApply.textContent = originalText;
    }
  }

  if (promoApply) promoApply.addEventListener('click', () => applyPromo());
  if (promoInput) {
    promoInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); applyPromo(); }
    });
  }

  // ---- Admin : prix manuel (override) — disponible uniquement sur /admin ----
  const adminOverrideToggle = document.getElementById('adminOverrideToggle');
  const adminOverrideForm = document.getElementById('adminOverrideForm');
  const adminOverrideInput = document.getElementById('adminOverrideInput');
  const adminOverrideApply = document.getElementById('adminOverrideApply');
  const adminOverrideReset = document.getElementById('adminOverrideReset');

  if (adminOverrideToggle && adminOverrideForm) {
    adminOverrideToggle.addEventListener('click', () => {
      const opening = adminOverrideForm.hidden;
      adminOverrideForm.hidden = !opening;
      adminOverrideToggle.classList.toggle('open', opening);
      if (opening && adminOverrideInput) {
        // Pré-remplir avec le total actuel si vide
        if (!adminOverrideInput.value) adminOverrideInput.value = getTotal();
        setTimeout(() => adminOverrideInput.focus(), 50);
      }
    });
  }
  if (adminOverrideApply && adminOverrideInput) {
    const apply = () => {
      const v = parseFloat(adminOverrideInput.value);
      if (!Number.isFinite(v) || v <= 0) {
        showValidationError(steps[5], 'Saisir un montant valide en euros pour le prix manuel.');
        return;
      }
      adminPriceOverride = v;
      updateRecap();
    };
    adminOverrideApply.addEventListener('click', apply);
    adminOverrideInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); apply(); }
    });
  }
  if (adminOverrideReset) {
    adminOverrideReset.addEventListener('click', () => {
      adminPriceOverride = null;
      if (adminOverrideInput) adminOverrideInput.value = '';
      updateRecap();
    });
  }

  // ---- Admin : toggle acompte / totalité ----
  document.querySelectorAll('.admin-pm-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.admin-pm-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      adminPaymentMode = btn.dataset.mode || 'acompte';
      updateRecap();
    });
  });

  // Stripe CTA → POST /api/create-checkout-session → redirect vers Stripe Checkout
  // Ou, en mode admin "espèces", → POST /api/create-manual-booking (sans Stripe)
  const stripeBtn = document.getElementById('stripeBtn');
  if (stripeBtn) {
    stripeBtn.addEventListener('click', async () => {
      if (stripeBtn.disabled) return;

      // Validation minimale avant de payer
      if (!selectedType || !selectedService || !selectedAddress || !selectedDate || !selectedSlot) {
        const missing = [];
        if (!selectedType) missing.push('type de véhicule');
        if (!selectedService) missing.push('formule');
        if (!selectedAddress) missing.push('adresse');
        if (!selectedDate || !selectedSlot) missing.push('date/créneau');
        showValidationError(steps[5], `Information manquante : ${missing.join(', ')}. Revenez en arrière pour compléter.`);
        return;
      }
      const total = getTotal();
      const acompte = getAcompte();
      if (!total || !acompte) {
        showValidationError(steps[5], 'Impossible de calculer le montant. Repassez par les étapes précédentes.');
        return;
      }

      // ============================================================
      // MODE ADMIN · ESPÈCES → endpoint dédié (pas de Stripe)
      // ============================================================
      if (window.BK_ADMIN && adminPaymentMode === 'espece') {
        const nameInput = document.getElementById('adminCustomerName');
        const phoneInput = document.getElementById('adminCustomerPhone');
        const emailInput = document.getElementById('adminCustomerEmail');
        const customerName = (nameInput?.value || '').trim();
        const customerPhone = (phoneInput?.value || '').trim();
        const customerEmail = (emailInput?.value || '').trim();

        if (!customerName || !customerPhone) {
          showValidationError(steps[5], 'Nom et téléphone du client obligatoires pour une résa espèces.');
          return;
        }

        const pwd = sessionStorage.getItem('bk_admin_pwd');
        if (!pwd) {
          showValidationError(steps[5], 'Session admin expirée. Reconnecte-toi.');
          return;
        }

        const dateStrCash = selectedDate instanceof Date
          ? `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`
          : String(selectedDate || '');

        const originalLabelCash = stripeBtn.textContent;
        stripeBtn.disabled = true;
        stripeBtn.textContent = 'Enregistrement…';

        try {
          const res = await fetch('/api/create-manual-booking', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-admin-password': pwd,
            },
            body: JSON.stringify({
              type: selectedType === 'custom' ? 'demande' : selectedType,
              service: selectedService === 'custom' ? 'devis' : selectedService,
              address: selectedAddress,
              date: dateStrCash,
              slot: selectedSlot,
              options: (selectedOptions || []).map(o => ({ name: o.name, price: o.price })),
              travelFee: selectedTravelFee,
              travelKm: selectedTravelKm,
              total: getTotalAfterDiscount(),
              customerName,
              customerEmail,
              customerPhone,
            }),
          });
          if (!res.ok) {
            const txt = await res.text();
            throw new Error(txt || 'Erreur serveur');
          }
          const data = await res.json();
          if (typeof window.showAdminManualSuccess === 'function') {
            window.showAdminManualSuccess(data);
          } else {
            alert('Résa enregistrée · ' + (data?.manualRef || ''));
          }
        } catch (err) {
          console.error('manual booking error', err);
          showValidationError(steps[5], 'Impossible d\'enregistrer la résa. ' + (err?.message || ''));
          stripeBtn.disabled = false;
          stripeBtn.textContent = originalLabelCash;
        }
        return;
      }

      const originalLabel = stripeBtn.textContent;
      stripeBtn.disabled = true;
      stripeBtn.textContent = 'Redirection vers le paiement…';

      try {
        // IMPORTANT : on formate la date avec les composantes LOCALES (Europe/Paris),
        // pas toISOString() qui convertit en UTC et décale d'un jour en arrière
        // (minuit Paris UTC+2 = 22h UTC la veille → toISOString().slice(0,10) = jour précédent).
        const dateStr = selectedDate instanceof Date
          ? `${selectedDate.getFullYear()}-${pad2(selectedDate.getMonth() + 1)}-${pad2(selectedDate.getDate())}`
          : String(selectedDate || '');

        const res = await fetch('/api/create-checkout-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: selectedType === 'custom' ? 'demande' : selectedType,
            service: selectedService === 'custom' ? 'devis' : selectedService,
            address: selectedAddress,
            date: dateStr,
            slot: selectedSlot,
            options: (selectedOptions || []).map(o => ({ name: o.name, price: o.price })),
            total: getTotal(),                          // prix brut (avant remise)
            totalAfterDiscount: getTotalAfterDiscount(), // prix après remise (base de l'acompte)
            discount: getDiscount(),
            promo: appliedPromo ? {
              code: appliedPromo.code,
              type: appliedPromo.type,
              value: appliedPromo.value,
              stripePromotionCodeId: appliedPromo.stripePromotionCodeId,
            } : null,
            acompte,
            travelFee: selectedTravelFee,
            travelKm: selectedTravelKm,
            // Mode admin → endpoint génère un Stripe Payment Link (URL courte buy.stripe.com)
            admin: !!window.BK_ADMIN,
            // Mode de paiement admin : acompte 15% ou totalité 100%
            paymentMode: window.BK_ADMIN ? adminPaymentMode : 'acompte',
            // Custom basket (mode admin demande spécifique) → line_items multiples sur Stripe
            // On expand chaque option en sa propre line_item pour que le client voie le détail
            customLineItems: selectedService === 'custom' ? (() => {
              const items = [];
              customBasket.forEach(it => {
                const baseName = (it.section === 'autre' ? (it.name || 'Prestation') : it.name)
                  + (it.detail ? ` · ${it.detail}` : '');
                if (it.price > 0) {
                  items.push({ name: baseName, type: it.section || it.type, price: it.price });
                }
                (it.options || []).forEach(o => {
                  if (o.price > 0) items.push({ name: `${baseName} — ${o.name}`, type: 'option', price: o.price });
                });
              });
              return items;
            })() : null,
          }),
        });

        if (!res.ok) {
          const txt = await res.text();
          throw new Error(txt || 'Erreur serveur');
        }
        const data = await res.json();
        if (!data.url) throw new Error('URL de paiement manquante');

        // Mode admin : on ouvre une modal avec le lien à copier au lieu de rediriger
        if (window.BK_ADMIN && typeof window.showAdminStripeLink === 'function') {
          window.showAdminStripeLink(data.url);
          stripeBtn.disabled = false;
          stripeBtn.textContent = originalLabel;
        } else {
          window.location.href = data.url;
        }
      } catch (err) {
        console.error('Stripe checkout error', err);
        showValidationError(steps[5], 'Impossible de lancer le paiement. Réessayez dans quelques secondes ou contactez-nous sur WhatsApp.');
        stripeBtn.disabled = false;
        stripeBtn.textContent = originalLabel;
      }
    });
  }

  // Mini FAQ Step 5
  document.querySelectorAll('.faq-mini-question').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-mini-item');
      const isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-mini-item').forEach(i => i.classList.remove('open'));
      if (!isOpen) item.classList.add('open');
    });
  });

  // ---- Calendar (sync Google Calendar via /api/availability) ----
  let calDate = new Date();
  calDate.setDate(1);

  // Cache par mois : { "2026-04": { slots, busySlots, fullDays } }
  const availabilityCache = {};
  // Fallback local si l'API échoue (pour pas bloquer le wizard)
  const FALLBACK_SLOTS = ['0h00', '2h30', '5h00', '7h30', '10h00', '12h30', '15h00', '17h30', '20h00', '22h30'];

  function pad2(n) { return String(n).padStart(2, '0'); }

  async function fetchAvailability(year, month) {
    const key = `${year}-${pad2(month)}`;
    if (availabilityCache[key]) return availabilityCache[key];
    try {
      const res = await fetch(`/api/availability?year=${year}&month=${month}`);
      if (!res.ok) throw new Error('availability fetch failed');
      const data = await res.json();
      availabilityCache[key] = data;
      return data;
    } catch (err) {
      console.warn('availability API error, fallback local:', err);
      const data = { slots: FALLBACK_SLOTS, busySlots: {}, fullDays: [] };
      availabilityCache[key] = data;
      return data;
    }
  }

  async function renderCalendar() {
    const label = document.getElementById('calMonthLabel');
    const grid = document.getElementById('calGrid');
    if (!label || !grid) return;

    const months = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
    label.textContent = `${months[calDate.getMonth()]} ${calDate.getFullYear()}`;

    const today = new Date();
    today.setHours(0,0,0,0);

    const year = calDate.getFullYear();
    const month = calDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startOffset = (firstDay === 0) ? 6 : firstDay - 1; // Monday first

    // Placeholder pendant le fetch
    grid.innerHTML = '<div class="cal-weekdays"><span>Lun</span><span>Mar</span><span>Mer</span><span>Jeu</span><span>Ven</span><span>Sam</span><span>Dim</span></div><div class="cal-days"><span class="cal-day empty"></span></div>';

    const avail = await fetchAvailability(year, month + 1);
    const fullDays = new Set(avail.fullDays || []);

    let html = '<div class="cal-weekdays"><span>Lun</span><span>Mar</span><span>Mer</span><span>Jeu</span><span>Ven</span><span>Sam</span><span>Dim</span></div>';
    html += '<div class="cal-days">';
    for (let i = 0; i < startOffset; i++) html += '<span class="cal-day empty"></span>';
    for (let d = 1; d <= daysInMonth; d++) {
      const thisDate = new Date(year, month, d);
      const isPast = thisDate < today;
      const dayKey = `${year}-${pad2(month + 1)}-${pad2(d)}`;
      const isFull = fullDays.has(dayKey);
      const isSelected = selectedDate && selectedDate.getDate() === d && selectedDate.getMonth() === month && selectedDate.getFullYear() === year;
      let cls = 'cal-day';
      if (isPast) cls += ' disabled';
      else if (isFull) cls += ' full';
      else cls += ' available';
      if (isSelected) cls += ' selected';
      html += `<button class="${cls}" data-day="${d}" data-month="${month}" data-year="${year}" ${(isPast || isFull) ? 'disabled' : ''}>${d}</button>`;
    }
    html += '</div>';
    grid.innerHTML = html;

    grid.querySelectorAll('.cal-day.available').forEach(btn => {
      btn.addEventListener('click', () => {
        grid.querySelectorAll('.cal-day').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedDate = new Date(parseInt(btn.dataset.year), parseInt(btn.dataset.month), parseInt(btn.dataset.day));
        showTimeSlots(selectedDate);
      });
    });

    document.getElementById('calSlots').style.display = 'none';
    selectedSlot = null;
  }

  async function showTimeSlots(date) {
    const slotsContainer = document.getElementById('calSlots');
    const slotsGrid = document.getElementById('calSlotsGrid');
    const slotDate = document.getElementById('calSlotDate');
    if (!slotsContainer || !slotsGrid) return;

    const days = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
    const months = ['jan','fév','mars','avr','mai','juin','juil','août','sep','oct','nov','déc'];
    slotDate.textContent = `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`;

    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const dayKey = `${year}-${pad2(month)}-${pad2(date.getDate())}`;

    const avail = await fetchAvailability(year, month);
    const slots = (avail && avail.slots && avail.slots.length) ? avail.slots : FALLBACK_SLOTS;
    const takenSet = new Set((avail.busySlots && avail.busySlots[dayKey]) || []);

    slotsGrid.innerHTML = slots.map(s => {
      const taken = takenSet.has(s);
      return `<button class="cal-slot${taken ? ' taken' : ''}" data-slot="${s}" ${taken ? 'disabled' : ''}>${s}${taken ? '<span>Complet</span>' : ''}</button>`;
    }).join('');

    slotsGrid.querySelectorAll('.cal-slot:not(.taken)').forEach(btn => {
      btn.addEventListener('click', () => {
        slotsGrid.querySelectorAll('.cal-slot').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedSlot = btn.dataset.slot;
        updateRecap();
      });
    });

    slotsContainer.style.display = '';
  }

  document.getElementById('calPrev')?.addEventListener('click', () => {
    calDate.setMonth(calDate.getMonth() - 1);
    renderCalendar();
  });
  document.getElementById('calNext')?.addEventListener('click', () => {
    calDate.setMonth(calDate.getMonth() + 1);
    renderCalendar();
  });

  /* ---- Reviews : marquee CSS continue, plus de carousel JS ---- */

  /* ---- FAQ accordion ---- */
  document.querySelectorAll('.faq-question').forEach(btn => {
    btn.addEventListener('click', () => {
      const isOpen = btn.getAttribute('aria-expanded') === 'true';
      document.querySelectorAll('.faq-question').forEach(b => {
        b.setAttribute('aria-expanded', 'false');
        b.nextElementSibling.classList.remove('open');
      });
      if (!isOpen) {
        btn.setAttribute('aria-expanded', 'true');
        btn.nextElementSibling.classList.add('open');
      }
    });
  });

  /* ---- Smooth anchor scroll ---- */
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const target = document.querySelector(a.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - 90, behavior: 'smooth' });
    });
  });

  /* ---- Leaflet map ---- */
  const mapEl = document.getElementById('leafletMap');
  if (mapEl && typeof L !== 'undefined') {
    const NIMES = [43.8367, 4.3601];
    const RADIUS_KM = 20;

    const map = L.map('leafletMap', {
      center: NIMES,
      zoom: 10,
      scrollWheelZoom: false,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(map);

    // Zone circle
    L.circle(NIMES, {
      radius: RADIUS_KM * 1000,
      color: '#D4AF37',
      weight: 2,
      fillColor: '#D4AF37',
      fillOpacity: 0.08,
    }).addTo(map);

    // Centre marker
    L.circleMarker(NIMES, {
      radius: 7,
      color: '#0A0A0A',
      fillColor: '#D4AF37',
      fillOpacity: 1,
      weight: 2,
    }).addTo(map).bindPopup('<strong>BK Alpes Motors</strong><br>Annecy');
  }

  /* ---- Address autocomplete (Photon by Komoot) ---- */
  function initAutocomplete(inputEl, { onSelect } = {}) {
    let dropdown = null;
    let timer = null;
    let activeIdx = -1;

    const removeDropdown = () => {
      if (dropdown) { dropdown.remove(); dropdown = null; }
      activeIdx = -1;
    };

    const formatLabel = (p) => {
      const main = [p.housenumber, p.street].filter(Boolean).join(' ') || p.name || '';
      const sub = [p.postcode, p.city || p.town || p.village].filter(Boolean).join(' ');
      return { main, sub };
    };

    const showDropdown = (features) => {
      removeDropdown();
      if (!features.length) return;

      dropdown = document.createElement('ul');
      dropdown.className = 'autocomplete-dropdown';

      const escapeHtml = (s) => String(s).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      })[c]);
      features.forEach((f, i) => {
        const p = f.properties;
        const { main, sub } = formatLabel(p);
        const li = document.createElement('li');
        li.className = 'autocomplete-item';
        // Escape user-controlled strings (data from external Photon/OSM) to prevent XSS
        const safeMain = escapeHtml(main || sub || '');
        const safeSub = escapeHtml(sub || '');
        li.innerHTML = `<span class="ac-icon">📍</span><span class="ac-info"><span class="ac-main">${safeMain}</span>${sub && main ? `<span class="ac-sub">${safeSub}</span>` : ''}</span>`;
        li.addEventListener('mousedown', (e) => {
          e.preventDefault();
          const fullLabel = [main, sub].filter(Boolean).join(', ');
          inputEl.value = fullLabel;
          removeDropdown();
          if (onSelect) onSelect({
            label: fullLabel,
            lat: f.geometry.coordinates[1],
            lon: f.geometry.coordinates[0],
          });
        });
        dropdown.appendChild(li);
      });

      const wrap = inputEl.closest('.fg') || inputEl.parentElement;
      wrap.style.position = 'relative';
      wrap.appendChild(dropdown);
    };

    const setActive = (idx) => {
      if (!dropdown) return;
      const items = dropdown.querySelectorAll('.autocomplete-item');
      items.forEach(el => el.classList.remove('ac-active'));
      activeIdx = Math.max(-1, Math.min(idx, items.length - 1));
      if (activeIdx >= 0) items[activeIdx].classList.add('ac-active');
    };

    inputEl.addEventListener('input', () => {
      const q = inputEl.value.trim();
      clearTimeout(timer);
      if (q.length < 3) { removeDropdown(); return; }
      timer = setTimeout(async () => {
        try {
          const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&lang=fr&limit=5&bbox=1.0,42.5,8.5,47.0`;
          const res = await fetch(url);
          const data = await res.json();
          showDropdown(data.features || []);
        } catch { removeDropdown(); }
      }, 260);
    });

    inputEl.addEventListener('keydown', (e) => {
      if (!dropdown) return;
      const items = dropdown.querySelectorAll('.autocomplete-item');
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive(activeIdx + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(activeIdx - 1); }
      else if (e.key === 'Enter' && activeIdx >= 0) {
        e.preventDefault();
        items[activeIdx]?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      } else if (e.key === 'Escape') removeDropdown();
    });

    inputEl.addEventListener('blur', () => setTimeout(removeDropdown, 180));
  }

  /* ---- Zone address checker ---- */
  const checkBtn = document.getElementById('checkBtn');
  const checkInput = document.getElementById('checkAddress');
  const checkResult = document.getElementById('checkResult');

  function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  async function checkAddress() {
    const address = checkInput.value.trim();
    if (!address) return;

    checkBtn.disabled = true;
    checkBtn.textContent = '...';
    checkResult.style.display = 'none';
    checkResult.className = 'check-result';

    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address + ', France')}&limit=1&countrycodes=fr`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'fr' } });
      const data = await res.json();

      if (!data.length) {
        checkResult.className = 'check-result error';
        checkResult.textContent = 'Adresse introuvable. Essayez d\'être plus précis (ex: "15 rue de la Paix, Annecy").';
        checkResult.style.display = 'block';
        return;
      }

      const lat = parseFloat(data[0].lat);
      const lon = parseFloat(data[0].lon);
      const dist = haversineKm(43.8367, 4.3601, lat, lon);
      const distRounded = Math.round(dist * 10) / 10;

      if (dist <= FREE_ZONE_KM) {
        checkResult.className = 'check-result in-zone';
        checkResult.innerHTML = `Vous êtes à <strong>${distRounded} km</strong> d'Annecy, dans notre zone de déplacement gratuit.`;
      } else {
        const extra = Math.round((dist - FREE_ZONE_KM) * 10) / 10;
        const fee = Math.round(extra * KM_RATE);
        checkResult.className = 'check-result out-zone';
        checkResult.innerHTML = `Vous êtes à <strong>${distRounded} km</strong> d'Annecy, soit <strong>${extra} km</strong> hors zone. Frais de déplacement estimés : <strong>+${fee}€</strong>.<br><span class="out-zone-cta">Vous nous aimez trop pour qu'on vous abandonne. <a href="#reserver">Réserver avec frais de déplacement →</a></span>`;
      }
      checkResult.style.display = 'block';
    } catch (err) {
      checkResult.className = 'check-result error';
      checkResult.textContent = 'Impossible de vérifier l\'adresse. Vérifiez votre connexion.';
      checkResult.style.display = 'block';
    } finally {
      checkBtn.disabled = false;
      checkBtn.textContent = 'Vérifier';
    }
  }

  if (checkBtn) {
    checkBtn.addEventListener('click', checkAddress);
    checkInput && checkInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); checkAddress(); }
    });
  }

  // Autocomplete on zone checker — auto-run check on pick
  if (checkInput) {
    initAutocomplete(checkInput, {
      onSelect: (item) => {
        checkInput.value = item.label;
        checkAddress();
      }
    });
  }

  // Autocomplete on wizard address input — store coords to skip re-geocoding
  if (addressInput) {
    initAutocomplete(addressInput, {
      onSelect: (item) => {
        selectedAddress = item.label;
        selectedAddressCoords = { lat: item.lat, lon: item.lon };
        checkS4Valid();
      }
    });
  }

  // =============================================================
  // URL PARAMS — pré-remplissage du wizard depuis un lien WhatsApp
  // =============================================================
  // Exemple d'URL :
  //   /reserver?pack=prestige&vehicule=suv&date=2026-04-17&slot=18:00&adresse=10%20rue%20X%20Nimes&promo=AMI25
  // Valeurs acceptées :
  //   pack      : confort | prestige | devis | canape
  //   vehicule  : citadine | berline | suv | premium | utilitaire | moto | scooter | canape | tapis-matelas
  //   date      : YYYY-MM-DD
  //   slot      : HH:MM
  //   adresse   : string libre
  //   promo     : code promo (sera validé côté serveur)
  //   total     : optionnel, pour les forfaits sur devis (devis, canape)
  (async function applyUrlParams() {
    const params = new URLSearchParams(window.location.search);
    if (params.toString() === '') return;

    const pack = (params.get('pack') || '').toLowerCase();
    const vehicule = (params.get('vehicule') || params.get('type') || '').toLowerCase();
    const dateStr = params.get('date') || '';
    const slot = params.get('slot') || '';
    const adresse = params.get('adresse') || params.get('address') || '';
    const promoCode = params.get('promo') || '';
    const overrideTotal = Number(params.get('total'));

    // Mapping pack → service + base price
    const packMap = {
      confort:   { service: 'confort',    base: 80,  category: 'auto' },
      prestige:  { service: 'concession', base: 119, category: 'auto' },
      concession:{ service: 'concession', base: 119, category: 'auto' },
      devis:     { service: 'devis',      base: 0,   category: 'auto' },
      canape:    { service: 'canape',     base: 0,   category: 'service' },
    };
    const p = packMap[pack];
    if (!p) return; // rien de pré-rempli si pas de pack valide

    selectedCategory = p.category;
    selectedService = p.service;
    selectedBasePrice = p.base;
    if (Number.isFinite(overrideTotal) && overrideTotal > 0) {
      selectedBasePrice = overrideTotal;
    }

    // Véhicule
    const vehicleAllowed = ['citadine','berline','suv','premium','utilitaire','moto','scooter','canape','tapis-matelas','demande'];
    if (vehicule && vehicleAllowed.includes(vehicule)) {
      selectedType = vehicule;
      // Surcharge Berline/SUV/Sportive (aligné sur la nouvelle grille)
      const surcharges = { berline: 15, suv: 30, premium: 40, utilitaire: 25 };
      selectedSurcharge = surcharges[vehicule] || 0;
    }

    // Date
    if (dateStr) {
      const d = new Date(dateStr + 'T00:00:00');
      if (!isNaN(d.getTime())) selectedDate = d;
    }
    if (slot) selectedSlot = slot;
    if (adresse) selectedAddress = adresse;

    // Marquer toutes les étapes précédentes comme "done" et sauter direct à l'étape 5
    for (let i = 0; i < 4; i++) {
      dots[i].classList.remove('active');
      dots[i].classList.add('done');
    }
    // Navigate to step 5 directly
    steps[currentStep].classList.remove('active');
    dots[currentStep - 1].classList.remove('active');
    currentStep = 5;
    steps[5].classList.add('active');
    dots[4].classList.add('active');
    fill.style.width = '100%';
    const wrap = document.getElementById('reserver');
    if (wrap) wrap.dataset.step = '5';

    updateRecap();

    // Si un code promo est passé, on tente de l'appliquer automatiquement
    if (promoCode) {
      if (promoForm) { promoForm.hidden = false; promoToggle && promoToggle.classList.add('open'); }
      if (promoInput) promoInput.value = promoCode.toUpperCase();
      try { await applyPromo(promoCode); } catch (e) { /* silent */ }
    }

    // Scroll sur le wizard
    setTimeout(() => {
      wrap?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  })();

});

// ---- Marquee vidéos : auto-détection des fichiers dans /videos/ ----
// Appelle /api/videos-list pour récupérer la liste, construit les cartes,
// duplique le contenu pour la boucle infinie, puis force l'autoplay muted.
(async function buildVideosMarquee() {
  const track = document.getElementById('vidcaroTrack');
  if (!track) return;

  // Fallback gradients si aucune vidéo (les cartes restent visibles avec dégradé)
  const FALLBACK_CLASSES = ['vt1', 'vt2', 'vt3', 'vt4', 'vt5'];

  let videos = [];
  try {
    const res = await fetch('/api/videos-list', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.videos)) videos = data.videos;
    }
  } catch (e) { /* silencieux */ }

  // Si aucune vidéo trouvée → on met 6 cartes dégradé pour que la section reste jolie
  if (videos.length === 0) {
    videos = FALLBACK_CLASSES.concat(['vt1']).map((_, i) => ({ src: null, name: 'placeholder-' + i }));
  }

  // Mélange aléatoire (Fisher-Yates) : ordre différent à chaque chargement de la page
  for (let i = videos.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [videos[i], videos[j]] = [videos[j], videos[i]];
  }

  function buildCard(v, i) {
    const card = document.createElement('div');
    card.className = 'vidc ' + FALLBACK_CLASSES[i % FALLBACK_CLASSES.length];
    if (v.src) {
      const video = document.createElement('video');
      // IMPORTANT iOS : muted + playsinline DOIVENT être en attributs
      // (et muted doit être mis AVANT le src) sinon Safari bloque l'autoplay.
      video.muted = true;
      video.defaultMuted = true;
      video.setAttribute('muted', '');
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', '');
      video.setAttribute('autoplay', '');
      video.setAttribute('loop', '');
      video.autoplay = true;
      video.loop = true;
      video.playsInline = true;
      video.disableRemotePlayback = true;
      video.preload = 'auto';
      video.src = v.src;
      video.addEventListener('error', () => { video.style.display = 'none'; });
      card.appendChild(video);
    }
    return card;
  }

  // Groupe 1
  videos.forEach((v, i) => track.appendChild(buildCard(v, i)));
  // Groupe 2 (duplicata pour boucle marquee sans saccade)
  videos.forEach((v, i) => {
    const card = buildCard(v, i);
    card.setAttribute('aria-hidden', 'true');
    track.appendChild(card);
  });

  // Force play() — iOS bloque parfois l'autoplay attribute, on retente à plusieurs moments
  const allVideos = track.querySelectorAll('video');
  const tryPlayAll = () => {
    allVideos.forEach(v => {
      if (v.paused) v.play().catch(() => {});
    });
  };
  allVideos.forEach(v => {
    const tryPlay = () => { v.play().catch(() => {}); };
    if (v.readyState >= 2) tryPlay();
    else {
      v.addEventListener('loadeddata', tryPlay, { once: true });
      v.addEventListener('canplay', tryPlay, { once: true });
    }
  });
  // Fallback iOS : reprise sur 1ère interaction utilisateur (touch/click/scroll)
  const resume = () => {
    tryPlayAll();
    ['touchstart', 'click', 'scroll'].forEach(ev => window.removeEventListener(ev, resume));
  };
  ['touchstart', 'click', 'scroll'].forEach(ev =>
    window.addEventListener(ev, resume, { once: true, passive: true })
  );
  // Relance quand la page redevient visible (onglet, retour d'arrière-plan iOS)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) tryPlayAll();
  });

  // ---- Flèches mobile : scroll horizontal manuel ----
  const prevBtn = document.getElementById('vidcaroPrevMobile');
  const nextBtn = document.getElementById('vidcaroNextMobile');
  const wrap = track.parentElement; // .vidcaro-marquee-wrap = conteneur scrollable sur mobile
  if (prevBtn && nextBtn && wrap) {
    const getStep = () => {
      const firstCard = track.querySelector('.vidc');
      if (!firstCard) return 200;
      const gap = parseInt(getComputedStyle(track).gap, 10) || 12;
      return firstCard.offsetWidth + gap;
    };
    prevBtn.addEventListener('click', () => {
      wrap.scrollBy({ left: -getStep(), behavior: 'smooth' });
    });
    nextBtn.addEventListener('click', () => {
      wrap.scrollBy({ left: getStep(), behavior: 'smooth' });
    });
    // Quand l'utilisateur swipe ou clique une flèche, on (re)tente de jouer la vidéo visible
    wrap.addEventListener('scroll', () => {
      clearTimeout(wrap._playTimer);
      wrap._playTimer = setTimeout(() => {
        const wrapRect = wrap.getBoundingClientRect();
        const center = wrapRect.left + wrapRect.width / 2;
        allVideos.forEach(v => {
          const r = v.getBoundingClientRect();
          if (r.left < center && r.right > center && v.paused) {
            v.play().catch(() => {});
          }
        });
      }, 120);
    }, { passive: true });
    // Tap sur une vidéo = tentative de lecture (gesture utilisateur iOS)
    allVideos.forEach(v => {
      v.addEventListener('click', () => {
        if (v.paused) v.play().catch(() => {});
      });
    });
  }
})();



/* ---- Hearts on review card hover ---- */
(function() {
  const emojis = ['❤️', '🩷', '💕', '💗', '🫶'];
  const intervals = new WeakMap();

  function spawnCardHeart(card) {
    const h = document.createElement('span');
    h.className = 'review-card-heart';
    h.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    h.style.fontSize = (0.9 + Math.random() * 0.7) + 'rem';
    h.style.animationDuration = (0.9 + Math.random() * 0.7) + 's';

    // Pick a random edge and position along it
    const edge = Math.floor(Math.random() * 4);
    const pct = Math.random() * 70 + 15;
    const spread = (Math.random() - 0.5) * 30;
    if (edge === 0) { // top
      h.style.top = '-14px'; h.style.left = pct + '%';
      h.style.setProperty('--hx', spread + 'px'); h.style.setProperty('--hy', '-45px');
    } else if (edge === 1) { // right
      h.style.right = '-14px'; h.style.top = pct + '%';
      h.style.setProperty('--hx', '45px'); h.style.setProperty('--hy', spread + 'px');
    } else if (edge === 2) { // bottom
      h.style.bottom = '-14px'; h.style.left = pct + '%';
      h.style.setProperty('--hx', spread + 'px'); h.style.setProperty('--hy', '45px');
    } else { // left
      h.style.left = '-14px'; h.style.top = pct + '%';
      h.style.setProperty('--hx', '-45px'); h.style.setProperty('--hy', spread + 'px');
    }

    card.appendChild(h);
    setTimeout(() => h.remove(), 1600);
  }

  document.querySelectorAll('.review-card').forEach(card => {
    card.addEventListener('mouseenter', () => {
      spawnCardHeart(card);
      const iv = setInterval(() => spawnCardHeart(card), 220);
      intervals.set(card, iv);
    });
    card.addEventListener('mouseleave', () => {
      clearInterval(intervals.get(card));
      intervals.delete(card);
    });
  });
})();

/* ---- Vehicle type filter on pricing cards ---- */
(function() {
  const prices = {
    citadine: { confort: 80,  prestige: 119 },
    berline:  { confort: 95,  prestige: 134 },
    suv:      { confort: 110, prestige: 149 },
    sport:    { confort: 120, prestige: 159 },
  };

  function setPrice(elId, value) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.classList.add('price-updating');
    setTimeout(() => {
      el.innerHTML = `${value}<sup>€</sup>`;
      el.classList.remove('price-updating');
    }, 150);
  }

  document.querySelectorAll('.vf-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.vf-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const p = prices[btn.dataset.vehicle];
      setPrice('priceConfort', p.confort);
      setPrice('pricePrestige', p.prestige);
    });
  });
})();

/* ---- Floating hearts around "chouchoutée" ---- */
(function spawnHearts() {
  const container = document.querySelector('.chouchouter-hearts');
  if (!container) return;
  const hearts = ['🫧', '🧼', '🫧', '🫧', '🧼', '🫧'];
  setInterval(() => {
    const h = document.createElement('span');
    h.className = 'chouchouter-heart';
    h.textContent = hearts[Math.floor(Math.random() * hearts.length)];
    h.style.left = (Math.random() * 105 - 2) + '%';
    h.style.top  = (Math.random() * 80 + 10) + '%';
    h.style.fontSize = (1.4 + Math.random() * 1.2) + 'rem';
    h.style.animationDuration = (1.2 + Math.random() * 1.2) + 's';
    container.appendChild(h);
    setTimeout(() => h.remove(), 2500);
  }, 350);
})();

/* ========== Channels switcher — tabs + phone preview ========== */
(function initChannelsSwitcher() {
  const root = document.querySelector('[data-channels-switcher]');
  if (!root) return;
  const tabs = root.querySelectorAll('.channel-tab[data-channel]');
  const panels = root.querySelectorAll('.channel-panel[data-channel-panel]');
  if (!tabs.length || !panels.length) return;

  function activate(key) {
    tabs.forEach((t) => {
      const on = t.dataset.channel === key;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    panels.forEach((p) => {
      const on = p.dataset.channelPanel === key;
      p.classList.toggle('is-active', on);
      if (on) p.scrollTop = 0;
    });
  }

  tabs.forEach((t) => t.addEventListener('click', () => activate(t.dataset.channel)));

  // Keyboard nav (↑↓)
  root.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const active = [...tabs].findIndex((t) => t.classList.contains('is-active'));
    if (active < 0) return;
    const next = e.key === 'ArrowDown'
      ? Math.min(tabs.length - 1, active + 1)
      : Math.max(0, active - 1);
    tabs[next].focus();
    activate(tabs[next].dataset.channel);
    e.preventDefault();
  });
})();

/* ========== Before/After slider (partagé) ========== */
function initBeforeAfterSlider(ba) {
  if (!ba || ba.dataset.baInited === '1') return;
  ba.dataset.baInited = '1';
  let dragging = false;

  function setPos(clientX) {
    const rect = ba.getBoundingClientRect();
    const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    ba.style.setProperty('--pos', pct + '%');
  }
  function onDown(e) {
    dragging = true;
    ba.classList.add('is-dragging');
    const x = (e.touches ? e.touches[0].clientX : e.clientX);
    setPos(x);
    e.preventDefault();
  }
  function onMove(e) {
    if (!dragging) return;
    const x = (e.touches ? e.touches[0].clientX : e.clientX);
    setPos(x);
  }
  function onUp() { dragging = false; ba.classList.remove('is-dragging'); }

  ba.addEventListener('mousedown', onDown);
  ba.addEventListener('touchstart', onDown, { passive: false });
  window.addEventListener('mousemove', onMove);
  window.addEventListener('touchmove', onMove, { passive: true });
  window.addEventListener('mouseup', onUp);
  window.addEventListener('touchend', onUp);
}

/* ========== Instagram — carrousel avant/après ========== */
(function initIgCarousel() {
  const carousels = document.querySelectorAll('[data-ig-carousel]');

  carousels.forEach((carousel) => {
    const track = carousel.querySelector('[data-ig-track]');
    const slides = carousel.querySelectorAll('[data-ig-slide]');
    const dots = carousel.querySelectorAll('[data-ig-dots] .ig-dot');
    const prev = carousel.querySelector('[data-ig-prev]');
    const next = carousel.querySelector('[data-ig-next]');
    let index = 0;

    function goTo(i) {
      index = Math.max(0, Math.min(slides.length - 1, i));
      if (track) track.style.transform = `translateX(-${index * 100}%)`;
      dots.forEach((d, di) => d.classList.toggle('is-active', di === index));
      if (prev) prev.toggleAttribute('disabled', index === 0);
      if (next) next.toggleAttribute('disabled', index === slides.length - 1);
    }
    goTo(0);

    prev && prev.addEventListener('click', () => goTo(index - 1));
    next && next.addEventListener('click', () => goTo(index + 1));
    dots.forEach((d, di) => d.addEventListener('click', () => goTo(di)));

    let touchStartX = null, touchStartY = null;
    carousel.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      touchStartX = t.clientX; touchStartY = t.clientY;
    }, { passive: true });
    carousel.addEventListener('touchend', (e) => {
      if (touchStartX === null) return;
      const dx = (e.changedTouches[0].clientX - touchStartX);
      const dy = (e.changedTouches[0].clientY - touchStartY);
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) goTo(index + 1); else goTo(index - 1);
      }
      touchStartX = touchStartY = null;
    });

    carousel.querySelectorAll('[data-ig-ba]').forEach(initBeforeAfterSlider);
  });
})();

/* ========== Before/After cards (standalone, hors carrousel) ========== */
(function initStandaloneBA() {
  document.querySelectorAll('[data-ig-ba]').forEach((ba) => {
    if (ba.closest('[data-ig-carousel]')) return;
    initBeforeAfterSlider(ba);
  });
})();
