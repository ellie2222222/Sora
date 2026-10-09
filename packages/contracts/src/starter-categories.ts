/**
 * The category tree a new wallet is seeded with (§5.1), grouped by type.
 *
 * Names must be unique across types, not just within one: `uq_category_name_per_parent`
 * is unique over (wallet_id, parent, LOWER(name)) and does **not** include `type`, which
 * is why the catch-alls are "Other Expense" and "Other Income" rather than two "Other"s.
 *
 * Shared between the server (`auth.service.ts`'s `seedWallet`) and the mobile
 * app's guest-mode local seed, so both produce an identical starting wallet.
 *
 * `names` is the single source of each starter category's translations. The
 * `category_translations` rows in `db/migrations/001_schema.sql` mirror it, and
 * `scripts/check-contract-parity.mjs` fails when the two disagree.
 */

import type { CategoryType, Locale } from './enums.ts';

export interface StarterCategory {
  /** Stable identity across wallets and locales, stored as `categories.system_key`. */
  key: string;
  /** `names.en` is also what the category row stores, so uniqueness and the fallback stay English. */
  names: Readonly<Record<Locale, string>>;
  type: CategoryType;
  icon: string;
  color: string;
}

export const STARTER_CATEGORIES: readonly StarterCategory[] = [
  { key: 'food', names: { en: 'Food', vi: 'Ăn uống', de: 'Essen', es: 'Comida', fr: 'Alimentation', hi: 'खाना-पीना', ja: '食費', ko: '식비', ru: 'Еда', zh: '餐饮' }, type: 'EXPENSE', icon: 'utensils', color: '#F97316' },
  { key: 'transportation', names: { en: 'Transportation', vi: 'Đi lại', de: 'Mobilität', es: 'Transporte', fr: 'Transports', hi: 'आना-जाना', ja: '交通費', ko: '교통', ru: 'Транспорт', zh: '交通' }, type: 'EXPENSE', icon: 'bus', color: '#0EA5E9' },
  { key: 'shopping', names: { en: 'Shopping', vi: 'Mua sắm', de: 'Shopping', es: 'Compras', fr: 'Shopping', hi: 'खरीदारी', ja: '買い物', ko: '쇼핑', ru: 'Покупки', zh: '购物' }, type: 'EXPENSE', icon: 'shopping-bag', color: '#A855F7' },
  { key: 'bills', names: { en: 'Bills', vi: 'Hóa đơn', de: 'Rechnungen', es: 'Facturas', fr: 'Factures', hi: 'बिल', ja: '各種支払い', ko: '공과금', ru: 'Счета и платежи', zh: '账单' }, type: 'EXPENSE', icon: 'receipt', color: '#EF4444' },
  { key: 'housing', names: { en: 'Housing', vi: 'Nhà ở', de: 'Wohnen', es: 'Vivienda', fr: 'Logement', hi: 'घर', ja: '住居費', ko: '주거', ru: 'Жильё', zh: '住房' }, type: 'EXPENSE', icon: 'home', color: '#8B5CF6' },
  { key: 'groceries', names: { en: 'Groceries', vi: 'Đi chợ', de: 'Lebensmittel', es: 'Supermercado', fr: 'Courses', hi: 'किराना', ja: '食料品', ko: '장보기', ru: 'Продукты', zh: '买菜' }, type: 'EXPENSE', icon: 'shopping-cart', color: '#F59E0B' },
  { key: 'health', names: { en: 'Health', vi: 'Sức khỏe', de: 'Gesundheit', es: 'Salud', fr: 'Santé', hi: 'स्वास्थ्य', ja: '医療・健康', ko: '건강', ru: 'Здоровье', zh: '医疗健康' }, type: 'EXPENSE', icon: 'heart-pulse', color: '#F43F5E' },
  { key: 'entertainment', names: { en: 'Entertainment', vi: 'Giải trí', de: 'Unterhaltung', es: 'Entretenimiento', fr: 'Loisirs', hi: 'मनोरंजन', ja: '娯楽', ko: '여가', ru: 'Развлечения', zh: '娱乐' }, type: 'EXPENSE', icon: 'film', color: '#EC4899' },
  { key: 'education', names: { en: 'Education', vi: 'Giáo dục', de: 'Bildung', es: 'Educación', fr: 'Éducation', hi: 'शिक्षा', ja: '教育', ko: '교육', ru: 'Образование', zh: '教育' }, type: 'EXPENSE', icon: 'graduation-cap', color: '#6366F1' },
  { key: 'travel', names: { en: 'Travel', vi: 'Du lịch', de: 'Reisen', es: 'Viajes', fr: 'Voyages', hi: 'यात्रा', ja: '旅行', ko: '여행', ru: 'Путешествия', zh: '旅行' }, type: 'EXPENSE', icon: 'plane', color: '#14B8A6' },
  { key: 'subscriptions', names: { en: 'Subscriptions', vi: 'Gói đăng ký', de: 'Abos', es: 'Suscripciones', fr: 'Abonnements', hi: 'सब्सक्रिप्शन', ja: 'サブスク', ko: '구독', ru: 'Подписки', zh: '订阅服务' }, type: 'EXPENSE', icon: 'repeat', color: '#8B5A2B' },
  { key: 'insurance', names: { en: 'Insurance', vi: 'Bảo hiểm', de: 'Versicherungen', es: 'Seguros', fr: 'Assurances', hi: 'बीमा', ja: '保険', ko: '보험', ru: 'Страхование', zh: '保险' }, type: 'EXPENSE', icon: 'shield', color: '#475569' },
  { key: 'dining_out', names: { en: 'Dining Out', vi: 'Ăn ngoài', de: 'Auswärts essen', es: 'Restaurantes', fr: 'Restaurants', hi: 'बाहर खाना', ja: '外食', ko: '외식', ru: 'Кафе и рестораны', zh: '外出就餐' }, type: 'EXPENSE', icon: 'coffee', color: '#D97706' },
  { key: 'utilities', names: { en: 'Utilities', vi: 'Điện nước', de: 'Nebenkosten', es: 'Servicios básicos', fr: 'Énergie et eau', hi: 'बिजली-पानी', ja: '光熱費', ko: '전기·수도·가스', ru: 'Коммунальные услуги', zh: '水电燃气' }, type: 'EXPENSE', icon: 'zap', color: '#CA8A04' },
  { key: 'personal_care', names: { en: 'Personal Care', vi: 'Chăm sóc cá nhân', de: 'Körperpflege', es: 'Cuidado personal', fr: 'Soins personnels', hi: 'पर्सनल केयर', ja: '美容・身だしなみ', ko: '미용·관리', ru: 'Уход за собой', zh: '个人护理' }, type: 'EXPENSE', icon: 'sparkles', color: '#DB2777' },
  { key: 'fitness', names: { en: 'Fitness', vi: 'Thể thao', de: 'Fitness', es: 'Deporte', fr: 'Sport', hi: 'फ़िटनेस', ja: 'フィットネス', ko: '운동', ru: 'Спорт', zh: '健身' }, type: 'EXPENSE', icon: 'dumbbell', color: '#0D9488' },
  { key: 'pets', names: { en: 'Pets', vi: 'Thú cưng', de: 'Haustiere', es: 'Mascotas', fr: 'Animaux', hi: 'पालतू जानवर', ja: 'ペット', ko: '반려동물', ru: 'Питомцы', zh: '宠物' }, type: 'EXPENSE', icon: 'paw-print', color: '#B45309' },
  { key: 'repairs_maintenance', names: { en: 'Repairs & Maintenance', vi: 'Sửa chữa & bảo dưỡng', de: 'Reparatur & Wartung', es: 'Reparaciones y mantenimiento', fr: 'Réparations et entretien', hi: 'मरम्मत और रखरखाव', ja: '修理・メンテナンス', ko: '수리·유지보수', ru: 'Ремонт и обслуживание', zh: '维修保养' }, type: 'EXPENSE', icon: 'wrench', color: '#57534E' },
  { key: 'movies', names: { en: 'Movies', vi: 'Xem phim', de: 'Kino', es: 'Cine', fr: 'Cinéma', hi: 'फ़िल्में', ja: '映画', ko: '영화', ru: 'Кино', zh: '电影' }, type: 'EXPENSE', icon: 'clapperboard', color: '#BE185D' },
  { key: 'snacks', names: { en: 'Snacks', vi: 'Ăn vặt', de: 'Snacks', es: 'Antojos', fr: 'Grignotages', hi: 'नाश्ता', ja: 'おやつ', ko: '간식', ru: 'Перекусы', zh: '零食' }, type: 'EXPENSE', icon: 'cookie', color: '#C2410C' },
  { key: 'drinks', names: { en: 'Drinks', vi: 'Đồ uống', de: 'Getränke', es: 'Bebidas', fr: 'Boissons', hi: 'पेय', ja: '飲み物', ko: '음료', ru: 'Напитки', zh: '饮品' }, type: 'EXPENSE', icon: 'cup-soda', color: '#0891B2' },
  { key: 'fees', names: { en: 'Fees', vi: 'Phí', de: 'Gebühren', es: 'Comisiones', fr: 'Frais', hi: 'शुल्क', ja: '手数料', ko: '수수료', ru: 'Комиссии', zh: '手续费' }, type: 'EXPENSE', icon: 'credit-card', color: '#7C3AED' },
  { key: 'other_expense', names: { en: 'Other Expense', vi: 'Chi khác', de: 'Sonstige Ausgaben', es: 'Otros gastos', fr: 'Autres dépenses', hi: 'अन्य खर्च', ja: 'その他の支出', ko: '기타 지출', ru: 'Прочие расходы', zh: '其他支出' }, type: 'EXPENSE', icon: 'circle-ellipsis', color: '#64748B' },
  { key: 'salary', names: { en: 'Salary', vi: 'Lương', de: 'Gehalt', es: 'Salario', fr: 'Salaire', hi: 'वेतन', ja: '給与', ko: '급여', ru: 'Зарплата', zh: '工资' }, type: 'INCOME', icon: 'banknote', color: '#22C55E' },
  { key: 'freelance', names: { en: 'Freelance', vi: 'Làm tự do', de: 'Freiberuflich', es: 'Trabajo independiente', fr: 'Freelance', hi: 'फ़्रीलांस', ja: 'フリーランス', ko: '프리랜서', ru: 'Фриланс', zh: '自由职业' }, type: 'INCOME', icon: 'briefcase', color: '#10B981' },
  { key: 'investment', names: { en: 'Investment', vi: 'Đầu tư', de: 'Kapitalerträge', es: 'Inversiones', fr: 'Investissements', hi: 'निवेश', ja: '投資', ko: '투자', ru: 'Инвестиции', zh: '投资' }, type: 'INCOME', icon: 'trending-up', color: '#059669' },
  { key: 'gift', names: { en: 'Gift', vi: 'Quà tặng', de: 'Geschenke', es: 'Regalos', fr: 'Cadeaux', hi: 'उपहार', ja: '贈与', ko: '선물', ru: 'Подарки', zh: '礼金' }, type: 'INCOME', icon: 'gift', color: '#84CC16' },
  { key: 'rental_income', names: { en: 'Rental Income', vi: 'Cho thuê', de: 'Mieteinnahmen', es: 'Ingresos por alquiler', fr: 'Revenus locatifs', hi: 'किराये से आय', ja: '家賃収入', ko: '임대 수입', ru: 'Доход от аренды', zh: '租金收入' }, type: 'INCOME', icon: 'building-2', color: '#16A34A' },
  { key: 'interest', names: { en: 'Interest', vi: 'Tiền lãi', de: 'Zinsen', es: 'Intereses', fr: 'Intérêts', hi: 'ब्याज', ja: '利息', ko: '이자', ru: 'Проценты', zh: '利息' }, type: 'INCOME', icon: 'percent', color: '#15803D' },
  { key: 'bonus', names: { en: 'Bonus', vi: 'Thưởng', de: 'Bonus', es: 'Bonificación', fr: 'Primes', hi: 'बोनस', ja: '賞与', ko: '보너스', ru: 'Премия', zh: '奖金' }, type: 'INCOME', icon: 'award', color: '#65A30D' },
  { key: 'refund', names: { en: 'Refund', vi: 'Hoàn tiền', de: 'Erstattung', es: 'Reembolsos', fr: 'Remboursements', hi: 'रिफ़ंड', ja: '返金', ko: '환불', ru: 'Возврат средств', zh: '退款' }, type: 'INCOME', icon: 'undo-2', color: '#4D7C0F' },
  { key: 'part_time', names: { en: 'Part Time', vi: 'Làm thêm', de: 'Nebenjob', es: 'Medio tiempo', fr: 'Temps partiel', hi: 'पार्ट-टाइम', ja: 'アルバイト', ko: '아르바이트', ru: 'Подработка', zh: '兼职' }, type: 'INCOME', icon: 'clock', color: '#0D9488' },
  { key: 'other_income', names: { en: 'Other Income', vi: 'Thu khác', de: 'Sonstige Einnahmen', es: 'Otros ingresos', fr: 'Autres revenus', hi: 'अन्य आय', ja: 'その他の収入', ko: '기타 수입', ru: 'Прочие доходы', zh: '其他收入' }, type: 'INCOME', icon: 'hand-coins', color: '#A16207' },
  { key: 'savings', names: { en: 'Savings', vi: 'Tiết kiệm', de: 'Sparen', es: 'Ahorro', fr: 'Épargne', hi: 'बचत', ja: '貯金', ko: '저축', ru: 'Накопления', zh: '储蓄' }, type: 'TRANSFER', icon: 'piggy-bank', color: '#0EA5E9' },
  { key: 'debt_repayment', names: { en: 'Debt Repayment', vi: 'Trả nợ', de: 'Schuldentilgung', es: 'Pago de deudas', fr: 'Remboursement de dette', hi: 'कर्ज़ चुकाना', ja: '借入金の返済', ko: '빚 상환', ru: 'Погашение долга', zh: '还债' }, type: 'TRANSFER', icon: 'handshake', color: '#6366F1' },
  { key: 'credit_card_payment', names: { en: 'Credit Card Payment', vi: 'Thanh toán thẻ tín dụng', de: 'Kreditkartenzahlung', es: 'Pago de tarjeta de crédito', fr: 'Paiement carte de crédit', hi: 'क्रेडिट कार्ड भुगतान', ja: 'クレジットカード支払い', ko: '카드 대금 결제', ru: 'Оплата кредитной карты', zh: '信用卡还款' }, type: 'TRANSFER', icon: 'credit-card', color: '#64748B' },
  { key: 'top_up', names: { en: 'Top Up', vi: 'Nạp tiền', de: 'Aufladung', es: 'Recarga', fr: 'Rechargement', hi: 'टॉप-अप', ja: 'チャージ', ko: '충전', ru: 'Пополнение', zh: '充值' }, type: 'TRANSFER', icon: 'wallet', color: '#14B8A6' },
  { key: 'cash_withdrawal', names: { en: 'Cash Withdrawal', vi: 'Rút tiền mặt', de: 'Bargeldabhebung', es: 'Retiro de efectivo', fr: 'Retrait d’espèces', hi: 'नकद निकासी', ja: '現金引き出し', ko: '현금 인출', ru: 'Снятие наличных', zh: '取现' }, type: 'TRANSFER', icon: 'landmark', color: '#78716C' },
];

