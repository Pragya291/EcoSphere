// ==========================================
// STATE MANAGEMENT & GLOBALS
// ==========================================
let state = {
  user_id: "demo_user",
  profile: {
    green_score: 745,
    xp: 3820,
    coins: 450,
    level: 4,
    streak: 6,
    rank: 4,
    phase: "Wildlife",
    completed_challenges: []
  },
  weather: {
    wind: false,
    rain: false,
    night: false
  },
  is_listening: false,
  contrast_mode: false,
  large_text: false,
  colorblind_mode: 0, // 0: none, 1: deuteranopia, 2: protanopia, 3: tritanopia
  screen_reader: false,
  charts: {},
  cameraStream: null,
  activeLeaderboard: 'global'
};

// ==========================================
// APPLICATION INITIALIZATION
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  initLandingCanvas();
  
  // Validate active login sessions
  checkSessionStatus();
  
  // Setup standard window resize for canvases
  window.addEventListener('resize', () => {
    resizeLandingCanvas();
    resizeEcosphereCanvas();
  });
});

function enterDashboard() {
  const landing = document.getElementById("landing-view");
  landing.classList.add("hidden");
  
  const dashboard = document.getElementById("dashboard-view");
  dashboard.style.display = "flex";
  
  // Show floating coach widget
  const floatCoach = document.getElementById("floating-coach");
  if (floatCoach) floatCoach.style.display = "block";
  
  // Trigger screen reader audio
  announceAccessibility("Entering EcoSphere Dashboard. Use keyboard controls or sidebar navigation.");
  
  // Load UI elements and animations
  setTimeout(() => {
    initCharts();
    initEcosphereCanvas();
    resizeEcosphereCanvas();
    animateEcosphere();
  }, 100);
  
  triggerToast("Welcome back to EcoSphere!", "success");
}

function announceAccessibility(text) {
  if (state.screen_reader) {
    const feedback = document.getElementById("speech-feedback");
    feedback.textContent = text;
    
    // Speak aloud using Web Speech API
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.pitch = 1.0;
      utterance.rate = 1.05;
      window.speechSynthesis.speak(utterance);
    }
  }
}

function toggleScreenReaderAnnounce(text) {
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(utterance);
  } else {
    triggerToast(text, "info");
  }
}

// ==========================================
// LANDING PAGE BACKGROUND CANVAS PARTICLES
// ==========================================
let landingCanvas, landingCtx;
let landingParticles = [];

function initLandingCanvas() {
  landingCanvas = document.getElementById("landing-canvas");
  if (!landingCanvas) return;
  landingCtx = landingCanvas.getContext("2d");
  resizeLandingCanvas();
  
  // Populate floating leaves/circles
  for (let i = 0; i < 40; i++) {
    landingParticles.push({
      x: Math.random() * landingCanvas.width,
      y: Math.random() * landingCanvas.height,
      radius: Math.random() * 6 + 2,
      color: Math.random() > 0.5 ? 'rgba(61, 220, 132, 0.15)' : 'rgba(0, 212, 255, 0.1)',
      vx: Math.random() * 0.4 - 0.2,
      vy: Math.random() * -0.5 - 0.2,
      wobble: Math.random() * Math.PI,
      wobbleSpeed: Math.random() * 0.02
    });
  }
  
  animateLandingCanvas();
}

function resizeLandingCanvas() {
  if (landingCanvas) {
    landingCanvas.width = window.innerWidth;
    landingCanvas.height = window.innerHeight;
  }
}

function animateLandingCanvas() {
  if (!landingCanvas) return;
  landingCtx.clearRect(0, 0, landingCanvas.width, landingCanvas.height);
  
  // Draw particles
  landingParticles.forEach(p => {
    p.y += p.vy;
    p.x += p.vx + Math.sin(p.wobble) * 0.2;
    p.wobble += p.wobbleSpeed;
    
    // Recycle particle at screen top/edges
    if (p.y < -10) {
      p.y = landingCanvas.height + 10;
      p.x = Math.random() * landingCanvas.width;
    }
    if (p.x < -10 || p.x > landingCanvas.width + 10) {
      p.x = Math.random() * landingCanvas.width;
    }
    
    landingCtx.beginPath();
    landingCtx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    landingCtx.fillStyle = p.color;
    landingCtx.shadowBlur = 10;
    landingCtx.shadowColor = p.color;
    landingCtx.fill();
    landingCtx.shadowBlur = 0; // reset
  });
  
  requestAnimationFrame(animateLandingCanvas);
}

// ==========================================
// VIEW SWITCHING (SINGLE PAGE NAV)
// ==========================================
function switchView(viewName) {
  // Hide all view panels
  const views = ['dashboard', 'flow', 'scanner', 'analytics', 'marketplace', 'community', 'tools', 'passport', 'profile'];
  views.forEach(v => {
    const el = document.getElementById(`view-${v}`);
    if (el) el.style.display = "none";
    
    const menu = document.getElementById(`menu-${v}`);
    if (menu) menu.classList.remove("active");
  });
  
  // Show active view
  const targetView = document.getElementById(`view-${viewName}`);
  if (targetView) targetView.style.display = viewName === 'dashboard' ? 'grid' : 'block';
  
  const activeMenu = document.getElementById(`menu-${viewName}`);
  if (activeMenu) activeMenu.classList.add("active");
  
  // Update section title header
  const titleMap = {
    'dashboard': 'Eco Dashboard',
    'flow': 'Eco Journey Loop',
    'scanner': 'AI Waste Scanner',
    'analytics': 'Footprint Analytics',
    'marketplace': 'Eco Marketplace',
    'community': 'Global Eco Community',
    'tools': 'Eco Detective & Guide',
    'passport': 'Eco Passport Booklet',
    'profile': 'My Profile'
  };
  document.getElementById("section-title").textContent = titleMap[viewName] || viewName;
  
  // Specific view loaders
  if (viewName === 'scanner') {
    startCamera();
    loadScanHistory();
  } else {
    stopCamera();
  }
  
  if (viewName === 'analytics') {
    setTimeout(initAnalyticsCharts, 100);
  }
  
  if (viewName === 'tools') {
    runCarbonDetective();
  }
  
  if (viewName === 'passport') {
    renderPassport();
  }
  
  if (viewName === 'profile') {
    loadProfile();
  }
  
  announceAccessibility(`Navigating to ${titleMap[viewName]} panel.`);
}

// ==========================================
// FETCHING DATA FROM BACKEND BLUEPRINTS
// ==========================================
function fetchPassportData() {
  fetch(`/api/passport?user_id=${state.user_id}`)
    .then(r => r.json())
    .then(data => {
      updateUIWithProfile(data.profile);
      loadMarketplace(data.marketplace_items);
      loadLeaderboard(data.leaderboard_global, data.leaderboard_universities);
      fetchChallenges();
    })
    .catch(err => {
      console.warn("Firestore not online. Running static client simulation.", err);
      // Fallback: load preset simulated challenges, marketplace and leaderboard locally
      loadMarketplace([]);
      loadLeaderboard([], []);
      simulateLocalChallenges();
    });
}

function updateUIWithProfile(profile) {
  state.profile = profile;
  
  // Update topbar badges
  document.getElementById("lbl-streak").textContent = profile.streak;
  document.getElementById("lbl-coins").textContent = profile.coins;
  document.getElementById("lbl-level").textContent = profile.level;
  
  // Update KPI card details
  const scoreEl = document.getElementById("lbl-greenscore");
  if (scoreEl) {
    animateValue(scoreEl, parseInt(scoreEl.textContent) || 0, profile.green_score, 1000);
  }
  
  // Update gauge dial dasharray
  const gauge = document.getElementById("gauge-circle");
  if (gauge) {
    // scale 1000 score to 100 dashoffset/dasharray percentage
    const dash = (profile.green_score / 1000.0) * 100;
    gauge.setAttribute("stroke-dasharray", `${dash.toFixed(1)}, 100`);
  }
  
  const phaseEl = document.getElementById("lbl-phase");
  if (phaseEl) phaseEl.textContent = profile.phase;
}

function fetchChallenges() {
  fetch(`/api/challenges?user_id=${state.user_id}`)
    .then(r => r.json())
    .then(data => {
      renderMissions(data.challenges);
    })
    .catch(() => simulateLocalChallenges());
}

function simulateLocalChallenges() {
  const mockChallenges = [
    { id: "scan_recycle", title: "Material Analyst", description: "Identify and recycle a plastic or metal item using the AI Waste Scanner.", difficulty: "Easy", xp_reward: 50, coins_reward: 50, completed: false },
    { id: "chat_energy", title: "Energy Audit", description: "Ask the AI Eco Coach about practical methods to reduce household vampire energy loads.", difficulty: "Medium", xp_reward: 40, coins_reward: 40, completed: false },
    { id: "water_conservation", title: "Aqua Saver", description: "Log water conservation by keeping your shower duration under 5 minutes.", difficulty: "Easy", xp_reward: 30, coins_reward: 30, completed: false },
    { id: "eco_marketplace", title: "Eco Patron", description: "Redeem your earned coins to plant a tree or sponsor a carbon offset coupon.", difficulty: "Hard", xp_reward: 80, coins_reward: 80, completed: false }
  ];
  
  // Sync completed tasks from local storage or memory state
  const completed = state.profile.completed_challenges || [];
  mockChallenges.forEach(c => {
    c.completed = completed.includes(c.id);
  });
  
  renderMissions(mockChallenges);
}

function renderMissions(challenges) {
  const container = document.getElementById("missions-container");
  if (!container) return;
  container.innerHTML = "";
  
  let doneCount = 0;
  
  challenges.forEach(ch => {
    if (ch.completed) doneCount++;
    
    const div = document.createElement("div");
    div.className = `mission-item ${ch.completed ? 'completed' : ''}`;
    div.innerHTML = `
      <div class="mission-checkbox" onclick="completeChallengeLocal('${ch.id}')"></div>
      <div class="mission-content">
        <div class="mission-title">${ch.title}</div>
        <div class="mission-desc">${ch.description}</div>
        <div class="mission-rewards">
          <span class="reward-tag reward-xp">+${ch.xp_reward} XP</span>
          <span class="reward-tag reward-coins">+${ch.coins_reward} coins</span>
        </div>
      </div>
    `;
    container.appendChild(div);
  });
  
  document.getElementById("lbl-missions-completed").textContent = `${doneCount}/${challenges.length} Done`;
}

function completeChallengeLocal(challengeId) {
  announceAccessibility("Completing challenge and auditing energy rewards.");
  
  fetch('/api/challenges/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: state.user_id, challenge_id: challengeId })
  })
  .then(r => r.json())
  .then(data => {
    if (data.success) {
      updateUIWithProfile(data.profile);
      renderMissions(data.challenges || []);
      triggerConfetti();
      triggerToast(data.message, "success");
    }
  })
  .catch(() => {
    // Offline simulation
    let completed = state.profile.completed_challenges || [];
    if (!completed.includes(challengeId)) {
      completed.push(challengeId);
      state.profile.completed_challenges = completed;
      
      // award static XP/coins
      state.profile.xp += 50;
      state.profile.coins += 50;
      state.profile.green_score = Math.min(state.profile.green_score + 25, 1000);
      
      updateUIWithProfile(state.profile);
      simulateLocalChallenges();
      triggerConfetti();
      triggerToast("Mock mission complete! Earned 50 Eco Coins.", "success");
    }
  });
}

// ==========================================
// ECO ECOSPHERE DYNAMIC CANVAS RENDERING
// ==========================================
let ecoCanvas, ecoCtx;
let ecoAnimationId;
let ecoFireflies = [];
let ecoClouds = [];
let leafSwamp = [];

function initEcosphereCanvas() {
  ecoCanvas = document.getElementById("ecosphere-canvas");
  if (!ecoCanvas) return;
  ecoCtx = ecoCanvas.getContext("2d");
  
  // Set initial dimensions
  resizeEcosphereCanvas();
  
  // Load clouds
  ecoClouds = [
    { x: 30, y: 40, size: 25, speed: 0.1 },
    { x: 180, y: 25, size: 35, speed: 0.08 },
    { x: 320, y: 50, size: 20, speed: 0.15 }
  ];
  
  // Load night fireflies
  ecoFireflies = [];
  for (let i = 0; i < 20; i++) {
    ecoFireflies.push({
      x: Math.random() * ecoCanvas.width,
      y: Math.random() * (ecoCanvas.height - 100) + 50,
      angle: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.4 + 0.1,
      size: Math.random() * 2 + 1,
      alpha: Math.random(),
      alphaSpeed: Math.random() * 0.02 + 0.01
    });
  }
}

function resizeEcosphereCanvas() {
  if (ecoCanvas) {
    const parent = ecoCanvas.parentElement;
    ecoCanvas.width = parent.clientWidth;
    ecoCanvas.height = parent.clientHeight;
  }
}

function toggleWeather(type) {
  state.weather[type] = !state.weather[type];
  
  const btn = document.getElementById(`btn-${type}`);
  if (btn) btn.classList.toggle("active", state.weather[type]);
  
  const stage = document.getElementById("ecosphere-stage");
  if (type === 'rain' && stage) {
    stage.classList.toggle("rainy", state.weather['rain']);
  }
  
  announceAccessibility(`Weather toggle: ${type} is now ${state.weather[type] ? 'activated' : 'deactivated'}`);
  triggerToast(`Weather set: ${type} ${state.weather[type] ? 'ON' : 'OFF'}`, "info");
}

