import { useMemo, useState } from 'react';

import { useResponsiveViewport } from './useResponsiveViewport';
import './reactMobileNavigation.css';

export type ReactMobileNavigationItem<
  SectionKey extends string,
> = {
  key: SectionKey;
  label: string;
  icon: string;
  description?: string;
};

type ReactMobileNavigationProps<
  SectionKey extends string,
> = {
  items: ReadonlyArray<
    ReactMobileNavigationItem<SectionKey>
  >;
  activeSection: SectionKey;
  onNavigate: (section: SectionKey) => void;
};

const MAX_PRIMARY_ITEMS = 4;

export function ReactMobileNavigation<
  SectionKey extends string,
>({
  items,
  activeSection,
  onNavigate,
}: ReactMobileNavigationProps<SectionKey>) {
  const viewport = useResponsiveViewport();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const primaryItems = useMemo(
    () => items.slice(0, MAX_PRIMARY_ITEMS),
    [items],
  );

  const secondaryItems = useMemo(
    () => items.slice(MAX_PRIMARY_ITEMS),
    [items],
  );

  const isSupportedMobileViewport =
    viewport.isSmallMobile || viewport.isMobile;

  if (!isSupportedMobileViewport || items.length === 0) {
    return null;
  }

  function navigate(section: SectionKey) {
    onNavigate(section);
    setIsMenuOpen(false);
  }

  return (
    <>
      <nav
        className="react-mobile-navigation"
        aria-label="Mobile workspace navigation"
        data-react-mobile-navigation="true"
      >
        {primaryItems.map((item) => (
          <button
            key={item.key}
            type="button"
            className={
              item.key === activeSection
                ? 'react-mobile-navigation__item is-active'
                : 'react-mobile-navigation__item'
            }
            aria-current={
              item.key === activeSection
                ? 'page'
                : undefined
            }
            onClick={() => navigate(item.key)}
          >
            <span
              className="react-mobile-navigation__icon"
              aria-hidden="true"
            >
              {item.icon}
            </span>

            <span className="react-mobile-navigation__label">
              {item.label}
            </span>
          </button>
        ))}

        {secondaryItems.length > 0 && (
          <button
            type="button"
            className={
              isMenuOpen
                ? 'react-mobile-navigation__item is-active'
                : 'react-mobile-navigation__item'
            }
            aria-expanded={isMenuOpen}
            aria-controls="react-mobile-navigation-menu"
            onClick={() =>
              setIsMenuOpen((current) => !current)
            }
          >
            <span
              className="react-mobile-navigation__icon"
              aria-hidden="true"
            >
              •••
            </span>

            <span className="react-mobile-navigation__label">
              More
            </span>
          </button>
        )}
      </nav>

      {isMenuOpen && secondaryItems.length > 0 && (
        <div
          className="react-mobile-navigation-menu"
          data-react-mobile-navigation-menu="true"
        >
          <button
            type="button"
            className="react-mobile-navigation-menu__backdrop"
            aria-label="Close mobile navigation"
            onClick={() => setIsMenuOpen(false)}
          />

          <section
            id="react-mobile-navigation-menu"
            className="react-mobile-navigation-menu__panel"
            role="dialog"
            aria-modal="true"
            aria-label="All workspaces"
          >
            <header className="react-mobile-navigation-menu__header">
              <div>
                <strong>Workspaces</strong>
                <span>Choose where you want to work</span>
              </div>

              <button
                type="button"
                className="react-mobile-navigation-menu__close"
                aria-label="Close workspace menu"
                onClick={() => setIsMenuOpen(false)}
              >
                ×
              </button>
            </header>

            <div className="react-mobile-navigation-menu__list">
              {secondaryItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={
                    item.key === activeSection
                      ? 'react-mobile-navigation-menu__option is-active'
                      : 'react-mobile-navigation-menu__option'
                  }
                  onClick={() => navigate(item.key)}
                >
                  <span
                    className="react-mobile-navigation-menu__option-icon"
                    aria-hidden="true"
                  >
                    {item.icon}
                  </span>

                  <span>
                    <strong>{item.label}</strong>

                    {item.description && (
                      <small>{item.description}</small>
                    )}
                  </span>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
