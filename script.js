// script.js — Course-aware MDR game with URL parameter support

// Course configuration - maps course IDs to their settings
const COURSE_CONFIG = {
  "network-plus": {
    title: "Network+ Connections",
    description: "CompTIA Network+ Certification Prep",
    levelsFile: "levels-network-plus.json",
    progressKey: "networkplus_progress",
    totalLevels: 10
  },
  "a-plus-core1": {
    title: "A+ Core 1 Connections",
    description: "CompTIA A+ Core 1 (220-1101) Prep",
    levelsFile: "levels-a-plus-core1.json",
    progressKey: "aplus_core1_progress",
    totalLevels: 10
  },
  "a-plus-core2": {
    title: "A+ Core 2 Connections",
    description: "CompTIA A+ Core 2 (220-1102) Prep",
    levelsFile: "levels-a-plus-core2.json",
    progressKey: "aplus_core2_progress",
    totalLevels: 10
  },
  "security-plus": {
    title: "Security+ Connections",
    description: "CompTIA Security+ Certification Prep",
    levelsFile: "levels-security-plus.json",
    progressKey: "securityplus_progress",
    totalLevels: 10
  }
};

// Parse URL parameters to get course
function getCourseFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  const course = urlParams.get("course");
  // Default to network-plus if no course specified or invalid course
  if (course && COURSE_CONFIG[course]) {
    return course;
  }
  return "network-plus";
}

// Get current course configuration
const CURRENT_COURSE = getCourseFromURL();
const COURSE = COURSE_CONFIG[CURRENT_COURSE];
const TOTAL_LEVELS = COURSE.totalLevels;
const PROGRESS_KEY = COURSE.progressKey;

let timerInterval;
let timeRemaining = 300;
let hintsLeft = 3;
let matchedSetCount = 0;

function loadProgress() {
  return parseInt(localStorage.getItem(PROGRESS_KEY)) || 1;
}

