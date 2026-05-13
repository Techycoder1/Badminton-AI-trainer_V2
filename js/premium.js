/* ============================================================
   SHUTTLESTEPZ PREMIUM — premium.js
   Animations · Canvas · Billing Toggle · Modal · FAQ
============================================================ */

/* ============================================================
   CANVAS: Animated Shuttle Particle Background
============================================================ */
(function initCanvas() {
  const canvas = document.getElementById('bgCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let W, H, particles = [], lines = [];
  const SHUTTLE = '🏸';
  const COLORS = ['rgba(0,212,255,', 'rgba(168,85,247,', 'rgba(52,211,153,', 'rgba(251,191,36,'];

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  // Particle class
  class Particle {
    constructor() { this.reset(); }
    reset() {
      this.x = Math.random() * W;
      this.y = Math.random() * H;
      this.vx = (Math.random() - 0.5) * 0.6;
      this.vy = (Math.random() - 0.5) * 0.6;
      this.alpha = Math.random() * 0.4 + 0.1;
      this.radius = Math.random() * 2 + 1;
      this.color = COLORS[Math.floor(Math.random() * COLORS.length)];
      this.pulse = Math.random() * Math.PI * 2;
    }
    update() {
      this.x += this.vx;
      this.y += this.vy;
      this.pulse += 0.02;
      if (this.x < 0 || this.x > W || this.y < 0 || this.y > H) this.reset();
    }
    draw() {
      const a = this.alpha * (0.7 + 0.3 * Math.sin(this.pulse));
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = this.color + a + ')';
      ctx.fill();
    }
  }

  // Shuttle-shaped tracers
  class ShuttleTracer {
    constructor() { this.reset(); }
    reset() {
      this.x = Math.random() * W;
      this.y = -50;
      this.speed = Math.random() * 1.5 + 0.5;
      this.angle = Math.random() * 0.4 - 0.2;
      this.alpha = Math.random() * 0.3 + 0.1;
      this.size = Math.random() * 14 + 8;
      this.trail = [];
      this.color = COLORS[Math.floor(Math.random() * COLORS.length)];
    }
    update() {
      this.trail.push({ x: this.x, y: this.y });
      if (this.trail.length > 12) this.trail.shift();
      this.x += Math.sin(this.angle) * this.speed;
      this.y += this.speed;
      if (this.y > H + 50) this.reset();
    }
    draw() {
      // Draw trail
      for (let i = 0; i < this.trail.length; i++) {
        const a = (i / this.trail.length) * this.alpha * 0.5;
        ctx.beginPath();
        ctx.arc(this.trail[i].x, this.trail[i].y, (i / this.trail.length) * 3, 0, Math.PI * 2);
        ctx.fillStyle = this.color + a + ')';
        ctx.fill();
      }
      // Draw shuttle glyph
      ctx.save();
      ctx.globalAlpha = this.alpha;
      ctx.font = `${this.size}px serif`;
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle + Math.PI / 4);
      ctx.fillText(SHUTTLE, -this.size / 2, this.size / 2);
      ctx.restore();
    }
  }

  // Init
  for (let i = 0; i < 80; i++) particles.push(new Particle());
  for (let i = 0; i < 8; i++) {
    const t = new ShuttleTracer();
    t.y = Math.random() * H; // distribute initially
    lines.push(t);
  }

  // Grid scan lines
  let scanY = 0;
  function drawGrid() {
    ctx.strokeStyle = 'rgba(0,212,255,0.03)';
    ctx.lineWidth = 1;
    const step = 60;
    for (let x = 0; x < W; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 0; y < H; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    // Moving scan line
    scanY = (scanY + 0.5) % H;
    const grad = ctx.createLinearGradient(0, scanY - 60, 0, scanY + 60);
    grad.addColorStop(0, 'rgba(0,212,255,0)');
    grad.addColorStop(0.5, 'rgba(0,212,255,0.04)');
    grad.addColorStop(1, 'rgba(0,212,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, scanY - 60, W, 120);
  }

  function animate() {
    ctx.clearRect(0, 0, W, H);
    drawGrid();
    particles.forEach(p => { p.update(); p.draw(); });
    lines.forEach(l => { l.update(); l.draw(); });

    // Draw connection lines between close particles
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 100) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(0,212,255,${0.06 * (1 - dist / 100)})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }
    requestAnimationFrame(animate);
  }
  animate();
})();

/* ============================================================
   NAV: Scroll effect
============================================================ */
window.addEventListener('scroll', () => {
  const nav = document.getElementById('nav');
  if (nav) {
    nav.classList.toggle('scrolled', window.scrollY > 40);
  }
});

/* ============================================================
   HAMBURGER MENU
============================================================ */
const hamburger = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobileMenu');
if (hamburger && mobileMenu) {
  hamburger.addEventListener('click', () => {
    mobileMenu.classList.toggle('open');
  });
}
function closeMobileMenu() {
  if (mobileMenu) mobileMenu.classList.remove('open');
}

