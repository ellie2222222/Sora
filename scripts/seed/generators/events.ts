// One-off clusters (plan §5.4) and goal funding (§6.1). Every date is a rule from the anchor (calendar.ts).

import { addDays, addMonths, weekday } from '../calendar.ts';
import { cents, money } from '../ledger.ts';
import type { GoalKey } from '../personas.ts';
import { bankReference, onTrip, type GeneratorContext } from './context.ts';

const JAPAN = [
  ['Ramen Ichiran', 'food'],
  ['Suica top-up', 'transportation'],
  ['7-Eleven', 'food'],
  ['Senso-ji', 'travel'],
  ['Tokyo Metro', 'transportation'],
  ['Sushi lunch', 'food'],
] as const;

export function events(ctx: GeneratorContext): void {
  const { builder: b, rng, dates } = ctx;
  const { tet, sale, japan } = dates;

  // ACB (old): its full balance moves to Vietcombank in history month 2; phase 6 archives it.
  const acbDay = `${addMonths(dates.historyStart, 1).slice(0, 8)}10`;
  b.add({ by: 'an', type: 'TRANSFER', from: 'acb', to: 'vcb', amount: 0n, day: acbDay, time: '10:00', description: 'Đóng tài khoản ACB', reference: bankReference(ctx, acbDay), tag: 'acbClose', dynamic: 'close' });

  // 11.11 / Black Friday / 12.12: a fixed 6,120,000 spike, one item returned and refunded two weeks later.
  b.add({ by: 'an', type: 'EXPENSE', from: 'visa', amount: money(2_490_000), category: 'electronics', day: sale.elevenEleven, time: '00:15', description: 'Tai nghe Sony WH-1000XM5', tag: 'sale' });
  b.add({ by: 'an', type: 'EXPENSE', from: 'visa', amount: money(1_200_000), category: 'shopping', day: sale.elevenEleven, time: '00:20', description: 'Giày Shopee 11.11', tag: 'sale' });
  b.add({ by: 'an', type: 'INCOME', to: 'visa', amount: money(1_200_000), category: 'refund', day: addDays(sale.elevenEleven, 14), time: '14:00', description: 'Hoàn tiền giày trả lại', tag: 'saleRefund' });
  b.add({ by: 'an', type: 'EXPENSE', from: 'visa', amount: money(1_290_000), category: 'electronics', day: sale.blackFriday, time: '21:00', description: 'Bàn phím cơ Black Friday', tag: 'sale' });
  b.add({ by: 'an', type: 'EXPENSE', from: 'visa', amount: money(690_000), category: 'electronics', day: sale.twelveTwelve, time: '00:12', description: 'Chuột Logitech', tag: 'sale' });
  b.add({ by: 'an', type: 'EXPENSE', from: 'visa', amount: money(450_000), category: 'shopping', day: sale.twelveTwelve, time: '00:30', description: 'Áo Uniqlo 12.12', tag: 'sale' });

  // Wedding season: 4–6 envelopes on weekends in Oct–Dec and Mar.
  const weddingDays = ctx.days.filter((day) => [10, 11, 12, 3].includes(Number(day.slice(5, 7))) && (weekday(day) === 6 || weekday(day) === 0) && !onTrip(dates, day));
  const chosen = new Set<string>();
  const envelopes = rng.int(4, 6);
  while (chosen.size < Math.min(envelopes, weddingDays.length)) chosen.add(rng.pick(weddingDays));
  for (const day of [...chosen].sort()) {
    b.add({ by: 'an', type: 'EXPENSE', from: 'cash', amount: money(rng.amount(500_000, 2_000_000, 100_000)), category: 'wedding_gifts', day, time: rng.time('11:00', '18:00'), description: 'Mừng cưới', tag: 'wedding' });
  }

  // Tet: ≈ 13M out, so Food and Monthly Cap are over that month.
  for (let i = 0; i < 4; i++) b.add({ by: 'an', type: 'EXPENSE', from: 'cash', amount: money(rng.amount(500_000, 700_000)), category: 'food', day: addDays(tet, -rng.int(1, 5)), time: rng.time('08:00', '17:00'), description: 'Đồ ăn Tết', tag: 'tet' });
  for (let i = 0; i < 3; i++) b.add({ by: 'an', type: 'EXPENSE', from: 'cash', amount: money(1_000_000), category: 'lucky_money_given', day: addDays(tet, rng.int(0, 3)), time: rng.time('08:00', '20:00'), description: 'Lì xì', tag: 'tet' });
  for (let i = rng.int(2, 4); i > 0; i--) b.add({ by: 'an', type: 'INCOME', to: 'cash', amount: money(rng.amount(200_000, 500_000, 50_000)), category: 'lucky_money', day: addDays(tet, rng.int(0, 2)), time: rng.time('08:00', '20:00'), description: 'Lì xì nhận được', tag: 'tetReceived' });
  for (let i = 0; i < 2; i++) b.add({ by: 'an', type: 'EXPENSE', from: 'vcb', amount: money(1_500_000), category: 'shopping', day: addDays(tet, -rng.int(2, 7)), time: rng.time('10:00', '20:00'), description: 'Quà Tết cho gia đình', tag: 'tet' });
  for (let i = 0; i < 3; i++) b.add({ by: 'an', type: 'EXPENSE', from: 'vcb', amount: money(rng.amount(1_000_000, 1_400_000)), category: 'groceries', day: addDays(tet, -rng.int(1, 9)), time: rng.time('08:00', '11:00'), description: 'Sắm Tết', tag: 'tet' });
  b.add({ by: 'an', type: 'EXPENSE', from: 'vcb', amount: money(500_000), category: 'transportation', day: addDays(tet, -3), time: '09:00', description: 'Vé xe về quê', tag: 'tet' });
  b.add({ by: 'an', type: 'EXPENSE', from: 'vcb', amount: money(500_000), category: 'transportation', day: addDays(tet, 4), time: '09:00', description: 'Vé xe lên lại Sài Gòn', tag: 'tet' });
  // Bao hands Mom cash at Tet; An records it, as Bao is only a VIEWER there.
  b.add({ by: 'an', type: 'INCOME', to: 'mcash', amount: money(1_000_000), category: 'allowance_from_children', day: tet, time: '10:00', description: 'Bảo biếu mẹ', tag: 'momTet' });
  for (let i = 0; i < 2; i++) b.add({ by: 'an', type: 'EXPENSE', from: 'mcash', amount: money(rng.amount(200_000, 500_000, 50_000)), category: 'gifts_for_grandkids', day: addDays(tet, i), time: '10:00', description: 'Lì xì cháu', tag: 'momTet' });

  // Mom's hospital visit.
  b.add({ by: 'an', type: 'EXPENSE', from: 'vcb', amount: money(4_800_000), category: 'family_support', day: dates.hospital, time: '10:00', description: 'Viện phí cho mẹ', reference: bankReference(ctx, dates.hospital), tag: 'hospital' });
  b.add({ by: 'an', type: 'EXPENSE', from: 'mcash', amount: money(rng.amount(600_000, 900_000)), category: 'medicine', day: dates.hospital, time: '11:00', description: 'Thuốc sau khi khám', tag: 'hospital' });

  // Da Lat with Linh: An pays the coach and his meals, Linh the homestay; Settle Up covers An's half.
  const dalat = dates.dalatFriday;
  b.add({ by: 'an', type: 'EXPENSE', from: 'visa', amount: money(1_400_000), category: 'travel', day: addDays(dalat, -10), time: '20:00', description: 'Vé xe giường nằm Đà Lạt', tag: 'dalat' });
  for (let i = rng.int(5, 7); i > 0; i--) b.add({ by: 'an', type: 'EXPENSE', from: 'cash', amount: money(rng.amount(300_000, 600_000)), category: 'travel', day: addDays(dalat, rng.int(0, 2)), time: rng.time('07:00', '21:00'), description: 'Ăn uống Đà Lạt', tag: 'dalat' });
  b.add({ by: 'linh', type: 'EXPENSE', from: 'bidv', amount: money(2_400_000), category: 'travel', day: addDays(dalat, -14), time: '21:00', description: 'Da Lat homestay', tag: 'dalat' });
  b.add({ by: 'an', type: 'TRANSFER', from: 'vcb', to: 'bidv', amount: money(1_200_000), category: 'settle_up', day: addDays(dalat, 3), time: '20:00', description: 'Trả Linh nửa tiền homestay', reference: bankReference(ctx, addDays(dalat, 3)), tag: 'settleUp' });

  b.add({ by: 'an', type: 'EXPENSE', from: 'cash', amount: money(1_350_000), category: 'repairs_maintenance', day: dates.motorbikeService, time: '10:00', description: 'Bảo dưỡng xe máy', tag: 'motorbikeService' });
  b.add({ by: 'an', type: 'INCOME', to: 'cash', amount: money(1_000_000), category: 'gift', day: dates.birthdayGift, time: '19:00', description: 'Quà sinh nhật', tag: 'birthday' });
  for (let i = 0; i < 3; i++) {
    const day = ctx.days[rng.int(30, ctx.days.length - 30)]!;
    if (!onTrip(dates, day)) b.add({ by: 'an', type: 'TRANSFER', from: 'vcb', to: 'momo', amount: money(500_000), day, time: '21:30', description: null, tag: 'uncategorised' });
  }
  // Groceries An logged for Linh, from Linh's own account (a Linh-wallet expense needs a Linh account).
  for (let i = 0; i < 6; i++) {
    const day = ctx.days[rng.int(20, ctx.days.length - 10)]!;
    b.add({ by: 'an', type: 'EXPENSE', from: 'bidv', amount: money(rng.amount(200_000, 600_000)), category: 'groceries', day, time: rng.time('17:00', '19:00'), description: 'Groceries An logged for Linh', tag: 'linhGroceriesByAn' });
  }

  // Japan: prep, then the trip under way at the anchor.
  b.add({ by: 'an', type: 'TRANSFER', from: 'tcb', to: 'vcb', amount: money(30_000_000), category: 'savings', day: japan.transfer, time: '09:00', description: 'Rút tiết kiệm đi Nhật', reference: bankReference(ctx, japan.transfer), tag: 'japanTransfer' });
  b.add({ by: 'an', type: 'EXPENSE', from: 'visa', amount: money(12_800_000), category: 'travel', goal: 'japan', day: japan.flights, time: '21:00', description: 'Vé máy bay Vietnam Airlines SGN–NRT', tag: 'japanFlights' });
  b.add({ by: 'an', type: 'EXPENSE', from: 'visa', amount: money(8_700_000), category: 'travel', goal: 'japan', day: japan.jrPass, time: '21:00', description: 'JR Pass 7 ngày', tag: 'japanJrPass' });
  b.add({ by: 'an', type: 'EXPENSE', from: 'vcb', amount: money(13_900_000), category: 'travel', day: japan.exchange, time: '11:00', description: 'Đổi 80.000 yên', tag: 'japanExchange' });
  for (let day = japan.departs; day <= dates.historyEnd; day = addDays(day, 1)) {
    const total = rng.amount(6_000, 11_000, 10);
    const count = rng.int(3, 5);
    const weights = Array.from({ length: count }, () => 0.5 + rng.next());
    const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
    let left = total;
    for (let i = 0; i < count; i++) {
      const amount = i === count - 1 ? left : Math.max(10, Math.round((total * weights[i]!) / weightSum / 10) * 10);
      left -= amount;
      const [description, category] = JAPAN[rng.int(0, JAPAN.length - 1)]!;
      b.add({ by: 'an', type: 'EXPENSE', from: 'jpy', amount: money(amount), category, day, time: `${String(8 + i * 3).padStart(2, '0')}:${String(rng.int(0, 59)).padStart(2, '0')}`, description, tag: 'japanTrip' });
    }
  }
  b.add({ by: 'an', type: 'EXPENSE', status: 'PENDING', from: 'visa', amount: money(3_000_000), category: 'travel', day: japan.hotelHold, time: '15:00', description: 'Tạm giữ khách sạn Kyoto', tag: 'hotelHold' });
  b.add({ by: 'an', type: 'EXPENSE', status: 'PENDING', from: 'jpy', amount: money(35_000), category: 'travel', day: japan.returns, time: '10:00', description: 'Ryokan, trả khi trả phòng', tag: 'ryokan' });

  // USD: two courses, freelance 2–4 times a quarter (one quarter's last one is a Side Project).
  b.add({ by: 'an', type: 'EXPENSE', from: 'wise', amount: money('49.00'), category: 'education', day: dates.courses[0], time: '21:00', description: 'Udemy course', tag: 'course' });
  b.add({ by: 'an', type: 'EXPENSE', from: 'wise', amount: money('89.00'), category: 'education', day: dates.courses[1], time: '21:00', description: 'Coursera certificate', tag: 'course' });
  for (let quarter = 0; quarter < 5; quarter++) {
    const from = addMonths(dates.historyStart, quarter * 3);
    const to = addDays(addMonths(dates.historyStart, quarter * 3 + 3), -1);
    const candidates = ctx.days.filter((day) => day >= from && day <= to);
    if (candidates.length === 0) continue;
    for (let i = rng.int(2, 4); i > 0; i--) {
      b.add({ by: 'an', type: 'INCOME', to: 'wise', amount: cents(rng.amount(15_000, 60_000, 1)), category: quarter === 1 && i === 1 ? 'side_project' : 'freelance', day: rng.pick(candidates), time: rng.time('09:00', '22:00'), description: rng.maybe('Upwork payout'), tag: 'freelance' });
    }
  }
}

