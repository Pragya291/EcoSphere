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
  const views = ['dashboard', 'scanner', 'analytics', 'marketplace', 'community'];
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
    'scanner': 'AI Waste Scanner',
    'analytics': 'Footprint Analytics',
    'marketplace': 'Eco Marketplace',
    'community': 'Global Eco Community'
  };
  document.getElementById("section-title").textContent = titleMap[viewName];
  
  // Specific view loaders
  if (viewName === 'scanner') {
    startCamera();
  } else {
    stopCamera();
  }
  
  if (viewName === 'analytics') {
    setTimeout(initAnalyticsCharts, 100);
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
  // Phase mapping helpers
  if (score <= 100) {
    // Seed: draw seedling sprout
    drawSprout(cx, cy, 25);
  } 
  else if (score <= 250) {
    // Plant: small leafy plant
    drawPlant(cx, cy, 45);
  } 
  else if (score <= 400) {
    // Tree: single beautiful tree
    drawTree(cx, cy, 70);
  } 
  else if (score <= 550) {
    // Forest: multiple trees
    drawTree(cx - 50, cy + 5, 50);
    drawTree(cx + 60, cy + 10, 45);
    drawTree(cx, cy, 75); // main
  } 
  else if (score <= 700) {
    // River: forest + blue winding river
    drawRiver();
    drawTree(cx - 60, cy + 5, 55);
    drawTree(cx + 70, cy + 10, 50);
    drawTree(cx, cy, 75);
  } 
  else if (score <= 850) {
    // Wildlife: Forest + river + flying birds
    drawRiver();
    drawTree(cx - 70, cy + 5, 55);
    drawTree(cx + 80, cy + 10, 50);
    drawTree(cx, cy, 78);
    drawBirds();
  } 
  else if (score <= 950) {
    // Nature Reserve: Forest + river + birds + mountain backdrops
    drawMountains(cx, cy);
    drawRiver();
    drawTree(cx - 70, cy + 15, 60);
    drawTree(cx + 80, cy + 20, 50);
    drawTree(cx, cy + 5, 80);
    drawBirds();
  } 
  else {
    // Smart Eco City: Integrated wind turbines + green skyscrapers + solar
    drawMountains(cx, cy);
    drawRiver();
    drawFutureSkyline(cx, cy);
    drawTree(cx - 90, cy + 20, 45);
    drawTree(cx + 100, cy + 20, 50);
    drawWindTurbine(cx - 140, cy - 20, 30);
    drawWindTurbine(cx + 130, cy - 10, 25);
  }
}

function drawSprout(x, y, size) {
  // Sprout stalk
  ecoCtx.strokeStyle = 'var(--primary-emerald)';
  ecoCtx.lineWidth = 3;
  ecoCtx.lineCap = 'round';
  
  let sway = state.weather.wind ? Math.sin(Date.now() * 0.005) * 4 : 0;
  
  ecoCtx.beginPath();
  ecoCtx.moveTo(x, y);
  ecoCtx.quadraticCurveTo(x, y - size / 2, x + sway, y - size);
  ecoCtx.stroke();
  
  // Leaflet right
  ecoCtx.fillStyle = 'var(--accent-lime)';
  ecoCtx.beginPath();
  ecoCtx.ellipse(x + sway, y - size, 6, 3, Math.PI / 6, 0, Math.PI * 2);
  ecoCtx.fill();
  
  // Leaflet left
  ecoCtx.beginPath();
  ecoCtx.ellipse(x + sway - 3, y - size - 2, 4, 2, -Math.PI / 4, 0, Math.PI * 2);
  ecoCtx.fill();
}

function drawPlant(x, y, size) {
  let sway = state.weather.wind ? Math.sin(Date.now() * 0.004) * 6 : 0;
  
  ecoCtx.strokeStyle = '#28a745';
  ecoCtx.lineWidth = 4;
  
  ecoCtx.beginPath();
  ecoCtx.moveTo(x, y);
  ecoCtx.quadraticCurveTo(x - 5, y - size * 0.4, x + sway, y - size);
  ecoCtx.stroke();
  
  // Side branches
  ecoCtx.lineWidth = 2.5;
  ecoCtx.beginPath();
  ecoCtx.moveTo(x - 2, y - size * 0.4);
  ecoCtx.quadraticCurveTo(x - 12 + sway * 0.5, y - size * 0.6, x - 18 + sway * 0.6, y - size * 0.65);
  ecoCtx.moveTo(x + 2, y - size * 0.5);
  ecoCtx.quadraticCurveTo(x + 12 + sway * 0.5, y - size * 0.7, x + 20 + sway * 0.6, y - size * 0.75);
  ecoCtx.stroke();
  
  // Leaves
  ecoCtx.fillStyle = 'var(--primary-emerald)';
  // Main leaf
  ecoCtx.beginPath();
  ecoCtx.ellipse(x + sway, y - size, 10, 5, Math.PI / 4, 0, Math.PI * 2);
  ecoCtx.fill();
  
  // Branch leaves
  ecoCtx.beginPath();
  ecoCtx.ellipse(x - 18 + sway * 0.6, y - size * 0.65, 8, 4, -Math.PI / 6, 0, Math.PI * 2);
  ecoCtx.ellipse(x + 20 + sway * 0.6, y - size * 0.75, 8, 4, Math.PI / 3, 0, Math.PI * 2);
  ecoCtx.fill();
}

