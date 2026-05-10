/* ============================================================
   Shuttlestepz — payment.js  (Simulation Mode)
   Simulates the full payment flow for all 3 tiers.
   To go live: replace simulatePayment() with Razorpay SDK call.

   Plans:
     student  → ₹199 / month
     coach    → ₹399 / month
     school   → ₹699 / month
   ============================================================ */

/* ── Plan config ─────────────────────────────────────────── */
export const PLANS = {
  student: {
    id         : 'student',
    label      : 'Student Premium',
    price      : 199,
    currency   : '₹',
    period     : 'month',
    color      : '#39e07a',
    icon       : '🏸',
    features   : [
      'Unlimited training sessions',
      'Advanced session analytics',
      'Priority leaderboard placement',
      'All drills & difficulty levels',
      'Early access to new features',
    ],
  },
  coach: {
    id         : 'coach',
    label      : 'Coach Premium',
    price      : 399,
    currency   : '₹',
    period     : 'month',
    color      : '#60b4ff',
    icon       : '🏅',
    features   : [
      'Everything in Student Premium',
      'Manage up to 30 students',
      'Student performance dashboard',
      'Class analytics & comparisons',
      'School/club code generation',
      'Priority support',
    ],
  },
  school: {
    id         : 'school',
    label      : 'School / Club',
    price      : 699,
    currency   : '₹',
    period     : 'month',
    color      : '#f5a623',
    icon       : '🏫',
    features   : [
      'Everything in Coach Premium',
      'Unlimited students',
      'Multi-coach management',
      'School-wide leaderboard',
      'Branded experience',
      'Dedicated support',
    ],
  },
}

/* ── Simulate payment (replace with Razorpay later) ──────── */
function simulatePayment({ plan, name, email, onSuccess, onFailure, onDismiss }) {
  return new Promise((resolve) => {
    /* Show the simulated payment modal */
    const modal = createPaymentModal({ plan, name, email })
    document.body.appendChild(modal)

    /* Animate in */
    requestAnimationFrame(() => modal.classList.add('rzp-sim-open'))

    /* Wire up events */
    modal.querySelector('.rzp-sim-pay-btn').addEventListener('click', async () => {
      const btn = modal.querySelector('.rzp-sim-pay-btn')
      btn.disabled  = true
      btn.innerHTML = '<span class="rzp-sim-spinner"></span>Processing…'

      /* Simulate network delay */
      await new Promise(r => setTimeout(r, 2200))

      /* 95% success rate simulation */
      const success = Math.random() > 0.05

      closeModal(modal)

      if (success) {
        const paymentId = 'SIM_' + Math.random().toString(36).slice(2, 12).toUpperCase()
        onSuccess?.({ paymentId, plan: plan.id, amount: plan.price })
        resolve({ ok: true, paymentId })
      } else {
        onFailure?.({ code: 'PAYMENT_FAILED', description: 'Simulated payment failure.' })
        resolve({ ok: false, error: 'Payment failed. Please try again.' })
      }
    })

    modal.querySelector('.rzp-sim-cancel').addEventListener('click', () => {
      closeModal(modal)
      onDismiss?.()
      resolve({ ok: false, error: 'Payment cancelled.' })
    })

    modal.querySelector('.rzp-sim-backdrop').addEventListener('click', () => {
      closeModal(modal)
      onDismiss?.()
      resolve({ ok: false, error: 'Payment cancelled.' })
    })
  })
}

function closeModal(modal) {
  modal.classList.remove('rzp-sim-open')
  setTimeout(() => modal.remove(), 300)
}

