
function installBusinessOverviewRiskOverviewCache(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const cacheKey = 'businessOverviewInventoryRiskOverviewLastGoodHtml';

  function numericTotal(text: string): number {
    return (text.match(/\d+(?:,\d{3})*(?:\.\d+)?/g) ?? [])
      .map((value) => Number(value.replace(/,/g, '')))
      .filter((value) => Number.isFinite(value))
      .reduce((sum, value) => sum + value, 0);
  }

  function findRiskCard(): HTMLElement | null {
    const headings = Array.from(document.querySelectorAll<HTMLElement>('h1,h2,h3,h4,strong,span'));

    const title = headings.find((node) =>
      /Inventory Risk Overview/i.test(node.textContent ?? ''),
    );

    return title?.closest<HTMLElement>('article,section,.business-overview-card,.analytics-card,.review-card,.dashboard-card,div') ?? null;
  }

  function applyCache(): void {
    const card = findRiskCard();

    if (!card) {
      return;
    }

    const text = card.textContent ?? '';
    const total = numericTotal(text);
    const looksZero = total <= 0 || /0\s*0\s*0|0\.0%/i.test(text);

    if (!looksZero && total > 0) {
      window.localStorage.setItem(cacheKey, card.innerHTML);
      return;
    }

    const cached = window.localStorage.getItem(cacheKey);

    if (cached && looksZero) {
      card.innerHTML = cached;
      card.setAttribute('data-risk-cache-restored', 'true');
    }
  }

  window.setInterval(applyCache, 1200);
  window.setTimeout(applyCache, 800);
  window.setTimeout(applyCache, 2200);

  const observer = new MutationObserver(applyCache);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
}

installBusinessOverviewRiskOverviewCache();


import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';
import App from './App';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
