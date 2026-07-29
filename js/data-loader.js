/* VIEMAG — cache-busting loader for js/data.js
 *
 * THE PROBLEM: /admin saves -> the export Edge Function commits js/data.js ->
 * GitHub Pages redeploys within a minute. But Pages serves js/data.js with
 * `cache-control: max-age=600`, and every page used to reference it as a plain
 * `<script src="js/data.js">`. With no version in the URL, the browser and the
 * Pages CDN both keep serving the old copy for up to 10 minutes, so an edit
 * that HAD published looked like it never synced.
 *
 * THE FIX: put a minute-resolution stamp in the URL. Within any given minute
 * every visitor shares one cached copy; the following minute is a new URL and
 * therefore a fresh fetch. Worst-case staleness drops from 10 minutes to ~1,
 * which is inside GitHub Pages' own build-and-deploy latency anyway — i.e. no
 * longer the bottleneck.
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
  var minute = Math.floor(Date.now() / 60000);
  document.write('<script src="js/data.js?v=' + minute + '"><\/script>');
})();