function saveProgress(level) {
  localStorage.setItem(PROGRESS_KEY, level.toString());
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(1, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function startBootAnimation(callback) {
  const boot = document.getElementById("boot-screen");
  boot.style.display = "block";
  boot.innerText = "LOADING MDR INTERFACE...\nDecrypting...\nInitializing Neural Layer...";
  setTimeout(() => {
    boot.style.display = "none";
    callback();
  }, 2000);
}

function buildLevelSelect() {
  // Update page title and heading based on course
  document.title = COURSE.title;
  const heading = document.querySelector("h1");
  if (heading) {
    heading.textContent = COURSE.title;
  }

  const container = document.getElementById("level-select");
  container.innerHTML = "";
  const unlocked = loadProgress();
  for (let i = 1; i <= TOTAL_LEVELS; i++) {
    const btn = document.createElement("button");
    btn.className = "level-btn";
    btn.textContent = `Level ${i}`;
    if (i > unlocked) {
      btn.classList.add("locked");
      btn.disabled = true;
    } else {
      btn.addEventListener("click", () => {
        startBootAnimation(() => startLevel(i));
      });
    }
    container.appendChild(btn);
  }
}

document.addEventListener("DOMContentLoaded", buildLevelSelect);

async function startLevel(level) {
  clearInterval(timerInterval);
  timeRemaining = 300;
  hintsLeft = 3;
  matchedSetCount = 0;

  const gameScreen = document.getElementById("game-screen");
  gameScreen.innerHTML = `
    <div id='ui-panel'>
      Match 4 related terms. Timer = score. Hints cost 15s. Incorrect guesses cost 20s.
      <div id='status-bar'>00% Complete</div>
      <button id='hint-btn'>Use Hint (3 left)</button>
      <button id='shuffle-btn'>Shuffle Tiles</button>
      <div id='timer'>Time: ${formatTime(timeRemaining)}</div>
    </div>
    <div id='grid'></div>
    <div id='boxes'></div>
  `;

  const res = await fetch(COURSE.levelsFile);
  const levels = await res.json();
  const levelData = levels.find(l => l.level === level);
  if (!levelData) return alert("Level data not found.");

  const correctSets = levelData.sets.map(set => new Set(set.terms));
  const labels = levelData.sets.map(set => set.label);
  let allTerms = levelData.sets.flatMap(set => set.terms);
  allTerms = allTerms.sort(() => 0.5 - Math.random());

  const grid = document.getElementById("grid");
  grid.style.display = "grid";
  grid.style.gridTemplateColumns = "repeat(auto-fit, minmax(100px, 1fr))";
  grid.style.gap = "10px";
  grid.style.maxWidth = "600px";
  grid.style.margin = "20px auto";

  const boxes = document.getElementById("boxes");
  boxes.innerHTML = "";
  boxes.style.display = "flex";
  boxes.style.justifyContent = "space-between";

  const selected = [];
  const matchedTerms = new Set();

  labels.forEach((label, i) => {
    const box = document.createElement("div");
    box.id = `box${i}`;
    box.classList.add("drop-box");
    const labelDiv = document.createElement("div");
    labelDiv.className = "box-label";
    labelDiv.textContent = label;
    box.appendChild(labelDiv);
    boxes.appendChild(box);
  });

  function renderTiles(termArray) {
    grid.innerHTML = "";
    termArray.forEach(term => {
      if (matchedTerms.has(term)) return;
      const tile = document.createElement("div");
      tile.className = "tile";
      tile.textContent = term;
      tile.onclick = () => {
        if (tile.classList.contains("selected")) {
          tile.classList.remove("selected");
          const idx = selected.findIndex(obj => obj.tile === tile);
          if (idx !== -1) selected.splice(idx, 1);
        } else {
          if (selected.length >= 4) return;
          tile.classList.add("selected");
          selected.push({ tile, term });
        }
        if (selected.length === 4) checkSelection();
      };
      grid.appendChild(tile);
    });
  }

  renderTiles(allTerms);

  document.getElementById("hint-btn").onclick = () => {
    if (hintsLeft <= 0) return;
    timeRemaining -= 15;
    hintsLeft--;
    document.getElementById("hint-btn").textContent = `Use Hint (${hintsLeft} left)`;
    flashSoftHint();
  };

  document.getElementById("shuffle-btn").onclick = () => {
    const remaining = allTerms.filter(term => !matchedTerms.has(term));
    const shuffled = [...remaining].sort(() => 0.5 - Math.random());
    renderTiles(shuffled);
  };

  function flashSoftHint() {
    for (const set of correctSets) {
      const terms = [...set].filter(term => !matchedTerms.has(term));
      if (terms.length === 4) {
        const tiles = Array.from(document.querySelectorAll(".tile"));
        let found = 0;
        tiles.forEach(tile => {
          if (terms.includes(tile.textContent) && found < 2) {
            found++;
            tile.classList.add("selected");
            setTimeout(() => tile.classList.remove("selected"), 600);
          }
        });
        break;
      }
    }
  }

  function updateStatus() {
    const percent = Math.floor((matchedSetCount / correctSets.length) * 100);
    document.getElementById("status-bar").textContent = `${percent}% Complete`;
  }

  function checkSelection() {
    const current = new Set(selected.map(s => s.term));
    let matchedIndex = -1;
    for (let i = 0; i < correctSets.length; i++) {
      if ([...correctSets[i]].every(t => current.has(t))) {
        matchedIndex = i;
        break;
      }
    }

    if (matchedIndex !== -1) {
      const box = document.getElementById(`box${matchedIndex}`);
      selected.forEach(({ tile, term }) => {
        matchedTerms.add(term);
        tile.classList.remove("selected");
        tile.classList.add("locked");
        tile.onclick = null;
        box.appendChild(tile);
      });
      matchedSetCount++;
      updateStatus();
    } else {
      selected.forEach(({ tile }) => {
        tile.classList.add("wrong");
        setTimeout(() => tile.classList.remove("wrong", "selected"), 500);
      });
    }

    selected.length = 0;

    if (matchedTerms.size === allTerms.length) completeLevel(level);
  }

  timerInterval = setInterval(() => {
    timeRemaining--;
    if (timeRemaining <= 0) {
      clearInterval(timerInterval);
      alert("Out of time. Try again.");
      location.reload();
    }
    document.getElementById("timer").textContent = `Time: ${formatTime(timeRemaining)}`;
  }, 1000);
}

function completeLevel(level) {
  clearInterval(timerInterval);
  alert(`Level ${level} Complete! Time Remaining: ${formatTime(timeRemaining)}`);
  const saved = loadProgress();
  if (level === saved && level < TOTAL_LEVELS) saveProgress(saved + 1);
  location.reload();
}
