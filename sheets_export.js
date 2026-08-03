/* ==========================================================================
   Live "Export to Google Sheet" — backed by a Google Apps Script web app.

   Why Apps Script instead of OAuth: an Apps Script web app deployed with
   "Execute as: Me" runs as whoever deployed it, every time, with no
   per-visit Google sign-in — which matters a lot for a tool meant to be
   used from a phone home-screen icon with as few taps as possible. The
   trade-off is a ~10 minute one-time setup by whoever owns the Drive
   folder, instead of a Google Cloud OAuth client.

   ONE-TIME SETUP:
   1. Go to https://script.google.com (signed into the Google account that
      has edit access to the "programs" Drive folder).
   2. New project -> paste in the provided Code.gs content -> save.
   3. Deploy -> New deployment -> gear icon -> "Web app".
      - Execute as: Me
      - Who has access: Anyone
   4. Deploy, authorize (click through the "unverified app" warning since
      it's your own script), then copy the Web app URL (ends in /exec).
   5. Paste that URL into APPS_SCRIPT_URL below.

   Until APPS_SCRIPT_URL is set, the button shows setup instructions
   instead of failing silently. "Copy for Google Sheets" works right now
   with zero setup either way.

   IMPORTANT — why this uses a real form submission instead of fetch():
   Apps Script web apps respond via a 302 redirect to a
   script.googleusercontent.com/macros/echo URL. The Drive file gets
   created successfully server-side either way, but fetch()'s CORS
   handling of that second hop is unreliable across browsers — it can
   report a failure to the page even though the sheet was already made,
   which is exactly the "it says it failed but the sheet's actually
   there" symptom. Submitting a real <form> into a new tab sidesteps
   this entirely: the browser just navigates the new tab through
   Google's redirect chain like any other link, and Code.gs sends that
   tab straight to the finished sheet instead of returning JSON for us
   to read back.
   ========================================================================== */

(function () {
  "use strict";

  const CONFIG = {
    APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbwZ9uydmjL-3dwkbMn2X8Dw5R1KMhDWj5PWLqYOJSbu7jjkwXK6Ckr72nsvCkpBl19g/exec",
  };

  function ensureModal() {
    let modal = document.getElementById("setupModal");
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = "setupModal";
    modal.style.cssText =
      "position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:200;display:flex;align-items:center;justify-content:center;padding:20px;";
    modal.innerHTML = `
      <div style="background:#1a1b1d;border:1px solid #333538;border-radius:12px;max-width:480px;padding:26px;font-family:'Manrope',sans-serif;color:#dfe2e5;">
        <div style="font-family:'Oswald',sans-serif;text-transform:uppercase;color:#fff;font-size:20px;margin-bottom:10px;">One-time setup needed</div>
        <p style="font-size:14px;line-height:1.6;color:#9aa0a6;">
          Live "Export to Google Sheet" needs a one-time Apps Script deployment connected by
          whoever owns the Drive folder. Until then, use <b style="color:#22c55e">Copy for Google Sheets</b> —
          it works right now with zero setup, just paste into a duplicated Template sheet.
        </p>
        <p style="font-size:12.5px;line-height:1.6;color:#656b72;">
          Setup steps are documented at the top of <code>sheets_export.js</code>.
        </p>
        <button id="setupModalClose" style="margin-top:14px;width:100%;padding:12px;border-radius:8px;border:none;background:#22c55e;color:#06180d;font-family:'Oswald',sans-serif;font-weight:600;text-transform:uppercase;cursor:pointer;">Got it</button>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector("#setupModalClose").addEventListener("click", () => modal.remove());
    modal.addEventListener("click", (e) => { if (e.target === modal) modal.remove(); });
    return modal;
  }

  window.attemptGoogleSheetExport = function (program, tsv) {
    if (!CONFIG.APPS_SCRIPT_URL) {
      ensureModal();
      return;
    }
    const rows = tsv.split("\n").map((line) => line.split("\t"));
    const payload = JSON.stringify({ athleteName: program.athleteName, rows });

    const form = document.createElement("form");
    form.method = "POST";
    form.action = CONFIG.APPS_SCRIPT_URL;
    form.target = "_blank"; // Code.gs redirects this new tab straight to the finished sheet
    form.style.display = "none";

    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "payload";
    input.value = payload;
    form.appendChild(input);

    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);

    if (window.toast) window.toast("Opening your sheet in a new tab…");
  };
})();
