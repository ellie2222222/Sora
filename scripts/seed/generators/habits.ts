// Everyday spending (plan §5.3, §5.5): probabilities per day, wall-clock windows, log-normal amounts.

import { addDays, daylightSavingDays, lunarOfferingDays, weekday } from '../calendar.ts';
import { cents, money } from '../ledger.ts';
import { WALLETS } from '../personas.ts';
import { historyMonth, onTrip, type GeneratorContext } from './context.ts';

const COFFEE = ['Highlands Coffee', 'The Coffee House', 'Phúc Long', 'Cộng Cà Phê', 'Katinat'];
const BREAKFAST = ['Bánh mì', 'Xôi gà', 'Phở Hòa Pasteur', 'Bún bò Huế', 'Hủ tiếu'];
const LUNCH = ['Cơm tấm', 'Bún chả', 'Cơm văn phòng', 'Phở Hòa Pasteur', 'Bún thịt nướng', 'Mì Quảng'];
const GRAB = ['Grab đi làm', 'Grab về nhà', 'GrabBike'];
const GROCERIES = ['Co.opmart', 'Bách Hóa Xanh', 'WinMart', 'Lotte Mart'];
const DINING = ['Lẩu Thái', 'Pizza 4P’s', 'Gogi House', 'Ốc Oanh', 'Nhà hàng Ngon'];
const SNACKS = ['Trà sữa', 'Bánh tráng trộn', 'Nước mía', 'Chè'];
const SHOPPING = ['Shopee', 'Lazada', 'Tiki', 'Uniqlo'];
const LINH_FOOD = ['Banh mi', 'Lunch with colleagues', 'Pho', 'Rice box'];
const LINH_DINING = ['Dinner out', 'Hotpot', 'Sushi', 'Coffee'];

