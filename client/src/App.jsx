import React, { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import Phaser from 'phaser';

// UI libs
import confetti from 'canvas-confetti';

// Sound effects using Web Audio API
class SoundEffects {
  constructor() {
    this.audioContext = null;
    this.sounds = new Map();
    this.enabled = localStorage.getItem('soundEnabled') !== 'false';
  }

  async init() {
    if (this.audioContext) return;
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.createSounds();
    } catch (e) {
      console.warn('Audio not supported');
    }
  }

  createSounds() {
    // Typing sound
    this.sounds.set('type', this.createTone(800, 0.05, 0.1));
    // Error sound
    this.sounds.set('error', this.createTone(200, 0.1, 0.3));
    // Achievement sound
    this.sounds.set('achievement', this.createMelody([523, 659, 784], 0.3));
    // Finish sound
    this.sounds.set('finish', this.createMelody([523, 659, 784, 1047], 0.5));
  }

  createTone(frequency, duration, volume = 0.1) {
    return () => {
      if (!this.enabled || !this.audioContext) return;
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(volume, this.audioContext.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration);
      
      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + duration);
    };
  }

  createMelody(frequencies, duration) {
    return () => {
      if (!this.enabled || !this.audioContext) return;
      frequencies.forEach((freq, i) => {
        setTimeout(() => this.createTone(freq, 0.3, 0.15)(), i * 150);
      });
    };
  }

  play(sound) {
    const soundFn = this.sounds.get(sound);
    if (soundFn) soundFn();
  }

  toggle() {
    this.enabled = !this.enabled;
    localStorage.setItem('soundEnabled', this.enabled);
    return this.enabled;
  }
}

const soundEffects = new SoundEffects();

const POWER_UPS = {
  SPEED: { 
    id: 'speed', 
    name: 'Speed Boost', 
    icon: '⚡', 
    description: '1.5x WPM for 10s',
    duration: 10000,
    cooldown: 30000,
    color: 'from-yellow-400 to-orange-500',
    hotkey: 'Alt+Q'
  },
  SHIELD: { 
    id: 'shield', 
    name: 'Shield', 
    icon: '🛡️', 
    description: 'Next 3 mistakes ignored',
    uses: 3,
    cooldown: 45000,
    color: 'from-blue-400 to-cyan-500',
    hotkey: 'Alt+W'
  },
  FREEZE: { 
    id: 'freeze', 
    name: 'Freeze', 
    icon: '🧊', 
    description: 'Slow opponents for 8s',
    duration: 8000,
    cooldown: 60000,
    color: 'from-cyan-400 to-blue-500',
    hotkey: 'Alt+E'
  },
  PRECISION: { 
    id: 'precision', 
    name: 'Precision', 
    icon: '🎯', 
    description: '100% accuracy for 20 chars',
    uses: 20,
    cooldown: 40000,
    color: 'from-green-400 to-emerald-500',
    hotkey: 'Alt+R'
  }
};

const THEMES = {
  default: {
    name: 'Ocean Breeze',
    background: 'bg-gradient-to-b from-indigo-50 via-white to-purple-50',
    header: 'backdrop-blur bg-white/70',
    card: 'bg-white',
    accent: 'bg-indigo-600 hover:bg-indigo-700',
    text: 'text-gray-900',
    input: 'bg-white border-gray-300 text-gray-900 focus:ring-indigo-500',
    textarea: 'bg-white border-gray-300 text-gray-900 focus:ring-indigo-500',
    promptBg: 'bg-gray-50',
    navButton: 'bg-gray-100 text-gray-700 border-gray-200',
    navTag: 'bg-gray-100 text-gray-900',
    soundButton: 'text-gray-700'
  },
  forest: {
    name: 'Forest',
    background: 'bg-gradient-to-b from-green-100 via-emerald-50 to-teal-50',
    header: 'backdrop-blur bg-green-50/90',
    card: 'bg-white',
    accent: 'bg-green-600 hover:bg-green-700',
    text: 'text-gray-900',
    input: 'bg-white border-green-300 text-gray-900 focus:ring-green-500',
    textarea: 'bg-white border-green-300 text-gray-900 focus:ring-green-500',
    promptBg: 'bg-green-50',
    navButton: 'bg-green-100 text-green-800 border-green-200',
    navTag: 'bg-green-100 text-green-900',
    soundButton: 'text-green-800'
  },
  dark: {
    name: 'Midnight',
    background: 'bg-gradient-to-b from-gray-900 via-gray-800 to-black',
    header: 'backdrop-blur bg-gray-900/80',
    card: 'bg-gray-800 text-white border-gray-600',
    accent: 'bg-purple-600 hover:bg-purple-700',
    text: 'text-white',
    input: 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:ring-purple-500 focus:border-purple-500',
    textarea: 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:ring-purple-500 focus:border-purple-500',
    promptBg: 'bg-gray-700',
    navButton: 'bg-gray-700 text-white border-gray-600 hover:bg-gray-600',
    navTag: 'bg-gray-700 text-white border-gray-600',
    soundButton: 'text-white'
  },
  cyberpunk: {
    name: 'Cyberpunk',
    background: 'bg-gradient-to-b from-pink-900 via-purple-900 to-black',
    header: 'backdrop-blur bg-black/80',
    card: 'bg-gray-900 text-cyan-100 border-cyan-500/30',
    accent: 'bg-cyan-500 hover:bg-cyan-400 text-black',
    text: 'text-cyan-100',
    input: 'bg-gray-800 border-cyan-500/50 text-cyan-100 placeholder-cyan-300/70 focus:ring-cyan-400 focus:border-cyan-400',
    textarea: 'bg-gray-800 border-cyan-500/50 text-cyan-100 placeholder-cyan-300/70 focus:ring-cyan-400 focus:border-cyan-400',
    promptBg: 'bg-gray-800',
    navButton: 'bg-gray-800 text-cyan-100 border-cyan-500/50 hover:bg-gray-700',
    navTag: 'bg-gray-800 text-cyan-100 border-cyan-500/30',
    soundButton: 'text-cyan-100'
  }
};

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';

