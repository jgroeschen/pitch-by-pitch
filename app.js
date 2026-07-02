/* PitchByPitch Application Logic */

// --- STATE MANAGEMENT ---
let state = {
  teams: [],
  games: [],
  selectedTeamId: null,
  selectedGameId: null,
  activeGame: null // Currently running game state
};

// --- DATABASE SERVICE (IndexedDB) ---
const DB_NAME = 'PitchByPitchDB';
const DB_VERSION = 1;
let db = null;

function initDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = (e) => reject(e.target.error);
    request.onsuccess = (e) => {
      db = e.target.result;
      resolve();
    };
    
    request.onupgradeneeded = (e) => {
      const database = e.target.result;
      
      // Store for Teams
      if (!database.objectStoreNames.contains('teams')) {
        database.createObjectStore('teams', { keyPath: 'id', autoIncrement: true });
      }
      
      // Store for Saved Games
      if (!database.objectStoreNames.contains('games')) {
        database.createObjectStore('games', { keyPath: 'id', autoIncrement: true });
      }
      
      // Store for Active Game State (for persistence on refresh)
      if (!database.objectStoreNames.contains('active')) {
        database.createObjectStore('active', { keyPath: 'key' });
      }
    };
  });
}

// DB Helpers
function dbGetTeams() {
  return new Promise((resolve) => {
    const transaction = db.transaction(['teams'], 'readonly');
    const store = transaction.objectStore('teams');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
  });
}

function dbSaveTeam(team) {
  return new Promise((resolve) => {
    const transaction = db.transaction(['teams'], 'readwrite');
    const store = transaction.objectStore('teams');
    const request = team.id ? store.put(team) : store.add(team);
    request.onsuccess = (e) => {
      if (!team.id) team.id = e.target.result;
      resolve(team);
    };
  });
}

function dbDeleteTeam(id) {
  return new Promise((resolve) => {
    const transaction = db.transaction(['teams'], 'readwrite');
    const store = transaction.objectStore('teams');
    const request = store.delete(id);
    request.onsuccess = () => resolve();
  });
}

function dbGetGames() {
  return new Promise((resolve) => {
    const transaction = db.transaction(['games'], 'readonly');
    const store = transaction.objectStore('games');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
  });
}

function dbSaveGame(game) {
  return new Promise((resolve) => {
    const transaction = db.transaction(['games'], 'readwrite');
    const store = transaction.objectStore('games');
    const request = game.id ? store.put(game) : store.add(game);
    request.onsuccess = (e) => {
      if (!game.id) game.id = e.target.result;
      resolve(game);
    };
  });
}

function dbDeleteGame(id) {
  return new Promise((resolve) => {
    const transaction = db.transaction(['games'], 'readwrite');
    const store = transaction.objectStore('games');
    const request = store.delete(id);
    request.onsuccess = () => resolve();
  });
}

function dbGetActiveGame() {
  return new Promise((resolve) => {
    const transaction = db.transaction(['active'], 'readonly');
    const store = transaction.objectStore('active');
    const request = store.get('current');
    request.onsuccess = () => resolve(request.result ? request.result.state : null);
  });
}

function dbSaveActiveGame(gameState) {
  return new Promise((resolve) => {
    const transaction = db.transaction(['active'], 'readwrite');
    const store = transaction.objectStore('active');
    store.put({ key: 'current', state: gameState });
    transaction.oncomplete = () => resolve();
  });
}

function dbClearActiveGame() {
  return new Promise((resolve) => {
    const transaction = db.transaction(['active'], 'readwrite');
    const store = transaction.objectStore('active');
    store.delete('current');
    transaction.oncomplete = () => resolve();
  });
}

// Pre-populate DB with default teams if empty (ponytail: quick onboarding setup)
async function checkAndPrepopulate() {
  const teams = await dbGetTeams();
  if (teams.length === 0) {
    const team1 = {
      name: "Thunder",
      players: [
        { id: 101, name: "Marcus Rivera", number: 12, lineup: 1, position: 1 }, // Pitcher
        { id: 102, name: "Alex Chen", number: 4, lineup: 2, position: 2 },    // Catcher
        { id: 103, name: "Tyler Davis", number: 25, lineup: 3, position: 3 },  // 1B
        { id: 104, name: "Sam Jackson", number: 7, lineup: 4, position: 4 },   // 2B
        { id: 105, name: "Leo Miller", number: 9, lineup: 5, position: 5 },    // 3B
        { id: 106, name: "Ryan Brooks", number: 2, lineup: 6, position: 6 },   // SS
        { id: 107, name: "Zack Smith", number: 19, lineup: 7, position: 7 },   // LF
        { id: 108, name: "Eli Johnson", number: 11, lineup: 8, position: 8 },  // CF
        { id: 109, name: "Jordan Taylor", number: 15, lineup: 9, position: 9 }, // RF
        { id: 110, name: "Bobby Wood", number: 22, lineup: 10, position: null } // Extra hitter
      ]
    };
    const team2 = {
      name: "Cyclones",
      players: [
        { id: 201, name: "Chris Evans", number: 5, lineup: 1, position: 6 },   // SS
        { id: 202, name: "Ben Martinez", number: 14, lineup: 2, position: 4 }, // 2B
        { id: 203, name: "Will Thompson", number: 44, lineup: 3, position: 3 },// 1B
        { id: 204, name: "Danny Lopez", number: 8, lineup: 4, position: 7 },   // LF
        { id: 205, name: "Gabe White", number: 32, lineup: 5, position: 8 },   // CF
        { id: 206, name: "Justin Lee", number: 21, lineup: 6, position: 5 },   // 3B
        { id: 207, name: "Nick Carter", number: 18, lineup: 7, position: 9 },  // RF
        { id: 208, name: "Luke Harris", number: 3, lineup: 8, position: 2 },   // Catcher
        { id: 209, name: "Kyle Nelson", number: 33, lineup: 9, position: 1 },  // Pitcher
        { id: 210, name: "Matt Baker", number: 10, lineup: 10, position: null } // Extra hitter
      ]
    };
    await dbSaveTeam(team1);
    await dbSaveTeam(team2);
    state.teams = [team1, team2];
  } else {
    state.teams = teams;
  }
}


// --- TAB MANAGEMENT ---
function initTabs() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;
      switchTab(tabId);
    });
  });
}

function switchTab(tabId) {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  
  const activeBtn = document.querySelector(`.nav-btn[data-tab="${tabId}"]`);
  const activePanel = document.getElementById(tabId);
  
  if (activeBtn && activePanel) {
    activeBtn.classList.add('active');
    activePanel.classList.add('active');
  }

  // Reload specific tab data
  if (tabId === 'tab-teams') {
    renderTeamsTab();
  } else if (tabId === 'tab-history') {
    renderHistoryTab();
  } else if (tabId === 'tab-game') {
    renderGameTab();
  }
}


