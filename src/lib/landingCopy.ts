// Words for the landing page: plain English with natural Tagalog mixed in, the way people actually talk about money.
// Worked samples come from onboardingCopy so the website and the app teach the same examples.
export const NAV: [string, string][] = [
  ['#try', 'Demo'],
  ['#about', 'Ano ito'],
  ['#how', 'Paano'],
  ['#features', 'Features'],
  ['#privacy', 'Privacy'],
  ['#faq', 'FAQ'],
  ['#install', 'I-install'],
];
export const H = {
  pain: 'Sound familiar?',
  about: 'Para klaro na ang pera mo',
  how: 'Paano gumagana',
  samples: 'Subukan natin',
  samplesLead: 'Apat na bagay na gagawin mo sa unang minuto, at kung ano ang ginagawa ng Zovix sa bawat isa.',
  does: 'Ito ang ginagawa ng Zovix',
  cmp: 'Bakit hindi na lang Notes o spreadsheet?',
  features: 'Ano ang makukuha mo',
  levels: 'Mag-level up habang nagta-track',
  who: 'Para kanino ang Zovix',
  privacy: 'Pribado ang pera mo',
  faq: 'May tanong ka?',
  install: 'I-install sa 3 tap',
  final: 'May plano na ang susunod mong piso.',
} as const;
export const WHAT: [string, string][] = [
  [
    'Ano ito',
    'Libreng money tracker para sa mga Pinoy. I-type mo lang ang gastos o kita mo na parang nagte-text, at Zovix na ang bahala sa tala.',
  ],
  [
    'Paano ito nakakatulong',
    'Alam mo kung magkano na lang ang laman ng bawat wallet, saan napunta ang pera mo ngayong buwan, at kung nasa budget ka pa.',
  ],
  ['Ano ang makukuha mo', 'Mas kaunting "saan napunta?" na sandali, goal na unti-unting napupuno, at streak na nagbubuo ng ugali.'],
];
export const HOW: [string, string, string][] = [
  ['1', 'I-type mo', 'Isulat lang ang "lunch 150 gcash". Walang form, walang spreadsheet, walang bank login.'],
  ['2', 'Zovix na ang bahala', 'Siya na ang pipili ng halaga, category at account, at mag-a-update ng balanse mo.'],
  ['3', 'Panoorin mong lumago', 'Budgets, goals, reports at quests ang magpapakita ng progress mo. Bawat entry may XP.'],
];
export const SAMPLE_TITLES = {
  first: 'Mag-log ng entry',
  balance: 'Ilagay ang balanse mo',
  budget: 'Gumawa ng budget',
  goal: 'Magsimulang mag-ipon',
} as const;
export const BENEFITS: [string, string, string][] = [
  ['⚡', 'I-type. Tapos na.', 'Ilang segundo lang bawat entry. Naiintindihan ng Zovix ang cash, GCash, Maya at mga bangko mo.'],
  ['🎯', 'Makita kung saan napunta', 'Gastos kada category, buwan-buwan, para alam mo kung ano ang babawasan at ano ang itatabi.'],
  ['🔔', 'Budget na nagpapaalala', 'Maglagay ng limit kada category at tingnan kung magkano na lang ang natitira bago maubos.'],
  ['🏆', 'Goals na napupuno', 'Mag-ipon para sa bagong phone o bakasyon. Gumagalaw ang bar sa bawat pisong itinabi mo.'],
  ['🔥', 'Streaks at quests', 'Daily at weekly quests, XP at levels, para maging ugali ang pagta-track at hindi gawain lang.'],
  ['🔒', 'Pribado at libre', 'Ikaw lang ang makakakita ng data mo. Walang ads, walang tracking, at hindi ibinebenta ang impormasyon mo.'],
];
export const LEVELS: [string, string][] = [
  ['🪙', 'Broke Rookie'],
  ['🐷', 'Peso Pincher'],
  ['🎒', 'Budget Buddy'],
  ['⚔️', 'Wallet Warrior'],
  ['👑', 'Money Master'],
];
export const QUESTS = ['Log your first peso', 'Triple tap: log three entries in a day', 'Stay in budget', '5 of 7 days', '7-day streak'];
export const PRIVACY: string[] = [
  'Ikaw lang ang makakakita ng pera mo. Naka-lock sa may-ari ang bawat account sa mismong database.',
  'Walang ads, walang tracking o analytics, at hindi ibinebenta o ibinabahagi ang data mo.',
  'Hindi kumokonekta ang Zovix sa bangko mo at hindi humihingi ng bank login.',
  'Walang access sa contacts, camera, microphone o location mo.',
  'Pwede mong burahin ang account mo at lahat ng laman nito kahit kailan.',
];
export const FAQ: [string, string][] = [
  ['Libre ba talaga ang Zovix?', 'Oo. Libre, walang ads, at walang bayad na bersyon.'],
  [
    'Paano mag-install sa Android?',
    'I-tap ang "Get Zovix free" at buksan ang file pagkatapos mag-download. Kung magtanong ang Android, payagan ang installs mula sa browser mo, tapos tap ang Install. Buksan ang Zovix at mag-sign in.',
  ],
  [
    'May iPhone version ba?',
    'Wala pa. Sa iPhone, buksan ang page na ito sa Safari, tap ang Share, tapos Add to Home Screen. Kailangan ng bayad na developer program ng Apple para sa buong iPhone app, kaya mamaya pa.',
  ],
  ['Kumokonekta ba ito sa bangko ko?', 'Hindi. Ikaw ang nagta-type ng entries mo, kaya walang naka-link sa bangko o e-wallet mo.'],
  [
    'Ano ang nangyayari sa data ko?',
    'Ligtas itong naka-store, ikaw lang ang makakakita, at hindi ibinebenta. Basahin ang buong privacy policy sa taas.',
  ],
  [
    'Bakit may warning ang Android sa file?',
    'Normal iyon sa mga app na na-install sa labas ng Play Store. Karaniwan itong lumalabas sa file na ikaw mismo ang nag-download.',
  ],
];
export const PAIN: [string, string, string][] = [
  ['😵', '"Saan napunta ang sweldo ko?"', 'Sumahod ka noong 15th, ubos na pagdating ng 20th, at hindi mo alam kung saan nagpunta.'],
  [
    '📝',
    'Naaabandona ang Notes at sheets',
    'Ang daming hakbang, kaya titigil ka rin sa isang linggo. Sa Zovix, isang linya lang kada entry.',
  ],
  ['🙈', 'Hindi pagtingin ≠ pag-iipon', 'Kapag nakita mo na, iba na ang paggastos mo. Budgets at goals na ang magpapaalala sa iyo.'],
];
export const COMPARE: [string, string, string][] = [
  ['Pag-log ng gastos', 'Buksan ang file, hanapin ang row, i-format', 'Isang linya lang: lunch 150 gcash'],
  ['Categories', 'Ikaw ang mag-aayos ng bawat entry', 'Zovix na ang pipili base sa tina-type mo'],
  ['Balanse', 'Ikaw ang magkukuwenta nang mano-mano', 'Automatic sa bawat wallet'],
  ['Budget at goals', 'Gumawa ka muna ng formulas', 'Built-in, may bar na napupuno'],
  ['Pagiging consistent', 'Madaling sukuan', 'Streaks, quests at levels para bumalik ka'],
];
export const WHO: string[] = ['Estudyanteng may baon', 'First-jobber', 'Freelancer', 'May sideline', 'Lahat ng may GCash at cash'];
export const FAQ_MORE: [string, string][] = [
  [
    'Pwede ko bang subukan bago mag-install?',
    'Pwede. Yung sample sa taas ng page na ito ay ang totoong app na tumatakbo sa sample na pera. Walang sine-save sa tina-type mo.',
  ],
  [
    'Kailangan ko ba ng account?',
    'Mag-sign in ka lang nang isang beses gamit ang Google o email code, para ligtas at sa iyo lang ang entries mo. Walang password na kakabisaduhin.',
  ],
  [
    'Paano kung mawala o magpalit ako ng phone?',
    'Nasa account mo ang entries, hindi sa phone. I-install lang ang Zovix sa bago, mag-sign in, at nandoon na lahat.',
  ],
];
export const SITE_NAME = 'Zovix Pera Tracker';
export const TAGLINE = 'Type what you spent. Zovix does the rest.';
