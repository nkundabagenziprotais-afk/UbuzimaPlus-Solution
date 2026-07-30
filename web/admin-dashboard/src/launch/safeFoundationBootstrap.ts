/**
 * Restores the last verified Ubuzima+ desktop deck and module refinements.
 *
 * Finance and Accounting remain implemented by the current application.
 */

/* General interface foundation. */
import './uiExperienceCorrections';

/* Permanent desktop deck and icon stabilisation. */
import './permanentTaskbarGuard';
import './taskbarCleanRealIcons';
import './taskbarRealIconsV2';
import './taskbarInlineRealIconsFinal';
import './taskbarStabilityRealIcons';
import './taskbarHardLock';

/* Latest verified POS and product-card foundation. */
import './posInventoryFullHydrator';
import './posProductCardDeviceLayout';
import './posUiDirectV3';
import './posUiVisualLockV4';
import './posTileV16RealPatch';
import './posCardCanonicalLayout';
import './posCardExactOrderFinal';
import './posStableSemanticPolish';
import './posConfirmationFormPolish';
import './posQuantityPriceDialogRealPatch';
import './posQuantityPricePopupClean';
import './posQuantityPricePopupFinal';

document.documentElement.setAttribute(
  'data-ubuzima-safe-foundation',
  'restored',
);

export {};