// --- TEAMS & ROSTERS MANAGER ---
function renderTeamsTab() {
  const teamsList = document.getElementById('teams-list');
  teamsList.innerHTML = '';
  
  state.teams.forEach(team => {
    const item = document.createElement('div');
    item.className = `team-item ${state.selectedTeamId === team.id ? 'active' : ''}`;
    item.innerHTML = `
      <div>
        <div style="font-weight:600;">${escapeHtml(team.name)}</div>
        <div class="team-meta">${team.players.length} Players</div>
      </div>
    `;
    item.addEventListener('click', () => {
      state.selectedTeamId = team.id;
      renderTeamsTab();
      renderRosterEditor(team);
    });
    teamsList.appendChild(item);
  });
  
  if (state.selectedTeamId) {
    const selected = state.teams.find(t => t.id === state.selectedTeamId);
    if (selected) renderRosterEditor(selected);
  } else {
    document.getElementById('roster-editor-container').classList.add('hidden');
    document.getElementById('btn-delete-team').classList.add('hidden');
    document.getElementById('roster-select-prompt').classList.remove('hidden');
    document.getElementById('roster-team-title').innerText = 'Select a Team';
  }
}

function renderRosterEditor(team) {
  document.getElementById('roster-select-prompt').classList.add('hidden');
  document.getElementById('roster-editor-container').classList.remove('hidden');
  document.getElementById('btn-delete-team').classList.remove('hidden');
  document.getElementById('roster-team-title').innerText = team.name;
  
  const list = document.getElementById('roster-players-list');
  list.innerHTML = '';
  
  // Sort players by lineup position if they have one, then alphabetically
  const sortedPlayers = [...team.players].sort((a, b) => {
    if (a.lineup && b.lineup) return a.lineup - b.lineup;
    if (a.lineup) return -1;
    if (b.lineup) return 1;
    return a.name.localeCompare(b.name);
  });
  
  sortedPlayers.forEach(player => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>#${player.number}</strong></td>
      <td>${escapeHtml(player.name)}</td>
      <td>
        <input type="number" class="player-lineup-input" data-pid="${player.id}" value="${player.lineup || ''}" min="1" max="99">
      </td>
      <td>
        <input type="number" class="player-pos-input" data-pid="${player.id}" value="${player.position || ''}" min="1" max="9">
      </td>
      <td>
        <button class="btn btn-danger btn-sm btn-delete-player" data-pid="${player.id}">Delete</button>
      </td>
    `;
    list.appendChild(tr);
  });
  
  // Setup input listeners for dynamic updates
  list.querySelectorAll('.player-lineup-input').forEach(input => {
    input.addEventListener('change', async (e) => {
      const pid = parseInt(e.target.dataset.pid);
      const val = e.target.value === '' ? null : parseInt(e.target.value);
      
      const p = team.players.find(x => x.id === pid);
      if (p) {
        p.lineup = val;
        await dbSaveTeam(team);
        // Save updates to active game too, if relevant
        if (state.activeGame) syncActiveGameRosters();
      }
    });
  });

  list.querySelectorAll('.player-pos-input').forEach(input => {
    input.addEventListener('change', async (e) => {
      const pid = parseInt(e.target.dataset.pid);
      const val = e.target.value === '' ? null : parseInt(e.target.value);
      
      // Basic validation: positions 1-9 should be unique among fielders
      if (val !== null && (val < 1 || val > 9)) {
        alert('Position must be between 1 (P) and 9 (RF).');
        e.target.value = '';
        return;
      }
      
      if (val !== null) {
        const duplicate = team.players.find(x => x.id !== pid && x.position === val);
        if (duplicate) {
          alert(`Warning: Position ${val} is already assigned to ${duplicate.name}.`);
        }
      }
      
      const p = team.players.find(x => x.id === pid);
      if (p) {
        p.position = val;
        await dbSaveTeam(team);
        if (state.activeGame) syncActiveGameRosters();
      }
    });
  });

  list.querySelectorAll('.btn-delete-player').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const pid = parseInt(e.target.dataset.pid);
      team.players = team.players.filter(x => x.id !== pid);
      await dbSaveTeam(team);
      renderRosterEditor(team);
      renderTeamsTab();
      if (state.activeGame) syncActiveGameRosters();
    });
  });
}

// Sync active game rosters when changed in Roster tab (ponytail: keep it aligned)
function syncActiveGameRosters() {
  const g = state.activeGame;
  const awayTeam = state.teams.find(t => t.id === g.settings.awayTeamId);
  const homeTeam = state.teams.find(t => t.id === g.settings.homeTeamId);
  
  if (awayTeam) {
    g.awayLineup = awayTeam.players.filter(p => p.lineup !== null).sort((a,b)=>a.lineup-b.lineup).map(p=>p.id);
    g.awayDefense = {};
    awayTeam.players.forEach(p => {
      if (p.position) g.awayDefense[p.position] = p.id;
    });
  }
  if (homeTeam) {
    g.homeLineup = homeTeam.players.filter(p => p.lineup !== null).sort((a,b)=>a.lineup-b.lineup).map(p=>p.id);
    g.homeDefense = {};
    homeTeam.players.forEach(p => {
      if (p.position) g.homeDefense[p.position] = p.id;
    });
  }
  dbSaveActiveGame(g);
  renderGameTrackerState();
}


// --- ACTIVE GAME ENGINE ---
function renderGameTab() {
  if (state.activeGame) {
    document.getElementById('game-setup-container').classList.add('hidden');
    document.getElementById('active-game-container').classList.remove('hidden');
    document.getElementById('live-scoreboard').classList.remove('hidden');
    renderGameTrackerState();
  } else {
    document.getElementById('game-setup-container').classList.remove('hidden');
    document.getElementById('active-game-container').classList.add('hidden');
    document.getElementById('live-scoreboard').classList.add('hidden');
    
    // Populate team setup dropdowns
    const awaySel = document.getElementById('setup-away-team');
    const homeSel = document.getElementById('setup-home-team');
    awaySel.innerHTML = '';
    homeSel.innerHTML = '';
    
    state.teams.forEach(t => {
      const optAway = document.createElement('option');
      optAway.value = t.id;
      optAway.innerText = t.name;
      awaySel.appendChild(optAway);
      
      const optHome = document.createElement('option');
      optHome.value = t.id;
      optHome.innerText = t.name;
      homeSel.appendChild(optHome);
    });
    
    // Default select
    if (state.teams.length >= 2) {
      homeSel.selectedIndex = 1;
    }
  }
}

async function startNewGame(awayId, homeId, maxInnings) {
  const awayTeam = state.teams.find(t => t.id === awayId);
  const homeTeam = state.teams.find(t => t.id === homeId);
  
  if (!awayTeam || !homeTeam) return alert('Invalid teams selected.');
  if (awayId === homeId) return alert('Away and Home teams must be different.');
  
  // Ensure lineups are valid (ponytail: auto-fill helper if empty)
  if (awayTeam.players.filter(p => p.lineup).length === 0) {
    alert(`Away team (${awayTeam.name}) has no players in the lineup. Please set batting orders first in the Rosters tab.`);
    switchTab('tab-teams');
    return;
  }
  if (homeTeam.players.filter(p => p.lineup).length === 0) {
    alert(`Home team (${homeTeam.name}) has no players in the lineup. Please set batting orders first in the Rosters tab.`);
    switchTab('tab-teams');
    return;
  }

  // Pre-load lineups
  const awayLineup = awayTeam.players.filter(p => p.lineup !== null).sort((a,b)=>a.lineup-b.lineup).map(p=>p.id);
  const homeLineup = homeTeam.players.filter(p => p.lineup !== null).sort((a,b)=>a.lineup-b.lineup).map(p=>p.id);
  
  const awayDefense = {};
  awayTeam.players.forEach(p => { if(p.position) awayDefense[p.position] = p.id; });
  
  const homeDefense = {};
  homeTeam.players.forEach(p => { if(p.position) homeDefense[p.position] = p.id; });

  // Initialize stats dictionary for all rostered players
  const playerStats = {};
  [...awayTeam.players, ...homeTeam.players].forEach(p => {
    playerStats[p.id] = {
      name: p.name,
      number: p.number,
      teamId: p.id < 200 ? awayId : homeId, // ponytail: simple ID routing
      batting: { ab: 0, r: 0, h: 0, rbi: 0, bb: 0, so: 0 },
      pitching: { pitches: 0, strikes: 0, balls: 0, so: 0, bb: 0, runs: 0, outsRecorded: 0 },
      fielding: { po: 0, a: 0, e: 0 }
    };
  });

  state.activeGame = {
    settings: { awayTeamId: awayId, homeTeamId: homeId, innings: maxInnings },
    awayTeamName: awayTeam.name,
    homeTeamName: homeTeam.name,
    awayLineup,
    homeLineup,
    awayDefense,
    homeDefense,
    
    currentInning: 1,
    isTop: true,
    score: { away: 0, home: 0 },
    outs: 0,
    balls: 0,
    strikes: 0,
    
    awayBatterIndex: 0,
    homeBatterIndex: 0,
    
    // Map base: player ID or null
    bases: { 1: null, 2: null, 3: null },
    
    plays: [],
    playerStats,
    date: new Date().toLocaleDateString()
  };
  
  await dbSaveActiveGame(state.activeGame);
  renderGameTab();
}

function getActiveBatterId() {
  const g = state.activeGame;
  if (g.isTop) {
    return g.awayLineup[g.awayBatterIndex];
  } else {
    return g.homeLineup[g.homeBatterIndex];
  }
}

function getActivePitcherId() {
  const g = state.activeGame;
  // If top of inning, Home team is pitching
  if (g.isTop) {
    return g.homeDefense[1] || null; // Position 1 is Pitcher
  } else {
    return g.awayDefense[1] || null;
  }
}

function getPlayerName(pid) {
  if (!pid) return "--";
  const g = state.activeGame;
  return g.playerStats[pid] ? g.playerStats[pid].name : "Unknown";
}

function renderGameTrackerState() {
  const g = state.activeGame;
  if (!g) return;
  
  // Scoreboard
  document.getElementById('score-away-name').innerText = g.awayTeamName.substring(0, 3);
  document.getElementById('score-away-runs').innerText = g.score.away;
  document.getElementById('score-home-name').innerText = g.homeTeamName.substring(0, 3);
  document.getElementById('score-home-runs').innerText = g.score.home;
  
  const arrow = document.getElementById('inning-arrow');
  arrow.className = g.isTop ? 'arrow-up' : 'arrow-down';
  
  const suffixes = ["th", "st", "nd", "rd"];
  const val = g.currentInning;
  const suffix = (val % 100 >= 11 && val % 100 <= 13) ? "th" : (suffixes[val % 10] || "th");
  document.getElementById('inning-number').innerText = val + suffix;
  
  // Outs dots
  document.getElementById('out-dot-1').className = g.outs >= 1 ? 'dot active' : 'dot';
  document.getElementById('out-dot-2').className = g.outs >= 2 ? 'dot active' : 'dot';
  
  // Balls & Strikes
  document.getElementById('balls-count').innerText = g.balls;
  document.getElementById('strikes-count').innerText = g.strikes;
  
  // Batter/Pitcher Info card
  const batterId = getActiveBatterId();
  const pitcherId = getActivePitcherId();
  
  const bStat = g.playerStats[batterId];
  if (bStat) {
    const avg = bStat.batting.ab > 0 ? (bStat.batting.h / bStat.batting.ab).toFixed(3) : '.000';
    document.getElementById('current-batter-info').innerHTML = `
      <span class="number">#${bStat.number}</span> 
      <span class="name">${escapeHtml(bStat.name)}</span>
      <span class="stats-mini">AVG ${avg} (${bStat.batting.h}-${bStat.batting.ab})</span>
    `;
  } else {
    document.getElementById('current-batter-info').innerHTML = '<span class="name">No Batter</span>';
  }
  
  const pStat = g.playerStats[pitcherId];
  if (pStat) {
    document.getElementById('current-pitcher-info').innerHTML = `
      <span class="number">#${pStat.number}</span> 
      <span class="name">${escapeHtml(pStat.name)}</span>
      <span class="stats-mini">P: ${pStat.pitching.pitches} (S: ${pStat.pitching.strikes} B: ${pStat.pitching.balls})</span>
    `;
  } else {
    document.getElementById('current-pitcher-info').innerHTML = '<span class="name">No Pitcher</span>';
  }
  
  // On Deck & In the Hole
  const lineup = g.isTop ? g.awayLineup : g.homeLineup;
  const idx = g.isTop ? g.awayBatterIndex : g.homeBatterIndex;
  
  const onDeckId = lineup[(idx + 1) % lineup.length];
  const inHoleId = lineup[(idx + 2) % lineup.length];
  
  document.getElementById('player-on-deck').innerText = getPlayerName(onDeckId);
  document.getElementById('player-in-the-hole').innerText = getPlayerName(inHoleId);
  
  // Bases Visualization
  updateBaseVisual(1, g.bases[1]);
  updateBaseVisual(2, g.bases[2]);
  updateBaseVisual(3, g.bases[3]);
  
  // Render Logs
  renderPlayLogs();
  
  // Render Box score
  renderLinescoreTable();
}

function updateBaseVisual(baseNum, playerId) {
  const baseEl = document.getElementById(`field-base-${baseNum}`);
  if (playerId) {
    baseEl.classList.add('occupied');
    const tag = baseEl.querySelector('.runner-name-tag');
    tag.innerText = getPlayerName(playerId).split(' ')[0]; // just first name for size
    tag.classList.remove('hidden');
  } else {
    baseEl.classList.remove('occupied');
    baseEl.querySelector('.runner-name-tag').classList.add('hidden');
  }
}

function renderPlayLogs() {
  const logEl = document.getElementById('play-by-play-log');
  logEl.innerHTML = '';
  
  const g = state.activeGame;
  if (!g || g.plays.length === 0) {
    logEl.innerHTML = '<div class="log-empty">No plays logged yet. Start pitching!</div>';
    return;
  }
  
  // Display latest logs on top
  [...g.plays].reverse().forEach(play => {
    const item = document.createElement('div');
    let entryClass = '';
    if (play.type.includes('Hit')) entryClass = 'entry-hit';
    else if (play.type.includes('Out') || play.type.includes('Strikeout')) entryClass = 'entry-out';
    else if (play.type.includes('Walk')) entryClass = 'entry-walk';
    else if (play.type === 'Inning') entryClass = 'entry-inning';
    
    item.className = `log-entry ${entryClass}`;
    item.innerHTML = `
      <div style="display:flex; justify-content:space-between; font-weight:600; font-size:0.75rem; margin-bottom: 2px;">
        <span>${play.situation || ''}</span>
        <span style="color:var(--text-secondary);">${play.time || ''}</span>
      </div>
      <div>${escapeHtml(play.desc)}</div>
    `;
    logEl.appendChild(item);
  });
}

function renderLinescoreTable() {
  const g = state.activeGame;
  const header = document.getElementById('linescore-header');
  const awayRow = document.getElementById('linescore-away');
  const homeRow = document.getElementById('linescore-home');
  
  // Setup headers for total innings (minimum 7, or current inning if higher)
  const maxInnings = Math.max(g.settings.innings, g.currentInning);
  
  let headerHtml = '<th>Team</th>';
  for (let i = 1; i <= maxInnings; i++) {
    headerHtml += `<th>${i}</th>`;
  }
  headerHtml += '<th>R</th><th>H</th><th>E</th>';
  header.innerHTML = headerHtml;
  
  // Compute runs per inning
  const awayPerInning = Array(maxInnings).fill(0);
  const homePerInning = Array(maxInnings).fill(0);
  
  // ponytail: calculate linescore from plays
  g.plays.forEach(p => {
    if (p.inning && p.runsScored) {
      if (p.isTop) {
        awayPerInning[p.inning - 1] += p.runsScored;
      } else {
        homePerInning[p.inning - 1] += p.runsScored;
      }
    }
  });
  
  // Count hits and errors
  let awayHits = 0, homeHits = 0;
  let awayErrors = 0, homeErrors = 0;
  
  Object.keys(g.playerStats).forEach(pid => {
    const stats = g.playerStats[pid];
    const isAway = stats.teamId === g.settings.awayTeamId;
    if (isAway) {
      awayHits += stats.batting.h;
      awayErrors += stats.fielding.e;
    } else {
      homeHits += stats.batting.h;
      homeErrors += stats.fielding.e;
    }
  });

  // Construct Away row HTML
  let awayHtml = `<td class="team-col">${g.awayTeamName.substring(0,6)}</td>`;
  for (let i = 0; i < maxInnings; i++) {
    // Show '-' if inning hasn't occurred yet
    const played = (g.currentInning > i + 1) || (g.currentInning === i + 1);
    awayHtml += `<td>${played ? awayPerInning[i] : '-'}</td>`;
  }
  awayHtml += `<td class="runs-col">${g.score.away}</td><td>${awayHits}</td><td>${awayErrors}</td>`;
  awayRow.innerHTML = awayHtml;

  // Construct Home row HTML
  let homeHtml = `<td class="team-col">${g.homeTeamName.substring(0,6)}</td>`;
  for (let i = 0; i < maxInnings; i++) {
    const played = (g.currentInning > i + 1) || (g.currentInning === i + 1 && !g.isTop);
    homeHtml += `<td>${played ? homePerInning[i] : '-'}</td>`;
  }
  homeHtml += `<td class="runs-col">${g.score.home}</td><td>${homeHits}</td><td>${homeErrors}</td>`;
  homeRow.innerHTML = homeHtml;
}


// --- SEQUENTIAL RUNNER ADJUSTMENT MODAL CODE ---
let modalState = {
  pitchResult: "", // "Ball", "Strike", "Foul", "Hit", "Out"
  runners: [], // List of active runners to assign destinations
  selectedRunnerIdx: 0, // Current runner being positioned on the interactive diamond
  putout: "",
  assist: "",
  error: "",
  rbi: 0
};

// Initialize event listeners for Game controls
function initGameActions() {
  document.getElementById('btn-start-game').addEventListener('click', () => {
    const awayId = parseInt(document.getElementById('setup-away-team').value);
    const homeId = parseInt(document.getElementById('setup-home-team').value);
    const innings = parseInt(document.getElementById('setup-innings').value);
    startNewGame(awayId, homeId, innings);
  });
  
  document.getElementById('btn-end-game').addEventListener('click', () => {
    if (confirm("Are you sure you want to end the game? Stats will be compiled and saved to history.")) {
      completeActiveGame();
    }
  });

  document.getElementById('btn-undo-pitch').addEventListener('click', () => {
    undoLastPlay();
  });
  
  // Mini box score tabs
  document.querySelectorAll('.panel-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.panel-tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.panel-tab-content').forEach(c => c.classList.remove('active'));
      
      btn.classList.add('active');
      const tabId = btn.dataset.logTab;
      document.getElementById(tabId).classList.add('active');
    });
  });

  // Pitch log click interceptors
  document.querySelectorAll('.pitch-buttons-grid button').forEach(btn => {
    btn.addEventListener('click', () => {
      const result = btn.dataset.pitch;
      openRunnerAdjustmentModal(result);
    });
  });
  
  // Modal Destination Diamond base clicks
  document.querySelectorAll('.adj-base, .adj-out-zone').forEach(baseEl => {
    baseEl.addEventListener('click', () => {
      const dest = parseInt(baseEl.dataset.base);
      assignSelectedRunnerDestination(dest);
    });
  });
  
  document.getElementById('btn-modal-cancel').addEventListener('click', () => {
    // ponytail: "No Runner Changes" accepts the default/pre-populated base outcomes
    saveRunnerAdjustment(true);
  });
  
  document.getElementById('btn-modal-save').addEventListener('click', () => {
    saveRunnerAdjustment(false);
  });
}

function openRunnerAdjustmentModal(result) {
  const g = state.activeGame;
  if (!g) return;
  
  const batterId = getActiveBatterId();
  const pitcherId = getActivePitcherId();
  if (!batterId || !pitcherId) {
    alert('Please configure team rosters and lineups in the Roster tab first.');
    return;
  }
  
  modalState.pitchResult = result;
  modalState.putout = "";
  modalState.assist = "";
  modalState.error = "";
  modalState.rbi = 0;
  
  // Set dropdown values back to default
  document.getElementById('fielding-putout').value = "";
  document.getElementById('fielding-assist').value = "";
  document.getElementById('fielding-error').value = "";
  document.getElementById('batter-rbi').value = "0";

  // Build the list of active runners that are moving/adjusting on this play
  // They include:
  // - Runner on 3rd (base: 3)
  // - Runner on 2nd (base: 2)
  // - Runner on 1st (base: 1)
  // - Batter (base: 0, starting from home plate)
  
  const runners = [];
  
  // Process bases 3 down to 1
  for (let b = 3; b >= 1; b--) {
    const pid = g.bases[b];
    if (pid) {
      runners.push({
        id: pid,
        name: getPlayerName(pid),
        fromBase: b,
        toBase: b // default is hold on same base
      });
    }
  }
  
  // Batter
  runners.push({
    id: batterId,
    name: getPlayerName(batterId),
    fromBase: 0, // Home
    toBase: 0 // default is hold at home (e.g. on a non-strike-3 / non-walk pitch)
  });

  // pre-populate base destinations according to baseball rule guesses
  prepopulateDestinations(result, runners);

  modalState.runners = runners;
  modalState.selectedRunnerIdx = runners.length - 1; // default select the batter
  
  // Render Modal UI
  document.getElementById('runner-modal-title').innerText = `Pitch Result: ${result}`;
  document.getElementById('runner-modal').classList.remove('hidden');
  
  // Show fielding section only if someone is going out or if pitch is Hit/Out
  const showFielding = (result === "Hit" || result === "Out" || result === "Strike" || result === "Ball");
  if (showFielding) {
    document.getElementById('fielding-details-container').classList.remove('hidden');
  } else {
    document.getElementById('fielding-details-container').classList.add('hidden');
  }
  
  renderModalRunnersList();
  highlightInteractiveDiamond();
}

function prepopulateDestinations(result, runners) {
  const g = state.activeGame;
  const isStrike3 = (result === "Strike" && g.strikes === 2);
  const isBall4 = (result === "Ball" && g.balls === 3);
  
  if (result === "Hit") {
    // Simple guess: Batter goes to 1st, runners advance 1 base
    runners.forEach(r => {
      if (r.fromBase === 0) r.toBase = 1; // Batter to 1st
      else r.toBase = Math.min(4, r.fromBase + 1); // Others +1
    });
  } else if (result === "Out") {
    // Batter is Out, others hold
    runners.forEach(r => {
      if (r.fromBase === 0) r.toBase = 0; // Out (represented by 0)
      else r.toBase = r.fromBase; // hold
    });
  } else if (isStrike3) {
    // Batter is Out, others hold
    runners.forEach(r => {
      if (r.fromBase === 0) r.toBase = 0; // Out
      else r.toBase = r.fromBase;
    });
  } else if (isBall4) {
    // Walk: Batter goes to 1st, others advance only if forced
    let forceAt1 = true;
    let forceAt2 = false;
    let forceAt3 = false;
    
    // Check who is forced
    runners.forEach(r => {
      if (r.fromBase === 1) forceAt2 = true;
    });
    if (forceAt2) {
      runners.forEach(r => {
        if (r.fromBase === 2) forceAt3 = true;
      });
    }
    
    runners.forEach(r => {
      if (r.fromBase === 0) r.toBase = 1; // Batter to 1st
      else if (r.fromBase === 1) r.toBase = 2; // Forced
      else if (r.fromBase === 2 && forceAt3) r.toBase = 3; // Forced
      else if (r.fromBase === 3 && forceAt3) r.toBase = 4; // Forced to Home (scores)
      else r.toBase = r.fromBase; // Holds
    });
  } else {
    // Default Ball, Strike, Foul: all hold, batter holds at home (0)
    runners.forEach(r => {
      if (r.fromBase === 0) r.toBase = 0;
      else r.toBase = r.fromBase;
    });
  }
}

function renderModalRunnersList() {
  const listEl = document.getElementById('modal-runners-list');
  listEl.innerHTML = '';
  
  modalState.runners.forEach((r, idx) => {
    const row = document.createElement('div');
    row.className = `modal-runner-row ${modalState.selectedRunnerIdx === idx ? 'selected' : ''}`;
    
    let fromStr = r.fromBase === 0 ? "Batter" : `Runner on ${r.fromBase}${getOrdinal(r.fromBase)}`;
    let toStr = "Hold";
    let destClass = "";
    
    if (r.toBase === 0) {
      toStr = "OUT";
      destClass = "dest-out";
    } else if (r.toBase === 4) {
      toStr = "Scores (Home)";
      destClass = "dest-base";
    } else if (r.toBase !== r.fromBase) {
      toStr = `Advance to ${r.toBase}${getOrdinal(r.toBase)}`;
      destClass = "dest-base";
    }
    
    row.innerHTML = `
      <div class="runner-info">
        <span class="runner-name">${escapeHtml(r.name)}</span>
        <span class="runner-origin">${fromStr}</span>
      </div>
      <div class="runner-dest ${destClass}">${toStr}</div>
    `;
    
    row.addEventListener('click', () => {
      modalState.selectedRunnerIdx = idx;
      renderModalRunnersList();
      highlightInteractiveDiamond();
    });
    
    listEl.appendChild(row);
  });
}

function getOrdinal(n) {
  return n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th';
}

function highlightInteractiveDiamond() {
  // Clear highlights
  document.querySelectorAll('.adj-base, .adj-out-zone').forEach(el => {
    el.classList.remove('highlighted-destination');
  });
  
  const runner = modalState.runners[modalState.selectedRunnerIdx];
  if (!runner) return;
  
  const dest = runner.toBase;
  let targetSelector = '';
  
  if (dest === 0) {
    targetSelector = '.adj-out-zone';
  } else if (dest === 1) {
    targetSelector = '.first-base';
  } else if (dest === 2) {
    targetSelector = '.second-base';
  } else if (dest === 3) {
    targetSelector = '.third-base';
  } else if (dest === 4) {
    targetSelector = '.home-base';
  }
  
  const targetEl = document.querySelector(targetSelector);
  if (targetEl) {
    targetEl.classList.add('highlighted-destination');
  }
}

function assignSelectedRunnerDestination(destBase) {
  const runner = modalState.runners[modalState.selectedRunnerIdx];
  if (!runner) return;
  
  // Rules check: batter (fromBase 0) cannot "hold" at home plate if pitch result ended plate appearance
  // but let them place them freely.
  runner.toBase = destBase;
  
  renderModalRunnersList();
  highlightInteractiveDiamond();
}

async function saveRunnerAdjustment(isSkipQuickSave = false) {
  const g = state.activeGame;
  if (!g) return;
  
  // Extract inputs
  const putoutPos = document.getElementById('fielding-putout').value;
  const assistPos = document.getElementById('fielding-assist').value;
  const errorPos = document.getElementById('fielding-error').value;
  const rbiCredit = parseInt(document.getElementById('batter-rbi').value) || 0;
  
  // Close modal
  document.getElementById('runner-modal').classList.add('hidden');
  
  // We need to commit the pitch result to the game state
  const pitchType = modalState.pitchResult;
  const activeBatterId = getActiveBatterId();
  const activePitcherId = getActivePitcherId();
  
  // Deep clone current state for undo support
  const historySnapshot = JSON.stringify(g);
  
  // Track statistics increment variables
  let runsThisPlay = 0;
  let outsThisPlay = 0;
  
  // 1. Process pitcher pitches count
  const pStat = g.playerStats[activePitcherId];
  if (pStat) {
    pStat.pitching.pitches++;
    if (pitchType === "Strike" || pitchType === "Foul") {
      pStat.pitching.strikes++;
    } else if (pitchType === "Ball") {
      pStat.pitching.balls++;
    } else {
      // In-play Hit/Out count as strikes generally in pitch stats
      pStat.pitching.strikes++;
    }
  }

  // 2. Increment balls/strikes count temporarily to check standard walk/strikeout conditions
  let isStrikeout = false;
  let isWalk = false;
  
  if (pitchType === "Strike") {
    g.strikes++;
    if (g.strikes === 3) isStrikeout = true;
  } else if (pitchType === "Ball") {
    g.balls++;
    if (g.balls === 4) isWalk = true;
  } else if (pitchType === "Foul") {
    if (g.strikes < 2) g.strikes++;
  }
  
  // 3. Process runner placements from the modal
  const nextBases = { 1: null, 2: null, 3: null };
  
  modalState.runners.forEach(r => {
    const isBatter = r.fromBase === 0;
    
    // Compile Runs and Outs
    if (r.toBase === 4) { // reached Home
      runsThisPlay++;
      // Credit run to player
      if (g.playerStats[r.id]) {
        g.playerStats[r.id].batting.r++;
      }
    } else if (r.toBase === 0) { // Out
      outsThisPlay++;
      // If batter struck out or got out in play
      if (isBatter) {
        if (isStrikeout && g.playerStats[r.id]) {
          g.playerStats[r.id].batting.so++;
        }
      }
    } else if (r.toBase >= 1 && r.toBase <= 3) {
      nextBases[r.toBase] = r.id;
    }
  });

  // Credit RBIs to batter
  if (g.playerStats[activeBatterId]) {
    g.playerStats[activeBatterId].batting.rbi += rbiCredit;
  }
  
  // 4. Update fielding stats credits
  if (putoutPos && g.isTop) { // Home team is fielding
    const fielderId = g.homeDefense[putoutPos];
    if (fielderId && g.playerStats[fielderId]) g.playerStats[fielderId].fielding.po++;
  } else if (putoutPos && !g.isTop) {
    const fielderId = g.awayDefense[putoutPos];
    if (fielderId && g.playerStats[fielderId]) g.playerStats[fielderId].fielding.po++;
  }
  
  if (assistPos && g.isTop) {
    const fielderId = g.homeDefense[assistPos];
    if (fielderId && g.playerStats[fielderId]) g.playerStats[fielderId].fielding.a++;
  } else if (assistPos && !g.isTop) {
    const fielderId = g.awayDefense[assistPos];
    if (fielderId && g.playerStats[fielderId]) g.playerStats[fielderId].fielding.a++;
  }

  if (errorPos && g.isTop) {
    const fielderId = g.homeDefense[errorPos];
    if (fielderId && g.playerStats[fielderId]) g.playerStats[fielderId].fielding.e++;
  } else if (errorPos && !g.isTop) {
    const fielderId = g.awayDefense[errorPos];
    if (fielderId && g.playerStats[fielderId]) g.playerStats[fielderId].fielding.e++;
  }

  // Credit Pitcher with outs recorded
  if (pStat) {
    pStat.pitching.outsRecorded += outsThisPlay;
  }
  
  // Determine if this play ended the batter's plate appearance
  const isHit = (pitchType === "Hit");
  const isOut = (pitchType === "Out");
  const plateAppearanceEnded = isHit || isOut || isStrikeout || isWalk;
  
  // Compile description for play log
  let desc = `${getPlayerName(activeBatterId)}: `;
  if (isHit) {
    desc += "Hits a ball in play.";
    if (g.playerStats[activeBatterId]) g.playerStats[activeBatterId].batting.h++;
    if (g.playerStats[activeBatterId]) g.playerStats[activeBatterId].batting.ab++;
  } else if (isOut) {
    desc += "Out in play.";
    if (g.playerStats[activeBatterId]) g.playerStats[activeBatterId].batting.ab++;
  } else if (isStrikeout) {
    desc += "Strikes out.";
    if (g.playerStats[activeBatterId]) g.playerStats[activeBatterId].batting.ab++;
    if (pStat) pStat.pitching.so++;
  } else if (isWalk) {
    desc += "Walks.";
    if (g.playerStats[activeBatterId]) g.playerStats[activeBatterId].batting.bb++;
    if (pStat) pStat.pitching.bb++;
  } else {
    desc += `${pitchType}.`;
  }
  
  // Add detail about runs scored
  if (runsThisPlay > 0) {
    desc += ` [${runsThisPlay} Run(s) score]`;
  }
  
  // Update scoreboard runs
  if (g.isTop) {
    g.score.away += runsThisPlay;
  } else {
    g.score.home += runsThisPlay;
  }
  
  // Update Pitcher runs allowed
  if (pStat) {
    pStat.pitching.runs += runsThisPlay;
  }

  // Set bases to the new runner map
  g.bases = nextBases;
  
  // Log this play
  const currentInningStr = `${g.isTop ? 'Top' : 'Bot'} ${g.currentInning}`;
  const countSituation = `${g.balls}-${g.strikes}, ${g.outs} Out`;
  
  g.plays.push({
    type: pitchType,
    desc,
    situation: `${currentInningStr} | ${countSituation}`,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    inning: g.currentInning,
    isTop: g.isTop,
    runsScored: runsThisPlay,
    snapshot: historySnapshot // Save full snapshot on the play for easy multi-step undo
  });

  // Apply outs increment
  g.outs += outsThisPlay;

  // Handle PA end (reset balls/strikes, advance lineup)
  if (plateAppearanceEnded) {
    g.balls = 0;
    g.strikes = 0;
    
    // Advance batter in lineup
    if (g.isTop) {
      g.awayBatterIndex = (g.awayBatterIndex + 1) % g.awayLineup.length;
    } else {
      g.homeBatterIndex = (g.homeBatterIndex + 1) % g.homeLineup.length;
    }
  }
  
  // 5. Handle Inning transition (3 outs)
  if (g.outs >= 3) {
    const prevInningStr = `${g.isTop ? 'Top' : 'Bottom'} of the ${g.currentInning}${getOrdinal(g.currentInning)}`;
    g.plays.push({
      type: "Inning",
      desc: `Inning over. 3 outs recorded. Side retired for ${prevInningStr}.`,
      situation: `End of ${g.isTop ? 'Top' : 'Bot'} ${g.currentInning}`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      inning: g.currentInning,
      isTop: g.isTop,
      runsScored: 0
    });

    g.outs = 0;
    g.balls = 0;
    g.strikes = 0;
    g.bases = { 1: null, 2: null, 3: null };
    
    // Transition inning
    if (g.isTop) {
      g.isTop = false; // Top to Bottom
    } else {
      g.isTop = true; // Bottom to Top of next
      g.currentInning++;
    }
  }

  // Check Game Completion conditions (ponytail: simple logic)
  checkGameEndConditions();

  await dbSaveActiveGame(g);
  renderGameTrackerState();
}

function checkGameEndConditions() {
  const g = state.activeGame;
  const maxInnings = g.settings.innings;
  
  // Bottom of final inning, Home team leads
  if (g.currentInning >= maxInnings && !g.isTop && g.score.home > g.score.away) {
    // Home team wins walk-off or simple end
    g.isCompleted = true;
  }
  
  // Top of final inning ends (3 outs) and Home team was already leading, 
  // or Bottom of final inning ends (3 outs) and game is not tied.
  // We'll let the user manually end the game as recommended, rather than hard-locking them.
}

async function undoLastPlay() {
  const g = state.activeGame;
  if (!g || g.plays.length === 0) return;
  
  // Find last play with a snapshot
  let lastSnap = null;
  let snapIndex = -1;
  
  for (let i = g.plays.length - 1; i >= 0; i--) {
    if (g.plays[i].snapshot) {
      lastSnap = g.plays[i].snapshot;
      snapIndex = i;
      break;
    }
  }
  
  if (lastSnap) {
    state.activeGame = JSON.parse(lastSnap);
    await dbSaveActiveGame(state.activeGame);
    renderGameTrackerState();
  } else {
    alert("Cannot undo further.");
  }
}

async function completeActiveGame() {
  const g = state.activeGame;
  if (!g) return;
  
  g.isCompleted = true;
  await dbSaveGame(g);
  await dbClearActiveGame();
  
  state.activeGame = null;
  state.selectedGameId = g.id || null;
  
  // Reload both tabs
  await loadDatabaseData();
  switchTab('tab-history');
}


// --- GAME HISTORY & BOX SCORES ---
function renderHistoryTab() {
  const listEl = document.getElementById('game-history-list');
  listEl.innerHTML = '';
  
  if (state.games.length === 0) {
    listEl.innerHTML = '<div style="text-align:center;color:var(--text-secondary);padding:30px;">No completed games recorded.</div>';
    return;
  }
  
  state.games.forEach(game => {
    const item = document.createElement('div');
    item.className = `game-history-item ${state.selectedGameId === game.id ? 'active' : ''}`;
    
    const winTeam = game.score.away > game.score.home ? game.awayTeamName : game.homeTeamName;
    const lossTeam = game.score.away > game.score.home ? game.homeTeamName : game.awayTeamName;
    const winScore = Math.max(game.score.away, game.score.home);
    const lossScore = Math.min(game.score.away, game.score.home);
    
    item.innerHTML = `
      <div class="game-date">${game.date}</div>
      <div class="game-teams">
        <span>${escapeHtml(game.awayTeamName)} vs ${escapeHtml(game.homeTeamName)}</span>
      </div>
      <div class="game-meta-score">${winTeam} def. ${lossTeam} (${winScore}-${lossScore})</div>
    `;
    
    item.addEventListener('click', () => {
      state.selectedGameId = game.id;
      renderHistoryTab();
      renderGameDetails(game);
    });
    
    listEl.appendChild(item);
  });
  
  if (state.selectedGameId) {
    const selected = state.games.find(g => g.id === state.selectedGameId);
    if (selected) renderGameDetails(selected);
  } else {
    document.getElementById('game-detail-placeholder').classList.remove('hidden');
    document.getElementById('game-detail-container').classList.add('hidden');
  }
}

function renderGameDetails(game) {
  document.getElementById('game-detail-placeholder').classList.add('hidden');
  document.getElementById('game-detail-container').classList.remove('hidden');
  
  document.getElementById('history-detail-title').innerText = `${game.awayTeamName} @ ${game.homeTeamName} (${game.date})`;
  
  // Render details linescore
  const linescoreEl = document.getElementById('detail-linescore');
  
  // Compute max inning in the play log
  let maxInnings = game.settings.innings;
  game.plays.forEach(p => {
    if (p.inning && p.inning > maxInnings) maxInnings = p.inning;
  });
  
  const awayPerInning = Array(maxInnings).fill(0);
  const homePerInning = Array(maxInnings).fill(0);
  
  game.plays.forEach(p => {
    if (p.inning && p.runsScored) {
      if (p.isTop) awayPerInning[p.inning - 1] += p.runsScored;
      else homePerInning[p.inning - 1] += p.runsScored;
    }
  });
  
  let awayHits = 0, homeHits = 0;
  let awayErrors = 0, homeErrors = 0;
  
  Object.keys(game.playerStats).forEach(pid => {
    const stats = game.playerStats[pid];
    const isAway = stats.teamId === game.settings.awayTeamId;
    if (isAway) {
      awayHits += stats.batting.h;
      awayErrors += stats.fielding.e;
    } else {
      homeHits += stats.batting.h;
      homeErrors += stats.fielding.e;
    }
  });

  let headHtml = '<thead><tr><th>Team</th>';
  for (let i = 1; i <= maxInnings; i++) {
    headHtml += `<th>${i}</th>`;
  }
  headHtml += '<th>R</th><th>H</th><th>E</th></tr></thead>';
  
  let bodyHtml = '<tbody>';
  // Away
  bodyHtml += `<tr><td class="team-col">${escapeHtml(game.awayTeamName)}</td>`;
  for (let i = 0; i < maxInnings; i++) bodyHtml += `<td>${awayPerInning[i]}</td>`;
  bodyHtml += `<td class="runs-col">${game.score.away}</td><td>${awayHits}</td><td>${awayErrors}</td></tr>`;
  
  // Home
  bodyHtml += `<tr><td class="team-col">${escapeHtml(game.homeTeamName)}</td>`;
  for (let i = 0; i < maxInnings; i++) bodyHtml += `<td>${homePerInning[i]}</td>`;
  bodyHtml += `<td class="runs-col">${game.score.home}</td><td>${homeHits}</td><td>${homeErrors}</td></tr>`;
  bodyHtml += '</tbody>';
  
  linescoreEl.innerHTML = headHtml + bodyHtml;
  
  // Render Batting, Pitching, Fielding stats tables
  renderDetailedStatsTables(game);
  
  // Render Log
  const logListEl = document.getElementById('detail-pbp-list');
  logListEl.innerHTML = '';
  game.plays.forEach(play => {
    const item = document.createElement('div');
    let entryClass = '';
    if (play.type.includes('Hit')) entryClass = 'entry-hit';
    else if (play.type.includes('Out') || play.type.includes('Strikeout')) entryClass = 'entry-out';
    else if (play.type.includes('Walk')) entryClass = 'entry-walk';
    else if (play.type === 'Inning') entryClass = 'entry-inning';
    
    item.className = `log-entry ${entryClass}`;
    item.innerHTML = `
      <div style="display:flex; justify-content:space-between; font-weight:600; font-size:0.75rem; margin-bottom: 2px;">
        <span>${play.situation || ''}</span>
        <span style="color:var(--text-secondary);">${play.time || ''}</span>
      </div>
      <div>${escapeHtml(play.desc)}</div>
    `;
    logListEl.appendChild(item);
  });
}

function renderDetailedStatsTables(game) {
  const battingTbody = document.querySelector('#table-detail-batting tbody');
  const pitchingTbody = document.querySelector('#table-detail-pitching tbody');
  const fieldingTbody = document.querySelector('#table-detail-fielding tbody');
  
  battingTbody.innerHTML = '';
  pitchingTbody.innerHTML = '';
  fieldingTbody.innerHTML = '';
  
  Object.keys(game.playerStats).forEach(pid => {
    const stats = game.playerStats[pid];
    const teamName = stats.teamId === game.settings.awayTeamId ? game.awayTeamName : game.homeTeamName;
    
    // Batting Row (ab > 0 or bb > 0)
    if (stats.batting.ab > 0 || stats.batting.bb > 0) {
      const avg = stats.batting.ab > 0 ? (stats.batting.h / stats.batting.ab).toFixed(3) : '.000';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>#${stats.number}</strong> ${escapeHtml(stats.name)}</td>
        <td>${escapeHtml(teamName)}</td>
        <td>${stats.batting.ab}</td>
        <td>${stats.batting.r}</td>
        <td>${stats.batting.h}</td>
        <td>${stats.batting.rbi}</td>
        <td>${stats.batting.bb}</td>
        <td>${stats.batting.so}</td>
        <td>${avg}</td>
      `;
      battingTbody.appendChild(tr);
    }
    
    // Pitching Row (pitches > 0)
    if (stats.pitching.pitches > 0) {
      // Calculate Innings Pitched
      const fullIP = Math.floor(stats.pitching.outsRecorded / 3);
      const partialIP = stats.pitching.outsRecorded % 3;
      const ipStr = `${fullIP}.${partialIP}`;
      
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>#${stats.number}</strong> ${escapeHtml(stats.name)}</td>
        <td>${escapeHtml(teamName)}</td>
        <td>${ipStr}</td>
        <td>${stats.pitching.runs}</td>
        <td>${stats.pitching.runs}</td> <!-- Runs and ER treated identical in ponytail -->
        <td>${stats.pitching.bb}</td>
        <td>${stats.pitching.so}</td>
        <td>${stats.pitching.pitches}</td>
        <td>${stats.pitching.strikes}/${stats.pitching.balls}</td>
      `;
      pitchingTbody.appendChild(tr);
    }
    
    // Fielding Row (po > 0 or a > 0 or e > 0)
    if (stats.fielding.po > 0 || stats.fielding.a > 0 || stats.fielding.e > 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>#${stats.number}</strong> ${escapeHtml(stats.name)}</td>
        <td>${escapeHtml(teamName)}</td>
        <td>${stats.fielding.po}</td>
        <td>${stats.fielding.a}</td>
        <td>${stats.fielding.e}</td>
      `;
      fieldingTbody.appendChild(tr);
    }
  });
}

