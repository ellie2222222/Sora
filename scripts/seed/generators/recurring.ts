// Fixed-schedule rows (plan §5.2 for An, §5.5 for the other wallets): salary, rent, bills, subscriptions,
// allowances, card payoffs, savings, pensions, kitty contributions.

import { addDays, addMonths, firstOfMonth, isLastDayOfMonth, monthOf, previousWorkday, weekday } from '../calendar.ts';
import { cents, money } from '../ledger.ts';
import { bankReference, historyMonth, monthNumber, type GeneratorContext } from './context.ts';

interface MonthPicks {
  electricity: number;
  water: number;
  phone: number;
  momMedicine: number;
  momUtilities: number;
}

/** Bill days drawn once per month, before any row of that month, so the stream stays in day order. */
function monthPicks(ctx: GeneratorContext): Map<string, MonthPicks> {
  const picks = new Map<string, MonthPicks>();
  for (const day of ctx.days) {
    if (picks.has(monthOf(day))) continue;
    picks.set(monthOf(day), {
      electricity: ctx.rng.int(8, 12),
      water: ctx.rng.int(10, 14),
      phone: ctx.rng.int(19, 21),
      momMedicine: ctx.rng.int(1, 28),
      momUtilities: ctx.rng.int(8, 14),
    });
  }
  return picks;
}

