/**
 * API.js - API Architecture Layer for Grades Database
 * This file contains all API-related functions for secure data operations
 * 
 * Functions in this file:
 * - doPost() - API endpoint handler
 * - callApi() - API client function
 * - Helper functions (getSpreadsheet, getSheet)
 * - Internal functions (_importGrades)
 */

/**
 * Helper function to get the active spreadsheet
 * @return {GoogleAppsScript.Spreadsheet.Spreadsheet}
 */
function getSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * Helper function to get a sheet by name
 * @param {string} sheetName - The sheet name
 * @return {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getSheet(sheetName) {
  return getSpreadsheet().getSheetByName(sheetName);
}

function getCharacterSpreadsheet() {
  const url = CONFIG.CHARACTER_DB_SHEET_URL;
  if (!url) return null;
  try {
    return SpreadsheetApp.openById(extractSpreadsheetId(url));
  } catch (e) {
    return null;
  }
}

function getCharacterSheet(sheetName) {
  const ss = getCharacterSpreadsheet();
  return ss ? ss.getSheetByName(sheetName) : null;
}

/**
 * doPost handles API requests for writing data.
 * This runs as the script owner, bypassing sheet protections.
 * @param {Object} e - The event object from the POST request.
 * @return {ContentService.TextOutput} JSON response.
 */
function doPost(e) {
  console.log("Function doPost executed by: API/Script Owner");
  const response = (statusCode, message) =>
    ContentService.createTextOutput(
      JSON.stringify({
        statusCode,
        message,
      })
    ).setMimeType(ContentService.MimeType.JSON);

  try {
    const params = JSON.parse(e.postData.contents);
    const { apiKey, action, payload } = params;

    if (apiKey !== CONFIG.API_KEY) {
      return response(401, "Unauthorized: Invalid API Key.");
    }

    switch (action) {
      case "importGrades":
        return response(200, _importGrades(
          payload.ogsTemplateUrl,
          payload.academicYearSheet,
          payload.userEmail
        ));
      case "getGradeInfo":
        return response(200, _getGradeInfo(
          payload.studentNumber,
          payload.academicYearSheet,
          payload.subject
        ));
      case "updateGrades":
        return response(200, _updateGrades(
          payload.studentNumber,
          payload.academicYearSheet,
          payload.subject,
          payload.gradeUpdates,
          payload.remarks,
          payload.userEmail
        ));
      case "getAllGradeInfo":
        return response(200, _getAllGradeInfo(
          payload.studentNumber,
          payload.academicYearSheet,
          payload.gradeLevel
        ));
      case "updateMultipleGrades":
        return response(200, _updateMultipleGrades(
          payload.studentNumber,
          payload.academicYearSheet,
          payload.updates,
          payload.userEmail
        ));
      case "importCharacters":
        return response(200, _importCharacters(
          payload.ogsTemplateUrl,
          payload.academicYearSheet,
          payload.userEmail
        ));
      case "getCharacterInfo":
        return response(200, _getCharacterInfo(
          payload.studentNumber,
          payload.academicYearSheet,
          payload.section,
          payload.trait
        ));
      case "updateCharacter":
        return response(200, _updateCharacter(
          payload.studentNumber,
          payload.academicYearSheet,
          payload.section,
          payload.trait,
          payload.firstGrade,
          payload.secondGrade,
          payload.thirdGrade,
          payload.remarks,
          payload.userEmail
        ));
      case "getSchoolYears":
        return response(200, _getSchoolYears());
      case "getGradeLevelsAndSections":
        return response(200, _getGradeLevelsAndSections(
          payload.academicYearSheet
        ));
      case "getClassGrades":
        return response(200, _getClassGrades(
          payload.academicYearSheet,
          payload.gradeLevel,
          payload.section
        ));
      case "getClassAttendance":
        return response(200, _getClassAttendance(
          payload.academicYearSheet,
          payload.gradeLevel,
          payload.section
        ));
      case "getClassCharacters":
        return response(200, _getClassCharacters(
          payload.academicYearSheet,
          payload.gradeLevel,
          payload.section
        ));
      case "importAttendance":
        return response(200, _importAttendance(
          payload.ogsTemplateUrl,
          payload.academicYearSheet
        ));
      case "getAttendanceInfo":
        return response(200, _getAttendanceInfo(
          payload.studentNumber,
          payload.academicYearSheet,
          payload.section,
          payload.month
        ));
      case "updateAttendance":
        return response(200, _updateAttendance(
          payload.studentNumber,
          payload.academicYearSheet,
          payload.section,
          payload.month,
          payload.schoolDays,
          payload.daysPresent,
          payload.userEmail
        ));

      default:
        return response(400, "Bad Request: Invalid action.");
    }
  } catch (error) {
    console.error("Error in doPost:", error);
    return response(500, `Internal Server Error: ${error.message}`);
  }
}

/**
 * Routes a request to the doPost API.
 * @param {string} action - The action to perform.
 * @param {Object} payload - The data for the action.
 * @return {Object} The JSON response from the API.
 */
function callApi(action, payload) {
  console.log("Function callApi executed by: " + Session.getActiveUser().getEmail());
  const webAppUrl = CONFIG.WEB_APP_URL;
  
  // Check if Web App URL is configured
  if (!webAppUrl || webAppUrl === "YOUR_WEB_APP_URL_HERE") {
    throw new Error("Web App URL not configured. Please deploy the script as a web app and update CONFIG.WEB_APP_URL in Config.js");
  }
  
  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({
      apiKey: CONFIG.API_KEY,
      action: action,
      payload: payload,
    }),
    muteHttpExceptions: true,
  };

  const response = UrlFetchApp.fetch(webAppUrl, options);
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();

  if (responseCode !== 200) {
    console.error(
      `API call failed with response code ${responseCode}. Response: ${responseText}`
    );
    throw new Error(
      `The server responded with an error (${responseCode}). Please check the logs for more details.`
    );
  }

  try {
    const result = JSON.parse(responseText);
    if (result.statusCode !== 200) {
      throw new Error(result.message);
    }
    return result.message;
  } catch (e) {
    console.error(`Failed to parse JSON response: ${responseText}`);
    throw new Error("Received an invalid response from the server.");
  }
}

/**
 * Extracts spreadsheet ID from Google Sheets URL
 * @param {string} url - The Google Sheets URL
 * @return {string} The spreadsheet ID
 */
function extractSpreadsheetId(url) {
  // Handle different URL formats:
  // https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
  // https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit#gid=0
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!match || !match[1]) {
    throw new Error("Invalid Google Sheets URL. Could not extract spreadsheet ID.");
  }
  return match[1];
}

/**
 * Helper function to normalize grade level (removes "Grade " prefix)
 * @param {string} gradeLevel - The grade level (can be "Grade 1" or "1")
 * @return {string} Normalized grade level (just the number)
 */
function normalizeGradeLevel(gradeLevel) {
  if (!gradeLevel) return '';
  const str = String(gradeLevel).trim();
  const cleaned = str.replace(/^Grade\s+/i, '');
  const match = cleaned.match(/^\d+/);
  return match ? match[0] : cleaned;
}

/**
 * Picks the Template Masterfile config key for a grade number, e.g. 6 -> "4-6".
 * @param {number} gradeNum - The grade level as a number (1-12)
 * @return {string|null} One of CONFIG.TEMPLATE_MASTERFILE_URLS' keys, or null if out of range
 */
function _getMasterfileBandForGrade(gradeNum) {
  if (gradeNum >= 1 && gradeNum <= 3) return '1-3';
  if (gradeNum >= 4 && gradeNum <= 6) return '4-6';
  if (gradeNum >= 7 && gradeNum <= 10) return '7-10';
  if (gradeNum >= 11 && gradeNum <= 12) return '11-12';
  return null;
}

/**
 * Verifies that an OGS template spreadsheet was actually generated by the official
 * Template Masterfile for its grade band, by checking that its spreadsheet ID
 * appears in that masterfile's MASTER_DATA sheet (Column E: Template_Link).
 * Only the single matching masterfile is checked (derived from the grade number in
 * the OGS filename), not all four, to keep the import fast.
 * @param {string} ogsSpreadsheetId - The spreadsheet ID of the OGS template being imported
 * @param {string} ogsSpreadsheetName - The OGS template's file name (used to detect grade level)
 * @return {{valid: boolean, message: string}}
 */
function _validateOGSTemplateSource(ogsSpreadsheetId, ogsSpreadsheetName) {
  const gradeMatch = String(ogsSpreadsheetName || '').match(/GRADE-(\d+)/i);
  if (!gradeMatch) {
    return { valid: false, message: 'Could not determine grade level from the OGS file name to verify its source.' };
  }
  const gradeNum = parseInt(gradeMatch[1], 10);
  const band = _getMasterfileBandForGrade(gradeNum);
  if (!band) {
    return { valid: false, message: `Grade ${gradeNum} does not match any known Template Masterfile band.` };
  }

  const masterfileUrl = CONFIG.TEMPLATE_MASTERFILE_URLS && CONFIG.TEMPLATE_MASTERFILE_URLS[band];
  if (!masterfileUrl || masterfileUrl.indexOf('REPLACE_WITH') >= 0) {
    return { valid: false, message: `Template Masterfile URL for grade band ${band} is not configured.` };
  }

  let masterfileSpreadsheet;
  try {
    masterfileSpreadsheet = SpreadsheetApp.openById(extractSpreadsheetId(masterfileUrl));
  } catch (error) {
    return { valid: false, message: `Could not access Template Masterfile (${band}) to verify OGS source. ${error.message}` };
  }

  const masterDataSheet = masterfileSpreadsheet.getSheetByName('MASTER_DATA');
  if (!masterDataSheet || masterDataSheet.getLastRow() < 2) {
    return { valid: false, message: `MASTER_DATA sheet not found or empty in Template Masterfile (${band}).` };
  }

  const lastRow = masterDataSheet.getLastRow();
  const templateLinkFormulas = masterDataSheet.getRange(2, 5, lastRow - 1, 1).getFormulas();
  const found = templateLinkFormulas.some(function(row) {
    const formula = row[0] || '';
    const urlMatch = formula.match(/HYPERLINK\("([^"]+)"/i);
    if (!urlMatch) return false;
    try {
      return extractSpreadsheetId(urlMatch[1]) === ogsSpreadsheetId;
    } catch (e) {
      return false;
    }
  });

  if (!found) {
    return { valid: false, message: `This OGS file was not found in the Template Masterfile (${band}) records. It may not have been generated by the official Template Masterfile.` };
  }
  return { valid: true, message: 'OGS template source verified.' };
}

/**
 * Internal function to import grades from OGS template
 * @param {string} ogsTemplateUrl - The URL of the OGS template Google Sheet
 * @param {string} academicYearSheet - The name of the target academic year sheet
 * @param {string} userEmail - The email of the user making the import
 * @return {Object} Result object with success status and message
 */