export default function App() {
  const [name, setName] = useState('');
  const [room, setRoom] = useState(() => {
    try { return new URLSearchParams(location.search).get('room') || ''; } catch { return ''; }
  });
  const [challengeTarget, setChallengeTarget] = useState(() => {
    try { return parseInt(new URLSearchParams(location.search).get('challenge')) || null; } catch { return null; }
  });
  const [dailyChallenge, setDailyChallenge] = useState(null);
  const [achievements, setAchievements] = useState([]);
  const [showAchievement, setShowAchievement] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(soundEffects.enabled);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'default');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [joined, setJoined] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [startedAt, setStartedAt] = useState(null);
  const [players, setPlayers] = useState([]);
  const [finished, setFinished] = useState(false);
  const [typed, setTyped] = useState('');
  const [socketId, setSocketId] = useState(null);
  const [countdown, setCountdown] = useState(0);
  const [messages, setMessages] = useState([]);
  const [chatText, setChatText] = useState('');
  const [typingUsers, setTypingUsers] = useState(new Map()); // id -> {name, kind, ts}
  const typingUsersRef = useRef(new Map());
  const TYPING_TTL_MS = 1000;
  const [mode, setMode] = useState('regular'); // 'regular' | 'infinite' | 'coding'
  const [length, setLength] = useState('medium');
  const [codeLanguage, setCodeLanguage] = useState('javascript');
  const [durationMs, setDurationMs] = useState(5 * 60 * 1000);
  const [timeLeft, setTimeLeft] = useState(null);
  const [wpmSeries, setWpmSeries] = useState([]); // [{t,w}]
  const [accSeries, setAccSeries] = useState([]); // [{t,a}]
  const [backspaces, setBackspaces] = useState(0);
  const [firstKeyAt, setFirstKeyAt] = useState(null);
  const [errorKeys, setErrorKeys] = useState(0); // non-correct keystrokes (excluding backspaces)
  const [uniqueErrors, setUniqueErrors] = useState(0); // unique wrong positions
  const wrongPositionsRef = useRef(new Set());
  const [topRuns, setTopRuns] = useState([]);

  // Power-ups system
  const [powerUps, setPowerUps] = useState([]);
  const [activePowerUps, setActivePowerUps] = useState(new Map()); // id -> {type, endsAt, data}
  const [powerUpCooldowns, setPowerUpCooldowns] = useState(new Map()); // type -> endsAt
  const [shieldCount, setShieldCount] = useState(0);
  const [frozenUntil, setFrozenUntil] = useState(0);
  const [showTutorial, setShowTutorial] = useState(!localStorage.getItem('tutorialCompleted'));
  const [showHelp, setShowHelp] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  
  // Typing insights
  const [slowestKeys, setSlowestKeys] = useState(new Map()); // key -> avgTime
  const [keyTimes, setKeyTimes] = useState([]); // [{key, time, timestamp}]
  const [lastKeyTime, setLastKeyTime] = useState(Date.now());
  const [showInsights, setShowInsights] = useState(false);

  const socket = useMemo(() => io(SERVER_URL, { transports: ['websocket'] }), []);

  useEffect(() => {
    socket.on('connect', () => setSocketId(socket.id));
    socket.on('joined', ({ room, prompt }) => {
      setRoom(room);
      setPrompt(prompt);
      setJoined(true);
      try { history.replaceState(null, '', `?room=${encodeURIComponent(room)}`); } catch {}
    });
    socket.on('race_started', ({ startedAt, mode, length, durationMs }) => { setStartedAt(startedAt); if (mode) setMode(mode); if (length) setLength(length); if (durationMs) setDurationMs(durationMs); });
    socket.on('race_countdown', ({ secondsLeft, mode, length, durationMs }) => { setCountdown(secondsLeft); if (mode) setMode(mode); if (length) setLength(length); if (durationMs) setDurationMs(durationMs); });
    socket.on('race_state', (state) => {
      setPrompt(state.prompt);
      setStartedAt(state.startedAt);
      setPlayers(state.players);
      setFinished(state.finished);
      if (state.countdown) setCountdown(state.countdown); else setCountdown(0);
      if (state.mode) setMode(state.mode);
      if (state.length) setLength(state.length);
      if (state.durationMs) setDurationMs(state.durationMs);
    });
    socket.on('race_finished', () => { 
      setFinished(true); 
      soundEffects.play('finish');
      confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } }); 
      localStorage.setItem('firstRaceCompleted', 'true');
    });
    socket.on('race_restarted', ({ prompt, mode, length, durationMs }) => { setPrompt(prompt); setFinished(false); setTyped(''); setCountdown(0); setStartedAt(null); if (mode) setMode(mode); if (length) setLength(length); if (durationMs) setDurationMs(durationMs); });
    socket.on('chat_message', (msg) => setMessages(m => [...m.slice(-98), msg]));
    socket.on('emote', (e) => setMessages(m => [...m.slice(-98), { id: e.id, name: 'Emote', text: e.emoji, ts: e.ts }]));
    socket.on('top_runs', (runs) => setTopRuns(runs || []));
    socket.on('chat_history', (hist) => setMessages(hist || []));
    socket.on('daily_challenge', (challenge) => setDailyChallenge(challenge));
    socket.on('achievement_unlocked', (achievement) => {
      setAchievements(prev => [...prev, achievement]);
      setShowAchievement(achievement);
      soundEffects.play('achievement');
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 } });
      setTimeout(() => setShowAchievement(null), 4000);
    });
    socket.on('power_up_spawned', (powerUp) => {
      setPowerUps(prev => [...prev, powerUp]);
      soundEffects.play('type'); // Power-up spawn sound
    });
    socket.on('power_up_used', ({ playerId, type, duration }) => {
      if (playerId === socketId) {
        activatePowerUp(type, duration);
      } else {
        handleOpponentPowerUp(type, duration);
      }
    });
    socket.on('typing', ({ id, name, isTyping, kind, ts }) => {
      const map = new Map(typingUsersRef.current);
      if (isTyping) map.set(id, { name, kind, ts: ts || Date.now() }); else map.delete(id);
      typingUsersRef.current = map;
      setTypingUsers(map);
    });
    socket.on('typing_ping', ({ id, name, kind, ts }) => {
      const map = new Map(typingUsersRef.current);
      map.set(id, { name, kind, ts: ts || Date.now() });
      typingUsersRef.current = map;
      setTypingUsers(map);
    });
    return () => socket.disconnect();
  }, [socket]);

  // Prune stale typing indicators on an interval so badges disappear even without new input
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      const pruned = new Map(Array.from(typingUsersRef.current.entries()).filter(([_, v]) => now - (v.ts || 0) < TYPING_TTL_MS));
      if (pruned.size !== typingUsersRef.current.size) {
        typingUsersRef.current = pruned;
        setTypingUsers(pruned);
      }
    }, 250);
    return () => clearInterval(id);
  }, []);

  // Timer for non-regular modes
  useEffect(() => {
    if (!startedAt || mode === 'regular') { setTimeLeft(null); return; }
    const tick = () => {
      const end = startedAt + durationMs;
      const ms = Math.max(0, end - Date.now());
      setTimeLeft(ms);
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [startedAt, durationMs, mode]);

  // Fetch top runs and daily challenge once joined
  useEffect(() => { 
    if (joined) {
      socket.emit('get_top');
      socket.emit('get_daily_challenge');
      soundEffects.init(); // Initialize sounds when user joins
    }
  }, [joined, socket]);

  // Handle window resize for mobile detection
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  function handleJoin(e) {
    e.preventDefault();
    socket.emit('join_race', { name, room });
  }
  function handleStart() { socket.emit('start_race', { mode, length, durationMs, codeLanguage }); }
  function handleStop() { 
    socket.emit('restart_race'); // This will reset the race
    setStartedAt(null);
    setFinished(false);
    setTyped('');
    setCountdown(0);
  }
  function handleRestart() { socket.emit('restart_race'); }
  function handleSendChat(e) { e.preventDefault(); if (!chatText.trim()) return; socket.emit('chat_message', { text: chatText }); setChatText(''); }
  function handleEmote(emoji) { socket.emit('send_emote', { emoji }); }
  function handleThemeChange(newTheme) {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  }
  function handleLeaveRoom() {
    socket.disconnect();
    setJoined(false);
    setRoom('');
    setName('');
    setPlayers([]);
    setMessages([]);
    setTyped('');
    setStartedAt(null);
    setFinished(false);
    setCountdown(0);
    setPowerUps([]);
    setActivePowerUps(new Map());
    setPowerUpCooldowns(new Map());
    setShieldCount(0);
    setFrozenUntil(0);
    // Reconnect socket for future use
    socket.connect();
  }

  function activatePowerUp(type, duration) {
    const powerUp = POWER_UPS[type.toUpperCase()];
    if (!powerUp) return;

    const now = Date.now();
    const endsAt = now + (duration || powerUp.duration || 0);

    setActivePowerUps(prev => new Map(prev.set(type, { type, endsAt, data: powerUp })));
    setPowerUpCooldowns(prev => new Map(prev.set(type, now + powerUp.cooldown)));
    
    // Special handling for different power-ups
    if (type === 'shield') {
      setShieldCount(powerUp.uses);
    }
    
    soundEffects.play('achievement');
    
    // Auto-expire power-up
    setTimeout(() => {
      setActivePowerUps(prev => {
        const newMap = new Map(prev);
        newMap.delete(type);
        return newMap;
      });
    }, duration || powerUp.duration || 0);
  }

  function handleOpponentPowerUp(type, duration) {
    if (type === 'freeze') {
      setFrozenUntil(Date.now() + (duration || POWER_UPS.FREEZE.duration));
      soundEffects.play('error'); // Frozen sound
    }
  }

  function usePowerUp(type) {
    const powerUp = POWER_UPS[type.toUpperCase()];
    if (!powerUp || !startedAt || finished) return;

    const now = Date.now();
    const cooldownEnd = powerUpCooldowns.get(type) || 0;
    
    if (now < cooldownEnd) return; // Still on cooldown
    if (activePowerUps.has(type)) return; // Already active

    socket.emit('use_power_up', { type, duration: powerUp.duration });
  }

  const correctChars = prompt ? [...typed].filter((c, i) => c === prompt[i]).length : 0;
  const totalTyped = typed.length;
  const extrasBeyond = Math.max(0, totalTyped - prompt.length);
  useEffect(() => {
    if (!prompt) return;
    // mark unique wrong positions
    for (let i = 0; i < totalTyped; i++) {
      const expected = prompt[i] ?? '';
      const actual = typed[i] ?? '';
      if (actual && actual !== expected) wrongPositionsRef.current.add(i);
    }
    setUniqueErrors(wrongPositionsRef.current.size + extrasBeyond);
  }, [typed, totalTyped, prompt, extrasBeyond]);
  useEffect(() => {
    if (joined && startedAt) socket.emit('progress_update', { charsCorrect: correctChars, totalTyped, errorKeystrokes: uniqueErrors });
  }, [typed, correctChars, totalTyped, uniqueErrors, startedAt, joined, socket]);

  // Sample live stats for charts
  useEffect(() => {
    if (!startedAt || finished) return;
    const sample = () => {
      const elapsed = Date.now() - startedAt;
      const w = computeWpm(correctChars, elapsed);
      const a = computeAcc(correctChars, totalTyped);
      setWpmSeries(s => [...s, { t: elapsed, w }].slice(-240));
      setAccSeries(s => [...s, { t: elapsed, a }].slice(-240));
    };
    const id = setInterval(sample, 1000);
    sample();
    return () => clearInterval(id);
  }, [startedAt, finished, correctChars, totalTyped]);

  const currentTheme = THEMES[theme] || THEMES.default;

  return (
    <div className={`min-h-screen ${currentTheme.background} ${currentTheme.text}`}>
      <header className={`sticky top-0 z-10 ${currentTheme.header} border-b`}>
        <div className="max-w-6xl mx-auto px-3 py-2">
          {/* Top row - Logo and essential controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">🏟️</span>
              <span className="font-bold text-lg">Type Arena</span>
              <span className="text-xs bg-gradient-to-r from-purple-500 to-pink-500 text-white px-1.5 py-0.5 rounded-full">BETA</span>
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowHelp(true)}
                className={`p-2 rounded-full transition ${currentTheme.navButton}`}
                title="Help"
              >
                ❓
              </button>
              <select 
                value={theme} 
                onChange={(e) => handleThemeChange(e.target.value)}
                className={`px-2 py-1 rounded border text-xs ${currentTheme.navButton}`}
              >
                {Object.entries(THEMES).map(([key, t]) => (
                  <option key={key} value={key}>{key.charAt(0).toUpperCase() + key.slice(1, 4)}</option>
                ))}
              </select>
              <button 
                onClick={() => setSoundEnabled(soundEffects.toggle())}
                className={`p-2 rounded transition ${soundEnabled ? 'bg-green-100 text-green-700' : currentTheme.navButton}`}
                title={soundEnabled ? 'Sound ON' : 'Sound OFF'}
              >
                {soundEnabled ? '🔊' : '🔇'}
              </button>
              {joined && (
                <button 
                  onClick={handleLeaveRoom}
                  className={`px-2 py-1 rounded border text-xs ${currentTheme.navButton} hover:bg-red-50`}
                  title="Leave Room"
                >
                  🚪
                </button>
              )}
            </div>
          </div>

          {/* Second row - Game info and controls (only when joined) */}
          {joined && (
            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className={`px-2 py-1 rounded ${currentTheme.navTag}`}>
                    <b>{room}</b>
                  </span>
                  <span className={`px-2 py-1 rounded ${currentTheme.navTag}`}>
                    {mode === 'coding' ? `${codeLanguage.toUpperCase()}` : mode.toUpperCase()}
                  </span>
                  {mode !== 'regular' && startedAt && (
                    <span className={`px-2 py-1 rounded ${currentTheme.navTag}`}>
                      ⏰ {formatMs(timeLeft)}
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  {!startedAt && !countdown ? (
                    <button 
                      className={`px-4 py-1.5 rounded-md text-white font-semibold text-sm ${currentTheme.accent}`} 
                      onClick={handleStart}
                    >
                      🏁 Start
                    </button>
                  ) : null}
                  {startedAt && !finished ? (
                    <button 
                      className={`px-3 py-1.5 rounded-md border text-sm ${currentTheme.navButton}`} 
                      onClick={handleStop}
                    >
                      ⏹️ Stop
                    </button>
                  ) : null}
                  {finished ? (
                    <button 
                      className={`px-3 py-1.5 rounded-md border text-sm ${currentTheme.navButton}`} 
                      onClick={handleRestart}
                    >
                      🔄 Restart
                    </button>
                  ) : null}

                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-2 md:px-4 py-3 md:py-6">
        {!joined ? (
          <div className={`mx-auto max-w-xl ${currentTheme.card} shadow-lg border rounded-xl p-4 md:p-6`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-semibold">Join a Room</h2>
              <div className="flex items-center gap-2">
                <select 
                  value={theme} 
                  onChange={(e) => handleThemeChange(e.target.value)}
                  className={`px-2 py-1 rounded text-xs ${currentTheme.input}`}
                  title="Choose theme"
                >
                  {Object.entries(THEMES).map(([key, t]) => (
                    <option key={key} value={key}>{t.name}</option>
                  ))}
                </select>
                <button 
                  onClick={() => setSoundEnabled(soundEffects.toggle())}
                  className={`px-2 py-1 rounded transition text-sm border ${soundEnabled ? 'bg-green-100 text-green-700 border-green-200' : currentTheme.navButton}`}
                  title={soundEnabled ? 'Sound: ON' : 'Sound: OFF'}
                >
                  {soundEnabled ? '🔊' : '🔇'}
                </button>
              </div>
            </div>
            <form onSubmit={handleJoin} className="grid grid-cols-1 gap-3">
              <input 
                className={`w-full px-3 py-2 border rounded-md outline-none focus:ring-2 ${currentTheme.input}`} 
                placeholder="Your name" 
                value={name} 
                onChange={e=>setName(e.target.value)} 
              />
              <input 
                className={`w-full px-3 py-2 border rounded-md outline-none focus:ring-2 ${currentTheme.input}`} 
                placeholder="Room code (optional)" 
                value={room} 
                onChange={e=>setRoom(e.target.value)} 
              />
              <button type="submit" className={`px-3 py-1.5 rounded-md text-white transition text-sm ${currentTheme.accent}`}>Join</button>
            </form>
            
            {/* Power-ups Preview */}
            <div className="mt-6 p-4 border rounded-lg bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
              <h3 className="text-lg font-semibold mb-3 text-center">🎮 Battle Royale Features</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.values(POWER_UPS).map((powerUp, index) => (
                  <div key={powerUp.id} className="text-center p-2 rounded bg-white/50 dark:bg-black/20">
                    <div className="text-2xl mb-1">{powerUp.icon}</div>
                    <div className="text-xs font-medium">{powerUp.name}</div>
                    <div className="text-xs opacity-70">{powerUp.hotkey}</div>
                  </div>
                ))}
              </div>
              <p className="text-center text-sm opacity-80 mt-3">
                Use power-ups during races to gain advantages! Hold Alt + Q/W/E/R to activate.
              </p>
            </div>
          </div>
        ) : (
          <div className={`grid grid-cols-1 ${isMobile ? '' : 'lg:grid-cols-3'} gap-4 md:gap-6`}>
            <section className={`lg:col-span-2 ${currentTheme.card} border rounded-xl shadow-sm p-4`}>
              {mode === 'coding' && (
                <div className="mb-4 p-3 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">💻</span>
                    <div>
                      <h3 className="font-semibold text-blue-900">Coding Challenge Mode</h3>
                      <p className="text-sm text-blue-700">
                        Language: <strong>{codeLanguage.charAt(0).toUpperCase() + codeLanguage.slice(1)}</strong> • 
                        Type real code with proper syntax!
                      </p>
                    </div>
                  </div>
                </div>
              )}
              <div className="relative">
                {countdown ? (
                  <div className="absolute inset-0 z-10 grid place-items-center bg-white/80 text-6xl font-bold">{countdown}</div>
                ) : null}
                <RaceCanvas players={players} me={socketId} />
                {(() => {
                  const now = Date.now();
                  // prune old entries (>2s)
                  const pruned = new Map(
                    Array.from(typingUsers.entries()).filter(([_,v]) => now - (v.ts||0) < TYPING_TTL_MS)
                  );
                  if (pruned.size !== typingUsers.size) { typingUsersRef.current = pruned; setTypingUsers(pruned); }
                  const others = Array.from(pruned.entries()).filter(([id,v])=>v.kind==='race' && id!==socketId);
                  if (others.length === 0) return null;
                  return (
                    <div className="absolute top-2 right-2 bg-white/90 border rounded px-2 py-1 text-xs shadow">
                      {others.slice(0,3).map(([_,v])=>v.name).join(', ')}{others.length>3 ? ' and others' : ''} typing…
                    </div>
                  );
                })()}
              </div>
              <div className="mt-4">
                <p className="text-sm text-gray-600 mb-2"><b>Prompt</b></p>
                <PromptHighlighter prompt={prompt} typed={typed} theme={currentTheme} mode={mode} />
                <textarea
                  className={`w-full px-3 py-2 border rounded-md outline-none focus:ring-2 mt-3 ${isMobile ? 'text-lg' : ''} ${currentTheme.textarea}`}
                  disabled={!startedAt || finished}
                  rows={isMobile ? 4 : 5}
                  placeholder={startedAt ? (isMobile ? 'Tap to type...' : 'Type here…') : 'Click Start to begin'}
                  value={typed}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck="false"
                  onChange={e=>{
                    const v = e.target.value;
                    if (!firstKeyAt && v.length>0) setFirstKeyAt(Date.now());
                    setTyped(v);
                  }}
                  onKeyDown={(e)=>{
                    if (e.key === 'Backspace') setBackspaces(b=>b+1);
                    
                    // Power-up hotkeys (Alt+Q/W/E/R)
                    if (e.altKey && startedAt && !finished) {
                      let powerUpType = null;
                      if (e.key === 'q' || e.key === 'Q') powerUpType = 'speed';
                      else if (e.key === 'w' || e.key === 'W') powerUpType = 'shield';
                      else if (e.key === 'e' || e.key === 'E') powerUpType = 'freeze';
                      else if (e.key === 'r' || e.key === 'R') powerUpType = 'precision';
                      
                      if (powerUpType) {
                        e.preventDefault(); // Prevent default Alt behavior
                        usePowerUp(powerUpType);
                        return;
                      }
                    }
                    
                    // Count mistakes when pressing a printable key that does not match expected char
                    if (e.key.length === 1 && prompt) {
                      const now = Date.now();
                      const keyTime = now - lastKeyTime;
                      setLastKeyTime(now);
                      
                      // Track key timing for insights
                      if (startedAt && keyTime < 2000) { // Ignore long pauses
                        setKeyTimes(prev => [...prev.slice(-100), { key: e.key, time: keyTime, timestamp: now }]);
                      }
                      
                      const idx = typed.length;
                      const expected = prompt[idx] ?? '';
                      const isCorrect = e.key === expected;
                      const hasPrecision = activePowerUps.has('precision');
                      const hasShield = shieldCount > 0;
                      
                      if (!isCorrect && !hasPrecision) {
                        if (hasShield) {
                          setShieldCount(c => Math.max(0, c - 1));
                          soundEffects.play('type'); // Shield absorbed the mistake
                        } else {
                          setErrorKeys(n => n + 1);
                          soundEffects.play('error');
                        }
                      } else {
                        soundEffects.play('type');
                      }
                      
                      // Handle precision power-up usage
                      if (hasPrecision) {
                        const precision = activePowerUps.get('precision');
                        const remaining = precision.data.uses - 1;
                        if (remaining <= 0) {
                          setActivePowerUps(prev => {
                            const newMap = new Map(prev);
                            newMap.delete('precision');
                            return newMap;
                          });
                        } else {
                          setActivePowerUps(prev => new Map(prev.set('precision', {
                            ...precision,
                            data: { ...precision.data, uses: remaining }
                          })));
                        }
                      }
                    }
                    if (!finished && startedAt) socket.emit('typing_ping', { kind: 'race' });
                  }}
                  onBlur={()=>{} }
                />
                <LiveStats
                  wpmNow={wpmSeries.length? wpmSeries[wpmSeries.length-1].w : 0}
                  accNow={accSeries.length? accSeries[accSeries.length-1].a : 100}
                  wpmSeries={wpmSeries}
                  accSeries={accSeries}
                  theme={currentTheme}
                />
                {startedAt && !finished && (
                  <>
                    <PowerUpBar 
                      activePowerUps={activePowerUps}
                      cooldowns={powerUpCooldowns}
                      shieldCount={shieldCount}
                      frozenUntil={frozenUntil}
                      onUsePowerUp={usePowerUp}
                      theme={currentTheme}
                    />
                    {!localStorage.getItem('firstRaceCompleted') && (
                      <div className="mt-2 p-2 bg-gradient-to-r from-purple-100 to-pink-100 border border-purple-200 rounded-lg text-center">
                        <span className="text-purple-700 text-sm">
                          💡 <strong>Pro tip:</strong> Hold Alt + Q/W/E/R to use power-ups during the race!
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </section>
            <aside className="space-y-6">
              {challengeTarget && (
                <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-200 rounded-xl shadow-sm p-4">
                  <h3 className="font-semibold mb-2 text-orange-800">🎯 Challenge Mode</h3>
                  <p className="text-sm text-orange-700">Beat <strong>{challengeTarget} WPM</strong> to complete this challenge!</p>
                  <div className="mt-2 text-xs text-orange-600">Shared by a friend • Prove you're faster! 🚀</div>
                </div>
              )}
              {dailyChallenge && (
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl shadow-sm p-4">
                  <h3 className="font-semibold mb-2 text-purple-800">⭐ Daily Challenge</h3>
                  <p className="text-sm text-purple-700">{dailyChallenge.description}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="text-xs text-purple-600">Target: {dailyChallenge.target} WPM</div>
                    <div className="text-xs text-purple-600">Reward: {dailyChallenge.reward}</div>
                  </div>
                </div>
              )}
              {!startedAt && (
                <div className={`${currentTheme.card} border rounded-xl shadow-sm p-4`}>
                  <h3 className="font-semibold mb-3">Race Settings</h3>
                  <div className="grid grid-cols-1 gap-3">
                    <label className="text-sm">Mode
                      <select className={`w-full px-3 py-2 border rounded-md outline-none focus:ring-2 mt-1 ${currentTheme.input}`} value={mode} onChange={e=>setMode(e.target.value)}>
                        <option value="regular">Regular</option>
                        <option value="infinite">Infinite</option>
                        <option value="timed">Timed</option>
                        <option value="coding">🔥 Coding Challenge</option>
                      </select>
                    </label>
                    {mode !== 'coding' ? (
                    <label className="text-sm">Prompt length
                        <select className={`w-full px-3 py-2 border rounded-md outline-none focus:ring-2 mt-1 ${currentTheme.input}`} value={length} onChange={e=>setLength(e.target.value)}>
                        <option value="short">Short</option>
                        <option value="medium">Medium</option>
                        <option value="long">Long</option>
                        <option value="marathon">Marathon</option>
                      </select>
                    </label>
                    ) : (
                      <label className="text-sm">Programming Language
                        <select className={`w-full px-3 py-2 border rounded-md outline-none focus:ring-2 mt-1 ${currentTheme.input}`} value={codeLanguage} onChange={e=>setCodeLanguage(e.target.value)}>
                          <option value="javascript">JavaScript</option>
                          <option value="python">Python</option>
                          <option value="java">Java</option>
                          <option value="cpp">C++</option>
                          <option value="typescript">TypeScript</option>
                          <option value="react">React/JSX</option>
                          <option value="css">CSS</option>
                          <option value="html">HTML</option>
                          <option value="sql">SQL</option>
                          <option value="json">JSON</option>
                        </select>
                      </label>
                    )}
                    {mode!=='regular' && (
                      <label className="text-sm">Duration
                        <select className={`w-full px-3 py-2 border rounded-md outline-none focus:ring-2 mt-1 ${currentTheme.input}`} value={durationMs} onChange={e=>setDurationMs(Number(e.target.value))}>
                          <option value={60_000}>1 minute</option>
                          <option value={3*60_000}>3 minutes</option>
                          <option value={5*60_000}>5 minutes</option>
                          <option value={10*60_000}>10 minutes</option>
                        </select>
                      </label>
                    )}
                  </div>
                </div>
              )}
              <div className={`${currentTheme.card} border rounded-xl shadow-sm p-4`}>
                <h3 className="font-semibold mb-3">Leaderboard</h3>
                <ol className="space-y-2">
                  {players.map((p, i) => (
                    <li key={p.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-5 text-center text-gray-500">{i+1}</span>
                        <span className={p.id===socketId? 'font-semibold' : ''}>{p.name}{p.id===socketId?' (you)':''}</span>
                      </div>
                      <div className="tabular-nums text-gray-600">{mode==='regular'? `${p.progress}% • `: ''}{p.wpm} WPM • {p.accuracy}%</div>
                    </li>
                  ))}
                </ol>
              </div>
              <div className={`${currentTheme.card} border rounded-xl shadow-sm p-4`}>
                <h3 className="font-semibold mb-3">Top Runs</h3>
                <ol className="space-y-1 text-sm max-h-48 overflow-y-auto pr-2">
                  {topRuns.map((r, i) => (
                    <li key={`${r.ts}-${i}`} className="flex items-center justify-between">
                      <div className="truncate max-w-[55%]" title={r.name}>{r.name}</div>
                      <div className="text-gray-600 tabular-nums">{r.wpm} WPM • {r.accuracy}%</div>
                    </li>
                  ))}
                </ol>
              </div>
              <div className={`${currentTheme.card} border rounded-xl shadow-sm p-4`}>
                <h3 className="font-semibold mb-3">Chat</h3>
                <div className="h-48 overflow-y-auto space-y-2 pr-2">
                  {messages.map((m, idx) => (
                    <div key={m.mid || idx} className={`text-sm ${m.type==='system'?'text-gray-500':''}`}>
                      {m.type==='system' ? (
                        <span>• {m.text}</span>
                      ) : (
                        <>
                          <span className="font-medium">{m.name}</span>: {m.text}
                          {m.reactions ? (
                            <span className="ml-2 inline-flex gap-1">
                              {Object.entries(m.reactions).map(([emo,count])=> (
                                <button key={emo} className="px-1 py-0.5 rounded border text-xs" onClick={()=>socket.emit('chat_reaction', { mid: m.mid, emoji: emo })}>
                                  {emo} {count}
                                </button>
                              ))}
                              <button className="px-1 py-0.5 rounded border text-xs" onClick={()=>socket.emit('chat_reaction', { mid: m.mid, emoji: '👍' })}>＋</button>
                            </span>
                          ) : null}
                        </>
                      )}
                    </div>
                  ))}
                </div>
                <form onSubmit={handleSendChat} className="mt-3 flex gap-2">
                  <input 
                    className={`flex-1 px-3 py-2 border rounded-md outline-none focus:ring-2 ${currentTheme.input}`}
                    placeholder="Say something…"
                         value={chatText}
                         onChange={e=>{ setChatText(e.target.value); socket.emit('typing_ping', { kind: 'chat' }); }}
                         onKeyDown={(e)=>{ if (e.key==='Escape'){ setChatText(''); e.currentTarget.blur(); }} }
                  />
                  <button className={`px-3 py-1.5 rounded-md border transition text-sm ${currentTheme.navButton}`} type="submit">Send</button>
                </form>
                <div className="mt-2 flex gap-2">
                  {['🎉','🔥','💨','👏','😎'].map(em => (
                    <button key={em} className={`px-2 py-1 rounded border text-xs ${currentTheme.navButton}`} type="button" onClick={()=>handleEmote(em)}>{em}</button>
                  ))}
                </div>
                {(() => {
                  const now = Date.now();
                  const pruned = new Map(Array.from(typingUsers.entries()).filter(([_,v]) => now - (v.ts||0) < TYPING_TTL_MS));
                  if (pruned.size !== typingUsers.size) { typingUsersRef.current = pruned; setTypingUsers(pruned); }
                  const others = Array.from(pruned.entries()).filter(([id,v])=>v.kind==='chat' && id!==socketId);
                  if (others.length === 0) return null;
                  return (
                    <div className="text-xs text-gray-500 mt-2">
                      {others.slice(0,3).map(([_,v])=>v.name).join(', ')}{others.length>3? ' and others ': ''} typing…
                    </div>
                  );
                })()}
              </div>
            </aside>
          </div>
        )}
      </main>

      <footer className="mt-12 py-8 border-t bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-600">
            <span>Made with ❤️ for typing enthusiasts</span>
            <a href="https://github.com/pc9350/type-arena.git" target="_blank" rel="noopener" className="hover:text-indigo-600">
              📚 Open Source
            </a>
            <button 
              onClick={() => window.open('https://buymeacoffee.com/pranavch', '_blank')}
              className="px-3 py-1 bg-yellow-400 hover:bg-yellow-500 text-black rounded-md transition font-medium"
            >
              ☕ Buy me a coffee
            </button>
            <span className="text-xs">Help keep this free! 🚀</span>
          </div>
        </div>
      </footer>

      {finished ? (
        <ResultsModal
          onClose={()=>setFinished(false)}
          prompt={prompt}
          wpmSeries={wpmSeries}
          accSeries={accSeries}
          totalTyped={totalTyped}
          correctChars={correctChars}
          startedAt={startedAt}
          backspaces={backspaces}
          firstKeyAt={firstKeyAt}
          mode={mode}
          length={length}
          durationMs={durationMs}
          theme={currentTheme}
          keyTimes={keyTimes}
          setShowInsights={setShowInsights}
        />
      ) : null}

      {showAchievement && (
        <AchievementPopup 
          achievement={showAchievement} 
          onClose={() => setShowAchievement(null)} 
        />
      )}

      {showTutorial && (
        <TutorialModal 
          step={tutorialStep}
          onNext={() => setTutorialStep(s => s + 1)}
          onClose={() => {
            setShowTutorial(false);
            localStorage.setItem('tutorialCompleted', 'true');
          }}
          theme={currentTheme}
        />
      )}

      {showHelp && (
        <HelpModal 
          onClose={() => setShowHelp(false)}
          theme={currentTheme}
        />
      )}

      {showInsights && (
        <TypingInsightsModal 
          onClose={() => setShowInsights(false)}
          keyTimes={keyTimes}
          theme={currentTheme}
        />
      )}
    </div>
  );
}

function AchievementPopup({ achievement, onClose }) {
  const isMobile = window.innerWidth < 768;
  return (
    <div className={`fixed ${isMobile ? 'top-16 left-4 right-4' : 'top-4 right-4'} z-30 animate-bounce`}>
      <div className={`bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 text-white p-4 rounded-lg shadow-2xl border-2 border-yellow-300 ${isMobile ? '' : 'max-w-sm'}`}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">{achievement.icon}</span>
              <h3 className="font-bold text-lg">Achievement Unlocked!</h3>
            </div>
            <p className="font-semibold">{achievement.name}</p>
            <p className="text-sm opacity-90">{achievement.description}</p>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white text-xl">×</button>
        </div>
      </div>
    </div>
  );
}

function RaceCanvas({ players, me }) {
  const ref = useRef(null);
  const gameRef = useRef(null);
  const carsRef = useRef(new Map());

  useEffect(() => {
    const width = 700;
    const height = 240;

    const scene = new Phaser.Class({
      Extends: Phaser.Scene,
      initialize: function Demo () { Phaser.Scene.call(this, { key: 'Demo' }); },
      preload: function() {},
      create: function () {
        this.add.rectangle(width/2, height/2, width, height, 0xf4f4f5).setStrokeStyle(2, 0xdddddd);
        for (let i=1; i<=4; i++) this.add.line(0,0,10,i*50,width-10,i*50,0xdddddd).setOrigin(0,0).setLineWidth(1);
      },
      update: function () {}
    });

    const config = { type: Phaser.AUTO, width, height, parent: ref.current, backgroundColor: '#ffffff', scene: [scene] };
    gameRef.current = new Phaser.Game(config);
    return () => { if (gameRef.current) { gameRef.current.destroy(true); gameRef.current=null; carsRef.current.clear(); } };
  }, []);

  useEffect(() => {
    const game = gameRef.current; if (!game) return;
    const scene = game.scene.getScene('Demo'); if (!scene) return;

    players.forEach((p, idx) => {
      if (!carsRef.current.has(p.id)) {
        const y = 30 + idx * 50;
        const color = p.id === me ? 0x0066ff : 0x222222;
        const rect = scene.add.rectangle(20, y, 30, 18, color).setOrigin(0, 0.5);
        const nameText = scene.add.text(20, y - 18, p.name, { fontFamily: 'Arial', fontSize: '12px', color: '#333' }).setOrigin(0, 0.5);
        carsRef.current.set(p.id, { rect, nameText });
      }
    });

    for (const id of Array.from(carsRef.current.keys())) {
      if (!players.find(p => p.id === id)) {
        const { rect, nameText } = carsRef.current.get(id);
        rect.destroy(); nameText.destroy(); carsRef.current.delete(id);
      }
    }

    players.forEach((p, idx) => {
      const y = 30 + idx * 50;
      const car = carsRef.current.get(p.id);
      if (car) {
        car.nameText.setPosition(car.nameText.x, y - 18);
        const targetX = 20 + Math.min(1, p.progress/100) * (700 - 60);
        scene.tweens.add({ targets: car.rect, x: targetX, duration: 200, ease: 'Sine.easeOut' });
        car.rect.setPosition(car.rect.x, y);
      }
    });
  }, [players, me]);

  return <div ref={ref} className="w-full overflow-hidden rounded-lg border"/>;
}

function formatMs(ms) {
  if (ms == null) return '--:--';
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function computeWpm(correct, elapsedMs) {
  const minutes = Math.max(elapsedMs / 60000, 1/60);
  return Math.round((correct/5) / minutes);
}
function computeAcc(correct, total) {
  return total ? Math.max(0, Math.min(100, Math.round((correct/total)*100))) : 100;
}

function LiveStats({ wpmNow, accNow, wpmSeries, accSeries, theme }) {
  return (
    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className={`p-3 border rounded-md ${theme.card}`}>
        <div className="text-xs opacity-70 mb-1">WPM</div>
        <div className="flex items-end justify-between">
          <div className="text-2xl font-semibold tabular-nums">{wpmNow}</div>
          <Sparkline data={wpmSeries.map(p=>p.w)} color="#4f46e5" />
        </div>
      </div>
      <div className={`p-3 border rounded-md ${theme.card}`}>
        <div className="text-xs opacity-70 mb-1">Accuracy</div>
        <div className="flex items-end justify-between">
          <div className="text-2xl font-semibold tabular-nums">{accNow}%</div>
          <Sparkline data={accSeries.map(p=>p.a)} color="#059669" maxValue={100} />
        </div>
      </div>
    </div>
  );
}

function Sparkline({ data, color = '#4f46e5', width = 140, height = 36, maxValue }) {
  const n = data.length;
  if (n === 0) return <svg width={width} height={height}/>;
  const max = typeof maxValue === 'number' ? maxValue : Math.max(...data) || 1;
  const min = Math.min(...data, 0);
  const pad = 2;
  const sx = (i) => pad + (i/(n-1)) * (width - pad*2);
  const sy = (v) => height - pad - ((v - min)/(max - min || 1)) * (height - pad*2);
  const d = data.map((v,i)=>`${i===0?'M':'L'}${sx(i)},${sy(v)}`).join(' ');
  return (
    <svg width={width} height={height}>
      <path d={d} fill="none" stroke={color} strokeWidth="2" />
    </svg>
  );
}

function ResultsModal({ onClose, prompt, wpmSeries, accSeries, totalTyped, correctChars, startedAt, backspaces, firstKeyAt, mode, length, durationMs, theme, keyTimes, setShowInsights }) {
  const duration = (wpmSeries[wpmSeries.length-1]?.t || 0);
  const meanWpm = average(wpmSeries.map(p=>p.w));
  const peakWpm = Math.max(...wpmSeries.map(p=>p.w), 0);
  const finalAcc = accSeries.length ? accSeries[accSeries.length-1].a : computeAcc(correctChars, totalTyped);
  const consistency = coefficientOfVariation(wpmSeries.map(p=>p.w));
  const timeToFirstKey = firstKeyAt && startedAt ? (firstKeyAt - startedAt) : null;

  function handleCopy() {
    const text = `Typing Racer — Mode: ${mode}, Length: ${length}\n`+
      `Time: ${formatMs(duration)} | Avg WPM: ${Math.round(meanWpm)} | Peak WPM: ${peakWpm} | Acc: ${finalAcc}% | Backspaces: ${backspaces}`;
    navigator.clipboard?.writeText(text).catch(()=>{});
  }

  function handleShareTwitter() {
    const text = `🏁 Just typed ${Math.round(meanWpm)} WPM with ${finalAcc}% accuracy on Type Arena! Can you beat my score? 💨`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(window.location.origin)}`;
    window.open(url, '_blank');
  }

  function handleShareChallenge() {
    const challengeUrl = `${window.location.origin}?challenge=${Math.round(meanWpm)}&mode=${mode}&length=${length}`;
    navigator.clipboard?.writeText(`🎯 I just typed ${Math.round(meanWpm)} WPM! Think you can beat me? Try it: ${challengeUrl}`).then(() => {
      alert('Challenge link copied! Share it with friends 🚀');
    }).catch(()=>{});
  }

  return (
    <div className="fixed inset-0 z-20 grid place-items-center bg-black/40 p-4">
      <div className={`w-full max-w-2xl ${theme.card} rounded-xl shadow-lg border p-5`}>
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-xl font-semibold">Results</h3>
          <button className={`px-3 py-1.5 rounded-md border transition text-sm ${theme.navButton}`} onClick={onClose}>Close</button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <Stat label="Avg WPM" value={Math.round(meanWpm)} theme={theme} />
          <Stat label="Peak WPM" value={peakWpm} theme={theme} />
          <Stat label="Accuracy" value={`${finalAcc}%`} theme={theme} />
          <Stat label="Time" value={formatMs(duration)} theme={theme} />
          <Stat label="Backspaces" value={backspaces} theme={theme} />
          <Stat label="First Key" value={timeToFirstKey != null ? formatMs(timeToFirstKey) : '—'} theme={theme} />
          <Stat label="Consistency" value={`${(100 - Math.min(100, Math.round(consistency*100))).toString()}%`} theme={theme} />
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className={`p-3 border rounded-md ${theme.promptBg}`}>
            <div className="text-xs opacity-70 mb-1">WPM over time</div>
            <Sparkline data={wpmSeries.map(p=>p.w)} color="#4f46e5" width={400} height={80} />
          </div>
          <div className={`p-3 border rounded-md ${theme.promptBg}`}>
            <div className="text-xs opacity-70 mb-1">Accuracy over time</div>
            <Sparkline data={accSeries.map(p=>p.a)} color="#059669" width={400} height={80} maxValue={100} />
          </div>
        </div>
        <div className="mt-4 space-y-3">
          <div className="text-xs opacity-70">Mode: {mode} • Length: {length} • Prompt chars: {prompt.length}</div>
          <div className="flex flex-wrap gap-2">
            <button className={`px-3 py-1.5 rounded-md border transition text-sm ${theme.navButton}`} onClick={handleCopy}>📋 Copy Summary</button>
            <button className={`px-3 py-1.5 rounded-md border transition text-sm ${theme.navButton}`} onClick={handleShareTwitter}>🐦 Share on Twitter</button>
            <button className={`px-3 py-1.5 rounded-md border transition text-sm ${theme.navButton}`} onClick={handleShareChallenge}>⚡ Challenge Friends</button>
            <button className={`px-3 py-1.5 rounded-md border transition text-sm ${theme.navButton}`} onClick={() => setShowInsights(true)}>📊 Typing Insights</button>
            <button className={`px-3 py-1.5 rounded-md text-white transition text-sm ${theme.accent}`} onClick={onClose}>🏁 Race Again</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, theme }) {
  return (
    <div className={`p-3 border rounded-md text-center ${theme.card}`}>
      <div className="text-xs opacity-70">{label}</div>
      <div className="text-xl font-semibold tabular-nums mt-1">{value}</div>
    </div>
  );
}

function average(arr) { if (!arr.length) return 0; return arr.reduce((a,b)=>a+b,0) / arr.length; }
function coefficientOfVariation(arr) {
  if (arr.length < 2) return 0;
  const mean = average(arr);
  if (mean === 0) return 0;
  const variance = arr.reduce((s,v)=>s+Math.pow(v-mean,2),0) / (arr.length-1);
  const std = Math.sqrt(variance);
  return std / mean;
}

function PowerUpBar({ activePowerUps, cooldowns, shieldCount, frozenUntil, onUsePowerUp, theme }) {
  const now = Date.now();
  const isFrozen = now < frozenUntil;
  
  return (
    <div className={`mt-4 p-3 ${theme.card} border rounded-lg`}>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold">Power-ups</h4>
        <div className="text-xs opacity-70">Alt + Q/W/E/R</div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {Object.entries(POWER_UPS).map(([key, powerUp], index) => {
          const isActive = activePowerUps.has(powerUp.id);
          const cooldownEnd = cooldowns.get(powerUp.id) || 0;
          const onCooldown = now < cooldownEnd;
          const cooldownPercent = onCooldown ? ((cooldownEnd - now) / powerUp.cooldown) * 100 : 0;
          
          return (
            <button
              key={powerUp.id}
              onClick={() => onUsePowerUp(powerUp.id)}
              disabled={onCooldown || isActive || isFrozen}
              className={`relative p-2 rounded-lg border-2 transition-all duration-200 ${
                isActive 
                  ? `bg-gradient-to-r ${powerUp.color} text-white border-white shadow-lg animate-pulse` 
                  : onCooldown || isFrozen
                  ? `${theme.card} border-gray-400 opacity-50 cursor-not-allowed`
                  : `${theme.card} border-gray-300 hover:border-gray-400 hover:shadow-md`
              }`}
              title={`${powerUp.name}: ${powerUp.description} (${powerUp.hotkey})`}
            >
              <div className="text-lg mb-1">{powerUp.icon}</div>
              <div className="text-xs font-medium">{powerUp.hotkey.split('+')[1]}</div>
              {isActive && powerUp.id === 'shield' && (
                <div className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {shieldCount}
                </div>
              )}
              {onCooldown && (
                <div 
                  className="absolute bottom-0 left-0 bg-red-400 h-1 rounded-b transition-all duration-1000"
                  style={{ width: `${cooldownPercent}%` }}
                />
              )}
            </button>
          );
        })}
      </div>
      {isFrozen && (
        <div className="mt-2 p-2 bg-blue-100 border border-blue-300 rounded text-center">
          <span className="text-blue-700 text-sm">🧊 You are frozen! ({Math.ceil((frozenUntil - now) / 1000)}s)</span>
        </div>
      )}
      {activePowerUps.size > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {Array.from(activePowerUps.entries()).map(([type, powerUp]) => (
            <div key={type} className={`px-2 py-1 rounded text-xs bg-gradient-to-r ${powerUp.data.color} text-white`}>
              {powerUp.data.icon} {powerUp.data.name}
              {powerUp.endsAt && (
                <span className="ml-1">({Math.ceil((powerUp.endsAt - now) / 1000)}s)</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TutorialModal({ step, onNext, onClose, theme }) {
  const tutorialSteps = [
    {
      title: "Welcome to Type Arena! 🏟️",
      content: "The world's first battle royale typing game! Race against others and use power-ups to dominate the arena.",
      image: "🎮"
    },
    {
      title: "Power-ups System ⚡",
      content: "During races, you can use 4 powerful abilities by holding Alt + Q/W/E/R. Each has unique effects and cooldowns!",
      image: "🚀"
    },
    {
      title: "Speed Boost ⚡ (Alt+Q)",
      content: "Increases your WPM calculation by 1.5x for 10 seconds. Perfect for final sprints!",
      image: "⚡"
    },
    {
      title: "Shield 🛡️ (Alt+W)", 
      content: "Protects you from the next 3 typing mistakes. Essential for maintaining accuracy under pressure!",
      image: "🛡️"
    },
    {
      title: "Freeze 🧊 (Alt+E)",
      content: "Slows down ALL opponents for 8 seconds. Use strategically to gain the upper hand!",
      image: "🧊"
    },
    {
      title: "Precision 🎯 (Alt+R)",
      content: "Guarantees 100% accuracy for the next 20 characters. Perfect for difficult passages!",
      image: "🎯"
    },
    {
      title: "Ready to Battle! 🏆",
      content: "You're all set! Join a room, wait for the race to start, then use your power-ups strategically to win!",
      image: "🏁"
    }
  ];

  const currentStep = tutorialSteps[step] || tutorialSteps[tutorialSteps.length - 1];
  const isLastStep = step >= tutorialSteps.length - 1;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <div className={`w-full max-w-md ${theme.card} rounded-xl shadow-2xl border p-6`}>
        <div className="text-center">
          <div className="text-4xl mb-4">{currentStep.image}</div>
          <h3 className="text-xl font-bold mb-3">{currentStep.title}</h3>
          <p className="text-sm opacity-80 mb-6 leading-relaxed">{currentStep.content}</p>
          
          <div className="flex items-center justify-center gap-2 mb-4">
            {tutorialSteps.map((_, index) => (
              <div 
                key={index}
                className={`w-2 h-2 rounded-full ${index === step ? 'bg-purple-500' : 'bg-gray-300'}`}
              />
            ))}
          </div>

          <div className="flex gap-3">
            <button 
              onClick={onClose}
              className={`flex-1 px-4 py-2 rounded-md border transition text-sm ${theme.navButton}`}
            >
              Skip Tutorial
            </button>
            <button 
              onClick={isLastStep ? onClose : onNext}
              className={`flex-1 px-4 py-2 rounded-md text-white transition text-sm ${theme.accent}`}
            >
              {isLastStep ? "Let's Go!" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function HelpModal({ onClose, theme }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <div className={`w-full max-w-2xl ${theme.card} rounded-xl shadow-2xl border p-6 max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">🏟️ Type Arena Guide</h2>
          <button 
            onClick={onClose}
            className={`px-3 py-1 rounded-md border transition ${theme.navButton}`}
          >
            ✕
          </button>
        </div>

        <div className="space-y-6">
          <section>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              🎮 How to Play
            </h3>
            <ul className="text-sm space-y-2 opacity-90">
              <li>• Join a room and wait for other players</li>
              <li>• When the race starts, type the given text as fast and accurately as possible</li>
              <li>• Use power-ups strategically by holding Alt + Q/W/E/R</li>
              <li>• First to complete the text wins (in Regular mode)</li>
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              ⚡ Power-ups Guide
            </h3>
            <div className="grid gap-4">
              {Object.values(POWER_UPS).map((powerUp, index) => (
                <div key={powerUp.id} className={`p-3 rounded-lg border ${theme.promptBg}`}>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{powerUp.icon}</span>
                    <div>
                      <div className="font-semibold">{powerUp.name}</div>
                      <div className="text-xs opacity-70">{powerUp.hotkey}</div>
                    </div>
                  </div>
                  <p className="text-sm opacity-80">{powerUp.description}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              🏆 Game Modes
            </h3>
            <ul className="text-sm space-y-2 opacity-90">
              <li>• <strong>Regular:</strong> First to complete the text wins</li>
              <li>• <strong>Timed:</strong> Highest WPM when time runs out wins</li>
              <li>• <strong>Infinite:</strong> Endless text, compete for highest WPM</li>
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              🎨 Features
            </h3>
            <ul className="text-sm space-y-2 opacity-90">
              <li>• <strong>Themes:</strong> 4 beautiful themes to choose from</li>
              <li>• <strong>Sound Effects:</strong> Satisfying audio feedback</li>
              <li>• <strong>Achievements:</strong> Unlock badges for accomplishments</li>
              <li>• <strong>Daily Challenges:</strong> Special objectives each day</li>
              <li>• <strong>Statistics:</strong> Track your WPM and accuracy over time</li>
            </ul>
          </section>
        </div>

        <div className="mt-6 pt-4 border-t text-center">
          <button 
            onClick={onClose}
            className={`px-6 py-2 rounded-md text-white transition ${theme.accent}`}
          >
            Got it! Let's Type! 🚀
          </button>
        </div>
      </div>
    </div>
  );
}

function TypingInsightsModal({ onClose, keyTimes, theme }) {
  // Analyze key timing data
  const keyStats = new Map();
  keyTimes.forEach(({ key, time }) => {
    if (!keyStats.has(key)) keyStats.set(key, []);
    keyStats.get(key).push(time);
  });

  // Calculate averages and identify slow keys
  const keyAverages = Array.from(keyStats.entries()).map(([key, times]) => ({
    key,
    avgTime: times.reduce((a, b) => a + b, 0) / times.length,
    count: times.length
  })).sort((a, b) => b.avgTime - a.avgTime);

  const slowestKeys = keyAverages.slice(0, 5);
  const fastestKeys = keyAverages.slice(-5).reverse();
  
  // Typing rhythm analysis
  const avgKeyTime = keyTimes.length > 0 ? keyTimes.reduce((sum, kt) => sum + kt.time, 0) / keyTimes.length : 0;
  const rhythm = keyTimes.length > 10 ? 
    keyTimes.slice(-10).reduce((sum, kt) => sum + kt.time, 0) / 10 : avgKeyTime;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <div className={`w-full max-w-3xl ${theme.card} rounded-xl shadow-2xl border p-6 max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">📊 Typing Insights</h2>
          <button 
            onClick={onClose}
            className={`px-3 py-1 rounded-md border transition ${theme.navButton}`}
          >
            ✕
          </button>
        </div>

        {keyTimes.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-4">⏱️</div>
            <p className="text-lg mb-2">No typing data available</p>
            <p className="text-sm opacity-70">Complete a race to see your typing insights!</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Overall Stats */}
            <section>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                🎯 Performance Overview
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className={`p-3 rounded-lg border text-center ${theme.promptBg}`}>
                  <div className="text-2xl font-bold">{Math.round(avgKeyTime)}ms</div>
                  <div className="text-sm opacity-70">Avg Key Time</div>
                </div>
                <div className={`p-3 rounded-lg border text-center ${theme.promptBg}`}>
                  <div className="text-2xl font-bold">{Math.round(rhythm)}ms</div>
                  <div className="text-sm opacity-70">Recent Rhythm</div>
                </div>
                <div className={`p-3 rounded-lg border text-center ${theme.promptBg}`}>
                  <div className="text-2xl font-bold">{keyTimes.length}</div>
                  <div className="text-sm opacity-70">Keys Pressed</div>
                </div>
              </div>
            </section>

            {/* Slowest Keys */}
            {slowestKeys.length > 0 && (
              <section>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  🐌 Keys to Improve
                </h3>
                <div className="space-y-2">
                  {slowestKeys.map(({ key, avgTime, count }) => (
                    <div key={key} className={`flex items-center justify-between p-3 rounded-lg border ${theme.promptBg}`}>
                      <div className="flex items-center gap-3">
                        <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-sm font-mono">
                          {key === ' ' ? 'Space' : key.toUpperCase()}
                        </kbd>
                        <span className="text-sm">Average: {Math.round(avgTime)}ms</span>
                      </div>
                      <div className="text-xs opacity-70">{count} times</div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200">
                  <p className="text-sm">💡 <strong>Tip:</strong> Practice these keys to improve your overall typing speed!</p>
                </div>
              </section>
            )}

            {/* Fastest Keys */}
            {fastestKeys.length > 0 && (
              <section>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  ⚡ Your Strongest Keys
                </h3>
                <div className="space-y-2">
                  {fastestKeys.map(({ key, avgTime, count }) => (
                    <div key={key} className={`flex items-center justify-between p-3 rounded-lg border ${theme.promptBg}`}>
                      <div className="flex items-center gap-3">
                        <kbd className="px-2 py-1 bg-green-200 dark:bg-green-700 rounded text-sm font-mono">
                          {key === ' ' ? 'Space' : key.toUpperCase()}
                        </kbd>
                        <span className="text-sm">Average: {Math.round(avgTime)}ms</span>
                      </div>
                      <div className="text-xs opacity-70">{count} times</div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Recommendations */}
            <section>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                🎓 Personalized Recommendations
              </h3>
              <div className="space-y-3">
                {avgKeyTime > 200 && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200">
                    <p className="text-sm"><strong>Focus on Speed:</strong> Your average key time is {Math.round(avgKeyTime)}ms. Try typing drills to build muscle memory.</p>
                  </div>
                )}
                {Math.abs(rhythm - avgKeyTime) > 50 && (
                  <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200">
                    <p className="text-sm"><strong>Improve Consistency:</strong> Your rhythm varies. Practice maintaining steady typing pace.</p>
                  </div>
                )}
                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200">
                  <p className="text-sm"><strong>Keep Racing:</strong> Regular practice in Type Arena will help you improve naturally!</p>
                </div>
              </div>
            </section>
          </div>
        )}

        <div className="mt-6 pt-4 border-t text-center">
          <button 
            onClick={onClose}
            className={`px-6 py-2 rounded-md text-white transition ${theme.accent}`}
          >
            Got it! Let's improve! 💪
          </button>
        </div>
      </div>
    </div>
  );
}

function PromptHighlighter({ prompt, typed, theme, mode }) {
  const chunks = [];
  for (let i=0; i<prompt.length; i++) {
    const ch = prompt[i];
    const t = typed[i];
    if (t == null) chunks.push(<span key={i}>{ch}</span>);
    else if (t === ch) chunks.push(<span key={i} className="bg-green-100 text-green-900">{ch}</span>);
    else chunks.push(<span key={i} className="bg-red-100 text-red-900 line-through decoration-red-400">{ch}</span>);
  }
  
  const isCodingMode = mode === 'coding';
  const containerClass = isCodingMode 
    ? `p-4 ${theme.promptBg} border rounded-md whitespace-pre font-mono text-sm max-h-64 overflow-y-auto leading-relaxed bg-gray-900 text-gray-100`
    : `p-3 ${theme.promptBg} border rounded-md whitespace-pre-wrap max-h-56 overflow-y-auto leading-relaxed`;
  
  return (
    <div className="relative">
      {isCodingMode && (
        <div className="absolute top-2 right-2 px-2 py-1 bg-blue-600 text-white text-xs rounded font-semibold">
          CODE CHALLENGE 💻
        </div>
      )}
      <p className={containerClass}>{chunks}</p>
    </div>
  );
}