/* ============================================================
   SMOOTH SCROLL
============================================================ */
function scrollTo(selector) {
  const el = document.querySelector(selector);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ============================================================
   ANIMATED COUNTERS
============================================================ */
function animateCounter(el) {
  const target = parseInt(el.dataset.target, 10);
  const duration = 2000;
  const start = performance.now();
  function update(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.floor(eased * target).toLocaleString();
    if (progress < 1) requestAnimationFrame(update);
    else el.textContent = target.toLocaleString();
  }
  requestAnimationFrame(update);
}

/* ============================================================
   SCROLL REVEAL + COUNTER TRIGGER
============================================================ */
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.15 });

const counterObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.querySelectorAll('[data-target]').forEach(animateCounter);
      counterObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.3 });

// Add reveal to elements
document.addEventListener('DOMContentLoaded', () => {
  // Sections
  document.querySelectorAll('.features, .pricing, .compare, .testimonials, .faq, .leaderboard-section, .final-cta').forEach(el => {
    el.classList.add('reveal');
    revealObserver.observe(el);
  });

  // Feature cards with stagger
  document.querySelectorAll('.feat-card').forEach((card, i) => {
    card.style.transitionDelay = `${i * 80}ms`;
    revealObserver.observe(card);
  });

  // Testimonial cards
  document.querySelectorAll('.testi-card').forEach((card, i) => {
    card.style.transitionDelay = `${i * 100}ms`;
    card.classList.add('reveal');
    revealObserver.observe(card);
  });

  // Pricing cards
  document.querySelectorAll('.price-card').forEach((card, i) => {
    card.style.transitionDelay = `${i * 120}ms`;
    card.classList.add('reveal');
    revealObserver.observe(card);
  });

  // Counter observer
  const heroStats = document.querySelector('.hero-stats');
  if (heroStats) counterObserver.observe(heroStats);

  // Leaderboard bar animation
  const lbObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        // Bars already have widths set; CSS transition handles animation
        lbObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.3 });
  const lb = document.querySelector('.leaderboard-card');
  if (lb) lbObserver.observe(lb);
});

/* ============================================================
   BILLING TOGGLE
============================================================ */
const PRICES = {
  student: { monthly: 199, annual: 159 },
  coach:   { monthly: 399, annual: 319 },
  school:  { monthly: 799, annual: 639 },
};

function toggleBilling() {
  const isAnnual = document.getElementById('billingToggle').checked;
  const mode = isAnnual ? 'annual' : 'monthly';

  ['student', 'coach', 'school'].forEach(plan => {
    const el = document.getElementById(`price-${plan}`);
    const note = document.getElementById(`note-${plan}`);
    if (!el) return;

    // Animate number change
    const current = parseInt(el.textContent, 10);
    const target = PRICES[plan][mode];
    animateNumberChange(el, current, target);

    if (note) {
      if (isAnnual) {
        const annualTotal = (target * 12).toLocaleString();
        note.textContent = `Billed as ₹${annualTotal}/year`;
        note.style.display = 'block';
      } else {
        note.style.display = 'none';
      }
    }
  });

  // Update modal plan sub if open
  updateModalPrice();
}

function animateNumberChange(el, from, to) {
  const duration = 400;
  const start = performance.now();
  function update(now) {
    const t = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 2);
    el.textContent = Math.round(from + (to - from) * eased);
    if (t < 1) requestAnimationFrame(update);
    else el.textContent = to;
  }
  requestAnimationFrame(update);
}

/* ============================================================
   FAQ
============================================================ */
function toggleFaq(btn) {
  const item = btn.closest('.faq-item');
  const answer = item.querySelector('.faq-a');
  const icon = btn.querySelector('.faq-icon');
  const isOpen = answer.classList.contains('open');

  // Close all
  document.querySelectorAll('.faq-a.open').forEach(a => a.classList.remove('open'));
  document.querySelectorAll('.faq-icon.rotated').forEach(i => i.classList.remove('rotated'));

  // Open clicked (if wasn't open)
  if (!isOpen) {
    answer.classList.add('open');
    icon.classList.add('rotated');
  }
}

/* ============================================================
   MODAL
============================================================ */
let currentPlan = 'student';

const PLAN_INFO = {
  student: {
    title: 'Start Your Free Trial',
    sub: '7 days free, then ₹199/month',
    name: 'Student Plan',
    price: '₹199/month',
  },
  coach: {
    title: 'Upgrade to Coach Plan',
    sub: '7 days free, then ₹399/month',
    name: 'Coach Plan',
    price: '₹399/month',
  },
  school: {
    title: 'Get Institution Access',
    sub: '7 days free, then ₹799/month',
    name: 'Institution Plan',
    price: '₹799/month',
  },
};

