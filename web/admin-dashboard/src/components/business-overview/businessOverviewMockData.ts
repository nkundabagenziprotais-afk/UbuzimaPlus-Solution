import type { BusinessAction, BusinessKpi, BusinessOverviewModule } from './businessOverviewTypes';

const formatNumber = (value: number) =>
  new Intl.NumberFormat('en-RW', { maximumFractionDigits: 0 }).format(Math.round(value));

const monthlyRevenueGoal = 50_000_000;
const monthlyProfitGoal = 8_000_000;
const monthToDateRevenue = 31_250_000;
const monthToDateNetRevenue = 28_420_000;
const monthToDateCollections = 24_650_000;
const outstandingBalance = 7_320_000;
const monthToDateGrossProfit = 10_230_000;
const monthToDateOperatingExpenses = 5_400_000;
const estimatedNetProfit = monthToDateGrossProfit - monthToDateOperatingExpenses;
const remainingOperatingDays = 9;
const elapsedOperatingDays = 23;
const cashVariance = -185_000;

const breakEvenDailyCash = monthToDateOperatingExpenses / elapsedOperatingDays;
const dailyCashForRevenueGoal = (monthlyRevenueGoal - monthToDateRevenue) / remainingOperatingDays;
const dailyCashForProfitGoal =
  (monthToDateOperatingExpenses + monthlyProfitGoal - monthToDateGrossProfit) / remainingOperatingDays;

export const businessOverviewModules: BusinessOverviewModule[] = [
  { id: 'pos', title: 'POS Analytics', description: 'Sales, payments, sessions, cashier performance', accent: 'blue', status: 'Live' },
  { id: 'inventory', title: 'Inventory Analytics', description: 'Stock value, movement, expiry and low-stock risk', accent: 'green', status: 'Live' },
  { id: 'sales', title: 'Sales & Revenue', description: 'Revenue trend, top products, margins and returns', accent: 'purple', status: 'Live' },
  { id: 'cash', title: 'Cash & Collections', description: 'Collections, cash variance, payment mix and credit', accent: 'teal', status: 'Live' },
  { id: 'expenses', title: 'Expenses & Profitability', description: 'Operating expense, break-even and profit goals', accent: 'amber', status: 'Preview' },
  { id: 'insurance', title: 'Insurance & Receivables', description: 'Insurer sales, receivables and contribution', accent: 'purple', status: 'Preview' },
  { id: 'customers', title: 'Customers & Credit', description: 'Customer mix, balances and credit risk', accent: 'teal', status: 'Preview' },
  { id: 'staff', title: 'Staff & Branch Performance', description: 'Branch, operator and productivity scorecard', accent: 'blue', status: 'Preview' },
  { id: 'dispensing', title: 'Prescriptions & Dispensing', description: 'Dispensing review, prescription safety and queues', accent: 'green', status: 'Live' },
  { id: 'goals', title: 'Goals & Forecasting', description: 'Monthly targets, required daily cash and forecast', accent: 'amber', status: 'Config' },
];

export const businessOverviewKpis: BusinessKpi[] = [
  { label: 'Gross Revenue', value: formatNumber(monthToDateRevenue), helper: 'Month-to-date gross sales', trend: '↑ 18.6%', tone: 'positive', source: 'Live' },
  { label: 'Net Revenue', value: formatNumber(monthToDateNetRevenue), helper: 'After discounts and returns', trend: '↑ 17.3%', tone: 'positive', source: 'Live' },
  { label: 'Collections', value: formatNumber(monthToDateCollections), helper: 'Cash collected this month', trend: '↑ 16.8%', tone: 'positive', source: 'Live' },
  { label: 'Outstanding Balance', value: formatNumber(outstandingBalance), helper: 'Credit and receivables exposure', trend: '↑ 4.2%', tone: 'negative', source: 'Live' },
  { label: 'Gross Profit', value: formatNumber(monthToDateGrossProfit), helper: 'Estimated product margin', trend: '↑ 19.4%', tone: 'positive', source: 'Preview' },
  { label: 'Estimated Net Profit', value: formatNumber(estimatedNetProfit), helper: 'Gross profit less operating expenses', trend: '↑ 21.6%', tone: 'positive', source: 'Preview' },
  { label: 'Operating Expenses', value: formatNumber(monthToDateOperatingExpenses), helper: 'Expense model pending live module', trend: '↑ 8.7%', tone: 'warning', source: 'Preview' },
  { label: 'Expense / Revenue Ratio', value: '19.0%', helper: 'Operating expense over net revenue', trend: '↓ 1.6pp', tone: 'positive', source: 'Preview' },
  { label: 'Break-even Daily Cash', value: formatNumber(breakEvenDailyCash), helper: 'Required daily cash to cover expenses', tone: 'neutral', source: 'Preview' },
  { label: 'Daily Cash for Revenue Goal', value: formatNumber(dailyCashForRevenueGoal), helper: `${remainingOperatingDays} operating days remaining`, tone: 'neutral', source: 'Config' },
  { label: 'Daily Cash for Profit Goal', value: formatNumber(dailyCashForProfitGoal), helper: `${remainingOperatingDays} operating days remaining`, tone: 'neutral', source: 'Config' },
  { label: 'Cash Variance', value: formatNumber(cashVariance), helper: 'Open sessions variance', trend: '3 sessions', tone: 'negative', source: 'Live' },
];

export const recommendedActions: BusinessAction[] = [
  { title: 'Collect Outstanding Balances', description: '7,320,000 remains outstanding across credit and receivables.', action: 'Review Collections', tone: 'negative' },
  { title: 'Replenish High-Revenue Items', description: 'Several fast-moving products are approaching stock risk.', action: 'View Inventory Risk', tone: 'warning' },
  { title: 'Review Expense Trend', description: 'Operating expenses are trending above the previous period.', action: 'Review Expenses', tone: 'warning' },
  { title: 'Close Variance Sessions', description: 'Cash variance exists in open or recently closed POS sessions.', action: 'View Sessions', tone: 'negative' },
  { title: 'Update Monthly Goals', description: 'Revenue and profit targets should be reviewed for the remaining days.', action: 'Update Goals', tone: 'neutral' },
  { title: 'Follow Up Insurance Claims', description: 'Insurance receivables should be reconciled before month end.', action: 'Review Receivables', tone: 'neutral' },
];

export const businessGoalSnapshot = {
  monthlyRevenueGoal,
  monthlyProfitGoal,
  monthToDateRevenue,
  monthToDateGrossProfit,
  estimatedNetProfit,
  revenueGoalProgress: 62.5,
  profitGoalProgress: 60.4,
};
