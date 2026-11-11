/** Client-only wording shared by chat, WhatsApp and appointment confirmations. */
export type Language = 'en' | 'ar' | 'hi' | 'ru';
export type Script = 'latin' | 'native';
export const LANGUAGES: Language[] = ['en', 'ar', 'hi', 'ru'];
export function normaliseLanguage(value: string | null | undefined): Language {
  const v = (value ?? '').trim().toLowerCase();
  if (/^(hi([_-]|$)|hindi|hinglish)/.test(v)) return 'hi';
  if (/^(ar([_-]|$)|arabic)/.test(v)) return 'ar';
  if (/^(ru([_-]|$)|russian)/.test(v)) return 'ru';
  return 'en';
}
/** Script detection takes precedence over a hint; short ambiguous text keeps memory. */
export function detectLanguage(text: string, fallback: Language = 'en'): Language {
  if (/[\u0900-\u097f]/.test(text)) return 'hi';
  if (/[\u0600-\u06ff]/.test(text)) return 'ar';
  if (/[\u0400-\u04ff]/.test(text)) return 'ru';
  if (/\b(mujhe|chahiye|chaiye|aap|namaste|nahi|band karo|stop karo|message mat bhejo|bhk|ruk[o]|mein|hai)\b/i.test(text)) return 'hi';
  if (/\b(i want|i need|looking for|please|hello|can you|what|where|english)\b/i.test(text)) return 'en';
  return fallback;
}
export function clientScript(text: string, previous: Script = 'native'): Script {
  return /[\u0900-\u097f]/.test(text) ? 'native' : /[a-z]/i.test(text) ? 'latin' : previous;
}