function initHistoryDetailActions() {
  // Detail views inner tab swappers
  document.querySelectorAll('.detail-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.detail-tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.detail-tab-content').forEach(c => c.classList.remove('active'));
      
      btn.classList.add('active');
      const tabId = btn.dataset.detailTab;
      document.getElementById(tabId).classList.add('active');
    });
  });

  document.getElementById('btn-delete-game').addEventListener('click', async () => {
    if (state.selectedGameId && confirm("Are you sure you want to delete this game record?")) {
      await dbDeleteGame(state.selectedGameId);
      state.selectedGameId = null;
      await loadDatabaseData();
      renderHistoryTab();
    }
  });
}


// --- TEAM SETUP ACTIONS ---
function initTeamActions() {
  document.getElementById('btn-create-team').addEventListener('click', async () => {
    const nameInput = document.getElementById('new-team-name');
    const name = nameInput.value.trim();
    if (!name) return alert('Enter a team name.');
    
    const team = { name, players: [] };
    await dbSaveTeam(team);
    nameInput.value = '';
    
    state.teams.push(team);
    state.selectedTeamId = team.id;
    renderTeamsTab();
  });
  
  document.getElementById('btn-delete-team').addEventListener('click', async () => {
    if (state.selectedTeamId && confirm("Delete this team and all roster players?")) {
      await dbDeleteTeam(state.selectedTeamId);
      state.teams = state.teams.filter(t => t.id !== state.selectedTeamId);
      state.selectedTeamId = null;
      renderTeamsTab();
    }
  });

  document.getElementById('btn-add-player').addEventListener('click', async () => {
    const nameInput = document.getElementById('new-player-name');
    const numInput = document.getElementById('new-player-number');
    
    const name = nameInput.value.trim();
    const number = numInput.value === '' ? 0 : parseInt(numInput.value);
    
    if (!name) return alert('Enter player name.');
    
    const team = state.teams.find(t => t.id === state.selectedTeamId);
    if (!team) return;
    
    // Check if number already in use
    const duplicate = team.players.find(x => x.number === number);
    if (duplicate) {
      alert(`Warning: Jersey number #${number} is already in use by ${duplicate.name}.`);
    }

    const player = {
      id: Date.now(), // ponytail: simple timestamp ID
      name,
      number,
      lineup: null,
      position: null
    };
    
    team.players.push(player);
    await dbSaveTeam(team);
    
    nameInput.value = '';
    numInput.value = '';
    renderRosterEditor(team);
    renderTeamsTab();
    if (state.activeGame) syncActiveGameRosters();
  });
}