function animateEcosphere() {
  if (!ecoCanvas) return;
  
  // Apply sky background
  let skyGrad;
  if (state.weather.night) {
    skyGrad = ecoCtx.createLinearGradient(0, 0, 0, ecoCanvas.height);
    skyGrad.addColorStop(0, '#040b12');
    skyGrad.addColorStop(1, '#09150f');
  } else {
    skyGrad = ecoCtx.createLinearGradient(0, 0, 0, ecoCanvas.height);
    skyGrad.addColorStop(0, '#0a2318');
    skyGrad.addColorStop(1, '#0e2b1e');
  }
  
  ecoCtx.fillStyle = skyGrad;
  ecoCtx.fillRect(0, 0, ecoCanvas.width, ecoCanvas.height);
  
  // 1. Draw Clouds (if not night)
  if (!state.weather.night) {
    ecoCtx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ecoClouds.forEach(c => {
      c.x += c.speed * (state.weather.wind ? 4 : 1);
      if (c.x > ecoCanvas.width + 50) c.x = -50;
      
      ecoCtx.beginPath();
      ecoCtx.arc(c.x, c.y, c.size, 0, Math.PI * 2);
      ecoCtx.arc(c.x + c.size * 0.7, c.y - 10, c.size * 0.8, 0, Math.PI * 2);
      ecoCtx.arc(c.x - c.size * 0.7, c.y, c.size * 0.6, 0, Math.PI * 2);
      ecoCtx.fill();
    });
  }
  
  // 2. Draw Wind Lines (if active)
  if (state.weather.wind) {
    ecoCtx.strokeStyle = 'rgba(199, 254, 115, 0.06)';
    ecoCtx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      let y = 60 + i * 50 + Math.sin(Date.now() * 0.002 + i) * 10;
      let xOffset = (Date.now() * 0.3) % (ecoCanvas.width + 100) - 50;
      
      ecoCtx.beginPath();
      ecoCtx.moveTo(xOffset, y);
      ecoCtx.quadraticCurveTo(xOffset + 40, y - 10, xOffset + 80, y);
      ecoCtx.stroke();
    }
  }
  
  // 3. Draw Ecosystem Floor / Hills
  let groundGrad = ecoCtx.createLinearGradient(0, ecoCanvas.height - 80, 0, ecoCanvas.height);
  groundGrad.addColorStop(0, '#112217');
  groundGrad.addColorStop(1, '#08120d');
  ecoCtx.fillStyle = groundGrad;
  
  ecoCtx.beginPath();
  ecoCtx.moveTo(0, ecoCanvas.height);
  ecoCtx.quadraticCurveTo(ecoCanvas.width * 0.35, ecoCanvas.height - 70, ecoCanvas.width * 0.7, ecoCanvas.height - 40);
  ecoCtx.quadraticCurveTo(ecoCanvas.width * 0.85, ecoCanvas.height - 30, ecoCanvas.width, ecoCanvas.height - 60);
  ecoCtx.lineTo(ecoCanvas.width, ecoCanvas.height);
  ecoCtx.lineTo(0, ecoCanvas.height);
  ecoCtx.fill();
  
  // 4. Evolving Ecosystem structures based on Score Phase
  const score = state.profile.green_score;
  const cx = ecoCanvas.width / 2;
  const cy = ecoCanvas.height - 45;
  
  drawEvolution(score, cx, cy);
  
  // 5. Draw Fireflies (if night)
  if (state.weather.night) {
    ecoFireflies.forEach(f => {
      // Brownian motion
      f.x += Math.cos(f.angle) * f.speed;
      f.y += Math.sin(f.angle) * f.speed;
      f.angle += Math.random() * 0.4 - 0.2;
      
      // Loop bounds
      if (f.x < 0) f.x = ecoCanvas.width;
      if (f.x > ecoCanvas.width) f.x = 0;
      if (f.y < 0) f.y = ecoCanvas.height - 50;
      if (f.y > ecoCanvas.height - 50) f.y = 50;
      
      f.alpha += f.alphaSpeed;
      if (f.alpha > 1 || f.alpha < 0) f.alphaSpeed = -f.alphaSpeed;
      f.alpha = Math.max(0, Math.min(1, f.alpha));
      
      ecoCtx.beginPath();
      ecoCtx.arc(f.x, f.y, f.size, 0, Math.PI * 2);
      ecoCtx.fillStyle = `rgba(199, 254, 115, ${f.alpha})`;
      ecoCtx.shadowBlur = 8;
      ecoCtx.shadowColor = 'var(--accent-lime)';
      ecoCtx.fill();
      ecoCtx.shadowBlur = 0;
    });
  }
  
  // 6. Draw Falling Rain (if active)
  if (state.weather.rain) {
    ecoCtx.strokeStyle = 'rgba(0, 212, 255, 0.25)';
    ecoCtx.lineWidth = 1.5;
    for (let i = 0; i < 15; i++) {
      let rx = (Math.random() * ecoCanvas.width + (Date.now() * 0.15)) % ecoCanvas.width;
      let ry = (Math.random() * ecoCanvas.height + (Date.now() * 0.5)) % ecoCanvas.height;
      ecoCtx.beginPath();
      ecoCtx.moveTo(rx, ry);
      ecoCtx.lineTo(rx - 3, ry + 15);
      ecoCtx.stroke();
    }
  }
  ecoAnimationId = requestAnimationFrame(animateEcosphere);
}

function drawEvolution(score, cx, cy) {
  if (score <= 100) {
    // Seed: draw seedling sprout
    drawSprout(cx, cy, 25);
  } 
  else if (score <= 250) {
    // Plant: small leafy plant
    drawPlant(cx, cy, 45);
    drawFlowers();
  } 
  else if (score <= 400) {
    // Tree: single beautiful tree
    drawTree(cx, cy, 70);
    drawFlowers();
  } 
  else if (score <= 550) {
    // Forest: multiple trees
    drawTree(cx - 50, cy + 5, 50);
    drawTree(cx + 60, cy + 10, 45);
    drawTree(cx, cy, 75); 
    drawFlowers();
  } 
  else if (score <= 700) {
    // River: forest + winding river + butterflies
    drawRiver();
    drawTree(cx - 60, cy + 5, 55);
    drawTree(cx + 70, cy + 10, 50);
    drawTree(cx, cy, 75);
    drawFlowers();
    drawButterflies();
  } 
  else if (score <= 850) {
    // Wildlife: Forest + river + birds + butterflies
    drawRiver();
    drawTree(cx - 70, cy + 5, 55);
    drawTree(cx + 80, cy + 10, 50);
    drawTree(cx, cy, 78);
    drawBirds();
    drawFlowers();
    drawButterflies();
  } 
  else if (score <= 950) {
    // Nature Reserve: Forest + mountains + river + birds + butterflies
    drawMountains(cx, cy);
    drawRiver();
    drawTree(cx - 70, cy + 15, 60);
    drawTree(cx + 80, cy + 20, 50);
    drawTree(cx, cy + 5, 80);
    drawBirds();
    drawFlowers();
    drawButterflies();
  } 
  else {
    // Paradise / Smart Eco City: clean tech turbines + green buildings + birds + butterflies
    drawMountains(cx, cy);
    drawRiver();
    drawFutureSkyline(cx, cy);
    drawTree(cx - 90, cy + 20, 45);
    drawTree(cx + 100, cy + 20, 50);
    drawWindTurbine(cx - 140, cy - 20, 30);
    drawWindTurbine(cx + 130, cy - 10, 25);
    drawBirds();
    drawFlowers();
    drawButterflies();
  }
}

function drawSprout(x, y, size) {
  ecoCtx.strokeStyle = 'var(--primary-emerald)';
  ecoCtx.lineWidth = 3;
  ecoCtx.lineCap = 'round';
  
  let sway = state.weather.wind ? Math.sin(Date.now() * 0.005) * 4 : 0;
  
  ecoCtx.beginPath();
  ecoCtx.moveTo(x, y);
  ecoCtx.quadraticCurveTo(x, y - size / 2, x + sway, y - size);
  ecoCtx.stroke();
  
  ecoCtx.fillStyle = 'var(--accent-lime)';
  ecoCtx.beginPath();
  ecoCtx.ellipse(x + sway, y - size, 4, 8, Math.PI / 4, 0, Math.PI * 2);
  ecoCtx.fill();
}

function drawPlant(x, y, height) {
  ecoCtx.strokeStyle = 'var(--primary-emerald)';
  ecoCtx.lineWidth = 4;
  ecoCtx.lineCap = 'round';
  
  let sway = state.weather.wind ? Math.sin(Date.now() * 0.004) * 5 : 0;
  
  ecoCtx.beginPath();
  ecoCtx.moveTo(x, y);
  ecoCtx.quadraticCurveTo(x, y - height * 0.6, x + sway, y - height);
  ecoCtx.stroke();
  
  ecoCtx.fillStyle = 'rgba(61, 220, 132, 0.7)';
  ecoCtx.beginPath();
  ecoCtx.ellipse(x + sway - 8, y - height + 10, 6, 12, -Math.PI / 6, 0, Math.PI * 2);
  ecoCtx.ellipse(x + sway + 8, y - height + 15, 6, 10, Math.PI / 6, 0, Math.PI * 2);
  ecoCtx.ellipse(x + sway, y - height, 8, 14, 0, 0, Math.PI * 2);
  ecoCtx.fill();
}

function drawTree(x, y, height) {
  let sway = state.weather.wind ? Math.sin(Date.now() * 0.003) * 6 : 0;
  
  ecoCtx.strokeStyle = '#5a3d28';
  ecoCtx.lineWidth = height * 0.1;
  ecoCtx.lineCap = 'round';
  
  ecoCtx.beginPath();
  ecoCtx.moveTo(x, y);
  ecoCtx.quadraticCurveTo(x, y - height * 0.5, x + sway, y - height);
  ecoCtx.stroke();
  
  ecoCtx.fillStyle = 'rgba(61, 220, 132, 0.4)';
  const radius = height * 0.35;
  
  ecoCtx.beginPath();
  ecoCtx.arc(x + sway, y - height, radius, 0, Math.PI * 2);
  ecoCtx.arc(x + sway - radius * 0.5, y - height + 10, radius * 0.8, 0, Math.PI * 2);
  ecoCtx.arc(x + sway + radius * 0.5, y - height + 8, radius * 0.8, 0, Math.PI * 2);
  ecoCtx.arc(x + sway, y - height - radius * 0.4, radius * 0.7, 0, Math.PI * 2);
  ecoCtx.fill();
  
  ecoCtx.fillStyle = 'rgba(199, 254, 115, 0.3)';
  ecoCtx.beginPath();
  ecoCtx.arc(x + sway, y - height, radius * 0.6, 0, Math.PI * 2);
  ecoCtx.fill();
}

function drawRiver() {
  ecoCtx.fillStyle = 'rgba(0, 212, 255, 0.6)';
  ecoCtx.beginPath();
  ecoCtx.moveTo(ecoCanvas.width * 0.25, ecoCanvas.height);
  // Bezier curve winding up the hill
  ecoCtx.bezierCurveTo(
    ecoCanvas.width * 0.3, ecoCanvas.height - 20,
    ecoCanvas.width * 0.55, ecoCanvas.height - 30,
    ecoCanvas.width * 0.65, ecoCanvas.height - 40
  );
  ecoCtx.lineTo(ecoCanvas.width * 0.68, ecoCanvas.height - 40);
  ecoCtx.bezierCurveTo(
    ecoCanvas.width * 0.58, ecoCanvas.height - 28,
    ecoCanvas.width * 0.35, ecoCanvas.height - 18,
    ecoCanvas.width * 0.32, ecoCanvas.height
  );
  ecoCtx.closePath();
  ecoCtx.fill();
}

let ecoButterflies = [];
function drawButterflies() {
  if (!ecoCanvas) return;
  if (ecoButterflies.length === 0) {
    for (let i = 0; i < 4; i++) {
      ecoButterflies.push({
        x: ecoCanvas.width * 0.3 + Math.random() * (ecoCanvas.width * 0.4),
        y: ecoCanvas.height - 100 - Math.random() * 80,
        angle: Math.random() * Math.PI * 2,
        speed: 0.5 + Math.random() * 0.5,
        color: i % 2 === 0 ? 'var(--secondary-cyan)' : 'var(--accent-lime)'
      });
    }
  }
  
  ecoButterflies.forEach(b => {
    b.x += Math.cos(b.angle) * b.speed;
    b.y += Math.sin(b.angle) * b.speed + Math.sin(Date.now() * 0.05) * 0.8;
    b.angle += Math.random() * 0.6 - 0.3;
    
    if (b.x < 20) b.x = ecoCanvas.width - 20;
    if (b.x > ecoCanvas.width - 20) b.x = 20;
    if (b.y < ecoCanvas.height - 180) b.y = ecoCanvas.height - 80;
    if (b.y > ecoCanvas.height - 40) b.y = ecoCanvas.height - 120;
    
    ecoCtx.fillStyle = b.color;
    ecoCtx.beginPath();
    ecoCtx.ellipse(b.x - 3, b.y, 4, 6, Math.PI / 4, 0, Math.PI * 2);
    ecoCtx.fill();
    ecoCtx.beginPath();
    ecoCtx.ellipse(b.x + 3, b.y, 4, 6, -Math.PI / 4, 0, Math.PI * 2);
    ecoCtx.fill();
    
    ecoCtx.fillStyle = '#fff';
    ecoCtx.beginPath();
    ecoCtx.arc(b.x, b.y, 1.5, 0, Math.PI * 2);
    ecoCtx.fill();
  });
}

function drawFlowers() {
  if (!ecoCanvas) return;
  const flowerPositions = [
    { x: ecoCanvas.width * 0.32, y: ecoCanvas.height - 45, color: '#ff5d73' },
    { x: ecoCanvas.width * 0.44, y: ecoCanvas.height - 35, color: '#ffb340' },
    { x: ecoCanvas.width * 0.58, y: ecoCanvas.height - 42, color: 'var(--secondary-cyan)' },
    { x: ecoCanvas.width * 0.66, y: ecoCanvas.height - 38, color: '#ff80df' }
  ];
  
  flowerPositions.forEach(f => {
    ecoCtx.strokeStyle = '#0e4d28';
    ecoCtx.lineWidth = 1.5;
    ecoCtx.beginPath();
    ecoCtx.moveTo(f.x, f.y);
    ecoCtx.lineTo(f.x, f.y - 12);
    ecoCtx.stroke();
    
    ecoCtx.fillStyle = f.color;
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 3) {
      let px = f.x + Math.cos(angle) * 3;
      let py = f.y - 12 + Math.sin(angle) * 3;
      ecoCtx.beginPath();
      ecoCtx.arc(px, py, 2, 0, Math.PI * 2);
      ecoCtx.fill();
    }
    
    ecoCtx.fillStyle = '#fff';
    ecoCtx.beginPath();
    ecoCtx.arc(f.x, f.y - 12, 1.8, 0, Math.PI * 2);
    ecoCtx.fill();
  });
}

function drawBirds() {
  ecoCtx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ecoCtx.lineWidth = 1.5;
  
  let time = Date.now() * 0.003;
  for (let i = 0; i < 3; i++) {
    // Fly across sky
    let bx = (Date.now() * 0.04 + i * 80) % (ecoCanvas.width + 100) - 50;
    let by = 50 + i * 20 + Math.sin(time + i) * 8;
    
    // flap wing height
    let flap = Math.sin(Date.now() * 0.015 + i) * 4;
    
    ecoCtx.beginPath();
    ecoCtx.moveTo(bx - 8, by - flap);
    ecoCtx.quadraticCurveTo(bx - 4, by - 4, bx, by);
    ecoCtx.quadraticCurveTo(bx + 4, by - 4, bx + 8, by - flap);
    ecoCtx.stroke();
  }
}

function drawMountains(cx, cy) {
  ecoCtx.fillStyle = '#0a1d15';
  
  ecoCtx.beginPath();
  ecoCtx.moveTo(-30, cy + 20);
  ecoCtx.lineTo(ecoCanvas.width * 0.3, cy - 60);
  ecoCtx.lineTo(ecoCanvas.width * 0.6, cy + 20);
  ecoCtx.fill();
  
  ecoCtx.fillStyle = '#081711';
  ecoCtx.beginPath();
  ecoCtx.moveTo(ecoCanvas.width * 0.4, cy + 20);
  ecoCtx.lineTo(ecoCanvas.width * 0.75, cy - 80);
  ecoCtx.lineTo(ecoCanvas.width + 30, cy + 20);
  ecoCtx.fill();
}

