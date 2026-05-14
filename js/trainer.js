/* ============================================================
   Shuttlestepz — trainer.js  (V2 + V1 AI merged)
   Real MoveNet pose detection from V1
   V2 dashboard architecture, DOM refs, auth, UI
   ============================================================ */

/* ── Guard: only run on trainer tab ── */
if (!document.getElementById('tr-video')) throw new Error('Not trainer page')

/* ═══════════════════════════════════════════════════════════
   DOM REFS — V2 IDs
═══════════════════════════════════════════════════════════ */
const video       = document.getElementById('tr-video')
const canvas      = document.getElementById('tr-canvas')
const ctx         = canvas.getContext('2d')
const poseBadge   = document.getElementById('tr-pose-badge')
const feedback    = document.getElementById('tr-feedback')
const dirText     = document.getElementById('tr-dir-text')
const tArc        = document.getElementById('tr-t-arc')
const tNum        = document.getElementById('tr-t-num')
const sRound      = document.getElementById('tr-s-round')
const sScore      = document.getElementById('tr-s-score')
const sStreak     = document.getElementById('tr-s-streak')
const sAcc        = document.getElementById('tr-s-acc')
const srRound     = document.getElementById('tr-sr-round')
const srScore     = document.getElementById('tr-sr-score')
const srStreak    = document.getElementById('tr-sr-streak')
const srAcc       = document.getElementById('tr-sr-acc')
const pdots       = document.getElementById('tr-pdots')
const modelStatus = document.getElementById('tr-model-status')
const speedBar    = document.getElementById('tr-speed-bar')
const speedVal    = document.getElementById('tr-speed-val')
const setupScreen = document.getElementById('tr-screen-setup')
const resultScreen= document.getElementById('tr-screen-results')
const lockOverlay = document.getElementById('tr-lock-overlay')

/* ── Setup controls ── */
const slRounds = document.getElementById('tr-sl-rounds')
const slTime   = document.getElementById('tr-sl-time')
const chkVoice = document.getElementById('tr-chk-voice')
const chkBeep  = document.getElementById('tr-chk-beep')

if (slRounds) slRounds.oninput = () => {
  document.getElementById('tr-lbl-rounds').textContent   = slRounds.value
  document.getElementById('tr-lbl-rounds-r').textContent = slRounds.value
}
if (slTime) slTime.oninput = () => {
  document.getElementById('tr-lbl-time').textContent   = slTime.value + 's'
  document.getElementById('tr-lbl-time-r').textContent = slTime.value + 's'
}

/* ═══════════════════════════════════════════════════════════
   DIFFICULTY CONFIG — from V1
═══════════════════════════════════════════════════════════ */
const DIFFICULTY = {
  easy  : { rounds:8,  time:6, label:'6s per direction · 8 rounds · beginner' },
  medium: { rounds:10, time:4, label:'4s per direction · 10 rounds · standard' },
  hard  : { rounds:15, time:3, label:'3s per direction · 15 rounds · competitive' },
  pro   : { rounds:20, time:2, label:'2s per direction · 20 rounds · elite' },
}

let selectedDiff  = 'medium'
let selectedGroup = 'all'

document.querySelectorAll('.tr-dp').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.disabled) return
    document.querySelectorAll('.tr-dp').forEach(b => b.classList.remove('sel'))
    btn.classList.add('sel')
    selectedDiff = btn.dataset.diff
    const d = DIFFICULTY[selectedDiff]
    const dd = document.getElementById('tr-diff-desc')
    if (dd) dd.textContent = d.label
    if (slRounds) { slRounds.value = d.rounds; document.getElementById('tr-lbl-rounds').textContent = d.rounds; document.getElementById('tr-lbl-rounds-r').textContent = d.rounds }
    if (slTime)   { slTime.value   = d.time;   document.getElementById('tr-lbl-time').textContent   = d.time+'s'; document.getElementById('tr-lbl-time-r').textContent = d.time+'s' }
  })
})

document.querySelectorAll('.tr-zg-btn[data-sg]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tr-zg-btn[data-sg]').forEach(b => b.classList.remove('sel'))
    btn.classList.add('sel')
    selectedGroup = btn.dataset.sg === 'ctr' ? 'centre' : btn.dataset.sg
  })
})

