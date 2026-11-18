/**
 * App language for the shell (menu, tabs, search, New lead). English is the source text and the key;
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

export const hasArabic = (text: string) => text in AR;