function drawFutureSkyline(cx, cy) {
  // Semi-transparent solar-glass skyscrapers
  ecoCtx.fillStyle = 'rgba(0, 212, 255, 0.1)';
  ecoCtx.strokeStyle = 'rgba(0, 212, 255, 0.3)';
  ecoCtx.lineWidth = 1;
  
  // Smart buildings
  const buildings = [
    { x: cx - 40, w: 24, h: 80 },
    { x: cx + 20, w: 20, h: 95 },
    { x: cx + 45, w: 28, h: 65 }
  ];
  
  buildings.forEach(b => {
    ecoCtx.fillRect(b.x, cy - b.h, b.w, b.h);
    ecoCtx.strokeRect(b.x, cy - b.h, b.w, b.h);
    
    // Horizontal glowing green grid lines represent vertical gardens
    ecoCtx.strokeStyle = 'rgba(61, 220, 132, 0.35)';
    ecoCtx.beginPath();
    ecoCtx.moveTo(b.x + 2, cy - b.h + 20);
    ecoCtx.lineTo(b.x + b.w - 2, cy - b.h + 20);
    ecoCtx.moveTo(b.x + 2, cy - b.h + 45);
    ecoCtx.lineTo(b.x + b.w - 2, cy - b.h + 45);
    ecoCtx.stroke();
    
    ecoCtx.strokeStyle = 'rgba(0, 212, 255, 0.3)';
  });
}

function drawWindTurbine(x, y, height) {
  // Tower post
  ecoCtx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ecoCtx.lineWidth = 2.5;
  ecoCtx.beginPath();
  ecoCtx.moveTo(x, y);
  ecoCtx.lineTo(x, y - height);
  ecoCtx.stroke();
  
  // Blades rotate
  let angle = Date.now() * 0.0025;
  ecoCtx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ecoCtx.lineWidth = 2;
  
  for (let i = 0; i < 3; i++) {
    let bladeAngle = angle + (i * Math.PI * 2 / 3);
    let bx = x + Math.cos(bladeAngle) * (height * 0.6);
    let by = y - height + Math.sin(bladeAngle) * (height * 0.6);
    
    ecoCtx.beginPath();
    ecoCtx.moveTo(x, y - height);
    ecoCtx.lineTo(bx, by);
    ecoCtx.stroke();
  }
  
  // Node cap
  ecoCtx.fillStyle = '#fff';
  ecoCtx.beginPath();
  ecoCtx.arc(x, y - height, 3, 0, Math.PI*2);
  ecoCtx.fill();
}

// ==========================================
// AI TWIN & DASHBOARD CHARTS
// ==========================================
function initCharts() {
  const twinCtx = document.getElementById("chart-twin-projection");
  if (!twinCtx) return;
  
  // Destroy existing if loaded
  if (state.charts.twin) state.charts.twin.destroy();
  
  fetch('/api/timeline')
    .then(r => r.json())
    .then(data => {
      renderTwinChart(data.forecast);
    })
    .catch(() => {
      // Local simulated chart fallback
      const mockForecast = {
        periods: ["Today", "30 Days", "90 Days", "1 Year"],
        current_track: [0, 240, 720, 2920],
        future_green: [0, 110, 310, 1095],
        future_high_carbon: [0, 480, 1440, 5840]
      };
      renderTwinChart(mockForecast);
    });
}

function renderTwinChart(forecast) {
  const ctx = document.getElementById("chart-twin-projection").getContext('2d');
  
  state.charts.twin = new Chart(ctx, {
    type: 'line',
    data: {
      labels: forecast.periods,
      datasets: [
        {
          label: 'Current Track',
          data: forecast.current_track,
          borderColor: '#00D4FF',
          borderWidth: 2,
          fill: false,
          tension: 0.2
        },
        {
          label: 'Future Green You',
          data: forecast.future_green,
          borderColor: '#3DDC84',
          borderWidth: 3.5,
          fill: false,
          tension: 0.2
        },
        {
          label: 'Future High Carbon You',
          data: forecast.future_high_carbon,
          borderColor: '#FF5D73',
          borderWidth: 2,
          borderDash: [5, 5],
          fill: false,
          tension: 0.2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#B8C2B3' }
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#B8C2B3' }
        }
      }
    }
  });
}

// Analytics view charts
function initAnalyticsCharts() {
  const trendsCtx = document.getElementById("chart-analytics-trends");
  const sectorsCtx = document.getElementById("chart-analytics-sectors");
  
  if (!trendsCtx || !sectorsCtx) return;
  
  if (state.charts.trends) state.charts.trends.destroy();
  if (state.charts.sectors) state.charts.sectors.destroy();
  
  // Weekly footprint comparison chart
  state.charts.trends = new Chart(trendsCtx.getContext('2d'), {
    type: 'bar',
    data: {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      datasets: [
        {
          label: 'Actual Footprint (kg)',
          data: [6.2, 5.8, 7.1, 4.2, 5.0, 3.1, 2.8],
          backgroundColor: 'rgba(255, 93, 115, 0.4)',
          borderColor: '#FF5D73',
          borderWidth: 1.5
        },
        {
          label: 'Avoided Carbon (kg)',
          data: [2.5, 4.0, 1.8, 5.2, 3.8, 6.0, 7.5],
          backgroundColor: 'rgba(61, 220, 132, 0.4)',
          borderColor: '#3DDC84',
          borderWidth: 1.5
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#fff' } } },
      scales: {
        x: { ticks: { color: '#B8C2B3' } },
        y: { ticks: { color: '#B8C2B3' } }
      }
    }
  });
  
  // Sectors Radar chart
  state.charts.sectors = new Chart(sectorsCtx.getContext('2d'), {
    type: 'radar',
    data: {
      labels: ['Waste Diversion', 'Energy Efficiency', 'Water Conservation', 'Transit Savings', 'Diet Adjustment'],
      datasets: [{
        label: 'Eco Performance (%)',
        data: [85, 60, 90, 75, 50],
        backgroundColor: 'rgba(0, 212, 255, 0.2)',
        borderColor: '#00D4FF',
        borderWidth: 2,
        pointBackgroundColor: '#C7FE73'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        r: {
          grid: { color: 'rgba(255,255,255,0.08)' },
          angleLines: { color: 'rgba(255,255,255,0.08)' },
          pointLabels: { color: '#B8C2B3', font: { size: 10 } },
          ticks: { display: false }
        }
      }
    }
  });
}

// ==========================================
// MANUAL ACTIVITY LOGGING (ANALYTICS VIEW)
// ==========================================
function logManualActivity() {
  const type = document.getElementById("log-activity").value;
  const qty = parseFloat(document.getElementById("log-qty").value) || 1.0;
  
  fetch('/api/tips/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: state.user_id, activity_type: type, quantity: qty })
  })
  .then(r => r.json())
  .then(data => {
    if (data.success) {
      updateUIWithProfile(data.profile);
      
      // Update carbon/water/energy totals visually
      document.getElementById("lbl-co2-saved").textContent = (parseFloat(document.getElementById("lbl-co2-saved").textContent) + data.savings.co2).toFixed(1);
      document.getElementById("lbl-energy-saved").textContent = (parseFloat(document.getElementById("lbl-energy-saved").textContent) + data.savings.energy).toFixed(1);
      document.getElementById("lbl-water-saved").textContent = (parseInt(document.getElementById("lbl-water-saved").textContent) + Math.round(data.savings.water));
      
      triggerToast(`Activity Logged! Saved ${data.savings.co2}kg CO₂`, "success");
      
      if (data.savings.mission_completed) {
        triggerConfetti();
        showAchievementModal(data.savings.mission_completed, "Awarded 30 Eco Coins and level-up XP for logging water conservations.");
        fetchChallenges();
      }
    }
  })
  .catch(() => {
    // offline simulation
    triggerToast("Offline mode. Logged 1.2kg carbon savings simulation.", "success");
    state.profile.green_score = Math.min(state.profile.green_score + 15, 1000);
    state.profile.coins += 20;
    updateUIWithProfile(state.profile);
  });
}

// ==========================================
// AI CAMERA SCANNER & VOICE INTEGRATIONS
// ==========================================
state.cameraFacingMode = "environment"; // default rear camera
state.latestScan = null;
let currentUtterance = null;

function startCamera(facingMode) {
  const video = document.getElementById("camera-feed");
  const overlay = document.getElementById("scanner-overlay");
  const previewImg = document.getElementById("scan-preview-img");
  const btnCapture = document.getElementById("btn-capture");
  const btnSnap = document.getElementById("btn-snap");
  const btnSwitch = document.getElementById("btn-switch-cam");
  const btnRetake = document.getElementById("btn-retake");
  
  const mode = facingMode || state.cameraFacingMode || "environment";

  if (previewImg) previewImg.style.display = "none";

  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    // Stop any existing stream first
    if (state.cameraStream) {
      state.cameraStream.getTracks().forEach(track => track.stop());
    }

    navigator.mediaDevices.getUserMedia({ video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 720 } } })
      .then(stream => {
        state.cameraStream = stream;
        state.cameraFacingMode = mode;
        video.srcObject = stream;
        video.style.display = "block";
        if (overlay) overlay.style.display = "none";
        if (btnCapture) btnCapture.style.display = "none";
        if (btnSnap) btnSnap.style.display = "inline-flex";
        if (btnSwitch) btnSwitch.style.display = "inline-flex";
        if (btnRetake) btnRetake.style.display = "inline-flex";
        
        announceAccessibility("Webcam feed active. Center object in view.");
        triggerToast("Camera connected successfully.", "success");
      })
      .catch(err => {
        console.error("Camera access error: ", err);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          triggerToast("Camera access was denied. Please enable camera permission in your browser or upload an image file.", "danger");
        } else {
          triggerToast("Could not access camera device. Please upload an image file instead.", "warning");
        }
      });
  } else {
    triggerToast("Webcam is not supported on this browser. Use photo upload instead.", "warning");
  }
}

function toggleCameraFacing() {
  const newMode = state.cameraFacingMode === "environment" ? "user" : "environment";
  startCamera(newMode);
}

function stopCamera() {
  if (state.cameraStream) {
    state.cameraStream.getTracks().forEach(track => track.stop());
    state.cameraStream = null;
  }
  const video = document.getElementById("camera-feed");
  if (video) video.style.display = "none";
}

function resetScannerView() {
  stopCamera();
  const overlay = document.getElementById("scanner-overlay");
  const previewImg = document.getElementById("scan-preview-img");
  const resultsCard = document.getElementById("card-scan-results");
  const btnCapture = document.getElementById("btn-capture");
  const btnSnap = document.getElementById("btn-snap");
  const btnSwitch = document.getElementById("btn-switch-cam");
  const btnRetake = document.getElementById("btn-retake");

  if (previewImg) previewImg.style.display = "none";
  if (overlay) overlay.style.display = "flex";
  if (resultsCard) resultsCard.style.display = "none";
  if (btnCapture) btnCapture.style.display = "inline-flex";
  if (btnSnap) btnSnap.style.display = "none";
  if (btnSwitch) btnSwitch.style.display = "none";
  if (btnRetake) btnRetake.style.display = "none";

  stopVoiceReport();
}

function capturePhoto() {
  const video = document.getElementById("camera-feed");
  if (!video || !video.videoWidth) {
    triggerToast("Camera feed not ready yet. Please wait.", "warning");
    return;
  }

  const canvas = document.createElement("canvas");
  const maxDim = 1024;
  let w = video.videoWidth;
  let h = video.videoHeight;
  if (w > maxDim || h > maxDim) {
    if (w > h) { h = Math.round((h * maxDim) / w); w = maxDim; }
    else { w = Math.round((w * maxDim) / h); h = maxDim; }
  }
  canvas.width = w;
  canvas.height = h;
  
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, w, h);
  const base64Image = canvas.toDataURL("image/jpeg", 0.85);

  // Show captured photo preview
  const previewImg = document.getElementById("scan-preview-img");
  if (previewImg) {
    previewImg.src = base64Image;
    previewImg.style.display = "block";
  }
  video.style.display = "none";

  stopCamera();
  processImageScan(base64Image, "cam_shot.jpg");
}

function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    triggerToast("Please select a valid image file (JPG, PNG, WebP).", "danger");
    return;
  }
  
  const reader = new FileReader();
  reader.onload = function(e) {
    const rawUrl = e.target.result;
    compressAndProcessImage(rawUrl, file.name);
  };
  reader.readAsDataURL(file);
}

function handleFileDrop(event) {
  event.preventDefault();
  const file = event.dataTransfer.files[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    triggerToast("Please drop a valid image file.", "danger");
    return;
  }
  
  const reader = new FileReader();
  reader.onload = function(e) {
    compressAndProcessImage(e.target.result, file.name);
  };
  reader.readAsDataURL(file);
}

function compressAndProcessImage(dataUrl, filename) {
  const img = new Image();
  img.onload = function() {
    const canvas = document.createElement("canvas");
    const maxDim = 1024;
    let w = img.width;
    let h = img.height;
    if (w > maxDim || h > maxDim) {
      if (w > h) { h = Math.round((h * maxDim) / w); w = maxDim; }
      else { w = Math.round((w * maxDim) / h); h = maxDim; }
    }
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, w, h);
    const compressedBase64 = canvas.toDataURL("image/jpeg", 0.85);

    // Set preview
    const previewImg = document.getElementById("scan-preview-img");
    const overlay = document.getElementById("scanner-overlay");
    if (previewImg) {
      previewImg.src = compressedBase64;
      previewImg.style.display = "block";
    }
    if (overlay) overlay.style.display = "none";
    document.getElementById("camera-feed").style.display = "none";

    const btnRetake = document.getElementById("btn-retake");
    if (btnRetake) btnRetake.style.display = "inline-flex";

    processImageScan(compressedBase64, filename);
  };
  img.src = dataUrl;
}

function processImageScan(base64Data, filename) {
  const laser = document.getElementById("scanner-laser");
  const statusOverlay = document.getElementById("scanner-status-overlay");
  const statusBadge = document.getElementById("scan-api-status-badge");

  if (laser) laser.style.display = "block";
  if (statusOverlay) statusOverlay.style.display = "flex";
  if (statusBadge) {
    statusBadge.textContent = "⏳ Analyzing with Vision AI...";
    statusBadge.style.color = "#f9a826";
    statusBadge.style.background = "rgba(249,168,38,0.15)";
  }
  
  announceAccessibility("AI waste scanner running. Analyzing material composition and environmental impact.");
  
  fetch('/api/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: state.user_id, image: base64Data, filename: filename })
  })
  .then(r => r.json())
  .then(data => {
    if (laser) laser.style.display = "none";
    if (statusOverlay) statusOverlay.style.display = "none";
    if (statusBadge) {
      statusBadge.textContent = "🟢 Vision AI Ready";
      statusBadge.style.color = "#52e065";
      statusBadge.style.background = "rgba(82,224,101,0.15)";
    }

    if (data.success && data.scan) {
      state.latestScan = data.scan;
      if (data.profile) updateUIWithProfile(data.profile);
      displayScanResult(data.scan);

      if (data.is_duplicate) {
        triggerToast(`Scan recorded! Reward previously earned within 30s.`, "info");
      } else {
        triggerConfetti();
        triggerToast(`Scanned successfully: ${data.scan.material}! +${data.scan.xp_earned} Eco Coins earned`, "success");
      }
      
      // Auto complete challenge
      if (data.scan.recyclable) {
        completeChallengeLocal("scan_recycle");
      }
      loadScanHistory();
    }
  })
  .catch(err => {
    if (laser) laser.style.display = "none";
    if (statusOverlay) statusOverlay.style.display = "none";
    if (statusBadge) {
      statusBadge.textContent = "🟢 Offline Mode";
      statusBadge.style.color = "#52e065";
    }
    console.error("Scan API error: ", err);
    triggerToast("AI analysis complete (offline simulation mode).", "info");
    
    const mockScan = {
      material: "PET Plastic Bottle",
      category: "Plastic Packaging",
      confidence: 0.95,
      recyclable: true,
      disposal_recommendation: "Empty, rinse and place in plastic recycling bin.",
      environmental_impact: "Moderate (450 yrs breakdown)",
      eco_alternative: "Switch to a reusable stainless steel water bottle.",
      explanation: "PET (#1) is highly recyclable into polyester fibers and new bottles.",
      is_uncertain: false,
      reuse_ideas: ["Cut in half for seedling planter", "Clean and reuse for dry bean storage"],
      decomposition_time: "450 Years",
      co2_impact: -0.083,
      xp_earned: 50,
      coins_earned: 50
    };
    state.latestScan = mockScan;
    displayScanResult(mockScan);
    
    state.profile.green_score = Math.min(state.profile.green_score + 25, 1000);
    state.profile.coins += 50;
    state.profile.xp += 50;
    updateUIWithProfile(state.profile);
    completeChallengeLocal("scan_recycle");
    loadScanHistory();
  });
}