/* ═══════════════════════════════════════════════════════════
   ZONE GROUPS — from V1
═══════════════════════════════════════════════════════════ */
const ZONE_GROUPS = {
  all   : ['FRONT','BACK','LEFT','RIGHT','LEFT CORNER','RIGHT CORNER','BACK LEFT','BACK RIGHT'],
  front : ['LEFT CORNER','RIGHT CORNER'],
  back  : ['BACK LEFT','BACK RIGHT'],
  centre: ['LEFT','RIGHT'],
}
const ALL_ZONES  = ZONE_GROUPS.all
let   activeZones = ZONE_GROUPS.all

/* ═══════════════════════════════════════════════════════════
   POSE DETECTION CONSTANTS — from V1
═══════════════════════════════════════════════════════════ */
const THRESH_X     = 0.12
const THRESH_Y     = 0.10
const SMOOTH_ALPHA = 0.4
const CALIB_FRAMES = 25

/* ═══════════════════════════════════════════════════════════
   STATE
═══════════════════════════════════════════════════════════ */
let detector    = null
let animFrameId = null
let poseRunning = false

let smoothHipX = null, smoothHipY = null
let smoothFeetX= null, smoothFeetY= null
let hipX = null, hipY = null
let feetX= null, feetY= null

let centerX = null, centerY = null
let frameW  = 640,  frameH  = 480
let calibrated = false, calibFrames = 0, calibSumX = 0, calibSumY = 0

function ema(prev, next) {
  return prev === null ? next : prev * (1 - SMOOTH_ALPHA) + next * SMOOTH_ALPHA
}

let session = {
  totalRounds:10, timePerDir:4, voiceOn:true, beepOn:true,
  round:0, score:0, streak:0, bestStreak:0, hits:0,
  results:[], dirStats:{}, roundTimings:[], difficulty:'medium',
  active:false, currentDir:null, roundStart:0,
  waitingForReturn:false, timerInterval:null, timerEnd:0,
}

/* ═══════════════════════════════════════════════════════════
   AUDIO — from V1
═══════════════════════════════════════════════════════════ */
let audioCtx = null
function getAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  return audioCtx
}
function beep(freq=880, dur=0.12, vol=0.4, type='sine') {
  try {
    const ac=getAudio(), osc=ac.createOscillator(), g=ac.createGain()
    osc.connect(g); g.connect(ac.destination)
    osc.type=type; osc.frequency.value=freq
    g.gain.setValueAtTime(vol, ac.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime+dur)
    osc.start(); osc.stop(ac.currentTime+dur)
  } catch(e){}
}
function successSound() { beep(660,.07,.3); setTimeout(()=>beep(880,.12,.35),70); setTimeout(()=>beep(1100,.09,.2),160) }
function failSound()    { beep(220,.18,.35,'sawtooth'); setTimeout(()=>beep(180,.15,.2,'sawtooth'),120) }
function calibSound()   { beep(440,.1,.2); setTimeout(()=>beep(660,.15,.25),100) }

/* ═══════════════════════════════════════════════════════════
   SPEECH — from V1
═══════════════════════════════════════════════════════════ */
let voices = []
window.speechSynthesis.onvoiceschanged = () => { const v=window.speechSynthesis.getVoices(); if(v.length) voices=v }
setTimeout(() => { const v=window.speechSynthesis.getVoices(); if(v.length) voices=v }, 200)

function speak(text) {
  if (!session.voiceOn) return
  window.speechSynthesis.cancel()
  setTimeout(() => {
    const u = new SpeechSynthesisUtterance(text)
    u.rate=1.1; u.pitch=1.0; u.volume=1.0
    const en = voices.find(v=>v.lang.startsWith('en')&&!v.name.includes('Google'))
            || voices.find(v=>v.lang.startsWith('en')) || voices[0]
    if (en) u.voice = en
    window.speechSynthesis.speak(u)
  }, 60)
}

/* ═══════════════════════════════════════════════════════════
   CAMERA — from V1
═══════════════════════════════════════════════════════════ */
async function startCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video:{ width:640, height:480, facingMode:'user' }, audio:false
  })
  video.srcObject = stream
  return new Promise(resolve => {
    video.onloadedmetadata = () => {
      video.play()
      frameW = video.videoWidth  || 640
      frameH = video.videoHeight || 480
      canvas.width = frameW; canvas.height = frameH
      resolve()
    }
  })
}

function stopCamera() {
  if (video.srcObject) video.srcObject.getTracks().forEach(t => t.stop())
}

