import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useEffect, useMemo, useRef } from 'react';
import { Copy, Languages } from 'lucide-react';
import { toast } from 'sonner';
import { Conversation, ConversationContent, ConversationScrollButton } from '@/components/ai-elements/conversation';
import { Message, MessageContent, MessageResponse, MessageAction, MessageActions } from '@/components/ai-elements/message';
import { PromptInput, PromptInputTextarea, PromptInputFooter, PromptInputSubmit } from '@/components/ai-elements/prompt-input';
import { Shimmer } from '@/components/ai-elements/shimmer';
import { Button } from '@/components/ui/button';
import brand from '@/assets/siddi-opening-logo.png.asset.json';
import { useI18n } from '@/lib/i18n';

const TEXT = {
  en: { placeholder: 'Ask a question in any language…', intro: 'What would you like to know?', waiting: 'Siddi is thinking…', note: 'AI answers can be incorrect. No emergency service. This conversation is saved only during this visit.', questions: ['How do I report a pothole?', 'How many active cases are there?', 'What happens after I submit a report?'] },
  hi: { placeholder: 'किसी भी भाषा में सवाल पूछें…', intro: 'आप क्या जानना चाहते हैं?', waiting: 'Siddi सोच रहा है…', note: 'AI के जवाब गलत हो सकते हैं। यह आपातकालीन सेवा नहीं है। बातचीत केवल इस विज़िट तक रहती है।', questions: ['गड्ढे की रिपोर्ट कैसे करें?', 'कितने सक्रिय मामले हैं?', 'रिपोर्ट जमा करने के बाद क्या होता है?'] },
  kn: { placeholder: 'ಯಾವುದೇ ಭಾಷೆಯಲ್ಲಿ ಪ್ರಶ್ನೆ ಕೇಳಿ…', intro: 'ನೀವು ಏನು ತಿಳಿಯಲು ಬಯಸುತ್ತೀರಿ?', waiting: 'Siddi ಯೋಚಿಸುತ್ತಿದೆ…', note: 'AI ಉತ್ತರಗಳು ತಪ್ಪಾಗಿರಬಹುದು. ಇದು ತುರ್ತು ಸೇವೆಯಲ್ಲ. ಈ ಭೇಟಿಯ ಸಮಯದಲ್ಲಿ ಮಾತ್ರ ಸಂಭಾಷಣೆ ಉಳಿಯುತ್ತದೆ.', questions: ['ರಸ್ತೆಯ ಗುಂಡಿಯನ್ನು ಹೇಗೆ ವರದಿ ಮಾಡುವುದು?', 'ಎಷ್ಟು ಸಕ್ರಿಯ ಪ್ರಕರಣಗಳಿವೆ?', 'ವರದಿ ಸಲ್ಲಿಸಿದ ನಂತರ ಏನಾಗುತ್ತದೆ?'] },
};
export default function AssistantChat() {
  const { lang } = useI18n(); const copy = TEXT[lang];
  const textarea = useRef<HTMLTextAreaElement>(null);
  const transport = useMemo(() => new DefaultChatTransport({ api: '/api/assistant' }), []);
  const { messages, sendMessage, status, error, stop } = useChat({ transport, onError: e => toast.error(e.message) });
  const busy = status === 'submitted' || status === 'streaming';
  useEffect(() => { if (!busy) textarea.current?.focus(); }, [busy]);
  useEffect(() => () => { void stop(); }, [stop]);
  async function ask(text: string) { if (!text.trim() || busy) return; await sendMessage({ text }); textarea.current?.focus(); }
  return <div>
    <Conversation className="h-[min(60dvh,640px)] min-h-80 border-y">
      <ConversationContent className="gap-6 px-0 py-6">
        {!messages.length && <div className="py-7"><img src={brand.url} alt="Siddi" width={112} height={112} className="mx-auto h-28 w-28 rounded-lg object-contain" /><h2 className="mt-6 text-center text-xl font-semibold">{copy.intro}</h2><div className="mx-auto mt-5 flex max-w-xl flex-col items-start gap-2">{copy.questions.map(q => <Button key={q} variant="outline" className="h-auto min-h-10 whitespace-normal text-left" onClick={() => ask(q)}>{q}</Button>)}</div></div>}
        {messages.map(m => <Message key={m.id} from={m.role} data-testid={`chat-${m.role}`}><MessageContent className={m.role === 'user' ? 'group-[.is-user]:bg-primary group-[.is-user]:text-primary-foreground' : ''}>
          {m.parts.map((p, idx) => p.type === 'text' ? <MessageResponse key={idx}>{p.text}</MessageResponse> : p.type === 'reasoning' && p.text ? <details key={idx} className="text-xs text-muted-foreground"><summary className="cursor-pointer">Thinking</summary><MessageResponse>{p.text}</MessageResponse></details> : null)}
        </MessageContent>{m.role === 'assistant' && !busy && m.parts.some(p => p.type === 'text' && p.text) && <MessageActions><MessageAction tooltip="Copy answer" onClick={() => { void navigator.clipboard.writeText(m.parts.filter(p => p.type === 'text').map(p => p.text).join('\n')); toast.success('Answer copied'); }}><Copy className="h-4 w-4" /></MessageAction></MessageActions>}</Message>)}
        {status === 'submitted' && <div role="status"><Shimmer>{copy.waiting}</Shimmer></div>}
        {error && <p role="alert" className="border-l-2 border-warning pl-3 text-sm">{error.message}</p>}
      </ConversationContent><ConversationScrollButton />
    </Conversation>
    <div className="mt-4"><PromptInput onSubmit={({ text }) => ask(text)}><PromptInputTextarea ref={textarea} autoFocus placeholder={copy.placeholder} aria-label="Your question" maxLength={4000} /><PromptInputFooter><span className="flex items-center gap-2 text-xs text-muted-foreground"><Languages className="h-4 w-4" />English · हिन्दी · ಕನ್ನಡ · Any language</span><PromptInputSubmit status={status} onStop={stop} /></PromptInputFooter></PromptInput></div>
    <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{copy.note}</p>
  </div>;
}