function _importGrades(ogsTemplateUrl, academicYearSheet, userEmail) {
  try {
    // Validate inputs
    if (!ogsTemplateUrl || ogsTemplateUrl.toString().trim() === '') {
      return { success: false, message: 'OGS template URL cannot be empty' };
    }
    
    if (!academicYearSheet || academicYearSheet.toString().trim() === '') {
      return { success: false, message: 'Academic year must be specified' };
    }

    // Extract spreadsheet ID from URL
    const spreadsheetId = extractSpreadsheetId(ogsTemplateUrl);
    
    // Open the OGS template spreadsheet
    let ogsSpreadsheet;
    let ogsSpreadsheetName = '';
    try {
      ogsSpreadsheet = SpreadsheetApp.openById(spreadsheetId);
      ogsSpreadsheetName = ogsSpreadsheet.getName();
    } catch (error) {
      return { 
        success: false, 
        message: `Cannot access OGS template. Please ensure the spreadsheet is accessible and the URL is correct. Error: ${error.message}` 
      };
    }

    // Get all sheets from OGS template
    const ogsSheets = ogsSpreadsheet.getSheets();

    // Detect SHS from OGS template filename (GRADE-11 or GRADE-12 in name) - computed
    // early (filename is already known) because the sheet-collection loop below needs
    // it to correctly detect parent subject sheets, which only exist for SHS.
    const isSHS = /GRADE-11|GRADE-12/i.test(ogsSpreadsheetName || '');

    // Find subject sheets and info sheet
    // "MAPEH" is deliberately NOT excluded — it's a real subject sheet with its own
    // isMAPEH-branch import logic below (writes MAPEH + Music/Arts/PE/Health rows).
    // "Music"/"Arts"/"Art"/"PE"/"Physical Education"/"Health" ARE excluded even
    // though they're real per-teacher entry sheets: they always coexist with a
    // MAPEH sheet (_setupMAPEHSheet only gets created when all four are present —
    // see TEMPLATE MASTERFILE GRADE */API.js) and MAPEH's own sub-columns already
    // pull from them. Importing them again standalone would just duplicate the
    // MAPEH sub-component rows under a different subject label (e.g. "PE" next
    // to "Physical Education").
    const excludedSheetNames = [
      'Attendance', 'Character', 'Characters',
      'Music', 'Arts', 'Art', 'PE', 'Physical Education', 'Health'
    ];
    let infoSheet = null;
    let subjectSheets = [];
    
    for (let i = 0; i < ogsSheets.length; i++) {
      const sheetName = ogsSheets[i].getName();
      if (!excludedSheetNames.includes(sheetName)) {
        if (!infoSheet) {
          infoSheet = ogsSheets[i];
        }
        // A parent subject rollup sheet (see _setupParentSubjectSheet in
        // TEMPLATE MASTERFILE GRADE 11-12/API.js) has one extra info row (a
        // "Child Subjects:" marker at B10) compared to a normal SHS subject
        // sheet, which pushes its grading/column headers and data start down
        // by one row - detect it here so dataStartRow below can account for it.
        // Parent subject sheets only exist for SHS (Grade 11-12) non-MAPEH
        // sheets - gating on isSHS and excluding MAPEH is essential: for a
        // Grade 1-10 subject sheet OR a MAPEH sheet (different 28-col layout,
        // see _setupMAPEHSheet), row 10 is real student data, not a marker,
        // and reading it unconditionally would misdetect ordinary classes as
        // "parent sheets" and silently drop their first student row on import.
        const isMAPEHSheet = sheetName === 'MAPEH';
        // Check column A's literal label, not just B10 non-emptiness, so this stays
        // robust even if a future template change puts other text in a normal
        // sheet's row-10 column B.
        const isParentSubject = isSHS && !isMAPEHSheet && String(ogsSheets[i].getRange(10, 1).getValue() || '').trim() === 'Child Subjects:';
        subjectSheets.push({
          name: sheetName,
          sheet: ogsSheets[i],
          isMAPEH: isMAPEHSheet,
          isParentSubject: isParentSubject
        });
      }
    }

    if (!infoSheet) {
      return { 
        success: false, 
        message: 'No subject sheets found in OGS template. Please ensure the template contains at least one subject sheet.' 
      };
    }

    if (subjectSheets.length === 0) {
      return { 
        success: false, 
        message: 'No subject sheets found in OGS template. Please ensure the template contains at least one subject sheet with grades.' 
      };
    }

    const infoData = infoSheet.getRange(2, 1, 5, 2).getValues();
    
    let advisorName = '';
    let schoolYear = '';
    let level = '';
    let section = '';
    
    for (let i = 0; i < infoData.length; i++) {
      const label = String(infoData[i][0] || '').trim();
      const value = String(infoData[i][1] || '').trim();
      
      if (label.includes('Teacher Name') || label.includes('Advisor Name')) {
        advisorName = value;
      } else if (label.includes('School Year')) {
        schoolYear = value;
      } else if (label.includes('Level')) {
        level = value;
      } else if (label.includes('Section')) {
        section = value;
      }
    }

    if (!section || section.toString().trim() === '') {
      section = 'ALL';
    }

    // Validate extracted information
    if (!advisorName || !level || !section) {
      return { 
        success: false, 
        message: 'Could not extract required information from OGS template. Please ensure the template has proper headers (Advisor Name, Level, Section).' 
      };
    }

    // Normalize grade level
    const normalizedGradeLevel = normalizeGradeLevel(level);

    // Get target sheet in GRADES DB
    const targetSpreadsheet = getSpreadsheet();
    let targetSheet = getSheet(academicYearSheet);
    
    if (!targetSheet) {
      return { 
        success: false, 
        message: `Academic year sheet "${academicYearSheet}" not found in GRADES DB. Please ensure the sheet exists.` 
      };
    }

    // Get header row from target sheet (assuming row 1 has headers)
    const headerRow = targetSheet.getRange(1, 1, 1, targetSheet.getLastColumn()).getValues()[0];
    const numColumns = headerRow.length;
    
    // Expected column count: Student#(0), Full Name(1), Grade Level(2), Section(3), Subject(4),
    // Parent Subject(5), Term(6), Track(7), Teacher(8), 1st-3rd Initial/Transmuted/EQ(9-17),
    // Final Grading(18), Final EQ(19)
    const expectedColumnCount = 20;
    
    if (numColumns < expectedColumnCount) {
      return { 
        success: false, 
        message: `Target sheet should have at least ${expectedColumnCount} columns. Found ${numColumns} columns.` 
      };
    }

    const allRows = []; // Array of row data arrays
    const subjectOrderMap = {};
    let firstTrack = '';
    let firstTerm = '';
    for (let i = 0; i < subjectSheets.length; i++) {
      subjectOrderMap[subjectSheets[i].name] = i;
    }

    // Detect parent/child subject sheets (TEMPLATE MASTERFILE GRADE 11-12's parent
    // subject rollup sheets, e.g. "Effective Communication & Mabisang Komunikasyon").
    // A parent sheet is identified by its non-empty "Child Subjects:" marker at cell
    // B10 (written by _setupParentSubjectSheet, and already read into .isParentSubject
    // above) - reading it once, from the already-open workbook, avoids any cross-project
    // API call at import time. Build a reverse map so each child sheet's row can carry
    // its parent's name in the new Parent Subject column.
    const childNameToParentName = {};
    if (isSHS) {
      for (let i = 0; i < subjectSheets.length; i++) {
        const s = subjectSheets[i];
        if (s.isMAPEH || !s.isParentSubject) continue;
        const childSubjectsCell = String(s.sheet.getRange(10, 2).getValue() || '').trim();
        childSubjectsCell.split(',').forEach(function(rawName) {
          const childName = rawName.trim();
          if (childName) childNameToParentName[childName] = s.name;
        });
      }
    }

    for (let i = 0; i < subjectSheets.length; i++) {
      const subjectSheet = subjectSheets[i].sheet;
      const subjectName = subjectSheets[i].name;
      const isMAPEH = subjectSheets[i].isMAPEH || false;
      // A parent subject sheet has one extra info row ("Child Subjects:" at row 10)
      // compared to a normal SHS subject sheet, which pushes its grading/column
      // headers and data start down by one row.
      const isParentSubject = subjectSheets[i].isParentSubject || false;
      const parentSubjectVal = childNameToParentName[subjectName] || '';

      let trackVal = '';
      let termVal = '';
      if (isSHS && !isMAPEH) {
        const trackCell = subjectSheet.getRange(8, 2).getValue();
        const termCell = subjectSheet.getRange(9, 2).getValue();
        trackVal = String(trackCell || '').trim();
        termVal = String(termCell || '').trim();
        if (!firstTrack && trackVal) firstTrack = trackVal;
        if (!firstTerm && termVal) firstTerm = termVal;
      }

      const parentRowOffset = isParentSubject ? 1 : 0; // parent sheets have one extra info row (Child Subjects:)
      const dataStartRow = (isSHS ? 12 : 10) + parentRowOffset;
      const lastRow = subjectSheet.getLastRow();
      if (lastRow < (isSHS ? 11 : 9) + parentRowOffset) continue;
      if (lastRow < dataStartRow) continue;

      if (isMAPEH) {
        // MAPEH sheet layout (_setupMAPEHSheet in TEMPLATE MASTERFILE): 22 cols —
        // Student No, Student Name, then per term (Music, Arts, PE, Health, AVE, AVE EQ) x3,
        // Final Grading, Final EQ. AVE is MAPEH's own already-averaged Initial grade;
        // Music/Arts/PE/Health are the 4 sub-component Initial grades feeding into it.
        // Import 5 rows per student — one for MAPEH itself (using AVE) and one each for
        // the 4 sub-components — all as ordinary Initial-grade rows so the sheet's
        // existing per-column ARRAYFORMULAs (Transmuted/EQ/Final) apply to them exactly
        // like any other subject; no separate formula logic needed.
        const numColumnsNeeded = 22;
        const dataRange = subjectSheet.getRange(dataStartRow, 1, lastRow - dataStartRow + 1, numColumnsNeeded);
        const data = dataRange.getValues();

        const mapehSubjects = [
          { name: 'MAPEH',             t1: 6,  t2: 12, t3: 18 }, // AVE columns
          { name: 'Music',             t1: 2,  t2: 8,  t3: 14 },
          { name: 'Arts',              t1: 3,  t2: 9,  t3: 15 },
          { name: 'Physical Education', t1: 4, t2: 10, t3: 16 },
          { name: 'Health',            t1: 5,  t2: 11, t3: 17 }
        ];

        for (let j = 0; j < data.length; j++) {
          const row = data[j];
          const studentNumber = String(row[0] || '').trim();
          const studentName = String(row[1] || '').trim();
          if (!studentNumber) continue;

          for (let s = 0; s < mapehSubjects.length; s++) {
            const sub = mapehSubjects[s];
            const rowData = new Array(expectedColumnCount);
            rowData[0] = studentNumber;
            rowData[1] = studentName;
            rowData[2] = normalizedGradeLevel;
            rowData[3] = section;
            rowData[4] = sub.name;
            rowData[5] = ''; // Parent Subject - MAPEH's sub-components use their own hardcoded grouping, not this mechanism
            rowData[6] = 'N/A';
            rowData[7] = 'N/A';
            rowData[8] = advisorName;
            rowData[9]  = row[sub.t1] || ''; // 1st Initial
            rowData[10] = '';                // 1st Transmuted (ARRAYFORMULA)
            rowData[11] = '';                // 1st EQ (ARRAYFORMULA)
            rowData[12] = row[sub.t2] || ''; // 2nd Initial
            rowData[13] = '';                // 2nd Transmuted
            rowData[14] = '';                // 2nd EQ
            rowData[15] = row[sub.t3] || ''; // 3rd Initial
            rowData[16] = '';                // 3rd Transmuted
            rowData[17] = '';                // 3rd EQ
            rowData[18] = '';                // Final Grading (ARRAYFORMULA)
            rowData[19] = '';                // Final EQ (ARRAYFORMULA)
            allRows.push(rowData);
          }
        }
      } else if (isSHS) {
        // SHS OGS template now has 3 term periods: cols 6,12,18 (1-based) = indices 5,11,17
        const numColumnsNeeded = 22;
        const dataRange = subjectSheet.getRange(dataStartRow, 1, lastRow - dataStartRow + 1, numColumnsNeeded);
        const data = dataRange.getValues();

        for (let j = 0; j < data.length; j++) {
          const row = data[j];
          const studentNumber = String(row[0] || '').trim();
          const studentName = String(row[1] || '').trim();
          if (!studentNumber) continue;

          const rowData = new Array(expectedColumnCount);
          rowData[0] = studentNumber;
          rowData[1] = studentName;
          rowData[2] = normalizedGradeLevel;
          rowData[3] = section;
          rowData[4] = subjectName;
          rowData[5] = parentSubjectVal; // '' for standalone subjects and parent sheets themselves; parent's name for child sheets
          rowData[6] = termVal || 'N/A';
          rowData[7] = trackVal || 'N/A';
          rowData[8] = advisorName;
          rowData[9] = row[5] || '';   // 1st Initial
          rowData[10] = '';            // 1st Transmuted (ARRAYFORMULA)
          rowData[11] = '';            // 1st EQ (ARRAYFORMULA)
          rowData[12] = row[11] || ''; // 2nd Initial
          rowData[13] = '';            // 2nd Transmuted
          rowData[14] = '';            // 2nd EQ
          rowData[15] = row[17] || ''; // 3rd Initial
          rowData[16] = '';            // 3rd Transmuted
          rowData[17] = '';            // 3rd EQ
          rowData[18] = '';            // Final Grading (ARRAYFORMULA)
          rowData[19] = '';            // Final EQ (ARRAYFORMULA)
          allRows.push(rowData);
        }
      } else {
        // Grade 1-10 OGS template now has 3 term periods: cols 6,12,18 (1-based) = indices 5,11,17
        const numColumnsNeeded = 22;
        const dataRange = subjectSheet.getRange(dataStartRow, 1, lastRow - dataStartRow + 1, numColumnsNeeded);
        const data = dataRange.getValues();

        for (let j = 0; j < data.length; j++) {
          const row = data[j];
          const studentNumber = String(row[0] || '').trim();
          const studentName = String(row[1] || '').trim();
          if (!studentNumber) continue;

          const rowData = new Array(expectedColumnCount);
          rowData[0] = studentNumber;
          rowData[1] = studentName;
          rowData[2] = normalizedGradeLevel;
          rowData[3] = section;
          rowData[4] = subjectName;
          rowData[5] = ''; // Parent Subject - not applicable to Grade 1-10 (out of scope for this feature)
          rowData[6] = 'N/A';
          rowData[7] = 'N/A';
          rowData[8] = advisorName;
          rowData[9] = row[5] || '';   // 1st Initial
          rowData[10] = '';            // 1st Transmuted (ARRAYFORMULA)
          rowData[11] = '';            // 1st EQ (ARRAYFORMULA)
          rowData[12] = row[11] || ''; // 2nd Initial
          rowData[13] = '';            // 2nd Transmuted
          rowData[14] = '';            // 2nd EQ
          rowData[15] = row[17] || ''; // 3rd Initial
          rowData[16] = '';            // 3rd Transmuted
          rowData[17] = '';            // 3rd EQ
          rowData[18] = '';            // Final Grading (ARRAYFORMULA)
          rowData[19] = '';            // Final EQ (ARRAYFORMULA)
          allRows.push(rowData);
        }
      }
    }

    if (allRows.length === 0) {
      return { 
        success: false, 
        message: 'No student grades found in OGS template. Please ensure the template contains student data.' 
      };
    }

    // Sort rows by Subject order (as they appear in OGS template), then by Student Number
    // This groups all students for the same subject together, preserving template order
    allRows.sort(function(a, b) {
      const subjectA = String(a[4] || '').trim();
      const subjectB = String(b[4] || '').trim();
      if (subjectA !== subjectB) {
        // Use the order from OGS template (subjectOrderMap)
        const orderA = subjectOrderMap.hasOwnProperty(subjectA) ? subjectOrderMap[subjectA] : 9999;
        const orderB = subjectOrderMap.hasOwnProperty(subjectB) ? subjectOrderMap[subjectB] : 9999;
        return orderA - orderB;
      }
      // If same subject, sort by student number
      const studentNumA = String(a[0] || '').trim();
      const studentNumB = String(b[0] || '').trim();
      return studentNumA.localeCompare(studentNumB);
    });

    // Get existing data to check for duplicates (Student Number + Subject combination)
    // Find the actual last row with data (check column A for Student Number)
    const maxRows = targetSheet.getMaxRows();
    const studentNumberColumn = targetSheet.getRange(2, 1, maxRows - 1, 1).getValues();
    let lastDataRow = 1;
    
    for (let i = studentNumberColumn.length - 1; i >= 0; i--) {
      const studentNum = String(studentNumberColumn[i][0] || '').trim();
      if (studentNum) {
        lastDataRow = i + 2;
        break;
      }
    }
    
    const existingKeys = new Map();
    const existingDataMap = new Map();
    
    // Check if this OGS template was already imported (check for existing divider with same URL)
    let isReImport = false;
    let existingDividerRow = null;
    let existingImportEndRow = null;
    
    if (lastDataRow > 1) {
      const existingRange = targetSheet.getRange(2, 1, lastDataRow - 1, numColumns);
      const existingValues = existingRange.getValues();
      const existingFormulas = targetSheet.getRange(2, 1, lastDataRow - 1, 1).getFormulas();
      
      // Check for existing divider with same URL
      // Normalize URLs for comparison (remove trailing slashes, fragments, etc.)
      const normalizedImportUrl = ogsTemplateUrl.trim().split('#')[0].replace(/\/$/, '').toLowerCase();
      
      for (let i = 0; i < existingFormulas.length; i++) {
        const formula = existingFormulas[i][0];
        if (formula && typeof formula === 'string' && formula.includes('HYPERLINK')) {
          // Try multiple regex patterns to extract URL
          let urlMatch = formula.match(/HYPERLINK\("([^"]+)"/);
          if (!urlMatch) {
            urlMatch = formula.match(/HYPERLINK\('([^']+)'/);
          }
          if (!urlMatch) {
            urlMatch = formula.match(/HYPERLINK\(([^,]+)/);
          }
          if (urlMatch && urlMatch[1]) {
            let extractedUrl = urlMatch[1].trim();
            // Remove quotes if present
            extractedUrl = extractedUrl.replace(/^["']|["']$/g, '');
            const normalizedExistingUrl = extractedUrl.split('#')[0].replace(/\/$/, '').toLowerCase();
            
            // Compare URLs (handle both full URLs and spreadsheet IDs)
            const importSpreadsheetId = extractSpreadsheetId(ogsTemplateUrl);
            const existingSpreadsheetId = extractSpreadsheetId(extractedUrl);
            const urlMatches = normalizedExistingUrl === normalizedImportUrl || 
                              (importSpreadsheetId && existingSpreadsheetId && importSpreadsheetId === existingSpreadsheetId);
            
            if (urlMatches) {
              isReImport = true;
              existingDividerRow = i + 2;
              // Find the end of this import block (next divider or end of data)
              existingImportEndRow = lastDataRow + 1;
              for (let j = i + 1; j < existingFormulas.length; j++) {
                const nextFormula = existingFormulas[j][0];
                if (nextFormula && typeof nextFormula === 'string' && nextFormula.includes('HYPERLINK')) {
                  // Found next divider, so this import ends at row j+1 (before the next divider)
                  existingImportEndRow = j + 2;
                  break;
                }
              }
              break;
            }
          }
        }
      }
      
      // Build maps of existing data
      for (let i = 0; i < existingValues.length; i++) {
        const studentNum = String(existingValues[i][0] || '').trim();
        const subject = String(existingValues[i][4] || '').trim();
        if (studentNum && subject) {
          const key = `${studentNum}|${subject}`;
          existingKeys.set(key, i + 2);
          existingDataMap.set(key, existingValues[i]);
        }
      }
    }

    // Use the passed userEmail parameter (from API) instead of Session.getActiveUser()
    // doPost runs as script owner, so Session.getActiveUser() would return owner's email
    const actualUserEmail = userEmail || Session.getActiveUser().getEmail();

    // Prepare data for import/update
    const rowsToUpdate = [];
    const rowsToInsert = [];
    const gradeChangesToLog = [];
    
    for (let i = 0; i < allRows.length; i++) {
      const rowData = allRows[i];
      const studentNumber = String(rowData[0] || '').trim();
      const subject = String(rowData[4] || '').trim();
      const key = `${studentNumber}|${subject}`;
      
      if (existingKeys.has(key)) {
        const existingRowNum = existingKeys.get(key);
        const existingRow = existingDataMap.get(key);
        
        // Check if this is a re-import of the same OGS template
        const isFromSameImport = isReImport && existingDividerRow && existingImportEndRow &&
                                 existingRowNum > existingDividerRow && 
                                 existingRowNum < existingImportEndRow;
        
        // Always compare grades before updating (1st, 2nd, 3rd Initial - cols 9, 12, 15)
        const gradeColumns = [9, 12, 15];
        const periodNames = ['1st Initial', '2nd Initial', '3rd Initial'];
        let hasChanges = false;
        const changes = [];
        
        for (let j = 0; j < gradeColumns.length; j++) {
          const colIndex = gradeColumns[j];
          const oldValueRaw = existingRow[colIndex];
          const newValueRaw = rowData[colIndex];
          const oldValue = oldValueRaw !== null && oldValueRaw !== undefined ? String(oldValueRaw).trim() : '';
          const newValue = newValueRaw !== null && newValueRaw !== undefined ? String(newValueRaw).trim() : '';
          
          // Compare values (handle numbers and strings)
          // Convert to numbers if possible, otherwise compare as strings
          let valuesDifferent = false;
          if (oldValue && newValue) {
            const oldNum = parseFloat(oldValue);
            const newNum = parseFloat(newValue);
            if (!isNaN(oldNum) && !isNaN(newNum)) {
              valuesDifferent = Math.abs(oldNum - newNum) > 0.0001;
            } else {
              valuesDifferent = oldValue !== newValue;
            }
          } else if (oldValue !== newValue) {
            valuesDifferent = true;
          }
          
          if (valuesDifferent) {
            hasChanges = true;
            if (isFromSameImport) {
              changes.push({
                period: periodNames[j],
                oldValue: oldValue || '',
                newValue: newValue || ''
              });
            }
          }
        }
        
        if (hasChanges) {
          rowsToUpdate.push({
            row: existingRowNum,
            data: rowData
          });
          
          // Only log if it's from the same import (re-import scenario)
          if (isFromSameImport && changes.length > 0) {
            const fullName = String(rowData[1] || '').trim();
            for (let k = 0; k < changes.length; k++) {
              gradeChangesToLog.push({
                studentNumber: studentNumber,
                fullName: fullName,
                subject: subject,
                period: changes[k].period,
                oldValue: changes[k].oldValue,
                newValue: changes[k].newValue
              });
            }
          }
        }
      } else {
        // Insert new row
        rowsToInsert.push(rowData);
      }
    }

    // Perform updates
    for (let i = 0; i < rowsToUpdate.length; i++) {
      const update = rowsToUpdate[i];
      targetSheet.getRange(update.row, 1, 1, numColumns).setValues([update.data]);
    }
    
    // Log grade changes from re-import
    for (let i = 0; i < gradeChangesToLog.length; i++) {
      const change = gradeChangesToLog[i];
      logUpdate(
        change.studentNumber,
        change.fullName,
        academicYearSheet,
        change.subject,
        change.period,
        change.oldValue,
        change.newValue,
        `Re-imported from: ${ogsSpreadsheetName || 'OGS Template'}`,
        actualUserEmail
      );
    }

    // Perform inserts
    if (rowsToInsert.length > 0) {
      const insertRow = lastDataRow + 1;
      
      // Add divider row with imported file link before the new data
      const linkLabel = ogsSpreadsheetName || 'OGS Template';
      const dividerRow = new Array(numColumns);
      dividerRow[0] = '';
      for (let i = 1; i < numColumns; i++) {
        dividerRow[i] = '';
      }
      
      // Insert divider row
      targetSheet.getRange(insertRow, 1, 1, numColumns).setValues([dividerRow]);
      targetSheet.getRange(insertRow, 1, 1, numColumns).merge();
      
      // Set hyperlink formula in the merged cell
      const hyperlinkFormula = `=HYPERLINK("${ogsTemplateUrl}","${linkLabel}")`;
      targetSheet.getRange(insertRow, 1).setFormula(hyperlinkFormula);
      
      // Style the divider row
      targetSheet.getRange(insertRow, 1).setBackground('#d9d9d9');
      targetSheet.getRange(insertRow, 1).setFontStyle('italic');
      targetSheet.getRange(insertRow, 1).setFontColor('#1155cc');
      targetSheet.getRange(insertRow, 1).setFontSize(10);
      targetSheet.getRange(insertRow, 1).setHorizontalAlignment('left');
      targetSheet.getRange(insertRow, 1).setVerticalAlignment('middle');
      targetSheet.setRowHeight(insertRow, 25);
      
      // Insert data rows after the divider
      const dataInsertRow = insertRow + 1;
      targetSheet.getRange(dataInsertRow, 1, rowsToInsert.length, numColumns).setValues(rowsToInsert);
    }

    const updatedCount = rowsToUpdate.length;
    const insertedCount = rowsToInsert.length;
    const totalSubjects = subjectSheets.length;

    return { 
      success: true, 
      message: `Successfully imported grades from ${totalSubjects} subject(s).\n\n` +
               `Updated: ${updatedCount} student(s)\n` +
               `Inserted: ${insertedCount} student(s)\n\n` +
               `Advisor: ${advisorName}\n` +
               `School Year: ${schoolYear}\n` +
               `Level: ${level}\n` +
               `Section: ${section}`,
      gradeLevel: normalizedGradeLevel,
      section: section,
      teacher: advisorName,
      term: firstTerm || 'N/A',
      track: firstTrack || 'N/A'
    };

  } catch (error) {
    console.error('Error importing grades:', error);
    return { 
      success: false, 
      message: `Error importing grades: ${error.toString()}` 
    };
  }
}

/**
 * Internal function to get grade information for a student-subject combination.
 * @param {string} studentNumber - The student number
 * @param {string} academicYearSheet - The academic year sheet name
 * @param {string} subject - The subject name
 * @return {Object} Result object with grade data or error
 */
function _getGradeInfo(studentNumber, academicYearSheet, subject) {
  try {
    if (!studentNumber || studentNumber.toString().trim() === '') {
      return { success: false, message: 'Student number cannot be empty' };
    }
    
    if (!academicYearSheet || academicYearSheet.toString().trim() === '') {
      return { success: false, message: 'Academic year must be specified' };
    }
    
    if (!subject || subject.toString().trim() === '') {
      return { success: false, message: 'Subject must be specified' };
    }
    
    const targetSheet = getSheet(academicYearSheet);
    
    if (!targetSheet) {
      return { success: false, message: 'Academic year sheet not found' };
    }
    
    const lastRow = targetSheet.getLastRow();
    if (lastRow < 2) {
      return { success: false, message: 'No grade data found in the sheet' };
    }
    
    // Get header row to find column indices
    const headerRow = targetSheet.getRange(1, 1, 1, targetSheet.getLastColumn()).getValues()[0];
    
    // Expected column order: Student Number (0), Full Name (1), Grade Level (2), Section (3),
    // Subject (4), Parent Subject (5), Term (6), Track (7), Teacher (8),
    // 1st Initial (9), 1st Transmuted (10), 1st EQ (11),
    // 2nd Initial (12), 2nd Transmuted (13), 2nd EQ (14),
    // 3rd Initial (15), 3rd Transmuted (16), 3rd EQ (17),
    // Final Grading (18), Final EQ (19)

    // Get all data starting from row 2
    const dataRange = targetSheet.getRange(2, 1, lastRow - 1, headerRow.length);
    const data = dataRange.getValues();

    // Find the row matching student number and subject
    for (let i = 0; i < data.length; i++) {
      const rowStudentNum = String(data[i][0] || '').trim();
      const rowSubject = String(data[i][4] || '').trim();

      if (rowStudentNum === studentNumber.toString().trim() &&
          rowSubject === subject.toString().trim()) {
        return {
          success: true,
          gradeData: {
            'Student Number': data[i][0],
            'Full Name': data[i][1],
            'Grade Level': data[i][2],
            'Section': data[i][3],
            'Subject': data[i][4],
            'Parent Subject': data[i][5] || '',
            'Term': data[i][6] || '',
            'Track': data[i][7] || '',
            'Teacher': data[i][8],
            '1st Initial': data[i][9] || '',
            '1st Transmuted': data[i][10] || '',
            '1st EQ': data[i][11] || '',
            '2nd Initial': data[i][12] || '',
            '2nd Transmuted': data[i][13] || '',
            '2nd EQ': data[i][14] || '',
            '3rd Initial': data[i][15] || '',
            '3rd Transmuted': data[i][16] || '',
            '3rd EQ': data[i][17] || '',
            'Final Grading': data[i][18] || '',
            'Final EQ': data[i][19] || ''
          },
          rowIndex: i + 2 // Actual row number in sheet (1-based, +1 for header)
        };
      }
    }
    
    return { success: false, message: 'Grade record not found for the specified student and subject' };
    
  } catch (error) {
    console.error('Error getting grade info:', error);
    return { 
      success: false, 
      message: `Error retrieving grade data: ${error.toString()}` 
    };
  }
}

/**
 * Internal function to update grades and log the changes.
 * @param {string} studentNumber - The student number
 * @param {string} academicYearSheet - The academic year sheet name
 * @param {string} subject - The subject name
 * @param {Object} gradeUpdates - Object with period keys (1st Initial, 2nd Initial, etc.) and new values
 * @param {string} remarks - Optional remarks about the update
 * @param {string} userEmail - The email of the user making the update
 * @return {Object} Result object with success status and message
 */
function _updateGrades(studentNumber, academicYearSheet, subject, gradeUpdates, remarks, userEmail) {
  try {
    if (!studentNumber || studentNumber.toString().trim() === '') {
      return { success: false, message: 'Student number cannot be empty' };
    }
    
    if (!academicYearSheet || academicYearSheet.toString().trim() === '') {
      return { success: false, message: 'Academic year must be specified' };
    }
    
    if (!subject || subject.toString().trim() === '') {
      return { success: false, message: 'Subject must be specified' };
    }
    
    if (!gradeUpdates || Object.keys(gradeUpdates).length === 0) {
      return { success: false, message: 'No grade updates provided' };
    }
    
    const targetSheet = getSheet(academicYearSheet);
    
    if (!targetSheet) {
      return { success: false, message: 'Academic year sheet not found' };
    }
    
    // Get current grade information
    const gradeInfo = _getGradeInfo(studentNumber, academicYearSheet, subject);
    
    if (!gradeInfo.success) {
      return gradeInfo;
    }
    
    // Column mapping for initial grades (0-based indices)
    const columnMap = {
      '1st Initial': 9,
      '2nd Initial': 12,
      '3rd Initial': 15
    };

    // Period order for chronological logging
    const periodOrder = ['1st Initial', '2nd Initial', '3rd Initial'];
    
    const updatedPeriods = [];
    const rowIndex = gradeInfo.rowIndex;
    const updatesToLog = []; // Collect updates to log in chronological order
    
    // Process updates in chronological order
    for (let i = 0; i < periodOrder.length; i++) {
      const period = periodOrder[i];
      
      if (!gradeUpdates.hasOwnProperty(period) || !columnMap.hasOwnProperty(period)) {
        continue; // Skip if not provided or invalid
      }
      
      const newValue = gradeUpdates[period];
      const trimmedNewValue = newValue !== null && newValue !== undefined ? String(newValue).trim() : '';
      const oldValue = gradeInfo.gradeData[period] || '';
      const trimmedOldValue = oldValue !== null && oldValue !== undefined ? String(oldValue).trim() : '';
      
      // Check if the value is actually changing
      if (trimmedOldValue === trimmedNewValue) {
        continue; // Skip if no change
      }
      
      // Update the cell
      const columnIndex = columnMap[period] + 1; // Convert to 1-based index
      targetSheet.getRange(rowIndex, columnIndex).setValue(trimmedNewValue);
      
      // Store update for logging in chronological order
      updatesToLog.push({
        period: period,
        oldValue: trimmedOldValue,
        newValue: trimmedNewValue
      });
      
      updatedPeriods.push(period);
    }
    
    // Log updates in chronological order
    for (let i = 0; i < updatesToLog.length; i++) {
      const update = updatesToLog[i];
      logUpdate(
        studentNumber,
        gradeInfo.gradeData['Full Name'],
        academicYearSheet,
        subject,
        update.period,
        update.oldValue,
        update.newValue,
        remarks || '',
        userEmail
      );
    }
    
    if (updatedPeriods.length === 0) {
      return { success: false, message: 'No grades were updated. All values are the same as current values.' };
    }
    
    return { 
      success: true, 
      message: `Successfully updated ${updatedPeriods.length} grade period(s) for ${subject}:\n${updatedPeriods.join(', ')}` 
    };
    
  } catch (error) {
    console.error('Error updating grades:', error);
    return { 
      success: false, 
      message: `Error updating grades: ${error.toString()}` 
    };
  }
}

/**
 * Logs the grade update to the UPDATE LOG sheet
 * @param {string} studentNumber - The student number
 * @param {string} fullName - The student's full name
 * @param {string} academicYear - The academic year (sheet name)
 * @param {string} subject - The subject name
 * @param {string} period - The grading period (1st Initial, 2nd Initial, etc.)
 * @param {string} originalGrade - The original grade value
 * @param {string} updatedGrade - The updated grade value
 * @param {string} remarks - Optional remarks
 * @param {string} userEmail - The email of the user making the update
 */
function logUpdate(studentNumber, fullName, academicYear, subject, period, originalGrade, updatedGrade, remarks, userEmail) {
  try {
    const spreadsheet = getSpreadsheet();
    let logSheet = spreadsheet.getSheetByName('UPDATE LOG');
    
    // If UPDATE LOG sheet doesn't exist, create it
    if (!logSheet) {
      logSheet = spreadsheet.insertSheet('UPDATE LOG');
      // Add headers
      const headers = ['Timestamp', 'Updated By', 'Student Number', 'Full Name', 'School Year', 'Subject', 'Period', 'Original Grade', 'Updated Grade', 'Remarks'];
      logSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      logSheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
      logSheet.setFrozenRows(1);
    }
    
    // Use the passed userEmail parameter (from API) instead of Session.getActiveUser()
    const actualUserEmail = userEmail || Session.getActiveUser().getEmail();
    
    // Prepare log entry
    const timestamp = new Date();
    const logEntry = [
      timestamp,
      actualUserEmail,
      studentNumber,
      fullName,
      academicYear,
      subject,
      period,
      originalGrade,
      updatedGrade,
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

function _importLogHyperlink(url, label) {
  if (!url || !label) return '';
  return '=HYPERLINK("' + String(url).replace(/"/g, '""') + '","' + String(label).replace(/"/g, '""') + '")';
}

/**
 * Appends one row to the IMPORT LOG sheet (created if missing).
 * @param {string} ogsTemplateUrl - OGS template sheet URL
 * @param {string} academicYearSheet - Academic year sheet name
 * @param {string} userEmail - User who ran the import
 * @param {string} [gradeLevel] - Grade level from OGS template
 * @param {string} [section] - Section from OGS template
 * @param {string} [term] - Term (SHS) or N/A
 * @param {string} [track] - Track (SHS) or N/A
 * @param {string} [teacher] - Teacher/Advisor name from OGS template
 * @param {string} [spreadsheetId] - Grades DB spreadsheet ID (use when active spreadsheet is not set, e.g. when run from dialog)
 */
function logImport(ogsTemplateUrl, academicYearSheet, userEmail, gradeLevel, section, term, track, teacher, spreadsheetId) {
  try {
    const spreadsheet = spreadsheetId ? SpreadsheetApp.openById(spreadsheetId) : getSpreadsheet();
    let logSheet = spreadsheet.getSheetByName('IMPORT LOG');
    if (!logSheet) {
      logSheet = spreadsheet.insertSheet('IMPORT LOG');
      const headers = ['Timestamp', 'Imported By', 'Academic Year', 'Grade Level', 'Section', 'Term', 'Track', 'Teacher', 'OGS Template Link', 'Grades DB Link', 'Character DB Link', 'Attendance DB Link'];
      logSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      logSheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
      logSheet.setFrozenRows(1);
    }
    const timestamp = new Date();
    const ogsLink = _importLogHyperlink(ogsTemplateUrl, 'OGS Template');
    const gradesDbLink = _importLogHyperlink(CONFIG.GRADES_DB_SHEET_URL || '', CONFIG.GRADES_DB_SHEET_LABEL || 'Grades DB');
    const characterDbLink = _importLogHyperlink(CONFIG.CHARACTER_DB_SHEET_URL || '', CONFIG.CHARACTER_DB_SHEET_LABEL || 'Character DB');
    const attendanceDbLink = _importLogHyperlink(CONFIG.ATTENDANCE_DB_SHEET_URL || '', CONFIG.ATTENDANCE_DB_SHEET_LABEL || 'Attendance DB');
    const logEntry = [
      timestamp,
      userEmail || '',
      academicYearSheet || '',
      gradeLevel || '',
      section || '',
      term || '',
      track || '',
      teacher || '',
      ogsLink,
      gradesDbLink,
      characterDbLink,
      attendanceDbLink
    ];
    const lastRow = logSheet.getLastRow();
    const nextRow = lastRow + 1;
    logSheet.getRange(nextRow, 1, 1, logEntry.length).setValues([logEntry]);
    logSheet.getRange(nextRow, 1, 1, logEntry.length).setHorizontalAlignment('left');
    logSheet.getRange(nextRow, 1).setNumberFormat('yyyy-MM-dd HH:mm:ss');
  } catch (error) {
    console.error('Error logging import:', error);
  }
}

const CHAR_EXPECTED_COLS = 14;
const CHAR_HEADER_ROW = ['Student#', 'Full Name', 'Grade Level', 'Section', 'Advisor', 'Trait', '1st Grade', '1st EQ', '2nd Grade', '2nd EQ', '3rd Grade', '3rd EQ', 'Final Grading', 'Final EQ'];

function logCharacterUpdate(studentNumber, fullName, academicYear, trait, period, originalValue, updatedValue, remarks, userEmail) {
  try {
    const spreadsheet = getCharacterSpreadsheet();
    if (!spreadsheet) return;
    let logSheet = spreadsheet.getSheetByName('UPDATE LOG');
    if (!logSheet) {
      logSheet = spreadsheet.insertSheet('UPDATE LOG');
      const headers = ['Timestamp', 'Updated By', 'Student Number', 'Full Name', 'School Year', 'Trait', 'Period', 'Original Value', 'Updated Value', 'Remarks'];
      logSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      logSheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
      logSheet.setFrozenRows(1);
    }
    const actualUserEmail = userEmail || Session.getActiveUser().getEmail();
    const logEntry = [new Date(), actualUserEmail, studentNumber, fullName, academicYear, trait || '', period || '', originalValue, updatedValue, remarks || ''];
    const nextRow = logSheet.getLastRow() + 1;
    logSheet.getRange(nextRow, 1, 1, logEntry.length).setValues([logEntry]);
    logSheet.getRange(nextRow, 1, 1, logEntry.length).setHorizontalAlignment('left');
    logSheet.getRange(nextRow, 1).setNumberFormat('yyyy-MM-dd HH:mm:ss');
  } catch (error) {
    console.error('Error logging character update:', error);
  }
}

function _importCharacters(ogsTemplateUrl, academicYearSheet, userEmail) {
  try {
    if (!ogsTemplateUrl || ogsTemplateUrl.toString().trim() === '') return { success: false, message: 'OGS template URL cannot be empty' };
    if (!academicYearSheet || academicYearSheet.toString().trim() === '') return { success: false, message: 'Academic year must be specified' };
    const spreadsheetId = extractSpreadsheetId(ogsTemplateUrl);
    let ogsSpreadsheet;
    let ogsSpreadsheetName = '';
    try {
      ogsSpreadsheet = SpreadsheetApp.openById(spreadsheetId);
      ogsSpreadsheetName = ogsSpreadsheet.getName();
    } catch (error) {
      return { success: false, message: `Cannot access OGS template. Error: ${error.message}` };
    }
    const characterSheet = ogsSpreadsheet.getSheetByName('Character');
    if (!characterSheet) return { success: false, message: 'Character sheet not found in OGS template.' };
    const infoData = characterSheet.getRange(1, 1, 5, 2).getValues();
    let advisorName = '';
    let schoolYear = '';
    let level = '';
    let section = '';
    for (let i = 0; i < infoData.length; i++) {
      const label = String(infoData[i][0] || '').trim();
      const value = String(infoData[i][1] || '').trim();
      if (label.includes('Advisor Name') || label.includes('Teacher Name')) advisorName = value;
      else if (label.includes('School Year')) schoolYear = value;
      else if (label.includes('Level')) level = value;
      else if (label.includes('Section')) section = value;
    }
    if (!section || section.toString().trim() === '') section = 'ALL';
    if (!advisorName || !level || !section) return { success: false, message: 'Could not extract required information from Character sheet.' };
    const normalizedGradeLevel = normalizeGradeLevel(level);
    const lastCol = characterSheet.getLastColumn();
    const lastRow = characterSheet.getLastRow();
    if (lastRow < 8) return { success: false, message: 'No student character data found in Character sheet.' };
    // Character sheet now has 3 term columns: cols D,F,H (indices 3,5,7) for grades
    const dataStartRow = 8;
    const studentData = characterSheet.getRange(dataStartRow, 1, lastRow, lastCol).getValues();
    const allRows = [];
    for (let j = 0; j < studentData.length; j++) {
      const row = studentData[j];
      const studentNumber = String(row[0] || '').trim();
      const studentName = String(row[1] || '').trim();
      const trait = String(row[2] || '').trim();
      if (!studentNumber || !trait) continue;
      const targetRow = new Array(CHAR_EXPECTED_COLS);
      targetRow[0] = studentNumber; targetRow[1] = studentName; targetRow[2] = normalizedGradeLevel; targetRow[3] = section; targetRow[4] = advisorName; targetRow[5] = trait;
      targetRow[6] = row[3] !== undefined ? String(row[3]).trim() : '';  // 1st Grade
      targetRow[7] = '';                                                  // 1st EQ (ARRAYFORMULA)
      targetRow[8] = row[5] !== undefined ? String(row[5]).trim() : '';  // 2nd Grade
      targetRow[9] = '';                                                  // 2nd EQ (ARRAYFORMULA)
      targetRow[10] = row[7] !== undefined ? String(row[7]).trim() : ''; // 3rd Grade
      targetRow[11] = '';                                                 // 3rd EQ (ARRAYFORMULA)
      targetRow[12] = '';                                                 // Final Grading (ARRAYFORMULA)
      targetRow[13] = '';                                                 // Final EQ (ARRAYFORMULA)
      allRows.push(targetRow);
    }
    if (allRows.length === 0) return { success: false, message: 'No student character records found in Character sheet.' };
    const targetSheet = getCharacterSheet(academicYearSheet);
    if (!targetSheet) return { success: false, message: `Academic year sheet "${academicYearSheet}" not found in Character DB.` };
    if (targetSheet.getLastRow() < 1) {
      targetSheet.getRange(1, 1, 1, CHAR_EXPECTED_COLS).setValues([CHAR_HEADER_ROW]);
      targetSheet.getRange(1, 1, 1, CHAR_EXPECTED_COLS).setFontWeight('bold');
    }
    const headerRow = targetSheet.getRange(1, 1, 1, Math.max(targetSheet.getLastColumn(), CHAR_EXPECTED_COLS)).getValues()[0];
    const numColumns = Math.max(headerRow.length, CHAR_EXPECTED_COLS);
    if (numColumns < CHAR_EXPECTED_COLS) return { success: false, message: `Target sheet should have at least ${CHAR_EXPECTED_COLS} columns. Found ${numColumns}.` };
    const rangeEnd = Math.max(2, targetSheet.getLastRow());
    const studentNumberColumn = targetSheet.getRange(2, 1, rangeEnd, 1).getValues();
    const lastRowFormulas = targetSheet.getRange(2, 1, rangeEnd, 1).getFormulas();
    let lastDataRow = 1;
    for (let i = studentNumberColumn.length - 1; i >= 0; i--) {
      if (lastRowFormulas[i][0] && typeof lastRowFormulas[i][0] === 'string' && lastRowFormulas[i][0].includes('HYPERLINK')) continue;
      const studentNum = String(studentNumberColumn[i][0] || '').trim();
      if (studentNum) { lastDataRow = i + 2; break; }
    }
    const existingKeys = new Map();
    const existingDataMap = new Map();
    let isReImport = false;
    let existingDividerRow = null;
    let existingImportEndRow = null;
    if (lastDataRow > 1) {
      const existingRange = targetSheet.getRange(2, 1, lastDataRow, numColumns);
      const existingValues = existingRange.getValues();
      const existingFormulas = targetSheet.getRange(2, 1, lastDataRow, 1).getFormulas();
      const normalizedImportUrl = ogsTemplateUrl.trim().split('#')[0].replace(/\/$/, '').toLowerCase();
      for (let i = 0; i < existingFormulas.length; i++) {
        const formula = existingFormulas[i][0];
        if (formula && typeof formula === 'string' && formula.includes('HYPERLINK')) {
          const urlMatch = formula.match(/HYPERLINK\("([^"]+)"/) || formula.match(/HYPERLINK\('([^']+)'/);
          if (urlMatch && urlMatch[1]) {
            const extractedUrl = urlMatch[1].trim().replace(/^["']|["']$/g, '');
            const normalizedExistingUrl = extractedUrl.split('#')[0].replace(/\/$/, '').toLowerCase();
            const importId = extractSpreadsheetId(ogsTemplateUrl);
            const existingId = extractedUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1];
            if (normalizedExistingUrl === normalizedImportUrl || (importId && existingId && importId === existingId)) {
              isReImport = true;
              existingDividerRow = i + 2;
              existingImportEndRow = lastDataRow + 1;
              for (let j = i + 1; j < existingFormulas.length; j++) {
                if (existingFormulas[j][0] && typeof existingFormulas[j][0] === 'string' && existingFormulas[j][0].includes('HYPERLINK')) { existingImportEndRow = j + 2; break; }
              }
              break;
            }
          }
        }
      }
      for (let i = 0; i < existingValues.length; i++) {
        const studentNum = String(existingValues[i][0] || '').trim();
        const rowSection = String(existingValues[i][3] || '').trim();
        const trait = String(existingValues[i][5] || '').trim();
        if (studentNum && rowSection && trait) {
          existingKeys.set(`${studentNum}|${rowSection}|${trait}`, i + 2);
          existingDataMap.set(`${studentNum}|${rowSection}|${trait}`, existingValues[i]);
        }
      }
    }
    const actualUserEmail = userEmail || Session.getActiveUser().getEmail();
    const rowsToUpdate = [];
    const rowsToInsert = [];
    const characterChangesToLog = [];
    const gradeColIndices = [6, 8, 10];
    const gradeNames = ['1st Grade', '2nd Grade', '3rd Grade'];
    for (let i = 0; i < allRows.length; i++) {
      const rowData = allRows[i];
      const studentNumber = String(rowData[0] || '').trim();
      const trait = String(rowData[5] || '').trim();
      const key = `${studentNumber}|${section}|${trait}`;
      if (existingKeys.has(key)) {
        const existingRowNum = existingKeys.get(key);
        const existingRow = existingDataMap.get(key);
        const isFromSameImport = isReImport && existingDividerRow && existingImportEndRow && existingRowNum > existingDividerRow && existingRowNum < existingImportEndRow;
        let hasChanges = false;
        const dataToWrite = rowData.slice();
        for (let g = 0; g < gradeColIndices.length; g++) {
          const col = gradeColIndices[g];
          const oldVal = existingRow[col] !== null && existingRow[col] !== undefined ? String(existingRow[col]).trim() : '';
          const newVal = rowData[col] !== null && rowData[col] !== undefined ? String(rowData[col]).trim() : '';
          if (oldVal !== newVal) {
            hasChanges = true;
            if (isFromSameImport) characterChangesToLog.push({ studentNumber, fullName: String(rowData[1] || '').trim(), trait, period: gradeNames[g], oldValue: oldVal, newValue: newVal });
          }
        }
        for (let c = 7; c <= 11; c += 2) if (existingRow[c] !== undefined) dataToWrite[c] = existingRow[c];
        if (existingRow[12] !== undefined) dataToWrite[12] = existingRow[12];
        if (existingRow[13] !== undefined) dataToWrite[13] = existingRow[13];
        if (hasChanges) rowsToUpdate.push({ row: existingRowNum, data: dataToWrite });
      } else {
        rowsToInsert.push(rowData);
      }
    }
    for (let i = 0; i < rowsToUpdate.length; i++) {
      const update = rowsToUpdate[i];
      const padData = update.data.slice();
      while (padData.length < numColumns) padData.push('');
      targetSheet.getRange(update.row, 1, 1, numColumns).setValues([padData.slice(0, numColumns)]);
    }
    for (let i = 0; i < characterChangesToLog.length; i++) {
      const c = characterChangesToLog[i];
      logCharacterUpdate(c.studentNumber, c.fullName, academicYearSheet, c.trait, c.period, c.oldValue, c.newValue, `Re-imported from: ${ogsSpreadsheetName || 'OGS Template'}`, actualUserEmail);
    }
    if (rowsToInsert.length > 0) {
      const insertRow = lastDataRow + 1;
      const linkLabel = ogsSpreadsheetName || 'OGS Template';
      const dividerRow = new Array(numColumns).fill('');
      targetSheet.getRange(insertRow, 1, 1, numColumns).setValues([dividerRow]);
      targetSheet.getRange(insertRow, 1, 1, numColumns).merge();
      targetSheet.getRange(insertRow, 1).setFormula(`=HYPERLINK("${ogsTemplateUrl}","${linkLabel}")`);
      targetSheet.getRange(insertRow, 1).setBackground('#d9d9d9').setFontStyle('italic').setFontColor('#1155cc').setFontSize(10).setHorizontalAlignment('left').setVerticalAlignment('middle');
      targetSheet.setRowHeight(insertRow, 25);
      const dataInsertRow = insertRow + 1;
      const paddedRows = rowsToInsert.map(r => { const arr = r.slice(); while (arr.length < numColumns) arr.push(''); return arr.slice(0, numColumns); });
      targetSheet.getRange(dataInsertRow, 1, paddedRows.length, numColumns).setValues(paddedRows);
    }
    return { success: true, message: `Successfully imported character data.\n\nUpdated: ${rowsToUpdate.length} row(s)\nInserted: ${rowsToInsert.length} row(s)\n\nAdvisor: ${advisorName}\nSchool Year: ${schoolYear}\nLevel: ${level}\nSection: ${section}` };
  } catch (error) {
    console.error('Error importing characters:', error);
    return { success: false, message: `Error importing character data: ${error.toString()}` };
  }
}

function _getCharacterInfo(studentNumber, academicYearSheet, section, trait) {
  try {
    if (!studentNumber || studentNumber.toString().trim() === '') return { success: false, message: 'Student number cannot be empty' };
    if (!academicYearSheet || academicYearSheet.toString().trim() === '') return { success: false, message: 'Academic year must be specified' };
    if (!section || section.toString().trim() === '') return { success: false, message: 'Section must be specified' };
    if (!trait || trait.toString().trim() === '') return { success: false, message: 'Trait must be specified' };
    const targetSheet = getCharacterSheet(academicYearSheet);
    if (!targetSheet) return { success: false, message: 'Academic year sheet not found' };
    const lastRow = targetSheet.getLastRow();
    if (lastRow < 2) return { success: false, message: 'No character data found in the sheet' };
    const numCols = Math.max(CHAR_EXPECTED_COLS, targetSheet.getLastColumn());
    const data = targetSheet.getRange(2, 1, lastRow, numCols).getValues();
    const formulas = targetSheet.getRange(2, 1, lastRow, 1).getFormulas();
    const studentNum = studentNumber.toString().trim();
    const sectionTrim = section.toString().trim();
    const traitTrim = trait.toString().trim();
    for (let i = 0; i < data.length; i++) {
      if (formulas[i][0] && typeof formulas[i][0] === 'string' && formulas[i][0].includes('HYPERLINK')) continue;
      const row = data[i];
      if (String(row[0] || '').trim() === studentNum && String(row[3] || '').trim() === sectionTrim && String(row[5] || '').trim() === traitTrim) {
        return { success: true, characterData: { 'Student Number': row[0], 'Full Name': row[1], 'Grade Level': row[2], 'Section': row[3], 'Advisor': row[4], 'Trait': row[5], '1st Grade': row[6] || '', '1st EQ': row[7] || '', '2nd Grade': row[8] || '', '2nd EQ': row[9] || '', '3rd Grade': row[10] || '', '3rd EQ': row[11] || '', 'Final Grading': row[12] || '', 'Final EQ': row[13] || '' }, rowIndex: i + 2 };
      }
    }
    return { success: false, message: 'Character record not found for the specified student, section, and trait' };
  } catch (error) {
    console.error('Error getting character info:', error);
    return { success: false, message: `Error retrieving character data: ${error.toString()}` };
  }
}

function _updateCharacter(studentNumber, academicYearSheet, section, trait, firstGrade, secondGrade, thirdGrade, remarks, userEmail) {
  try {
    if (!studentNumber || studentNumber.toString().trim() === '') return { success: false, message: 'Student number cannot be empty' };
    if (!academicYearSheet || academicYearSheet.toString().trim() === '') return { success: false, message: 'Academic year must be specified' };
    if (!section || section.toString().trim() === '') return { success: false, message: 'Section must be specified' };
    if (!trait || trait.toString().trim() === '') return { success: false, message: 'Trait must be specified' };
    const info = _getCharacterInfo(studentNumber, academicYearSheet, section, trait);
    if (!info.success) return info;
    const targetSheet = getCharacterSheet(academicYearSheet);
    const rowIndex = info.rowIndex;
    const updates = [];
    const actualUserEmail = userEmail || Session.getActiveUser().getEmail();
    const gradeUpdates = [{ col: 7, key: '1st Grade', value: firstGrade }, { col: 9, key: '2nd Grade', value: secondGrade }, { col: 11, key: '3rd Grade', value: thirdGrade }];
    for (let u = 0; u < gradeUpdates.length; u++) {
      const g = gradeUpdates[u];
      if (g.value === undefined || g.value === null) continue;
      const oldVal = String(info.characterData[g.key] || '').trim();
      const newVal = String(g.value).trim();
      if (oldVal !== newVal) {
        targetSheet.getRange(rowIndex, g.col).setValue(newVal);
        logCharacterUpdate(studentNumber, info.characterData['Full Name'], academicYearSheet, info.characterData['Trait'], g.key, oldVal, newVal, remarks || '', actualUserEmail);
        updates.push(g.key);
      }
    }
    if (updates.length === 0) return { success: false, message: 'No changes detected. All values are the same as current values.' };
    return { success: true, message: `Successfully updated: ${updates.join(', ')}` };
  } catch (error) {
    console.error('Error updating character:', error);
    return { success: false, message: `Error updating character: ${error.toString()}` };
  }
}

function _getAllGradeInfo(studentNumber, academicYearSheet, gradeLevel) {
  try {
    if (!studentNumber || studentNumber.toString().trim() === '') {
      return { success: false, message: 'Student number cannot be empty' };
    }
    
    if (!academicYearSheet || academicYearSheet.toString().trim() === '') {
      return { success: false, message: 'Academic year must be specified' };
    }
    
    if (!gradeLevel || gradeLevel.toString().trim() === '') {
      return { success: false, message: 'Grade level must be specified' };
    }
    
    const targetSheet = getSheet(academicYearSheet);
    
    if (!targetSheet) {
      return { success: false, message: 'Academic year sheet not found' };
    }
    
    const lastRow = targetSheet.getLastRow();
    if (lastRow < 2) {
      return { success: false, message: 'No grade data found in the sheet' };
    }
    
    const headerRow = targetSheet.getRange(1, 1, 1, targetSheet.getLastColumn()).getValues()[0];
    const dataRange = targetSheet.getRange(2, 1, lastRow - 1, headerRow.length);
    const data = dataRange.getValues();
    const formulas = targetSheet.getRange(2, 1, lastRow - 1, 1).getFormulas();
    
    const gradeLevelTrim = gradeLevel.toString().trim();
    const allGradeData = [];
    let studentInfo = null;
    
    for (let i = 0; i < data.length; i++) {
      const formula = formulas[i][0];
      if (formula && typeof formula === 'string' && formula.includes('HYPERLINK')) {
        continue;
      }
      
      const rowStudentNum = String(data[i][0] || '').trim();
      const rowGradeLevel = String(data[i][2] || '').trim();
      const rowSubject = String(data[i][4] || '').trim();

      if (rowStudentNum === studentNumber.toString().trim() && rowGradeLevel === gradeLevelTrim && rowSubject) {
        if (!studentInfo) {
          studentInfo = {
            'Student Number': data[i][0],
            'Full Name': data[i][1],
            'Grade Level': data[i][2],
            'Section': data[i][3],
            'Track': data[i][7] || ''
          };
        }

        allGradeData.push({
          'Subject': data[i][4],
          'Parent Subject': data[i][5] || '',
          'Term': data[i][6] || '',
          'Track': data[i][7] || '',
          'Teacher': data[i][8],
          '1st Initial': data[i][9] || '',
          '1st Transmuted': data[i][10] || '',
          '1st EQ': data[i][11] || '',
          '2nd Initial': data[i][12] || '',
          '2nd Transmuted': data[i][13] || '',
          '2nd EQ': data[i][14] || '',
          '3rd Initial': data[i][15] || '',
          '3rd Transmuted': data[i][16] || '',
          '3rd EQ': data[i][17] || '',
          'Final Grading': data[i][18] || '',
          'Final EQ': data[i][19] || ''
        });
      }
    }
    
    if (allGradeData.length === 0) {
      return { success: false, message: 'No grade records found for the specified student and grade level' };
    }
    
    return {
      success: true,
      studentInfo: studentInfo,
      gradeData: allGradeData
    };
    
  } catch (error) {
    console.error('Error getting all grade info:', error);
    return { 
      success: false, 
      message: `Error retrieving grade data: ${error.toString()}` 
    };
  }
}

function _updateMultipleGrades(studentNumber, academicYearSheet, updates, userEmail) {
  try {
    if (!studentNumber || studentNumber.toString().trim() === '') {
      return { success: false, message: 'Student number cannot be empty' };
    }
    
    if (!academicYearSheet || academicYearSheet.toString().trim() === '') {
      return { success: false, message: 'Academic year must be specified' };
    }
    
    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return { success: false, message: 'No updates provided' };
    }
    
    const results = [];
    let totalUpdated = 0;
    let totalPeriodsUpdated = 0;
    
    for (let i = 0; i < updates.length; i++) {
      const update = updates[i];
      const { subject, gradeUpdates, remarks } = update;
      
      if (!subject || !gradeUpdates || Object.keys(gradeUpdates).length === 0) {
        continue;
      }
      
      const updateResult = _updateGrades(
        studentNumber,
        academicYearSheet,
        subject,
        gradeUpdates,
        remarks || '',
        userEmail
      );
      
      if (updateResult.success) {
        totalUpdated++;
        const periodCount = Object.keys(gradeUpdates).length;
        totalPeriodsUpdated += periodCount;
        results.push({
          subject: subject,
          success: true,
          message: updateResult.message
        });
      } else {
        results.push({
          subject: subject,
          success: false,
          message: updateResult.message
        });
      }
    }
    
    if (totalUpdated === 0) {
      return { 
        success: false, 
        message: 'No grades were updated. Please check your input values.' 
      };
    }
    
    return {
      success: true,
      message: `Successfully updated ${totalPeriodsUpdated} grade period(s) across ${totalUpdated} subject(s)`,
      results: results
    };
    
  } catch (error) {
    console.error('Error updating multiple grades:', error);
    return {
      success: false,
      message: `Error updating grades: ${error.toString()}`
    };
  }
}

// ---------------------------------------------------------------------------
// CLASS-LEVEL READS — for Reports Web App
// ---------------------------------------------------------------------------

/**
 * Returns all academic year sheet tab names (e.g. ["2025-2026", "2024-2025"]).
 */
function _getSchoolYears() {
  try {
    const ss = getSpreadsheet();
    const yearPattern = /^\d{4}-\d{4}$/;
    const years = ss.getSheets()
      .map(s => s.getName())
      .filter(name => yearPattern.test(name))
      .sort()
      .reverse();
    return { success: true, data: years };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

/**
 * Returns all unique grade levels and their sections from a given academic year sheet.
 * @param {string} academicYearSheet - Sheet tab name (e.g. "2025-2026")
 * @return {Object} { success, data: { gradeLevel: [sections] } }
 */
function _getGradeLevelsAndSections(academicYearSheet) {
  try {
    const targetSheet = getSheet(academicYearSheet);
    if (!targetSheet) {
      return { success: false, message: `Sheet "${academicYearSheet}" not found.` };
    }

    const lastRow = targetSheet.getLastRow();
    if (lastRow < 2) return { success: true, data: {} };

    const data = targetSheet.getRange(2, 1, lastRow - 1, 4).getValues();
    const formulas = targetSheet.getRange(2, 1, lastRow - 1, 1).getFormulas();
    const result = {};

    for (let i = 0; i < data.length; i++) {
      if (formulas[i][0] && formulas[i][0].includes('HYPERLINK')) continue;
      const grade   = String(data[i][2] || '').trim();
      const section = String(data[i][3] || '').trim();
      // "ALL" is a subject-tagging convention (see _getClassGrades), not a
      // section any student actually belongs to - never offer it as a
      // selectable class to generate/view reports for.
      if (!grade || !section || section.toUpperCase() === 'ALL') continue;
      if (!result[grade]) result[grade] = new Set();
      result[grade].add(section);
    }

    // Convert Sets to sorted arrays
    const out = {};
    Object.keys(result).sort((a, b) => parseInt(a) - parseInt(b)).forEach(g => {
      out[g] = Array.from(result[g]).sort();
    });

    return { success: true, data: out };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

/**
 * Returns all grade records for every student in a given class (grade + section).
 * Used by the REPORTS web app for bulk report card generation.
 * @param {string} academicYearSheet - Sheet tab name (e.g. "2025-2026")
 * @param {string} gradeLevel - Normalized grade level (e.g. "1", "11")
 * @param {string} section - Section name (e.g. "A")
 * @return {Object} { success, students: { [studentNumber]: { studentInfo, grades: [...] } } }
 */
function _getClassGrades(academicYearSheet, gradeLevel, section) {
  try {
    if (!academicYearSheet || !gradeLevel || !section) {
      return { success: false, message: 'academicYearSheet, gradeLevel, and section are required.' };
    }

    const targetSheet = getSheet(academicYearSheet);
    if (!targetSheet) {
      return { success: false, message: `Sheet "${academicYearSheet}" not found in Grades DB.` };
    }

    const lastRow = targetSheet.getLastRow();
    if (lastRow < 2) {
      return { success: false, message: 'No grade data found in the sheet.' };
    }

    const numCols = targetSheet.getLastColumn();
    const data = targetSheet.getRange(2, 1, lastRow - 1, numCols).getValues();
    const formulas = targetSheet.getRange(2, 1, lastRow - 1, 1).getFormulas();

    const normalizedLevel = normalizeGradeLevel(gradeLevel);
    const sectionTrim = section.toString().trim();

    const students = {};

    for (let i = 0; i < data.length; i++) {
      if (formulas[i][0] && formulas[i][0].includes('HYPERLINK')) continue;

      const row = data[i];
      const studentNumber = String(row[0] || '').trim();
      const rowGradeLevel = String(row[2] || '').trim();
      const rowSection = String(row[3] || '').trim();
      const subject = String(row[4] || '').trim();

      if (!studentNumber || !subject) continue;
      if (rowGradeLevel !== normalizedLevel) continue;
      // Section="ALL" on a subject row means it applies to every section of
      // this grade (e.g. an SHS elective shared across sections) - include it
      // alongside rows matching the requested section exactly.
      if (rowSection !== sectionTrim && rowSection.toUpperCase() !== 'ALL') continue;

      if (!students[studentNumber]) {
        students[studentNumber] = {
          studentInfo: {
            studentNumber: row[0],
            fullName:      row[1],
            gradeLevel:    row[2],
            // Always the section actually requested, not row[3] - an ALL-tagged
            // subject row must not overwrite the student's real section if it
            // happens to be the first row seen for them.
            section:       sectionTrim,
            track:        row[7] || ''
          },
          grades: []
        };
      }

      students[studentNumber].grades.push({
        subject:         subject,
        parentSubject:   row[5]  || '',
        term:            row[6]  || '',
        track:          row[7]  || '',
        teacher:         row[8]  || '',
        t1Initial:       row[9]  || '',
        t1Transmuted:    row[10] || '',
        t1EQ:            row[11] || '',
        t2Initial:       row[12] || '',
        t2Transmuted:    row[13] || '',
        t2EQ:            row[14] || '',
        t3Initial:       row[15] || '',
        t3Transmuted:    row[16] || '',
        t3EQ:            row[17] || '',
        finalGrading:    row[18] || '',
        finalEQ:         row[19] || ''
      });
    }

    if (Object.keys(students).length === 0) {
      return { success: false, message: 'No grade records found for the specified class.' };
    }

    return { success: true, students: students };

  } catch (error) {
    console.error('Error in _getClassGrades:', error);
    return { success: false, message: `Error retrieving class grades: ${error.toString()}` };
  }
}

/**
 * Returns all attendance records for every student in a given class (grade + section).
 * Used by the REPORTS web app for bulk report card generation.
 * @param {string} academicYearSheet - Sheet tab name (e.g. "2025-2026")
 * @param {string} gradeLevel - Normalized grade level (e.g. "1", "11")
 * @param {string} section - Section name (e.g. "A")
 * @return {Object} { success, attendance: { [studentNumber]: { [month]: { schoolDays, daysPresent, daysAbsent } } } }
 */
function _getClassAttendance(academicYearSheet, gradeLevel, section) {
  try {
    if (!academicYearSheet || !gradeLevel || !section) {
      return { success: false, message: 'academicYearSheet, gradeLevel, and section are required.' };
    }

    const targetSheet = getAttendanceSheet(academicYearSheet);
    if (!targetSheet) {
      return { success: false, message: `Sheet "${academicYearSheet}" not found in Attendance DB.` };
    }

    const lastRow = targetSheet.getLastRow();
    if (lastRow < 2) {
      return { success: false, message: 'No attendance data found in the sheet.' };
    }

    const numCols = Math.max(ATTEND_EXPECTED_COLS, targetSheet.getLastColumn());
    const data = targetSheet.getRange(2, 1, lastRow - 1, numCols).getValues();
    const formulas = targetSheet.getRange(2, 1, lastRow - 1, 1).getFormulas();

    const normalizedLevel = normalizeGradeLevel(gradeLevel);
    const sectionTrim = section.toString().trim();

    const attendance = {};

    for (let i = 0; i < data.length; i++) {
      if (formulas[i][0] && formulas[i][0].includes('HYPERLINK')) continue;

      const row = data[i];
      const studentNumber = String(row[0] || '').trim();
      const rowGradeLevel = String(row[2] || '').trim();
      const rowSection    = String(row[3] || '').trim();
      const month         = String(row[5] || '').trim();

      if (!studentNumber || !month) continue;
      if (rowGradeLevel !== normalizedLevel || rowSection !== sectionTrim) continue;

      if (!attendance[studentNumber]) {
        attendance[studentNumber] = {
          fullName: String(row[1] || '').trim(),
          months: {}
        };
      }

      attendance[studentNumber].months[month] = {
        schoolDays:  row[6] !== undefined ? row[6] : '',
        daysPresent: row[7] !== undefined ? row[7] : '',
        daysAbsent:  row[8] !== undefined ? row[8] : ''
      };
    }

    return { success: true, attendance: attendance };

  } catch (error) {
    console.error('Error in _getClassAttendance:', error);
    return { success: false, message: `Error retrieving class attendance: ${error.toString()}` };
  }
}

/**
 * Bulk-fetches Values Education/Character trait grades for every student in
 * a class from Character DB, keyed by student number then trait name — same
 * shape/purpose as _getClassAttendance (one call per class instead of one
 * _getCharacterInfo lookup per student per trait). Used by REPORTS to
 * populate the PG report's TRAITS table.
 * @param {string} academicYearSheet - e.g. "2025-2026"
 * @param {string} gradeLevel - e.g. "1" (matched against Character DB's own
 *   stored grade level via normalizeGradeLevel, same as _getClassAttendance)
 * @param {string} section - e.g. "A"
 * @return {{ success: boolean, characters?: Object, message?: string }}
 *   characters[studentNumber] = { fullName, traits: { [traitName]: {
 *     t1EQ, t2EQ, t3EQ, finalEQ } } } - trait names are whatever's stored in
 *   Character DB's own Trait column (col F, see CHAR_HEADER_ROW), matched by
 *   exact string against REPORTS' own hardcoded trait list - a trait name
 *   with no matching row here just renders blank in the report, it does not
 *   error.
 */
function _getClassCharacters(academicYearSheet, gradeLevel, section) {
  try {
    if (!academicYearSheet || !gradeLevel || !section) {
      return { success: false, message: 'academicYearSheet, gradeLevel, and section are required.' };
    }

    const targetSheet = getCharacterSheet(academicYearSheet);
    if (!targetSheet) {
      return { success: false, message: `Sheet "${academicYearSheet}" not found in Character DB.` };
    }

    const lastRow = targetSheet.getLastRow();
    if (lastRow < 2) {
      return { success: false, message: 'No character data found in the sheet.' };
    }

    const numCols = Math.max(CHAR_EXPECTED_COLS, targetSheet.getLastColumn());
    const data = targetSheet.getRange(2, 1, lastRow - 1, numCols).getValues();
    const formulas = targetSheet.getRange(2, 1, lastRow - 1, 1).getFormulas();

    const normalizedLevel = normalizeGradeLevel(gradeLevel);
    const sectionTrim = section.toString().trim();

    const characters = {};

    for (let i = 0; i < data.length; i++) {
      if (formulas[i][0] && typeof formulas[i][0] === 'string' && formulas[i][0].includes('HYPERLINK')) continue;

      const row = data[i];
      const studentNumber = String(row[0] || '').trim();
      const rowGradeLevel = String(row[2] || '').trim();
      const rowSection    = String(row[3] || '').trim();
      const trait         = String(row[5] || '').trim();

      if (!studentNumber || !trait) continue;
      if (rowGradeLevel !== normalizedLevel || rowSection !== sectionTrim) continue;

      if (!characters[studentNumber]) {
        characters[studentNumber] = {
          fullName: String(row[1] || '').trim(),
          traits: {}
        };
      }

      characters[studentNumber].traits[trait] = {
        t1EQ:    row[7]  || '',
        t2EQ:    row[9]  || '',
        t3EQ:    row[11] || '',
        finalEQ: row[13] || ''
      };
    }

    return { success: true, characters: characters };

  } catch (error) {
    console.error('Error in _getClassCharacters:', error);
    return { success: false, message: `Error retrieving class characters: ${error.toString()}` };
  }
}

// ---------------------------------------------------------------------------
// TRANSMUTATION REF — GRADES DB
// ---------------------------------------------------------------------------

const GRADES_DB_MAX_DATA_ROW = 8181;

function _ensureGradesDBTransmutationRef() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.TRANSMUTATION_REF);
  if (sheet) return sheet;

  sheet = ss.insertSheet(CONFIG.TRANSMUTATION_REF);

  // TRANSMUTATION TABLE occupies columns A-D, EQ SCALE (TRANSMUTED) columns F-I,
  // and EQ SCALE (NON-TRANSMUTED) columns K-N — all starting at row 1, side by side
  // (rather than stacked vertically) so all three tables are visible without scrolling.
  // Mirrors the layout used in the TEMPLATE MASTERFILE projects' TRANSMUTATION_REF.
  const transmutationRows = [
    ['TRANSMUTATION TABLE', '', '', ''],
    ['From', 'To', 'Transmuted', 'EQ'],
    [44.00, 44.99, 60.00, ''],
    [45.00, 45.99, 60.71, ''],
    [46.00, 46.99, 61.43, ''],
    [47.00, 47.99, 62.14, ''],
    [48.00, 48.99, 62.86, ''],
    [49.00, 49.99, 63.57, ''],
    [50.00, 50.99, 64.29, ''],
    [51.00, 51.99, 65.00, ''],
    [52.00, 52.99, 65.71, ''],
    [53.00, 53.99, 66.43, ''],
    [54.00, 54.99, 67.14, ''],
    [55.00, 55.99, 67.86, ''],
    [56.00, 56.99, 68.57, ''],
    [57.00, 57.99, 69.29, ''],
    [58.00, 58.99, 70.00, 'E'],
    [59.00, 59.99, 70.71, 'E'],
    [60.00, 60.99, 71.43, 'E'],
    [61.00, 61.99, 72.14, 'E'],
    [62.00, 62.99, 72.86, 'E'],
    [63.00, 63.99, 73.57, 'E'],
    [64.00, 64.99, 74.29, 'E'],
    [65.00, 65.99, 75.00, 'D'],
    [66.00, 66.99, 75.71, 'D'],
    [67.00, 67.99, 76.43, 'D'],
    [68.00, 68.99, 77.14, 'D'],
    [69.00, 69.99, 77.86, 'D'],
    [70.00, 70.99, 78.57, 'D'],
    [71.00, 71.99, 79.29, 'D'],
    [72.00, 72.99, 80.00, 'D'],
    [73.00, 73.99, 80.71, 'D'],
    [74.00, 74.99, 81.43, 'D'],
    [75.00, 75.99, 82.14, 'C'],
    [76.00, 76.99, 82.86, 'C'],
    [77.00, 77.99, 83.57, 'C'],
    [78.00, 78.99, 84.29, 'C'],
    [79.00, 79.99, 85.00, 'C'],
    [80.00, 80.99, 85.71, 'C'],
    [81.00, 81.99, 86.43, 'C'],
    [82.00, 82.99, 87.14, 'C'],
    [83.00, 83.99, 87.86, 'C'],
    [84.00, 84.99, 88.57, 'B'],
    [85.00, 85.99, 89.29, 'B'],
    [86.00, 86.99, 90.00, 'B'],
    [87.00, 87.99, 90.71, 'B'],
    [88.00, 88.99, 91.43, 'B'],
    [89.00, 89.99, 92.14, 'B'],
    [90.00, 90.99, 92.86, 'B'],
    [91.00, 91.99, 93.57, 'B'],
    [92.00, 92.99, 94.29, 'B'],
    [93.00, 93.99, 95.00, 'A'],
    [94.00, 94.99, 95.71, 'A'],
    [95.00, 95.99, 96.43, 'A'],
    [96.00, 96.99, 97.14, 'A'],
    [97.00, 97.50, 97.86, 'A'],
    [97.51, 98.00, 98.57, 'A'],
    [98.01, 99.00, 99.29, 'A'],
    [99.01, 100.00, 100.00, 'A'],
  ];

  const eqTransmutedRows = [
    ['EQ SCALE (TRANSMUTED)', '', '', ''],
    ['Min', 'Max', 'Value', 'Label'],
    [70, 74.44, 'NI', 'Needs Improvement'],
    [74.45, 81.45, 'F', 'Fair'],
    [81.45, 88.44, 'G', 'Good'],
    [88.45, 94.44, 'VG', 'Very Good'],
    [94.45, 100, 'O', 'Outstanding'],
  ];

  const eqNonTransmutedRows = [
    ['EQ SCALE (NON-TRANSMUTED)', '', '', ''],
    ['Min', 'Max', 'Value', 'Label'],
    [70, 74.44, 'E', 'Below'],
    [74.45, 81.44, 'D', 'Developing'],
    [81.45, 88.44, 'C', 'Approaching Proficient'],
    [88.45, 94.44, 'B', 'Proficient'],
    [94.45, 100, 'A', 'Advanced'],
  ];

  sheet.getRange(1, 1, transmutationRows.length, 4).setValues(transmutationRows);
  sheet.getRange(1, 6, eqTransmutedRows.length, 4).setValues(eqTransmutedRows);
  sheet.getRange(1, 11, eqNonTransmutedRows.length, 4).setValues(eqNonTransmutedRows);

  return sheet;
}

/**
 * Reads one of TRANSMUTATION_REF's column blocks (e.g. columns A-D or K-N),
 * each starting with a title row and a header row before the numeric data.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - The TRANSMUTATION_REF sheet
 * @param {number} startCol - 1-based column where this table's block begins
 * @return {Array<Array>} Raw row values for this block (title row included)
 */
function _readGradesDBTransmutationBlock(sheet, startCol) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 1) return [];
  return sheet.getRange(1, startCol, lastRow, 4).getValues();
}

function _readGradesDBTransmutationRef() {
  const sheet = getSpreadsheet().getSheetByName(CONFIG.TRANSMUTATION_REF);
  if (!sheet) throw new Error('TRANSMUTATION_REF sheet not found. Run Setup > Initialize Transmutation Ref first.');

  // TRANSMUTATION TABLE lives in columns A-D (1); EQ SCALE (NON-TRANSMUTED) in
  // columns K-N (11) — side by side, per _ensureGradesDBTransmutationRef. The
  // EQ SCALE (TRANSMUTED) block at F-I isn't read here — nothing in GRADES DB
  // consumes transmuted-EQ letters (NI/F/G/VG/O).
  const blocks = [
    { startCol: 1, section: 'table' },
    { startCol: 11, section: 'eq_non' },
  ];

  const table = [];
  const eqScaleNonTransmuted = [];

  blocks.forEach(({ startCol, section }) => {
    const data = _readGradesDBTransmutationBlock(sheet, startCol);
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const cell0 = String(row[0] || '').trim();

      if (cell0 === 'TRANSMUTATION TABLE' || cell0 === 'EQ SCALE (NON-TRANSMUTED)' ||
          cell0 === 'From' || cell0 === 'Min' || cell0 === '') continue;

      const v0 = Number(row[0]);
      if (isNaN(v0)) continue;

      if (section === 'table') {
        table.push({ from: v0, to: Number(row[1]), transmutation: Number(row[2]), eq: String(row[3] || '') });
      } else if (section === 'eq_non') {
        eqScaleNonTransmuted.push({ min: v0, max: Number(row[1]), value: String(row[2] || ''), label: String(row[3] || '') });
      }
    }
  });

  return { table, eqScaleNonTransmuted };
}

/**
 * Builds a Final Grading ARRAYFORMULA that averages 3 term columns, blanking the
 * result unless ALL THREE term columns have a value. A guard on only the first
 * column would let Sheets coerce blank 2nd/3rd term cells to 0 in the sum, producing
 * a bogus average (e.g. term1/3) as soon as the 1st term alone was graded.
 * @param {string} col1 - Column letter for the 1st term value
 * @param {string} col2 - Column letter for the 2nd term value
 * @param {string} col3 - Column letter for the 3rd term value
 * @return {string} The ARRAYFORMULA string
 */
function _buildFinalGradingArrayFormula(col1, col2, col3) {
  const maxRow = GRADES_DB_MAX_DATA_ROW;
  const r1 = `${col1}2:${col1}${maxRow}`;
  const r2 = `${col2}2:${col2}${maxRow}`;
  const r3 = `${col3}2:${col3}${maxRow}`;
  return `=ARRAYFORMULA({"Final Grading"; IF((${r1}="")+(${r2}="")+(${r3}="")>0,"",ROUND((${r1}+${r2}+${r3})/3,2))})`;
}

function _buildTransmutedArrayFormula(header, initialCol, table) {
  const maxRow = GRADES_DB_MAX_DATA_ROW;
  const inputRange = `${initialCol}2:${initialCol}${maxRow}`;
  const sorted = [...table].sort((a, b) => b.from - a.from);
  const conditions = sorted.map(e => `${inputRange}>=${e.from},${e.transmutation}`).join(',');
  return `=ARRAYFORMULA({"${header}"; IF(${inputRange}="","",IFS(${conditions},TRUE,60))})`;
}

function _buildEQFromTransmutedArrayFormula(header, transmutedCol, table) {
  const maxRow = GRADES_DB_MAX_DATA_ROW;
  const transmutedRange = `${transmutedCol}2:${transmutedCol}${maxRow}`;
  const sorted = [...table].sort((a, b) => b.transmutation - a.transmutation);
  const conditions = sorted.map(e => {
    const eq = e.eq ? `"${e.eq}"` : '""';
    return `${transmutedRange}=${e.transmutation},${eq}`;
  }).join(',');
  return `=ARRAYFORMULA({"${header}"; IF(${transmutedRange}="","",IFS(${conditions},TRUE,""))})`;
}

function _buildFinalEQArrayFormula(finalGradingCol, eqScaleNonTransmuted) {
  const maxRow = GRADES_DB_MAX_DATA_ROW;
  const finalRange = `${finalGradingCol}2:${finalGradingCol}${maxRow}`;
  const sorted = [...eqScaleNonTransmuted].sort((a, b) => b.min - a.min);
  const conditions = sorted.map(e => `${finalRange}>=${e.min},"${e.value}"`).join(',');
  return `=ARRAYFORMULA({"Final EQ"; IF(${finalRange}="","",IFS(${conditions},TRUE,""))})`;
}

/**
 * Rebuilds transmutation ARRAYFORMULA columns in all GRADES DB academic year tabs
 * from values in the TRANSMUTATION_REF sheet.
 * Run this whenever the transmutation table is edited.
 * @return {Object} Result with success status and message
 */
function _updateGradesDBTransmutation() {
  try {
    _ensureGradesDBTransmutationRef();
    const { table, eqScaleNonTransmuted } = _readGradesDBTransmutationRef();

    const ss = getSpreadsheet();
    const yearPattern = /^\d{4}-\d{4}$/;
    const sheets = ss.getSheets().filter(s => yearPattern.test(s.getName()));

    if (sheets.length === 0) {
      return { success: false, message: 'No academic year tabs found.' };
    }

    // 3-term column layout (post Parent Subject column insert): cols J/K/L, M/N/O, P/Q/R → Final S, Final EQ T
    const periods = [
      { initialCol: 'J', transmutedCol: 'K', eqCol: 'L', transmutedHeader: '1st Transmuted', eqHeader: '1st EQ' },
      { initialCol: 'M', transmutedCol: 'N', eqCol: 'O', transmutedHeader: '2nd Transmuted', eqHeader: '2nd EQ' },
      { initialCol: 'P', transmutedCol: 'Q', eqCol: 'R', transmutedHeader: '3rd Transmuted', eqHeader: '3rd EQ' },
    ];

    const finalGradingFormula = _buildFinalGradingArrayFormula('K', 'N', 'Q');
    const finalEQFormula = _buildFinalEQArrayFormula('S', eqScaleNonTransmuted);

    for (let i = 0; i < sheets.length; i++) {
      const sheet = sheets[i];
      for (let p = 0; p < periods.length; p++) {
        const { initialCol, transmutedCol, eqCol, transmutedHeader, eqHeader } = periods[p];
        const transmutedFormula = _buildTransmutedArrayFormula(transmutedHeader, initialCol, table);
        const eqFormula = _buildEQFromTransmutedArrayFormula(eqHeader, transmutedCol, table);
        const transmutedColNum = transmutedCol.charCodeAt(0) - 64;
        const eqColNum = eqCol.charCodeAt(0) - 64;
        sheet.getRange(1, transmutedColNum).setFormula(transmutedFormula);
        sheet.getRange(1, eqColNum).setFormula(eqFormula);
      }
      sheet.getRange(1, 19).setFormula(finalGradingFormula); // Col S = Final Grading
      sheet.getRange(1, 20).setFormula(finalEQFormula);      // Col T = Final EQ
    }

    return {
      success: true,
      message: `Transmutation formulas updated across ${sheets.length} academic year tab(s).`
    };

  } catch (error) {
    console.error('Error in _updateGradesDBTransmutation:', error);
    return { success: false, message: `Error: ${error.toString()}` };
  }
}

// ---------------------------------------------------------------------------
// ATTENDANCE DB
// ---------------------------------------------------------------------------

function getAttendanceSpreadsheet() {
  const url = CONFIG.ATTENDANCE_DB_SHEET_URL;
  if (!url) return null;
  try {
    return SpreadsheetApp.openById(extractSpreadsheetId(url));
  } catch (e) {
    return null;
  }
}

function getAttendanceSheet(sheetName) {
  const ss = getAttendanceSpreadsheet();
  return ss ? ss.getSheetByName(sheetName) : null;
}

const ATTEND_EXPECTED_COLS = 9;
const ATTEND_HEADER_ROW = ['Student#', 'Full Name', 'Grade Level', 'Section', 'Advisor', 'Month', 'School DAYS', 'Days PRESENT', 'Days ABSENT'];

function logAttendanceUpdate(studentNumber, fullName, academicYear, section, month, field, originalValue, updatedValue, userEmail) {
  try {
    const spreadsheet = getAttendanceSpreadsheet();
    if (!spreadsheet) return;
    let logSheet = spreadsheet.getSheetByName('UPDATE LOG');
    if (!logSheet) {
      logSheet = spreadsheet.insertSheet('UPDATE LOG');
      const headers = ['Timestamp', 'Updated By', 'Student Number', 'Full Name', 'Academic Year', 'Section', 'Month', 'Field', 'Original Value', 'Updated Value'];
      logSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      logSheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
      logSheet.setFrozenRows(1);
    }
    const actualUserEmail = userEmail || Session.getActiveUser().getEmail();
    const logEntry = [new Date(), actualUserEmail, studentNumber, fullName, academicYear, section || '', month || '', field || '', originalValue, updatedValue];
    const nextRow = logSheet.getLastRow() + 1;
    logSheet.getRange(nextRow, 1, 1, logEntry.length).setValues([logEntry]);
    logSheet.getRange(nextRow, 1, 1, logEntry.length).setHorizontalAlignment('left');
    logSheet.getRange(nextRow, 1).setNumberFormat('yyyy-MM-dd HH:mm:ss');
  } catch (error) {
    console.error('Error logging attendance update:', error);
  }
}

// Month column layout in OGS Attendance sheet (0-based from col C, i.e. index 2):
// Each month occupies 3 columns: School DAYS | Days PRESENT | Days ABSENT
// Months start at column index 2 (col C) in the data rows.
const ATTEND_MONTHS = ['July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March', 'April', 'May', 'June'];

function _importAttendance(ogsTemplateUrl, academicYearSheet) {
  try {
    if (!ogsTemplateUrl || ogsTemplateUrl.toString().trim() === '') return { success: false, message: 'OGS template URL cannot be empty' };
    if (!academicYearSheet || academicYearSheet.toString().trim() === '') return { success: false, message: 'Academic year must be specified' };

    const spreadsheetId = extractSpreadsheetId(ogsTemplateUrl);
    let ogsSpreadsheet, ogsSpreadsheetName = '';
    try {
      ogsSpreadsheet = SpreadsheetApp.openById(spreadsheetId);
      ogsSpreadsheetName = ogsSpreadsheet.getName();
    } catch (error) {
      return { success: false, message: `Cannot access OGS template. Error: ${error.message}` };
    }

    const attendanceSheet = ogsSpreadsheet.getSheetByName('Attendance');
    if (!attendanceSheet) return { success: false, message: 'Attendance sheet not found in OGS template.' };

    // Read header info (rows 1-6)
    const infoData = attendanceSheet.getRange(1, 1, 6, 2).getValues();
    let advisorName = '', schoolYear = '', level = '', section = '';
    for (let i = 0; i < infoData.length; i++) {
      const label = String(infoData[i][0] || '').trim();
      const value = String(infoData[i][1] || '').trim();
      if (label.includes('Advisor Name') || label.includes('Teacher Name')) advisorName = value;
      else if (label.includes('School Year')) schoolYear = value;
      else if (label.includes('Level')) level = value;
      else if (label.includes('Section')) section = value;
    }
    if (!section || section.toString().trim() === '') section = 'ALL';
    if (!advisorName || !level) return { success: false, message: 'Could not extract required information from Attendance sheet.' };
    const normalizedGradeLevel = normalizeGradeLevel(level);

    // Detect month headers from row 6 (index 5) — month names are in the parent header row
    // Row 7 contains sub-headers (School DAYS, Days PRESENT, Days ABSENT)
    const lastCol = attendanceSheet.getLastColumn();
    const lastRow = attendanceSheet.getLastRow();
    if (lastRow < 8) return { success: false, message: 'No student attendance data found.' };

    const headerRowData = attendanceSheet.getRange(6, 1, 1, lastCol).getValues()[0];
    const monthColumns = []; // { month, schoolDaysCol, daysPresentCol, daysAbsentCol } — 0-based indices
    for (let c = 2; c < headerRowData.length; c++) {
      const val = String(headerRowData[c] || '').trim();
      if (val && ATTEND_MONTHS.indexOf(val) >= 0) {
        monthColumns.push({ month: val, schoolDaysCol: c, daysPresentCol: c + 1, daysAbsentCol: c + 2 });
        c += 2; // skip the Days PRESENT and Days ABSENT columns
      }
    }

    if (monthColumns.length === 0) return { success: false, message: 'No month columns found in Attendance sheet.' };

    // Read student data starting at row 8
    const dataRange = attendanceSheet.getRange(8, 1, lastRow - 7, lastCol);
    const data = dataRange.getValues();

    const allRows = [];
    for (let j = 0; j < data.length; j++) {
      const row = data[j];
      const studentNumber = String(row[0] || '').trim();
      const studentName = String(row[1] || '').trim();
      if (!studentNumber) continue;

      for (let m = 0; m < monthColumns.length; m++) {
        const mc = monthColumns[m];
        const schoolDays = row[mc.schoolDaysCol] !== undefined ? row[mc.schoolDaysCol] : '';
        const daysPresent = row[mc.daysPresentCol] !== undefined ? row[mc.daysPresentCol] : '';
        const daysAbsent = row[mc.daysAbsentCol] !== undefined ? row[mc.daysAbsentCol] : '';
        // Only include rows that have at least School DAYS populated
        if (schoolDays === '' && daysPresent === '') continue;
        const targetRow = new Array(ATTEND_EXPECTED_COLS);
        targetRow[0] = studentNumber;
        targetRow[1] = studentName;
        targetRow[2] = normalizedGradeLevel;
        targetRow[3] = section;
        targetRow[4] = advisorName;
        targetRow[5] = mc.month;
        targetRow[6] = schoolDays !== '' ? String(schoolDays).trim() : '';
        targetRow[7] = daysPresent !== '' ? String(daysPresent).trim() : '';
        targetRow[8] = daysAbsent !== '' ? String(daysAbsent).trim() : '';
        allRows.push(targetRow);
      }
    }

    if (allRows.length === 0) return { success: false, message: 'No attendance records found in Attendance sheet.' };

    const targetSheet = getAttendanceSheet(academicYearSheet);
    if (!targetSheet) return { success: false, message: `Academic year sheet "${academicYearSheet}" not found in Attendance DB.` };

    if (targetSheet.getLastRow() < 1) {
      targetSheet.getRange(1, 1, 1, ATTEND_EXPECTED_COLS).setValues([ATTEND_HEADER_ROW]);
      targetSheet.getRange(1, 1, 1, ATTEND_EXPECTED_COLS).setFontWeight('bold');
    }

    const numColumns = Math.max(targetSheet.getLastColumn(), ATTEND_EXPECTED_COLS);
    const rangeEnd = Math.max(2, targetSheet.getLastRow());
    const studentNumberColumn = targetSheet.getRange(2, 1, rangeEnd, 1).getValues();
    const lastRowFormulas = targetSheet.getRange(2, 1, rangeEnd, 1).getFormulas();
    let lastDataRow = 1;
    for (let i = studentNumberColumn.length - 1; i >= 0; i--) {
      if (lastRowFormulas[i][0] && typeof lastRowFormulas[i][0] === 'string' && lastRowFormulas[i][0].includes('HYPERLINK')) continue;
      const sn = String(studentNumberColumn[i][0] || '').trim();
      if (sn) { lastDataRow = i + 2; break; }
    }

    // Check for re-import and build existing key map
    const existingKeys = new Map();
    const existingDataMap = new Map();

    if (lastDataRow > 1) {
      const existingRange = targetSheet.getRange(2, 1, lastDataRow, numColumns);
      const existingValues = existingRange.getValues();
      const existingFormulas = targetSheet.getRange(2, 1, lastDataRow, 1).getFormulas();
      const normalizedImportUrl = ogsTemplateUrl.trim().split('#')[0].replace(/\/$/, '').toLowerCase();

      for (let i = 0; i < existingFormulas.length; i++) {
        const formula = existingFormulas[i][0];
        if (formula && typeof formula === 'string' && formula.includes('HYPERLINK')) {
          const urlMatch = formula.match(/HYPERLINK\("([^"]+)"/) || formula.match(/HYPERLINK\('([^']+)'/);
          if (urlMatch && urlMatch[1]) {
            const extractedUrl = urlMatch[1].trim().replace(/^["']|["']$/g, '');
            const normalizedExistingUrl = extractedUrl.split('#')[0].replace(/\/$/, '').toLowerCase();
            const importId = extractSpreadsheetId(ogsTemplateUrl);
            const existingId = extractedUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1];
            if (normalizedExistingUrl === normalizedImportUrl || (importId && existingId && importId === existingId)) {
              isReImport = true;
              existingDividerRow = i + 2;
              existingImportEndRow = lastDataRow + 1;
              for (let j = i + 1; j < existingFormulas.length; j++) {
                if (existingFormulas[j][0] && typeof existingFormulas[j][0] === 'string' && existingFormulas[j][0].includes('HYPERLINK')) {
                  existingImportEndRow = j + 2; break;
                }
              }
              break;
            }
          }
        }
      }

      for (let i = 0; i < existingValues.length; i++) {
        const sn = String(existingValues[i][0] || '').trim();
        const sec = String(existingValues[i][3] || '').trim();
        const month = String(existingValues[i][5] || '').trim();
        if (sn && sec && month) {
          existingKeys.set(`${sn}|${sec}|${month}`, i + 2);
          existingDataMap.set(`${sn}|${sec}|${month}`, existingValues[i]);
        }
      }
    }

    const rowsToUpdate = [];
    const rowsToInsert = [];

    for (let i = 0; i < allRows.length; i++) {
      const rowData = allRows[i];
      const sn = String(rowData[0] || '').trim();
      const month = String(rowData[5] || '').trim();
      const key = `${sn}|${section}|${month}`;

      if (existingKeys.has(key)) {
        const existingRowNum = existingKeys.get(key);
        const existingRow = existingDataMap.get(key);
        const oldSd = existingRow[6] !== null && existingRow[6] !== undefined ? String(existingRow[6]).trim() : '';
        const oldDp = existingRow[7] !== null && existingRow[7] !== undefined ? String(existingRow[7]).trim() : '';
        const newSd = String(rowData[6]).trim();
        const newDp = String(rowData[7]).trim();
        if (oldSd !== newSd || oldDp !== newDp) {
          rowsToUpdate.push({ row: existingRowNum, data: rowData });
        }
      } else {
        rowsToInsert.push(rowData);
      }
    }

    for (let i = 0; i < rowsToUpdate.length; i++) {
      const update = rowsToUpdate[i];
      const padData = update.data.slice();
      while (padData.length < numColumns) padData.push('');
      targetSheet.getRange(update.row, 1, 1, numColumns).setValues([padData.slice(0, numColumns)]);
    }

    if (rowsToInsert.length > 0) {
      const insertRow = lastDataRow + 1;
      const linkLabel = ogsSpreadsheetName || 'OGS Template';
      const dividerRow = new Array(numColumns).fill('');
      targetSheet.getRange(insertRow, 1, 1, numColumns).setValues([dividerRow]);
      targetSheet.getRange(insertRow, 1, 1, numColumns).merge();
      targetSheet.getRange(insertRow, 1).setFormula(`=HYPERLINK("${ogsTemplateUrl}","${linkLabel}")`);
      targetSheet.getRange(insertRow, 1).setBackground('#d9d9d9').setFontStyle('italic').setFontColor('#1155cc').setFontSize(10).setHorizontalAlignment('left').setVerticalAlignment('middle');
      targetSheet.setRowHeight(insertRow, 25);
      const paddedRows = rowsToInsert.map(r => { const arr = r.slice(); while (arr.length < numColumns) arr.push(''); return arr.slice(0, numColumns); });
      targetSheet.getRange(insertRow + 1, 1, paddedRows.length, numColumns).setValues(paddedRows);
    }

    return {
      success: true,
      message: `Successfully imported attendance data.\n\nUpdated: ${rowsToUpdate.length} row(s)\nInserted: ${rowsToInsert.length} row(s)\n\nAdvisor: ${advisorName}\nSchool Year: ${schoolYear}\nLevel: ${level}\nSection: ${section}`
    };
  } catch (error) {
    console.error('Error importing attendance:', error);
    return { success: false, message: `Error importing attendance: ${error.toString()}` };
  }
}

function _getAttendanceInfo(studentNumber, academicYearSheet, section, month) {
  try {
    if (!studentNumber || studentNumber.toString().trim() === '') return { success: false, message: 'Student number cannot be empty' };
    if (!academicYearSheet || academicYearSheet.toString().trim() === '') return { success: false, message: 'Academic year must be specified' };
    if (!section || section.toString().trim() === '') return { success: false, message: 'Section must be specified' };
    if (!month || month.toString().trim() === '') return { success: false, message: 'Month must be specified' };

    const targetSheet = getAttendanceSheet(academicYearSheet);
    if (!targetSheet) return { success: false, message: 'Academic year sheet not found' };
    const lastRow = targetSheet.getLastRow();
    if (lastRow < 2) return { success: false, message: 'No attendance data found in the sheet' };

    const numCols = Math.max(ATTEND_EXPECTED_COLS, targetSheet.getLastColumn());
    const data = targetSheet.getRange(2, 1, lastRow, numCols).getValues();
    const formulas = targetSheet.getRange(2, 1, lastRow, 1).getFormulas();
    const sn = studentNumber.toString().trim();
    const sec = section.toString().trim();
    const mon = month.toString().trim();

    for (let i = 0; i < data.length; i++) {
      if (formulas[i][0] && typeof formulas[i][0] === 'string' && formulas[i][0].includes('HYPERLINK')) continue;
      const row = data[i];
      if (String(row[0] || '').trim() === sn && String(row[3] || '').trim() === sec && String(row[5] || '').trim() === mon) {
        return {
          success: true,
          attendanceData: {
            'Student Number': row[0],
            'Full Name': row[1],
            'Grade Level': row[2],
            'Section': row[3],
            'Advisor': row[4],
            'Month': row[5],
            'School DAYS': row[6] !== undefined ? row[6] : '',
            'Days PRESENT': row[7] !== undefined ? row[7] : '',
            'Days ABSENT': row[8] !== undefined ? row[8] : ''
          },
          rowIndex: i + 2
        };
      }
    }
    return { success: false, message: 'Attendance record not found for the specified student, section, and month' };
  } catch (error) {
    console.error('Error getting attendance info:', error);
    return { success: false, message: `Error retrieving attendance data: ${error.toString()}` };
  }
}

function _updateAttendance(studentNumber, academicYearSheet, section, month, schoolDays, daysPresent, userEmail) {
  try {
    if (!studentNumber || studentNumber.toString().trim() === '') return { success: false, message: 'Student number cannot be empty' };
    if (!academicYearSheet || academicYearSheet.toString().trim() === '') return { success: false, message: 'Academic year must be specified' };
    if (!section || section.toString().trim() === '') return { success: false, message: 'Section must be specified' };
    if (!month || month.toString().trim() === '') return { success: false, message: 'Month must be specified' };

    const info = _getAttendanceInfo(studentNumber, academicYearSheet, section, month);
    if (!info.success) return info;

    const targetSheet = getAttendanceSheet(academicYearSheet);
    const rowIndex = info.rowIndex;
    const actualUserEmail = userEmail || Session.getActiveUser().getEmail();
    const updates = [];

    const fieldUpdates = [
      { col: 7, key: 'School DAYS', value: schoolDays },
      { col: 8, key: 'Days PRESENT', value: daysPresent }
    ];

    for (let u = 0; u < fieldUpdates.length; u++) {
      const f = fieldUpdates[u];
      if (f.value === undefined || f.value === null) continue;
      const oldVal = String(info.attendanceData[f.key] !== undefined ? info.attendanceData[f.key] : '').trim();
      const newVal = String(f.value).trim();
      if (oldVal !== newVal) {
        targetSheet.getRange(rowIndex, f.col).setValue(newVal);
        logAttendanceUpdate(studentNumber, info.attendanceData['Full Name'], academicYearSheet, section, month, f.key, oldVal, newVal, actualUserEmail);
        updates.push(f.key);
      }
    }

    // Recompute Days ABSENT
    if (updates.length > 0) {
      const newSd = parseFloat(updates.indexOf('School DAYS') >= 0 ? String(schoolDays).trim() : String(info.attendanceData['School DAYS'] || '').trim());
      const newDp = parseFloat(updates.indexOf('Days PRESENT') >= 0 ? String(daysPresent).trim() : String(info.attendanceData['Days PRESENT'] || '').trim());
      if (!isNaN(newSd) && !isNaN(newDp)) {
        targetSheet.getRange(rowIndex, 9).setValue(Math.round((newSd - newDp) * 100) / 100);
      }
    }

    if (updates.length === 0) return { success: false, message: 'No changes detected. All values are the same as current values.' };
    return { success: true, message: `Successfully updated: ${updates.join(', ')}` };
  } catch (error) {
    console.error('Error updating attendance:', error);
    return { success: false, message: `Error updating attendance: ${error.toString()}` };
  }
}

// ---------------------------------------------------------------------------
// MIGRATION — GRADES DB: Add Parent Subject column (SHS parent/child subjects)
// ---------------------------------------------------------------------------

/**
 * Inserts a new "Parent Subject" column into every academic-year tab in GRADES DB,
 * for TEMPLATE MASTERFILE GRADE 11-12's parent/child subject feature (e.g. "Effective
 * Communication & Mabisang Komunikasyon" composed of "Effective Communication" and
 * "Mabisang Komunikasyon"). Run ONCE before deploying the updated _importGrades code.
 *
 * Current layout (19 cols):
 *   A Student# | B Full Name | C Grade Level | D Section | E Subject | F Term
 *   G Track | H Teacher | I 1st Initial | J 1st Transmuted | K 1st EQ
 *   L 2nd Initial | M 2nd Transmuted | N 2nd EQ | O 3rd Initial | P 3rd Transmuted
 *   Q 3rd EQ | R Final Grading | S Final EQ
 *
 * Target layout (20 cols):
 *   A-E same | F Parent Subject (NEW, blank on all existing rows) | G Term
 *   H Track | I Teacher | J 1st Initial | K 1st Transmuted | L 1st EQ
 *   M 2nd Initial | N 2nd Transmuted | O 2nd EQ | P 3rd Initial | Q 3rd Transmuted
 *   R 3rd EQ | S Final Grading | T Final EQ
 *
 * Per tab:
 *  1. Duplicates tab as BACKUP_YYYY-YYYY (skipped if a backup already exists)
 *  2. Inserts a new column before F, leaving existing row data blank in it
 *  3. Sets F1 header to "Parent Subject"
 *  4. Re-writes the 3 transmutation ARRAYFORMULAs and the Final Grading/Final EQ
 *     ARRAYFORMULAs with their shifted column letters (K,L / N,O / Q,R / S / T)
 */
function migrateGradesDBAddParentSubject() {
  try {
    _ensureGradesDBTransmutationRef();
    const { table, eqScaleNonTransmuted } = _readGradesDBTransmutationRef();

    const ss = getSpreadsheet();
    const yearPattern = /^\d{4}-\d{4}$/;
    const sheets = ss.getSheets().filter(s => yearPattern.test(s.getName()));

    if (sheets.length === 0) {
      SpreadsheetApp.getUi().alert('No academic year tabs found.');
      return;
    }

    const errors = [];

    for (let i = 0; i < sheets.length; i++) {
      const sheet = sheets[i];
      const tabName = sheet.getName();

      try {
        // 1. Backup
        const backupName = 'BACKUP_' + tabName;
        if (!ss.getSheetByName(backupName)) {
          sheet.copyTo(ss).setName(backupName);
        }

        // 2. Insert new column before F (Term) - existing data in F onward shifts
        //    right by one automatically; new column F is blank on every existing row.
        sheet.insertColumnBefore(6);

        // 3. Set new F1 header
        sheet.getRange(1, 6).setValue('Parent Subject');

        // 4. Re-write ARRAYFORMULAs with shifted column letters
        //    (old I,J,K/L,M,N/O,P,Q/R/S -> new J,K,L/M,N,O/P,Q,R/S/T)
        const periods = [
          { initialCol: 'J', transmutedCol: 'K', eqCol: 'L', transmutedHeader: '1st Transmuted', eqHeader: '1st EQ' },
          { initialCol: 'M', transmutedCol: 'N', eqCol: 'O', transmutedHeader: '2nd Transmuted', eqHeader: '2nd EQ' },
          { initialCol: 'P', transmutedCol: 'Q', eqCol: 'R', transmutedHeader: '3rd Transmuted', eqHeader: '3rd EQ' },
        ];
        for (let p = 0; p < periods.length; p++) {
          const { initialCol, transmutedCol, eqCol, transmutedHeader, eqHeader } = periods[p];
          sheet.getRange(1, transmutedCol.charCodeAt(0) - 64).setFormula(_buildTransmutedArrayFormula(transmutedHeader, initialCol, table));
          sheet.getRange(1, eqCol.charCodeAt(0) - 64).setFormula(_buildEQFromTransmutedArrayFormula(eqHeader, transmutedCol, table));
        }
        sheet.getRange(1, 19).setFormula(_buildFinalGradingArrayFormula('K', 'N', 'Q'));
        sheet.getRange(1, 20).setFormula(_buildFinalEQArrayFormula('S', eqScaleNonTransmuted));

      } catch (tabError) {
        errors.push(`${tabName}: ${tabError.message}`);
      }
    }

    const ui = SpreadsheetApp.getUi();
    if (errors.length === 0) {
      ui.alert('Migration Complete', `Successfully added Parent Subject column to ${sheets.length} tab(s).\nBackup tabs prefixed with BACKUP_ were created.`, ui.ButtonSet.OK);
    } else {
      ui.alert('Migration Partial', `Migrated with errors:\n${errors.join('\n')}`, ui.ButtonSet.OK);
    }

  } catch (error) {
    console.error('Error in migrateGradesDBAddParentSubject:', error);
    SpreadsheetApp.getUi().alert('Migration Error', error.toString(), SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

// ---------------------------------------------------------------------------
// MIGRATION — CHARACTER DB: 4 Quarters → 3 Trimesters
// ---------------------------------------------------------------------------

/**
 * Migrates all academic year tabs in CHARACTER DB from 4-quarter to 3-trimester layout.
 * Run ONCE before deploying the updated code.
 *
 * Current layout (16 cols):
 *   A Student# | B Full Name | C Grade Level | D Section | E Advisor | F Trait
 *   G 1st Grade | H 1st EQ | I 2nd Grade | J 2nd EQ | K 3rd Grade | L 3rd EQ
 *   M 4th Grade | N 4th EQ | O Final Grading | P Final EQ
 *
 * Target layout (14 cols):
 *   A-L same | M Final Grading ARRAYFORMULA | N Final EQ ARRAYFORMULA
 *
 * Per tab:
 *  1. Duplicates tab as BACKUP_YYYY-YYYY
 *  2. Deletes col N (4th EQ) then col M (4th Grade) — right to left
 *  3. Re-writes Final Grading ARRAYFORMULA in col M: ROUND((G+I+K)/3,2), blank unless G,I,K all have values
 *  4. Re-writes Final EQ ARRAYFORMULA in col N referencing col M
 */
function migrateCharacterDBToTrimester() {
  try {
    const { eqScaleNonTransmuted } = _readGradesDBTransmutationRef();

    const ss = getCharacterSpreadsheet();
    if (!ss) {
      SpreadsheetApp.getUi().alert('Character DB not configured or unavailable.');
      return;
    }

    const yearPattern = /^\d{4}-\d{4}$/;
    const sheets = ss.getSheets().filter(s => yearPattern.test(s.getName()));

    if (sheets.length === 0) {
      SpreadsheetApp.getUi().alert('No academic year tabs found in Character DB.');
      return;
    }

    const maxRow = GRADES_DB_MAX_DATA_ROW;
    const finalGradingFormula = _buildFinalGradingArrayFormula('G', 'I', 'K');

    // Build Final EQ ARRAYFORMULA referencing col M (Final Grading)
    const sorted = [...eqScaleNonTransmuted].sort((a, b) => b.min - a.min);
    const finalRange = `M2:M${maxRow}`;
    const conditions = sorted.map(e => `${finalRange}>=${e.min},"${e.value}"`).join(',');
    const finalEQFormula = `=ARRAYFORMULA({"Final EQ"; IF(${finalRange}="","",IFS(${conditions},TRUE,""))})`;

    const errors = [];

    for (let i = 0; i < sheets.length; i++) {
      const sheet = sheets[i];
      const tabName = sheet.getName();

      try {
        // 1. Backup
        const backupName = 'BACKUP_' + tabName;
        if (!ss.getSheetByName(backupName)) {
          sheet.copyTo(ss).setName(backupName);
        }

        // 2. Delete col N (14: 4th EQ) then col M (13: 4th Grade) — right to left
        sheet.deleteColumn(14); // N: 4th EQ
        sheet.deleteColumn(13); // M: 4th Grade

        // 3. Re-write Final Grading in new col M (13)
        sheet.getRange(1, 13).setFormula(finalGradingFormula);

        // 4. Re-write Final EQ in new col N (14)
        sheet.getRange(1, 14).setFormula(finalEQFormula);

      } catch (tabError) {
        errors.push(`${tabName}: ${tabError.message}`);
      }
    }

    const ui = SpreadsheetApp.getUi();
    if (errors.length === 0) {
      ui.alert('Migration Complete', `Successfully migrated ${sheets.length} Character DB tab(s) to 3-trimester layout.\nBackup tabs prefixed with BACKUP_ were created.`, ui.ButtonSet.OK);
    } else {
      ui.alert('Migration Partial', `Migrated with errors:\n${errors.join('\n')}`, ui.ButtonSet.OK);
    }

  } catch (error) {
    console.error('Error in migrateCharacterDBToTrimester:', error);
    SpreadsheetApp.getUi().alert('Migration Error', error.toString(), SpreadsheetApp.getUi().ButtonSet.OK);
  }
}
