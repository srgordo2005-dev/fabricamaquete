// Dutching: distribute stakes across N outcomes so guaranteed return is identical.
// stake_i = TotalStake * (1/odds_i) / sum(1/odds_j)
// Profit margin = (1 - sum(1/odds)) — positive means an arb / no-loss opportunity.

export interface DutchSelection {
  label: string;
  bookmaker: string;
  odds: number;
}

export interface DutchResult extends DutchSelection {
  stake: number;
  payout: number;
}

export interface DutchSummary {
  selections: DutchResult[];
  totalStake: number;
  guaranteedReturn: number;
  profit: number;
  marginPct: number; // e.g. 1.23 means +1.23%
  isArb: boolean;
}

export function calculateDutching(
  selections: DutchSelection[],
  totalStake: number,
): DutchSummary {
  const valid = selections.filter((s) => s.odds > 1);
  const invSum = valid.reduce((acc, s) => acc + 1 / s.odds, 0);
  const marginPct = (1 - invSum) * 100;
  const isArb = invSum < 1;

  const results: DutchResult[] = valid.map((s) => {
    const stake = (totalStake * (1 / s.odds)) / invSum;
    return { ...s, stake: round2(stake), payout: round2(stake * s.odds) };
  });

  const guaranteedReturn = results.length > 0 ? Math.min(...results.map((r) => r.payout)) : 0;

  return {
    selections: results,
    totalStake: round2(totalStake),
    guaranteedReturn: round2(guaranteedReturn),
    profit: round2(guaranteedReturn - totalStake),
    marginPct: Number(marginPct.toFixed(3)),
    isArb,
  };
}

function round2(n: number) { return Math.round(n * 100) / 100; }

export function suggestNextStake(currentBankroll: number, initialBankroll: number, lastMargin = 1): number {
  // Recovery sizing: if behind, scale up modestly; if ahead, keep conservative 2% bankroll.
  const deficit = initialBankroll - currentBankroll;
  const base = currentBankroll * 0.02;
  if (deficit <= 0) return Math.max(10, round2(base));
  // Need profit ≈ deficit/10 to recover gradually; stake = profit / margin%
  const targetProfit = deficit / 10;
  const margin = Math.max(lastMargin, 0.5) / 100;
  const recoveryStake = targetProfit / margin;
  return Math.max(10, round2(Math.min(recoveryStake, currentBankroll * 0.1)));
}
