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
  { id: 'pos', title: 'POS Analytics', description: 'Sales, payments, sessions', accent: 'blue', routeLabel: 'Open Analytics' },
  { id: 'inventory', title: 'Inventory Analytics', description: 'Stock, value, movement', accent: 'green', routeLabel: 'Open Analytics' },
  { id: 'sales', title: 'Sales & Revenue', description: 'Trends, top products, margins', accent: 'purple', routeLabel: 'Open Analytics' },
  { id: 'cash', title: 'Cash & Collections', description: 'Cash flow, payments', accent: 'teal', routeLabel: 'Open Analytics' },
  { id: 'expenses', title: 'Expenses & Profitability', description: 'Expenses, profit, margins', accent: 'amber', routeLabel: 'Open Analytics' },
  { id: 'insurance', title: 'Insurance & Receivables', description: 'Insurance sales and AR', accent: 'purple', routeLabel: 'Open Analytics' },
  { id: 'customers', title: 'Customers & Credit', description: 'Customers, credit, aging', accent: 'teal', routeLabel: 'Open Analytics' },
  { id: 'staff', title: 'Staff & Branch Performance', description: 'Staff, cashiers, branches', accent: 'blue', routeLabel: 'Open Analytics' },
  { id: 'dispensing', title: 'Prescriptions & Dispensing', description: 'Rx, dispensing, reviews', accent: 'amber', routeLabel: 'Open Analytics' },
  { id: 'goals', title: 'Business Goals & Forecasting', description: 'Goals, forecast, scenarios', accent: 'green', routeLabel: 'Open Analytics' },
];

export const businessOverviewKpis: BusinessKpi[] = [
  { label: 'Gross Revenue', value: formatNumber(monthToDateRevenue), helper: 'MTD revenue', trend: '↑ 18.6%', tone: 'positive' },
  { label: 'Net Revenue', value: formatNumber(monthToDateNetRevenue), helper: 'After discounts and returns', trend: '↑ 17.3%', tone: 'positive' },
  { label: 'Collections', value: formatNumber(monthToDateCollections), helper: 'Cash collected MTD', trend: '↑ 16.8%', tone: 'positive' },
  { label: 'Outstanding Balance', value: formatNumber(outstandingBalance), helper: 'Credit and receivables', trend: '↑ 4.2%', tone: 'negative' },
  { label: 'Gross Profit', value: formatNumber(monthToDateGrossProfit), helper: 'Estimated gross profit', trend: '↑ 19.4%', tone: 'positive' },
  { label: 'Estimated Net Profit', value: formatNumber(estimatedNetProfit), helper: 'Gross profit minus operating expenses', trend: '↑ 21.6%', tone: 'positive' },
  { label: 'Operating Expenses', value: formatNumber(monthToDateOperatingExpenses), helper: 'Preview estimate MTD', trend: '↑ 8.7%', tone: 'warning' },
  { label: 'Expense to Revenue Ratio', value: '19.0%', helper: 'Operating expense / net revenue', trend: '↓ 1.6pp', tone: 'positive' },
  { label: 'Break-even Daily Cash Required', value: formatNumber(breakEvenDailyCash), helper: 'Based on current expenses', tone: 'neutral' },
  { label: 'Daily Cash for Revenue Goal', value: formatNumber(dailyCashForRevenueGoal), helper: `${remainingOperatingDays} days remaining`, tone: 'neutral' },
  { label: 'Daily Cash for Profit Goal', value: formatNumber(dailyCashForProfitGoal), helper: `${remainingOperatingDays} days remaining`, tone: 'neutral' },
  { label: 'Cash Variance', value: formatNumber(cashVariance), helper: 'Open sessions variance', trend: '3 sessions', tone: 'negative' },
];

export const recommendedActions: BusinessAction[] = [
  { title: 'Collect Outstanding', description: '7,320,000 outstanding balance requires follow-up.', action: 'Take Action', tone: 'negative' },
  { title: 'Replenish Stock', description: '12 high-revenue products are low or out of stock.', action: 'View Items', tone: 'warning' },
  { title: 'Review Expenses', description: 'Expenses are up 8.7% versus the previous period.', action: 'Review Now', tone: 'warning' },
  { title: 'Close Open Sessions', description: '3 open sessions have cash variance.', action: 'View Sessions', tone: 'positive' },
  { title: 'Follow Up Insurance', description: '3,850,000 insurer receivable pending.', action: 'Follow Up', tone: 'neutral' },
  { title: 'Update Goals', description: 'Review monthly revenue and profit goals.', action: 'Update Goals', tone: 'neutral' },
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