/* ═══════════════════════════════════════════════════════════
   MODEL — from V1 (real MoveNet, not simulated)
═══════════════════════════════════════════════════════════ */
async function loadModel() {
  setModelStatus('err', 'Loading MoveNet…')
  try {
    detector = await poseDetection.createDetector(
      poseDetection.SupportedModels.MoveNet,
      { runtime:'tfjs', modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING }
    )
    poseBadge.textContent = 'CALIBRATING'
    poseBadge.classList.add('tracking')
    setModelStatus('ok', 'AI ready ✓ — stand in frame to calibrate')
  } catch(err) {
    setModelStatus('err', '❌ Model failed — check connection')
    throw err
  }
}

function setModelStatus(cls, txt) {
  if (!modelStatus) return
  modelStatus.className = cls
  modelStatus.textContent = txt
}

/* ═══════════════════════════════════════════════════════════
   POSE DETECTION LOOP — V1 logic, V2 DOM IDs
═══════════════════════════════════════════════════════════ */
async function detectPose() {
  if (!poseRunning) return
  try {
    const poses = await detector.estimatePoses(video)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.save()

    if (poses.length > 0) {
      const kp = poses[0].keypoints
      const lHip=kp[11], rHip=kp[12], lAnkle=kp[15], rAnkle=kp[16]

      if (lHip.score > .3 && rHip.score > .3) {
        const rHX=(lHip.x+rHip.x)/2, rHY=(lHip.y+rHip.y)/2
        smoothHipX=ema(smoothHipX,rHX); smoothHipY=ema(smoothHipY,rHY)
        hipX=smoothHipX; hipY=smoothHipY

        if (lAnkle.score>.25 && rAnkle.score>.25) {
          const rFX=(lAnkle.x+rAnkle.x)/2, rFY=(lAnkle.y+rAnkle.y)/2
          smoothFeetX=ema(smoothFeetX,rFX); smoothFeetY=ema(smoothFeetY,rFY)
        } else if (lAnkle.score>.25) {
          smoothFeetX=ema(smoothFeetX,lAnkle.x); smoothFeetY=ema(smoothFeetY,lAnkle.y)
        } else if (rAnkle.score>.25) {
          smoothFeetX=ema(smoothFeetX,rAnkle.x); smoothFeetY=ema(smoothFeetY,rAnkle.y)
        } else {
          smoothFeetX=hipX; smoothFeetY=hipY
        }
        feetX=smoothFeetX; feetY=smoothFeetY

        /* ── Calibration ── */
        if (!calibrated) {
          calibSumX+=hipX; calibSumY+=hipY; calibFrames++
          if (calibFrames >= CALIB_FRAMES) {
            centerX=calibSumX/calibFrames; centerY=calibSumY/calibFrames
            calibrated=true
            poseBadge.textContent='TRACKING'
            poseBadge.classList.remove('lost')
            if (feedback) feedback.textContent='Calibrated — starting…'
            calibSound()
          } else {
            const pct=Math.round(calibFrames/CALIB_FRAMES*100)
            poseBadge.textContent=`CAL ${pct}%`
            if (feedback) feedback.textContent='Hold still at centre… calibrating'
          }
        } else {
          poseBadge.textContent='TRACKING'
          poseBadge.classList.remove('lost'); poseBadge.classList.add('tracking')
          if (session.active) checkZone(hipX,hipY,feetX,feetY)
        }

        drawSkeleton(kp)
        drawTrackingPoints()
        if (session.active && session.currentDir && calibrated) drawTargetZone(session.currentDir)

      } else { lostPose() }
    } else { lostPose() }
    ctx.restore()
  } catch(e) { ctx.restore() }
  animFrameId = requestAnimationFrame(detectPose)
}

/* ═══════════════════════════════════════════════════════════
   DRAWING — from V1
═══════════════════════════════════════════════════════════ */
function drawTrackingPoints() {
  if (feetX && feetX !== hipX) {
    ctx.beginPath(); ctx.arc(feetX,feetY,13,0,Math.PI*2)
    ctx.strokeStyle='rgba(255,255,255,0.55)'; ctx.lineWidth=2; ctx.stroke()
    ctx.beginPath(); ctx.arc(feetX,feetY,4,0,Math.PI*2)
    ctx.fillStyle='#ffffff'; ctx.fill()
  }
  if (hipX) {
    ctx.beginPath(); ctx.arc(hipX,hipY,10,0,Math.PI*2)
    ctx.fillStyle='rgba(57,224,122,0.2)'; ctx.fill()
    ctx.beginPath(); ctx.arc(hipX,hipY,4,0,Math.PI*2)
    ctx.fillStyle='#39e07a'; ctx.fill()
  }
}

