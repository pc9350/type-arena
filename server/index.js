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

// Coding challenges system
const CODING_SNIPPETS = {
  javascript: [
    `function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

const result = fibonacci(10);
console.log('Fibonacci of 10:', result);`,
    `const users = [
  { name: 'Alice', age: 25, role: 'developer' },
  { name: 'Bob', age: 30, role: 'designer' },
  { name: 'Charlie', age: 35, role: 'manager' }
];

const developers = users
  .filter(user => user.role === 'developer')
  .map(user => ({ ...user, senior: user.age > 25 }));`,
    `async function fetchUserData(userId) {
  try {
    const response = await fetch(\`/api/users/\$\{userId\}\`);
    if (!response.ok) {
      throw new Error('User not found');
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch user:', error);
    return null;
  }
}`
  ],
  python: [
    `def quick_sort(arr):
    if len(arr) <= 1:
        return arr
    
    pivot = arr[len(arr) // 2]
    left = [x for x in arr if x < pivot]
    middle = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]
    
    return quick_sort(left) + middle + quick_sort(right)

numbers = [3, 6, 8, 10, 1, 2, 1]
sorted_numbers = quick_sort(numbers)
print(f"Sorted: {sorted_numbers}")`,
    `class BankAccount:
    def __init__(self, account_number, initial_balance=0):
        self.account_number = account_number
        self.balance = initial_balance
        self.transactions = []
    
    def deposit(self, amount):
        if amount > 0:
            self.balance += amount
            self.transactions.append(f"Deposit: +{amount}")
            return True
        return False
    
    def withdraw(self, amount):
        if 0 < amount <= self.balance:
            self.balance -= amount
            self.transactions.append(f"Withdrawal: -{amount}")
            return True
        return False`,
    `import requests
from datetime import datetime, timedelta

def get_weather_forecast(city, days=5):
    api_key = "your_api_key_here"
    base_url = "http://api.openweathermap.org/data/2.5/forecast"
    
    params = {
        'q': city,
        'appid': api_key,
        'units': 'metric',
        'cnt': days * 8  # 8 forecasts per day (3-hour intervals)
    }
    
    response = requests.get(base_url, params=params)
    if response.status_code == 200:
        return response.json()
    else:
        return None`
  ],
  react: [
    `import React, { useState, useEffect } from 'react';

function TodoApp() {
  const [todos, setTodos] = useState([]);
  const [inputValue, setInputValue] = useState('');

  const addTodo = () => {
    if (inputValue.trim()) {
      setTodos([...todos, { 
        id: Date.now(), 
        text: inputValue, 
        completed: false 
      }]);
      setInputValue('');
    }
  };

  const toggleTodo = (id) => {
    setTodos(todos.map(todo => 
      todo.id === id 
        ? { ...todo, completed: !todo.completed }
        : todo
    ));
  };

  return (
    <div className="todo-app">
      <h1>My Todo List</h1>
      <div className="input-section">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && addTodo()}
          placeholder="Add a new todo..."
        />
        <button onClick={addTodo}>Add</button>
      </div>
    </div>
  );
}`,
    `import { useState, useCallback, useMemo } from 'react';

const useSearch = (items, searchFields) => {
  const [query, setQuery] = useState('');

  const filteredItems = useMemo(() => {
    if (!query.trim()) return items;
    
    return items.filter(item =>
      searchFields.some(field => 
        item[field]?.toLowerCase().includes(query.toLowerCase())
      )
    );
  }, [items, query, searchFields]);

  const handleSearch = useCallback((newQuery) => {
    setQuery(newQuery);
  }, []);

  return {
    query,
    filteredItems,
    handleSearch,
    resultCount: filteredItems.length
  };
};

export default useSearch;`
  ],
  css: [
    `.card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.1) 50%, transparent 70%);
  transform: translateX(-100%);
  transition: transform 0.6s ease;
}

.card:hover::before {
  transform: translateX(100%);
}

.card:hover {
  transform: translateY(-5px);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
}`,
    `@keyframes slideInFromLeft {
  0% {
    transform: translateX(-100%);
    opacity: 0;
  }
  100% {
    transform: translateX(0);
    opacity: 1;
  }
}

.navbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  position: sticky;
  top: 0;
  z-index: 1000;
}

.navbar-brand {
  font-size: 1.5rem;
  font-weight: 700;
  color: #333;
  text-decoration: none;
  animation: slideInFromLeft 0.5s ease-out;
}

.navbar-nav {
  display: flex;
  list-style: none;
  margin: 0;
  padding: 0;
  gap: 2rem;
}`
  ],
  sql: [
    `-- Find top 5 customers by total order value
SELECT 
    c.customer_id,
    c.first_name,
    c.last_name,
    c.email,
    COUNT(o.order_id) as total_orders,
    SUM(oi.quantity * oi.unit_price) as total_spent
FROM customers c
    LEFT JOIN orders o ON c.customer_id = o.customer_id
    LEFT JOIN order_items oi ON o.order_id = oi.order_id
WHERE o.order_date >= DATE_SUB(CURRENT_DATE, INTERVAL 12 MONTH)
GROUP BY c.customer_id, c.first_name, c.last_name, c.email
HAVING total_spent > 1000
ORDER BY total_spent DESC
LIMIT 5;`,
    `-- Create a view for monthly sales summary
CREATE VIEW monthly_sales_summary AS
SELECT 
    YEAR(order_date) as year,
    MONTH(order_date) as month,
    MONTHNAME(order_date) as month_name,
    COUNT(DISTINCT order_id) as total_orders,
    COUNT(DISTINCT customer_id) as unique_customers,
    SUM(total_amount) as gross_revenue,
    AVG(total_amount) as avg_order_value,
    MAX(total_amount) as largest_order
FROM orders 
WHERE order_status != 'cancelled'
GROUP BY YEAR(order_date), MONTH(order_date)
ORDER BY year DESC, month DESC;`
  ]
};