export function habits(ctx: GeneratorContext): void {
  const { builder: b, rng, dates } = ctx;
  const offeringDays = lunarOfferingDays(dates.historyStart, dates.historyEnd);
  const dstDays = new Set(daylightSavingDays(dates.historyStart, dates.historyEnd, WALLETS.bao.timeZone));
  let nextFuel = addDays(dates.historyStart, rng.int(0, 8));
  let nextCatFood = addDays(dates.historyStart, rng.int(0, 20));
  let baoCoffeesThisMonth: string[] = [];
  const kittyFunded = addDays(dates.historyStart, 2);

  for (const day of ctx.days) {
    const dow = weekday(day);
    const weekdayWork = dow >= 1 && dow <= 5;
    const date = Number(day.slice(8, 10));

    // ---- An, paused while he's in Japan (A − 4 … A − 1)
    if (!onTrip(dates, day)) {
      if (weekdayWork) {
        if (rng.chance(0.7)) {
          const amount = rng.chance(0.05) ? rng.amount(85_000, 110_000, 5000) : rng.amount(35_000, 65_000, 5000);
          b.add({ by: 'an', type: 'EXPENSE', from: 'momo', amount: money(amount), category: 'coffee', day, time: rng.time('07:30', '09:30'), description: rng.maybe(rng.pick(COFFEE)), tag: 'coffee' });
        }
        if (rng.chance(0.6)) b.add({ by: 'an', type: 'EXPENSE', from: 'cash', amount: money(rng.amount(25_000, 50_000)), category: 'food', day, time: rng.time('06:45', '08:30'), description: rng.maybe(rng.pick(BREAKFAST)), tag: 'breakfast' });
        if (rng.chance(0.85)) b.add({ by: 'an', type: 'EXPENSE', from: rng.chance(0.5) ? 'cash' : 'momo', amount: money(rng.amount(40_000, 90_000)), category: 'food', day, time: rng.time('11:30', '13:15'), description: rng.maybe(rng.pick(LUNCH)), tag: 'lunch' });
        if (rng.chance(0.5)) b.add({ by: 'an', type: 'EXPENSE', from: 'momo', amount: money(rng.amount(25_000, 75_000)), category: 'grab', day, time: rng.time('07:15', '08:45'), description: rng.maybe(GRAB[0]!), tag: 'grab' });
        if (rng.chance(0.5)) b.add({ by: 'an', type: 'EXPENSE', from: 'momo', amount: money(rng.amount(25_000, 75_000)), category: 'grab', day, time: rng.time('17:30', '19:00'), description: rng.maybe(rng.pick(GRAB.slice(1))), tag: 'grab' });
      }
      if (day >= nextFuel) {
        b.add({ by: 'an', type: 'EXPENSE', from: 'cash', amount: money(rng.amount(70_000, 110_000)), category: 'fuel', day, time: rng.time('07:00', '19:00'), description: rng.maybe('Đổ xăng'), tag: 'fuel' });
        nextFuel = addDays(day, rng.int(8, 10));
      }
      if (dow === 6 && rng.chance(0.9)) {
        const sunday = addDays(day, 1);
        const shopDay = rng.chance(0.5) || sunday > dates.historyEnd || onTrip(dates, sunday) ? day : sunday;
        b.add({ by: 'an', type: 'EXPENSE', from: 'vcb', amount: money(rng.amount(300_000, 900_000)), category: 'groceries', day: shopDay, time: rng.time('09:00', '11:30'), description: rng.maybe(rng.pick(GROCERIES)), tag: 'groceries' });
      }
      if ((dow === 5 || dow === 6 || dow === 0) && rng.chance(0.45)) {
        b.add({ by: 'an', type: 'EXPENSE', from: 'visa', amount: money(rng.amount(150_000, 550_000)), category: 'dining_out', day, time: rng.time('18:30', '21:30'), description: rng.maybe(rng.pick(DINING)), tag: 'dining' });
      }
      if (rng.chance(0.3)) {
        const late = !rng.chance(0.6);
        b.add({ by: 'an', type: 'EXPENSE', from: 'cash', amount: money(rng.amount(15_000, 45_000)), category: rng.chance(0.5) ? 'snacks' : 'drinks', day, time: late ? rng.time('22:30', '23:59') : rng.time('15:00', '17:00'), description: rng.maybe(rng.pick(SNACKS)), tag: 'snack' });
      }
      if (rng.chance(0.08)) b.add({ by: 'an', type: 'EXPENSE', from: 'visa', amount: money(rng.amount(150_000, 1_200_000)), category: 'shopping', day, time: rng.time('19:00', '23:00'), description: rng.maybe(rng.pick(SHOPPING)), tag: 'shopping' });
      if (day >= nextCatFood) {
        b.add({ by: 'an', type: 'EXPENSE', from: 'visa', amount: money(rng.amount(250_000, 420_000)), category: 'pets', day, time: rng.time('10:00', '20:00'), description: rng.maybe('Hạt cho mèo'), tag: 'pets' });
        nextCatFood = addDays(day, rng.int(19, 23));
      }
    }

    // ---- Linh, about 0.3× An's frequency
    const s = 0.3;
    if ((dow === 6 || dow === 0) && rng.chance(0.5)) b.add({ by: 'linh', type: 'INCOME', to: 'bidv', amount: money(rng.amount(250_000, 450_000, 50_000)), category: 'part_time', day, time: rng.time('16:00', '20:00'), description: 'Tutoring', tag: 'linhTutoring' });
    if (weekdayWork) {
      if (rng.chance(0.7 * s)) b.add({ by: 'linh', type: 'EXPENSE', from: 'zalo', amount: money(rng.amount(35_000, 65_000, 5000)), category: 'dining_out', day, time: rng.time('07:30', '09:30'), description: rng.maybe('Coffee'), tag: 'linhHabit' });
      if (rng.chance(0.6 * s)) b.add({ by: 'linh', type: 'EXPENSE', from: 'lcash', amount: money(rng.amount(25_000, 50_000)), category: 'food', day, time: rng.time('06:45', '08:30'), description: rng.maybe(rng.pick(LINH_FOOD)), tag: 'linhHabit' });
      if (rng.chance(0.85 * s)) b.add({ by: 'linh', type: 'EXPENSE', from: rng.chance(0.5) ? 'lcash' : 'zalo', amount: money(rng.amount(40_000, 90_000)), category: 'food', day, time: rng.time('11:30', '13:15'), description: rng.maybe(rng.pick(LINH_FOOD)), tag: 'linhHabit' });
      for (let ride = 0; ride < 2; ride++) {
        if (rng.chance(0.5 * s)) b.add({ by: 'linh', type: 'EXPENSE', from: 'zalo', amount: money(rng.amount(25_000, 75_000)), category: 'transportation', day, time: rng.time('07:00', '19:00'), description: rng.maybe('Grab'), tag: 'linhHabit' });
      }
    }
    if (rng.chance(s / 9)) b.add({ by: 'linh', type: 'EXPENSE', from: 'lcash', amount: money(rng.amount(70_000, 110_000)), category: 'transportation', day, time: rng.time('07:00', '19:00'), description: rng.maybe('Fuel'), tag: 'linhHabit' });
    if (dow === 6 && rng.chance(0.9 * s)) b.add({ by: 'linh', type: 'EXPENSE', from: 'bidv', amount: money(rng.amount(300_000, 900_000)), category: 'groceries', day, time: rng.time('09:00', '11:30'), description: rng.maybe('Co.opmart'), tag: 'linhGroceries' });
    if ((dow === 5 || dow === 6 || dow === 0) && rng.chance(0.45 * s)) b.add({ by: 'linh', type: 'EXPENSE', from: 'bidv', amount: money(rng.amount(150_000, 550_000)), category: 'dining_out', day, time: rng.time('18:30', '21:30'), description: rng.maybe(rng.pick(LINH_DINING)), tag: 'linhHabit' });
    if (rng.chance(0.3 * s)) b.add({ by: 'linh', type: 'EXPENSE', from: 'lcash', amount: money(rng.amount(15_000, 45_000)), category: 'snacks', day, time: rng.time('15:00', '17:00'), description: rng.maybe('Bubble tea'), tag: 'linhHabit' });
    if (rng.chance(0.08 * s)) b.add({ by: 'linh', type: 'EXPENSE', from: 'bidv', amount: money(rng.amount(150_000, 1_200_000)), category: 'shopping', day, time: rng.time('19:00', '23:00'), description: rng.maybe('Shopee'), tag: 'linhHabit' });
    if (rng.chance(s / 21)) b.add({ by: 'linh', type: 'EXPENSE', from: 'bidv', amount: money(rng.amount(250_000, 420_000)), category: 'pets', day, time: rng.time('10:00', '20:00'), description: rng.maybe('Dog food'), tag: 'linhHabit' });

    // ---- Mom's market mornings and temple days
    if (rng.chance(0.65)) b.add({ by: 'an', type: 'EXPENSE', from: 'mcash', amount: money(rng.amount(60_000, 220_000, 5000)), category: 'market', day, time: rng.time('06:00', '08:00'), description: rng.maybe('Chợ Bà Chiểu'), tag: 'market' });
    if (offeringDays.has(day)) b.add({ by: 'an', type: 'EXPENSE', from: 'mcash', amount: money(rng.amount(50_000, 200_000, 10_000)), category: 'temple_offering', day, time: rng.time('05:30', '06:30'), description: 'Cúng rằm / mùng một', tag: 'temple' });

    // ---- Shared House weekends, the window's first six months, once both first contributions are in
    if (historyMonth(dates, day) <= 6 && day >= kittyFunded && dow === 6 && rng.chance(0.8)) {
      for (let row = rng.int(3, 5); row > 0; row--) {
        b.add({ by: rng.chance(0.5) ? 'an' : 'khoa', type: 'EXPENSE', from: 'kitty', amount: money(rng.amount(40_000, 130_000)), category: rng.chance(0.7) ? 'groceries' : 'other', day: row % 2 ? day : addDays(day, 1), time: rng.time('09:00', '20:00'), description: rng.maybe('Đồ ăn cuối tuần'), tag: 'kittyWeekend' });
      }
    }

    // ---- Khoa, sparse
    if (rng.chance(0.08)) b.add({ by: 'khoa', type: 'EXPENSE', from: 'kbank', amount: money(rng.amount(150_000, 1_200_000)), category: rng.pick(['food', 'transportation', 'entertainment']), day, time: rng.time('09:00', '21:00'), description: rng.maybe('Chi tiêu'), tag: 'khoaHabit' });

    // ---- Bao: a Sunday shop every week; on a daylight-saving Sunday it's at 23:45, and a ride home follows at 00:15
    if (dow === 0) {
      const dst = dstDays.has(day);
      b.add({ by: 'bao', type: 'EXPENSE', from: 'cba', amount: cents(rng.amount(4_500, 6_500, 5)), category: 'groceries', day, time: dst ? '23:45' : rng.time('10:00', '18:00'), description: rng.pick(['Woolworths', 'Coles', 'Aldi']), tag: dst ? 'baoDstShop' : 'baoGroceries' });
      if (dst && addDays(day, 1) <= dates.historyEnd) {
        b.add({ by: 'bao', type: 'EXPENSE', from: 'cba', amount: cents(rng.amount(1_800, 3_500, 5)), category: 'transportation', day: addDays(day, 1), time: '00:15', description: 'Uber home', tag: 'baoDstRide' });
      }
    }
    if (date === 1) {
      const candidates = ctx.days.filter((d) => d.slice(0, 7) === day.slice(0, 7) && weekday(d) >= 1 && weekday(d) <= 5);
      baoCoffeesThisMonth = candidates.length === 0 ? [] : Array.from({ length: 4 }, () => rng.pick(candidates));
    }
    for (const coffeeDay of baoCoffeesThisMonth) {
      if (coffeeDay === day) b.add({ by: 'bao', type: 'EXPENSE', from: 'bcash', amount: cents(rng.amount(450, 650, 10)), category: 'drinks', day, time: rng.time('08:00', '10:00'), description: rng.maybe('Flat white'), tag: 'baoCoffee' });
    }
  }
}
