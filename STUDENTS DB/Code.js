/**
 * Google Apps Script for Student Data Import
 * This script provides a menu option to import student data
 * Enhanced with API architecture for secure data operations
 *
 * API functions are located in API.js
 *
 * SETUP NOTE: the .xlsx upload path (importStudentDataXlsx /
 * _convertXlsxToRows_) requires the Drive API Advanced Service.
 * appsscript.json declares it under enabledAdvancedServices, but that
 * alone does not turn it on — on a fresh copy of this project (or after
 * appsscript.json is reset), manually enable it once: Apps Script editor
 * > Services (+ icon in the left sidebar) > Drive API > Add. Then
 * redeploy and accept the re-authorization prompt (it will ask for a
 * Drive scope). Without this step, importStudentDataXlsx fails with
 * "Drive is not defined".
 */

/**
 * Creates the custom menu when the spreadsheet opens
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();

  ui.createMenu("Menu")
    .addItem("View Students", "showViewStudentsDialog")
    .addItem("Import Student Data", "showImportDialog")
    .addItem("Update Student Information", "showUpdateDialog")
    .addSeparator()
    .addItem("Open Working Instruction", "showWorkingInstructions")
    // .addItem("Repair Student Numbers / LRN", "repairCorruptedIdentifiers")
    // .addItem("Convert Student Numbers to Standard Format", "convertStudentNumbersToStandardFormat")
    .addToUi();
}

/**
 * One-time repair for Student Number/LRN cells that were already
 * auto-converted to a Date by Sheets/Excel before the plain-text-format fix
 * existed (or from a manual paste directly into the sheet). Scans every
 * academic-year sheet plus "Other Information", recovers the original text
 * via _readStudentNumberCell_ (Student Number) / the same MM-DD-YYYY
 * reconstruction for LRN, forces the cell to plain-text format, and writes
 * the recovered text back — so future reads/writes no longer see a Date.
 * Safe to re-run; cells that are already text are left untouched.
 */
function repairCorruptedIdentifiers() {
  const ui = SpreadsheetApp.getUi();
  const result = callApi("repairCorruptedIdentifiers", {});
  ui.alert(result.success ? "Repair Complete" : "Repair Failed", result.message, ui.ButtonSet.OK);
}

/**
 * One-time migration to bring legacy 4-digit-segment Student Numbers
 * ("NN-NN-NNNN", e.g. "22-02-0001") up to the current 5-digit-segment
 * standard ("NN-NN-NNNNN", e.g. "22-02-00001") by left-padding the last
 * segment with a zero. Scans every academic-year sheet plus "Other
 * Information". Safe to re-run; cells already in the standard format are
 * left untouched.
 */
function convertStudentNumbersToStandardFormat() {
  const ui = SpreadsheetApp.getUi();
  const result = callApi("convertStudentNumbersToStandardFormat", {});
  ui.alert(result.success ? "Conversion Complete" : "Conversion Failed", result.message, ui.ButtonSet.OK);
}

/**
 * Shows the import dialog with HTML interface
 */
function showImportDialog() {
  const htmlOutput = HtmlService.createHtmlOutputFromFile("StudentImportDialog")
    .setWidth(500)
    .setHeight(550)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

  SpreadsheetApp.getUi().showModalDialog(htmlOutput, "Import Student Data");
}

/**
 * Gets the list of sheets that follow the YYYY-YYYY format (e.g., "2024-2025"),
 * sorted descending (most recent academic year first).
 * @return {Array} Array of sheet names matching the academic year format
 */
function getStudentSheets() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = spreadsheet.getSheets();
  const sheetNames = [];

  // Regular expression to match YYYY-YYYY format (4 digits, hyphen, 4 digits)
  const yearPattern = /^\d{4}-\d{4}$/;

  for (let i = 0; i < sheets.length; i++) {
    const sheetName = sheets[i].getName();
    // Only include sheets that match the YYYY-YYYY format
    if (yearPattern.test(sheetName)) {
      sheetNames.push(sheetName);
    }
  }

  // Descending by starting year, e.g. "2025-2026" before "2024-2025"
  sheetNames.sort(function (a, b) { return b.localeCompare(a); });

  return sheetNames;
}

/**
 * Client-callable function returning the CSV headers + one example row for
 * the import template. Headers are read from Config.js so the downloadable
 * template can never drift out of sync with what _importStudentData
 * actually validates. The example row's Date of Birth uses the exact
 * "MMMM d, yyyy" format the rest of the system expects (see
 * _formatDateOfBirth_ in API.js) — not the ambiguous MM/DD/YYYY slash
 * format, which is easy to mis-enter/misread regionally.
 * @return {{required: string[], optional: string[], exampleRow: string[]}}
 */