function lostPose() {
  hipX=null; hipY=null; feetX=null; feetY=null
  poseBadge.textContent='NO PERSON'
  poseBadge.classList.remove('tracking'); poseBadge.classList.add('lost')
}

/* Skeleton — V1 exact */
const SKEL_PAIRS=[[5,6],[5,7],[7,9],[6,8],[8,10],[11,12],[5,11],[6,12],[11,13],[13,15],[12,14],[14,16]]
const JCOLORS={0:'#00e5ff',1:'#00e5ff',2:'#00e5ff',3:'#00e5ff',4:'#00e5ff',5:'#ffe033',6:'#ffe033',7:'#ffe033',8:'#ffe033',9:'#ffe033',10:'#ffe033',11:'#39e07a',12:'#39e07a',13:'#f09040',14:'#f09040',15:'#f09040',16:'#f09040'}
const JRADII ={0:4,1:3,2:3,3:3,4:3,5:6,6:6,7:5,8:5,9:5,10:5,11:9,12:9,13:7,14:7,15:7,16:7}

function drawSkeleton(kp) {
  const T=0.25
  ctx.lineWidth=2.5
  for (const [a,b] of SKEL_PAIRS) {
    const pa=kp[a], pb=kp[b]
    if (pa.score>T && pb.score>T) {
      const g=ctx.createLinearGradient(pa.x,pa.y,pb.x,pb.y)
      g.addColorStop(0,(JCOLORS[a]||'#fff')+'aa')
      g.addColorStop(1,(JCOLORS[b]||'#fff')+'aa')
      ctx.strokeStyle=g; ctx.beginPath(); ctx.moveTo(pa.x,pa.y); ctx.lineTo(pb.x,pb.y); ctx.stroke()
    }
  }
  for (let i=0;i<kp.length;i++) {
    const p=kp[i]; if(p.score<T) continue
    const c=JCOLORS[i]||'#fff', r=JRADII[i]||5
    ctx.beginPath(); ctx.arc(p.x,p.y,r+3,0,Math.PI*2); ctx.fillStyle=c+'33'; ctx.fill()
    ctx.beginPath(); ctx.arc(p.x,p.y,r,  0,Math.PI*2); ctx.fillStyle=c;      ctx.fill()
    if (p.score>.6 && r>=5) {
      ctx.beginPath(); ctx.arc(p.x,p.y,2,0,Math.PI*2)
      ctx.fillStyle='rgba(255,255,255,0.85)'; ctx.fill()
    }
  }
}

function drawTargetZone(dir) {
  if (!calibrated||!centerX) return
  const tw=frameW*THRESH_X*1.5, th=frameH*THRESH_Y*1.5
  const [tx,ty]=zoneTarget(dir,centerX,centerY,frameW,frameH)
  ctx.strokeStyle='rgba(57,224,122,0.8)'; ctx.lineWidth=2
  ctx.setLineDash([6,4]); ctx.strokeRect(tx-tw,ty-th,tw*2,th*2); ctx.setLineDash([])
  ctx.fillStyle='rgba(57,224,122,0.07)'; ctx.fillRect(tx-tw,ty-th,tw*2,th*2)
  const cs=8
  const corners=[[tx-tw,ty-th,1,1],[tx+tw,ty-th,-1,1],[tx-tw,ty+th,1,-1],[tx+tw,ty+th,-1,-1]]
  ctx.strokeStyle='rgba(57,224,122,0.9)'; ctx.lineWidth=2.5
  for (const [cx,cy,sx,sy] of corners) {
    ctx.beginPath(); ctx.moveTo(cx+sx*cs,cy); ctx.lineTo(cx,cy); ctx.lineTo(cx,cy+sy*cs); ctx.stroke()
  }
}

/* ═══════════════════════════════════════════════════════════
   ZONE MATH — from V1
═══════════════════════════════════════════════════════════ */
function zoneTarget(dir,cx,cy,fw,fh) {
  const ox=fw*.20, oy=fh*.18
  return ({
    'FRONT'        :[cx,   cy+oy],
    'BACK'         :[cx,   cy-oy],
    'LEFT'         :[cx+ox,cy   ],
    'RIGHT'        :[cx-ox,cy   ],
    'LEFT CORNER'  :[cx+ox,cy+oy],
    'RIGHT CORNER' :[cx-ox,cy+oy],
    'BACK LEFT'    :[cx+ox,cy-oy],
    'BACK RIGHT'   :[cx-ox,cy-oy],
  })[dir] || [cx,cy]
}

