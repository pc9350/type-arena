import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());
app.get('/', (_, res) => res.send('Typing Racer server running'));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET','POST'] }
});

const races = new Map();
const topRuns = [];// ephemeral best runs for the session

// Daily challenges system
function generateDailyChallenge() {
  const challenges = [
    { target: 40, description: "Type with 95%+ accuracy", reward: "🎯 Accuracy Master" },
    { target: 60, description: "Maintain consistent speed", reward: "⚡ Speed Demon" },
    { target: 80, description: "No backspaces allowed", reward: "🎖️ Perfect Typist" },
    { target: 50, description: "Beat this in under 2 minutes", reward: "⏱️ Time Master" },
    { target: 70, description: "Type faster than yesterday", reward: "📈 Improvement Star" }
  ];
  const today = new Date().toDateString();
  const seed = today.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  return challenges[seed % challenges.length];
}

let dailyChallenge = generateDailyChallenge();

// Simple user stats tracking (in-memory for now)
const userStats = new Map(); // userId -> { bestWpm, gamesPlayed, streak, lastPlayed }
const userAchievements = new Map(); // userId -> Set of achievement ids

const ACHIEVEMENTS = {
  FIRST_RACE: { id: 'first_race', name: 'Getting Started', description: 'Complete your first race!', icon: '🏁' },
  SPEED_DEMON_50: { id: 'speed_50', name: 'Speed Demon', description: 'Type 50+ WPM!', icon: '⚡' },
  SPEED_DEMON_80: { id: 'speed_80', name: 'Lightning Fast', description: 'Type 80+ WPM!', icon: '🚀' },
  PERFECT_ACCURACY: { id: 'perfect_acc', name: 'Perfectionist', description: '100% accuracy in a race!', icon: '🎯' },
  STREAK_3: { id: 'streak_3', name: 'On Fire', description: '3-day typing streak!', icon: '🔥' },
  STREAK_7: { id: 'streak_7', name: 'Dedication', description: '7-day typing streak!', icon: '💎' },
  NO_BACKSPACE: { id: 'no_backspace', name: 'Smooth Operator', description: 'Complete race with 0 backspaces!', icon: '✨' },
  MARATHON: { id: 'marathon', name: 'Marathon Runner', description: 'Complete a marathon length race!', icon: '🏃' }
};

function checkAchievements(userId, stats, raceData) {
  const userAchs = userAchievements.get(userId) || new Set();
  const newAchievements = [];

  // First race
  if (!userAchs.has('first_race') && stats.gamesPlayed === 1) {
    newAchievements.push(ACHIEVEMENTS.FIRST_RACE);
    userAchs.add('first_race');
  }

  // Speed achievements
  if (!userAchs.has('speed_50') && raceData.wpm >= 50) {
    newAchievements.push(ACHIEVEMENTS.SPEED_DEMON_50);
    userAchs.add('speed_50');
  }
  if (!userAchs.has('speed_80') && raceData.wpm >= 80) {
    newAchievements.push(ACHIEVEMENTS.SPEED_DEMON_80);
    userAchs.add('speed_80');
  }

  // Perfect accuracy
  if (!userAchs.has('perfect_acc') && raceData.accuracy === 100) {
    newAchievements.push(ACHIEVEMENTS.PERFECT_ACCURACY);
    userAchs.add('perfect_acc');
  }

  // Streaks
  if (!userAchs.has('streak_3') && stats.streak >= 3) {
    newAchievements.push(ACHIEVEMENTS.STREAK_3);
    userAchs.add('streak_3');
  }
  if (!userAchs.has('streak_7') && stats.streak >= 7) {
    newAchievements.push(ACHIEVEMENTS.STREAK_7);
    userAchs.add('streak_7');
  }

  // Marathon
  if (!userAchs.has('marathon') && raceData.length === 'marathon') {
    newAchievements.push(ACHIEVEMENTS.MARATHON);
    userAchs.add('marathon');
  }

  userAchievements.set(userId, userAchs);
  return newAchievements;
}

