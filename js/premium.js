/* ============================================================
   Shuttlestepz — premium.js
   Premium plan management, simulated payment flow,
   feature gating, and creator bypass system.
   ============================================================ */

/* ── Creator accounts (always get premium free) ────────────── */
const CREATOR_EMAILS = [
  'aaroh@shuttlestepz.com',   // ← add your real email here
  'techycoder1@gmail.com',    // ← add your real email here
]

/* ── Plan config ────────────────────────────────────────────── */
const PLANS = {
  free: {
    id           : 'free',
    name         : 'Free',
    price        : 0,
    sessionsDay  : 5,
    features     : [
      '5 training sessions/day',
      'Basic footwork drill',
      'Score history',
      'Global leaderboard',
    ],
    locked: [
      'Reaction Blitz',
      'Shadow Pro',
      'Elite Multi-Shuttle',
      'AI Coach Insights',
      'Advanced Analytics',
      'Heatmap',
    ],
  },
  premium: {
    id           : 'premium',
    name         : 'Premium',
    priceMonthly : 7,
    priceYearly  : 60,
    sessionsDay  : Infinity,
    features     : [
      'Unlimited training sessions',
      'All 6 training modes',
      'AI Coach Insights',
      'Advanced analytics & heatmap',
      'Footwork consistency score',
      'Priority leaderboard badge',
      'Export session data',
      'School/Coach panel access',
    ],
    locked: [],
  },
  school: {
    id           : 'school',
    name         : 'School',
    priceMonthly : 49,
    priceYearly  : 450,
    sessionsDay  : Infinity,
    features     : [
      'Everything in Premium',
      'Up to 50 student accounts',
      'Coach dashboard',
      'Class performance reports',
      'School leaderboard',
      'Attendance tracking',
      'Bulk invite links',
    ],
    locked: [],
  },
}

/* ── Premium features list (for gating) ────────────────────── */
const PREMIUM_FEATURES = {
  REACTION_BLITZ      : 'reaction_blitz',
  SHADOW_PRO          : 'shadow_pro',
  ELITE_MULTI         : 'elite_multi',
  AI_INSIGHTS         : 'ai_insights',
  ADVANCED_ANALYTICS  : 'advanced_analytics',
  HEATMAP             : 'heatmap',
  EXPORT_DATA         : 'export_data',
  SCHOOL_PANEL        : 'school_panel',
  UNLIMITED_SESSIONS  : 'unlimited_sessions',
}