/** Contributions (plan §6.1): earmarks move no money; a transaction-backed one is an EXPENSE row as well. */
export function goalFunding(ctx: GeneratorContext): void {
  const { builder: b, dates } = ctx;
  const { anchor, motorbike } = dates;
  const earmark = (goal: GoalKey, account: 'tcb' | 'wise' | 'bidv', amount: bigint, day: string, by: 'an' | 'linh' = 'an') =>
    b.contribute({ goal, account, amount, day, time: '09:00', by });

  for (let k = 12; k >= 1; k--) {
    earmark('emergency', 'tcb', money(2_750_000), addMonths(anchor, -k));
    earmark('japan', 'tcb', money(2_625_000), addMonths(anchor, -k));
  }
  for (let k = 11; k >= 7; k--) earmark('motorbike', 'tcb', money(4_000_000), addMonths(anchor, -k));
  for (const k of [6, 5]) earmark('guitar', 'tcb', money(800_000), addMonths(anchor, -k));
  for (let k = 5; k >= 2; k--) earmark('laptop', 'tcb', money(1_000_000), addMonths(anchor, -k));
  for (let k = 3; k >= 1; k--) earmark('macbook', 'wise', money('200.00'), addMonths(anchor, -k));
  for (let k = 8; k >= 1; k--) earmark('anniversary', 'bidv', money(1_000_000), addMonths(anchor, -k), k % 2 ? 'linh' : 'an');

  const backed = (goal: GoalKey, from: 'tcb' | 'mcash', amount: bigint, day: string, category: string, description: string, removed = false) => {
    const row = b.add({ by: 'an', type: 'EXPENSE', status: removed ? 'DELETED' : 'COMPLETED', from, amount, category, goal, day, time: '10:00', description, tag: removed ? 'contributionRemoved' : 'contributionBacked', contribution: goal });
    b.contribute({ goal, account: from, amount, day, time: '10:00', by: 'an', row: row.id, removed });
  };
  backed('motorbike', 'tcb', money(6_000_000), motorbike.firstPayment, 'transportation', 'Đặt cọc xe máy');
  backed('motorbike', 'tcb', money(2_000_000), motorbike.removedPayment, 'transportation', 'Phụ kiện xe (nhập nhầm)', true);
  backed('motorbike', 'tcb', money(9_700_000), motorbike.finalPayment, 'transportation', 'Thanh toán xe máy');
  for (let k = 4; k >= 1; k--) backed('health', 'mcash', money(975_000), addMonths(anchor, -k), 'medicine', 'Gói khám sức khỏe');
}
