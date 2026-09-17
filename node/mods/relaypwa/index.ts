module.exports = (app, mod, build_number: number) => {
  return `
  <!DOCTYPE html>
  <html lang="en" data-theme="dark">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=yes" />
    <meta name="description" content="${app.browser.escapeHTML(mod.description)}" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="application-name" content="Relay" />
    <meta name="apple-mobile-web-app-title" content="Relay" />
    <meta name="theme-color" content="#1c1c23" />

    <link rel="manifest" href="/relaypwa/manifest.webmanifest" />
    <link rel="stylesheet" type="text/css" href="/saito/saito.css?v=${build_number}" />

    <title>Relay</title>
  </head>
  <body>
    <div id="relaypwa-root">Relay is scaffolded — chat, wallet and calls land in later phases.</div>
  </body>
  <script type="text/javascript" src="/saito/saito.js?build=${build_number}"></script>
  <script>
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/relaypwa/service-worker.js').catch((error) => {
          console.warn('Unable to register the Relay service worker:', error);
        });
      });
    }
  </script>
  </html>
  `;
};
