/**
 * API.js - API Architecture Layer for Attendance Database
 * Imports attendance data from OGS template Attendance sheet
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
      case "importAttendance":
        return response(200, _importAttendance(
          payload.ogsTemplateUrl,
          payload.academicYearSheet,
          payload.userEmail
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
          payload.daysAbsent,
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

function _importAttendance(ogsTemplateUrl, academicYearSheet, userEmail) {
  const expectedColumnCount = 9;
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

    const attendanceSheet = ogsSpreadsheet.getSheetByName('Attendance');
    if (!attendanceSheet) {
      return {
        success: false,
        message: 'Attendance sheet not found in OGS template. Please ensure the template contains an Attendance sheet.'
      };
    }

    const infoData = attendanceSheet.getRange(1, 1, 5, 2).getValues();
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
        message: 'Could not extract required information from Attendance sheet. Ensure headers: Advisor Name, Level, Section.'
      };
    }

    const normalizedGradeLevel = normalizeGradeLevel(level);
    const lastCol = attendanceSheet.getLastColumn();
    const lastRow = attendanceSheet.getLastRow();
    if (lastRow < 8) {
      return { success: false, message: 'No student attendance data found in Attendance sheet.' };
    }

    const monthRow = attendanceSheet.getRange(6, 1, 6, lastCol).getValues()[0];
    const ogsMonths = [];
    for (let c = 2; c < lastCol; c += 3) {
      const monthVal = String(monthRow[c] || '').trim();
      if (monthVal) {
        ogsMonths.push({ name: monthVal, ogsStartCol: c });
      }
    }

    if (ogsMonths.length === 0) {
      return { success: false, message: 'No month columns found in Attendance sheet (row 6).' };
    }

    const targetSheet = getSheet(academicYearSheet);
    if (!targetSheet) {
      return {
        success: false,
        message: `Academic year sheet "${academicYearSheet}" not found in ATTENDANCE DB. Please ensure the sheet exists.`
      };
    }

    const headerRow = targetSheet.getRange(1, 1, 1, targetSheet.getLastColumn()).getValues()[0];
    const numColumns = headerRow.length;
    if (numColumns < expectedColumnCount) {
      return {
        success: false,
        message: `Target sheet should have at least ${expectedColumnCount} columns (Student#, Full Name, Grade Level, Section, Advisor, Month, School DAYS, Days PRESENT, Days ABSENT). Found ${numColumns}.`
      };
    }

    const dataStartRow = 8;
    const studentData = attendanceSheet.getRange(dataStartRow, 1, lastRow, lastCol).getValues();
    const allRows = [];

    for (let j = 0; j < studentData.length; j++) {
      const row = studentData[j];
      const studentNumber = String(row[0] || '').trim();
      const studentName = String(row[1] || '').trim();
      if (!studentNumber) continue;

      for (let m = 0; m < ogsMonths.length; m++) {
        const ogsCol = ogsMonths[m].ogsStartCol;
        const schoolDays = row[ogsCol] !== null && row[ogsCol] !== undefined ? String(row[ogsCol]).trim() : '';
        const daysPresent = row[ogsCol + 1] !== null && row[ogsCol + 1] !== undefined ? String(row[ogsCol + 1]).trim() : '';
        const rowData = [
          studentNumber,
          studentName,
          normalizedGradeLevel,
          section,
          advisorName,
          ogsMonths[m].name,
          schoolDays,
          daysPresent,
          ''  // Days ABSENT left blank (formula-derived in OGS)
        ];
        allRows.push(rowData);
      }
    }

    if (allRows.length === 0) {
      return { success: false, message: 'No student attendance records found in Attendance sheet.' };
    }

    allRows.sort((a, b) => String(a[0] || '').localeCompare(String(b[0] || '')));

    const sheetLastRow = targetSheet.getLastRow();
    const rangeEnd = Math.max(2, sheetLastRow);
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
        const month = String(existingValues[i][5] || '').trim();
        if (studentNum && rowSection && month) {
          const key = `${studentNum}|${rowSection}|${month}`;
          existingKeys.set(key, i + 2);
          existingDataMap.set(key, existingValues[i]);
        }
      }
    }

    const actualUserEmail = userEmail || Session.getActiveUser().getEmail();
    const rowsToUpdate = [];
    const rowsToInsert = [];
    const attendanceChangesToLog = [];

    for (let i = 0; i < allRows.length; i++) {
      const rowData = allRows[i];
      const studentNumber = String(rowData[0] || '').trim();
      const month = String(rowData[5] || '').trim();
      const key = `${studentNumber}|${section}|${month}`;

      if (existingKeys.has(key)) {
        const existingRowNum = existingKeys.get(key);
        const existingRow = existingDataMap.get(key);
        const isFromSameImport = isReImport && existingDividerRow && existingImportEndRow &&
          existingRowNum > existingDividerRow && existingRowNum < existingImportEndRow;

        let hasChanges = false;
        const changes = [];
        for (let col = 6; col < 8; col++) {
          const oldVal = existingRow[col] !== null && existingRow[col] !== undefined ? String(existingRow[col]).trim() : '';
          const newVal = rowData[col] !== null && rowData[col] !== undefined ? String(rowData[col]).trim() : '';
          if (oldVal !== newVal) {
            hasChanges = true;
            if (isFromSameImport) {
              const fieldNames = ['School DAYS', 'Days PRESENT'];
              changes.push({
                period: fieldNames[col - 6],
                oldValue: oldVal,
                newValue: newVal
              });
            }
          }
        }

        if (hasChanges) {
          const dataToWrite = rowData.slice();
          dataToWrite[8] = existingRow[8] !== undefined ? existingRow[8] : '';
          rowsToUpdate.push({ row: existingRowNum, data: dataToWrite });
          if (isFromSameImport && changes.length > 0) {
            const fullName = String(rowData[1] || '').trim();
            changes.forEach(c => {
              attendanceChangesToLog.push({
                studentNumber, fullName, month, period: c.period,
                oldValue: c.oldValue, newValue: c.newValue
              });
            });
          }
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

    for (let i = 0; i < attendanceChangesToLog.length; i++) {
      const c = attendanceChangesToLog[i];
      logUpdate(c.studentNumber, c.fullName, academicYearSheet, `${c.month} ${c.period}`,
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
      message: `Successfully imported attendance.\n\n` +
        `Updated: ${updatedCount} row(s)\n` +
        `Inserted: ${insertedCount} row(s)\n\n` +
        `Advisor: ${advisorName}\n` +
        `School Year: ${schoolYear}\n` +
        `Level: ${level}\n` +
        `Section: ${section}`
    };

  } catch (error) {
    console.error('Error importing attendance:', error);
    return { success: false, message: `Error importing attendance: ${error.toString()}` };
  }
}

function _getAttendanceInfo(studentNumber, academicYearSheet, section, month) {
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
    if (!month || month.toString().trim() === '') {
      return { success: false, message: 'Month must be specified' };
    }

    const targetSheet = getSheet(academicYearSheet);
    if (!targetSheet) {
      return { success: false, message: 'Academic year sheet not found' };
    }

    const lastRow = targetSheet.getLastRow();
    if (lastRow < 2) {
      return { success: false, message: 'No attendance data found in the sheet' };
    }

    const numCols = Math.max(9, targetSheet.getLastColumn());
    const dataRange = targetSheet.getRange(2, 1, lastRow, numCols);
    const data = dataRange.getValues();
    const formulas = targetSheet.getRange(2, 1, lastRow, 1).getFormulas();

    const studentNum = studentNumber.toString().trim();
    const sectionTrim = section.toString().trim();
    const monthTrim = month.toString().trim();

    for (let i = 0; i < data.length; i++) {
      if (formulas[i][0] && typeof formulas[i][0] === 'string' && formulas[i][0].includes('HYPERLINK')) continue;
      const row = data[i];
      if (String(row[0] || '').trim() === studentNum &&
          String(row[3] || '').trim() === sectionTrim &&
          String(row[5] || '').trim() === monthTrim) {
        return {
          success: true,
          attendanceData: {
            'Student Number': row[0],
            'Full Name': row[1],
            'Grade Level': row[2],
            'Section': row[3],
            'Advisor': row[4],
            'Month': row[5],
            'School DAYS': row[6] || '',
            'Days PRESENT': row[7] || '',
            'Days ABSENT': row[8] || ''
          },
          rowIndex: i + 2
        };
      }
    }
    return { success: false, message: 'Attendance record not found for the specified student, section, and month' };
  } catch (error) {
    console.error('Error getting attendance info:', error);
    return { success: false, message: `Error retrieving attendance: ${error.toString()}` };
  }
}

function _updateAttendance(studentNumber, academicYearSheet, section, month, schoolDays, daysPresent, daysAbsent, remarks, userEmail) {
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
    if (!month || month.toString().trim() === '') {
      return { success: false, message: 'Month must be specified' };
    }

    const info = _getAttendanceInfo(studentNumber, academicYearSheet, section, month);
    if (!info.success) return info;

    const targetSheet = getSheet(academicYearSheet);
    const rowIndex = info.rowIndex;
    const updates = [];
    const actualUserEmail = userEmail || Session.getActiveUser().getEmail();

    const periodPrefix = month ? `${month} ` : '';
    if (schoolDays !== undefined && schoolDays !== null) {
      const oldVal = String(info.attendanceData['School DAYS'] || '').trim();
      const newVal = String(schoolDays).trim();
      if (oldVal !== newVal) {
        targetSheet.getRange(rowIndex, 7).setValue(newVal);
        logUpdate(studentNumber, info.attendanceData['Full Name'], academicYearSheet, periodPrefix + 'School DAYS', oldVal, newVal, remarks || '', actualUserEmail);
        updates.push('School DAYS');
      }
    }
    if (daysPresent !== undefined && daysPresent !== null) {
      const oldVal = String(info.attendanceData['Days PRESENT'] || '').trim();
      const newVal = String(daysPresent).trim();
      if (oldVal !== newVal) {
        targetSheet.getRange(rowIndex, 8).setValue(newVal);
        logUpdate(studentNumber, info.attendanceData['Full Name'], academicYearSheet, periodPrefix + 'Days PRESENT', oldVal, newVal, remarks || '', actualUserEmail);
        updates.push('Days PRESENT');
      }
    }
    // Days ABSENT is formula-derived (School DAYS - Days PRESENT); not editable

    if (updates.length === 0) {
      return { success: false, message: 'No changes detected. All values are the same as current values.' };
    }
    return { success: true, message: `Successfully updated: ${updates.join(', ')}` };
  } catch (error) {
    console.error('Error updating attendance:', error);
    return { success: false, message: `Error updating attendance: ${error.toString()}` };
  }
}

function logUpdate(studentNumber, fullName, academicYear, period, originalValue, updatedValue, remarks, userEmail) {
  try {
    const spreadsheet = getSpreadsheet();
    let logSheet = spreadsheet.getSheetByName('UPDATE LOG');
    if (!logSheet) {
      logSheet = spreadsheet.insertSheet('UPDATE LOG');
      const headers = ['Timestamp', 'Updated By', 'Student Number', 'Full Name', 'School Year', 'Period', 'Original Value', 'Updated Value', 'Remarks'];
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
      period,
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
