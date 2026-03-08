/**
 * useBalanceHistory — thin wrapper around useAccountLedger.getBalanceSeries.
 * Kept for backward-compatibility with components that import it directly.
 */
import { useState, useEffect } from "react";
import { useAccountLedger, type BalancePeriod, type BalancePoint } from "./useAccountLedger";

export type { BalancePeriod, BalancePoint };

export function useBalanceHistory(
  userId: string | undefined,
  accountId: string | undefined,
  period: BalancePeriod
) {
  const { getBalanceSeries, loading, reconcile } = useAccountLedger(userId, accountId);
  const [chartData, setChartData] = useState<BalancePoint[]>([]);

  useEffect(() => {
    setChartData(getBalanceSeries(period));
  }, [getBalanceSeries, period]);

  return { chartData, loading, refresh: reconcile };
}