function isInZone(dir,x,y) {
  if (!calibrated||!centerX) return false
  const [tx,ty]=zoneTarget(dir,centerX,centerY,frameW,frameH)
  return Math.abs(x-tx)<frameW*THRESH_X*1.6 && Math.abs(y-ty)<frameH*THRESH_Y*1.6
}

/* ═══════════════════════════════════════════════════════════
   TIMER RING — V2 IDs, V1 logic
═══════════════════════════════════════════════════════════ */
const CIRC = 2 * Math.PI * 32   // V2 ring r="32"

function setRing(frac, urgent=false) {
  if (!tArc) return
  tArc.style.strokeDashoffset = (2*Math.PI*32) * (1 - Math.max(0,Math.min(1,frac)))
  tArc.style.stroke = urgent ? '#e0b43c' : '#39e07a'
}

function startRingTimer(ms) {
  clearInterval(session.timerInterval)
  session.timerEnd = Date.now() + ms
  session.timerInterval = setInterval(() => {
    const rem=session.timerEnd-Date.now(), frac=rem/ms
    if (tNum) tNum.textContent = Math.max(0,Math.ceil(rem/1000))
    setRing(frac, frac<.3)
    if (rem<=0) clearInterval(session.timerInterval)
  }, 60)
}

/* ═══════════════════════════════════════════════════════════
   DOTS — V2 IDs
═══════════════════════════════════════════════════════════ */
function buildDots(n) {
  if (!pdots) return
  pdots.innerHTML=''
  for (let i=0;i<n;i++) {
    const d=document.createElement('div')
    d.className='tr-dot'; d.id=`tr-dot-${i}`; pdots.appendChild(d)
  }
}
function setDot(i,cls) {
  const d=document.getElementById(`tr-dot-${i}`)
  if (d) { d.classList.remove('ok','bad'); d.classList.add(cls) }
}

/* ═══════════════════════════════════════════════════════════
   STATS DISPLAY — updates both topbar chips + right sidebar
═══════════════════════════════════════════════════════════ */
function updateStats() {
  const rnd = `${session.round}/${session.totalRounds}`
  const acc = session.round===0 ? '—' : Math.round(session.hits/session.round*100)+'%'
  // Topbar chips
  if (sRound)  sRound.textContent  = rnd
  if (sScore)  sScore.textContent  = session.score
  if (sStreak) sStreak.textContent = session.streak
  if (sAcc)    sAcc.textContent    = acc
  // Right sidebar
  if (srRound)  srRound.textContent  = rnd
  if (srScore)  srScore.textContent  = session.score
  if (srStreak) srStreak.textContent = session.streak
  if (srAcc)    srAcc.textContent    = acc
}

function updateSpeedDisplay(ms, maxMs) {
  if (!speedBar||!speedVal) return
  if (!ms) { speedBar.style.width='0%'; speedVal.textContent='—'; return }
  const pct=Math.max(5,Math.round((1-ms/maxMs)*100))
  speedBar.style.width=pct+'%'
  speedBar.style.background=pct>=70?'#39e07a':pct>=40?'#e0b43c':'#e05c5c'
  speedVal.textContent=(ms/1000).toFixed(2)+'s'
}

/* Zone pills — V2 IDs use tr-zp-ZONENAME */
function allZonePills() {
  ALL_ZONES.forEach(z => {
    const e=document.getElementById(`tr-zp-${z.replace(/ /g,'')}`)
    if(e) e.className='tr-zp'
  })
}
function highlightZone(dir, cls) {
  allZonePills()
  const e=document.getElementById(`tr-zp-${dir.replace(/ /g,'')}`)
  if(e) e.classList.add(cls||'active')
}

/* ═══════════════════════════════════════════════════════════
   ROUND FLOW — V1 logic exactly
═══════════════════════════════════════════════════════════ */
let hitDetected = false
let currentZoneCheckInterval = null

