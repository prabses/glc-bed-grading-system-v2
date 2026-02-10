/**
 * API.js - API for Character Database
 * Imports character data from OGS template Character sheet
 */

function getSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getSheet(sheetName) {
  return getSpreadsheet().getSheetByName(sheetName);
}

function doPost(e) {
  console.log("Function doPost executed by: API/Script Owner");
  const response = (statusCode, message) =>
    ContentService.createTextOutput(
      JSON.stringify({ statusCode, message })
    ).setMimeType(ContentService.MimeType.JSON);

  try {
    const params = JSON.parse(e.postData.contents);
    const { apiKey, action, payload } = params;

    if (apiKey !== CONFIG.API_KEY) {
      return response(401, "Unauthorized: Invalid API Key.");
    }

    switch (action) {
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
          payload.fourthGrade,
          payload.remarks,
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

function callApi(action, payload) {
  console.log("Function callApi executed by: " + Session.getActiveUser().getEmail());
  const webAppUrl = CONFIG.WEB_APP_URL;

  if (!webAppUrl || webAppUrl === "YOUR_WEB_APP_URL_HERE") {
    throw new Error("Web App URL not configured. Please deploy the script as a web app and update CONFIG.WEB_APP_URL in Config.js");
  }

  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({ apiKey: CONFIG.API_KEY, action: action, payload: payload }),
    headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true,
  };

  const response = UrlFetchApp.fetch(webAppUrl, options);
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();

  if (responseCode !== 200) {
    console.error(`API call failed with response code ${responseCode}. Response: ${responseText}`);
    throw new Error(`The server responded with an error (${responseCode}). Please check the logs for more details.`);
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

function extractSpreadsheetId(url) {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!match || !match[1]) {
    throw new Error("Invalid Google Sheets URL. Could not extract spreadsheet ID.");
  }
  return match[1];
}

function normalizeGradeLevel(gradeLevel) {
  if (!gradeLevel) return '';
  const str = String(gradeLevel).trim();
  const cleaned = str.replace(/^Grade\s+/i, '');
  const match = cleaned.match(/^\d+/);
  return match ? match[0] : cleaned;
}

const CHAR_EXPECTED_COLS = 16;
const CHAR_HEADER_ROW = ['Student#', 'Full Name', 'Grade Level', 'Section', 'Advisor', 'Trait', '1st Grade', '1st EQ', '2nd Grade', '2nd EQ', '3rd Grade', '3rd EQ', '4th Grade', '4th EQ', 'Final Grading', 'Final EQ'];

function _importCharacters(ogsTemplateUrl, academicYearSheet, userEmail) {
  try {
    if (!ogsTemplateUrl || ogsTemplateUrl.toString().trim() === '') {
      return { success: false, message: 'OGS template URL cannot be empty' };
    }
    if (!academicYearSheet || academicYearSheet.toString().trim() === '') {
      return { success: false, message: 'Academic year must be specified' };
    }

    const spreadsheetId = extractSpreadsheetId(ogsTemplateUrl);
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

    const characterSheet = ogsSpreadsheet.getSheetByName('Character');
    if (!characterSheet) {
      return {
        success: false,
        message: 'Character sheet not found in OGS template. Please ensure the template contains a Character sheet.'
      };
    }

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

    if (!advisorName || !level || !section) {
      return {
        success: false,
        message: 'Could not extract required information from Character sheet. Ensure headers: Advisor Name, Level, Section.'
      };
    }

    const normalizedGradeLevel = normalizeGradeLevel(level);
    const lastCol = characterSheet.getLastColumn();
    const lastRow = characterSheet.getLastRow();
    if (lastRow < 8) {
      return { success: false, message: 'No student character data found in Character sheet.' };
    }

    const isSHS = (lastCol === 9);
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
      targetRow[0] = studentNumber;
      targetRow[1] = studentName;
      targetRow[2] = normalizedGradeLevel;
      targetRow[3] = section;
      targetRow[4] = advisorName;
      targetRow[5] = trait;
      targetRow[7] = '';
      targetRow[9] = '';
      targetRow[11] = '';
      targetRow[13] = '';
      targetRow[14] = '';
      targetRow[15] = '';
      if (isSHS) {
        targetRow[6] = row[3] !== undefined ? String(row[3]).trim() : '';
        targetRow[8] = row[5] !== undefined ? String(row[5]).trim() : '';
        targetRow[10] = '';
        targetRow[12] = '';
      } else {
        targetRow[6] = row[3] !== undefined ? String(row[3]).trim() : '';
        targetRow[8] = row[5] !== undefined ? String(row[5]).trim() : '';
        targetRow[10] = row[7] !== undefined ? String(row[7]).trim() : '';
        targetRow[12] = row[9] !== undefined ? String(row[9]).trim() : '';
      }
      allRows.push(targetRow);
    }

    if (allRows.length === 0) {
      return { success: false, message: 'No student character records found in Character sheet.' };
    }

    allRows.sort((a, b) => {
      const sn = String(a[0] || '').localeCompare(String(b[0] || ''));
      if (sn !== 0) return sn;
      return String(a[5] || '').localeCompare(String(b[5] || ''));
    });

    const targetSheet = getSheet(academicYearSheet);
    if (!targetSheet) {
      return {
        success: false,
        message: `Academic year sheet "${academicYearSheet}" not found in CHARACTER DB. Please ensure the sheet exists.`
      };
    }

    if (targetSheet.getLastRow() < 1) {
      targetSheet.getRange(1, 1, 1, CHAR_EXPECTED_COLS).setValues([CHAR_HEADER_ROW]);
      targetSheet.getRange(1, 1, 1, CHAR_EXPECTED_COLS).setFontWeight('bold');
    }
    const headerRow = targetSheet.getRange(1, 1, 1, Math.max(targetSheet.getLastColumn(), CHAR_EXPECTED_COLS)).getValues()[0];
    const numColumns = Math.max(headerRow.length, CHAR_EXPECTED_COLS);
    if (numColumns < CHAR_EXPECTED_COLS) {
      return {
        success: false,
        message: `Target sheet should have at least ${CHAR_EXPECTED_COLS} columns. Found ${numColumns}.`
      };
    }

    const rangeEnd = Math.max(2, targetSheet.getLastRow());
    const studentNumberColumn = targetSheet.getRange(2, 1, rangeEnd, 1).getValues();
    const lastRowFormulas = targetSheet.getRange(2, 1, rangeEnd, 1).getFormulas();
    let lastDataRow = 1;
    for (let i = studentNumberColumn.length - 1; i >= 0; i--) {
      if (lastRowFormulas[i][0] && typeof lastRowFormulas[i][0] === 'string' && lastRowFormulas[i][0].includes('HYPERLINK')) continue;
      const studentNum = String(studentNumberColumn[i][0] || '').trim();
      if (studentNum) {
        lastDataRow = i + 2;
        break;
      }
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
          let urlMatch = formula.match(/HYPERLINK\("([^"]+)"/) || formula.match(/HYPERLINK\('([^']+)'/);
          if (urlMatch && urlMatch[1]) {
            let extractedUrl = urlMatch[1].trim().replace(/^["']|["']$/g, '');
            const normalizedExistingUrl = extractedUrl.split('#')[0].replace(/\/$/, '').toLowerCase();
            const importId = extractSpreadsheetId(ogsTemplateUrl);
            const existingId = extractedUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1];
            if (normalizedExistingUrl === normalizedImportUrl || (importId && existingId && importId === existingId)) {
              isReImport = true;
              existingDividerRow = i + 2;
              existingImportEndRow = lastDataRow + 1;
              for (let j = i + 1; j < existingFormulas.length; j++) {
                const nextFormula = existingFormulas[j][0];
                if (nextFormula && typeof nextFormula === 'string' && nextFormula.includes('HYPERLINK')) {
                  existingImportEndRow = j + 2;
                  break;
                }
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
          const key = `${studentNum}|${rowSection}|${trait}`;
          existingKeys.set(key, i + 2);
          existingDataMap.set(key, existingValues[i]);
        }
      }
    }

    const actualUserEmail = userEmail || Session.getActiveUser().getEmail();
    const rowsToUpdate = [];
    const rowsToInsert = [];
    const characterChangesToLog = [];
    const gradeColIndices = [6, 8, 10, 12];
    const gradeNames = ['1st Grade', '2nd Grade', '3rd Grade', '4th Grade'];

    for (let i = 0; i < allRows.length; i++) {
      const rowData = allRows[i];
      const studentNumber = String(rowData[0] || '').trim();
      const trait = String(rowData[5] || '').trim();
      const key = `${studentNumber}|${section}|${trait}`;

      if (existingKeys.has(key)) {
        const existingRowNum = existingKeys.get(key);
        const existingRow = existingDataMap.get(key);
        const isFromSameImport = isReImport && existingDividerRow && existingImportEndRow &&
          existingRowNum > existingDividerRow && existingRowNum < existingImportEndRow;

        let hasChanges = false;
        const dataToWrite = rowData.slice();
        for (let g = 0; g < gradeColIndices.length; g++) {
          const col = gradeColIndices[g];
          const oldVal = existingRow[col] !== null && existingRow[col] !== undefined ? String(existingRow[col]).trim() : '';
          const newVal = rowData[col] !== null && rowData[col] !== undefined ? String(rowData[col]).trim() : '';
          if (oldVal !== newVal) {
            hasChanges = true;
            if (isFromSameImport) {
              characterChangesToLog.push({
                studentNumber,
                fullName: String(rowData[1] || '').trim(),
                trait,
                period: gradeNames[g],
                oldValue: oldVal,
                newValue: newVal
              });
            }
          }
        }
        for (let c = 7; c <= 15; c += 2) {
          if (existingRow[c] !== undefined) dataToWrite[c] = existingRow[c];
        }
        if (existingRow[14] !== undefined) dataToWrite[14] = existingRow[14];
        if (existingRow[15] !== undefined) dataToWrite[15] = existingRow[15];

        if (hasChanges) {
          rowsToUpdate.push({ row: existingRowNum, data: dataToWrite });
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

    for (let i = 0; i < characterChangesToLog.length; i++) {
      const c = characterChangesToLog[i];
      logUpdate(c.studentNumber, c.fullName, academicYearSheet, c.trait, c.period,
        c.oldValue, c.newValue, `Re-imported from: ${ogsSpreadsheetName || 'OGS Template'}`, actualUserEmail);
    }

    if (rowsToInsert.length > 0) {
      const insertRow = lastDataRow + 1;
      const linkLabel = ogsSpreadsheetName || 'OGS Template';
      const dividerRow = new Array(numColumns).fill('');
      targetSheet.getRange(insertRow, 1, 1, numColumns).setValues([dividerRow]);
      targetSheet.getRange(insertRow, 1, 1, numColumns).merge();
      targetSheet.getRange(insertRow, 1).setFormula(`=HYPERLINK("${ogsTemplateUrl}","${linkLabel}")`);
      targetSheet.getRange(insertRow, 1).setBackground('#d9d9d9')
        .setFontStyle('italic').setFontColor('#1155cc').setFontSize(10)
        .setHorizontalAlignment('left').setVerticalAlignment('middle');
      targetSheet.setRowHeight(insertRow, 25);
      const dataInsertRow = insertRow + 1;
      const paddedRows = rowsToInsert.map(r => {
        const arr = r.slice();
        while (arr.length < numColumns) arr.push('');
        return arr.slice(0, numColumns);
      });
      targetSheet.getRange(dataInsertRow, 1, paddedRows.length, numColumns).setValues(paddedRows);
    }

    const updatedCount = rowsToUpdate.length;
    const insertedCount = rowsToInsert.length;

    return {
      success: true,
      message: `Successfully imported character data.\n\n` +
        `Updated: ${updatedCount} row(s)\n` +
        `Inserted: ${insertedCount} row(s)\n\n` +
        `Advisor: ${advisorName}\n` +
        `School Year: ${schoolYear}\n` +
        `Level: ${level}\n` +
        `Section: ${section}`
    };

  } catch (error) {
    console.error('Error importing characters:', error);
    return { success: false, message: `Error importing character data: ${error.toString()}` };
  }
}

function _getCharacterInfo(studentNumber, academicYearSheet, section, trait) {
  try {
    if (!studentNumber || studentNumber.toString().trim() === '') {
      return { success: false, message: 'Student number cannot be empty' };
    }
    if (!academicYearSheet || academicYearSheet.toString().trim() === '') {
      return { success: false, message: 'Academic year must be specified' };
    }
    if (!section || section.toString().trim() === '') {
      return { success: false, message: 'Section must be specified' };
    }
    if (!trait || trait.toString().trim() === '') {
      return { success: false, message: 'Trait must be specified' };
    }

    const targetSheet = getSheet(academicYearSheet);
    if (!targetSheet) {
      return { success: false, message: 'Academic year sheet not found' };
    }

    const lastRow = targetSheet.getLastRow();
    if (lastRow < 2) {
      return { success: false, message: 'No character data found in the sheet' };
    }

    const numCols = Math.max(CHAR_EXPECTED_COLS, targetSheet.getLastColumn());
    const dataRange = targetSheet.getRange(2, 1, lastRow, numCols);
    const data = dataRange.getValues();
    const formulas = targetSheet.getRange(2, 1, lastRow, 1).getFormulas();

    const studentNum = studentNumber.toString().trim();
    const sectionTrim = section.toString().trim();
    const traitTrim = trait.toString().trim();

    for (let i = 0; i < data.length; i++) {
      if (formulas[i][0] && typeof formulas[i][0] === 'string' && formulas[i][0].includes('HYPERLINK')) continue;
      const row = data[i];
      if (String(row[0] || '').trim() === studentNum &&
          String(row[3] || '').trim() === sectionTrim &&
          String(row[5] || '').trim() === traitTrim) {
        return {
          success: true,
          characterData: {
            'Student Number': row[0],
            'Full Name': row[1],
            'Grade Level': row[2],
            'Section': row[3],
            'Advisor': row[4],
            'Trait': row[5],
            '1st Grade': row[6] || '',
            '1st EQ': row[7] || '',
            '2nd Grade': row[8] || '',
            '2nd EQ': row[9] || '',
            '3rd Grade': row[10] || '',
            '3rd EQ': row[11] || '',
            '4th Grade': row[12] || '',
            '4th EQ': row[13] || '',
            'Final Grading': row[14] || '',
            'Final EQ': row[15] || ''
          },
          rowIndex: i + 2
        };
      }
    }
    return { success: false, message: 'Character record not found for the specified student, section, and trait' };
  } catch (error) {
    console.error('Error getting character info:', error);
    return { success: false, message: `Error retrieving character data: ${error.toString()}` };
  }
}

function _updateCharacter(studentNumber, academicYearSheet, section, trait, firstGrade, secondGrade, thirdGrade, fourthGrade, remarks, userEmail) {
  try {
    if (!studentNumber || studentNumber.toString().trim() === '') {
      return { success: false, message: 'Student number cannot be empty' };
    }
    if (!academicYearSheet || academicYearSheet.toString().trim() === '') {
      return { success: false, message: 'Academic year must be specified' };
    }
    if (!section || section.toString().trim() === '') {
      return { success: false, message: 'Section must be specified' };
    }
    if (!trait || trait.toString().trim() === '') {
      return { success: false, message: 'Trait must be specified' };
    }

    const info = _getCharacterInfo(studentNumber, academicYearSheet, section, trait);
    if (!info.success) return info;

    const targetSheet = getSheet(academicYearSheet);
    const rowIndex = info.rowIndex;
    const updates = [];
    const actualUserEmail = userEmail || Session.getActiveUser().getEmail();

    const gradeUpdates = [
      { col: 7, key: '1st Grade', value: firstGrade },
      { col: 9, key: '2nd Grade', value: secondGrade },
      { col: 11, key: '3rd Grade', value: thirdGrade },
      { col: 13, key: '4th Grade', value: fourthGrade }
    ];
    for (let u = 0; u < gradeUpdates.length; u++) {
      const g = gradeUpdates[u];
      if (g.value === undefined || g.value === null) continue;
      const oldVal = String(info.characterData[g.key] || '').trim();
      const newVal = String(g.value).trim();
      if (oldVal !== newVal) {
        targetSheet.getRange(rowIndex, g.col).setValue(newVal);
        logUpdate(studentNumber, info.characterData['Full Name'], academicYearSheet, info.characterData['Trait'], g.key, oldVal, newVal, remarks || '', actualUserEmail);
        updates.push(g.key);
      }
    }

    if (updates.length === 0) {
      return { success: false, message: 'No changes detected. All values are the same as current values.' };
    }
    return { success: true, message: `Successfully updated: ${updates.join(', ')}` };
  } catch (error) {
    console.error('Error updating character:', error);
    return { success: false, message: `Error updating character: ${error.toString()}` };
  }
}

function logUpdate(studentNumber, fullName, academicYear, trait, period, originalValue, updatedValue, remarks, userEmail) {
  try {
    const spreadsheet = getSpreadsheet();
    let logSheet = spreadsheet.getSheetByName('UPDATE LOG');
    if (!logSheet) {
      logSheet = spreadsheet.insertSheet('UPDATE LOG');
      const headers = ['Timestamp', 'Updated By', 'Student Number', 'Full Name', 'School Year', 'Trait', 'Period', 'Original Value', 'Updated Value', 'Remarks'];
      logSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      logSheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
      logSheet.setFrozenRows(1);
    }
    const actualUserEmail = userEmail || Session.getActiveUser().getEmail();
    const logEntry = [
      new Date(),
      actualUserEmail,
      studentNumber,
      fullName,
      academicYear,
      trait || '',
      period || '',
      originalValue,
      updatedValue,
      remarks || ''
    ];
    const nextRow = logSheet.getLastRow() + 1;
    logSheet.getRange(nextRow, 1, 1, logEntry.length).setValues([logEntry]);
    logSheet.getRange(nextRow, 1, 1, logEntry.length).setHorizontalAlignment('left');
    logSheet.getRange(nextRow, 1).setNumberFormat('yyyy-MM-dd HH:mm:ss');
  } catch (error) {
    console.error('Error logging update:', error);
  }
}