function drawTree(x, y, height) {
  let sway = state.weather.wind ? Math.sin(Date.now() * 0.003 + x) * 8 : 0;
  
  // Trunk
  ecoCtx.strokeStyle = '#3d2514';
  ecoCtx.lineWidth = height * 0.12;
  ecoCtx.lineCap = 'round';
  
  ecoCtx.beginPath();
  ecoCtx.moveTo(x, y);
  ecoCtx.quadraticCurveTo(x, y - height * 0.5, x + sway, y - height);
  ecoCtx.stroke();
  
  // Foliage clusters (layered translucent emerald circles)
  ecoCtx.fillStyle = 'rgba(61, 220, 132, 0.4)';
  const radius = height * 0.35;
  
  ecoCtx.beginPath();
  ecoCtx.arc(x + sway, y - height, radius, 0, Math.PI * 2);
  ecoCtx.arc(x + sway - radius * 0.5, y - height + 10, radius * 0.8, 0, Math.PI * 2);
  ecoCtx.arc(x + sway + radius * 0.5, y - height + 8, radius * 0.8, 0, Math.PI * 2);
  ecoCtx.arc(x + sway, y - height - radius * 0.4, radius * 0.7, 0, Math.PI * 2);
  ecoCtx.fill();
  
  // Foliage core highlight
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
// AI CAMERA SCANNER API LOGIC
// ==========================================
function startCamera() {
  const video = document.getElementById("camera-feed");
  const overlay = document.getElementById("scanner-overlay");
  const btnCapture = document.getElementById("btn-capture");
  const btnSnap = document.getElementById("btn-snap");
  
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
      .then(stream => {
        state.cameraStream = stream;
        video.srcObject = stream;
        video.style.display = "block";
        overlay.style.display = "none";
        btnCapture.style.display = "none";
        btnSnap.style.display = "inline-flex";
        
        announceAccessibility("Webcam feed opened successfully. Place waste item in front of screen.");
      })
      .catch(err => {
        console.error("Camera access blocked: ", err);
        triggerToast("Failed to initialize webcam. Use manual photo uploads instead.", "danger");
      });
  }
}

function stopCamera() {
  if (state.cameraStream) {
    state.cameraStream.getTracks().forEach(track => track.stop());
    state.cameraStream = null;
    
    document.getElementById("camera-feed").style.display = "none";
    document.getElementById("scanner-overlay").style.display = "flex";
    document.getElementById("btn-capture").style.display = "inline-flex";
    document.getElementById("btn-snap").style.display = "none";
  }
}

function capturePhoto() {
  const video = document.getElementById("camera-feed");
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;
  
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const base64Image = canvas.toDataURL("image/jpeg");
  
  processImageScan(base64Image, "cam_shot.jpg");
}

function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(e) {
    processImageScan(e.target.result, file.name);
  };
  reader.readAsDataURL(file);
}

function handleFileDrop(event) {
  event.preventDefault();
  const file = event.dataTransfer.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(e) {
    processImageScan(e.target.result, file.name);
  };
  reader.readAsDataURL(file);
}

function processImageScan(base64Data, filename) {
  // Display laser scanner lines
  const laser = document.getElementById("scanner-laser");
  laser.style.display = "block";
  
  announceAccessibility("AI waste scanner running. Scanning materials and carbon indicators.");
  
  fetch('/api/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: state.user_id, image: base64Data, filename: filename })
  })
  .then(r => r.json())
  .then(data => {
    laser.style.display = "none";
    if (data.success) {
      updateUIWithProfile(data.profile);
      displayScanResult(data.scan);
      triggerConfetti();
      triggerToast(`Scanned successfully: ${data.scan.material}!`, "success");
      
      // Auto complete challenge
      if (data.scan.recyclable) {
        completeChallengeLocal("scan_recycle");
      }
    }
  })
  .catch(err => {
    laser.style.display = "none";
    console.error("Scan error: ", err);
    triggerToast("Offline scan mock result completed.", "success");
    
    // simulated local callback
    const mockScan = {
      material: "PET Plastic Juice Bottle",
      decomposition_time: "450 Years",
      co2_impact: -0.083,
      recyclable: true,
      reuse_ideas: ["Use as a seeding starter pot.", "Clean and store bead organizers."],
      xp_earned: 50
    };
    displayScanResult(mockScan);
    
    // update mock profile
    state.profile.green_score = Math.min(state.profile.green_score + 25, 1000);
    state.profile.coins += 50;
    updateUIWithProfile(state.profile);
    completeChallengeLocal("scan_recycle");
  });
}

