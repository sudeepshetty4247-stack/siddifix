import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Copy, Languages, Mic, Volume2, Square, Pause, Play, Send, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Conversation, ConversationContent, ConversationScrollButton } from '@/components/ai-elements/conversation';
import { Message, MessageContent, MessageResponse, MessageAction, MessageActions } from '@/components/ai-elements/message';
import { Textarea } from '@/components/ui/textarea';
import { useAssistantVoice } from '@/lib/use-assistant-voice';
import { Shimmer } from '@/components/ai-elements/shimmer';
import { Button } from '@/components/ui/button';
import brand from '@/assets/siddi-opening-logo.png.asset.json';
import { useI18n } from '@/lib/i18n';

const TEXT = {
  en: { placeholder: 'Ask a question in any language…', intro: 'What would you like to know?', waiting: 'Siddhi is thinking…', note: 'AI answers can be incorrect. No emergency service. This conversation is saved only during this visit.', questions: ['How do I report a pothole?', 'How many active cases are there?', 'What happens after I submit a report?'] },
  hi: { placeholder: 'किसी भी भाषा में सवाल पूछें…', intro: 'आप क्या जानना चाहते हैं?', waiting: 'Siddhi सोच रहा है…', note: 'AI के जवाब गलत हो सकते हैं। यह आपातकालीन सेवा नहीं है। बातचीत केवल इस विज़िट तक रहती है।', questions: ['गड्ढे की रिपोर्ट कैसे करें?', 'कितने सक्रिय मामले हैं?', 'रिपोर्ट जमा करने के बाद क्या होता है?'] },
  kn: { placeholder: 'ಯಾವುದೇ ಭಾಷೆಯಲ್ಲಿ ಪ್ರಶ್ನೆ ಕೇಳಿ…', intro: 'ನೀವು ಏನು ತಿಳಿಯಲು ಬಯಸುತ್ತೀರಿ?', waiting: 'Siddhi ಯೋಚಿಸುತ್ತಿದೆ…', note: 'AI ಉತ್ತರಗಳು ತಪ್ಪಾಗಿರಬಹುದು. ಇದು ತುರ್ತು ಸೇವೆಯಲ್ಲ. ಈ ಭೇಟಿಯ ಸಮಯದಲ್ಲಿ ಮಾತ್ರ ಸಂಭಾಷಣೆ ಉಳಿಯುತ್ತದೆ.', questions: ['ರಸ್ತೆಯ ಗುಂಡಿಯನ್ನು ಹೇಗೆ ವರದಿ ಮಾಡುವುದು?', 'ಎಷ್ಟು ಸಕ್ರಿಯ ಪ್ರಕರಣಗಳಿವೆ?', 'ವರದಿ ಸಲ್ಲಿಸಿದ ನಂತರ ಏನಾಗುತ್ತದೆ?'] },
};
export default function AssistantChat() {
  const { lang } = useI18n(); const copy = TEXT[lang];
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [input, setInput] = useState(''); const [voiceLanguage, setVoiceLanguage] = useState(`${lang}-IN`);
  const [offline, setOffline] = useState(false); const sending = useRef(false);
  const voice = useAssistantVoice(voiceLanguage, setInput);
  const transport = useMemo(() => new DefaultChatTransport({ api: '/api/assistant' }), []);
  const { messages, sendMessage, status, error, stop, regenerate } = useChat({ transport, onError: e => toast.error(e.message) });
  const busy = status === 'submitted' || status === 'streaming';
  useEffect(() => { if (!busy) textarea.current?.focus(); }, [busy]);
  useEffect(() => () => { void stop(); }, [stop]);
  useEffect(() => { const update = () => setOffline(!navigator.onLine); update(); window.addEventListener('online', update); window.addEventListener('offline', update); return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); }; }, []);
  async function ask(text: string) { if (!text.trim() || busy || sending.current || offline) return; voice.stop(); sending.current = true; try { await sendMessage({ text }); setInput(''); } finally { sending.current = false; textarea.current?.focus(); } }
  return <div>
    <Conversation className="h-[min(60dvh,640px)] min-h-80 border-y">
      <ConversationContent className="gap-6 px-0 py-6">
        {!messages.length && <div className="py-7"><img src={brand.url} alt="Siddhi" width={112} height={112} className="mx-auto h-28 w-28 rounded-lg object-contain" /><h2 className="mt-6 text-center text-xl font-semibold">{copy.intro}</h2><div className="mx-auto mt-5 flex max-w-xl flex-col items-start gap-2">{copy.questions.map(q => <Button key={q} variant="outline" className="h-auto min-h-10 whitespace-normal text-left" onClick={() => ask(q)}>{q}</Button>)}</div></div>}
        {messages.map(m => <Message key={m.id} from={m.role} data-testid={`chat-${m.role}`}><MessageContent className={m.role === 'user' ? 'group-[.is-user]:bg-primary group-[.is-user]:text-primary-foreground' : ''}>
          {m.parts.map((p, idx) => p.type === 'text' ? <MessageResponse key={idx}>{p.text}</MessageResponse> : null)}
        </MessageContent>{m.role === 'assistant' && !busy && m.parts.some(p => p.type === 'text' && p.text) && <MessageActions><MessageAction tooltip="Copy answer" onClick={() => { void navigator.clipboard.writeText(m.parts.filter(p => p.type === 'text').map(p => p.text).join('\n')).then(() => toast.success('Answer copied')).catch(() => toast.error('Copy unavailable')); }}><Copy className="h-4 w-4" /></MessageAction><Button variant="ghost" size="icon" aria-label="Play answer" title="Play answer" disabled={!voice.supported.synthesis} onClick={() => voice.speak(m.parts.filter(p => p.type === 'text').map(p => p.text).join('\n'))}><Volume2 className="h-4 w-4" /></Button></MessageActions>}</Message>)}
        {status === 'submitted' && <div role="status"><Shimmer>{copy.waiting}</Shimmer></div>}
        {error && <div role="alert" className="border-l-2 border-warning pl-3 text-sm"><p>{error.message}</p><Button variant="outline" disabled={busy || offline} onClick={() => { voice.stop(); void regenerate(); }}><RotateCcw className="h-4 w-4" />Retry answer</Button></div>}
      </ConversationContent><ConversationScrollButton />
    </Conversation>
    <form className="mt-4 space-y-3" onSubmit={e => { e.preventDefault(); void ask(input); }}><Textarea ref={textarea} value={input} onChange={e => setInput(e.target.value)} placeholder={copy.placeholder} aria-label="Your question" maxLength={4000} className="min-h-24" /><div className="flex flex-wrap items-center gap-2"><label className="flex items-center gap-2 text-xs"><Languages className="h-4 w-4" /><select aria-label="Voice language" className="h-10 rounded-md border bg-card px-2" value={voiceLanguage} onChange={e => { voice.stop(); setVoiceLanguage(e.target.value); }}><option value="en-IN">English</option><option value="kn-IN">ಕನ್ನಡ</option><option value="hi-IN">हिन्दी</option></select></label><Button type="button" variant={voice.state === 'listening' ? 'default' : 'outline'} size="icon" aria-label={voice.state === 'listening' ? 'Stop listening' : 'Speak your question'} title={voice.supported.recognition ? 'Speak your question' : 'Voice input unavailable in this browser'} onClick={voice.state === 'listening' ? voice.stop : voice.listen} disabled={busy || offline}>{voice.state === 'listening' ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}</Button>{(voice.state === 'speaking' || voice.state === 'paused') && <><Button type="button" size="icon" variant="outline" aria-label={voice.state === 'paused' ? 'Resume playback' : 'Pause playback'} onClick={voice.state === 'paused' ? voice.resume : voice.pause}>{voice.state === 'paused' ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}</Button><Button type="button" size="icon" variant="outline" aria-label="Stop playback" onClick={voice.stop}><Square className="h-4 w-4" /></Button></>}<span role="status" aria-live="polite" className="text-xs text-primary">{voice.state === 'listening' ? 'Listening…' : busy ? 'Processing…' : voice.state === 'speaking' ? 'Speaking…' : voice.state === 'paused' ? 'Playback paused' : ''}</span>{busy ? <Button type="button" className="ml-auto" onClick={() => { void stop(); voice.stop(); }}><Square className="h-4 w-4" />Stop</Button> : <Button className="ml-auto" type="submit" disabled={!input.trim() || offline || voice.state === 'listening'}><Send className="h-4 w-4" />Send</Button>}</div></form>
    {(voice.error || offline) && <p role="alert" className="mt-3 text-sm text-warning-foreground">{offline ? 'You are offline. Your question is preserved; reconnect to send it.' : voice.error}</p>}
    <nav aria-label="Assistant actions" className="mt-4 flex flex-wrap gap-4 text-sm font-medium text-primary"><Link to="/report" onClick={voice.stop}>Report a problem →</Link><Link to="/track" onClick={voice.stop}>Track privately →</Link><Link to="/transparency" onClick={voice.stop}>Live statistics →</Link></nav>
    <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{copy.note}</p>
  </div>;
}