// --- DATA EXPORT & IMPORT ---
function initDatabaseTools() {
  document.getElementById('btn-export-db').addEventListener('click', () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
      teams: state.teams,
      games: state.games
    }, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `pitchbypitch_backup_${new Date().toISOString().slice(0,10)}.json`);
    dlAnchorElem.click();
  });
  
  document.getElementById('import-db-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (data.teams && Array.isArray(data.teams)) {
          // Clear current team DB and restore
          const currentTeams = await dbGetTeams();
          for (const t of currentTeams) await dbDeleteTeam(t.id);
          for (const t of data.teams) {
            delete t.id; // Let autoIncrement re-assign key
            await dbSaveTeam(t);
          }
        }
        
        if (data.games && Array.isArray(data.games)) {
          const currentGames = await dbGetGames();
          for (const g of currentGames) await dbDeleteGame(g.id);
          for (const g of data.games) {
            delete g.id;
            await dbSaveGame(g);
          }
        }
        
        alert("Data imported successfully!");
        await loadDatabaseData();
        switchTab('tab-teams');
      } catch (err) {
        alert("Error parsing backup file: " + err.message);
      }
    };
    reader.readAsText(file);
  });
}


// --- UTILITIES & SYSTEM LOADER ---
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
}

async function loadDatabaseData() {
  state.teams = await dbGetTeams();
  state.games = await dbGetGames();
}

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('ServiceWorker registered with scope:', reg.scope))
      .catch(err => console.log('ServiceWorker registration failed:', err));
  });
}

// App Launch Setup
window.addEventListener('DOMContentLoaded', async () => {
  try {
    await initDb();
    await checkAndPrepopulate();
    await loadDatabaseData();
    
    // Auto restore active game if exists
    const restored = await dbGetActiveGame();
    if (restored) {
      state.activeGame = restored;
    }
    
    // Bind all handlers
    initTabs();
    initGameActions();
    initTeamActions();
    initHistoryDetailActions();
    initDatabaseTools();
    
    // Initial draw
    switchTab('tab-game');
  } catch (err) {
    console.error("Critical launch error:", err);
  }
});
