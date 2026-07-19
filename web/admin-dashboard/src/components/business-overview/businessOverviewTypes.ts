export type BusinessOverviewModule = {
  id: string;
  title: string;
  description: string;
  accent: 'blue' | 'green' | 'teal' | 'purple' | 'amber' | 'red';
  status: 'Live' | 'Preview' | 'Config';
};

export type BusinessKpi = {
  label: string;
  value: string;
  helper: string;
  trend?: string;
  tone?: 'positive' | 'negative' | 'neutral' | 'warning';
  source: 'Live' | 'Preview' | 'Config';
};

export type BusinessAction = {
  title: string;
  description: string;
  action: string;
  tone: 'positive' | 'negative' | 'warning' | 'neutral';
};
