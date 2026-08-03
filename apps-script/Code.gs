var TEMPLATE_ID = "1znL4xPRYt2SoWylNOK1Sr6Ixeubb-e6_brb0GCW3ZYc";
var FOLDER_ID = "12Ikyh_09IfV2gEE1MSfi6idjZL7fO3lC";

function doPost(e) {
  try {
    var payload = JSON.parse(e.parameter.payload);
    var athleteName = payload.athleteName || "Athlete";
    var rows = payload.rows || [];

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

    var url = ss.getUrl();
    return HtmlService.createHtmlOutput(
      "<script>window.location.replace(" + JSON.stringify(url) + ");</script>" +
      "<p>Opening your program&hellip; <a href=\"" + url + "\">Click here if it doesn't redirect.</a></p>"
    );
  } catch (err) {
    return HtmlService.createHtmlOutput("<p>Something went wrong: " + String(err) + "</p>");
  }
}
