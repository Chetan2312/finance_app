// ══════════════════════════════════════
// DEFAULTS — constants, icons, default sections/categories
// ══════════════════════════════════════

export const DICONS = { home: '🏠', vehicle: '🚗', personal: '💰', credit: '💳', education: '📚', other: '🏦' };

export const COLS = ['#7c73e6', '#fb7185', '#2dd4bf', '#f59e0b', '#38bdf8', '#fb923c', '#a78bfa', '#34d399', '#e879f9', '#4ade80'];

export const EMOJIS = ['🏠', '🚗', '🍔', '✈️', '🎬', '💊', '🐾', '📚', '🎁', '🎮', '💡', '🧹', '📱', '🏋️', '🛍️', '☕', '🎵', '🌿', '👗', '💸', '🏦', '🎓', '🔧', '🛒', '👶', '🐕', '🎨', '⚡', '🍕', '🎯', '🍱', '🥤', '🧁', '🛺', '🚂', '🎪', '⚽', '🏥', '🎭', '🧘'];

export const RISK_LVL = { large: 2, index: 2, hybrid: 2, flexi: 3, elss: 3, mid: 4, small: 5, debt: 1 };

export const CAT_ICO = { large: '🏢', index: '📉', hybrid: '⚖️', flexi: '🔄', elss: '💰', mid: '📊', small: '🚀', debt: '🛡️' };

export const MS_COLS = { debt: 'var(--p)', save: 'var(--amber)', invest: 'var(--amber)', emergency: 'var(--sky)', closure: 'var(--danger)', freedom: 'var(--ok)' };

export const DEF_DCATS = [
  { id: 'dc1', name: 'Morning', icon: '☕', color: '#f59e0b' },
  { id: 'dc2', name: 'Lunch', icon: '🍱', color: '#fb923c' },
  { id: 'dc3', name: 'Dinner', icon: '🍽️', color: '#fb7185' },
  { id: 'dc4', name: 'Commute', icon: '🚗', color: '#38bdf8' },
  { id: 'dc5', name: 'Grocery', icon: '🛒', color: '#34d399' },
  { id: 'dc6', name: 'Snacks', icon: '🥤', color: '#a78bfa' },
  { id: 'dc7', name: 'Medical', icon: '💊', color: '#2dd4bf' },
  { id: 'dc8', name: 'Entertainment', icon: '🎬', color: '#e879f9' },
  { id: 'dc9', name: 'Shopping', icon: '🛍️', color: '#7c73e6' },
  { id: 'dc10', name: 'Miscellaneous', icon: '💸', color: '#94a3b8' },
];

export const DEF_SECS = [
  { id: 'housing', name: 'Housing & Utilities', icon: '🏠', color: '#7c73e6', isEmi: false, isCustom: false, items: [{ id: 'rent', label: 'Rent/EMI', val: 0 }, { id: 'elec', label: 'Electricity', val: 0 }, { id: 'gas', label: 'Gas/LPG', val: 0 }, { id: 'water', label: 'Water', val: 0 }, { id: 'inet', label: 'Internet/DTH', val: 0 }, { id: 'mob', label: 'Mobile', val: 0 }, { id: 'maid', label: 'Maid/Help', val: 0 }, { id: 'maint', label: 'Maintenance', val: 0 }, { id: 'soc', label: 'Society Charges', val: 0 }] },
  { id: 'transport', name: 'Transport & Travel', icon: '🚗', color: '#38bdf8', isEmi: false, isCustom: false, items: [{ id: 'petrol', label: 'Petrol/CNG', val: 0 }, { id: 'metro', label: 'Metro/Bus', val: 0 }, { id: 'cab', label: 'Ola/Uber/Auto', val: 0 }, { id: 'vsvc', label: 'Vehicle Service', val: 0 }, { id: 'vins', label: 'Vehicle Insurance', val: 0 }, { id: 'travel', label: 'Travel/Holidays', val: 0 }] },
  { id: 'food', name: 'Food & Dining', icon: '🍽️', color: '#f59e0b', isEmi: false, isCustom: false, items: [{ id: 'groc', label: 'Groceries', val: 0 }, { id: 'del', label: 'Swiggy/Zomato', val: 0 }, { id: 'din', label: 'Restaurant/Dates', val: 0 }, { id: 'cafe', label: 'Cafes/Tea', val: 0 }, { id: 'frnd', label: 'Friends Outings', val: 0 }, { id: 'fam', label: 'Family Outings', val: 0 }] },
  { id: 'family', name: 'Family & Children', icon: '👨‍👩‍👧', color: '#fb923c', isEmi: false, isCustom: false, items: [{ id: 'school', label: 'School Fees', val: 0 }, { id: 'tuit', label: 'Tuition', val: 0 }, { id: 'cact', label: 'Child Activities', val: 0 }, { id: 'day', label: 'Daycare', val: 0 }, { id: 'csup', label: 'Child Supplies', val: 0 }, { id: 'par', label: 'Parents Support', val: 0 }] },
  { id: 'health', name: 'Health & Personal', icon: '💊', color: '#2dd4bf', isEmi: false, isCustom: false, items: [{ id: 'doc', label: 'Doctor/Hospital', val: 0 }, { id: 'meds', label: 'Medicines', val: 0 }, { id: 'gym', label: 'Gym/Fitness', val: 0 }, { id: 'groom', label: 'Salon/Grooming', val: 0 }, { id: 'hins', label: 'Health Insurance', val: 0 }, { id: 'well', label: 'Wellness/Spa', val: 0 }] },
  { id: 'lifestyle', name: 'Lifestyle & Subscriptions', icon: '🎬', color: '#fb7185', isEmi: false, isCustom: false, items: [{ id: 'ott', label: 'OTT Apps', val: 0 }, { id: 'game', label: 'Gaming/Apps', val: 0 }, { id: 'cloth', label: 'Clothing', val: 0 }, { id: 'gift', label: 'Gifts/Festivals', val: 0 }, { id: 'books', label: 'Books/Courses', val: 0 }, { id: 'pet', label: 'Pet Care', val: 0 }] },
  { id: 'emi', name: 'EMIs & Loan Payments', icon: '📋', color: '#f43f5e', isEmi: true, isCustom: false, items: [] },
];
