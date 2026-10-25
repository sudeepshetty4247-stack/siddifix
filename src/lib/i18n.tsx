import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { te } from './locales/te';
import { kn } from './locales/kn';
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
export type LocaleKey = keyof typeof te;
const english: Partial<Record<LocaleKey,string>> = { chooseLocation:"Choose your location", changeLocation:"Change location", state:"State",district:"District",serviceArea:"Service area",language:"Language",manual:"Chosen by you",locationHelp:"Choose a service area, or search the exact incident location.",useGps:"Use current location",boundaryPending:"Municipal boundary verification pending. Report submission is not yet activated here.",localInformation:"Local authority information",jurisdictionPending:"Official constituency listing; exact ward linkage is not yet verified.",officialSource:"Official source",municipalContact:"Municipal contact",noReports:"No Siddhi reports recorded in this service area yet.",loading:"Loading…",retry:"Try again",save:"Save",cancel:"Cancel",back:"Back",active:"Active",resolved:"Resolved",overdue:"Overdue",acknowledged:"Acknowledged",escalated:"Escalated",uniqueIssues:"Unique issues",cityProgress:"How our area is doing",allReports:"All reports",latestReports:"Latest reported problems",community:"From the community",betterNeighbourhood:"A better neighbourhood starts here.",homeDescription:"A broken road. An overflowing bin. A streetlight gone dark. Report what matters, and follow every recorded action.",independent:"No citizen login required · Independent civic platform",allTime:"All time",days30:"30 days",days90:"90 days",fullReport:"Full transparency report",localReports:"Recorded reports in your selected service area",noMatches:"No issues match your filters.",category:"Category",status:"Status",allCategories:"All categories",anyStatus:"Any status",newest:"Newest",mostReported:"Most reported",searchReports:"Search by title, landmark or reference…",staffPortal:"Government Staff Portal",adminPortal:"Admin Control Centre",workload:"My workload",queue:"Department queue",notifications:"Notifications",review:"Report review",controlCentre:"Control centre",staffManagement:"Staff management",directory:"Departments & authority data",serviceAreas:"Service areas",operations:"Reports & operations",signOut:"Sign out",citizenSite:"Citizen site",authorizedScope:"Authorized scope only",administration:"Administration",governmentOperations:"Government operations",secureAccess:"Verifying secure access…",caseMap:"Case map",overdueEscalated:"Overdue & escalated",duplicates:"Duplicates & recurring",audit:"Audit & system health",targets:"Service targets",feedback:"Citizen feedback",responses:"Response configuration",routing:"Routing exceptions",adminAccess:"Administrator access",dataHealth:"Data health & demo",submitted:"Submitted",assigned:"Assigned",inProgress:"In progress",underReview:"Under review",closed:"Closed",rejected:"Rejected",reopened:"Reopened",awaitingVerification:"Awaiting verification",needsClassification:"Needs classification",accepted:"Acknowledged",inspectionScheduled:"Inspection scheduled",reportTitle:"Issue title",description:"Description",incidentLocation:"Incident location",confirmLocation:"Confirm problem location",submit:"Submit report",photo:"Photo",evidence:"Evidence" };

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void; suggestLang:(l?:string)=>void; t: (k: TKey) => string; tx:(k:LocaleKey)=>string }>({
  lang: "en",
  setLang: () => {},
  suggestLang:()=>{}, tx:k=>english[k]??k,
  t: (k) => dict[k].en,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  useEffect(() => {
    const saved = localStorage.getItem("civicfix.lang") as Lang | null;
    if (saved && ["en", "hi", "kn", "te"].includes(saved)) {setLangState(saved);document.documentElement.lang=saved;}
  }, []);
  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem("civicfix.lang", l);
    document.documentElement.lang = l;
  };
  function suggestLang(suggestion?:string){const saved=localStorage.getItem("civicfix.lang");const next=preferredAreaLanguage(saved,suggestion) as Lang;if(["en","hi","kn","te"].includes(next)){setLangState(next);document.documentElement.lang=next;}}
  return <Ctx.Provider value={{ lang, setLang, suggestLang, t: (k) => lang==='te'?te[k]:dict[k][lang], tx:k=>lang==='te'?te[k]:lang==='kn'?kn[k]:english[k]??(k in dict?dict[k as TKey][lang]:k) }}>{children}</Ctx.Provider>;
}
export const useI18n = () => useContext(Ctx);