/* ── Build the payment modal DOM ─────────────────────────── */
function createPaymentModal({ plan, name, email }) {
  const el = document.createElement('div')
  el.className = 'rzp-sim-wrap'
  el.innerHTML = `
    <div class="rzp-sim-backdrop"></div>
    <div class="rzp-sim-modal">

      <div class="rzp-sim-header">
        <div class="rzp-sim-brand">
          <svg width="22" height="22" viewBox="0 0 34 34" fill="none">
            <circle cx="17" cy="17" r="15" stroke="#39e07a" stroke-width="1.5"/>
            <circle cx="17" cy="7" r="3" fill="#39e07a"/>
            <path d="M17 7 C11 12 9 17 11 23" stroke="#39e07a" stroke-width="1.8" stroke-linecap="round"/>
            <path d="M17 7 C23 12 25 17 23 23" stroke="#39e07a" stroke-width="1.8" stroke-linecap="round"/>
            <line x1="17" y1="23" x2="17" y2="31" stroke="#39e07a" stroke-width="2.5" stroke-linecap="round"/>
          </svg>
          <span>Shuttlestepz</span>
        </div>
        <button class="rzp-sim-cancel" aria-label="Close">✕</button>
      </div>

      <div class="rzp-sim-plan-row">
        <span class="rzp-sim-plan-icon">${plan.icon}</span>
        <div class="rzp-sim-plan-info">
          <div class="rzp-sim-plan-name">${plan.label}</div>
          <div class="rzp-sim-plan-price">${plan.currency}${plan.price} <span>/ ${plan.period}</span></div>
        </div>
        <div class="rzp-sim-badge" style="background:${plan.color}22;color:${plan.color};border-color:${plan.color}44">
          SIMULATION
        </div>
      </div>

      <div class="rzp-sim-features">
        ${plan.features.map(f => `
          <div class="rzp-sim-feat">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${plan.color}" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            ${f}
          </div>`).join('')}
      </div>

      <div class="rzp-sim-divider"></div>

      <div class="rzp-sim-user-row">
        <div class="rzp-sim-user-av">${(name || 'U')[0].toUpperCase()}</div>
        <div>
          <div class="rzp-sim-user-name">${name || 'User'}</div>
          <div class="rzp-sim-user-email">${email || ''}</div>
        </div>
      </div>

      <div class="rzp-sim-card-section">
        <div class="rzp-sim-section-lbl">Payment details <span class="rzp-sim-test-tag">TEST MODE</span></div>
        <div class="rzp-sim-card-row">
          <div class="rzp-sim-card-ico">💳</div>
          <input class="rzp-sim-card-input" placeholder="4111 1111 1111 1111" maxlength="19"
            oninput="this.value=this.value.replace(/[^0-9]/g,'').replace(/(.{4})/g,'$1 ').trim()">
        </div>
        <div class="rzp-sim-card-row2">
          <input class="rzp-sim-card-input rzp-sim-half" placeholder="MM / YY" maxlength="5"
            oninput="let v=this.value.replace(/\D/g,'');if(v.length>2)v=v.slice(0,2)+'/'+v.slice(2);this.value=v">
          <input class="rzp-sim-card-input rzp-sim-half" placeholder="CVV" maxlength="3"
            oninput="this.value=this.value.replace(/\D/g,'')">
        </div>
        <div class="rzp-sim-hint">Any values work in simulation mode</div>
      </div>

      <button class="rzp-sim-pay-btn" style="background:${plan.color}">
        Pay ${plan.currency}${plan.price}
      </button>

      <div class="rzp-sim-footer">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        Secured by Shuttlestepz · Powered by Razorpay (coming soon)
      </div>

    </div>
  `
  return el
}