const en = {
  bookedOnline: 'You’re booked for {time}. We can go through your needs together then.\n\nJoin online: {meet}\n\nAdd it to your calendar: {calendar}',
  bookedInPerson: 'You’re booked for {time}. We’ll meet you in Dubai and go through your needs together then.\n\nAdd it to your calendar: {calendar}',
  chooseTime: 'Great! Which day and time suits you best? Tell me and I’ll book it.',
  chooseLocalTime: 'Great! Which day and time suits you best? You can tell me in your own local time and I’ll book it.',
  timeNotFree: 'That time isn’t free in our calendar. The closest free times are {times}. Would one of these work, or is there another time you prefer?',
  timeJustBooked: 'Sorry, that time has just been booked. Which other day and time would suit you?',
  timeNoLongerFree: 'Sorry, that time is no longer free. Available times: {times}. Which works for you, or is there another time you prefer?',
  noFreeTimes: 'Sorry, there are no free appointment times in the next two weeks. Which other day would suit you?',
  noLongerNoTimes: 'Sorry, that time is no longer free, and there are no other free times in the next two weeks.',
  dubaiTime: '{time} (Dubai time)',
  bothTimes: '{time} (Dubai time, {local} your time)',
  or: ' or ',
  onlineMeeting: 'Online meeting with {agency}',
  appointment: 'Appointment with {agency}',
  propertyTeam: 'our property team',
  stopped: "You're unsubscribed. We won't message you again.",
  privacy: 'For your privacy, this document has not been kept in the chat. A secure upload link will be shared. Please do not send identity documents here.',
  morningFollowUp: 'Good morning! How was the viewing yesterday? Did you get a feel for the neighbourhood?',
  secondFollowUp: 'Hi! I hope you’re doing well. Would you like another viewing?',
  secondWithListings: 'Hi! I hope you’re doing well. These similar options are within your budget: {listings}. Would you like to view either?',
};
export type ReplyKey = keyof typeof en;
type Dictionary = Record<ReplyKey, string>;
const ar: Dictionary = {
  bookedOnline: 'تم تأكيد موعدك في {time}. سنراجع احتياجاتك معاً حينها.\n\nرابط اللقاء عبر الإنترنت: {meet}\n\nأضف الموعد إلى تقويمك: {calendar}',
  bookedInPerson: 'تم تأكيد موعدك في {time}. سنلتقي بك في دبي ونراجع احتياجاتك معاً.\n\nأضف الموعد إلى تقويمك: {calendar}',
  chooseTime: 'ممتاز! أي يوم ووقت يناسبانك أكثر؟ أخبرني وسأحجز الموعد.',
  chooseLocalTime: 'ممتاز! أي يوم ووقت يناسبانك أكثر؟ يمكنك ذكر الوقت بتوقيتك المحلي وسأحجز الموعد.',
  timeNotFree: 'هذا الوقت غير متاح في تقويمنا. أقرب المواعيد المتاحة هي {times}. هل يناسبك أحدها أم تفضّل وقتاً آخر؟',
  timeJustBooked: 'عذراً، تم حجز هذا الوقت للتو. أي يوم ووقت آخر يناسبانك؟',
  timeNoLongerFree: 'عذراً، لم يعد هذا الوقت متاحاً. المواعيد المتاحة: {times}. أيّها يناسبك أم تفضّل وقتاً آخر؟',
  noFreeTimes: 'عذراً، لا توجد مواعيد متاحة خلال الأسبوعين المقبلين. أي يوم آخر يناسبك؟',
  noLongerNoTimes: 'عذراً، لم يعد هذا الوقت متاحاً، ولا توجد مواعيد أخرى خلال الأسبوعين المقبلين.',
  dubaiTime: '{time} (بتوقيت دبي)', bothTimes: '{time} (بتوقيت دبي، {local} بتوقيتك المحلي)', or: ' أو ',
  onlineMeeting: 'لقاء عبر الإنترنت مع {agency}', appointment: 'موعد مع {agency}', propertyTeam: 'فريقنا العقاري',
  stopped: 'تم إيقاف الرسائل. لن نرسل لك أي رسائل أخرى.',
  privacy: 'حفاظاً على خصوصيتك، لم نحتفظ بهذا المستند في المحادثة. سيتم توفير رابط رفع آمن. يرجى عدم إرسال وثائق الهوية هنا.',
  morningFollowUp: 'صباح الخير! كيف كانت المعاينة أمس؟ هل تعرّفت على أجواء الحي؟',
  secondFollowUp: 'مرحباً! أتمنى أن تكون بخير. هل ترغب في معاينة أخرى؟',
  secondWithListings: 'مرحباً! أتمنى أن تكون بخير. هذه خيارات مشابهة ضمن ميزانيتك: {listings}. هل ترغب في معاينة أحدها؟',
};
const hi: Dictionary = {
  bookedOnline: 'आपका समय {time} के लिए बुक हो गया है। तब हम आपकी ज़रूरतों पर साथ बात कर सकते हैं।\n\nऑनलाइन जुड़ें: {meet}\n\nअपने कैलेंडर में जोड़ें: {calendar}',
  bookedInPerson: 'आपका समय {time} के लिए बुक हो गया है। हम दुबई में मिलकर आपकी ज़रूरतों पर बात करेंगे।\n\nअपने कैलेंडर में जोड़ें: {calendar}',
  chooseTime: 'बहुत अच्छा! कौन सा दिन और समय आपके लिए सबसे अच्छा रहेगा? बताइए, मैं बुक कर दूँगा।',
  chooseLocalTime: 'बहुत अच्छा! कौन सा दिन और समय आपके लिए सबसे अच्छा रहेगा? आप अपने स्थानीय समय में बता सकते हैं, मैं बुक कर दूँगा।',
  timeNotFree: 'हमारे कैलेंडर में वह समय खाली नहीं है। सबसे नज़दीकी खाली समय हैं {times}। क्या इनमें से कोई ठीक रहेगा या आप कोई और समय चाहेंगे?',
  timeJustBooked: 'माफ़ कीजिए, वह समय अभी बुक हो गया है। कौन सा दूसरा दिन और समय ठीक रहेगा?',
  timeNoLongerFree: 'माफ़ कीजिए, वह समय अब खाली नहीं है। उपलब्ध समय: {times}। इनमें से कौन सा ठीक रहेगा या आप कोई और समय चाहेंगे?',
  noFreeTimes: 'माफ़ कीजिए, अगले दो हफ़्तों में कोई खाली समय नहीं है। कौन सा दूसरा दिन ठीक रहेगा?',
  noLongerNoTimes: 'माफ़ कीजिए, वह समय अब खाली नहीं है और अगले दो हफ़्तों में कोई दूसरा समय उपलब्ध नहीं है।',
  dubaiTime: '{time} (दुबई समय)', bothTimes: '{time} (दुबई समय, {local} आपका स्थानीय समय)', or: ' या ',
  onlineMeeting: '{agency} के साथ ऑनलाइन बैठक', appointment: '{agency} के साथ मुलाकात', propertyTeam: 'हमारी प्रॉपर्टी टीम',
  stopped: 'आपके लिए संदेश बंद कर दिए गए हैं। हम आपको दोबारा संदेश नहीं भेजेंगे।',
  privacy: 'आपकी गोपनीयता के लिए यह दस्तावेज़ चैट में नहीं रखा गया है। एक सुरक्षित अपलोड लिंक साझा किया जाएगा। कृपया यहाँ पहचान के दस्तावेज़ न भेजें।',
  morningFollowUp: 'सुप्रभात! कल की प्रॉपर्टी विज़िट कैसी रही? क्या आपको इलाके का अंदाज़ा मिला?',
  secondFollowUp: 'नमस्ते! उम्मीद है आप अच्छे हैं। क्या आप एक और प्रॉपर्टी देखना चाहेंगे?',
  secondWithListings: 'नमस्ते! उम्मीद है आप अच्छे हैं। ये मिलते-जुलते विकल्प आपके बजट में हैं: {listings}। क्या आप इनमें से कोई देखना चाहेंगे?',
};
const hiLatin: Dictionary = {
  bookedOnline: 'Aapka appointment {time} ke liye book ho gaya hai. Tab hum aapki zarooraton par saath baat kar sakte hain.\n\nOnline judein: {meet}\n\nApne calendar mein jodein: {calendar}',
  bookedInPerson: 'Aapka appointment {time} ke liye book ho gaya hai. Hum Dubai mein milkar aapki zarooraton par baat karenge.\n\nApne calendar mein jodein: {calendar}',
  chooseTime: 'Bahut achha! Kaunsa din aur waqt aapke liye sabse achha rahega? Bataiye, main book kar doonga.',
  chooseLocalTime: 'Bahut achha! Kaunsa din aur waqt aapke liye sabse achha rahega? Aap apne local time mein bata sakte hain, main book kar doonga.',
  timeNotFree: 'Hamare calendar mein woh waqt khaali nahi hai. Sabse nazdeek khaali waqt hain {times}. Kya inmein se koi theek rahega ya koi aur waqt chahenge?',
  timeJustBooked: 'Maaf kijiye, woh waqt abhi book ho gaya hai. Kaunsa doosra din aur waqt theek rahega?',
  timeNoLongerFree: 'Maaf kijiye, woh waqt ab khaali nahi hai. Khaali waqt: {times}. Kaunsa theek rahega ya koi aur waqt chahenge?',
  noFreeTimes: 'Maaf kijiye, agle do hafton mein koi khaali waqt nahi hai. Kaunsa doosra din theek rahega?',
  noLongerNoTimes: 'Maaf kijiye, woh waqt ab khaali nahi hai aur agle do hafton mein koi doosra waqt bhi nahi hai.',
  dubaiTime: '{time} (Dubai ka waqt)', bothTimes: '{time} (Dubai ka waqt, {local} aapka local waqt)', or: ' ya ',
  onlineMeeting: '{agency} ke saath online mulaqat', appointment: '{agency} ke saath mulaqat', propertyTeam: 'hamari property team',
  stopped: 'Aapke liye messages band kar diye gaye hain. Hum aapko dobara message nahi bhejenge.',
  privacy: 'Aapki privacy ke liye yeh document chat mein nahi rakha gaya hai. Ek secure upload link share kiya jayega. Kripya yahan identity documents na bhejein.',
  morningFollowUp: 'Namaste! Kal ki viewing kaisi rahi? Kya aapko ilaake ka andaaza mila?',
  secondFollowUp: 'Namaste! Umeed hai aap achhe hain. Kya aap ek aur property dekhna chahenge?',
  secondWithListings: 'Namaste! Umeed hai aap achhe hain. Yeh milte-julte options aapke budget mein hain: {listings}. Kya aap inmein se koi dekhna chahenge?',
};
const ru: Dictionary = {
  bookedOnline: 'Вы записаны на {time}. Тогда мы сможем вместе обсудить ваши пожелания.\n\nПрисоединиться онлайн: {meet}\n\nДобавить в календарь: {calendar}',
  bookedInPerson: 'Вы записаны на {time}. Мы встретимся в Дубае и вместе обсудим ваши пожелания.\n\nДобавить в календарь: {calendar}',
  chooseTime: 'Отлично! Какой день и время вам удобнее всего? Напишите, и я запишу вас.',
  chooseLocalTime: 'Отлично! Какой день и время вам удобнее всего? Можете указать ваше местное время, и я запишу вас.',
  timeNotFree: 'Это время в нашем календаре занято. Ближайшее свободное время: {times}. Подойдёт один из этих вариантов или вы предпочитаете другое время?',
  timeJustBooked: 'Извините, это время только что забронировали. Какой другой день и время вам подойдут?',
  timeNoLongerFree: 'Извините, это время уже занято. Свободное время: {times}. Что вам подойдёт или вы предпочитаете другое время?',
  noFreeTimes: 'Извините, в ближайшие две недели нет свободного времени для встречи. Какой другой день вам подойдёт?',
  noLongerNoTimes: 'Извините, это время уже занято, и в ближайшие две недели нет других свободных вариантов.',
  dubaiTime: '{time} (время Дубая)', bothTimes: '{time} (время Дубая, {local} ваше местное время)', or: ' или ',
  onlineMeeting: 'Онлайн-встреча с {agency}', appointment: 'Встреча с {agency}', propertyTeam: 'нашей командой по недвижимости',
  stopped: 'Вы отписались. Мы больше не будем отправлять вам сообщения.',
  privacy: 'Для вашей конфиденциальности этот документ не сохранён в чате. Вам предоставят защищённую ссылку для загрузки. Пожалуйста, не отправляйте документы, удостоверяющие личность, сюда.',
  morningFollowUp: 'Доброе утро! Как прошёл вчерашний просмотр? Удалось почувствовать атмосферу района?',
  secondFollowUp: 'Здравствуйте! Надеюсь, у вас всё хорошо. Хотели бы вы посмотреть ещё один объект?',
  secondWithListings: 'Здравствуйте! Надеюсь, у вас всё хорошо. Эти похожие варианты укладываются в ваш бюджет: {listings}. Хотели бы вы посмотреть один из них?',
};
export const replyDictionaries = { en, ar, hi, ru, hiLatin };
export function t(lang: Language, key: ReplyKey, vars: Record<string, string | number> = {}, script: Script = 'native') {
  const value = (lang === 'hi' && script === 'latin' ? hiLatin : replyDictionaries[lang])[key];
  return value.replace(/\{(\w+)\}/g, (_, name: string) => {
    if (vars[name] === undefined) throw new Error(`Missing translation value: ${name}`);
    return String(vars[name]);
  });
}
export function formatReplyTime(slot: string, lang: Language, zone = 'Asia/Dubai', script: Script = 'native') {
  const locale = lang === 'hi' && script === 'latin' ? 'hi-Latn-IN' : { en: 'en-GB', ar: 'ar-AE', hi: 'hi-IN', ru: 'ru-RU' }[lang];
  // Intl falls back to Devanagari for hi-Latn; Latin Hinglish uses digits-only date labels instead.
  return new Intl.DateTimeFormat(locale, {
    timeZone: zone, calendar: 'gregory', numberingSystem: 'latn',
    ...(lang === 'hi' && script === 'latin' ? { year: 'numeric', month: '2-digit', day: '2-digit' } as const : { weekday: 'long', day: 'numeric', month: 'short' } as const),
    hour: 'numeric', minute: '2-digit', hour12: false,
  }).format(new Date(slot));
}
export const SAMPLE_BUYERS = [
  { lang: 'en', label: 'English', text: 'I am looking for a 2-bedroom apartment in Dubai Marina.' },
  { lang: 'ar', label: 'العربية', text: 'أبحث عن شقة من غرفتين في Dubai Marina.' },
  { lang: 'hi', label: 'हिन्दी', text: 'मुझे Dubai Marina में दो बेडरूम का अपार्टमेंट चाहिए।' },
  { lang: 'ru', label: 'Русский', text: 'Я ищу квартиру с двумя спальнями в Dubai Marina.' },
] as const;