function displayScanResult(scan) {
  document.getElementById("card-scan-results").style.display = "block";
  document.getElementById("res-material").textContent = scan.material;
  document.getElementById("res-decomp").textContent = scan.decomposition_time;
  document.getElementById("res-co2").textContent = `${scan.co2_impact} kg CO₂`;
  document.getElementById("res-recyclable").textContent = scan.recyclable ? "Yes (Highly recyclable)" : "No (Compost or specialized dropoff needed)";
  
  const reuseUl = document.getElementById("res-reuse");
  reuseUl.innerHTML = "";
  scan.reuse_ideas.forEach(idea => {
    const li = document.createElement("li");
    li.textContent = idea;
    reuseUl.appendChild(li);
  });
  
  document.getElementById("res-reward").textContent = `+${scan.xp_earned} XP & Eco Coins awarded`;
  
  // Speak the scan report details
  announceAccessibility(`Scan complete. Detected ${scan.material}. Decomposition is estimated at ${scan.decomposition_time}. ${scan.xp_earned} coins awarded.`);
}

// ==========================================
// AI ECO COACH CHAT SPEECH INTEGRATIONS
// ==========================================
let chatHistoryList = [
  { sender: 'coach', text: "Hello! Ask me how to optimize your compost pile or how to prevent vampire energy losses." }
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
    body: JSON.stringify({ user_id: state.user_id, message: text, history: chatHistoryList })
  })
  .then(r => r.json())
  .then(data => {
    loader.remove();
    if (data.success) {
      appendChatBubble('coach', data.response);
      chatHistoryList.push({ sender: 'coach', text: data.response });
      
      // Speak out loud if voice assistant is active
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
    // offline simulation
    let simText = "Understood. Composting organic materials diverts food waste from landfills, reducing carbon footprint. Ensure you maintain correct nitrogen balances.";
    if (text.toLowerCase().includes("energy")) {
      simText = "To mitigate energy losses, address standby power consumption by unplugging idle appliances. This avoids up to 10% on energy bills.";
    }
    appendChatBubble('coach', simText);
    chatHistoryList.push({ sender: 'coach', text: simText });
    announceAccessibility(simText);
    
    // Trigger energy mission local check
    if (text.toLowerCase().includes("energy") && !state.profile.completed_challenges.includes("chat_energy")) {
      state.profile.completed_challenges.push("chat_energy");
      state.profile.xp += 40;
      state.profile.coins += 40;
      state.profile.green_score = Math.min(state.profile.green_score + 25, 1000);
      updateUIWithProfile(state.profile);
      triggerConfetti();
      showAchievementModal("Energy Audit", "Slight boost applied to local profile.");
      simulateLocalChallenges();
    }
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

// Dictation input (Speech Recognition API)
let recognition;
function toggleSpeechRecog() {
  const micBtn = document.getElementById("btn-mic");
  
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    triggerToast("Speech recognition is not supported on this browser.", "warning");
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
      micBtn.classList.add("listening");
      micBtn.textContent = "🛑";
      triggerToast("Listening... Speak now.", "info");
    };
    
    recognition.onend = () => {
      state.is_listening = false;
      micBtn.classList.remove("listening");
      micBtn.textContent = "🎤";
    };
    
    recognition.onresult = (event) => {
      const speechToText = event.results[0][0].transcript;
      document.getElementById("chat-input").value = speechToText;
      triggerToast(`Heard: "${speechToText}"`, "success");
      sendCoachMessage();
    };
    
    recognition.onerror = (e) => {
      console.error(e);
      triggerToast("Microphone error occurred.", "danger");
    };
  }
  
  if (state.is_listening) {
    recognition.stop();
  } else {
    recognition.start();
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

function socialLogin(provider) {
  announceAccessibility(`Signing in with ${provider}.`);
  triggerToast(`Authorizing via ${provider}...`, "info");
  
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
      state.user_id = `mock_oauth_${provider.toLowerCase()}`;
      state.profile.name = `${provider} Champion`;
      document.getElementById("lbl-username").textContent = state.profile.name;
      fetchPassportData();
      triggerToast("Mock login completed (Offline Mode)", "success");
      exitAuthView();
      enterDashboard();
    });
  }, 1200);
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

