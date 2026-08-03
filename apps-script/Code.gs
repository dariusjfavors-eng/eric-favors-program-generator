/**
 * Paste this into a new Apps Script project at https://script.google.com,
 * then Deploy -> New deployment -> Web app (Execute as: Me, Who has
 * access: Anyone). Copy the resulting /exec URL into
 * sheets_export.js's CONFIG.APPS_SCRIPT_URL.
 *
 * Receives {athleteName, rows} from the program generator and creates a
 * copy of Eric's real Throwing Program Template inside his "programs"
 * Drive folder, filled in with the generated program.
 */

var TEMPLATE_ID = "1znL4xPRYt2SoWylNOK1Sr6Ixeubb-e6_brb0GCW3ZYc";
var FOLDER_ID = "12Ikyh_09IfV2gEE1MSfi6idjZL7fO3lC";

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var athleteName = body.athleteName || "Athlete";
    var rows = body.rows || [];

    var templateFile = DriveApp.getFileById(TEMPLATE_ID);
    var folder = DriveApp.getFolderById(FOLDER_ID);
    var copy = templateFile.makeCopy(athleteName + " Throwing Program", folder);

    var ss = SpreadsheetApp.openById(copy.getId());
    var sheet = ss.getSheets()[0];
    sheet.clear();

    var maxCols = 1;
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].length > maxCols) maxCols = rows[i].length;
    }
    var padded = rows.map(function (r) {
      var row = r.slice();
      while (row.length < maxCols) row.push("");
      return row;
    });

    if (padded.length > 0) {
      sheet.getRange(1, 1, padded.length, maxCols).setValues(padded);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ url: ss.getUrl() }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