function getImportTemplateHeaders() {
  return {
    required: CONFIG.EXPECTED_HEADERS,
    optional: CONFIG.OPTIONAL_IMPORT_HEADERS,
    exampleRow: [
      '22-02-00001', 'Dela Cruz', 'Juan', 'Santos', '5', 'B', '', 'Male',
      '123456789012', 'juan.delacruz@example.com', 'Maria Dela Cruz', 'March 31, 2019'
    ]
  };
}

/**
 * The fixed file name given to the downloaded import template, matching
 * the master Sheet's own tab name ("student_import_template") so what the
 * user sees in Excel after opening the file matches what they downloaded.
 */
const IMPORT_TEMPLATE_NAME = 'student_import_template';

/**
 * Client-callable function that exports the master "student_import_template"
 * Google Sheet (CONFIG.IMPORT_TEMPLATE_SHEET_ID) as .xlsx bytes for
 * download. That master Sheet is maintained by hand — headers, the example
 * row, LRN/Date of Birth plain-text formatting, and the red-highlight
 * conditional formatting rules (see TemplateFormatting.js) — so exporting
 * it directly (rather than generating a template from scratch on every
 * click) is what lets those visual validation rules reach the user; a
 * generated-from-scratch workbook could never carry them.
 * @return {{fileName: string, mimeType: string, base64: string}}
 */
function getImportTemplateFile() {
  const fileId = CONFIG.IMPORT_TEMPLATE_SHEET_ID;

  // Re-assert plain-text format on LRN/Date of Birth right before export.
  // Sheets' xlsx export only reliably writes a column's number format as
  // real Excel "Text" format if the format is freshly applied — a stale
  // format set once when the sheet was built can fail to carry through the
  // export, leaving Excel to auto-detect (and mangle) numeric-looking
  // values on open.
  const templateSpreadsheet = SpreadsheetApp.openById(fileId);
  const templateSheet = templateSpreadsheet.getSheetByName('student_import_template') || templateSpreadsheet.getSheets()[0];
  const headerRow = templateSheet.getRange(1, 1, 1, templateSheet.getLastColumn()).getValues()[0];
  const lrnCol = headerRow.indexOf('LRN') + 1;
  const dobCol = headerRow.indexOf('Date of Birth') + 1;
  const lastRow = Math.max(templateSheet.getLastRow(), 5000);
  if (lrnCol > 0) templateSheet.getRange(2, lrnCol, lastRow - 1).setNumberFormat('@');
  if (dobCol > 0) templateSheet.getRange(2, dobCol, lastRow - 1).setNumberFormat('@');
  SpreadsheetApp.flush();

  const url = 'https://docs.google.com/spreadsheets/d/' + fileId + '/export?format=xlsx';
  const response = UrlFetchApp.fetch(url, {
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }
  });
  const blob = response.getBlob();
  const base64 = Utilities.base64Encode(blob.getBytes());

  return {
    fileName: IMPORT_TEMPLATE_NAME + '.xlsx',
    mimeType: blob.getContentType(),
    base64: base64
  };
}

/**
 * Client-callable function to import student data via API.
 * This function is called from the client-side HTML form.
 * @param {string} csvContent - The CSV content as a string
 * @param {string} academicYearSheet - The name of the target sheet
 * @return {Object} Result object with success status and message
 */
function importStudentData(csvContent, academicYearSheet) {
  console.log(
    "Function importStudentData executed by: " + Session.getActiveUser().getEmail()
  );
  return callApi("importStudentData", { csvContent, academicYearSheet });
}

/**
 * Client-callable function to import student data from an uploaded .xlsx
 * file, bypassing the CSV round-trip entirely (no "Save As CSV" step, and
 * no risk of Excel's CSV export re-mangling an LRN/Date of Birth that was
 * correctly stored as text in the .xlsx). Requires the Drive API Advanced
 * Service to be enabled on this project (Apps Script editor > Services >
 * + > Drive API), since converting xlsx bytes into readable cell values
 * has no built-in Apps Script method — see _convertXlsxToRows_.
 * @param {string} base64Xlsx - The uploaded .xlsx file's bytes, base64-encoded
 * @param {string} academicYearSheet - The name of the target sheet
 * @return {Object} Result object with success status and message
 */
function importStudentDataXlsx(base64Xlsx, academicYearSheet) {
  console.log(
    "Function importStudentDataXlsx executed by: " + Session.getActiveUser().getEmail()
  );
  return callApi("importStudentDataXlsx", { base64Xlsx, academicYearSheet });
}