export function recurring(ctx: GeneratorContext): void {
  const { builder: b, rng, dates } = ctx;
  const picks = monthPicks(ctx);
  const tetMonth = monthOf(dates.tet);
  const isSalaryDay = (day: string) => day === previousWorkday(`${day.slice(0, 8)}25`);

  // Opening funding: registration's Cash accounts start at 0 and updateAccountSchema has no initialBalance.
  b.add({ by: 'an', type: 'TRANSFER', from: 'vcb', to: 'cash', amount: money(1_200_000), category: 'cash_withdrawal', day: dates.historyStart, time: '07:00', description: 'Rút tiền ATM', tag: 'funding' });
  b.add({ by: 'linh', type: 'TRANSFER', from: 'bidv', to: 'lcash', amount: money(600_000), category: 'cash_withdrawal', day: dates.historyStart, time: '07:05', description: 'ATM withdrawal', tag: 'funding' });
  b.add({ by: 'bao', type: 'TRANSFER', from: 'cba', to: 'bcash', amount: money('200.00'), category: 'cash_withdrawal', day: dates.historyStart, time: '09:00', description: 'Rút tiền ATM', tag: 'funding' });

  for (const day of ctx.days) {
    const date = Number(day.slice(8, 10));
    const month = monthNumber(day);
    const pick = picks.get(monthOf(day))!;
    const n = historyMonth(dates, day);

    // ---- An
    if (date === 1) {
      const midnight = monthOf(day) === dates.midnightRentMonth;
      b.add({ by: 'an', type: 'EXPENSE', from: 'vcb', amount: money(6_500_000), category: 'rent', day, time: midnight ? '00:10' : '08:00', description: `Tiền nhà tháng ${month}`, reference: bankReference(ctx, day), tag: midnight ? 'rentMidnight' : 'rent' });
      b.add({ by: 'an', type: 'INCOME', to: 'tcb', amount: money(rng.amount(90_000, 110_000)), category: 'interest', day, time: '01:00', description: 'Lãi tiết kiệm', tag: 'interest' });
      if (n <= 6) {
        b.add({ by: 'an', type: 'TRANSFER', from: 'vcb', to: 'kitty', amount: money(n === 1 ? 3_500_000 : 2_500_000), category: 'house_share', day, time: '09:30', description: 'Góp tiền nhà Vũng Tàu', reference: bankReference(ctx, day), tag: 'houseShare' });
      }
    }
    if (date === 3 && n <= 5) b.add({ by: 'an', type: 'EXPENSE', from: 'visa', amount: money(500_000), category: 'gym', day, time: '06:00', description: 'California Fitness', tag: 'gym' });
    if (date === 5) b.add({ by: 'an', type: 'TRANSFER', from: 'vcb', to: 'mcash', amount: money(3_000_000), category: 'allowance_to_mom', day, time: '08:00', description: 'Gửi mẹ tiền tiêu', reference: bankReference(ctx, day), tag: 'allowance' });
    if (date === pick.electricity) {
      const hot = month >= 4 && month <= 6;
      b.add({ by: 'an', type: 'EXPENSE', from: 'vcb', amount: money(hot ? rng.amount(1_450_000, 1_600_000, 100) : rng.amount(650_000, 1_100_000, 100)), category: 'utilities', day, time: '10:00', description: `Tiền điện tháng ${month}`, tag: 'electricity' });
    }
    if (date === pick.water) b.add({ by: 'an', type: 'EXPENSE', from: 'vcb', amount: money(rng.amount(90_000, 160_000, 100)), category: 'utilities', day, time: '10:30', description: `Tiền nước tháng ${month}`, tag: 'water' });
    if (date === 15) b.add({ by: 'an', type: 'EXPENSE', from: 'vcb', amount: money(220_000), category: 'phone_internet', day, time: '09:00', description: 'Internet FPT', tag: 'internet' });
    if (date === pick.phone) b.add({ by: 'an', type: 'EXPENSE', from: 'momo', amount: money(rng.chance(0.5) ? 100_000 : 200_000), category: 'phone_internet', day, time: '12:00', description: 'Nạp điện thoại', tag: 'phone' });
    if (date === 7) b.add({ by: 'an', type: 'EXPENSE', from: 'visa', amount: money(260_000), category: 'subscriptions', day, time: '05:00', description: 'Netflix', tag: 'subscription' });
    if (date === 12) b.add({ by: 'an', type: 'EXPENSE', from: 'visa', amount: money(59_000), category: 'subscriptions', day, time: '05:00', description: 'Spotify', tag: 'subscription' });
    if (date === 18) b.add({ by: 'an', type: 'EXPENSE', from: 'visa', amount: money(45_000), category: 'subscriptions', day, time: '05:00', description: 'iCloud', tag: 'subscription' });
    if (isSalaryDay(day)) b.add({ by: 'an', type: 'INCOME', to: 'vcb', amount: money(28_000_000), category: 'salary', day, time: '10:00', description: `Lương tháng ${month}`, reference: bankReference(ctx, day), tag: 'salary' });
    if (isSalaryDay(addDays(day, -1))) {
      b.add({ by: 'an', type: 'TRANSFER', from: 'vcb', to: 'tcb', amount: money(monthOf(day) === tetMonth ? 3_000_000 : 5_000_000), category: 'savings', day, time: '09:00', description: 'Tiết kiệm hàng tháng', reference: bankReference(ctx, day), tag: 'savings' });
    }
    if (date === 27) b.add({ by: 'an', type: 'TRANSFER', from: 'vcb', to: 'visa', amount: 0n, category: 'credit_card_payment', day, time: '20:00', description: 'Thanh toán thẻ VIB', reference: bankReference(ctx, day), tag: 'payoff', dynamic: 'payoff' });
    if (isLastDayOfMonth(day)) b.add({ by: 'an', type: 'EXPENSE', from: 'vcb', amount: money(11_000), category: 'fees', day, time: '23:30', description: 'Phí SMS Banking', tag: 'fee' });

    // ---- Linh
    if (date === 5) b.add({ by: 'linh', type: 'INCOME', to: 'bidv', amount: money(14_500_000), category: 'salary', day, time: '10:00', description: 'Teaching salary', reference: bankReference(ctx, day), tag: 'linhSalary' });
    if (date === 6) b.add({ by: 'linh', type: 'TRANSFER', from: 'bidv', to: 'lsave', amount: money(11_000_000), category: 'savings', day, time: '09:00', description: 'Monthly savings', tag: 'linhSavings' });

    // ---- Mom (An records it all: Mom is not a user)
    if (date === 10) b.add({ by: 'an', type: 'INCOME', to: 'mcash', amount: money(3_500_000), category: 'pension', day, time: '09:00', description: 'Lương hưu', tag: 'pension' });
    if (date === 11) b.add({ by: 'an', type: 'TRANSFER', from: 'mcash', to: 'agri', amount: money(2_000_000), category: 'savings', day, time: '10:00', description: 'Gửi tiết kiệm', tag: 'momSavings' });
    if (date === 1) b.add({ by: 'an', type: 'INCOME', to: 'agri', amount: money(450_000), category: 'interest', day, time: '02:00', description: 'Lãi tiền gửi', tag: 'momInterest' });
    if (date === pick.momMedicine) b.add({ by: 'an', type: 'EXPENSE', from: 'mcash', amount: money(rng.amount(150_000, 400_000)), category: 'medicine', day, time: rng.time('09:00', '16:00'), description: 'Thuốc huyết áp', tag: 'medicine' });
    if (date === pick.momUtilities) b.add({ by: 'an', type: 'EXPENSE', from: 'mcash', amount: money(rng.amount(300_000, 500_000, 100)), category: 'electricity_water', day, time: '10:00', description: 'Tiền điện nước', tag: 'momUtilities' });
    if (date === 20) b.add({ by: 'an', type: 'EXPENSE', from: 'mcash', amount: money(100_000), category: 'phone', day, time: '10:00', description: 'Nạp card điện thoại', tag: 'momPhone' });

    // ---- Shared House, the window's first six months. Contributions (1st, 2nd) land before Rent (5th).
    if (n <= 6) {
      if (date === 2) b.add({ by: 'khoa', type: 'INCOME', to: 'kitty', amount: money(n === 1 ? 3_500_000 : 2_500_000), category: 'contribution', day, time: '10:00', description: 'Khoa góp tiền mặt', tag: 'kittyContribution' });
      if (date === 5) b.add({ by: rng.chance(0.5) ? 'an' : 'khoa', type: 'EXPENSE', from: 'kitty', amount: money(3_500_000), category: 'rent', day, time: '09:00', description: 'Tiền thuê nhà Vũng Tàu', tag: 'kittyRent' });
      if (date === 12) b.add({ by: 'khoa', type: 'EXPENSE', from: 'kitty', amount: money(rng.amount(150_000, 300_000, 100)), category: 'utilities', day, time: '10:00', description: 'Tiền điện', tag: 'kittyBills' });
      if (date === 16) b.add({ by: 'an', type: 'EXPENSE', from: 'kitty', amount: money(rng.amount(40_000, 90_000, 100)), category: 'utilities', day, time: '10:00', description: 'Tiền nước', tag: 'kittyBills' });
    }

    // ---- Bao (Melbourne, AUD)
    if (date === 1) b.add({ by: 'bao', type: 'EXPENSE', from: 'cba', amount: money('600.00'), category: 'housing', day, time: '09:00', description: 'Room rent', tag: 'baoRent' });
    if (weekday(day) === 5) b.add({ by: 'bao', type: 'INCOME', to: 'cba', amount: cents(rng.amount(18_000, 26_000, 25)), category: 'part_time', day, time: '17:00', description: 'Café shifts', tag: 'baoWages' });
  }

  b.add({ by: 'an', type: 'INCOME', to: 'vcb', amount: money(28_000_000), category: 'bonus', day: dates.tetBonus, time: '10:00', description: 'Thưởng Tết', reference: bankReference(ctx, dates.tetBonus), tag: 'tetBonus' });

  // Future: next month's rent, the hotel hold and the ryokan balance, all PENDING.
  const nextRent = addMonths(firstOfMonth(dates.anchor), 1);
  b.add({ by: 'an', type: 'EXPENSE', status: 'PENDING', from: 'vcb', amount: money(6_500_000), category: 'rent', day: nextRent, time: '08:00', description: `Tiền nhà tháng ${monthNumber(nextRent)}`, tag: 'rentPending' });
}
