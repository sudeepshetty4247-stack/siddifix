import { useEffect, useRef, useState } from 'react';

type Recognition = { lang: string; interimResults: boolean; continuous: boolean; onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onerror: ((event: { error: string }) => void) | null; onend: (() => void) | null; start(): void; abort(): void };
type VoiceWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
export type VoiceState = 'idle' | 'listening' | 'speaking' | 'paused';
export function useAssistantVoice(language: string, onTranscript: (text: string) => void) {
  const [state, setState] = useState<VoiceState>('idle');
  const [error, setError] = useState('');
  const [supported, setSupported] = useState({ recognition: false, synthesis: false });
  const recognition = useRef<Recognition | null>(null);
  const callback = useRef(onTranscript); callback.current = onTranscript;
  const generation = useRef(0);
  useEffect(() => {
    const w = window as VoiceWindow;
    setSupported({ recognition: Boolean(w.SpeechRecognition ?? w.webkitSpeechRecognition), synthesis: 'speechSynthesis' in w });
    return () => { generation.current++; recognition.current?.abort(); window.speechSynthesis?.cancel(); };
  }, []);
  function stop() {
    generation.current++; recognition.current?.abort(); recognition.current = null;
    window.speechSynthesis?.cancel(); setState('idle');
  }
  function listen() {
    stop(); setError('');
    if (!navigator.onLine) { setError('You are offline. You can still type your question.'); return; }
    const w = window as VoiceWindow; const Engine = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Engine) { setError('Voice input is unavailable in this browser. Please type instead.'); return; }
    const current = ++generation.current; const engine = new Engine(); recognition.current = engine;
    engine.lang = language; engine.interimResults = true; engine.continuous = false;
    engine.onresult = e => { if (current === generation.current) callback.current(Array.from(e.results).map(r => r[0]?.transcript ?? '').join(' ')); };
    engine.onerror = e => { if (current !== generation.current) return; setState('idle'); setError(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'Microphone access was denied. Allow it in browser settings or type instead.' : e.error === 'no-speech' ? 'No speech detected. Try again or type your question.' : `Voice input failed (${e.error}). Please retry or type instead.`); };
    engine.onend = () => { if (current === generation.current) setState('idle'); };
    try { engine.start(); setState('listening'); } catch { setState('idle'); setError('The microphone could not start. Please retry or type instead.'); }
  }
  function speak(text: string) {
    stop(); setError('');
    if (!window.speechSynthesis || !text.trim()) { setError('Playback is unavailable. The answer remains available as text.'); return; }
    const current = ++generation.current;
    // Chunking avoids the browser engine silently stopping on long responses.
    const chunks = text.replace(/[*#`]/g, '').match(/[\s\S]{1,220}(?:\s|$)|[\s\S]{1,220}/g) ?? [text];
    const play = (index: number) => {
      if (current !== generation.current) return;
      const chunk = chunks[index]; if (!chunk) { setState('idle'); return; }
      const utterance = new SpeechSynthesisUtterance(chunk); utterance.lang = language;
      const voices = window.speechSynthesis.getVoices(); const voice = voices.find(v => v.lang.toLowerCase().startsWith(language.split('-')[0] ?? language));
      if (voice) utterance.voice = voice;
      else if (language !== 'en-IN') { setState('idle'); setError('No matching voice is installed for this language. Please read the answer or change language.'); return; }
      utterance.onend = () => play(index + 1);
      utterance.onerror = () => { if (current === generation.current) { setState('idle'); setError('Playback failed. Please retry; the text is unchanged.'); } };
      setState('speaking'); window.speechSynthesis.speak(utterance);
    };
    play(0);
  }
  function pause() { window.speechSynthesis?.pause(); setState('paused'); }
  function resume() { window.speechSynthesis?.resume(); setState('speaking'); }
  return { state, error, supported, listen, speak, stop, pause, resume };
}