function displayScanResult(scan) {
  const resultsCard = document.getElementById("card-scan-results");
  if (resultsCard) resultsCard.style.display = "block";

  setText("res-material", scan.material || "Waste Item");
  setText("res-explanation", scan.explanation || "Analyzed by EcoSphere AI.");
  
  const catBadge = document.getElementById("res-category-badge");
  if (catBadge) catBadge.textContent = scan.category || "General Waste";

  const recycBadge = document.getElementById("res-recyclable-badge");
  if (recycBadge) {
    if (scan.recyclable) {
      recycBadge.textContent = "♻️ Recyclable";
      recycBadge.style.color = "#52e065";
      recycBadge.style.borderColor = "rgba(82,224,101,0.4)";
    } else {
      recycBadge.textContent = "⚠️ Special Disposal / Compost";
      recycBadge.style.color = "#f9a826";
      recycBadge.style.borderColor = "rgba(249,168,38,0.4)";
    }
  }

  const confPercent = Math.round((scan.confidence || 0.90) * 100);
  setText("res-confidence-text", `${confPercent}%`);

  // Show uncertainty box if confidence is low or is_uncertain
  const uncBox = document.getElementById("scan-uncertainty-box");
  if (uncBox) {
    uncBox.style.display = (scan.is_uncertain || confPercent < 60) ? "block" : "none";
  }

  setText("res-disposal", scan.disposal_recommendation || "Place in designated collection container.");
  setText("res-alternative", scan.eco_alternative || "Use a durable reusable alternative.");
  setText("res-decomp", scan.decomposition_time || "Varies");
  setText("res-co2", `${scan.co2_impact || -0.05} kg CO₂`);

  const reuseUl = document.getElementById("res-reuse");
  if (reuseUl) {
    reuseUl.innerHTML = "";
    const ideas = scan.reuse_ideas || ["Repurpose as a planter or household organizer."];
    ideas.forEach(idea => {
      const li = document.createElement("li");
      li.textContent = idea;
      reuseUl.appendChild(li);
    });
  }

  const earnedXP = scan.xp_earned || scan.coins_earned || 40;
  setText("res-reward", scan.is_duplicate ? "Reward claimed previously (30s rule)" : `+${earnedXP} Eco Coins & +${earnedXP} XP`);

  // Scroll results card into view smoothly
  resultsCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  announceAccessibility(`Scan complete. Detected ${scan.material}. ${scan.disposal_recommendation}`);
}

// Voice Output (TTS) Controls for Scan Results
function getScanVoiceSummary() {
  if (!state.latestScan) return "No recent scan result available to read.";
  const s = state.latestScan;
  const conf = Math.round((s.confidence || 0.9) * 100);
  return `I detected a ${s.material} with ${conf} percent confidence. Recommended disposal: ${s.disposal_recommendation || 'place in recycling bin'}. Recommended eco alternative: ${s.eco_alternative || 'use reusable option'}.`;
}

function playVoiceReport() {
  if (!('speechSynthesis' in window)) {
    triggerToast("Voice text-to-speech is not supported on this browser.", "warning");
    return;
  }
  const text = getScanVoiceSummary();
  window.speechSynthesis.cancel(); // clear previous
  currentUtterance = new SpeechSynthesisUtterance(text);
  currentUtterance.rate = 1.0;
  
  currentUtterance.onstart = () => {
    setText("voice-player-status", "▶ Playing AI scan report aloud...");
  };
  currentUtterance.onend = () => {
    setText("voice-player-status", "✓ Voice report finished.");
  };
  currentUtterance.onerror = () => {
    setText("voice-player-status", "Voice playback error.");
  };
  
  window.speechSynthesis.speak(currentUtterance);
}

function pauseVoiceReport() {
  if (window.speechSynthesis && window.speechSynthesis.speaking) {
    window.speechSynthesis.pause();
    setText("voice-player-status", "⏸ Voice report paused.");
  }
}

function resumeVoiceReport() {
  if (window.speechSynthesis && window.speechSynthesis.paused) {
    window.speechSynthesis.resume();
    setText("voice-player-status", "▶ Voice report resumed.");
  } else {
    playVoiceReport();
  }
}

function stopVoiceReport() {
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
    setText("voice-player-status", "■ Voice report stopped.");
  }
}

function replayVoiceReport() {
  stopVoiceReport();
  playVoiceReport();
}

// Ask follow-up question using scan context
function askScanQuestion(qText) {
  const coachPanel = document.getElementById("floating-coach-panel");
  if (coachPanel && coachPanel.style.display === "none") {
    toggleFloatingCoachPanel();
  }
  const input = document.getElementById("chat-input");
  if (input) {
    input.value = qText;
    sendCoachMessage();
  }
}

function loadScanHistory() {
  fetch(`/api/scan/history?user_id=${state.user_id}`)
    .then(r => r.json())
    .then(scans => {
      const container = document.getElementById("scan-history-list");
      if (!container) return;
      if (!scans || scans.length === 0) {
        container.innerHTML = `<div style="font-size:0.75rem; color:#64748b; text-align:center; padding:12px;">No scan history recorded yet.</div>`;
        return;
      }
      container.innerHTML = scans.map(s => {
        const confPct = Math.round((s.confidence || 0.9) * 100);
        const dt = s.scanned_at ? new Date(s.scanned_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent';
        return `
          <div style="display:flex; align-items:center; justify-content:space-between; padding:8px 12px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); border-radius:8px;">
            <div style="display:flex; align-items:center; gap:10px;">
              <div style="width:32px; height:32px; border-radius:50%; background:rgba(82,224,101,0.15); border:1px solid rgba(82,224,101,0.3); display:flex; align-items:center; justify-content:center; font-size:0.9rem;">📷</div>
              <div>
                <div style="font-size:0.8rem; font-weight:700; color:#fff;">${s.material || 'Waste Item'}</div>
                <div style="font-size:0.65rem; color:#64748b;">${s.category || 'General'} · ${confPct}% AI confidence</div>
              </div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:0.72rem; font-weight:700; color:#f9a826;">+${s.coins_earned || 40} 🪙</div>
              <div style="font-size:0.62rem; color:#475569;">${dt}</div>
            </div>
          </div>
        `;
      }).join('');
    })
    .catch(err => console.error("Error loading scan history:", err));
}

// ==========================================
// AI ECO COACH CHAT SPEECH INTEGRATIONS
// ==========================================
let chatHistoryList = [
  { sender: 'coach', text: "Hello! I am your AI Eco Coach. Ask me any question or ask about your latest scan!" }
];

function handleChatKey(event) {
  if (event.key === 'Enter') {
    sendCoachMessage();
  }
}

function sendCoachMessage() {
  const input = document.getElementById("chat-input");
  const text = input.value.trim();
  if (!text) return;
  
  input.value = "";
  appendChatBubble('user', text);
  
  chatHistoryList.push({ sender: 'user', text: text });
  
  // Append temporary loading skeleton bubble
  const historyBox = document.getElementById("chat-history");
  const loader = document.createElement("div");
  loader.className = "chat-bubble coach skeleton";
  loader.style.width = "100px";
  loader.style.height = "16px";
  historyBox.appendChild(loader);
  historyBox.scrollTop = historyBox.scrollHeight;
  
  fetch('/api/mentor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      user_id: state.user_id, 
      message: text, 
      history: chatHistoryList,
      latest_scan: state.latestScan 
    })
  })
  .then(r => r.json())
  .then(data => {
    loader.remove();
    if (data.success) {
      appendChatBubble('coach', data.response);
      chatHistoryList.push({ sender: 'coach', text: data.response });
      
      // Speak out loud (Voice reply)
      speakCoachReply(data.response);
      announceAccessibility(data.response);
      
      if (data.completed_mission) {
        updateUIWithProfile(data.profile);
        triggerConfetti();
        showAchievementModal(data.completed_mission, "Awarded 40 Eco Coins and levels points for energy audit queries.");
        fetchChallenges();
      }
    }
  })
  .catch(() => {
    loader.remove();
    // offline simulation with latest_scan context support
    let simText = "Understood. Composting organic materials diverts food waste from landfills, reducing carbon footprint.";
    if (state.latestScan && state.latestScan.material) {
      const mat = state.latestScan.material;
      if (text.toLowerCase().includes("what") || text.toLowerCase().includes("item")) {
        simText = `You scanned a ${mat}. Disposal advice: ${state.latestScan.disposal_recommendation || 'place in designated recycling'}.`;
      } else if (text.toLowerCase().includes("recycle")) {
        simText = `${mat} is ${state.latestScan.recyclable ? 'recyclable' : 'not recyclable in standard bins'}. ${state.latestScan.disposal_recommendation}`;
      } else if (text.toLowerCase().includes("alternative")) {
        simText = `The eco-friendly alternative for ${mat} is: ${state.latestScan.eco_alternative || 'use reusable options'}.`;
      }
    }
    appendChatBubble('coach', simText);
    chatHistoryList.push({ sender: 'coach', text: simText });
    speakCoachReply(simText);
    announceAccessibility(simText);
  });
}

function appendChatBubble(sender, text) {
  const historyBox = document.getElementById("chat-history");
  const div = document.createElement("div");
  div.className = `chat-bubble ${sender}`;
  div.textContent = text;
  historyBox.appendChild(div);
  historyBox.scrollTop = historyBox.scrollHeight;
}

// Dictation input (Speech Recognition API) with visual status badges
let recognition;
function toggleSpeechRecog() {
  const micBtn = document.getElementById("btn-mic");
  const badge = document.getElementById("voice-mic-badge");
  const transBox = document.getElementById("speech-transcribed-box");
  const transText = document.getElementById("speech-transcribed-text");
  
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    triggerToast("Speech recognition is not supported on this browser. You can type your question instead.", "warning");
    if (badge) {
      badge.textContent = "⚠️ Speech not supported — Type input";
      badge.style.color = "#f9a826";
    }
    return;
  }
  
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  if (!recognition) {
    recognition = new SpeechRec();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    
    recognition.onstart = () => {
      state.is_listening = true;
      if (micBtn) {
        micBtn.classList.add("listening");
        micBtn.textContent = "🛑";
      }
      if (badge) {
        badge.textContent = "🎙 Listening... Speak now";
        badge.style.color = "#f9a826";
      }
      triggerToast("Listening... Speak your eco question now.", "info");
    };
    
    recognition.onend = () => {
      state.is_listening = false;
      if (micBtn) {
        micBtn.classList.remove("listening");
        micBtn.textContent = "🎤";
      }
      if (badge) {
        badge.textContent = "✓ Response ready / Idle";
        badge.style.color = "#52e065";
      }
    };
    
    recognition.onresult = (event) => {
      const speechToText = event.results[0][0].transcript;
      const input = document.getElementById("chat-input");
      if (input) input.value = speechToText;
      
      if (transBox && transText) {
        transText.textContent = `"${speechToText}"`;
        transBox.style.display = "block";
      }
      if (badge) {
        badge.textContent = "⏳ Processing speech...";
        badge.style.color = "#00d4ff";
      }

      triggerToast(`Recognized: "${speechToText}"`, "success");
      sendCoachMessage();
    };
    
    recognition.onerror = (e) => {
      console.error("Speech recognition error:", e);
      if (badge) {
        badge.textContent = "⚠️ Mic Error — Try again or type";
        badge.style.color = "#ff5d73";
      }
      triggerToast("Microphone error. Please check permissions or type your question.", "danger");
    };
  }
  
  if (state.is_listening) {
    recognition.stop();
  } else {
    try {
      recognition.start();
    } catch (e) {
      console.error(e);
      recognition.stop();
    }
  }
}


// ==========================================
// ECO MARKETPLACE REDEMPTIONS
// ==========================================
let marketplaceItemsData = [];

function loadMarketplace(items) {
  const container = document.getElementById("marketplace-container");
  if (!container) return;
  container.innerHTML = "";
  
  // If api items is empty list, fallback mock list
  marketplaceItemsData = items.length ? items : [
    { id: "plant_tree", title: "Plant a Mangrove Tree", description: "Sponsor planting a real mangrove tree in Madagascar.", cost: 150, category: "Action", reward_text: "Mangrove Tree Planted!" },
    { id: "ngo_donate", title: "Ocean Cleanup Donation", description: "Redeem coins to donate $5 to clean marine environments.", cost: 200, category: "Donation", reward_text: "$5 Donated to Ocean Cleanup!" },
    { id: "carbon_offset", title: "50kg Verified CO₂ Offset", description: "Retire a carbon credit certificate via Gold Standard.", cost: 100, category: "Offset", reward_text: "50kg CO₂ Offset!" },
    { id: "premium_theme", title: "Glassmorphism Themes", description: "Unlock Cyberpunk Neon and Sahara design overlays.", cost: 80, category: "Cosmetics", reward_text: "Premium Themes unlocked!" }
  ];
  
  marketplaceItemsData.forEach(item => {
    const card = document.createElement("div");
    card.className = "card market-item glass-shine";
    card.innerHTML = `
      <span class="item-badge">${item.category}</span>
      <h3 style="margin-top: 15px; font-size: 1.1rem; color: #fff;">${item.title}</h3>
      <p class="market-desc" style="margin-top: 6px;">${item.description}</p>
      
      <div class="market-action">
        <span style="font-family: var(--font-number); font-weight: 600; color: var(--secondary-cyan); font-size: 1.05rem;">🪙 ${item.cost} Coins</span>
        <button class="btn btn-primary btn-buy" onclick="buyMarketplaceItem('${item.id}', ${item.cost})">Redeem</button>
      </div>
    `;
    container.appendChild(card);
  });
}