/**
 * Converts uploaded .xlsx bytes into a 2D array of cell values (row 0 =
 * headers, matching the shape _importStudentRows_ expects). Works by
 * temporarily converting the xlsx into a real Google Sheet via the Drive
 * API (Apps Script has no built-in xlsx parser), reading its values, then
 * deleting the temporary file — mirroring getImportTemplateFile()'s
 * Sheet-to-xlsx export in reverse.
 *
 * REQUIRES the Drive API Advanced Service to be enabled on this project:
 * Apps Script editor > Services (+) > Drive API > Add. Without it, this
 * throws "Drive is not defined".
 * @param {string} base64Xlsx - The uploaded file's bytes, base64-encoded
 * @return {Array<Array<*>>} 2D array of cell values, row 0 = headers
 */
function _convertXlsxToRows_(base64Xlsx) {
  const bytes = Utilities.base64Decode(base64Xlsx);
  const blob = Utilities.newBlob(bytes, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'upload.xlsx');

  // Drive.Files.create with a Google Sheets mimeType override converts the
  // uploaded xlsx into a native Sheet on upload — this is the standard
  // Apps Script pattern for reading xlsx content, since there is no
  // xlsx-parsing library built into the runtime.
  const converted = Drive.Files.create(
    { name: 'temp-import-' + new Date().getTime(), mimeType: 'application/vnd.google-apps.spreadsheet' },
    blob,
    { fields: 'id' }
  );

  try {
    const tempSpreadsheet = SpreadsheetApp.openById(converted.id);
    const sheet = tempSpreadsheet.getSheets()[0];
    const values = sheet.getDataRange().getValues();

    // Only the first 12 columns (A-L) are real template columns — Student
    // Number through Date of Birth. Columns beyond that (Y, Z) are hidden
    // helper columns holding ARRAYFORMULA spills for the Track/Section
    // dropdown validation (see TemplateFormatting.js) and carry formula-
    // driven content across many rows regardless of whether that row has
    // any actual student data — slicing to A-L before filtering blank rows
    // prevents those spills from making an otherwise-empty row look
    // "non-blank" (which would drag in thousands of blank-Student-Number
    // rows) and keeps the returned shape matching what CSV rows look like.
    const templateColumnCount = 12;
    const trimmedValues = values.map(row => row.slice(0, templateColumnCount));

    // Row 0 (headers) is always kept regardless of the blank-row filter
    // below — same as the CSV path, which never filters/validates row 0
    // before treating it as headers.
    const headerRow = trimmedValues[0];
    const dataRows = trimmedValues.slice(1).filter(row => row.some(cell => String(cell || '').trim() !== ''));

    return [headerRow].concat(dataRows).map(row => row.map(cell => {
      if (cell instanceof Date) {
        return Utilities.formatDate(cell, Session.getScriptTimeZone(), 'MM/dd/yyyy');
      }
      return String(cell == null ? '' : cell).trim();
    }));
  } finally {
    // Only ever exists on Drive for the duration of this conversion.
    Drive.Files.remove(converted.id);
  }
}

/**
 * Gets existing student numbers from column A of the sheet (starting from row 3)
 * @param {Sheet} sheet - The target sheet
 * @return {Array} Array of existing student numbers
 */
function getExistingStudentNumbers(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < CONFIG.DATA_START_ROW) {
    return []; // No data rows exist
  }
  
  // Get all student numbers from column A (starting from row 3)
  const studentNumberRange = sheet.getRange(CONFIG.DATA_START_ROW, 1, lastRow - CONFIG.HEADER_ROWS, 1);
  const studentNumbers = studentNumberRange.getValues();
  
  // Flatten the array, recovering any cell that got auto-converted to a
  // Date (e.g. legacy rows written before the plain-text-format fix), and
  // filter out empty values.
  return studentNumbers
    .map(row => _readStudentNumberCell_(row[0]))
    .filter(value => value !== '');
}

/**
 * Parses a single CSV line with proper handling of commas and quotes
 * @param {string} line - The CSV line to parse
 * @return {Array} Array of parsed values
 */
function parseCSVLine(line) {
  const row = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      row.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  row.push(current.trim());
  
  return row;
}

/**
 * Shows the view-only combined student data dialog (academic year roster +
 * Other Information joined by Student Number).
 */
function showViewStudentsDialog() {
  const htmlOutput = HtmlService.createHtmlOutputFromFile("StudentsViewDialog")
    .setWidth(1300)
    .setHeight(700)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

  SpreadsheetApp.getUi().showModalDialog(htmlOutput, "View Students");
}

/**
 * Client-callable function to get the combined roster + Other Information
 * for an academic year sheet. Routed through the API layer (doPost runs as
 * script owner) so it succeeds even if the caller only has protected/
 * view-only access to the underlying sheets.
 * @param {string} academicYearSheet - The academic year sheet name
 * @return {Object} Result object with combined rows or error
 */
function getCombinedStudentData(academicYearSheet) {
  console.log(
    "Function getCombinedStudentData executed by: " + Session.getActiveUser().getEmail()
  );
  return callApi("getCombinedStudentData", { academicYearSheet });
}

