/**
 * App language for the shell (menu, tabs, search, New lead) and the Inbox and Leads pages. English is the source text and the key;
 * a missing Arabic line falls back to English. Browser-safe and tested.
 */
export type Lang = "en" | "ar";
export const LANG_KEY = "gci-lang";

const AR: Record<string, string> = {
  // sections and tabs
  Today: "اليوم",
  Leads: "العملاء المحتملون",
  Deals: "الصفقات",
  Listings: "العقارات",
  Insights: "التحليلات",
  Settings: "الإعدادات",
  Tools: "الأدوات",
  Inbox: "الوارد",
  List: "القائمة",
  Board: "اللوحة",
  Viewings: "المعاينات",
  "Follow-ups": "المتابعات",
  Import: "استيراد",
  Owners: "الملّاك",
  Statistics: "الإحصاءات",
  "Weekly report": "التقرير الأسبوعي",
  Ads: "الإعلانات",
  "Market insights": "رؤى السوق",
  "Market data": "بيانات السوق",
  General: "عام",
  "My alerts": "تنبيهاتي",
  Team: "الفريق",
  "Lead routing": "توزيع العملاء",
  "Deals and fees": "الصفقات والرسوم",
  WhatsApp: "واتساب",
  Templates: "القوالب",
  "Send queue": "قائمة الإرسال",
  Campaigns: "الحملات",
  Records: "السجلات",
  "AI reply rules": "قواعد رد الذكاء الاصطناعي",
  "Test chat": "محادثة تجريبية",
  "UAE knowledge": "معلومات الإمارات",
  "GCI calculator": "حاسبة العمولة",
  "Elite Visions HQ": "إدارة إيليت فيجنز",
  // shell
  "Search leads, pages…": "ابحث عن عميل أو صفحة…",
  "New lead": "عميل جديد",
  "Sign out": "تسجيل الخروج",
  "Open menu": "فتح القائمة",
  Owner: "المالك",
  Agent: "وكيل",
  "Powered by Elite Visions": "بدعم من إيليت فيجنز",
  "Search a lead by name, phone or area, or a page…":
    "ابحث عن عميل بالاسم أو الهاتف أو المنطقة، أو عن صفحة…",
  "Nothing found.": "لا توجد نتائج.",
  Actions: "إجراءات",
  Pages: "الصفحات",
  "Add the name and phone. You can fill in the rest on the lead.":
    "أضف الاسم والهاتف. يمكنك إكمال الباقي من صفحة العميل.",
  Name: "الاسم",
  "Phone (with country code)": "الهاتف (مع رمز الدولة)",
  "Came from": "المصدر",
  Cancel: "إلغاء",
  "Create lead": "إنشاء العميل",
  Language: "اللغة",
  // Inbox and Leads pages
  "New leads from portals, ads and your website, newest first. Last 30 days.":
    "العملاء الجدد من البوابات والإعلانات وموقعك، الأحدث أولاً. آخر 30 يوماً.",
  New: "جديد",
  "Waiting for reply": "بانتظار الرد",
  "In pool": "في المجمّع",
  "Routing and portals": "التوزيع والبوابات",
  "Inbox view": "عرض الوارد",
  "Assigned ({n})": "المعيَّنون ({n})",
  "Pool ({n})": "المجمّع ({n})",
  Source: "المصدر",
  "All sources": "كل المصادر",
  "All agents": "كل الوكلاء",
  Reply: "الرد",
  "Replied or waiting": "تم الرد أو بالانتظار",
  Replied: "تم الرد",
  "Unnamed lead": "عميل بدون اسم",
  "Ref {ref}": "مرجع {ref}",
  "No details yet": "لا توجد تفاصيل بعد",
  "Routed to you": "وُزّع عليك",
  "Replied in {time}": "تم الرد خلال {time}",
  "Waiting {time}": "بالانتظار منذ {time}",
  Yours: "لك",
  "{time} ago": "منذ {time}",
  "{n} matches": "{n} عقارات مطابقة",
  "1 match": "عقار مطابق واحد",
  "No available listing fits this area and budget yet.":
    "لا يوجد عقار متاح يناسب هذه المنطقة والميزانية بعد.",
  "area fits": "المنطقة مناسبة",
  "budget fits": "الميزانية مناسبة",
  "The pool is empty. Leads land here when no agent is free, or when the agent doesn't reply within {n} minutes.":
    "المجمّع فارغ. يصل العملاء إلى هنا عندما لا يتوفر وكيل، أو عندما لا يرد الوكيل خلال {n} دقيقة.",
  "Assign a pool lead to an agent, or take it yourself.":
    "عيّن عميلاً من المجمّع لأحد الوكلاء أو خذه بنفسك.",
  "Take up to {n} pool leads a day. Phone numbers show once the lead is yours.":
    "يمكنك أخذ حتى {n} عملاء من المجمّع يومياً. يظهر رقم الهاتف بعد أن يصبح العميل لك.",
  "In pool {time}": "في المجمّع منذ {time}",
  "Assign to…": "تعيين إلى…",
  "Take lead": "خذ العميل",
  "No new leads here yet.": "لا يوجد عملاء جدد هنا بعد.",
  "Connect Property Finder, Bayut, Dubizzle, Meta forms or your website in":
    "اربط بروبرتي فايندر وبيوت ودوبيزل ونماذج ميتا أو موقعك من",
  ". Leads then arrive here by themselves.": ". بعدها يصل العملاء إلى هنا تلقائياً.",
  "Leads routed to you appear here. Check the Pool tab for leads you can take.":
    "يظهر هنا العملاء الموزَّعون عليك. راجع تبويب المجمّع للعملاء الذين يمكنك أخذهم.",
  "Something went wrong.": "حدث خطأ ما.",
  "All leads in your agency.": "كل عملاء وكالتك.",
  "Leads assigned to you.": "العملاء المعيَّنون لك.",
  "Hot first.": "الأهم أولاً.",
  "Export {n}": "تصدير {n}",
  "My lists": "قوائمي",
  "All open ({n})": "كل المفتوحين ({n})",
  "Remove list {name}": "حذف القائمة {name}",
  'Remove the list "{name}"? The leads stay.': "حذف القائمة «{name}»؟ سيبقى العملاء كما هم.",
  "Search leads": "البحث في العملاء",
  "Name, phone, area or budget": "الاسم أو الهاتف أو المنطقة أو الميزانية",
  Score: "التقييم",
  "Any score": "أي تقييم",
  Hot: "ساخن",
  Warm: "دافئ",
  Cold: "بارد",
  "Any source": "أي مصدر",
  Step: "المرحلة",
  "Any step": "أي مرحلة",
  "Replied or not": "تم الرد أم لا",
  "Not replied": "لم يتم الرد",
  "Any agent": "أي وكيل",
  "Pool (no agent)": "المجمّع (بدون وكيل)",
  Pool: "المجمّع",
  Outcome: "النتيجة",
  Open: "مفتوح",
  "Not now": "ليس الآن",
  Won: "تمت الصفقة",
  Lost: "خسارة",
  All: "الكل",
  "Name this list": "سمِّ هذه القائمة",
  "Could not save the list.": "تعذّر حفظ القائمة.",
  "Save as list": "حفظ كقائمة",
  "No leads yet.": "لا يوجد عملاء بعد.",
  "Add one with New lead at the top, or": "أضف عميلاً من زر «عميل جديد» في الأعلى، أو",
  "import your list from Excel": "استورد قائمتك من إكسل",
  "No leads match these filters.": "لا يوجد عملاء يطابقون هذه التصفية.",
  "Needs your confirmation": "بحاجة إلى تأكيدك",
  Stopped: "أوقف الرسائل",
  "Nothing learned yet": "لا توجد معلومات بعد",
  "Step {n}": "المرحلة {n}",
  "Showing the first 300 of {n}. Narrow the filters to see the rest.":
    "يُعرض أول 300 من {n}. ضيّق التصفية لرؤية الباقي.",
  "New or first reply (1–2)": "جديد أو أول رد (1–2)",
  "Qualifying (3–5)": "التأهيل (3–5)",
  "Viewing and follow-up (6–8)": "المعاينة والمتابعة (6–8)",
  "Offer and paperwork (9–13)": "العرض والأوراق (9–13)",
  "Closed and after (14–15)": "الإغلاق وما بعده (14–15)",
};

export const isLang = (v: unknown): v is Lang => v === "en" || v === "ar";
export const dirOf = (lang: Lang) => (lang === "ar" ? "rtl" : "ltr");

/** Translate a shell string; unknown text is returned as it is. */
export function tr(lang: Lang, text: string): string {
  return lang === "ar" ? (AR[text] ?? text) : text;
}

/** "Leads · Board" style titles, translated part by part. */
export function trTitle(lang: Lang, title: string): string {
  return title
    .split(" · ")
    .map((p) => tr(lang, p))
    .join(" · ");
}

/** Translate, then fill {blanks}: trf("ar", "Export {n}", { n: 12 }). */
export function trf(lang: Lang, text: string, vars?: Record<string, string | number>): string {
  const out = tr(lang, text);
  return vars
    ? out.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m))
    : out;
}

export const hasArabic = (text: string) => text in AR;