function startRound() {
  if (session.round >= session.totalRounds) { endSession(); return }

  let dir
  do { dir = activeZones[Math.floor(Math.random()*activeZones.length)] }
  while (dir === session.currentDir && activeZones.length > 1)

  session.currentDir=dir; session.active=true
  session.waitingForReturn=false; hitDetected=false
  session.roundStart=Date.now()

  if (dirText) { dirText.textContent=dir; dirText.className='tr-dir-text' }
  highlightZone(dir)
  if (feedback) feedback.textContent='Move to zone!'
  startRingTimer(session.timePerDir*1000)
  speak(dir.toLowerCase())
  if (session.beepOn) setTimeout(()=>beep(660,.09),350)

  clearInterval(currentZoneCheckInterval)
  currentZoneCheckInterval=setInterval(()=>{
    if (!session.active) return
    if (Date.now()>=session.timerEnd) { clearInterval(currentZoneCheckInterval); scoreRound(false) }
  },80)
}

function checkZone(hx,hy,fx,fy) {
  if (!session.active||hitDetected||session.waitingForReturn) return
  const dir=session.currentDir
  const useFeet=['FRONT','BACK','LEFT CORNER','RIGHT CORNER','BACK LEFT','BACK RIGHT']
  const ux=useFeet.includes(dir)?fx:hx, uy=useFeet.includes(dir)?fy:hy
  if (!ux||!uy) return
  if (isInZone(dir,ux,uy)) {
    hitDetected=true
    clearInterval(currentZoneCheckInterval)
    scoreRound(true, Date.now()-session.roundStart)
  }
}

function scoreRound(hit, responseMs=null) {
  session.active=false
  clearInterval(currentZoneCheckInterval); clearInterval(session.timerInterval)
  const dir=session.currentDir, rIdx=session.round

  if (!session.dirStats[dir]) session.dirStats[dir]={total:0,hit:0,totalMs:0}
  session.dirStats[dir].total++

  if (hit) {
    session.hits++; session.streak++
    if (session.streak>session.bestStreak) session.bestStreak=session.streak
    let pts=10
    if (responseMs) { const fast=Math.max(0,session.timePerDir*1000-responseMs); pts+=Math.round(fast/200) }
    session.score+=pts; session.dirStats[dir].hit++
    if (responseMs) { session.roundTimings.push(responseMs); session.dirStats[dir].totalMs+=responseMs }
    session.results.push({dir,hit:true,responseMs,pts})
    if (dirText) { dirText.classList.add('hit','pulse') }
    highlightZone(dir,'ok')
    if (feedback) feedback.textContent=`✓ HIT! +${pts} pts`
    setDot(rIdx,'ok'); successSound()
    updateSpeedDisplay(responseMs, session.timePerDir*1000)
    if (session.voiceOn) setTimeout(()=>speak('nice'),180)
  } else {
    session.streak=0
    session.results.push({dir,hit:false,responseMs:null,pts:0})
    if (dirText) dirText.classList.add('miss')
    highlightZone(dir,'bad')
    if (feedback) feedback.textContent='✗ MISSED'
    setDot(rIdx,'bad'); failSound()
    updateSpeedDisplay(null, session.timePerDir*1000)
  }

  session.round++; updateStats()

  setTimeout(()=>{
    allZonePills()
    if (dirText) {
      dirText.textContent = session.round>=session.totalRounds ? 'DONE!' : 'CENTRE'
      dirText.className='tr-dir-text'
    }
    if (tNum) tNum.textContent='—'; setRing(1)
    if (session.round>=session.totalRounds) setTimeout(endSession,800)
    else setTimeout(startRound,1200)
  },900)
}

/* ═══════════════════════════════════════════════════════════
   SESSION — V1 logic, V2 auth
═══════════════════════════════════════════════════════════ */
function beginSession() {
  session.totalRounds = parseInt(slRounds?.value||10)
  session.timePerDir  = parseInt(slTime?.value||4)
  session.voiceOn     = chkVoice?.checked ?? true
  session.beepOn      = chkBeep?.checked  ?? true
  session.difficulty  = selectedDiff
  activeZones         = ZONE_GROUPS[selectedGroup] || ZONE_GROUPS.all

  session.round=0; session.score=0; session.streak=0; session.bestStreak=0; session.hits=0
  session.results=[]; session.dirStats={}; session.roundTimings=[]
  session.currentDir=null; session.active=false

  buildDots(session.totalRounds); updateStats()
  if (dirText) { dirText.textContent='GET READY'; dirText.className='tr-dir-text' }
  setRing(1); updateSpeedDisplay(null, session.timePerDir*1000)
  if (feedback) feedback.textContent = calibrated ? 'Starting in 2s…' : 'Stand still to calibrate…'

  const w=setInterval(()=>{
    if (calibrated) { clearInterval(w); if(feedback) feedback.textContent='GO!'; setTimeout(startRound,600) }
  },300)
}