/* ── PREMIUM MODULE ─────────────────────────────────────────── */
const PREMIUM = (() => {

  /* ── Check if email is creator ───────────────────────────── */
  function isCreator(email) {
    return CREATOR_EMAILS.includes((email || '').toLowerCase().trim())
  }

  /* ── Check if user has premium access ───────────────────── */
  function hasPremium(user) {
    if (!user) return false
    if (isCreator(user.email)) return true
    return user.plan === 'premium' || user.plan === 'school'
  }

  /* ── Check specific feature access ──────────────────────── */
  function canAccess(user, feature) {
    if (!user) return false
    if (isCreator(user.email)) return true
    if (hasPremium(user)) return true
    // Free features
    const freeFeatures = [
      'footwork', 'shadow', 'leaderboard', 'history', 'basic_analytics'
    ]
    return freeFeatures.includes(feature)
  }

  /* ── Sessions remaining today ────────────────────────────── */
  function sessionsRemaining(user) {
    if (!user) return 0
    if (hasPremium(user)) return Infinity
    const today = new Date().toDateString()
    if (user.lastSessionDay !== today) return PLANS.free.sessionsDay
    return Math.max(0, PLANS.free.sessionsDay - (user.sessionsToday || 0))
  }

  /* ── Show upgrade modal ──────────────────────────────────── */
  function showUpgradeModal(featureName = '') {
    const existing = document.getElementById('premium-modal')
    if (existing) existing.remove()

    const modal = document.createElement('div')
    modal.id    = 'premium-modal'
    modal.innerHTML = `
      <div class="pm-backdrop" id="pm-backdrop">
        <div class="pm-box">
          <button class="pm-close" id="pm-close">✕</button>

          <div class="pm-header">
            <div class="pm-crown">👑</div>
            <h2 class="pm-title">Unlock Premium</h2>
            <p class="pm-sub">
              ${featureName
                ? `<strong style="color:var(--accent)">${featureName}</strong> is a Premium feature.`
                : 'Get unlimited access to all training modes and analytics.'}
            </p>
          </div>

          <!-- Plan toggle -->
          <div class="pm-toggle">
            <button class="pm-tog active" id="tog-monthly" onclick="PREMIUM.toggleBilling('monthly')">Monthly</button>
            <button class="pm-tog" id="tog-yearly" onclick="PREMIUM.toggleBilling('yearly')">
              Yearly <span class="pm-save">Save 30%</span>
            </button>
          </div>

          <!-- Plan cards -->
          <div class="pm-cards">

            <div class="pm-card">
              <div class="pm-card-name">Free</div>
              <div class="pm-card-price">$0<span>/mo</span></div>
              <ul class="pm-features">
                <li>✓ 5 sessions/day</li>
                <li>✓ Basic footwork drill</li>
                <li>✓ Leaderboard</li>
                <li class="pm-locked">✗ AI Coach Insights</li>
                <li class="pm-locked">✗ Advanced Analytics</li>
                <li class="pm-locked">✗ All training modes</li>
              </ul>
              <button class="pm-btn pm-btn-ghost" disabled>Current Plan</button>
            </div>

            <div class="pm-card pm-card-highlight">
              <div class="pm-popular">MOST POPULAR</div>
              <div class="pm-card-name">Premium ⭐</div>
              <div class="pm-card-price" id="pm-price">$7<span>/mo</span></div>
              <ul class="pm-features">
                <li>✓ Unlimited sessions</li>
                <li>✓ All 6 training modes</li>
                <li>✓ AI Coach Insights</li>
                <li>✓ Advanced Analytics</li>
                <li>✓ Heatmap & consistency score</li>
                <li>✓ Priority leaderboard badge</li>
              </ul>
              <button class="pm-btn pm-btn-primary" onclick="PREMIUM.simulatePayment('premium')">
                Upgrade Now →
              </button>
            </div>

          </div>

          <p class="pm-note">🔒 Secure demo payment · No real card needed · Cancel anytime</p>
        </div>
      </div>`

    // Inject styles if not already present
    if (!document.getElementById('premium-styles')) {
      const style = document.createElement('style')
      style.id    = 'premium-styles'
      style.textContent = `
        .pm-backdrop {
          position:fixed;inset:0;background:rgba(0,0,0,0.8);
          z-index:999;display:flex;align-items:center;justify-content:center;
          padding:20px;backdrop-filter:blur(6px);animation:pmFadeIn .2s ease;
        }
        @keyframes pmFadeIn { from{opacity:0} to{opacity:1} }
        .pm-box {
          background:#0e1610;border:1px solid rgba(56,210,90,0.3);
          border-radius:20px;padding:36px;width:100%;max-width:600px;
          position:relative;animation:pmSlideUp .25s ease;
          max-height:90vh;overflow-y:auto;
        }
        @keyframes pmSlideUp { from{transform:translateY(24px);opacity:0} to{transform:translateY(0);opacity:1} }
        .pm-close {
          position:absolute;top:16px;right:16px;background:none;
          border:none;color:#6e9475;font-size:20px;cursor:pointer;
        }
        .pm-close:hover{color:#e2ede4}
        .pm-header{text-align:center;margin-bottom:24px}
        .pm-crown{font-size:40px;margin-bottom:8px}
        .pm-title{font-family:'Syne',sans-serif;font-size:26px;font-weight:800;
          color:#e2ede4;margin-bottom:8px}
        .pm-sub{font-size:14px;color:#6e9475;line-height:1.5}
        .pm-toggle{display:flex;gap:8px;justify-content:center;margin-bottom:24px}
        .pm-tog{padding:8px 20px;border-radius:8px;border:1px solid rgba(56,210,90,0.3);
          background:transparent;color:#6e9475;cursor:pointer;font-size:13px;
          font-family:'Syne',sans-serif;font-weight:600;transition:all .15s}
        .pm-tog.active{background:rgba(56,210,90,0.1);border-color:#38d25a;color:#38d25a}
        .pm-save{font-size:10px;background:#38d25a;color:#050908;
          padding:2px 6px;border-radius:4px;margin-left:6px}
        .pm-cards{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px}
        .pm-card{background:#111a13;border:1px solid rgba(56,210,90,0.12);
          border-radius:14px;padding:20px}
        .pm-card-highlight{border-color:#38d25a;background:linear-gradient(135deg,#111a13,rgba(56,210,90,0.05));
          position:relative}
        .pm-popular{position:absolute;top:-1px;left:50%;transform:translateX(-50%);
          background:#38d25a;color:#050908;font-size:9px;letter-spacing:2px;
          font-weight:700;padding:3px 12px;border-radius:0 0 8px 8px}
        .pm-card-name{font-family:'Syne',sans-serif;font-size:16px;
          font-weight:700;color:#e2ede4;margin-bottom:6px;margin-top:8px}
        .pm-card-price{font-family:'Syne',sans-serif;font-size:32px;
          font-weight:800;color:#38d25a;margin-bottom:14px}
        .pm-card-price span{font-size:14px;color:#6e9475}
        .pm-features{list-style:none;margin-bottom:18px}
        .pm-features li{font-size:12px;color:#6e9475;padding:4px 0;
          border-bottom:1px solid rgba(56,210,90,0.06)}
        .pm-features li:last-child{border:none}
        .pm-locked{color:#364e3a!important;text-decoration:line-through}
        .pm-btn{width:100%;padding:11px;border-radius:8px;font-family:'Syne',sans-serif;
          font-size:13px;font-weight:700;cursor:pointer;border:none;transition:all .15s}
        .pm-btn-primary{background:#38d25a;color:#050908;
          box-shadow:0 0 20px rgba(56,210,90,0.25)}
        .pm-btn-primary:hover{background:#4ae870}
        .pm-btn-ghost{background:transparent;color:#364e3a;
          border:1px solid rgba(56,210,90,0.15);cursor:not-allowed}
        .pm-note{text-align:center;font-size:11px;color:#364e3a}
        @media(max-width:520px){
          .pm-cards{grid-template-columns:1fr}
          .pm-box{padding:24px 18px}
        }
      `
      document.head.appendChild(style)
    }

    document.body.appendChild(modal)

    document.getElementById('pm-close').onclick = closeUpgradeModal
    document.getElementById('pm-backdrop').onclick = (e) => {
      if (e.target.id === 'pm-backdrop') closeUpgradeModal()
    }
  }

  /* ── Toggle billing period in modal ─────────────────────── */
  let _billing = 'monthly'
  function toggleBilling(period) {
    _billing = period
    document.querySelectorAll('.pm-tog').forEach(b => b.classList.remove('active'))
    document.getElementById(`tog-${period}`)?.classList.add('active')
    const priceEl = document.getElementById('pm-price')
    if (priceEl) {
      priceEl.innerHTML = period === 'yearly'
        ? '$5<span>/mo · billed $60/yr</span>'
        : '$7<span>/mo</span>'
    }
  }

  /* ── Close modal ─────────────────────────────────────────── */
  function closeUpgradeModal() {
    document.getElementById('premium-modal')?.remove()
  }

  /* ── Simulate payment flow ───────────────────────────────── */
  async function simulatePayment(plan) {
    const modal = document.getElementById('pm-modal-inner') || document.querySelector('.pm-box')
    if (modal) {
      modal.innerHTML = `
        <div style="text-align:center;padding:40px 20px">
          <div style="font-size:48px;margin-bottom:16px">💳</div>
          <h2 style="font-family:'Syne',sans-serif;font-size:22px;font-weight:800;
            color:#e2ede4;margin-bottom:8px">Processing payment…</h2>
          <p style="color:#6e9475;font-size:13px">Please wait</p>
          <div style="margin:24px auto;width:40px;height:40px;border:3px solid rgba(56,210,90,0.2);
            border-top-color:#38d25a;border-radius:50%;animation:spin .7s linear infinite"></div>
          <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
        </div>`
    }

    // Simulate 2s payment processing
    await new Promise(r => setTimeout(r, 2000))

    // Apply premium to current user
    const user = window.AUTH?.currentUser()
    if (user) {
      try {
        await window.AUTH.upgradePlan(user.uid, plan)
        showNotification('🎉 Welcome to Premium! All features unlocked.', 'success')
      } catch(e) {
        console.error('[PREMIUM] upgrade error:', e)
      }
    }

    // Show success screen
    if (modal) {
      modal.innerHTML = `
        <div style="text-align:center;padding:40px 20px">
          <div style="font-size:56px;margin-bottom:16px">🎉</div>
          <h2 style="font-family:'Syne',sans-serif;font-size:24px;font-weight:800;
            color:#38d25a;margin-bottom:8px">You're Premium!</h2>
          <p style="color:#6e9475;font-size:14px;margin-bottom:24px;line-height:1.6">
            All features unlocked. Enjoy unlimited training, AI insights, and advanced analytics.
          </p>
          <button onclick="location.reload()" style="padding:13px 32px;background:#38d25a;
            color:#050908;border:none;border-radius:10px;font-family:'Syne',sans-serif;
            font-size:14px;font-weight:700;cursor:pointer">
            Start Training →
          </button>
        </div>`
    }
  }

  /* ── Lock overlay for premium features ───────────────────── */
  function lockElement(el, featureName = 'This feature') {
    if (!el) return
    el.style.position = 'relative'
    el.style.overflow = 'hidden'

    const overlay = document.createElement('div')
    overlay.className = 'premium-lock-overlay'
    overlay.innerHTML = `
      <div class="plo-inner">
        <div class="plo-icon">🔒</div>
        <div class="plo-title">Premium Required</div>
        <div class="plo-sub">${featureName} is a Premium feature</div>
        <button class="plo-btn" onclick="PREMIUM.showUpgradeModal('${featureName}')">
          Unlock Premium
        </button>
      </div>`

    if (!document.getElementById('plo-styles')) {
      const s = document.createElement('style')
      s.id = 'plo-styles'
      s.textContent = `
        .premium-lock-overlay {
          position:absolute;inset:0;
          background:rgba(5,9,8,0.88);
          backdrop-filter:blur(4px);
          display:flex;align-items:center;justify-content:center;
          z-index:10;border-radius:inherit;
        }
        .plo-inner{text-align:center;padding:20px}
        .plo-icon{font-size:28px;margin-bottom:8px}
        .plo-title{font-family:'Syne',sans-serif;font-size:16px;
          font-weight:700;color:#e2ede4;margin-bottom:4px}
        .plo-sub{font-size:12px;color:#6e9475;margin-bottom:14px}
        .plo-btn{padding:9px 20px;background:#38d25a;color:#050908;
          border:none;border-radius:8px;font-family:'Syne',sans-serif;
          font-size:12px;font-weight:700;cursor:pointer}
        .plo-btn:hover{background:#4ae870}
      `
      document.head.appendChild(s)
    }

    el.appendChild(overlay)
  }

  /* ── Toast notifications ─────────────────────────────────── */
  function showNotification(message, type = 'info', duration = 4000) {
    let container = document.getElementById('toast-container')
    if (!container) {
      container = document.createElement('div')
      container.id = 'toast-container'
      container.style.cssText = `
        position:fixed;bottom:24px;right:24px;z-index:9999;
        display:flex;flex-direction:column;gap:10px;
      `
      document.body.appendChild(container)
    }

    const colors = {
      success : { bg:'rgba(56,210,90,0.12)', border:'rgba(56,210,90,0.35)', text:'#38d25a' },
      error   : { bg:'rgba(224,72,72,0.12)',  border:'rgba(224,72,72,0.35)',  text:'#e04848' },
      info    : { bg:'rgba(64,160,240,0.12)', border:'rgba(64,160,240,0.35)', text:'#40a0f0' },
      xp      : { bg:'rgba(240,192,64,0.12)', border:'rgba(240,192,64,0.35)', text:'#f0c040' },
    }
    const c = colors[type] || colors.info

    const toast = document.createElement('div')
    toast.style.cssText = `
      background:${c.bg};border:1px solid ${c.border};border-radius:10px;
      padding:12px 18px;font-size:13px;color:${c.text};
      font-family:'DM Sans',sans-serif;max-width:300px;
      animation:toastIn .25s ease;box-shadow:0 4px 20px rgba(0,0,0,0.3);
    `
    toast.innerHTML = message

    if (!document.getElementById('toast-styles')) {
      const s = document.createElement('style')
      s.id = 'toast-styles'
      s.textContent = `
        @keyframes toastIn { from{opacity:0;transform:translateX(20px)} to{opacity:1;transform:translateX(0)} }
        @keyframes toastOut { from{opacity:1;transform:translateX(0)} to{opacity:0;transform:translateX(20px)} }
      `
      document.head.appendChild(s)
    }

    container.appendChild(toast)
    setTimeout(() => {
      toast.style.animation = 'toastOut .25s ease forwards'
      setTimeout(() => toast.remove(), 250)
    }, duration)
  }

  /* ── XP earned popup ─────────────────────────────────────── */
  function showXPPopup(amount, levelUp = false, newLevel = null) {
    const popup = document.createElement('div')
    popup.style.cssText = `
      position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
      z-index:9998;text-align:center;pointer-events:none;
      animation:xpPop .6s ease forwards;
    `
    popup.innerHTML = levelUp
      ? `<div style="font-size:56px;margin-bottom:8px">🎊</div>
         <div style="font-family:'Syne',sans-serif;font-size:32px;font-weight:800;
           color:#f0c040">LEVEL UP!</div>
         <div style="font-size:16px;color:#e2ede4;margin-top:4px">
           You reached Level ${newLevel}</div>`
      : `<div style="font-family:'Syne',sans-serif;font-size:48px;font-weight:800;
           color:#38d25a">+${amount} XP</div>`

    if (!document.getElementById('xp-pop-styles')) {
      const s = document.createElement('style')
      s.id = 'xp-pop-styles'
      s.textContent = `
        @keyframes xpPop {
          0%  { opacity:0; transform:translate(-50%,-50%) scale(0.5) }
          40% { opacity:1; transform:translate(-50%,-60%) scale(1.1) }
          70% { opacity:1; transform:translate(-50%,-65%) scale(1) }
          100%{ opacity:0; transform:translate(-50%,-80%) scale(0.9) }
        }
      `
      document.head.appendChild(s)
    }

    document.body.appendChild(popup)
    setTimeout(() => popup.remove(), 1800)
  }

  /* ── Streak alert ────────────────────────────────────────── */
  function showStreakAlert(streak) {
    showNotification(`🔥 ${streak} day streak! Keep it up!`, 'xp', 5000)
  }

  /* ── Premium badge HTML ──────────────────────────────────── */
  function badgeHTML(plan) {
    const badges = {
      premium : `<span style="background:rgba(240,192,64,0.15);border:1px solid rgba(240,192,64,0.4);
                   color:#f0c040;font-size:9px;letter-spacing:1.5px;padding:3px 8px;
                   border-radius:4px;font-family:'DM Mono',monospace">⭐ PREMIUM</span>`,
      school  : `<span style="background:rgba(64,160,240,0.15);border:1px solid rgba(64,160,240,0.4);
                   color:#40a0f0;font-size:9px;letter-spacing:1.5px;padding:3px 8px;
                   border-radius:4px;font-family:'DM Mono',monospace">🏫 SCHOOL</span>`,
      free    : `<span style="background:rgba(56,210,90,0.08);border:1px solid rgba(56,210,90,0.2);
                   color:#6e9475;font-size:9px;letter-spacing:1.5px;padding:3px 8px;
                   border-radius:4px;font-family:'DM Mono',monospace">FREE</span>`,
    }
    return badges[plan] || badges.free
  }

  /* ── Rank tier from XP ───────────────────────────────────── */
  function getRankTier(xp) {
    if (xp >= 8000)  return { name:'Champion', color:'#f0c040', icon:'🏆' }
    if (xp >= 3500)  return { name:'Elite',    color:'#40a0f0', icon:'💎' }
    if (xp >= 1200)  return { name:'Gold',     color:'#f0a030', icon:'🥇' }
    if (xp >= 500)   return { name:'Silver',   color:'#c0c8d0', icon:'🥈' }
    return                  { name:'Bronze',   color:'#cd7f32', icon:'🥉' }
  }

  /* ── Public API ──────────────────────────────────────────── */
  return {
    PLANS,
    PREMIUM_FEATURES,
    isCreator,
    hasPremium,
    canAccess,
    sessionsRemaining,
    showUpgradeModal,
    closeUpgradeModal,
    toggleBilling,
    simulatePayment,
    lockElement,
    showNotification,
    showXPPopup,
    showStreakAlert,
    badgeHTML,
    getRankTier,
  }

})()

window.PREMIUM = PREMIUM
export default PREMIUM