function updateUserStats(userId, wpm, accuracy) {
  const stats = userStats.get(userId) || { bestWpm: 0, gamesPlayed: 0, streak: 0, lastPlayed: null };
  stats.gamesPlayed++;
  if (wpm > stats.bestWpm) stats.bestWpm = wpm;
  
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  
  if (stats.lastPlayed === yesterday) {
    stats.streak++;
  } else if (stats.lastPlayed !== today) {
    stats.streak = 1;
  }
  
  stats.lastPlayed = today;
  userStats.set(userId, stats);
  return stats;
}
const PROMPTS = [
  "The quick brown fox jumps over the lazy dog.",
  "Real time apps are fun when sockets sync the state.",
  "Type faster and keep your accuracy high to win the race.",
  "Phaser drives the cars while React renders the UI.",
  "Consistency beats intensity when practicing typing skills.",
  "Small daily improvements compound into large gains over time.",
  "Keep your shoulders relaxed, your wrists neutral, and your eyes ahead.",
  "Shortcuts and muscle memory help reduce cognitive load while typing.",
  "Accuracy first, then speed. Speed follows accuracy naturally.",
  "Use proper posture and ergonomic setup to prevent strain and fatigue.",
  "Reading complex passages can improve rhythm and punctuation awareness.",
  "Focus on breathing and steady cadence for smoother typing sessions.",
  "Warm up your fingers with simple drills before a long typing session.",
  "Distribute attention between the prompt and your output without staring at keys.",
  "Healthy breaks and hydration keep your performance consistent.",
];

function buildPrompt({ length = 'medium', mode = 'regular' }) {
  // sentence count targets
  const ranges = { short: [1, 2], medium: [3, 5], long: [8, 12], marathon: [20, 40] };
  const [minS, maxS] = ranges[length] || ranges.medium;
  const count = Math.floor(Math.random() * (maxS - minS + 1)) + minS;
  const sentences = [];
  while (sentences.length < count) {
    sentences.push(PROMPTS[Math.floor(Math.random() * PROMPTS.length)]);
  }
  let out = sentences.join(' ');
  if (mode !== 'regular') {
    // Ensure a very long buffer so players never run out
    const targetChars = 50000; // ~50k chars
    const chunk = ' ' + out + ' ';
    while (out.length < targetChars) out += chunk;
  }
  return out;
}

function createRace(room) {
  const prompt = buildPrompt({ length: 'medium', mode: 'regular' });
  const race = {
    id: room,
    prompt,
    startedAt: null,
    finished: false,
    players: new Map(),
    leaderboard: [],
    countdownActive: false,
    countdown: 0,
    countdownTimer: null,
    mode: 'regular',
    length: 'medium',
    durationMs: 5 * 60 * 1000,
    messages: [],
  };
  races.set(room, race);
  return race;
}
function getOrCreateRace(room) {
  const code = (room || Math.random().toString(36).slice(2,8));
  if (!races.has(code)) createRace(code);
  return races.get(code);
}
const wpm = (correct, ms) => Math.round(((correct/5)/Math.max(ms/60000, 1/60)));
const acc = (correct, total) => total ? Math.max(0, Math.min(100, Math.round((correct/total)*100))) : 100;
const BAD_WORDS = ['fuck','shit','bitch','asshole','bastard','dick','pussy','cunt','slut','whore','retard','nigger','faggot'];
function cleanText(text) {
  let out = String(text);
  BAD_WORDS.forEach(w => {
    const re = new RegExp(`\\b${w.replace(/[-/\\^$*+?.()|[\]{}]/g,'\\$&')}\\b`, 'gi');
    out = out.replace(re, (m)=>'*'.repeat(m.length));
  });
  return out;
}
const emitState = (room) => {
  const race = races.get(room); if (!race) return;
  const players = Array.from(race.players.values()).map(p => ({ id:p.id, name:p.name, progress:p.progress, wpm:p.wpm, accuracy:p.accuracy }));
  const leaderboard = [...players].sort((a,b)=> b.progress - a.progress);
  race.leaderboard = leaderboard;
  const sortKey = race.mode === 'regular' ? (x)=>x.progress : (x)=>x.wpm;
  const sorted = [...leaderboard].sort((a,b)=> sortKey(b) - sortKey(a));
  race.leaderboard = sorted;
  io.to(room).emit('race_state', {
    prompt: race.prompt,
    startedAt: race.startedAt,
    finished: race.finished,
    countdown: race.countdownActive ? race.countdown : 0,
    players: sorted,
    mode: race.mode,
    length: race.length,
    durationMs: race.durationMs,
  });
};