function endSession() {
  session.active=false
  clearInterval(currentZoneCheckInterval); clearInterval(session.timerInterval)
  poseRunning=false
  if (animFrameId) cancelAnimationFrame(animFrameId)
  stopCamera()

  // Save via V2 AUTH
  try {
    if (window.AUTH) {
      window.AUTH.recordSession({
        mode        : 'footwork',
        score       : session.score,
        hits        : session.hits,
        totalRounds : session.totalRounds,
        bestStreak  : session.bestStreak,
        roundTimings: session.roundTimings,
        dirStats    : session.dirStats,
      }).catch(e=>console.warn('[trainer] recordSession:',e))
      window.AUTH.incrementSession()
    }
  } catch(e) { console.warn('[trainer] auth save failed:',e) }

  showResults()
}

/* ═══════════════════════════════════════════════════════════
   RESULTS — V1 logic, V2 IDs
═══════════════════════════════════════════════════════════ */
function showResults() {
  if (resultScreen) resultScreen.classList.add('active')

  const acc    = session.totalRounds>0 ? Math.round(session.hits/session.totalRounds*100) : 0
  const avgMs  = session.roundTimings.length
    ? Math.round(session.roundTimings.reduce((a,b)=>a+b,0)/session.roundTimings.length) : null
  const grade  = acc>=90?'S RANK — ELITE':acc>=75?'A RANK — SHARP':acc>=60?'B RANK — SOLID':acc>=40?'C RANK — KEEP GOING':'D RANK — NEEDS WORK'
  const xpEarned = 50 + session.hits*2 + (acc>=90?30:0)

  const tx = (id,v) => { const e=document.getElementById(id); if(e) e.textContent=v }
  tx('tr-r-score',  session.score)
  tx('tr-r-grade',  grade)
  tx('tr-r-acc',    acc+'%')
  tx('tr-r-streak', session.bestStreak)
  tx('tr-r-speed',  avgMs ? (avgMs/1000).toFixed(2)+'s' : '—')
  tx('tr-r-rounds', session.totalRounds)
  tx('tr-r-xp',     '+'+xpEarned)

  // Zone breakdown
  const bd = document.getElementById('tr-r-bd')
  if (bd) {
    bd.innerHTML=''
    ALL_ZONES.forEach(dir => {
      const st=session.dirStats[dir]; if(!st||!st.total) return
      const pct=Math.round(st.hit/st.total*100)
      const color=pct>=80?'#39e07a':pct>=50?'#e0b43c':'#e05c5c'
      bd.innerHTML+=`
        <div class="tr-bd-row">
          <span style="min-width:88px;font-size:10px;letter-spacing:.8px">${dir}</span>
          <div class="tr-bd-bar-wrap"><div class="tr-bd-bar" style="width:${pct}%;background:${color}"></div></div>
          <span class="tr-bd-pct" style="color:${color}">${pct}%</span>
        </div>`
    })
    if (!Object.keys(session.dirStats).length)
      bd.innerHTML='<div style="font-size:11px;color:var(--text3)">No zones completed</div>'
  }

  speak(grade.split('—')[1]?.trim() || grade)
}

/* ═══════════════════════════════════════════════════════════
   RESET — full V1 state reset
═══════════════════════════════════════════════════════════ */
function resetTrainer() {
  poseRunning=false
  if (animFrameId) cancelAnimationFrame(animFrameId)
  stopCamera()

  calibrated=false; calibFrames=0; calibSumX=0; calibSumY=0
  centerX=null; centerY=null
  hipX=null; hipY=null; feetX=null; feetY=null
  smoothHipX=null; smoothHipY=null; smoothFeetX=null; smoothFeetY=null

  if (dirText)   { dirText.textContent='READY'; dirText.className='tr-dir-text' }
  if (feedback)  feedback.textContent='Press Start to begin'
  if (tNum)      tNum.textContent='—'
  if (poseBadge) { poseBadge.textContent='STANDBY'; poseBadge.className='' }
  setModelStatus('err','Standby')
  setRing(1); allZonePills()
}

/* ═══════════════════════════════════════════════════════════
   BUTTON WIRING — V2 IDs
═══════════════════════════════════════════════════════════ */

