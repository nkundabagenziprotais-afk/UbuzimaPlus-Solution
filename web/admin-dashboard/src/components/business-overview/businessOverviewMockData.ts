import type { BusinessAction, BusinessKpi, BusinessOverviewModule } from './businessOverviewTypes';

export const businessOverviewModules: BusinessOverviewModule[] = [
  { id: 'pos', title: 'POS Analytics', description: '', accent: 'blue', status: 'Live' },
  { id: 'inventory', title: 'Inventory Analytics', description: '', accent: 'green', status: 'Live' },
  { id: 'sales', title: 'Sales & Revenue', description: '', accent: 'purple', status: 'Live' },
  { id: 'cash', title: 'Cash & Collections', description: '', accent: 'teal', status: 'Live' },
  { id: 'expenses', title: 'Expenses & Profitability', description: '', accent: 'amber', status: 'Live' },
  { id: 'insurance', title: 'Insurance & Receivables', description: '', accent: 'purple', status: 'Live' },
  { id: 'customers', title: 'Customers & Credit', description: '', accent: 'teal', status: 'Live' },
  { id: 'staff', title: 'Staff & Branch Performance', description: '', accent: 'blue', status: 'Live' },
  { id: 'dispensing', title: 'Prescriptions & Dispensing', description: '', accent: 'green', status: 'Live' },
  { id: 'goals', title: 'Goals & Forecasting', description: '', accent: 'amber', status: 'Live' },
];

const noDataHelper = 'Live data source not connected';

export const businessOverviewKpis: BusinessKpi[] = [
  { label: 'Gross Revenue', value: '—', helper: noDataHelper, tone: 'neutral', source: 'Live' },
  { label: 'Net Revenue', value: '—', helper: noDataHelper, tone: 'neutral', source: 'Live' },
  { label: 'Collections', value: '—', helper: noDataHelper, tone: 'neutral', source: 'Live' },
  { label: 'Outstanding Balance', value: '—', helper: noDataHelper, tone: 'neutral', source: 'Live' },
  { label: 'Gross Profit', value: '—', helper: noDataHelper, tone: 'neutral', source: 'Live' },
  { label: 'Estimated Net Profit', value: '—', helper: noDataHelper, tone: 'neutral', source: 'Live' },
  { label: 'Operating Expenses', value: '—', helper: noDataHelper, tone: 'neutral', source: 'Live' },
  { label: 'Expense / Revenue Ratio', value: '—', helper: noDataHelper, tone: 'neutral', source: 'Live' },
  { label: 'Break-even Daily Cash', value: '—', helper: noDataHelper, tone: 'neutral', source: 'Live' },
  { label: 'Daily Cash for Revenue Goal', value: '—', helper: noDataHelper, tone: 'neutral', source: 'Live' },
  { label: 'Daily Cash for Profit Goal', value: '—', helper: noDataHelper, tone: 'neutral', source: 'Live' },
  { label: 'Cash Variance', value: '—', helper: noDataHelper, tone: 'neutral', source: 'Live' },
];

export const recommendedActions: BusinessAction[] = [
  {
    title: 'Connect Business Overview Data',
    description: 'Connect POS, inventory, payments, receivables, expenses, and goal data sources to activate this dashboard.',
    action: 'Configure Data',
    tone: 'neutral',
  },
  {
    title: 'Set Revenue and Profit Goals',
    description: 'Add monthly revenue, profit, operating expense, and operating day settings.',
    action: 'Set Goals',
    tone: 'neutral',
  },
  {
    title: 'Review Data Readiness',
    description: 'Validate branch, cashier, payment, inventory, and insurance data mappings before customer handover.',
    action: 'Review Setup',
    tone: 'neutral',
  },
];

export const businessGoalSnapshot = {
  monthlyRevenueGoal: null,
  monthlyProfitGoal: null,
  monthToDateRevenue: null,
  monthToDateGrossProfit: null,
  estimatedNetProfit: null,
  revenueGoalProgress: 0,
  profitGoalProgress: 0,
};
