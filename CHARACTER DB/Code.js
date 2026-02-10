/**
 * Google Apps Script for Character Database
 * Imports character data from OGS template Character sheet
 */

function onOpen() {
  const ui = SpreadsheetApp.getUi();

  ui.createMenu("Upload")
    .addItem("Import Student Character", "showImportCharacterDialog")
    .addItem("Update Student Character", "showUpdateCharacterDialog")
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

function showImportCharacterDialog() {
  const htmlOutput = HtmlService.createHtmlOutputFromFile("ImportCharacterDialog")
    .setWidth(500)
    .setHeight(550)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

  SpreadsheetApp.getUi().showModalDialog(htmlOutput, "Import Student Character");
}

function importCharacters(ogsTemplateUrl, academicYearSheet) {
  const userEmail = Session.getActiveUser().getEmail();
  console.log("Function importCharacters executed by: " + userEmail);
  return callApi("importCharacters", { ogsTemplateUrl, academicYearSheet, userEmail });
}

function showUpdateCharacterDialog() {
  const htmlOutput = HtmlService.createHtmlOutputFromFile("UpdateCharacterDialog")
    .setWidth(1100)
    .setHeight(700)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, "Update Student Character");
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

function getTraits(academicYearSheet, studentNumber, section) {
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
        const trait = String(data[i][5] || '').trim();
        if (trait && !seen.has(trait)) {
          seen.add(trait);
          orderSeen.push(trait);
        }
      }
    }
    return orderSeen;
  } catch (e) {
    console.error('getTraits:', e);
    return [];
  }
}

function getCharacterInfo(studentNumber, academicYearSheet, section, trait) {
  return callApi("getCharacterInfo", { studentNumber, academicYearSheet, section, trait });
}

function updateCharacter(studentNumber, academicYearSheet, section, trait, firstGrade, secondGrade, thirdGrade, fourthGrade, remarks) {
  const userEmail = Session.getActiveUser().getEmail();
  return callApi("updateCharacter", {
    studentNumber,
    academicYearSheet,
    section,
    trait,
    firstGrade,
    secondGrade,
    thirdGrade,
    fourthGrade,
    remarks,
    userEmail
  });
}

function showWorkingInstructions() {
  const url = CONFIG.WORKING_INSTRUCTIONS_URL || 'https://grades-db.vercel.app/';
  const html = '<script>window.open("' + url + '");google.script.host.close();</script>';
  SpreadsheetApp.getUi().showModalDialog(
    HtmlService.createHtmlOutput(html).setWidth(1).setHeight(1),
    'Opening...'
  );
}
