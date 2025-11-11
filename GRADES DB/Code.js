/**
 * Google Apps Script for Grades Database
 * This script provides functionality for filtering student data by various criteria
 */

/**
 * Creates the custom menu when the spreadsheet opens
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();

  ui.createMenu("Actions")
    .addItem("Filter Student Data", "showStudentFilterDialog")
    .addItem("Import Student Grades", "showImportGradesDialog")
    .addToUi();
}

/**
 * Shows the student filter dialog with HTML interface
 * Only works on sheets containing "MAIN"
 */
function showStudentFilterDialog() {
  const activeSheet = SpreadsheetApp.getActiveSheet();
  const sheetName = activeSheet.getName();
  
  // Check if current sheet contains "MAIN"
  if (!sheetName.includes('MAIN')) {
    SpreadsheetApp.getUi().alert(
      'Access Denied',
      'This function can only be used on sheets containing "MAIN" in the name.\n\nCurrent sheet: ' + sheetName,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    return;
  }
  
  const htmlOutput = HtmlService.createHtmlOutputFromFile("StudentFilterDialog")
    .setWidth(500)
    .setHeight(450)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

  SpreadsheetApp.getUi().showModalDialog(htmlOutput, "Filter Student Data");
}

/**
 * Gets the list of sheets containing "A.Y." (case-insensitive)
 * @return {Array} Array of valid academic year sheet names
 */
function getStudentSheets() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = spreadsheet.getSheets();
  const validAcademicYearSheets = [];
  
  for (let i = 0; i < sheets.length; i++) {
    const sheetName = sheets[i].getName();
    if (sheetName.toLowerCase().includes('a.y.')) {
      validAcademicYearSheets.push(sheetName);
    }
  }
  
  return validAcademicYearSheets;
}

/**
 * Shows the import grades dialog with HTML interface
 * Can be used on any sheet
 */
function showImportGradesDialog() {
  const htmlOutput = HtmlService.createHtmlOutputFromFile("ImportGradesDialog")
    .setWidth(500)
    .setHeight(450)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

  SpreadsheetApp.getUi().showModalDialog(htmlOutput, "Import Student Grades");
}