const STARTER_WALLET_NAME: Readonly<Record<Locale, (name: string) => string>> = {
  en: (name) => `${name}'s Wallet`,
  vi: (name) => `Ví của ${name}`,
  de: (name) => `Geldbörse von ${name}`,
  es: (name) => `Cartera de ${name}`,
  fr: (name) => `Portefeuille de ${name}`,
  hi: (name) => `${name} का वॉलेट`,
  ja: (name) => `${name}のウォレット`,
  ko: (name) => `${name}의 지갑`,
  ru: (name) => `Кошелёк ${name}`,
  zh: (name) => `${name}的钱包`,
};

/** The default wallet a new account gets, named in the language chosen at sign-up (API spec §5.1). */
export function starterWalletName(displayName: string, locale: Locale): string {
  return STARTER_WALLET_NAME[locale](displayName);
}

/** The default CASH account seeded into a new wallet. */
export const STARTER_CASH_ACCOUNT_NAME: Readonly<Record<Locale, string>> = {
  en: 'Cash',
  vi: 'Tiền mặt',
  de: 'Bargeld',
  es: 'Efectivo',
  fr: 'Espèces',
  hi: 'नकद',
  ja: '現金',
  ko: '현금',
  ru: 'Наличные',
  zh: '现金',
};

const STARTER_BY_KEY = new Map(STARTER_CATEGORIES.map((category) => [category.key, category]));

/**
 * The name a category shows in `locale`: a starter category's translation, falling back to
 * English, or a custom category's own text exactly as its author typed it.
 */
export function localizedCategoryName(category: { name: string; systemKey: string | null }, locale: Locale): string {
  if (category.systemKey === null) return category.name;
  const starter = STARTER_BY_KEY.get(category.systemKey);
  return starter?.names[locale] ?? starter?.names.en ?? category.name;
}
