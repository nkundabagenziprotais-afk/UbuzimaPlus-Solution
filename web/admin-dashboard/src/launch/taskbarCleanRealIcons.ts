function labelOf(button: HTMLElement): string {
  return (
    button.getAttribute("aria-label") ||
    button.getAttribute("title") ||
    button.getAttribute("data-ubuzima-full-label") ||
    button.textContent ||
    "Module"
  )
    .replace(/\s+/g, " ")
    .trim();
}

function iconSvg(label: string): string {
  const value = label.toLowerCase();

  if (/\b(pos|counter|cashier|checkout|till)\b/.test(value)) {
    return '<svg viewBox="0 0 64 64" fill="none"><rect x="16" y="7" width="32" height="50" rx="8" fill="#fff" stroke="#0f766e" stroke-width="3"/><rect x="21" y="13" width="22" height="13" rx="3" fill="#ccfbf1" stroke="#0f766e" stroke-width="2"/><path d="M23 34h6M35 34h6M23 42h6M35 42h6" stroke="#0f766e" stroke-width="4" stroke-linecap="round"/></svg>';
  }

  if (/\b(inventory|medicine|drug|pill|stock|pharmacy|product)\b/.test(value)) {
    return '<svg viewBox="0 0 64 64" fill="none"><rect x="19" y="7" width="26" height="50" rx="8" fill="#fff" stroke="#0f766e" stroke-width="3"/><path d="M25 7h14v8H25z" fill="#ccfbf1" stroke="#0f766e" stroke-width="3"/><path d="M24 29c0-5 4-9 9-9s9 4 9 9v12c0 5-4 9-9 9s-9-4-9-9V29Z" fill="#ecfeff" stroke="#0f766e" stroke-width="3"/><path d="M24 35h18" stroke="#0f766e" stroke-width="3" stroke-linecap="round"/></svg>';
  }

  if (/\b(procurement|purchase|order)\b/.test(value)) {
    return '<svg viewBox="0 0 64 64" fill="none"><path d="M12 15h7l6 28h24l5-20H24" stroke="#0f766e" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="28" cy="51" r="4" fill="#ccfbf1" stroke="#0f766e" stroke-width="3"/><circle cx="46" cy="51" r="4" fill="#ccfbf1" stroke="#0f766e" stroke-width="3"/><path d="M33 19v14M26 26h14" stroke="#14b8a6" stroke-width="3" stroke-linecap="round"/></svg>';
  }

  if (/\b(insurance|claim|policy)\b/.test(value)) {
    return '<svg viewBox="0 0 64 64" fill="none"><path d="M32 7 52 15v14c0 13-8 23-20 28C20 52 12 42 12 29V15l20-8Z" fill="#fff" stroke="#0f766e" stroke-width="3"/><path d="M32 20v22M21 31h22" stroke="#0f766e" stroke-width="5" stroke-linecap="round"/></svg>';
  }

  if (/\b(sales|sale|receipt|invoice)\b/.test(value)) {
    return '<svg viewBox="0 0 64 64" fill="none"><path d="M18 8h28v48l-5-3-5 3-5-3-5 3-5-3-3 2V8Z" fill="#fff" stroke="#0f766e" stroke-width="3"/><path d="M24 21h16M24 31h16M24 41h10" stroke="#0f766e" stroke-width="3" stroke-linecap="round"/></svg>';
  }

  if (/\b(report|analytics|statistics|dashboard)\b/.test(value)) {
    return '<svg viewBox="0 0 64 64" fill="none"><rect x="11" y="9" width="42" height="46" rx="7" fill="#fff" stroke="#0f766e" stroke-width="3"/><path d="M22 43V31M32 43V22M42 43V36" stroke="#0f766e" stroke-width="5" stroke-linecap="round"/></svg>';
  }

  return '<svg viewBox="0 0 64 64" fill="none"><rect x="12" y="12" width="16" height="16" rx="5" fill="#ccfbf1" stroke="#0f766e" stroke-width="3"/><rect x="36" y="12" width="16" height="16" rx="5" fill="#fff" stroke="#0f766e" stroke-width="3"/><rect x="12" y="36" width="16" height="16" rx="5" fill="#fff" stroke="#0f766e" stroke-width="3"/><rect x="36" y="36" width="16" height="16" rx="5" fill="#ccfbf1" stroke="#0f766e" stroke-width="3"/></svg>';
}

function decorateButton(button: HTMLElement): void {
  if (/close/i.test(button.getAttribute("aria-label") || "")) return;

  const label = labelOf(button);
  button.setAttribute("aria-label", label);
  button.setAttribute("title", label);

  let icon =
    button.querySelector<HTMLElement>(".ubuzima-source-dock__glass-icon") ||
    button.querySelector<HTMLElement>(".ubuzima-mac-dock__icon") ||
    button.querySelector<HTMLElement>(".ubuzima-clean-taskbar-icon");

  if (!icon) {
    icon = document.createElement("span");
    icon.className = "ubuzima-clean-taskbar-icon";
    icon.setAttribute("aria-hidden", "true");
    button.prepend(icon);
  }

  icon.innerHTML = iconSvg(label);
  icon.setAttribute("data-ubuzima-clean-real-icon", "true");

  button.style.setProperty("transform", "none", "important");
  button.style.setProperty("scale", "1", "important");
}

function applyTaskbar(): void {
  document
    .querySelectorAll<HTMLElement>(
      ".ubuzima-source-dock__app, .ubuzima-source-dock__task, .ubuzima-mac-dock__app, .ubuzima-mac-dock__recent-app, .ubuzima-source-dock button, .ubuzima-mac-dock button",
    )
    .forEach(decorateButton);
}

function boot(): void {
  applyTaskbar();

  let timer = 0;

  const schedule = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(applyTaskbar, 120);
  };

  new MutationObserver(schedule).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "style", "aria-label", "title"],
  });

  window.addEventListener("pageshow", schedule);
  window.addEventListener("resize", schedule);
  window.setInterval(applyTaskbar, 1500);
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
}

export {};