function getRandomCodeSnippet(language) {
  const snippets = CODING_SNIPPETS[language] || CODING_SNIPPETS.javascript;
  return snippets[Math.floor(Math.random() * snippets.length)];
}

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
  MARATHON: { id: 'marathon', name: 'Marathon Runner', description: 'Complete a marathon length race!', icon: '🏃' },
  // Coding achievements
  FIRST_CODE: { id: 'first_code', name: 'Hello World', description: 'Complete your first coding challenge!', icon: '💻' },
  CODE_MASTER: { id: 'code_master', name: 'Code Master', description: 'Complete 10 coding challenges!', icon: '👨‍💻' },
  SYNTAX_PERFECTIONIST: { id: 'syntax_perfect', name: 'Syntax Perfectionist', description: '100% accuracy in a coding challenge!', icon: '🔧' },
  POLYGLOT: { id: 'polyglot', name: 'Polyglot', description: 'Complete challenges in 5 different languages!', icon: '🌍' },
  JAVASCRIPT_NINJA: { id: 'js_ninja', name: 'JavaScript Ninja', description: 'Complete 5 JavaScript challenges!', icon: '🟨' },
  PYTHON_MASTER: { id: 'py_master', name: 'Python Master', description: 'Complete 5 Python challenges!', icon: '🐍' }
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

  // Coding achievements
  if (raceData.mode === 'coding') {
    // First coding challenge
    if (!userAchs.has('first_code')) {
      newAchievements.push(ACHIEVEMENTS.FIRST_CODE);
      userAchs.add('first_code');
    }
    
    // Syntax perfectionist (100% accuracy in coding)
    if (!userAchs.has('syntax_perfect') && raceData.accuracy === 100) {
      newAchievements.push(ACHIEVEMENTS.SYNTAX_PERFECTIONIST);
      userAchs.add('syntax_perfect');
    }
    
    // Track language-specific stats
    if (!stats.languageStats) stats.languageStats = {};
    if (!stats.languageStats[raceData.codeLanguage]) {
      stats.languageStats[raceData.codeLanguage] = 0;
    }
    stats.languageStats[raceData.codeLanguage]++;
    
    // Language-specific achievements
    if (!userAchs.has('js_ninja') && stats.languageStats.javascript >= 5) {
      newAchievements.push(ACHIEVEMENTS.JAVASCRIPT_NINJA);
      userAchs.add('js_ninja');
    }
    if (!userAchs.has('py_master') && stats.languageStats.python >= 5) {
      newAchievements.push(ACHIEVEMENTS.PYTHON_MASTER);
      userAchs.add('py_master');
    }
    
    // Polyglot achievement
    const languageCount = Object.keys(stats.languageStats).length;
    if (!userAchs.has('polyglot') && languageCount >= 5) {
      newAchievements.push(ACHIEVEMENTS.POLYGLOT);
      userAchs.add('polyglot');
    }
    
    // Code master achievement
    const totalCodingChallenges = Object.values(stats.languageStats).reduce((sum, count) => sum + count, 0);
    if (!userAchs.has('code_master') && totalCodingChallenges >= 10) {
      newAchievements.push(ACHIEVEMENTS.CODE_MASTER);
      userAchs.add('code_master');
    }
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

function buildPrompt({ length = 'medium', mode = 'regular', codeLanguage = 'javascript' }) {
  if (mode === 'coding') {
    return getRandomCodeSnippet(codeLanguage);
  }
  
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
      const { mode, length, durationMs, codeLanguage } = config;
      if (mode === 'infinite' || mode === 'regular' || mode === 'timed' || mode === 'coding') race.mode = mode;
      if (length) race.length = length;
      if (typeof durationMs === 'number' && durationMs >= 15000) race.durationMs = durationMs;
      if (codeLanguage) race.codeLanguage = codeLanguage;
      race.prompt = buildPrompt({ length: race.length, mode: race.mode, codeLanguage: race.codeLanguage });
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
    if (race.mode === 'regular' || race.mode === 'coding') {
      p.progress = Math.round((p.charsCorrect / L) * 100);
      if (p.progress >= 100 && !p.finished) {
        p.finished = true;
        const result = { id:p.id, name:p.name, wpm:p.wpm, accuracy:p.accuracy, ts: Date.now(), mode: race.mode, length: race.length, room };
        
        // Update user stats and check for achievements
        const stats = updateUserStats(p.id, p.wpm, p.accuracy);
        const achievements = checkAchievements(p.id, stats, { wpm: p.wpm, accuracy: p.accuracy, length: race.length, mode: race.mode, codeLanguage: race.codeLanguage });
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
    race.prompt = buildPrompt({ length: race.length, mode: race.mode, codeLanguage: race.codeLanguage });
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