/* ── Inject styles (once) ────────────────────────────────── */
function injectStyles() {
  if (document.getElementById('rzp-sim-styles')) return
  const style = document.createElement('style')
  style.id = 'rzp-sim-styles'
  style.textContent = `
    .rzp-sim-wrap {
      position:fixed;inset:0;z-index:99999;
      display:flex;align-items:center;justify-content:center;
    }
    .rzp-sim-backdrop {
      position:absolute;inset:0;
      background:rgba(0,0,0,.7);
      backdrop-filter:blur(6px);
      opacity:0;transition:opacity .3s;
    }
    .rzp-sim-open .rzp-sim-backdrop { opacity:1; }

    .rzp-sim-modal {
      position:relative;z-index:1;
      background:#0f1315;
      border:1px solid rgba(255,255,255,.08);
      border-radius:18px;
      padding:24px;
      width:100%;max-width:400px;
      margin:16px;
      box-shadow:0 32px 80px rgba(0,0,0,.6);
      transform:translateY(24px) scale(.97);
      opacity:0;
      transition:transform .3s cubic-bezier(.4,0,.2,1), opacity .3s;
    }
    .rzp-sim-open .rzp-sim-modal { transform:translateY(0) scale(1); opacity:1; }

    .rzp-sim-header {
      display:flex;align-items:center;justify-content:space-between;
      margin-bottom:18px;
    }
    .rzp-sim-brand {
      display:flex;align-items:center;gap:8px;
      font-size:14px;font-weight:700;color:#eaf0eb;
      font-family:'Sora',sans-serif;
    }
    .rzp-sim-cancel {
      background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);
      color:#7a9080;border-radius:8px;width:30px;height:30px;
      cursor:pointer;font-size:13px;display:flex;align-items:center;justify-content:center;
      transition:all .15s;
    }
    .rzp-sim-cancel:hover { background:rgba(224,92,92,.15);color:#e05c5c;border-color:#e05c5c; }

    .rzp-sim-plan-row {
      display:flex;align-items:center;gap:12px;
      background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);
      border-radius:12px;padding:14px;margin-bottom:14px;
    }
    .rzp-sim-plan-icon { font-size:24px;flex-shrink:0; }
    .rzp-sim-plan-info { flex:1; }
    .rzp-sim-plan-name { font-size:13px;font-weight:700;color:#eaf0eb;font-family:'Sora',sans-serif; }
    .rzp-sim-plan-price {
      font-size:20px;font-weight:900;color:#39e07a;
      font-family:'Sora',sans-serif;letter-spacing:-.5px;margin-top:2px;
    }
    .rzp-sim-plan-price span { font-size:12px;font-weight:500;color:#7a9080; }
    .rzp-sim-badge {
      font-size:9px;font-weight:700;letter-spacing:.8px;
      text-transform:uppercase;border:1px solid;border-radius:6px;
      padding:3px 7px;white-space:nowrap;
    }

    .rzp-sim-features { display:flex;flex-direction:column;gap:6px;margin-bottom:14px; }
    .rzp-sim-feat {
      display:flex;align-items:center;gap:8px;
      font-size:12px;color:#7a9080;font-family:'Sora',sans-serif;
    }
    .rzp-sim-feat svg { flex-shrink:0; }

    .rzp-sim-divider { height:1px;background:rgba(255,255,255,.06);margin:14px 0; }

    .rzp-sim-user-row {
      display:flex;align-items:center;gap:10px;margin-bottom:16px;
    }
    .rzp-sim-user-av {
      width:34px;height:34px;border-radius:50%;
      background:rgba(57,224,122,.15);
      display:flex;align-items:center;justify-content:center;
      font-size:14px;font-weight:700;color:#39e07a;flex-shrink:0;
    }
    .rzp-sim-user-name { font-size:13px;font-weight:600;color:#eaf0eb;font-family:'Sora',sans-serif; }
    .rzp-sim-user-email { font-size:11px;color:#7a9080; }

    .rzp-sim-section-lbl {
      font-size:10px;font-weight:700;letter-spacing:.8px;
      text-transform:uppercase;color:#3d4f44;
      margin-bottom:10px;display:flex;align-items:center;gap:8px;
    }
    .rzp-sim-test-tag {
      background:rgba(224,180,60,.15);color:#e0b43c;
      border:1px solid rgba(224,180,60,.25);border-radius:4px;
      font-size:9px;padding:2px 6px;letter-spacing:.6px;
    }
    .rzp-sim-card-section { margin-bottom:16px; }
    .rzp-sim-card-row {
      display:flex;align-items:center;gap:8px;
      background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);
      border-radius:9px;padding:10px 12px;margin-bottom:8px;
    }
    .rzp-sim-card-row2 { display:flex;gap:8px; }
    .rzp-sim-card-ico { font-size:18px;flex-shrink:0; }
    .rzp-sim-card-input {
      background:none;border:none;outline:none;
      color:#eaf0eb;font-size:14px;font-family:'DM Mono',monospace;
      width:100%;
    }
    .rzp-sim-card-input::placeholder { color:#3d4f44; }
    .rzp-sim-half {
      background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);
      border-radius:9px;padding:10px 12px;flex:1;
    }
    .rzp-sim-hint { font-size:10.5px;color:#3d4f44;margin-top:6px;text-align:center; }

    .rzp-sim-pay-btn {
      width:100%;padding:14px;border:none;border-radius:10px;
      font-family:'Sora',sans-serif;font-size:14px;font-weight:700;
      color:#060a07;cursor:pointer;
      box-shadow:0 0 24px rgba(57,224,122,.3);
      transition:all .2s;display:flex;align-items:center;justify-content:center;gap:8px;
      margin-bottom:14px;
    }
    .rzp-sim-pay-btn:hover:not(:disabled) { filter:brightness(1.1);transform:translateY(-1px); }
    .rzp-sim-pay-btn:disabled { opacity:.7;cursor:not-allowed;transform:none; }

    .rzp-sim-spinner {
      width:14px;height:14px;border-radius:50%;
      border:2px solid rgba(0,0,0,.2);border-top-color:#060a07;
      animation:rzp-spin .7s linear infinite;display:inline-block;
    }
    @keyframes rzp-spin { to { transform:rotate(360deg); } }

    .rzp-sim-footer {
      display:flex;align-items:center;justify-content:center;gap:5px;
      font-size:10.5px;color:#3d4f44;
    }

    /* Success overlay */
    .rzp-sim-success-wrap {
      position:fixed;inset:0;z-index:99999;
      display:flex;align-items:center;justify-content:center;
      background:rgba(0,0,0,.8);backdrop-filter:blur(8px);
      animation:rzp-fadein .3s both;
    }
    @keyframes rzp-fadein { from{opacity:0} to{opacity:1} }
    .rzp-sim-success-box {
      background:#0f1315;border:1px solid rgba(57,224,122,.25);
      border-radius:18px;padding:36px 32px;text-align:center;
      max-width:340px;width:100%;margin:16px;
      animation:rzp-slideup .35s cubic-bezier(.4,0,.2,1) both;
    }
    @keyframes rzp-slideup { from{transform:translateY(20px);opacity:0} to{transform:none;opacity:1} }
    .rzp-sim-success-icon {
      width:64px;height:64px;border-radius:50%;
      background:rgba(57,224,122,.12);border:2px solid rgba(57,224,122,.3);
      display:flex;align-items:center;justify-content:center;
      font-size:28px;margin:0 auto 16px;
    }
    .rzp-sim-success-title {
      font-size:20px;font-weight:800;color:#eaf0eb;
      font-family:'Sora',sans-serif;letter-spacing:-.4px;margin-bottom:8px;
    }
    .rzp-sim-success-sub {
      font-size:13px;color:#7a9080;font-family:'Sora',sans-serif;
      line-height:1.6;margin-bottom:20px;
    }
    .rzp-sim-success-id {
      background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);
      border-radius:8px;padding:8px 14px;
      font-size:11px;font-family:'DM Mono',monospace;color:#3d4f44;
      margin-bottom:20px;
    }
    .rzp-sim-success-btn {
      width:100%;padding:12px;border:none;border-radius:10px;
      background:#39e07a;color:#060a07;
      font-family:'Sora',sans-serif;font-size:13px;font-weight:700;
      cursor:pointer;transition:all .2s;
    }
    .rzp-sim-success-btn:hover { background:#50e88a; }
  `
  document.head.appendChild(style)
}

