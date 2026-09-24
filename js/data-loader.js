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
 */
(function () {
  var script = document.currentScript;
  var version = script && script.src ? new URL(script.src, location.href).search : "";
  document.write('<script src="js/data.js' + version + '"><\/script>');
})();