function buyMarketplaceItem(itemId, cost) {
  if (state.profile.coins < cost) {
    triggerToast(`Insufficient Eco Coins. Need ${cost - state.profile.coins} more!`, "warning");
    announceAccessibility("Insufficient coins to complete this purchase.");
    return;
  }
  
  announceAccessibility("Processing eco coin redemption credits.");
  
  fetch('/api/passport/redeem', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: state.user_id, item_id: itemId })
  })
  .then(r => r.json())
  .then(data => {
    if (data.success) {
      updateUIWithProfile(data.profile);
      triggerConfetti();
      showAchievementModal("Redemption Successful", data.message);
      
      // refresh lists
      fetchPassportData();
    } else {
      triggerToast(data.message, "danger");
    }
  })
  .catch(() => {
    // Offline simulated purchase
    state.profile.coins -= cost;
    state.profile.green_score = Math.min(state.profile.green_score + 25, 1000);
    updateUIWithProfile(state.profile);
    
    // Complete local challenge check
    let completed = state.profile.completed_challenges || [];
    if (!completed.includes("eco_marketplace")) {
      completed.push("eco_marketplace");
      state.profile.completed_challenges = completed;
      state.profile.xp += 80;
      updateUIWithProfile(state.profile);
      simulateLocalChallenges();
    }
    
    triggerConfetti();
    showAchievementModal("Redemption Successful", `Mock purchase completed! Redeemed ${cost} Eco Coins.`);
  });
}

// ==========================================
// LEADERBOARD SWITCHERS
// ==========================================
let mockGlobalList = [];
let mockUniList = [];

function loadLeaderboard(globalList, uniList) {
  mockGlobalList = globalList.length ? globalList : [
    { rank: 1, username: "Elena Vance", green_score: 962, level: 12, badge: "♻️ Carbon Elite" },
    { rank: 2, username: "Marcus Aurelius", green_score: 890, level: 10, badge: "🌳 Canopy Warden" },
    { rank: 3, username: "Sophie Germain", green_score: 815, level: 8, badge: "⚡ Power Optimizer" },
    { rank: 4, username: "You (demo_user)", green_score: 745, level: 4, badge: "🌱 Eco Catalyst" },
    { rank: 5, username: "Alan Turing", green_score: 680, level: 6, badge: "📊 Data Conservationist" }
  ];
  
  mockUniList = uniList.length ? uniList : [
    { rank: 1, name: "Stanford University", green_score: 875, total_trees: 1420 },
    { rank: 2, name: "MIT (Eco Club)", green_score: 842, total_trees: 1150 },
    { rank: 3, name: "UC Berkeley", green_score: 795, total_trees: 980 },
    { rank: 4, name: "Harvard CleanTech", green_score: 710, total_trees: 640 }
  ];
  
  renderLeaderboard();
}

function switchLeaderboard(type) {
  state.activeLeaderboard = type;
  
  document.getElementById("tab-global").classList.toggle("active", type === 'global');
  document.getElementById("tab-uni").classList.toggle("active", type === 'uni');
  
  renderLeaderboard();
  announceAccessibility(`Swapped ranking feed to ${type} board.`);
}

function renderLeaderboard() {
  const container = document.getElementById("leaderboard-container");
  if (!container) return;
  container.innerHTML = "";
  
  if (state.activeLeaderboard === 'global') {
    // Sync 'You' score
    mockGlobalList.forEach(p => {
      if (p.username.includes("You")) {
        p.green_score = state.profile.green_score;
        p.level = state.profile.level;
        p.badge = `🌱 ${state.profile.phase}`;
      }
    });
    // Re-sort
    mockGlobalList.sort((a,b) => b.green_score - a.green_score);
    
    mockGlobalList.forEach((p, idx) => {
      const row = document.createElement("div");
      row.className = `lead-row ${p.username.includes("You") ? 'me' : ''}`;
      row.innerHTML = `
        <span class="lead-pos">${idx + 1}</span>
        <span class="lead-name">${p.username}</span>
        <span class="lead-badge">${p.badge}</span>
        <span class="lead-score">${p.green_score}</span>
      `;
      container.appendChild(row);
    });
  } else {
    mockUniList.forEach((p, idx) => {
      const row = document.createElement("div");
      row.className = "lead-row";
      row.innerHTML = `
        <span class="lead-pos">${idx + 1}</span>
        <span class="lead-name">${p.name}</span>
        <span class="lead-badge">🌳 ${p.total_trees} Trees</span>
        <span class="lead-score">${p.green_score}</span>
      `;
      container.appendChild(row);
    });
  }
}

// ==========================================
// SYSTEM OVERLAYS & MICROINTERACTIONS
// ==========================================
function toggleContrastMode() {
  state.contrast_mode = !state.contrast_mode;
  document.body.classList.toggle("high-contrast-mode", state.contrast_mode);
  
  document.getElementById("btn-contrast").classList.toggle("active", state.contrast_mode);
  
  announceAccessibility(`High contrast view is now ${state.contrast_mode ? 'on' : 'off'}`);
  triggerToast("Contrast display toggled", "info");
}

function toggleLargeText() {
  state.large_text = !state.large_text;
  document.body.classList.toggle("large-text-mode", state.large_text);
  
  document.getElementById("btn-fontsize").classList.toggle("active", state.large_text);
  
  announceAccessibility(`Large text display is now ${state.large_text ? 'on' : 'off'}`);
  triggerToast("Text scaling adjusted", "info");
}

function toggleColorblindMode() {
  const body = document.body;
  // Rotate modes: 0 -> 1 -> 2 -> 3 -> 0
  body.classList.remove("colorblind-deuteranopia", "colorblind-protanopia", "colorblind-tritanopia");
  
  state.colorblind_mode = (state.colorblind_mode + 1) % 4;
  const modes = ["Normal", "Deuteranopia", "Protanopia", "Tritanopia"];
  
  if (state.colorblind_mode === 1) body.classList.add("colorblind-deuteranopia");
  else if (state.colorblind_mode === 2) body.classList.add("colorblind-protanopia");
  else if (state.colorblind_mode === 3) body.classList.add("colorblind-tritanopia");
  
  document.getElementById("btn-colorblind").classList.toggle("active", state.colorblind_mode > 0);
  
  announceAccessibility(`Color filter set to ${modes[state.colorblind_mode]}`);
  triggerToast(`Color filter: ${modes[state.colorblind_mode]}`, "info");
}

function toggleScreenReader() {
  state.screen_reader = !state.screen_reader;
  document.getElementById("btn-screenreader").classList.toggle("active", state.screen_reader);
  
  if (state.screen_reader) {
    triggerToast("Voice accessibility assistant active.", "success");
    announceAccessibility("Voice accessibility assistant active. Action reports will be synthesized aloud.");
  } else {
    triggerToast("Voice accessibility assistant deactivated.", "info");
  }
}