io.on('connection', (socket) => {
  socket.data.chatTimes = [];
  socket.on('join_race', ({ name, room }) => {
    const race = getOrCreateRace((room||'').trim());
    socket.join(race.id);
    race.players.set(socket.id, {
      id: socket.id,
      name: (name||('Player '+socket.id.slice(0,4))).slice(0,24),
      progress: 0, wpm: 0, accuracy: 100, charsCorrect:0, totalTyped:0, finished:false
    });
    socket.data.room = race.id;
    socket.emit('joined', { room: race.id, prompt: race.prompt });
    if (race.messages.length) socket.emit('chat_history', race.messages);
    emitState(race.id);
  });

  socket.on('start_race', (config = {}) => {
    const room = socket.data.room; if (!room) return;
    const race = races.get(room); if (!race) return;
    if (!race.startedAt && !race.countdownActive) {
      // apply config if provided by the starter
      const { mode, length, durationMs } = config;
      if (mode === 'infinite' || mode === 'regular' || mode === 'timed') race.mode = mode;
      if (length) race.length = length;
      if (typeof durationMs === 'number' && durationMs >= 15000) race.durationMs = durationMs;
      race.prompt = buildPrompt({ length: race.length, mode: race.mode });
      race.countdownActive = true;
      race.countdown = 3;
      io.to(room).emit('race_countdown', { secondsLeft: race.countdown, mode: race.mode, length: race.length, durationMs: race.durationMs });
      race.countdownTimer = setInterval(() => {
        const r = races.get(room); if (!r) return;
        r.countdown -= 1;
        if (r.countdown > 0) {
          io.to(room).emit('race_countdown', { secondsLeft: r.countdown, mode: r.mode, length: r.length, durationMs: r.durationMs });
        } else {
          clearInterval(r.countdownTimer);
          r.countdownTimer = null;
          r.countdownActive = false;
          r.startedAt = Date.now();
          io.to(room).emit('race_started', { startedAt: r.startedAt, mode: r.mode, length: r.length, durationMs: r.durationMs });
          emitState(room);
        }
      }, 1000);
    }
    emitState(room);
  });

  socket.on('progress_update', ({ charsCorrect, totalTyped, errorKeystrokes }) => {
    const room = socket.data.room; if (!room) return;
    const race = races.get(room); if (!race || !race.startedAt) return;
    const p = race.players.get(socket.id); if (!p) return;
    const L = race.prompt.length;
    p.charsCorrect = Math.min(charsCorrect, L);
    p.totalTyped = Math.max(totalTyped, 0);
    const elapsed = Date.now() - race.startedAt;
    p.wpm = wpm(p.charsCorrect, elapsed);
    if (typeof errorKeystrokes === 'number' && errorKeystrokes >= 0) {
      const denom = Math.max(p.charsCorrect + errorKeystrokes, 1);
      p.accuracy = Math.max(0, Math.min(100, Math.round((p.charsCorrect / denom) * 100)));
    } else {
      p.accuracy = acc(p.charsCorrect, p.totalTyped);
    }
    if (race.mode === 'regular') {
      p.progress = Math.round((p.charsCorrect / L) * 100);
      if (p.progress >= 100 && !p.finished) {
        p.finished = true;
        const result = { id:p.id, name:p.name, wpm:p.wpm, accuracy:p.accuracy, ts: Date.now(), mode: race.mode, length: race.length, room };
        
        // Update user stats and check for achievements
        const stats = updateUserStats(p.id, p.wpm, p.accuracy);
        const achievements = checkAchievements(p.id, stats, { wpm: p.wpm, accuracy: p.accuracy, length: race.length });
        result.isNewRecord = p.wpm === stats.bestWpm;
        result.streak = stats.streak;
        
        // Send achievements to player
        achievements.forEach(ach => {
          socket.emit('achievement_unlocked', ach);
        });
        
        io.to(room).emit('player_finished', result);
        topRuns.push(result);
        topRuns.sort((a,b)=> b.wpm - a.wpm);
        topRuns.splice(50);
        io.emit('top_runs', topRuns);
      }
    } else {
      const maxChars = Math.max(...Array.from(race.players.values()).map(pl => pl.charsCorrect), 1);
      p.progress = Math.round((p.charsCorrect / maxChars) * 100);
    }

    const allDone = race.mode === 'regular' ? Array.from(race.players.values()).every(pl => pl.finished) : false;
    const timeUp = (Date.now() - race.startedAt) > (race.durationMs || 5*60*1000);
    if ((allDone || timeUp) && !race.finished) {
      race.finished = true;
      io.to(room).emit('race_finished', { leaderboard: race.leaderboard });
    }
    emitState(room);
  });

  socket.on('get_top', () => {
    socket.emit('top_runs', topRuns);
  });

  socket.on('get_daily_challenge', () => {
    socket.emit('daily_challenge', dailyChallenge);
  });

  socket.on('restart_race', () => {
    const room = socket.data.room; if (!room) return;
    const race = races.get(room); if (!race) return;
    if (race.countdownTimer) { clearInterval(race.countdownTimer); race.countdownTimer = null; }
    race.prompt = buildPrompt({ length: race.length, mode: race.mode });
    race.startedAt = null;
    race.finished = false;
    race.countdown = 0;
    race.countdownActive = false;
    for (const player of race.players.values()) {
      player.progress = 0; player.wpm = 0; player.accuracy = 100; player.charsCorrect = 0; player.totalTyped = 0; player.finished = false;
    }
    io.to(room).emit('race_restarted', { prompt: race.prompt, mode: race.mode, length: race.length, durationMs: race.durationMs });
    emitState(room);
  });

  socket.on('chat_message', ({ text }) => {
    const room = socket.data.room; if (!room) return;
    const race = races.get(room); if (!race) return;
    const p = race.players.get(socket.id); if (!p) return;
    const now = Date.now();
    socket.data.chatTimes = (socket.data.chatTimes || []).filter(t => now - t < 5000);
    if (socket.data.chatTimes.length >= 5) return;
    socket.data.chatTimes.push(now);
    const mid = `${socket.id}-${now}`;
    const msg = { id: socket.id, name: p.name, text: cleanText(String(text)).slice(0, 500), ts: now, type: 'user', mid, reactions: {} };
    race.messages.push(msg); if (race.messages.length > 100) race.messages.shift();
    io.to(room).emit('chat_message', msg);
  });

  socket.on('typing', ({ isTyping, kind }) => {
    const room = socket.data.room; if (!room) return;
    const race = races.get(room); if (!race) return;
    const p = race.players.get(socket.id); if (!p) return;
    socket.to(room).emit('typing', { id: socket.id, name: p.name, isTyping: !!isTyping, kind: (kind==='race'?'race':'chat'), ts: Date.now() });
  });

  socket.on('typing_ping', ({ kind }) => {
    const room = socket.data.room; if (!room) return;
    const race = races.get(room); if (!race) return;
    const p = race.players.get(socket.id); if (!p) return;
    socket.to(room).emit('typing_ping', { id: socket.id, name: p.name, kind: (kind==='race'?'race':'chat'), ts: Date.now() });
  });

  socket.on('chat_reaction', ({ mid, emoji }) => {
    const room = socket.data.room; if (!room) return;
    const race = races.get(room); if (!race) return;
    const msg = race.messages.find(m => m.mid === mid);
    if (!msg) return;
    const key = String(emoji).slice(0, 4) || '👍';
    msg.reactions[key] = (msg.reactions[key] || 0) + 1;
    io.to(room).emit('chat_reaction', { mid, emoji: key, count: msg.reactions[key] });
  });

  socket.on('send_emote', ({ emoji }) => {
    const room = socket.data.room; if (!room) return;
    const p = races.get(room)?.players.get(socket.id); if (!p) return;
    const safeEmoji = String(emoji).slice(0, 4);
    io.to(room).emit('emote', { id: socket.id, emoji: safeEmoji, ts: Date.now() });
  });

  socket.on('use_power_up', ({ type, duration }) => {
    const room = socket.data.room; if (!room) return;
    const race = races.get(room); if (!race) return;
    const p = race.players.get(socket.id); if (!p) return;
    if (!race.startedAt || race.finished) return;

    // Broadcast power-up usage to all players in room
    io.to(room).emit('power_up_used', { 
      playerId: socket.id, 
      playerName: p.name,
      type, 
      duration: duration || 10000 
    });
  });

  socket.on('disconnect', () => {
    const room = socket.data.room; if (!room) return;
    const race = races.get(room); if (!race) return;
    race.players.delete(socket.id);
    if (race.players.size === 0) {
      if (race.countdownTimer) clearInterval(race.countdownTimer);
      races.delete(room);
    } else emitState(room);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log('Server http://localhost:'+PORT));
