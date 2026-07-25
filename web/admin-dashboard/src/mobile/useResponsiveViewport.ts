import { useEffect, useState } from 'react';

export type ResponsiveViewport = {
  width: number;
  isSmallMobile: boolean;
  isMobile: boolean;
  isTablet: boolean;
  isLaptop: boolean;
  isDesktop: boolean;
  isWideScreen: boolean;
};

const SMALL_MOBILE_MAX = 360;
const MOBILE_MAX = 767;
const TABLET_MAX = 1023;
const LAPTOP_MAX = 1439;
const DESKTOP_MAX = 1919;

function readViewportWidth(): number {
  if (typeof window === 'undefined') {
    return 1280;
  }

  return window.innerWidth;
}

export function classifyResponsiveViewport(
  width: number,
): ResponsiveViewport {
  const safeWidth = Number.isFinite(width)
    ? Math.max(0, width)
    : 1280;

  return {
    width: safeWidth,
    isSmallMobile: safeWidth <= SMALL_MOBILE_MAX,
    isMobile: safeWidth > SMALL_MOBILE_MAX && safeWidth <= MOBILE_MAX,
    isTablet: safeWidth > MOBILE_MAX && safeWidth <= TABLET_MAX,
    isLaptop: safeWidth > TABLET_MAX && safeWidth <= LAPTOP_MAX,
    isDesktop: safeWidth > LAPTOP_MAX && safeWidth <= DESKTOP_MAX,
    isWideScreen: safeWidth > DESKTOP_MAX,
  };
}

export function useResponsiveViewport(): ResponsiveViewport {
  const [viewport, setViewport] = useState<ResponsiveViewport>(
    () => classifyResponsiveViewport(readViewportWidth()),
  );

  useEffect(() => {
    let animationFrame = 0;

    const updateViewport = () => {
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
      }

      animationFrame = window.requestAnimationFrame(() => {
        setViewport(
          classifyResponsiveViewport(readViewportWidth()),
        );
      });
    };

    updateViewport();

    window.addEventListener('resize', updateViewport, {
      passive: true,
    });

    window.addEventListener(
      'orientationchange',
      updateViewport,
      { passive: true },
    );

    return () => {
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
      }

      window.removeEventListener(
        'resize',
        updateViewport,
      );

      window.removeEventListener(
        'orientationchange',
        updateViewport,
      );
    };
  }, []);

  return viewport;
}
