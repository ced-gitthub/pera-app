// Words for the landing page: mostly English, with Tagalog words dropped in the way Filipinos actually talk about money (Taglish, not pure Tagalog).
// Worked samples come from onboardingCopy so the website and the app teach the same examples.
export const NAV: [string, string][] = [
  ['#try', 'Demo'],
  ['#about', 'About'],
  ['#how', 'How it works'],
  ['#features', 'Features'],
  ['#privacy', 'Privacy'],
  ['#faq', 'FAQ'],
  ['#install', 'Install'],
];
export const H = {
  pain: 'Sound familiar?',
  about: 'Your pesos, finally klaro',
  how: 'How it works',
  samples: 'Try it in your head',
  samplesLead: 'Four things you do in your first minute, and what Zovix does with each.',
  does: 'What Zovix does',
  cmp: 'Why not just Notes or a spreadsheet?',
  features: 'What you get',
  levels: 'Level up habang nagta-track',
  who: 'Who it is for',
  privacy: 'Private ang pera mo',
  faq: 'May tanong ka?',
  install: 'Install in 3 taps',
  final: 'May plano na ang susunod mong piso.',
} as const;
export const WHAT: [string, string][] = [
  ['What it is', 'A free money tracker for Pinoys. Type your gastos or kita like a text message, and Zovix keeps the tala.'],
  [
    'How it helps',
    'You always know how much ang laman ng bawat wallet, saan napunta ang pera mo this month, and whether you are still inside your budget.',
  ],
  ['What you gain', 'Fewer "saan napunta?" moments, a goal that fills up as you ipon, and a streak that builds the habit.'],
];
export const HOW: [string, string, string][] = [
  ['1', 'Type it', 'Write "lunch 150 gcash". No forms, no spreadsheets, no bank login.'],
  ['2', 'Zovix sorts it', 'Amount, category and account are filled in for you, tapos nag-a-update ang balance mo.'],
  ['3', 'Watch it grow', 'Budgets, goals, reports and quests show your progress. Bawat entry may XP.'],
];
export const SAMPLE_TITLES = {
  first: 'Log an entry',
  balance: 'Set your balances',
  budget: 'Make a budget',
  goal: 'Start a savings goal',
} as const;
export const BENEFITS: [string, string, string][] = [
  ['⚡', 'Type it. Done.', 'Seconds lang per entry. Zovix understands cash, GCash, Maya and your banks.'],
  ['🎯', 'See where it goes', 'Gastos per category, month by month, so you know what to cut and what to keep.'],
  ['🔔', 'Budgets that nudge', 'Set a monthly limit per category and see how much ang natitira bago maubos.'],
  ['🏆', 'Goals that fill up', 'Mag-ipon for a new phone or a trip. The bar moves with every peso you set aside.'],
  ['🔥', 'Streaks and quests', 'Daily and weekly quests, XP and levels make tracking a habit, hindi chore.'],
  ['🔒', 'Private and free', 'Ikaw lang ang makakakita ng data mo. No ads, no tracking tools, never sold.'],
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
  'Only you can see your money. Naka-lock sa owner ang bawat account sa mismong database.',
  'No ads, no tracking or analytics tools, and your data is never sold or shared.',
  'Zovix never connects to your bank and never asks for your bank login.',
  'No access to your contacts, camera, microphone or location.',
  'You can delete your account and everything in it anytime.',
];
export const FAQ: [string, string][] = [
  ['Is Zovix really free?', 'Yes. Libre, no ads, and no paid tier.'],
  [
    'How do I install it on Android?',
    'Tap "Get Zovix free" and open the file when it finishes. If Android asks, allow installs from your browser, then tap Install. Open Zovix and sign in.',
  ],
  [
    'Is there an iPhone version?',
    'Not yet. On iPhone, open this page in Safari, tap Share, then Add to Home Screen. A full iPhone app needs Apple’s paid developer program, kaya mamaya pa.',
  ],
  ['Does it connect to my bank?', 'No. You type your entries yourself, so walang naka-link sa bank or e-wallet mo.'],
  ['What happens to my data?', 'It is stored securely, visible only to you, and never sold. Read the full privacy policy above.'],
  [
    'Why does Android warn me about the file?',
    'Apps installed outside the Play Store show that warning. Normal lang ito for a file you downloaded yourself.',
  ],
];
export const PAIN: [string, string, string][] = [
  ['😵', '"Saan napunta ang sweldo ko?"', 'Paid on the 15th, broke by the 20th, and no idea where it went.'],
  ['📝', 'Notes and sheets get abandoned', 'Too many steps, so you quit in a week. Zovix is one line per entry.'],
  ['🙈', 'Not looking is not saving', 'Once you can see it, iba na ang gastos mo. Budgets and goals do the nagging for you.'],
];
export const COMPARE: [string, string, string][] = [
  ['Logging a purchase', 'Open the file, find the row, format it', 'One line lang: lunch 150 gcash'],
  ['Categories', 'You sort every entry yourself', 'Zovix picks it from the words you type'],
  ['Balances', 'Kuwentahin mo nang mano-mano', 'Automatic for every wallet'],
  ['Budgets and goals', 'Build the formulas first', 'Built in, may bar na napupuno'],
  ['Sticking with it', 'Madaling sukuan', 'Streaks, quests and levels keep you coming back'],
];
export const WHO: string[] = ['Students na may baon', 'First-jobbers', 'Freelancers', 'May sideline', 'Anyone with GCash and cash'];
export const FAQ_MORE: [string, string][] = [
  [
    'Can I try it before installing?',
    'Yes. The sample at the top of this page is the real thing running on sample money. Walang sine-save sa tina-type mo.',
  ],
  ['Do I need an account?', 'You sign in once, with Google or an email code, so your entries stay yours. No password to remember.'],
  [
    'What if mawala o magpalit ako ng phone?',
    'Your entries live in your account, not on the phone. Install Zovix on the new one, sign in, and nandoon na lahat.',
  ],
];
export const SITE_NAME = 'Zovix Pera Tracker';
export const TAGLINE = 'Type what you spent. Zovix does the rest.';
