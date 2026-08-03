/* ==========================================================================
   Optional: live "Export to Google Sheet" integration.

   This creates a real copy of Eric's Throwing Program Template inside his
   Drive "programs" folder and fills it in — no custom backend required,
   just Google Identity Services (sign-in) + the Drive/Sheets REST APIs
   called directly from the browser with the athlete's/coach's own Google
   account.

   ONE-TIME SETUP (do this once, takes ~10 minutes):
   1. Go to https://console.cloud.google.com/apis/credentials
   2. Create a project (or use an existing one).
   3. Enable the "Google Sheets API" and "Google Drive API".
   4. Create an "OAuth client ID" of type "Web application".
      - Add the URL this app is hosted at (e.g. https://yourdomain.com)
        under "Authorized JavaScript origins".
   5. Paste the client ID below into CONFIG.CLIENT_ID.
   6. Configure the OAuth consent screen with the Google account(s) that
      should be allowed to use this (Eric's account, yours, etc.) as test
      users if the app is in "Testing" mode.

   Until CLIENT_ID is set, the "Export to Google Sheet" button shows these
   instructions instead of failing silently. The "Copy for Google Sheets"
   button works right away with zero setup.
   ========================================================================== */

(function () {
  "use strict";

  const CONFIG = {
    CLIENT_ID: "", // <-- paste your OAuth Web Client ID here
    TEMPLATE_SHEET_ID: "1znL4xPRYt2SoWylNOK1Sr6Ixeubb-e6_brb0GCW3ZYc", // Eric's real "Throwing Program Template"
    DEST_FOLDER_ID: "12Ikyh_09IfV2gEE1MSfi6idjZL7fO3lC", // Eric's real "programs" Drive folder
    SCOPES: "https://www.googleapis.com/auth/drive.file",
  };

  let tokenClient = null;
  let accessToken = null;

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
          Live "Export to Google Sheet" needs a free Google OAuth client ID connected once by whoever
          owns this tool. Until then, use <b style="color:#22c55e">Copy for Google Sheets</b> — it works
          right now with zero setup, just paste into a duplicated Template sheet.
        </p>
        <p style="font-size:12.5px;line-height:1.6;color:#656b72;">
          Setup steps are documented in <code>sheets_export.js</code> at the top of the file.
        </p>
        <button id="setupModalClose" style="margin-top:14px;width:100%;padding:12px;border-radius:8px;border:none;background:#22c55e;color:#06180d;font-family:'Oswald',sans-serif;font-weight:600;text-transform:uppercase;cursor:pointer;">Got it</button>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector("#setupModalClose").addEventListener("click", () => modal.remove());
    modal.addEventListener("click", (e) => { if (e.target === modal) modal.remove(); });
    return modal;
  }

  function loadGis() {
    return new Promise((resolve, reject) => {
      if (window.google && window.google.accounts) return resolve();
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function getAccessToken() {
    if (accessToken) return accessToken;
    await loadGis();
    return new Promise((resolve, reject) => {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CONFIG.CLIENT_ID,
        scope: CONFIG.SCOPES,
        callback: (resp) => {
          if (resp.error) return reject(resp);
          accessToken = resp.access_token;
          resolve(accessToken);
        },
      });
      tokenClient.requestAccessToken({ prompt: "" });
    });
  }

  async function copyTemplate(token, newName) {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${CONFIG.TEMPLATE_SHEET_ID}/copy`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, parents: [CONFIG.DEST_FOLDER_ID] }),
    });
    if (!res.ok) throw new Error("Drive copy failed: " + (await res.text()));
    return res.json();
  }

  async function writeRows(token, spreadsheetId, tsv) {
    const rows = tsv.split("\n").map((line) => line.split("\t"));
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1?valueInputOption=USER_ENTERED`,
      {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ range: "A1", majorDimension: "ROWS", values: rows }),
      }
    );
    if (!res.ok) throw new Error("Sheets write failed: " + (await res.text()));
    return res.json();
  }

  window.attemptGoogleSheetExport = async function (program, tsv) {
    if (!CONFIG.CLIENT_ID) {
      ensureModal();
      return;
    }
    try {
      const token = await getAccessToken();
      const file = await copyTemplate(token, `${program.athleteName} Throwing Program`);
      await writeRows(token, file.id, tsv);
      window.open(`https://docs.google.com/spreadsheets/d/${file.id}/edit`, "_blank");
      if (window.toast) window.toast("Sheet created in your Drive programs folder");
    } catch (err) {
      console.error(err);
      alert("Google Sheet export failed — see console for details. Copy for Google Sheets still works as a fallback.");
    }
  };
})();