function openModal(plan) {
  currentPlan = plan || 'student';
  updateModalContent();
  // Reset to step 1
  showStep(1);
  document.getElementById('modalOverlay').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal(event) {
  if (event && event.target !== document.getElementById('modalOverlay')) return;
  document.getElementById('modalOverlay').classList.remove('active');
  document.body.style.overflow = '';
}

function updateModalContent() {
  const info = PLAN_INFO[currentPlan];
  if (!info) return;
  document.getElementById('modalPlanTitle').textContent = info.title;
  document.getElementById('modalPlanSub').textContent = info.sub;
  document.getElementById('mpcName').textContent = info.name;

  const isAnnual = document.getElementById('billingToggle').checked;
  const price = isAnnual
    ? `₹${PRICES[currentPlan].annual}/month (billed annually)`
    : info.price;
  document.getElementById('mpcPrice').textContent = price;

  const payBtn = document.getElementById('payBtnText');
  if (payBtn) payBtn.textContent = `Start Free Trial — ${isAnnual ? '₹' + PRICES[currentPlan].annual : info.price.replace('/month', '')}`;
}

function updateModalPrice() {
  if (document.getElementById('modalOverlay').classList.contains('active')) {
    updateModalContent();
  }
}

function showStep(n) {
  for (let i = 1; i <= 3; i++) {
    const el = document.getElementById(`step${i}`);
    if (el) el.classList.toggle('hidden', i !== n);
  }
}

function goStep2() {
  const email = document.getElementById('modalEmail');
  if (!email || !email.value || !email.value.includes('@')) {
    email.style.borderColor = '#f43f5e';
    email.focus();
    setTimeout(() => { email.style.borderColor = ''; }, 2000);
    return;
  }
  showStep(2);
}

function goStep3() {
  // Show loading state
  const btn = document.querySelector('#step2 .btn-primary');
  const btnText = document.getElementById('payBtnText');
  if (btn) btn.disabled = true;
  if (btnText) btnText.textContent = 'Processing…';

  setTimeout(() => {
    if (btn) btn.disabled = false;
    showStep(3);
    // Fire confetti-like particles
    fireCelebration();
  }, 1800);
}

/* Credit card formatter */
function formatCard(input) {
  let v = input.value.replace(/\D/g, '');
  v = v.match(/.{1,4}/g)?.join(' ') || v;
  input.value = v.substring(0, 19);
}

/* ============================================================
   CELEBRATION EFFECT
============================================================ */
function fireCelebration() {
  const emojis = ['🏸', '🎉', '⭐', '✨', '🏆', '🥇'];
  for (let i = 0; i < 20; i++) {
    setTimeout(() => {
      const span = document.createElement('span');
      span.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      span.style.cssText = `
        position: fixed;
        font-size: ${Math.random() * 20 + 14}px;
        left: ${Math.random() * 100}vw;
        top: -40px;
        z-index: 9999;
        pointer-events: none;
        animation: confettiFall ${Math.random() * 1.5 + 1}s ease-in forwards;
      `;
      document.body.appendChild(span);
      setTimeout(() => span.remove(), 2500);
    }, i * 80);
  }
}

// Inject confetti keyframes
const confettiStyle = document.createElement('style');
confettiStyle.textContent = `
  @keyframes confettiFall {
    to {
      transform: translateY(110vh) rotate(${Math.random() * 720}deg);
      opacity: 0;
    }
  }
`;
document.head.appendChild(confettiStyle);

/* ============================================================
   KEYBOARD: Close modal on ESC
============================================================ */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.getElementById('modalOverlay').classList.remove('active');
    document.body.style.overflow = '';
  }
});

/* ============================================================
   CARD SHINE EFFECT
============================================================ */
document.addEventListener('mousemove', (e) => {
  document.querySelectorAll('.feat-card, .price-card, .testi-card').forEach(card => {
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    card.style.setProperty('--mouse-x', `${x}px`);
    card.style.setProperty('--mouse-y', `${y}px`);
  });
});

// Add shine CSS dynamically
const shineStyle = document.createElement('style');
shineStyle.textContent = `
  .feat-card, .price-card, .testi-card {
    background-image: radial-gradient(
      circle 200px at var(--mouse-x, 50%) var(--mouse-y, 50%),
      rgba(255,255,255,0.03),
      transparent 80%
    );
  }
`;
document.head.appendChild(shineStyle);

/* ============================================================
   PRICING CARD TILT
============================================================ */
document.querySelectorAll('.price-card').forEach(card => {
  card.addEventListener('mousemove', (e) => {
    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    card.style.transform = `perspective(600px) rotateY(${x * 6}deg) rotateX(${-y * 6}deg) translateY(-8px)`;
  });
  card.addEventListener('mouseleave', () => {
    card.style.transform = '';
    card.style.transition = 'transform 0.5s ease';
    setTimeout(() => { card.style.transition = ''; }, 500);
  });
});

/* ============================================================
   INIT
============================================================ */
console.log('%c🏸 Shuttlestepz Premium loaded', 'color:#00d4ff;font-size:14px;font-weight:bold;');
export default PREMIUM
