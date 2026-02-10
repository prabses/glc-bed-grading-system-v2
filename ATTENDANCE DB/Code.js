/**
 * Google Apps Script for Attendance Database
 * Imports attendance data from OGS template Attendance sheet
 */

function onOpen() {
  const ui = SpreadsheetApp.getUi();

  ui.createMenu("Upload")
    .addItem("Import Student Attendance", "showImportAttendanceDialog")
    .addItem("Update Student Attendance", "showUpdateAttendanceDialog")
    .addToUi();

  ui.createMenu("Manual")
    .addItem("Open Working Instruction", "showWorkingInstructions")
    .addToUi();
}

function getStudentSheets() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = spreadsheet.getSheets();
  const sheetNames = [];
  const yearPattern = /^\d{4}-\d{4}$/;

  for (let i = 0; i < sheets.length; i++) {
    const sheetName = sheets[i].getName().trim();
    if (yearPattern.test(sheetName)) {
      sheetNames.push(sheetName);
    }
  }

  return sheetNames;
}

function showImportAttendanceDialog() {
  const htmlOutput = HtmlService.createHtmlOutputFromFile("ImportAttendanceDialog")
    .setWidth(500)
    .setHeight(550)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

  SpreadsheetApp.getUi().showModalDialog(htmlOutput, "Import Student Attendance");
}

function importAttendance(ogsTemplateUrl, academicYearSheet) {
  const userEmail = Session.getActiveUser().getEmail();
  console.log("Function importAttendance executed by: " + userEmail);
  return callApi("importAttendance", { ogsTemplateUrl, academicYearSheet, userEmail });
}

function showUpdateAttendanceDialog() {
  const htmlOutput = HtmlService.createHtmlOutputFromFile("UpdateAttendanceDialog")
    .setWidth(1100)
    .setHeight(700)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, "Update Student Attendance");
}

function getStudentNumbers(academicYearSheet) {
  try {
    if (!academicYearSheet || academicYearSheet.toString().trim() === '') return [];
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const targetSheet = spreadsheet.getSheetByName(academicYearSheet);
    if (!targetSheet) return [];
    const lastRow = targetSheet.getLastRow();
    if (lastRow < 2) return [];
    const data = targetSheet.getRange(2, 1, lastRow, 1).getValues();
    const formulas = targetSheet.getRange(2, 1, lastRow, 1).getFormulas();
    const unique = new Set();
    for (let i = 0; i < data.length; i++) {
      if (formulas[i][0] && typeof formulas[i][0] === 'string' && formulas[i][0].includes('HYPERLINK')) continue;
      const sn = String(data[i][0] || '').trim();
      if (sn) unique.add(sn);
    }
    return Array.from(unique).sort();
  } catch (e) {
    console.error('getStudentNumbers:', e);
    return [];
  }
}

function getSections(academicYearSheet, studentNumber) {
  try {
    if (!academicYearSheet || !studentNumber) return [];
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const targetSheet = spreadsheet.getSheetByName(academicYearSheet);
    if (!targetSheet) return [];
    const lastRow = targetSheet.getLastRow();
    if (lastRow < 2) return [];
    const data = targetSheet.getRange(2, 1, lastRow, 6).getValues();
    const formulas = targetSheet.getRange(2, 1, lastRow, 1).getFormulas();
    const unique = new Set();
    const sn = studentNumber.toString().trim();
    for (let i = 0; i < data.length; i++) {
      if (formulas[i][0] && typeof formulas[i][0] === 'string' && formulas[i][0].includes('HYPERLINK')) continue;
      if (String(data[i][0] || '').trim() === sn) {
        const sec = String(data[i][3] || '').trim();
        if (sec) unique.add(sec);
      }
    }
    return Array.from(unique).sort();
  } catch (e) {
    console.error('getSections:', e);
    return [];
  }
}

function getMonths(academicYearSheet, studentNumber, section) {
  try {
    if (!academicYearSheet || !studentNumber || !section) return [];
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const targetSheet = spreadsheet.getSheetByName(academicYearSheet);
    if (!targetSheet) return [];
    const lastRow = targetSheet.getLastRow();
    if (lastRow < 2) return [];
    const data = targetSheet.getRange(2, 1, lastRow, 6).getValues();
    const formulas = targetSheet.getRange(2, 1, lastRow, 1).getFormulas();
    const orderSeen = [];
    const seen = new Set();
    const sn = studentNumber.toString().trim();
    const sec = section.toString().trim();
    for (let i = 0; i < data.length; i++) {
      if (formulas[i][0] && typeof formulas[i][0] === 'string' && formulas[i][0].includes('HYPERLINK')) continue;
      if (String(data[i][0] || '').trim() === sn && String(data[i][3] || '').trim() === sec) {
        const mon = String(data[i][5] || '').trim();
        if (mon && !seen.has(mon)) {
          seen.add(mon);
          orderSeen.push(mon);
        }
      }
    }
    return orderSeen;
  } catch (e) {
    console.error('getMonths:', e);
    return [];
  }
}

function getAttendanceInfo(studentNumber, academicYearSheet, section, month) {
  return callApi("getAttendanceInfo", { studentNumber, academicYearSheet, section, month });
}

function updateAttendance(studentNumber, academicYearSheet, section, month, schoolDays, daysPresent, remarks) {
  const userEmail = Session.getActiveUser().getEmail();
  return callApi("updateAttendance", {
    studentNumber,
    academicYearSheet,
    section,
    month,
    schoolDays,
    daysPresent,
    remarks,
    userEmail
  });
}

function showWorkingInstructions() {
  const url = CONFIG.WORKING_INSTRUCTIONS_URL;

  if (!url) {
    SpreadsheetApp.getUi().alert(
      'Configuration Error',
      'Working Instructions URL is not configured in Config.js',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    return;
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <base target="_top">
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 20px;
            text-align: center;
          }
          .message {
            margin-bottom: 30px;
            color: #333;
            font-size: 16px;
          }
          button {
            background-color: #4285f4;
            color: white;
            border: none;
            padding: 12px 24px;
            font-size: 16px;
            cursor: pointer;
            border-radius: 4px;
            font-weight: bold;
          }
          button:hover {
            background-color: #357ae8;
          }
          button:active {
            background-color: #2a5fcf;
          }
        </style>
      </head>
      <body>
        <div class="message">
          <p>Click the button below to open the Working Instructions in a new tab.</p>
        </div>
        <button onclick="openInstructions()">Open Working Instructions</button>
        <script>
          function openInstructions() {
            window.open('${url}', '_blank');
            google.script.host.close();
          }
        </script>
      </body>
    </html>
  `;

  const htmlOutput = HtmlService.createHtmlOutput(htmlContent)
    .setWidth(400)
    .setHeight(200)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

  SpreadsheetApp.getUi().showModalDialog(htmlOutput, "Working Instructions");
}
