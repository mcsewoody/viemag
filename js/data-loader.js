/* VIEMAG — cache-busting loader for js/data.js
 *
 * THE PROBLEM: /admin saves -> the export Edge Function commits js/data.js ->
 * GitHub Pages redeploys within a minute. But Pages serves js/data.js with
 * `cache-control: max-age=600`, and every page used to reference it as a plain
 * `<script src="js/data.js">`. With no version in the URL, the browser and the
 * Pages CDN both keep serving the old copy for up to 10 minutes, so an edit
 * that HAD published looked like it never synced.
 *
 * THE FIX: pass this loader's own cache-busting version through to data.js.
 * The pre-commit hook bumps every HTML reference on deploy, so a fresh deploy
 * still gets a fresh DB file without forcing repeat visitors to redownload the
 * full 1MB+ data payload every minute.
 *
 * WHY document.write AND NOT A DYNAMIC <script>: js/data.js defines window.DB,
 * and js/main.js reads it in boot() on DOMContentLoaded. A dynamically inserted
 * script does not block DOMContentLoaded, so boot() could run before DB exists —
 * a race that would blank the whole page some of the time. document.write during
 * parsing inserts a parser-blocking script, preserving the exact ordering the
 * static tag had. Chrome's document.write intervention does not apply: the
 * script is same-origin.
 *
 * WHY A SECOND FILE: 80% of the old single-file payload was insights[].body —
 * every article, in four languages, on every page. The home page renders four
 * article CARDS (title + excerpt) and never touches a body, yet paid 444 KB
 * gzipped to get them; without the bodies it is 39 KB. Bodies and product
 * articles now live in js/data-articles.js, which only the two pages that
 * render long-form text ask for, by putting data-articles="1" on their loader
 * tag. Both files carry the same ?v=, so a deploy invalidates them together and
 * a visitor moving from the home page to an article does not re-fetch the
 * catalogue.
 *
 * Safe in both directions: js/main.js folds js/data-articles.js back into
 * window.DB when it is present and renders exactly as before when it is not, so
 * the site keeps working whether or not the exporter has been redeployed.
 */
(function () {
  var script = document.currentScript;
  var version = script && script.src ? new URL(script.src, location.href).search : "";
  document.write('<script src="js/data.js' + version + '"><\/script>');
  if (script && script.getAttribute("data-articles") === "1") {
    document.write('<script src="js/data-articles.js' + version + '"><\/script>');
  }
})();
