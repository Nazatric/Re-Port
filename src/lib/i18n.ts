/** Interface strings. English is the default and the fallback for any missing key.
 *  Game titles, descriptions and port notes come from the catalog and stay in their source language. */
export type LangCode = "en" | "es" | "pt" | "hi" | "zh";
export type TKey = keyof typeof en;

export const languages: { id: LangCode; name: string }[] = [
  { id: "en", name: "English" },
  { id: "es", name: "Español" },
  { id: "pt", name: "Português" },
  { id: "hi", name: "हिन्दी" },
  { id: "zh", name: "中文" },
];

const en = {
  "tab.home": "Home", "tab.browse": "Browse", "tab.library": "Library", "tab.settings": "Settings",
  "home.featured": "Featured community ports", "home.recentViewed": "Recently viewed",
  "home.collections": "Collections", "home.recentAdded": "Recently added ports",
  "home.seeAll": "See all", "home.library": "Library", "home.browse": "Browse",
  "home.morning": "Good morning", "home.afternoon": "Good afternoon", "home.evening": "Good evening",
  "settings.language": "Language", "settings.languageSubtitle": "Interface language",
  "settings.appearance": "Appearance", "settings.appUpdate": "App update", "settings.about": "About",
};

const dicts: Record<LangCode, Partial<typeof en>> = {
  en,
  es: {
    "tab.home": "Inicio", "tab.browse": "Explorar", "tab.library": "Biblioteca", "tab.settings": "Ajustes",
    "home.featured": "Ports destacados de la comunidad", "home.recentViewed": "Vistos recientemente",
    "home.collections": "Colecciones", "home.recentAdded": "Ports añadidos recientemente",
    "home.seeAll": "Ver todo", "home.library": "Biblioteca", "home.browse": "Explorar",
    "home.morning": "Buenos días", "home.afternoon": "Buenas tardes", "home.evening": "Buenas noches",
    "settings.language": "Idioma", "settings.languageSubtitle": "Idioma de la interfaz",
    "settings.appearance": "Apariencia", "settings.appUpdate": "Actualización de la app", "settings.about": "Acerca de",
  },
  pt: {
    "tab.home": "Início", "tab.browse": "Explorar", "tab.library": "Biblioteca", "tab.settings": "Configurações",
    "home.featured": "Ports em destaque da comunidade", "home.recentViewed": "Vistos recentemente",
    "home.collections": "Coleções", "home.recentAdded": "Ports adicionados recentemente",
    "home.seeAll": "Ver tudo", "home.library": "Biblioteca", "home.browse": "Explorar",
    "home.morning": "Bom dia", "home.afternoon": "Boa tarde", "home.evening": "Boa noite",
    "settings.language": "Idioma", "settings.languageSubtitle": "Idioma da interface",
    "settings.appearance": "Aparência", "settings.appUpdate": "Atualização do app", "settings.about": "Sobre",
  },
  hi: {
    "tab.home": "होम", "tab.browse": "खोजें", "tab.library": "लाइब्रेरी", "tab.settings": "सेटिंग्स",
    "home.featured": "समुदाय के चुनिंदा पोर्ट", "home.recentViewed": "हाल ही में देखे गए",
    "home.collections": "संग्रह", "home.recentAdded": "हाल ही में जोड़े गए पोर्ट",
    "home.seeAll": "सभी देखें", "home.library": "लाइब्रेरी", "home.browse": "खोजें",
    "home.morning": "शुभ प्रभात", "home.afternoon": "शुभ दोपहर", "home.evening": "शुभ संध्या",
    "settings.language": "भाषा", "settings.languageSubtitle": "इंटरफ़ेस की भाषा",
    "settings.appearance": "रूप-रंग", "settings.appUpdate": "ऐप अपडेट", "settings.about": "परिचय",
  },
  zh: {
    "tab.home": "首页", "tab.browse": "浏览", "tab.library": "库", "tab.settings": "设置",
    "home.featured": "社区精选移植", "home.recentViewed": "最近浏览",
    "home.collections": "合集", "home.recentAdded": "最近添加的移植",
    "home.seeAll": "查看全部", "home.library": "库", "home.browse": "浏览",
    "home.morning": "早上好", "home.afternoon": "下午好", "home.evening": "晚上好",
    "settings.language": "语言", "settings.languageSubtitle": "界面语言",
    "settings.appearance": "外观", "settings.appUpdate": "应用更新", "settings.about": "关于",
  },
};

export function makeT(lang: LangCode) {
  const dict = dicts[lang] ?? en;
  return (key: TKey): string => dict[key] ?? en[key];
}
