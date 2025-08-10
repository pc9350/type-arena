import React, { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import Phaser from 'phaser';

// UI libs
import confetti from 'canvas-confetti';

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
  const [mode, setMode] = useState('regular'); // 'regular' | 'infinite'
  const [length, setLength] = useState('medium'); // 'short' | 'medium' | 'long' | 'marathon'
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
    socket.on('race_finished', () => { setFinished(true); confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } }); });
    socket.on('race_restarted', ({ prompt, mode, length, durationMs }) => { setPrompt(prompt); setFinished(false); setTyped(''); setCountdown(0); setStartedAt(null); if (mode) setMode(mode); if (length) setLength(length); if (durationMs) setDurationMs(durationMs); });
    socket.on('chat_message', (msg) => setMessages(m => [...m.slice(-98), msg]));
    socket.on('emote', (e) => setMessages(m => [...m.slice(-98), { id: e.id, name: 'Emote', text: e.emoji, ts: e.ts }]));
    socket.on('top_runs', (runs) => setTopRuns(runs || []));
    socket.on('chat_history', (hist) => setMessages(hist || []));
    socket.on('daily_challenge', (challenge) => setDailyChallenge(challenge));
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
    }
  }, [joined, socket]);

  function handleJoin(e) {
    e.preventDefault();
    socket.emit('join_race', { name, room });
  }
  function handleStart() { socket.emit('start_race', { mode, length, durationMs }); }
  function handleRestart() { socket.emit('restart_race'); }
  function handleSendChat(e) { e.preventDefault(); if (!chatText.trim()) return; socket.emit('chat_message', { text: chatText }); setChatText(''); }
  function handleEmote(emoji) { socket.emit('send_emote', { emoji }); }

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

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-purple-50 text-gray-900">
      <header className="sticky top-0 z-10 backdrop-blur bg-white/70 border-b">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xl font-semibold">
            <span>🏁</span>
            <span>Typing Racer</span>
            <span className="text-xs bg-gradient-to-r from-purple-500 to-pink-500 text-white px-2 py-0.5 rounded-full">BETA</span>
          </div>
          {joined ? (
            <div className="flex items-center gap-3 text-sm">
              <span className="px-2 py-1 rounded bg-gray-100">Room: <b>{room}</b></span>
              <span className="hidden md:inline px-2 py-1 rounded bg-gray-100">Mode: <b>{mode}</b></span>
              <span className="hidden md:inline px-2 py-1 rounded bg-gray-100">Length: <b>{length}</b></span>
                    {mode!=='regular' && startedAt ? (
                <span className="px-2 py-1 rounded bg-indigo-50 text-indigo-700">Time left: <b>{formatMs(timeLeft)}</b></span>
              ) : null}
              {!startedAt && !countdown ? (
                <button className="btn" onClick={handleStart}>Start</button>
              ) : null}
              {(finished || startedAt) ? (
                <button className="btn-outline" onClick={handleRestart}>Restart</button>
              ) : null}
            </div>
          ) : null}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {!joined ? (
          <div className="mx-auto max-w-xl bg-white shadow-lg border rounded-xl p-6">
            <h2 className="text-2xl font-semibold mb-4">Join a Room</h2>
            <form onSubmit={handleJoin} className="grid grid-cols-1 gap-3">
              <input className="input" placeholder="Your name" value={name} onChange={e=>setName(e.target.value)} />
              <input className="input" placeholder="Room code (optional)" value={room} onChange={e=>setRoom(e.target.value)} />
              <button type="submit" className="btn-primary">Join</button>
            </form>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <section className="lg:col-span-2 bg-white border rounded-xl shadow-sm p-4">
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
                <PromptHighlighter prompt={prompt} typed={typed} />
                <textarea
                  className="textarea mt-3"
                  disabled={!startedAt || finished}
                  rows={5}
                  placeholder={startedAt ? 'Type here…' : 'Click Start to begin'}
                  value={typed}
                  onChange={e=>{
                    const v = e.target.value;
                    if (!firstKeyAt && v.length>0) setFirstKeyAt(Date.now());
                    setTyped(v);
                  }}
                  onKeyDown={(e)=>{
                    if (e.key === 'Backspace') setBackspaces(b=>b+1);
                    // Count mistakes when pressing a printable key that does not match expected char
                    if (e.key.length === 1 && prompt) {
                      const idx = typed.length;
                      const expected = prompt[idx] ?? '';
                      if (e.key !== expected) setErrorKeys(n => n + 1);
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
                />
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
                <div className="bg-white border rounded-xl shadow-sm p-4">
                  <h3 className="font-semibold mb-3">Race Settings</h3>
                  <div className="grid grid-cols-1 gap-3">
                    <label className="text-sm">Mode
                      <select className="input mt-1" value={mode} onChange={e=>setMode(e.target.value)}>
                        <option value="regular">Regular</option>
                        <option value="infinite">Infinite</option>
                        <option value="timed">Timed</option>
                      </select>
                    </label>
                    <label className="text-sm">Prompt length
                      <select className="input mt-1" value={length} onChange={e=>setLength(e.target.value)}>
                        <option value="short">Short</option>
                        <option value="medium">Medium</option>
                        <option value="long">Long</option>
                        <option value="marathon">Marathon</option>
                      </select>
                    </label>
                    {mode!=='regular' && (
                      <label className="text-sm">Duration
                        <select className="input mt-1" value={durationMs} onChange={e=>setDurationMs(Number(e.target.value))}>
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
              <div className="bg-white border rounded-xl shadow-sm p-4">
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
              <div className="bg-white border rounded-xl shadow-sm p-4">
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
              <div className="bg-white border rounded-xl shadow-sm p-4">
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
                  <input className="input flex-1" placeholder="Say something…"
                         value={chatText}
                         onChange={e=>{ setChatText(e.target.value); socket.emit('typing_ping', { kind: 'chat' }); }}
                         onKeyDown={(e)=>{ if (e.key==='Escape'){ setChatText(''); e.currentTarget.blur(); }} }
                  />
                  <button className="btn" type="submit">Send</button>
                </form>
                <div className="mt-2 flex gap-2">
                  {['🎉','🔥','💨','👏','😎'].map(em => (
                    <button key={em} className="btn-xs" type="button" onClick={()=>handleEmote(em)}>{em}</button>
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
            <a href="https://github.com/pc9350/typing-racer" target="_blank" rel="noopener" className="hover:text-indigo-600">
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
        />
      ) : null}
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

function LiveStats({ wpmNow, accNow, wpmSeries, accSeries }) {
  return (
    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="p-3 border rounded-md bg-white">
        <div className="text-xs text-gray-500 mb-1">WPM</div>
        <div className="flex items-end justify-between">
          <div className="text-2xl font-semibold tabular-nums">{wpmNow}</div>
          <Sparkline data={wpmSeries.map(p=>p.w)} color="#4f46e5" />
        </div>
      </div>
      <div className="p-3 border rounded-md bg-white">
        <div className="text-xs text-gray-500 mb-1">Accuracy</div>
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

function ResultsModal({ onClose, prompt, wpmSeries, accSeries, totalTyped, correctChars, startedAt, backspaces, firstKeyAt, mode, length, durationMs }) {
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
    const text = `🏁 Just typed ${Math.round(meanWpm)} WPM with ${finalAcc}% accuracy on Typing Racer! Can you beat my score? 💨`;
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
      <div className="w-full max-w-2xl bg-white rounded-xl shadow-lg border p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-xl font-semibold">Results</h3>
          <button className="btn-outline" onClick={onClose}>Close</button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <Stat label="Avg WPM" value={Math.round(meanWpm)} />
          <Stat label="Peak WPM" value={peakWpm} />
          <Stat label="Accuracy" value={`${finalAcc}%`} />
          <Stat label="Time" value={formatMs(duration)} />
          <Stat label="Backspaces" value={backspaces} />
          <Stat label="First Key" value={timeToFirstKey != null ? formatMs(timeToFirstKey) : '—'} />
          <Stat label="Consistency" value={`${(100 - Math.min(100, Math.round(consistency*100))).toString()}%`} />
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3 border rounded-md bg-gray-50">
            <div className="text-xs text-gray-500 mb-1">WPM over time</div>
            <Sparkline data={wpmSeries.map(p=>p.w)} color="#4f46e5" width={400} height={80} />
          </div>
          <div className="p-3 border rounded-md bg-gray-50">
            <div className="text-xs text-gray-500 mb-1">Accuracy over time</div>
            <Sparkline data={accSeries.map(p=>p.a)} color="#059669" width={400} height={80} maxValue={100} />
          </div>
        </div>
        <div className="mt-4 space-y-3">
          <div className="text-xs text-gray-500">Mode: {mode} • Length: {length} • Prompt chars: {prompt.length}</div>
          <div className="flex flex-wrap gap-2">
            <button className="btn" onClick={handleCopy}>📋 Copy Summary</button>
            <button className="btn" onClick={handleShareTwitter}>🐦 Share on Twitter</button>
            <button className="btn" onClick={handleShareChallenge}>⚡ Challenge Friends</button>
            <button className="btn-primary" onClick={onClose}>🏁 Race Again</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="p-3 border rounded-md bg-white text-center">
      <div className="text-xs text-gray-500">{label}</div>
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

function PromptHighlighter({ prompt, typed }) {
  const chunks = [];
  for (let i=0; i<prompt.length; i++) {
    const ch = prompt[i];
    const t = typed[i];
    if (t == null) chunks.push(<span key={i}>{ch}</span>);
    else if (t === ch) chunks.push(<span key={i} className="bg-green-100">{ch}</span>);
    else chunks.push(<span key={i} className="bg-red-100 line-through decoration-red-400">{ch}</span>);
  }
  return <p className="p-3 bg-gray-50 border rounded-md whitespace-pre-wrap max-h-56 overflow-y-auto leading-relaxed">{chunks}</p>;
}
