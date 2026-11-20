// Shows an "Update available" button when a newer version is on GitHub Pages.
// Pages caches files for up to 10 minutes, so this checks version.json with no-store and,
// when it differs, reloads with a fresh ?v= so the browser fetches the new page and assets.
(() => {
  const mine = document.querySelector('meta[name="app-version"]')?.content;
  const btn = document.getElementById("updateBtn");
  if (!mine || !btn) return;
  let latest = null;
  async function check() {
    try {
      const r = await fetch("version.json?t=" + Date.now(), {cache: "no-store"});
      if (!r.ok) return;
      const {version} = await r.json();
      if (version && version !== mine) { latest = version; btn.hidden = false; }
    } catch (e) {}
  }
  btn.addEventListener("click", () => {
    btn.textContent = "Updating…";
    location.replace(location.pathname + "?v=" + encodeURIComponent(latest || Date.now()) + location.hash);
  });
  // tidy the ?v= off the address once the fresh page has loaded
  if (/[?&]v=/.test(location.search)) history.replaceState(null, "", location.pathname + location.hash);
  check();
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") check(); });
  setInterval(check, 5 * 60 * 1000);
})();