/* Start session */
const btnStart = document.getElementById('tr-btn-start') || document.querySelector('.tr-btn-start')
if (btnStart) {
  btnStart.addEventListener('click', async () => {
    // Check session limit via V2 auth
    if (window.AUTH && !window.AUTH.canStartSession()) {
      if (lockOverlay) lockOverlay.classList.remove('hidden')
      return
    }

    if (setupScreen) setupScreen.classList.remove('active')
    if (resultScreen) resultScreen.classList.remove('active')
    try { getAudio() } catch(e){}

    try {
      btnStart.disabled=true
      btnStart.textContent='Starting…'
      await startCamera()
      await loadModel()
      poseRunning=true
      detectPose()
      if (window.AUTH) window.AUTH.incrementSession().catch(()=>{})
      setTimeout(beginSession, 500)
    } catch(err) {
      setModelStatus('err','Error: '+(err.message||err))
      if (setupScreen) setupScreen.classList.add('active')
      btnStart.disabled=false
      btnStart.textContent='▶ Start Training Session'
    }
  })
}

/* Stop */
const btnStop = document.getElementById('tr-btn-stop')
if (btnStop) {
  btnStop.addEventListener('click', () => {
    session.active=false
    clearInterval(currentZoneCheckInterval); clearInterval(session.timerInterval)
    poseRunning=false
    if (animFrameId) cancelAnimationFrame(animFrameId)
    stopCamera()
    try {
      if (window.AUTH) {
        window.AUTH.recordSession({
          mode:'footwork', score:session.score, hits:session.hits,
          totalRounds:session.totalRounds, bestStreak:session.bestStreak,
          roundTimings:session.roundTimings, dirStats:session.dirStats,
        }).catch(()=>{})
        window.AUTH.incrementSession()
      }
    } catch(e){}
    showResults()
  })
}

/* Train Again */
const btnAgain = document.querySelector('.tr-btn-again')
if (btnAgain) {
  btnAgain.addEventListener('click', () => {
    if (resultScreen) resultScreen.classList.remove('active')
    resetTrainer()
    if (window.AUTH && !window.AUTH.canStartSession()) {
      if (lockOverlay) lockOverlay.classList.remove('hidden')
    } else {
      if (setupScreen) setupScreen.classList.add('active')
    }
  })
}

/* Back to dashboard */
const btnDash = document.querySelector('.tr-btn-dash')
if (btnDash) {
  btnDash.addEventListener('click', () => {
    resetTrainer()
    if (typeof window.UI !== 'undefined' && UI.tab) UI.tab('overview')
    else if (typeof switchTab === 'function') switchTab('overview')
  })
}

/* Escape key */
document.addEventListener('keydown', e => {
  if (e.key==='Escape' && btnStop) btnStop.click()
})

/* ═══════════════════════════════════════════════════════════
   EXPOSE as window.TR for any inline onclick calls in V2 HTML
═══════════════════════════════════════════════════════════ */
window.TR = {
  begin : () => btnStart?.click(),
  stop  : () => btnStop?.click(),
  reset : resetTrainer,
  setDiff(btn) {
    document.querySelectorAll('.tr-dp').forEach(b=>b.classList.remove('sel'))
    btn.classList.add('sel')
    selectedDiff=btn.dataset.diff
    const d=DIFFICULTY[selectedDiff]
    const dd=document.getElementById('tr-diff-desc'); if(dd) dd.textContent=d.label
    if(slRounds){slRounds.value=d.rounds;document.getElementById('tr-lbl-rounds').textContent=d.rounds;document.getElementById('tr-lbl-rounds-r').textContent=d.rounds}
    if(slTime){slTime.value=d.time;document.getElementById('tr-lbl-time').textContent=d.time+'s';document.getElementById('tr-lbl-time-r').textContent=d.time+'s'}
  },
  setGroup(btn) {
    document.querySelectorAll('.tr-zg-btn[data-tg]').forEach(b=>b.classList.remove('sel'))
    btn.classList.add('sel'); selectedGroup=btn.dataset.tg
  },
  setSetupGroup(btn) {
    document.querySelectorAll('.tr-zg-btn[data-sg]').forEach(b=>b.classList.remove('sel'))
    btn.classList.add('sel'); selectedGroup=btn.dataset.sg==='ctr'?'centre':btn.dataset.sg
  },
  cfg: session,
}

console.log('[trainer.js] V2+V1 AI loaded ✓')
