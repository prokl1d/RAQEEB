// "Spot the scam" training messages (English + Arabic). Written for this quiz: the scam links are
// fictional; the real messages use official domains or numbers from RAQEEB's registry.
// `marks` are exact substrings of `text` to highlight when the answer is revealed.

export interface QuizSide {
  sender: string;
  text: string;
  marks: string[];
  tips: string[];
}
export interface QuizItem {
  id: string;
  scam: boolean;
  en: QuizSide;
  ar: QuizSide;
}

export const QUIZ: QuizItem[] = [
  {
    id: "bank-otp",
    scam: true,
    en: {
      sender: "EmiratesNBD",
      text: "URGENT: your card has been suspended. Verify your details at emiratesnbd-secure.co and enter the OTP we send you.",
      marks: ["URGENT", "suspended", "emiratesnbd-secure.co", "OTP"],
      tips: ["emiratesnbd-secure.co is not emiratesnbd.com: the real name with an extra word.", "Banks never ask you to share an OTP.", "Urgency and a threat push you to act before checking."],
    },
    ar: {
      sender: "EmiratesNBD",
      text: "عاجل: تم إيقاف بطاقتك. حدّث بياناتك عبر emiratesnbd-secure.co وأدخل رمز التحقق الذي سيصلك.",
      marks: ["عاجل", "تم إيقاف", "emiratesnbd-secure.co", "رمز التحقق"],
      tips: ["emiratesnbd-secure.co ليس emiratesnbd.com: الاسم الحقيقي مع كلمة إضافية.", "البنوك لا تطلب منك مشاركة رمز التحقق أبدًا.", "الاستعجال والتهديد يدفعانك للتصرف قبل التحقق."],
    },
  },
  {
    id: "dewa-bill",
    scam: false,
    en: {
      sender: "DEWA",
      text: "Your November bill is ready. View and pay it in the DEWA app or at dewa.gov.ae.",
      marks: ["dewa.gov.ae"],
      tips: ["dewa.gov.ae is DEWA's official domain, confirmed by a government directory.", "It asks for nothing: no codes, no card details, no deadline."],
    },
    ar: {
      sender: "DEWA",
      text: "فاتورتك لشهر نوفمبر جاهزة. اطّلع عليها وادفعها عبر تطبيق ديوا أو dewa.gov.ae.",
      marks: ["dewa.gov.ae"],
      tips: ["dewa.gov.ae هو النطاق الرسمي لهيئة كهرباء ومياه دبي، ومؤكد في دليل حكومي.", "لا تطلب شيئًا: لا رموز ولا بيانات بطاقة ولا مهلة."],
    },
  },
  {
    id: "parcel-fee",
    scam: true,
    en: {
      sender: "EmiratesPost",
      text: "Your parcel is on hold. Pay the AED 4.50 redelivery fee today to release it: emiratespost-redelivery.com",
      marks: ["AED 4.50 redelivery fee", "today", "emiratespost-redelivery.com"],
      tips: ["A small 'release' fee is the classic delivery scam.", "emiratespost-redelivery.com is not emiratespost.ae."],
    },
    ar: {
      sender: "EmiratesPost",
      text: "شحنتك متوقفة. ادفع 4.50 درهم رسوم إعادة التوصيل اليوم لاستلامها: emiratespost-redelivery.com",
      marks: ["ادفع 4.50 درهم رسوم", "اليوم", "emiratespost-redelivery.com"],
      tips: ["رسوم «إفراج» صغيرة هي حيلة التوصيل الأشهر.", "emiratespost-redelivery.com ليس emiratespost.ae."],
    },
  },
  {
    id: "bank-alert",
    scam: false,
    en: {
      sender: "EmiratesNBD",
      text: "AED 120.00 was spent on your card ending 4471 at Carrefour. If this wasn't you, call us on 600 54 0000.",
      marks: ["600 54 0000"],
      tips: ["600 54 0000 is Emirates NBD's official number, from its own website.", "No link, and nothing is asked of you. You choose whether to call."],
    },
    ar: {
      sender: "EmiratesNBD",
      text: "تم خصم 120.00 درهم من بطاقتك المنتهية بـ 4471 لدى كارفور. إذا لم تقم بذلك، اتصل بنا على 600 54 0000.",
      marks: ["600 54 0000"],
      tips: ["600 54 0000 هو الرقم الرسمي لبنك الإمارات دبي الوطني، من موقعه الرسمي.", "لا رابط، ولا يُطلب منك شيء. أنت من يقرر الاتصال."],
    },
  },
  {
    id: "police-fine",
    scam: true,
    en: {
      sender: "AD-Police",
      text: "You have an unpaid traffic fine of AED 400. Pay within 24 hours at adpolice-fines.com or legal action will be taken.",
      marks: ["within 24 hours", "adpolice-fines.com", "legal action"],
      tips: ["adpolice-fines.com is not an Abu Dhabi Police domain.", "Deadlines and legal threats are pressure tricks.", "Check fines only through official police apps and websites."],
    },
    ar: {
      sender: "AD-Police",
      text: "لديك مخالفة مرورية غير مدفوعة بقيمة 400 درهم. ادفعها خلال 24 ساعة عبر adpolice-fines.com وإلا سيتم اتخاذ إجراءات قانونية.",
      marks: ["خلال 24 ساعة", "adpolice-fines.com", "إجراءات قانونية"],
      tips: ["adpolice-fines.com ليس نطاقًا تابعًا لشرطة أبوظبي.", "المهلة والتهديد القانوني أساليب ضغط.", "تحقّق من المخالفات فقط عبر تطبيقات ومواقع الشرطة الرسمية."],
    },
  },
  {
    id: "new-number",
    scam: true,
    en: {
      sender: "+971 5x xxx xxxx",
      text: "Hi Mum, this is my new number. My phone broke. Can you transfer AED 2,000 to this account today? Please don't tell Dad.",
      marks: ["new number", "transfer AED 2,000", "don't tell"],
      tips: ["'New number' plus an urgent money request is a common family scam.", "Secrecy stops you from checking with anyone.", "Call the person on their old number before sending anything."],
    },
    ar: {
      sender: "+971 5x xxx xxxx",
      text: "مرحبًا أمي، هذا رقمي الجديد، هاتفي تعطّل. هل يمكنك تحويل 2000 درهم إلى هذا الحساب اليوم؟ لا تخبري أبي.",
      marks: ["رقمي الجديد", "تحويل 2000 درهم", "لا تخبري"],
      tips: ["«رقمي الجديد» مع طلب مال عاجل حيلة عائلية شائعة.", "طلب السرية يمنعك من التحقق مع أي أحد.", "اتصل بالشخص على رقمه القديم قبل إرسال أي شيء."],
    },
  },
  {
    id: "post-tracking",
    scam: false,
    en: {
      sender: "EmiratesPost",
      text: "Your shipment RR123456789AE is out for delivery today. Track it at emiratespost.ae.",
      marks: ["emiratespost.ae"],
      tips: ["emiratespost.ae is Emirates Post's official domain, confirmed on u.ae.", "No payment and no personal details requested."],
    },
    ar: {
      sender: "EmiratesPost",
      text: "شحنتك RR123456789AE في طريقها إليك اليوم. تتبّعها عبر emiratespost.ae.",
      marks: ["emiratespost.ae"],
      tips: ["emiratespost.ae هو النطاق الرسمي لبريد الإمارات، ومؤكد في بوابة u.ae.", "لا دفع ولا طلب لبيانات شخصية."],
    },
  },
  {
    id: "prize",
    scam: true,
    en: {
      sender: "eand-Rewards",
      text: "Congratulations! You won an iPhone 17 in the e& (Etisalat) anniversary draw. Claim it at etisalat-rewards.win and pay AED 25 delivery.",
      marks: ["Congratulations! You won", "etisalat-rewards.win", "pay AED 25"],
      tips: ["Prizes you never entered for are bait.", "etisalat-rewards.win is not etisalat.ae or eand.com.", "A small 'delivery' fee is how they take your card details."],
    },
    ar: {
      sender: "eand-Rewards",
      text: "مبروك! ربحت iPhone 17 في سحب الذكرى السنوية من اتصالات. استلمه عبر etisalat-rewards.win وادفع 25 درهم للتوصيل.",
      marks: ["مبروك! ربحت", "etisalat-rewards.win", "ادفع 25 درهم"],
      tips: ["الجوائز التي لم تشارك فيها طُعم.", "etisalat-rewards.win ليس etisalat.ae ولا eand.com.", "رسوم «التوصيل» الصغيرة طريقتهم لأخذ بيانات بطاقتك."],
    },
  },
];