// UI Popup Toast helper
function triggerToast(text, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;
  
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '⚡' : 'ℹ️'}</span>
    <span>${text}</span>
  `;
  container.appendChild(toast);
  
  // Auto remove
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-20px)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Modal popups for achievements
function showAchievementModal(title, text) {
  document.getElementById("modal-title").textContent = title;
  document.getElementById("modal-body").innerHTML = `<p>${text}</p>`;
  document.getElementById("modal-overlay").classList.add("active");
}

function closeModal() {
  document.getElementById("modal-overlay").classList.remove("active");
}

// Number animations microinteraction
function animateValue(obj, start, end, duration) {
  let startTimestamp = null;
  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    obj.innerHTML = Math.floor(progress * (end - start) + start);
    if (progress < 1) {
      window.requestAnimationFrame(step);
    }
  };
  window.requestAnimationFrame(step);
}

// Sparkly particles on completions (Hackathon delight)
function triggerConfetti() {
  // Simple mini-spark particle effect on dashboard view canvas
  const canvas = document.getElementById("ecosphere-canvas");
  if (!canvas) return;
  
  for (let i = 0; i < 30; i++) {
    ecoFireflies.push({
      x: canvas.width / 2 + Math.random() * 80 - 40,
      y: canvas.height / 2 + Math.random() * 80 - 40,
      angle: Math.random() * Math.PI * 2,
      speed: Math.random() * 4 + 2,
      size: Math.random() * 3 + 2,
      alpha: 1,
      alphaSpeed: -0.02
    });
  }
}

// ==========================================
// CLIENT-SIDE AUTHENTICATION LOGIC
// ==========================================
state.logged_in = false;

function checkSessionStatus() {
  fetch('/api/auth/me')
    .then(r => r.json())
    .then(data => {
      if (data.logged_in) {
        state.logged_in = true;
        state.user_id = data.user.user_id;
        state.profile.name = data.user.name;
        
        // Sync stats
        fetchPassportData();
        
        // Update top nav and landing CTA button text
        document.getElementById("lbl-username").textContent = data.user.name;
        document.getElementById("btn-start").innerHTML = `
          Enter Dashboard
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        `;
      }
    })
    .catch(err => console.log("Session verify skipped (mock fallback active).", err));
}

function startJourney() {
  if (state.logged_in) {
    enterDashboard();
  } else {
    showAuthView('login');
  }
}

function showAuthView(mode = 'login') {
  document.getElementById("auth-view").classList.remove("hidden");
  toggleAuthMode(mode);
  announceAccessibility("Showing authentication overlay. Use Google, GitHub, or email forms.");
}

function exitAuthView() {
  document.getElementById("auth-view").classList.add("hidden");
}

function toggleAuthMode(mode) {
  const loginForm = document.getElementById("form-login");
  const registerForm = document.getElementById("form-register");
  const forgotForm = document.getElementById("form-forgot");
  
  const title = document.getElementById("auth-title");
  const subtitle = document.getElementById("auth-subtitle");
  
  // Hide all form layouts first
  loginForm.style.display = "none";
  registerForm.style.display = "none";
  forgotForm.style.display = "none";
  
  if (mode === 'login') {
    loginForm.style.display = "flex";
    title.textContent = "Sign In to EcoSphere";
    subtitle.textContent = "Enter your credentials to access your Eco Dashboard";
  } else if (mode === 'register') {
    registerForm.style.display = "flex";
    title.textContent = "Create Eco Account";
    subtitle.textContent = "Start tracking carbon impact and evolution statistics";
  } else if (mode === 'forgot') {
    forgotForm.style.display = "flex";
    title.textContent = "Forgot Password";
    subtitle.textContent = "Enter your email address to obtain a secure reset link";
  }
}

function evaluatePasswordStrength(password) {
  const label = document.getElementById("pass-strength-label");
  const bar = document.getElementById("pass-strength-bar");
  if (!label || !bar) return;
  
  if (!password) {
    bar.style.width = "0%";
    label.textContent = "None";
    return;
  }
  
  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  
  let color = "var(--danger)";
  let text = "Weak";
  let width = "20%";
  
  if (score >= 4) {
    color = "var(--primary-emerald)";
    text = "Strong";
    width = "100%";
  } else if (score >= 2) {
    color = "var(--warning)";
    text = "Moderate";
    width = "60%";
  }
  
  bar.style.width = width;
  bar.style.backgroundColor = color;
  label.textContent = text;
  label.style.color = color;
}

function shakeCard() {
  const card = document.getElementById("auth-card");
  card.classList.add("shake");
  setTimeout(() => card.classList.remove("shake"), 400);
}

function submitLogin(event) {
  event.preventDefault();
  const email = document.getElementById("login-email").value;
  const pass = document.getElementById("login-pass").value;
  
  fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email, password: pass })
  })
  .then(r => r.json())
  .then(data => {
    if (data.success) {
      state.logged_in = true;
      state.user_id = data.user.uid;
      state.profile.name = data.user.name;
      
      document.getElementById("lbl-username").textContent = data.user.name;
      fetchPassportData();
      
      triggerToast("Welcome back!", "success");
      exitAuthView();
      enterDashboard();
    } else {
      triggerToast(data.message, "danger");
      shakeCard();
    }
  })
  .catch(err => {
    console.error("Local login failed, simulating...", err);
    if (email && pass.length >= 6) {
      state.logged_in = true;
      state.user_id = "mock_" + email.replace("@","_").replace(".","_");
      state.profile.name = "Demo User";
      document.getElementById("lbl-username").textContent = "Demo User";
      fetchPassportData();
      triggerToast("Mock login completed (Offline Mode)", "success");
      exitAuthView();
      enterDashboard();
    } else {
      triggerToast("Invalid credentials", "danger");
      shakeCard();
    }
  });
}

function submitRegister(event) {
  event.preventDefault();
  const name = document.getElementById("register-name").value;
  const email = document.getElementById("register-email").value;
  const pass = document.getElementById("register-pass").value;
  
  if (pass.length < 6) {
    triggerToast("Password must be at least 6 characters.", "warning");
    shakeCard();
    return;
  }
  
  fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name, email: email, password: pass })
  })
  .then(r => r.json())
  .then(data => {
    if (data.success) {
      triggerToast(data.message, "success");
      toggleAuthMode('login');
      document.getElementById("login-email").value = email;
      document.getElementById("login-pass").value = "";
    } else {
      triggerToast(data.message, "danger");
      shakeCard();
    }
  })
  .catch(err => {
    console.error("Local register failed, simulating...", err);
    triggerToast("Mock registered successfully (Offline Mode)!", "success");
    toggleAuthMode('login');
    document.getElementById("login-email").value = email;
    document.getElementById("login-pass").value = "";
  });
}

async function socialLogin(provider) {
  announceAccessibility(`Signing in with ${provider}.`);
  triggerToast(`Authorizing via ${provider}...`, "info");
  
  if (provider === 'Google' && window.firebaseAuth && window.signInWithPopup && window.GoogleAuthProvider) {
    try {
      const authProvider = new window.GoogleAuthProvider();
      const result = await window.signInWithPopup(window.firebaseAuth, authProvider);
      const user = result.user;
      const idToken = await user.getIdToken();
      
      const response = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_token: idToken })
      });
      const data = await response.json();
      
      if (data.success) {
        state.logged_in = true;
        state.user_id = data.user.uid;
        state.profile.name = data.user.name;
        
        document.getElementById("lbl-username").textContent = data.user.name;
        fetchPassportData();
        
        triggerToast(`Successfully signed in with Google (${user.email})!`, "success");
        exitAuthView();
        enterDashboard();
        return;
      }
    } catch (error) {
      console.warn("Real Google Auth popup failed or cancelled, using fallback:", error);
      if (error.code === 'auth/configuration-not-found' || error.code === 'auth/operation-not-allowed') {
        triggerToast("Google Sign-In needs to be enabled in Firebase Console. Using fallback sign-in.", "warning");
      }
    }
  }

  // Fallback / Mock login handler
  setTimeout(() => {
    const mockEmail = `oauth_${provider.toLowerCase()}@domain.com`;
    const mockName = `${provider} User`;
    const mockToken = `mock-token-${provider.toLowerCase()}-${mockEmail}-${mockName}`;
    
    fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_token: mockToken })
    })
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        state.logged_in = true;
        state.user_id = data.user.uid;
        state.profile.name = data.user.name;
        
        document.getElementById("lbl-username").textContent = data.user.name;
        fetchPassportData();
        
        triggerToast(`Logged in via ${provider}!`, "success");
        exitAuthView();
        enterDashboard();
      }
    })
    .catch(() => {
      state.logged_in = true;
      state.user_id = `mock_${provider.toLowerCase()}`;
      state.profile.name = `${provider} User`;
      document.getElementById("lbl-username").textContent = `${provider} User`;
      triggerToast(`Logged in via ${provider}!`, "success");
      exitAuthView();
      enterDashboard();
    });
  }, 400);
}

function toggleLogoutBtn() {
  const logoutBtn = document.getElementById("btn-logout");
  if (logoutBtn.style.display === "none") {
    logoutBtn.style.display = "inline-flex";
  } else {
    logoutBtn.style.display = "none";
  }
}

function submitLogout() {
  fetch('/api/auth/logout', { method: 'POST' })
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        state.logged_in = false;
        
        // Hide floating coach widget
        const floatCoach = document.getElementById("floating-coach");
        if (floatCoach) floatCoach.style.display = "none";
        const floatPanel = document.getElementById("floating-coach-panel");
        if (floatPanel) floatPanel.classList.remove("active");
        
        const landing = document.getElementById("landing-view");
        landing.classList.remove("hidden");
        
        const dashboard = document.getElementById("dashboard-view");
        dashboard.style.display = "none";
        
        document.getElementById("btn-start").innerHTML = `
          Start Your Journey
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        `;
        
        document.getElementById("btn-logout").style.display = "none";
        
        triggerToast("Logged out successfully", "info");
        announceAccessibility("Logged out successfully. Returned to welcome page.");
      }
    })
    .catch(() => {
      state.logged_in = false;
      
      const floatCoach = document.getElementById("floating-coach");
      if (floatCoach) floatCoach.style.display = "none";
      const floatPanel = document.getElementById("floating-coach-panel");
      if (floatPanel) floatPanel.classList.remove("active");
      
      document.getElementById("landing-view").classList.remove("hidden");
      document.getElementById("dashboard-view").style.display = "none";
      document.getElementById("btn-logout").style.display = "none";
      triggerToast("Mock logged out (Offline Mode)", "info");
    });
}

function showForgotPassword() {
  showAuthView('forgot');
}



function submitForgotPasswordForm(event) {
  event.preventDefault();
  const email = document.getElementById("forgot-email").value;
  
  fetch('/api/auth/reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email })
  })
  .then(r => r.json())
  .then(data => {
    if (data.success) {
      triggerToast(data.message, "success");
      announceAccessibility(`Forgot password reset instructions sent to ${email}.`);
      toggleAuthMode('login');
    }
  })
  .catch(() => {
    triggerToast("Reset email sent successfully (Mock Mode). Check your inbox.", "success");
    toggleAuthMode('login');
  });
}

function toggleFloatingCoachPanel() {
  const panel = document.getElementById("floating-coach-panel");
  if (!panel) return;
  panel.classList.toggle("active");
  
  if (panel.classList.contains("active")) {
    document.getElementById("chat-input").focus();
    announceAccessibility("AI Eco Coach expanded. Type your sustainability questions.");
  } else {
    announceAccessibility("AI Eco Coach collapsed.");
  }
}

function toggleFloatingCoachPanel() {
  const panel = document.getElementById("floating-coach-panel");
  if (!panel) return;
  panel.classList.toggle("active");
  
  if (panel.classList.contains("active")) {
    document.getElementById("chat-input").focus();
    announceAccessibility("AI Eco Coach expanded. Type your sustainability questions.");
  } else {
    announceAccessibility("AI Eco Coach collapsed.");
  }
}

function speakCoachReply(text) {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.pitch = 1.0;
    utterance.rate = 1.0;
    window.speechSynthesis.speak(utterance);
  }
}

function switchToolSubView(name) {
  document.querySelectorAll('.tool-subview').forEach(div => div.style.display = 'none');
  const target = document.getElementById(`sub-tool-${name}`);
  if (target) target.style.display = 'block';
  
  document.getElementById('tab-detective').classList.remove('active-tool-tab');
  document.getElementById('tab-receipt').classList.remove('active-tool-tab');
  document.getElementById('tab-guide').classList.remove('active-tool-tab');
  
  const tabEl = document.getElementById(`tab-${name}`);
  if (tabEl) tabEl.classList.add('active-tool-tab');
  
  announceAccessibility(`Switched to tool: ${name}`);
}

let detectiveChart = null;
let footprintHistory = [];

function runCarbonDetective() {
  const carEl = document.getElementById('slide-car');
  const transitEl = document.getElementById('slide-transit');
  const activeEl = document.getElementById('slide-active');
  const flightEl = document.getElementById('slide-flight');
  const elecEl = document.getElementById('slide-elec');
  const waterEl = document.getElementById('slide-water');
  const dietEl = document.getElementById('slide-diet');
  const shopEl = document.getElementById('slide-shopping');
  const plasticEl = document.getElementById('slide-plastic');
  const internetEl = document.getElementById('slide-internet');
  const appliancesEl = document.getElementById('slide-appliances');
  
  if (!carEl || !transitEl || !activeEl || !flightEl || !elecEl || !waterEl || !dietEl || !shopEl || !plasticEl || !internetEl || !appliancesEl) return;
  
  const car = parseInt(carEl.value);
  const transit = parseInt(transitEl.value);
  const active = parseInt(activeEl.value);
  const flight = parseInt(flightEl.value);
  const elec = parseInt(elecEl.value);
  const water = parseInt(waterEl.value);
  const diet = parseInt(dietEl.value);
  const shopping = parseInt(shopEl.value);
  const plastic = parseInt(plasticEl.value);
  const internet = parseInt(internetEl.value);
  const appliances = parseInt(appliancesEl.value);
  
  // Update slide metric displays
  document.getElementById('val-car').innerText = car;
  document.getElementById('val-transit').innerText = transit;
  document.getElementById('val-active').innerText = active;
  document.getElementById('val-flight').innerText = flight;
  document.getElementById('val-elec').innerText = elec;
  document.getElementById('val-water').innerText = water;
  document.getElementById('val-shopping').innerText = shopping;
  document.getElementById('val-plastic').innerText = plastic;
  document.getElementById('val-internet').innerText = internet;
  document.getElementById('val-appliances').innerText = appliances;
  
  let dietLabel = "";
  let dietCarbon = 0;
  if (diet === 1) { dietLabel = "Vegan (Low)"; dietCarbon = 500; }
  else if (diet === 2) { dietLabel = "Vegetarian (Medium)"; dietCarbon = 1100; }
  else if (diet === 3) { dietLabel = "Mixed (Average)"; dietCarbon = 1800; }
  else { dietLabel = "Heavy Meat (High)"; dietCarbon = 3200; }
  document.getElementById('label-diet').innerText = dietLabel;
  
  // Calculate yearly footprints in kg
  const carFootprint = Math.max(0, car * 52 * 0.18);
  const transitFootprint = transit * 52 * 0.08;
  const activeOffset = active * 52 * 0.18; // offset value
  const flightFootprint = flight * 90;
  const elecFootprint = elec * 12 * 0.4;
  const waterFootprint = water * 365 * 0.0003;
  const dietFootprint = dietCarbon;
  const shoppingFootprint = shopping * 12 * 0.2;
  const plasticFootprint = plastic * 52 * 0.05;
  const internetFootprint = internet * 365 * 0.02;
  const appliancesFootprint = appliances * 365 * 0.5;
  
  const transTotal = Math.max(0, carFootprint + transitFootprint + flightFootprint - activeOffset);
  const utilitiesTotal = elecFootprint + waterFootprint;
  const lifestyleTotal = dietFootprint + shoppingFootprint + plasticFootprint + internetFootprint + appliancesFootprint;
  
  const yearlyTotalKg = transTotal + utilitiesTotal + lifestyleTotal;
  
  // Scope toggles
  const scope = document.getElementById('estimator-scope').value;
  let displayValue = 0;
  let scopeLabel = "";
  
  if (scope === 'yearly') {
    displayValue = yearlyTotalKg / 1000.0; // in Tons
    scopeLabel = "Yearly";
  } else if (scope === 'monthly') {
    displayValue = (yearlyTotalKg / 12.0); // in kg
    scopeLabel = "Monthly";
  } else if (scope === 'weekly') {
    displayValue = (yearlyTotalKg / 52.0); // in kg
    scopeLabel = "Weekly";
  } else {
    displayValue = (yearlyTotalKg / 365.0); // in kg
    scopeLabel = "Daily";
  }
  
  document.getElementById('lbl-scope-title').innerText = scopeLabel;
  
  const totalFields = document.querySelectorAll('#detective-total');
  totalFields.forEach(el => {
    el.innerText = scope === 'yearly' ? displayValue.toFixed(1) : Math.round(displayValue);
  });
  
  // Set hotspots
  let hotspotName = "";
  let hotspotDesc = "";
  const maxCategoryVal = Math.max(transTotal, utilitiesTotal, lifestyleTotal);
  
  if (maxCategoryVal === transTotal) {
    hotspotName = "Transportation & Travel";
    hotspotDesc = `Your travel patterns represent ${((transTotal/yearlyTotalKg)*100).toFixed(0)}% of your emissions. Try active commuting (walking/biking) or swapping solo car trips for train/bus routes to offset emissions!`;
    document.getElementById('card-hotspot').style.borderColor = 'rgba(0, 212, 255, 0.2)';
    document.getElementById('card-hotspot').style.background = 'rgba(0, 212, 255, 0.03)';
  } else if (maxCategoryVal === utilitiesTotal) {
    hotspotName = "Home Utility Load";
    hotspotDesc = `Home energy and water usage accounts for ${((utilitiesTotal/yearlyTotalKg)*100).toFixed(0)}% of your footprint. Shut off vampire standby appliances, transition to LED light bulbs, or limit shower times.`;
    document.getElementById('card-hotspot').style.borderColor = 'rgba(255, 93, 115, 0.2)';
    document.getElementById('card-hotspot').style.background = 'rgba(255, 93, 115, 0.03)';
  } else {
    hotspotName = "Diet & Shopping Purchases";
    hotspotDesc = `Lifestyle items represent ${((lifestyleTotal/yearlyTotalKg)*100).toFixed(0)}% of your footprint. Try introducing a plant-rich diet twice a week, reducing shopping wraps, or reusing plastic bottles.`;
    document.getElementById('card-hotspot').style.borderColor = 'rgba(199, 254, 115, 0.2)';
    document.getElementById('card-hotspot').style.background = 'rgba(199, 254, 115, 0.03)';
  }
  
  document.getElementById('lbl-hotspot-name').innerText = hotspotName;
  document.getElementById('lbl-hotspot-desc').innerText = hotspotDesc;
  
  // Render Breakdown chart
  renderDetectiveBreakdownChart(transTotal, utilitiesTotal, lifestyleTotal);
}

function renderDetectiveBreakdownChart(trans, utils, life) {
  const canvas = document.getElementById('chart-detective-breakdown');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  if (detectiveChart) detectiveChart.destroy();
  
  detectiveChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Transportation', 'Utilities', 'Lifestyle'],
      datasets: [{
        data: [Math.round(trans), Math.round(utils), Math.round(life)],
        backgroundColor: ['#00D4FF', '#3DDC84', '#FFB340'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { color: '#B8C2B3', font: { size: 9 } }
        }
      }
    }
  });
}

function logFootprintHistory() {
  const total = document.getElementById('detective-total').innerText;
  const scope = document.getElementById('lbl-scope-title').innerText;
  const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  footprintHistory.unshift({ total, scope, time: timestamp });
  if (footprintHistory.length > 3) footprintHistory.pop();
  
  renderFootprintHistory();
  triggerToast("Calculation logged to history timeline!", "success");
}

function renderFootprintHistory() {
  const container = document.getElementById('footprint-history-list');
  if (!container) return;
  container.innerHTML = "";
  
  if (footprintHistory.length === 0) {
    container.innerHTML = `<p class="text-secondary" style="font-size: 0.7rem; text-align: center; padding: 10px 0;">No calculation history logs stored yet.</p>`;
    return;
  }
  
  footprintHistory.forEach(h => {
    const div = document.createElement('div');
    div.style.display = 'flex';
    div.style.justify = 'space-between';
    div.style.fontSize = '0.75rem';
    div.style.padding = '6px 8px';
    div.style.borderBottom = '1px solid rgba(255,255,255,0.03)';
    div.innerHTML = `
      <span style="color: var(--text-secondary);">${h.time} (${h.scope} audit)</span>
      <strong style="color: #fff;">${h.total} ${h.scope === 'Yearly' ? 'Tons' : 'kg'} CO₂</strong>
    `;
    container.appendChild(div);
  });
}

function handleReceiptDrop(e) {
  e.preventDefault();
  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
    uploadReceipt(e.dataTransfer.files[0]);
  }
}

function handleReceiptFile(e) {
  if (e.target.files && e.target.files[0]) {
    uploadReceipt(e.target.files[0]);
  }
}

function uploadReceipt(file) {
  const dragArea = document.getElementById('receipt-drag-area');
  dragArea.innerText = "Analyzing receipt carbon footprint... Please wait.";
  dragArea.style.opacity = "0.7";
  
  const formData = new FormData();
  formData.append('file', file);
  formData.append('user_id', state.user_id || 'demo_user');
  
  fetch('/api/scan/receipt', {
    method: 'POST',
    body: formData
  })
  .then(r => r.json())
  .then(data => {
    dragArea.innerText = "Drag & Drop Grocery Receipts Here to Analyze (PET bottles, grocery lists, beef steak lines...)";
    dragArea.style.opacity = "1";
    
    if (data.success && data.result) {
      triggerToast("Receipt analyzed successfully!", "success");
      
      const res = data.result;
      document.getElementById('receipt-results-container').style.display = 'block';
      document.getElementById('rec-hotspot').innerText = res.highest_impact_item;
      document.getElementById('rec-total-carbon').innerText = res.total_carbon.toFixed(1);
      document.getElementById('rec-grade').innerText = res.sustainability_grade;
      
      const gradeEl = document.getElementById('rec-grade');
      if (res.sustainability_grade === 'A' || res.sustainability_grade === 'B') {
        gradeEl.style.color = 'var(--accent-lime)';
      } else if (res.sustainability_grade === 'C') {
        gradeEl.style.color = 'var(--secondary-cyan)';
      } else {
        gradeEl.style.color = 'var(--danger)';
      }
      
      const tbody = document.getElementById('receipt-table-body');
      tbody.innerHTML = '';
      
      res.items.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td style="padding: 12px 0; font-weight: 500; color: #fff;">${item.name}</td>
          <td style="color: var(--text-secondary);">${item.category}</td>
          <td style="color: var(--danger); font-weight: 600;">${item.carbon_footprint} kg CO₂</td>
          <td style="color: var(--accent-lime);">${item.alternative}</td>
        `;
        tbody.appendChild(row);
      });
      
      if (data.profile) {
        updateUIWithProfile(data.profile);
      }
    } else {
      triggerToast("Failed to analyze receipt.", "error");
    }
  })
  .catch(err => {
    dragArea.innerText = "Drag & Drop Grocery Receipts Here to Analyze (PET bottles, grocery lists, beef steak lines...)";
    dragArea.style.opacity = "1";
    triggerToast("Error processing request.", "error");
    console.error(err);
  });
}

function acceptChallengeLocal(id) {
  if (!state.accepted_challenges) state.accepted_challenges = [];
  if (!state.accepted_challenges.includes(id)) {
    state.accepted_challenges.push(id);
    triggerToast("Challenge accepted! Track your progress to complete it.", "success");
    announceAccessibility(`Challenge accepted. Target challenge id is ${id}.`);
    fetchChallenges();
  }
}

