<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta
      http-equiv="refresh"
      content="0; url=__APP_START__"
    />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#0f766e" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-title" content="Ubuzima+" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="format-detection" content="telephone=no" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="apple-touch-icon" href="/admin/assets/ubuzima-logo.png" />
    <title>Ubuzima+ Mobile</title>
    <style>
      :root {
        color-scheme: light;
        font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #f8fafc;
        color: #0f172a;
      }

      body {
        min-height: 100vh;
        margin: 0;
        display: grid;
        place-items: center;
        padding: 1.25rem;
        background:
          radial-gradient(circle at top left, rgba(15, 118, 110, 0.18), transparent 34%),
          linear-gradient(135deg, #f8fafc 0%, #ecfeff 100%);
      }

      main {
        width: min(420px, 100%);
        padding: 1.5rem;
        border: 1px solid rgba(15, 118, 110, 0.16);
        border-radius: 28px;
        background: rgba(255, 255, 255, 0.92);
        box-shadow: 0 24px 60px rgba(15, 23, 42, 0.14);
        text-align: center;
      }

      img {
        width: 72px;
        height: 72px;
        object-fit: contain;
        border-radius: 22px;
        margin-bottom: 1rem;
      }

      h1 {
        margin: 0;
        font-size: 1.35rem;
      }

      p {
        color: #64748b;
        line-height: 1.55;
      }

      a {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 44px;
        margin-top: 0.75rem;
        padding: 0 1.1rem;
        border-radius: 999px;
        background: #0f766e;
        color: white;
        font-weight: 800;
        text-decoration: none;
      }
    </style>
    <script>
      // UBUZIMA_PERMANENT_PWA_ROOT_LAUNCHER_V1
      (function () {
        var target = '__APP_START__';

        function openApp() {
          window.location.replace(target);
        }

        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistrations()
            .then(function (registrations) {
              return Promise.all(registrations.map(function (registration) {
                return registration.unregister().catch(function () {});
              }));
            })
            .finally(openApp);
        } else {
          openApp();
        }
      })();
    </script>
  </head>
  <body>
    <main>
      <img src="/admin/assets/ubuzima-logo.png" alt="Ubuzima+" />
      <h1>Opening Ubuzima+ Mobile</h1>
      <p>If the app does not open automatically, use the button below.</p>
      <a href="__APP_START__">Open Ubuzima+ Mobile</a>
    </main>
  </body>
</html>
