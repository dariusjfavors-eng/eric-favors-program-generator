var FOLDER_ID = "12Ikyh_09IfV2gEE1MSfi6idjZL7fO3lC";
var NUM_COLS = 10; // A..J
var COLUMN_HEADERS = ["DONE", "DRILL", "DRILL GOAL", "KEY CUES", "PRESCRIBED", "COMPLETED", "QUALITY", "COACH NOTES", "ATHLETE NOTES", "DEMO"];
var COLUMN_WIDTHS = [70, 170, 190, 260, 95, 95, 90, 220, 160, 130];

var COLORS = {
  darkGreen: "#0B3D2E",
  gold: "#C9A227",
  lightGreen: "#E9F2EA",
  cream: "#FBF3D9",
  white: "#FFFFFF",
  textDark: "#173226",
};

var WEEK_PHASES = [
  "FULL-THROW DEVELOPMENT — QUALITY POSITIONS BEFORE SPEED",
  "BUILD CONSISTENCY — REPEAT THE BEST TECHNICAL FEEL FROM WEEK 1",
  "ADD SPEED — SAME POSITIONS, FASTER EXECUTION",
  "SHARPEN — COMPETITION-READY REPS",
];

function doPost(e) {
  try {
    var payload = JSON.parse(e.parameter.payload);
    var athleteName = payload.athleteName || "Athlete";

    var ss = SpreadsheetApp.create(athleteName + " Throwing Program");
    var file = DriveApp.getFileById(ss.getId());
    var folder = DriveApp.getFolderById(FOLDER_ID);
    folder.addFile(file);
    DriveApp.getRootFolder().removeFile(file);

    var sheet = ss.getSheets()[0];
    sheet.setName("Program");
    setColumnWidths(sheet);

    var row = 1;
    row = writeTitleBand(sheet, row, payload);
    row = writeInfoRows(sheet, row, payload);
    row = writeFocusNotesRows(sheet, row, payload);
    row++; // spacer

    var isCombo = payload.event === "both";
    payload.weeks.forEach(function (week, wIdx) {
      row = writeWeekBand(sheet, row, week, wIdx);
      week.days.forEach(function (day, dIdx) {
        row = writeSessionBand(sheet, row, day, dIdx, isCombo);
        row = writeColumnHeaders(sheet, row);
        var drillCounter = 0;
        day.groups.forEach(function (group) {
          row = writeCategoryLabel(sheet, row, group.label);
          group.drills.forEach(function (drill) {
            row = writeDrillRow(sheet, row, drill, drillCounter % 2 === 0);
            drillCounter++;
          });
        });
        row = writeReflectionRow(sheet, row);
        row++; // spacer between sessions
      });
    });

    if (payload.lifting && payload.lifting.length) {
      row = writeLiftingSection(sheet, row, payload);
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

function setColumnWidths(sheet) {
  for (var c = 0; c < COLUMN_WIDTHS.length; c++) sheet.setColumnWidth(c + 1, COLUMN_WIDTHS[c]);
}

function mergeAndStyle(sheet, row, colStart, colEnd, bg, color, bold, size) {
  var range = sheet.getRange(row, colStart, 1, colEnd - colStart + 1);
  if (colEnd > colStart) range.merge();
  range.setBackground(bg).setFontColor(color).setVerticalAlignment("middle").setWrap(true);
  range.setFontWeight(bold ? "bold" : "normal");
  if (size) range.setFontSize(size);
  return range;
}

function writeTitleBand(sheet, row, payload) {
  sheet.setRowHeight(row, 30);
  sheet.setRowHeight(row + 1, 30);

  mergeAndStyleRows(sheet, row, 2, 1, 2, COLORS.darkGreen, COLORS.white, true, 12)
    .setValue("COACH ERIC FAVORS\nOLYMPIAN · IRELAND");

  var dateStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "Etc/UTC", "yyyy-MM-dd");
  mergeAndStyleRows(sheet, row, 2, 3, NUM_COLS, COLORS.darkGreen, COLORS.white, true, 20)
    .setValue(payload.athleteName + " Throwing Program #" + dateStr);

  return row + 2;
}

function mergeAndStyleRows(sheet, row, numRows, colStart, colEnd, bg, color, bold, size) {
  var range = sheet.getRange(row, colStart, numRows, colEnd - colStart + 1);
  range.merge();
  range.setBackground(bg).setFontColor(color).setVerticalAlignment("middle").setWrap(true);
  range.setFontWeight(bold ? "bold" : "normal");
  if (size) range.setFontSize(size);
  return range;
}

function writeInfoRows(sheet, row, payload) {
  var labels = ["ATHLETE", "EVENT", "TECHNIQUE", "LEVEL", "BLOCK"];
  var values = [
    payload.athleteName,
    eventLabelText(payload),
    techLabelText(payload),
    capitalize(payload.level),
    payload.weeksCount + " weeks · " + payload.days + "x/week",
  ];
  for (var i = 0; i < labels.length; i++) {
    var c = i * 2 + 1;
    mergeAndStyle(sheet, row, c, c + 1, COLORS.darkGreen, COLORS.white, true, 10).setValue(labels[i]);
  }
  row++;
  for (var j = 0; j < values.length; j++) {
    var c2 = j * 2 + 1;
    mergeAndStyle(sheet, row, c2, c2 + 1, COLORS.lightGreen, COLORS.textDark, true, 10).setValue(values[j]);
  }
  return row + 1;
}

function writeFocusNotesRows(sheet, row, payload) {
  mergeAndStyle(sheet, row, 1, 2, COLORS.gold, COLORS.white, true, 10).setValue("BLOCK FOCUS");
  mergeAndStyle(sheet, row, 3, NUM_COLS, COLORS.gold, COLORS.white, false, 10).setValue(payload.focusNote || "");
  row++;
  var coachNote = payload.notes && payload.notes.length
    ? payload.notes
    : "Stay patient through the middle. Record the cue that produces the best throws and bring it into the next session.";
  mergeAndStyle(sheet, row, 1, 2, COLORS.gold, COLORS.white, true, 10).setValue("COACH NOTES");
  mergeAndStyle(sheet, row, 3, NUM_COLS, COLORS.gold, COLORS.white, false, 10).setValue(coachNote);
  return row + 1;
}

function writeWeekBand(sheet, row, week, wIdx) {
  mergeAndStyle(sheet, row, 1, 2, COLORS.darkGreen, COLORS.white, true, 12).setValue("WEEK " + week.index);
  mergeAndStyle(sheet, row, 3, NUM_COLS, COLORS.darkGreen, COLORS.white, true, 11)
    .setValue(WEEK_PHASES[Math.min(wIdx, WEEK_PHASES.length - 1)]);
  return row + 1;
}

function writeSessionBand(sheet, row, day, dIdx, isCombo) {
  mergeAndStyle(sheet, row, 1, 2, COLORS.gold, COLORS.white, true, 10)
    .setValue("SESSION " + (dIdx + 1) + " · " + day.label);
  var subtitle = (isCombo ? day.disciplineLabel : day.disciplineLabel) + " · FULL-THROW DEVELOPMENT";
  mergeAndStyle(sheet, row, 3, NUM_COLS, COLORS.gold, COLORS.white, true, 10).setValue(subtitle.toUpperCase());
  return row + 1;
}

function writeColumnHeaders(sheet, row) {
  var range = sheet.getRange(row, 1, 1, NUM_COLS);
  range.setValues([COLUMN_HEADERS]);
  range.setBackground(COLORS.darkGreen).setFontColor(COLORS.white).setFontWeight("bold");
  range.setHorizontalAlignment("center").setVerticalAlignment("middle");
  sheet.getRange(row, 2).setHorizontalAlignment("left");
  sheet.getRange(row, 3).setHorizontalAlignment("left");
  sheet.getRange(row, 4).setHorizontalAlignment("left");
  sheet.getRange(row, 8).setHorizontalAlignment("left");
  sheet.getRange(row, 9).setHorizontalAlignment("left");
  return row + 1;
}

function writeCategoryLabel(sheet, row, label) {
  mergeAndStyle(sheet, row, 1, NUM_COLS, COLORS.lightGreen, COLORS.textDark, true, 9).setValue(String(label).toUpperCase());
  return row + 1;
}

function writeDrillRow(sheet, row, drill, isEven) {
  var bg = isEven ? COLORS.white : COLORS.lightGreen;
  var cues = (drill.cues || []).map(function (c) { return "• " + c; }).join("\n");
  var noteText = drill.common_mistake
    ? ("Watch: " + drill.common_mistake + (drill.fix ? "\nFix: " + drill.fix : ""))
    : "";
  var values = ["", drill.name || "", drill.goal || "", cues, drill.rep_range || "", "", "", noteText, "", ""];

  var range = sheet.getRange(row, 1, 1, NUM_COLS);
  range.setValues([values]);
  range.setBackground(bg).setVerticalAlignment("top").setWrap(true);

  sheet.getRange(row, 2).setFontWeight("bold");
  sheet.getRange(row, 5).setHorizontalAlignment("center");
  sheet.getRange(row, 1).insertCheckboxes("yes", "no");
  sheet.getRange(row, 7).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(["1", "2", "3", "4", "5"], true).setAllowInvalid(false).build()
  );

  if (drill.video_url) {
    sheet.getRange(row, 10).setFormula('=HYPERLINK("' + drill.video_url + '","Watch demo")');
  }

  return row + 1;
}

function writeReflectionRow(sheet, row) {
  mergeAndStyle(sheet, row, 1, 2, COLORS.cream, COLORS.textDark, true, 9).setValue("SESSION REFLECTION");
  mergeAndStyle(sheet, row, 3, NUM_COLS, COLORS.cream, COLORS.textDark, false, 9)
    .setFontStyle("italic")
    .setValue("What cue produced the best repetitions today? What needs attention in the next session?");
  return row + 1;
}

function writeLiftingSection(sheet, row, payload) {
  mergeAndStyle(sheet, row, 1, 2, COLORS.darkGreen, COLORS.white, true, 12).setValue("LIFTING PROGRAM");
  mergeAndStyle(sheet, row, 3, NUM_COLS, COLORS.darkGreen, COLORS.white, true, 11)
    .setValue(payload.weeksCount + "-Week Block");
  row++;

  payload.lifting.forEach(function (block) {
    mergeAndStyle(sheet, row, 1, NUM_COLS, COLORS.gold, COLORS.white, true, 10).setValue(String(block.title).toUpperCase());
    row++;

    var headers = ["EXERCISE"];
    for (var w = 0; w < payload.weeksCount; w++) headers.push("WEEK " + (w + 1));
    headers.push("DEMO");
    var hdrRange = sheet.getRange(row, 1, 1, headers.length);
    hdrRange.setValues([headers]);
    hdrRange.setBackground(COLORS.darkGreen).setFontColor(COLORS.white).setFontWeight("bold");
    row++;

    block.exercises.forEach(function (ex, i) {
      var bg = i % 2 === 0 ? COLORS.white : COLORS.lightGreen;
      var rowVals = [ex.name].concat(ex.weeks);
      var r = sheet.getRange(row, 1, 1, rowVals.length);
      r.setValues([rowVals]);
      r.setBackground(bg).setWrap(true).setVerticalAlignment("top");
      sheet.getRange(row, 1).setFontWeight("bold");
      if (ex.video_url) {
        sheet.getRange(row, rowVals.length + 1).setFormula('=HYPERLINK("' + ex.video_url + '","Watch")');
        sheet.getRange(row, rowVals.length + 1).setBackground(bg);
      }
      row++;
    });
    row++;
  });

  return row;
}

function eventLabelText(payload) {
  if (payload.event === "both") return "Shot Put + Discus";
  if (payload.event === "discus") return "Discus";
  return "Shot Put";
}

function techLabelText(payload) {
  if (payload.event === "discus") return "Rotational";
  return payload.technique === "spin" ? "Spin" : "Glide";
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