function renderMissions(challenges) {
  const container = document.getElementById("missions-container");
  if (!container) return;
  container.innerHTML = "";
  
  let doneCount = 0;
  if (!state.accepted_challenges) {
    state.accepted_challenges = [];
  }
  
  challenges.forEach(ch => {
    if (ch.completed) doneCount++;
    
    const isAccepted = state.accepted_challenges.includes(ch.id);
    const div = document.createElement("div");
    div.className = `mission-item ${ch.completed ? 'completed' : ''}`;
    
    let actionBtn = "";
    if (ch.completed) {
      actionBtn = `<span style="color: var(--accent-lime); font-size: 0.75rem; font-weight: 600;">🏆 Completed</span>`;
    } else if (isAccepted) {
      actionBtn = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="text-secondary" style="font-size: 0.65rem; color: var(--warning);">⏳ Tracking</span>
          <button class="btn btn-primary" onclick="completeChallengeLocal('${ch.id}')" style="padding: 4px 8px; font-size: 0.65rem; border-radius: 6px;">Complete</button>
        </div>
      `;
    } else {
      actionBtn = `<button class="btn btn-secondary" onclick="acceptChallengeLocal('${ch.id}')" style="padding: 4px 8px; font-size: 0.65rem; border-radius: 6px;">Accept</button>`;
    }
    
    div.innerHTML = `
      <div class="mission-checkbox" onclick="${ch.completed ? '' : `completeChallengeLocal('${ch.id}')`}"></div>
      <div class="mission-content" style="flex: 1;">
        <div class="mission-title" style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: 600; color: #fff;">${ch.title}</span>
          ${actionBtn}
        </div>
        <div class="mission-desc" style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 3px;">${ch.description}</div>
        <div class="mission-rewards" style="margin-top: 6px;">
          <span class="reward-tag reward-xp">+${ch.xp_reward} XP</span>
          <span class="reward-tag reward-coins">+${ch.coins_reward} coins</span>
        </div>
      </div>
    `;
    container.appendChild(div);
  });
  
  document.getElementById("lbl-missions-completed").textContent = `${doneCount}/${challenges.length} Done`;
}

const LOCAL_GUIDE_DATABASE = {
  "bottle": { title: "Plastic Juice Bottle", recyclable: "Recyclable", category: "Plastic #1 (PET)", disposal: "Rinse container clean, discard caps separately, throw in Blue Bin.", reuse: "Plant seedling sprout container or dry bean storage.", impact: "Saves 0.08kg CO₂ per bottle." },
  "plastic": { title: "Soft Wrap Packagings", recyclable: "Special Recycle", category: "Plastic #4 (LDPE)", disposal: "Collect dry and deliver to local supermarket grocery dropoff centers.", reuse: "Use as package padding fillers.", impact: "Prevents toxic chemicals leakages in landfills." },
  "laptop": { title: "Electronic Laptop (E-Waste)", recyclable: "Recyclable (Special)", category: "E-Waste", disposal: "Do not throw in household bins. Deliver to certified campus e-waste kiosks.", reuse: "Donate if functional, or upcycle into server.", impact: "Recovers precious lead/cobalt metals." },
  "phone": { title: "Smart Cellular Phone (E-Waste)", recyclable: "Recyclable (Special)", category: "E-Waste", disposal: "Deliver to battery collection points or local e-recyclers.", reuse: "Alarm clock, media terminal, smart cam controller.", impact: "Saves 15kg CO₂ manufacturing loads." },
  "battery": { title: "Alkaline AA/Lithium Battery", recyclable: "Recyclable (Special)", category: "E-Waste / Toxic", disposal: "Do not burn or drop in trash. Put inside collection battery tubes on campus.", reuse: "None. Direct recycling is required.", impact: "Avoids heavy metal leaking to local soils." },
  "paper": { title: "Office Printing Papers", recyclable: "Recyclable", category: "Paper / Fiber", disposal: "Remove plastic tapes and drop in green recycling paper container.", reuse: "Compost brown materials mix, wrapping.", impact: "Saves trees. Reduces emissions by 0.03kg." },
  "glass": { title: "Glass Jam Jars", recyclable: "Recyclable", category: "Glass Containers", disposal: "Wash residual food debris. Put inside glass collection boxes.", reuse: "Spice holder containers, drink jars.", impact: "Cuts energy requirements by 30% vs sand glass melting." }
};

function handleGuideSearchKey(e) {
  if (e.key === 'Enter') {
    searchGuideItem();
  }
}

function searchGuideItem() {
  const input = document.getElementById('guide-search-input');
  const text = input.value.trim().toLowerCase();
  if (!text) return;
  
  let match = null;
  for (let key in LOCAL_GUIDE_DATABASE) {
    if (text.includes(key)) {
      match = LOCAL_GUIDE_DATABASE[key];
      break;
    }
  }
  
  if (match) {
    renderGuideSearchResult(match);
  } else {
    // AI Vision fallback lookup
    const resBox = document.getElementById('guide-search-result');
    resBox.style.display = 'block';
    document.getElementById('guide-res-title').innerText = `Looking up "${input.value}" via AI...`;
    
    // Call scan simulation
    setTimeout(() => {
      const mockResult = {
        title: input.value + " (AI Audited)",
        recyclable: "Recyclable",
        category: "General Solid Waste",
        disposal: "Place in standard recycle bins or local sorting centers.",
        reuse: "Clean and reuse for domestic organizing storage.",
        impact: "Diverts landfill volumes and saves CO₂."
      };
      renderGuideSearchResult(mockResult);
    }, 1200);
  }
}

function renderGuideSearchResult(data) {
  document.getElementById('guide-search-result').style.display = 'block';
  document.getElementById('guide-res-title').innerText = data.title;
  document.getElementById('guide-res-recyclable').innerText = data.recyclable;
  
  const recEl = document.getElementById('guide-res-recyclable');
  if (data.recyclable.toLowerCase().includes("non") || data.recyclable.toLowerCase().includes("rarely")) {
    recEl.style.background = 'rgba(255, 93, 115, 0.15)';
    recEl.style.color = 'var(--danger)';
  } else {
    recEl.style.background = 'rgba(61, 220, 132, 0.15)';
    recEl.style.color = 'var(--accent-lime)';
  }
  
  document.getElementById('guide-res-category').innerText = data.category;
  document.getElementById('guide-res-disposal').innerText = data.disposal;
  document.getElementById('guide-res-reuse').innerText = data.reuse;
  document.getElementById('guide-res-impact').innerText = data.impact;
  
  announceAccessibility(`Search result found for ${data.title}. Category is ${data.category}.`);
}

const PRESET_TIPS = [
  { text: "Unplugging standby vampire energy loads saves up to 10% on domestic electricity utility bills.", category: "Energy" },
  { text: "Transitioning to plant-rich diet meals twice a week reduces dietary greenhouse outputs by 30%.", category: "Food" },
  { text: "Restricting shower times to 5 minutes conserves 40 liters of drinking water per session.", category: "Water" },
  { text: "Walk or cycle commutes for trips under 5km eliminates automotive fossil fuel emissions completely.", category: "Travel" },
  { text: "Bringing reusable cotton bags to groceries avoids single-use plastic package contributions.", category: "Shopping" },
  { text: "Plastics #1 (PET) and #2 (HDPE) possess the highest recycling efficiency in municipal sorting mills.", category: "Plastic" },
  { text: "Composting organic scraps prevents methane release, a gas 25x more greenhouse-potent than CO₂.", category: "Climate" }
];

function loadRandomTip() {
  const tip = PRESET_TIPS[Math.floor(Math.random() * PRESET_TIPS.length)];
  document.getElementById('tip-category').innerText = tip.category;
  document.getElementById('tip-content').innerText = `"${tip.text}"`;
  
  // Custom category colors
  const catEl = document.getElementById('tip-category');
  if (tip.category === 'Energy') catEl.style.color = 'var(--warning)';
  else if (tip.category === 'Water') catEl.style.color = 'var(--secondary-cyan)';
  else if (tip.category === 'Food') catEl.style.color = 'var(--accent-lime)';
  else catEl.style.color = 'var(--primary-emerald)';
  
  announceAccessibility(`New tip loaded. Category is ${tip.category}: ${tip.text}`);
}

function favoriteTip() {
  triggerToast("Tip added to your favorites list! ⭐", "success");
}

function saveTip() {
  triggerToast("Tip downloaded to offline notebook database! 💾", "success");
}

function shareTip() {
  triggerToast("Tip copy link copied to clipboard! 📢", "success");
}

function renderPassport() {
  document.getElementById('pass-name').innerText = state.profile.name || "Demo User";
  document.getElementById('pass-level').innerText = `Level ${state.profile.level}`;
  
  const stampsBox = document.getElementById('passport-stamps');
  stampsBox.innerHTML = "";
  
  const timelineBox = document.getElementById('passport-timeline');
  timelineBox.innerHTML = "";
  
  const completed = state.profile.completed_challenges || [];
  
  // Render Country-style passport stamps
  const stampsPool = [
    { id: "scan_recycle", label: "Scanner Outpost", icon: "🌱", class: "stamp-water" },
    { id: "chat_energy", label: "Energy Grid", icon: "⚡", class: "stamp-energy" },
    { id: "water_conservation", label: "Conservation", icon: "💧", class: "stamp-transit" },
    { id: "eco_marketplace", label: "Forest Sector", icon: "🌳", class: "stamp-food" }
  ];
  
  let stampedCount = 0;
  stampsPool.forEach(s => {
    const isCompleted = completed.includes(s.id);
    const div = document.createElement('div');
    
    if (isCompleted) {
      stampedCount++;
      div.className = `stamp-badge ${s.class}`;
      div.innerHTML = `
        <span style="font-size: 1.2rem; display: block; margin-bottom: 2px;">${s.icon}</span>
        <span>${s.label}</span>
      `;
      
      // Append timeline log item too
      const item = document.createElement('div');
      item.innerHTML = `
        <strong style="color: #fff; font-size: 0.8rem; display: block;">Unlocked ${s.label} Passport Stamp</strong>
        <span class="text-secondary" style="font-size: 0.7rem;">Completed challenge tasks for sustainability points.</span>
      `;
      timelineBox.appendChild(item);
    } else {
      div.className = "stamp-badge";
      div.style.borderColor = "var(--border-color)";
      div.style.color = "var(--text-muted)";
      div.style.opacity = "0.3";
      div.innerHTML = `
        <span style="font-size: 1.2rem; display: block; margin-bottom: 2px;">🔒</span>
        <span>Locked</span>
      `;
    }
    stampsBox.appendChild(div);
  });
  
  if (stampedCount === 0) {
    timelineBox.innerHTML = `<p class="text-secondary" style="font-size: 0.7rem; text-align: center; padding: 10px 0;">Complete challenges to earn your country-style passport stamps!</p>`;
  }
}

// ==========================================
// PROFILE OVERVIEW
// ==========================================

// Local storage key for editable profile fields
const PROFILE_STORAGE_KEY = 'ecosphere_profile_meta';

function loadProfile() {
  // Use live state data + session info + stored editable fields
  const p = state.profile;
  const stored = JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY) || '{}');

  // Fetch session user data to get name/email
  fetch('/api/auth/me')
    .then(r => r.json())
    .then(data => {
      const user = data.user || {};
      updateProfileUI(p, user, stored);
    })
    .catch(() => {
      updateProfileUI(p, {}, stored);
    });
}

function updateProfileUI(p, user, stored) {
  // --- Name, email, username ---
  const name = stored.name || user.name || 'Eco User';
  const email = stored.email || user.email || '—';
  const initial = name.trim()[0]?.toUpperCase() || '?';

  setText('profile-name', name);
  setText('profile-email', email);
  setText('profile-username', '@' + name.toLowerCase().replace(/\s+/g, '_') + '_eco');
  setText('profile-country', stored.country || 'India');
  setText('profile-city', stored.city || 'New Delhi');
  setText('profile-goal', stored.goal || '"Reduce my household carbon footprint by 40% through conscious daily habits."');

  // Avatar initial
  const avatarEl = document.getElementById('profile-avatar');
  if (avatarEl) avatarEl.textContent = stored.avatar || initial;

  // --- Member since ---
  const since = stored.member_since || new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  setText('profile-member-since', since);

  // --- Green Score ---
  const score = p.green_score || 745;
  setText('profile-stat-score', score);
  const gauge = document.getElementById('profile-gauge');
  if (gauge) {
    const pct = Math.min((score / 1000) * 100, 100);
    gauge.setAttribute('stroke-dasharray', `${pct.toFixed(1)},100`);
    // also update the inner label
    const wrap = gauge.closest('div');
    const inner = wrap?.querySelector('div');
    if (inner) inner.textContent = score;
  }

  // --- Carbon / streak ---
  const carbonKg = ((score / 1000) * 14.8 * (score / 745)).toFixed(1);
  setText('profile-stat-carbon', carbonKg);
  document.getElementById('profile-stat-carbon').innerHTML =
    `${carbonKg}<span style="font-size:0.75rem;color:var(--text-muted);font-weight:400;"> kg</span>`;

  const streak = p.streak || 6;
  setText('profile-stat-streak', streak);
  document.getElementById('profile-stat-streak').innerHTML =
    `${streak}<span style="font-size:0.75rem;color:var(--text-muted);font-weight:400;"> days</span>`;

  // --- Eco Level ---
  const level = p.level || 4;
  const xp    = p.xp    || 3820;
  const nextXP  = p.next_level_xp || 4000;
  const baseXP  = p.current_level_base_xp || 3000;
  const pctXP   = Math.min(Math.round(((xp - baseXP) / (nextXP - baseXP)) * 100), 100);
  const xpNeeded = Math.max(nextXP - xp, 0);

  const ecoLevelName = level <= 3 ? '🌱 Beginner' : level <= 7 ? '🌿 Green Hero' : '🛡️ Planet Protector';
  const badgeText    = level <= 3 ? '🌱 Beginner'  : level <= 7 ? '🌿 Green Hero'  : '🛡️ Planet Protector';

  setText('profile-eco-level', `${ecoLevelName}`);
  document.getElementById('profile-eco-level').innerHTML =
    `${ecoLevelName} <span style="font-size:0.75rem;color:var(--text-muted);font-weight:400;">· Level ${level}</span>`;
  setText('profile-level-badge', badgeText);
  setText('profile-xp-needed', `${xpNeeded.toLocaleString()} XP`);
  setText('profile-xp-current', `${xp.toLocaleString()} XP`);
  setText('profile-xp-max', `${nextXP.toLocaleString()} XP`);

  const xpBar = document.getElementById('profile-xp-bar');
  if (xpBar) setTimeout(() => xpBar.style.width = `${pctXP}%`, 100);

  // Highlight the correct milestone tile
  const tiles = document.querySelectorAll('#view-profile .card [style*="grid-template-columns:repeat(3"] > div');
  tiles.forEach((t, i) => {
    const isActive = (i === 0 && level <= 3) || (i === 1 && level >= 4 && level <= 7) || (i === 2 && level >= 8);
    t.style.opacity = isActive ? '1' : '0.45';
  });

  // --- Rank ---
  const rank = p.rank || 4;
  setText('profile-rank-global', `#${rank}`);

  // --- Detailed metrics ---
  const energy = Math.round(42.5 * (score / 745));
  const water  = Math.round(160  * (score / 745));
  const coins  = p.coins || 450;
  const completed = (p.completed_challenges || []).length;
  const total = 4;

  setText('profile-energy', `${energy} kWh`);
  setText('profile-water',  `${water} L`);
  setText('profile-coins',  coins);
  setText('profile-co2',    `${carbonKg} kg`);
  setText('profile-missions', `${completed} / ${total}`);
  setText('profile-phase',  p.phase || 'Wildlife');

  // --- Heatmap ---
  renderHeatmap(streak);
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function renderHeatmap(streak) {
  // Legacy heatmap container (kept for compatibility)
  const legacyContainer = document.getElementById('profile-heatmap');
  if (legacyContainer) legacyContainer.innerHTML = '';

  // New grid container: Mon/Wed/Fri rows × 12 weeks columns
  const grid = document.getElementById('profile-heatmap-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const WEEKS = 12;
  const ROWS = [
    { label: 'Mon', dayIndex: 0 },
    { label: 'Wed', dayIndex: 2 },
    { label: 'Fri', dayIndex: 4 }
  ];

  // Pre-generate 12 weeks × 7 days of activity
  const actData = [];
  for (let w = 0; w < WEEKS; w++) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const daysAgo = (WEEKS - 1 - w) * 7 + (6 - d);
      let level = 0;
      if (daysAgo < streak) {
        level = 4;
      } else if (daysAgo < streak + 5) {
        level = Math.floor(Math.random() * 2) + 1;
      } else {
        const r = Math.random();
        level = r > 0.55 ? 0 : r > 0.3 ? 1 : r > 0.15 ? 2 : r > 0.06 ? 3 : 4;
      }
      week.push(level);
    }
    actData.push(week);
  }

  const colors = [
    'rgba(82,224,101,0.08)',
    'rgba(82,224,101,0.3)',
    'rgba(82,224,101,0.55)',
    'rgba(82,224,101,0.78)',
    '#52e065'
  ];

  ROWS.forEach(row => {
    const rowDiv = document.createElement('div');
    rowDiv.style.cssText = 'display:grid; grid-template-columns:28px repeat(12,1fr); gap:3px; align-items:center;';

    const labelDiv = document.createElement('div');
    labelDiv.textContent = row.label;
    labelDiv.style.cssText = 'font-size:0.58rem; color:#475569; text-align:right; padding-right:4px;';
    rowDiv.appendChild(labelDiv);

    for (let w = 0; w < WEEKS; w++) {
      const cell = document.createElement('div');
      const level = actData[w][row.dayIndex];
      cell.style.cssText = `height:11px; border-radius:2px; background:${colors[level]}; cursor:pointer;`;
      const daysAgo = (WEEKS - 1 - w) * 7 + (6 - row.dayIndex);
      cell.title = `${daysAgo} days ago — level ${level}`;
      rowDiv.appendChild(cell);
    }
    grid.appendChild(rowDiv);
  });
}


function showAllAchievements() {
  const achievements = [
    { icon: '♻️', name: 'Waste Warrior',   desc: 'Recycled 10 kg of waste',      date: 'Aug 24, 2026', coins: 120, color: 'rgba(82,224,101,0.3)' },
    { icon: '🌲', name: 'Tree Planter',     desc: 'Planted 1 tree',                date: 'Aug 21, 2026', coins: 150, color: 'rgba(82,224,101,0.3)' },
    { icon: '🔥', name: 'Streak Master',    desc: 'Maintained a 6-day streak',     date: 'Aug 20, 2026', coins: 100, color: 'rgba(249,115,22,0.3)' },
    { icon: '🔍', name: 'Eco Explorer',     desc: 'Completed 10 Eco Challenges',   date: 'Aug 15, 2026', coins: 200, color: 'rgba(0,212,255,0.3)'   },
    { icon: '🚲', name: 'Green Commuter',   desc: 'Used eco transport 5 times',    date: 'Aug 10, 2026', coins: 80,  color: 'rgba(82,224,101,0.3)' },
    { icon: '💧', name: 'Water Saver',      desc: 'Saved 100L of water',           date: 'Aug 5, 2026',  coins: 90,  color: 'rgba(0,212,255,0.3)'   },
    { icon: '⚡', name: 'Energy Guardian',  desc: 'Reduced energy use by 20%',     date: 'Jul 30, 2026', coins: 110, color: 'rgba(199,254,115,0.3)' },
    { icon: '🥗', name: 'Plant Pioneer',    desc: 'Logged 7 plant-based meals',    date: 'Jul 22, 2026', coins: 75,  color: 'rgba(82,224,101,0.3)' },
  ];

  // Build modal HTML
  const rows = achievements.map(a => `
    <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
      <div style="width:38px;height:38px;border-radius:50%;background:${a.color};display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0;">${a.icon}</div>
      <div style="flex:1;">
        <div style="font-size:0.82rem;font-weight:700;color:#fff;">${a.name}</div>
        <div style="font-size:0.68rem;color:#64748b;">${a.desc}</div>
      </div>
      <div style="text-align:right;flex-shrink:0;">
        <div style="font-size:0.62rem;color:#475569;">${a.date}</div>
        <div style="font-size:0.72rem;font-weight:700;color:#f9a826;">+${a.coins} 🪙</div>
      </div>
    </div>`).join('');

  // Create or reuse modal
  let modal = document.getElementById('all-achievements-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'all-achievements-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(8px);z-index:3000;display:none;align-items:center;justify-content:center;';
    modal.innerHTML = `
      <div style="width:100%;max-width:480px;background:linear-gradient(135deg,#0d1f14,#081208);border:1px solid rgba(82,224,101,0.3);border-radius:20px;padding:24px;position:relative;max-height:80vh;display:flex;flex-direction:column;">
        <button onclick="document.getElementById('all-achievements-modal').style.display='none'" style="position:absolute;top:14px;right:16px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#94a3b8;width:30px;height:30px;border-radius:50%;font-size:1.1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;">×</button>
        <h3 style="font-size:1rem;font-weight:800;color:#fff;margin:0 0 4px;">🏆 All Achievements</h3>
        <p style="font-size:0.7rem;color:#64748b;margin:0 0 14px;">Your complete eco-accomplishment history</p>
        <div id="all-achievements-list" style="overflow-y:auto;flex:1;"></div>
      </div>`;
    document.body.appendChild(modal);
  }
  document.getElementById('all-achievements-list').innerHTML = rows;
  modal.style.display = 'flex';

  // Close on backdrop click
  modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
}


function openEditProfile() {
  const stored = JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY) || '{}');
  document.getElementById('edit-name').value    = stored.name    || document.getElementById('profile-name')?.textContent    || '';
  document.getElementById('edit-country').value = stored.country || document.getElementById('profile-country')?.textContent || '';
  document.getElementById('edit-city').value    = stored.city    || document.getElementById('profile-city')?.textContent    || '';
  document.getElementById('edit-goal').value    = stored.goal    || '';

  const modal = document.getElementById('profile-edit-modal');
  if (modal) {
    modal.style.display = 'flex';
  }
}

function closeEditProfile() {
  const modal = document.getElementById('profile-edit-modal');
  if (modal) modal.style.display = 'none';
}

function saveProfileEdits() {
  const name    = document.getElementById('edit-name').value.trim();
  const country = document.getElementById('edit-country').value.trim();
  const city    = document.getElementById('edit-city').value.trim();
  const goal    = document.getElementById('edit-goal').value.trim();

  const stored = JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY) || '{}');
  if (name)    stored.name    = name;
  if (country) stored.country = country;
  if (city)    stored.city    = city;
  if (goal)    stored.goal    = `"${goal.replace(/^"|"$/g, '')}"`;
  stored.member_since = stored.member_since || new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(stored));
  closeEditProfile();
  loadProfile();
  triggerToast('Profile updated successfully!', 'success');
}

