import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { te } from './locales/te';
import { preferredAreaLanguage } from './service-area';

export type Lang = "en" | "hi" | "kn" | "te";
export const LANGS: { id: Lang; label: string }[] = [
  { id: "en", label: "English" },
  { id: "te", label: "తెలుగు" },
  { id: "hi", label: "हिन्दी" },
  { id: "kn", label: "ಕನ್ನಡ" },
];

const dict = {
  home: { en: "Home", hi: "होम", kn: "ಮುಖಪುಟ" },
  report: { en: "Report an Issue", hi: "समस्या दर्ज करें", kn: "ಸಮಸ್ಯೆ ವರದಿ ಮಾಡಿ" },
  map: { en: "Civic Map", hi: "नागरिक नक्शा", kn: "ನಾಗರಿಕ ನಕ್ಷೆ" },
  explore: { en: "Explore Issues", hi: "समस्याएँ देखें", kn: "ಸಮಸ್ಯೆಗಳನ್ನು ನೋಡಿ" },
  track: { en: "My Tracking", hi: "मेरी ट्रैकिंग", kn: "ನನ್ನ ಟ್ರ್ಯಾಕಿಂಗ್" },
  transparency: { en: "Public Reports", hi: "सार्वजनिक रिपोर्ट", kn: "ಸಾರ್ವಜನಿಕ ವರದಿಗಳು" },
  assistant: { en: "Ask Siddhi", hi: "Siddhi से पूछें", kn: "Siddhi ಕೇಳಿ" },
  staff: { en: "Staff sign in", hi: "कर्मचारी लॉगिन", kn: "ಸಿಬ್ಬಂದಿ ಲಾಗಿನ್" },
  admin: { en: "Admin sign in", hi: "एडमिन लॉगिन", kn: "ಆಡಳಿತ ಲಾಗಿನ್" },
  heroTitle: {
    en: "Report once. Track every action.",
    hi: "एक बार रिपोर्ट करें। हर कार्रवाई ट्रैक करें।",
    kn: "ಒಮ್ಮೆ ವರದಿ ಮಾಡಿ. ಪ್ರತಿ ಕ್ರಮವನ್ನು ಟ್ರ್ಯಾಕ್ ಮಾಡಿ.",
  },
  heroSub: {
    en: "Snap a photo of a pothole, broken streetlight or overflowing drain. Siddhi classifies it, routes it, and keeps a public record until it's fixed.",
    hi: "गड्ढे, खराब स्ट्रीटलाइट या बहती नाली की फोटो लें। Siddhi इसे वर्गीकृत करता है, सही विभाग तक पहुँचाता है और ठीक होने तक सार्वजनिक रिकॉर्ड रखता है।",
    kn: "ಗುಂಡಿ, ಕೆಟ್ಟ ಬೀದಿದೀಪ ಅಥವಾ ಉಕ್ಕಿ ಹರಿಯುವ ಚರಂಡಿಯ ಫೋಟೋ ತೆಗೆಯಿರಿ. Siddhi ಅದನ್ನು ವರ್ಗೀಕರಿಸಿ, ಸರಿಯಾದ ಇಲಾಖೆಗೆ ಕಳುಹಿಸಿ, ಸರಿಯಾಗುವವರೆಗೆ ಸಾರ್ವಜನಿಕ ದಾಖಲೆ ಇಡುತ್ತದೆ.",
  },
  reportCta: { en: "Report a Problem", hi: "समस्या रिपोर्ट करें", kn: "ಸಮಸ್ಯೆ ವರದಿ ಮಾಡಿ" },
  noLogin: { en: "No sign-up needed", hi: "साइन-अप की ज़रूरत नहीं", kn: "ನೋಂದಣಿ ಅಗತ್ಯವಿಲ್ಲ" },
} as const;
export type TKey = keyof typeof dict;

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (k: TKey) => string }>({
  lang: "en",
  setLang: () => {},
  t: (k) => dict[k].en,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  useEffect(() => {
    const saved = localStorage.getItem("civicfix.lang") as Lang | null;
    if (saved && ["en", "hi", "kn"].includes(saved)) setLangState(saved);
  }, []);
  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem("civicfix.lang", l);
    document.documentElement.lang = l;
  };
  return <Ctx.Provider value={{ lang, setLang, t: (k) => dict[k][lang] }}>{children}</Ctx.Provider>;
}
export const useI18n = () => useContext(Ctx);