/* ── Show success screen ─────────────────────────────────── */
function showSuccess({ plan, paymentId, onContinue }) {
  const el = document.createElement('div')
  el.className = 'rzp-sim-success-wrap'
  el.innerHTML = `
    <div class="rzp-sim-success-box">
      <div class="rzp-sim-success-icon">✅</div>
      <div class="rzp-sim-success-title">You're Premium! ${plan.icon}</div>
      <div class="rzp-sim-success-sub">
        <strong>${plan.label}</strong> activated successfully.<br>
        ${plan.currency}${plan.price}/month · Enjoy unlimited access!
      </div>
      <div class="rzp-sim-success-id">Payment ID: ${paymentId}</div>
      <button class="rzp-sim-success-btn">Continue to Dashboard →</button>
    </div>
  `
  document.body.appendChild(el)
  el.querySelector('.rzp-sim-success-btn').onclick = () => {
    el.remove()
    onContinue?.()
  }
}

/* ── Main export: PAY ────────────────────────────────────── */
export async function pay({ planId, name, email, onUpgraded }) {
  injectStyles()

  const plan = PLANS[planId]
  if (!plan) {
    console.error('[Payment] Unknown plan:', planId)
    return { ok: false, error: 'Unknown plan.' }
  }

  const result = await simulatePayment({
    plan, name, email,
    onSuccess: ({ paymentId }) => {
      showSuccess({
        plan, paymentId,
        onContinue: () => onUpgraded?.({ planId, paymentId }),
      })
    },
    onFailure : ({ description }) => console.warn('[Payment] Failed:', description),
    onDismiss : ()               => console.log('[Payment] Dismissed'),
  })

  return result
}

/* ── Quick helper used by upgrade buttons ────────────────── */
export async function upgradePlan({ planId, user, onSuccess, onCancel }) {
  injectStyles()

  const result = await pay({
    planId,
    name  : user?.username || user?.displayName || 'Athlete',
    email : user?.email    || '',
    onUpgraded: async ({ planId: pid, paymentId }) => {
      /* Write to Firebase via AUTH */
      if (window.AUTH) {
        const planName = pid === 'school' ? 'school' : 'premium'
        await window.AUTH.upgradePlan(null, planName)
        console.log('[Payment] ✅ Plan upgraded to:', planName, '| Payment:', paymentId)
      }
      onSuccess?.({ planId: pid, paymentId })
    },
  })

  if (!result.ok) onCancel?.()
  return result
}

/* ── Determine plan tier from user role ──────────────────── */
export function getPlanIdForRole(role) {
  if (role === 'school')  return 'school'
  if (role === 'coach')   return 'coach'
  return 'student'
}