function changeAvatar() {
  const emojis = ['🌿','🌱','🌳','🌻','🦋','🐸','🦜','🌊','⚡','🔋','🌎','♻️'];
  const stored = JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY) || '{}');
  const current = stored.avatar;
  const currentIdx = emojis.indexOf(current);
  const next = emojis[(currentIdx + 1) % emojis.length];
  stored.avatar = next;
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(stored));
  const avatarEl = document.getElementById('profile-avatar');
  if (avatarEl) {
    avatarEl.style.transform = 'scale(1.2)';
    avatarEl.textContent = next;
    setTimeout(() => avatarEl.style.transform = '', 200);
  }
  triggerToast(`Avatar changed to ${next}`, 'success');
}

/* ==========================================
   LANDING PAGE MODAL CONTROLLERS (Features, How It Works, About)
   ========================================== */
function showLandingModal(tabName) {
  // Update nav active pill and states
  const navTabs = ['home', 'features', 'how-it-works', 'about'];
  navTabs.forEach(t => {
    const linkEl = document.getElementById('nav-link-' + t);
    if (linkEl) linkEl.classList.remove('active');
  });

  const activeLink = document.getElementById('nav-link-' + tabName);
  if (activeLink) activeLink.classList.add('active');

  if (tabName === 'home') {
    closeLandingModal();
    return;
  }

  // Hide all modals
  document.querySelectorAll('.landing-modal-overlay').forEach(m => m.classList.add('hidden'));

  // Show target modal
  const targetModal = document.getElementById('modal-' + tabName);
  if (targetModal) {
    targetModal.classList.remove('hidden');
    announceAccessibility(`Opening ${tabName.replace('-', ' ')} modal view.`);
  }
}

function closeLandingModal() {
  document.querySelectorAll('.landing-modal-overlay').forEach(m => m.classList.add('hidden'));
  
  // Reset nav active pill to Home
  const navTabs = ['features', 'how-it-works', 'about'];
  navTabs.forEach(t => {
    const linkEl = document.getElementById('nav-link-' + t);
    if (linkEl) linkEl.classList.remove('active');
  });

  const homeLink = document.getElementById('nav-link-home');
  if (homeLink) homeLink.classList.add('active');
}

// ESC Key listener for landing modals
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeLandingModal();
  }
});

/* ==========================================
   ECO JOURNEY MASTER 12-STEP LOOP CONTROLLER
   ========================================== */
const ECO_LOOP_STAGES = [
  { step: 1, name: "1. Carbon Footprint", icon: "👣", view: "analytics", desc: "Calculating personal baseline CO₂ emissions & energy loads." },
  { step: 2, name: "2. Carbon Detective", icon: "🕵️", view: "tools", desc: "AI Computer Vision analyzes waste items & vampire energy loads." },
  { step: 3, name: "3. AI Personalized Mission", icon: "🎯", view: "dashboard", desc: "Generating custom micro-habit tasks tailored to your routine." },
  { step: 4, name: "4. Complete Eco Action", icon: "⚡", view: "dashboard", desc: "Executing verified real-world sustainability action." },
  { step: 5, name: "5. XP + Green Coins", icon: "🪙", view: "dashboard", desc: "Rewarding +150 XP & +50 Eco Coins." },
  { step: 6, name: "6. Level Up", icon: "🏆", view: "profile", desc: "Upgrading tier rank and unlocking new ecosystem privileges." },
  { step: 7, name: "7. Passport Stamp", icon: "🛂", view: "passport", desc: "Minting verifiable milestone stamp into your Eco Passport." },
  { step: 8, name: "8. Living Garden Evolves", icon: "🪴", view: "dashboard", desc: "3D digital forest grows new foliage and interactive wildlife." },
  { step: 9, name: "9. Green Score Improves", icon: "📊", view: "dashboard", desc: "Boosting overall sustainability rating gauge (+15 pts)." },
  { step: 10, name: "10. Future You Prediction", icon: "🔮", view: "dashboard", desc: "AI models project 5-year climate footprint trajectory." },
  { step: 11, name: "11. Leaderboard", icon: "🥇", view: "community", desc: "Advancing global eco champion rank." },
  { step: 12, name: "12. New Challenge ↺", icon: "🔄", view: "flow", desc: "Unlocking next tier challenge and restarting cycle ↺." }
];

let currentLoopStepIndex = 0;

function updateEcoLoopUI() {
  const currentStage = ECO_LOOP_STAGES[currentLoopStepIndex];
  
  // Update dashboard banner header label
  const labelEl = document.getElementById("lbl-current-loop-stage");
  if (labelEl) {
    labelEl.textContent = currentStage.name;
  }

  // Update mini step pills in banner
  for (let i = 1; i <= 12; i++) {
    const miniEl = document.getElementById(`mini-step-${i}`);
    if (miniEl) {
      if (i === currentStage.step) {
        miniEl.classList.add("active");
      } else {
        miniEl.classList.remove("active");
      }
    }
  }

  // Update flow view cards if flow view is visible
  for (let i = 1; i <= 12; i++) {
    const cardEl = document.getElementById(`flow-step-${i}`);
    if (cardEl) {
      if (i === currentStage.step) {
        cardEl.classList.add("active");
      } else {
        cardEl.classList.remove("active");
      }
    }
  }
}

function advanceEcoLoop() {
  currentLoopStepIndex = (currentLoopStepIndex + 1) % ECO_LOOP_STAGES.length;
  const currentStage = ECO_LOOP_STAGES[currentLoopStepIndex];
  
  updateEcoLoopUI();
  triggerToast(`${currentStage.icon} ${currentStage.name}: ${currentStage.desc}`, 'success');

  // Trigger step side effects
  if (currentStage.step === 5) {
    state.coins = (state.coins || 450) + 50;
    state.xp = (state.xp || 1200) + 150;
    if (typeof updateStatsUI === 'function') updateStatsUI();
  } else if (currentStage.step === 8) {
    if (window.addTreeToEcosphere) window.addTreeToEcosphere();
  } else if (currentStage.step === 9) {
    state.greenScore = Math.min(1000, (state.greenScore || 745) + 15);
    if (typeof updateStatsUI === 'function') updateStatsUI();
  }
}

function jumpToLoopStep(stepNum) {
  currentLoopStepIndex = stepNum - 1;
  const targetStage = ECO_LOOP_STAGES[currentLoopStepIndex];
  updateEcoLoopUI();
  triggerToast(`Step ${stepNum}: ${targetStage.name}`, 'info');
  switchView(targetStage.view);
}

function runFullEcoLoopSimulation() {
  triggerToast('⚡ Starting 12-Stage Eco Master Loop Simulation...', 'info');
  let stepIndex = 0;
  
  const interval = setInterval(() => {
    currentLoopStepIndex = stepIndex;
    updateEcoLoopUI();
    const stage = ECO_LOOP_STAGES[stepIndex];
    triggerToast(`${stage.icon} Step ${stage.step}/12: ${stage.name}`, 'success');

    if (stage.step === 5) {
      state.coins = (state.coins || 450) + 50;
      if (typeof updateStatsUI === 'function') updateStatsUI();
    } else if (stage.step === 8) {
      if (window.addTreeToEcosphere) window.addTreeToEcosphere();
    } else if (stage.step === 9) {
      state.greenScore = Math.min(1000, (state.greenScore || 745) + 15);
      if (typeof updateStatsUI === 'function') updateStatsUI();
    }

    stepIndex++;
    if (stepIndex >= ECO_LOOP_STAGES.length) {
      clearInterval(interval);
      setTimeout(() => {
        triggerToast('🎉 12-Step Eco Master Loop Completed! Restarting cycle ↺', 'success');
        currentLoopStepIndex = 0;
        updateEcoLoopUI();
      }, 800);
    }
  }, 1100);
}
