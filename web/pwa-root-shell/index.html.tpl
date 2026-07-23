<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#0f766e" />
    <link rel="apple-touch-icon" href="/admin/assets/ubuzima-logo.png" />
    <title>Ubuzima+ Platform</title>
    <style>
      :root {
        font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: #0f172a;
        background: #f8fafc;
      }

      body {
        margin: 0;
        min-height: 100vh;
        background:
          radial-gradient(circle at top left, rgba(15, 118, 110, 0.18), transparent 32%),
          linear-gradient(135deg, #ecfeff 0%, #f8fafc 52%, #ffffff 100%);
      }

      header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1rem;
        padding: 1rem clamp(1rem, 4vw, 4rem);
      }

      .brand {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        font-weight: 900;
      }

      .brand img {
        width: 44px;
        height: 44px;
        border-radius: 14px;
      }

      main {
        max-width: 1080px;
        margin: 0 auto;
        padding: clamp(2rem, 8vw, 6rem) 1rem;
      }

      .hero {
        display: grid;
        grid-template-columns: minmax(0, 1.1fr) minmax(280px, 0.9fr);
        gap: 2rem;
        align-items: center;
      }

      .panel {
        background: rgba(255, 255, 255, 0.92);
        border: 1px solid rgba(148, 163, 184, 0.26);
        border-radius: 30px;
        box-shadow: 0 24px 70px rgba(15, 23, 42, 0.12);
        padding: clamp(1.25rem, 4vw, 2rem);
      }

      h1 {
        font-size: clamp(2rem, 7vw, 4.5rem);
        line-height: 1;
        margin: 0 0 1rem;
        letter-spacing: -0.055em;
      }

      p {
        color: #475569;
        line-height: 1.65;
        font-size: 1.05rem;
      }

      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.8rem;
        margin-top: 1.5rem;
      }

      a.button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 46px;
        padding: 0 1.15rem;
        border-radius: 999px;
        font-weight: 900;
        text-decoration: none;
      }

      .primary {
        background: #0f766e;
        color: white;
      }

      .secondary {
        background: white;
        color: #0f766e;
        border: 1px solid rgba(15, 118, 110, 0.25);
      }

      .feature-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.85rem;
      }

      .feature {
        border: 1px solid rgba(148, 163, 184, 0.22);
        border-radius: 22px;
        padding: 1rem;
        background: rgba(248, 250, 252, 0.9);
      }

      .feature strong {
        display: block;
        margin-bottom: 0.25rem;
      }

      .feature span {
        color: #64748b;
        font-size: 0.92rem;
      }

      footer {
        padding: 1.5rem;
        color: #64748b;
        text-align: center;
      }

      @media (max-width: 760px) {
        .hero {
          grid-template-columns: 1fr;
        }

        header {
          align-items: flex-start;
          flex-direction: column;
        }

        .feature-grid {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <header>
      <div class="brand">
        <img src="/admin/assets/ubuzima-logo.png" alt="Ubuzima+" />
        <span>Ubuzima+</span>
      </div>
      <a class="button secondary" href="/admin/">Staff Login</a>
    </header>

    <main>
      <section class="hero">
        <div>
          <h1>Digital operations for modern pharmacy businesses.</h1>
          <p>
            Ubuzima+ supports pharmacy operations, POS workflows, inventory visibility,
            analytics, access control, and business review for growing healthcare teams.
          </p>
          <div class="actions">
            <a class="button primary" href="/admin/">Open Staff Portal</a>
            <a class="button secondary" href="mailto:info@ubuzimaplus.com">Contact Ubuzima+</a>
          </div>
          <p>
            Mobile app installation is available inside the staff dashboard after login.
          </p>
        </div>

        <div class="panel">
          <div class="feature-grid">
            <div class="feature"><strong>POS & Sales</strong><span>Live and historical sales workflows.</span></div>
            <div class="feature"><strong>Inventory</strong><span>Stock visibility, valuation, and expiry intelligence.</span></div>
            <div class="feature"><strong>Finance</strong><span>QuickBooks-style finance direction and business reporting.</span></div>
            <div class="feature"><strong>Security</strong><span>Role, branch, and user access governance.</span></div>
          </div>
        </div>
      </section>
    </main>

    <footer>© Ubuzima+ Platform</footer>
  </body>
</html>
