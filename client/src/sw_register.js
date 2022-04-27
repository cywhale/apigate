//https://felixgerschau.com/how-to-make-your-react-app-a-progressive-web-app-pwa/
export default function sw_register() {
  //https://web.dev/offline-fallback-page/
  if (process.env.NODE_ENV === 'production') {
    window.addEventListener("load", () => {
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register('/sw.js', { scope: './' })
        .then((registration) => {
         console.log("service worker registration successful", registration);
        })
        .catch((err) => {
         console.log("service worker registration failed", err);
        });
      }
    });
  }
}