/**
 * Shows the update student information dialog
 */
function showUpdateDialog() {
  const htmlOutput = HtmlService.createHtmlOutputFromFile("StudentUpdateDialog")
    .setWidth(1200)
    .setHeight(650)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

  SpreadsheetApp.getUi().showModalDialog(htmlOutput, "Update Student Information");
}

/**
 * Gets the list of available student fields (column headers)
 * @return {Array} Array of field names
 */
function getStudentFields() {
  // Standard student information fields based on the expected format
  return CONFIG.UPDATABLE_FIELDS;
}

/**
 * Client-callable function to get student information via API.
 * This function is called from the client-side HTML form.
 * @param {string} studentNumber - The student number to search for
 * @param {string} academicYearSheet - The academic year sheet name
 * @return {Object} Result object with student data or error
 */
function getStudentInfo(studentNumber, academicYearSheet) {
  console.log(
    "Function getStudentInfo executed by: " + Session.getActiveUser().getEmail()
  );
  return callApi("getStudentInfo", { studentNumber, academicYearSheet });
}

/**
 * Client-callable function to get student numbers from an academic year sheet.
 * This function is called from the client-side HTML form.
 * @param {string} academicYearSheet - The academic year sheet name
 * @return {Array} Array of student numbers
 */
function getStudentNumbers(academicYearSheet) {
  try {
    if (!academicYearSheet || academicYearSheet.toString().trim() === '') {
      return [];
    }
    
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const targetSheet = spreadsheet.getSheetByName(academicYearSheet);
    
    if (!targetSheet) {
      return [];
    }
    
    return getExistingStudentNumbers(targetSheet);
  } catch (error) {
    console.error('Error getting student numbers:', error);
    return [];
  }
}

/**
 * Client-callable function to update student information via API.
 * This function is called from the client-side HTML form.
 * @param {string} studentNumber - The student number
 * @param {string} academicYearSheet - The academic year sheet name
 * @param {string} fieldToUpdate - The field name to update
 * @param {string} newValue - The new value
 * @param {string} remarks - Optional remarks about the update
 * @return {Object} Result object with success status and message
 */
function updateStudentInfo(studentNumber, academicYearSheet, fieldToUpdate, newValue, remarks) {
  const userEmail = Session.getActiveUser().getEmail();
  console.log("Function updateStudentInfo executed by: " + userEmail);
  
  return callApi("updateStudentInfo", {
    studentNumber,
    academicYearSheet,
    fieldToUpdate,
    newValue,
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

/**
 * Logs the update to the Update Log sheet
 * @param {string} studentNumber - The student number
 * @param {string} academicYear - The academic year
 * @param {string} fieldUpdated - The field that was updated
 * @param {string} oldValue - The old value
 * @param {string} newValue - The new value
 * @param {string} remarks - Optional remarks
 * @param {string} userEmail - The email of the user making the update (passed from API)
 */
function logUpdate(studentNumber, academicYear, fieldUpdated, oldValue, newValue, remarks, userEmail) {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    let logSheet = spreadsheet.getSheetByName(CONFIG.SHEET_NAMES.UPDATE_LOG);
    
    // If Update Log sheet doesn't exist, create it
    if (!logSheet) {
      logSheet = spreadsheet.insertSheet(CONFIG.SHEET_NAMES.UPDATE_LOG);
      // Add headers
      const headers = ['Timestamp', 'Updated By', 'Student Number', 'Academic Year', 'Field Updated', 'Old Value', 'New Value', 'Remarks'];
      logSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      logSheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
      logSheet.setFrozenRows(1);
    }
    
    // Use the passed userEmail parameter (from API) instead of Session.getActiveUser()
    // If userEmail is not provided (for backward compatibility), fall back to Session
    const actualUserEmail = userEmail || Session.getActiveUser().getEmail();
    
    // Prepare log entry
    const timestamp = new Date();
    const logEntry = [
      timestamp,
      actualUserEmail,
      studentNumber,
      academicYear,
      fieldUpdated,
      oldValue,
      newValue,
      remarks || ''
    ];
    
    // Find the next empty row and append the log entry
    const lastRow = logSheet.getLastRow();
    const nextRow = lastRow + 1;
    
    logSheet.getRange(nextRow, 1, 1, logEntry.length).setValues([logEntry]);
    logSheet.getRange(nextRow, 1, 1, logEntry.length).setHorizontalAlignment('left');
    
    // Format timestamp column
    logSheet.getRange(nextRow, 1).setNumberFormat('yyyy-MM-dd HH:mm:ss');
    
  } catch (error) {
    console.error('Error logging update:', error);
    // Don't throw error, just log it - the update itself was successful
  }
}
