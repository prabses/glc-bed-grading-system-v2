# Students Database - Working Instructions

## Table of Contents

1. [System Overview](#system-overview)
2. [Academic Year Sheets](#academic-year-sheets)
3. [Import Student Data Instructions](#import-student-data-instructions)
4. [Update Student Information Instructions](#update-student-information-instructions)
5. [Data Management Instructions](#data-management-instructions)
6. [Troubleshooting Guide](#troubleshooting-guide)

---

## System Overview

The Students Database is a Google Apps Script application that manages student information for multiple academic years. The system provides two main interfaces:

- **Import Student Data Form**: For importing student records from CSV files into academic year sheets
- **Update Student Information Form**: For searching and modifying existing student records

Both forms are accessible through the **"Upload"** menu in the Google Sheets interface and feature secure API architecture for data operations.

---

## Academic Year Sheets

Before importing student data, ensure that your spreadsheet contains sheets named with the school year format (e.g., "2024-2025", "2023-2024"). These sheet names serve as the basis for the Academic Year dropdown selection in both the import and update forms. The dropdown only displays sheets that already exist and match the "YYYY-YYYY" format, so you must create the academic year sheet manually before importing data.

---

## Import Student Data Instructions

### Accessing the Import Student Data Form

1. Open the main Google Sheets document containing the Students Database
2. Click on the **"Upload"** menu in the top menu bar
3. Select **"Import Student Data"** from the dropdown menu
4. The Import Student Data Form will open in a modal dialog window

### Understanding the Import Student Data Form Interface

The form contains the following fields:

- **Academic Year Dropdown**: Select the target academic year sheet (e.g., "2024-2025")
- **CSV File Input**: File picker for selecting CSV files
- **Action Buttons**: Cancel and Import Data buttons

### Importing Student Data from CSV File

1. **Select Academic Year**

   - Click on the **Academic Year** dropdown
   - Select the academic year sheet where you want to import data
   - If the academic year sheet doesn't exist, it will be created automatically
   - Academic year sheets follow the format "YYYY-YYYY" (e.g., "2024-2025")

2. **Prepare Your CSV File**

   - Ensure your CSV file has the correct format with these headers in order:
     - Student Number
     - Last Name
     - First Name
     - Middle Name
     - Grade Level
     - Section
     - Strand
     - Gender
   - The first row must contain these exact headers
   - Data rows should start from the second row
   - Save your file as a CSV (.csv) format

3. **Upload the CSV File**

   - Click the **"Choose File"** button or file input area
   - Navigate to your CSV file and select it
   - The file name will appear in the input field

4. **Import the Data**

   - Click the **"Import Data"** button at the bottom of the form
   - The button will show "Importing..." during the process
   - Wait for the success confirmation message
   - The form will automatically close upon successful import

5. **Verify the Import**

   - Navigate to the selected academic year sheet in your spreadsheet
   - Verify that student data appears starting from row 3 (rows 1-2 are headers)
   - Check that all columns are properly populated

### Import Student Data Form Error Handling

1. **Duplicate Student Numbers**

   - If duplicate student numbers are found in the CSV, the import will be cancelled
   - An error message will show which student numbers are duplicates
   - Remove duplicates from your CSV file and try importing again
   - The system prevents importing any data if duplicates are detected

2. **CSV Format Errors**

   - If headers don't match the expected format, an error will display
   - Ensure headers are exactly: Student Number, Last Name, First Name, Middle Name, Grade Level, Section, Strand, Gender
   - Check that your CSV file is properly formatted (comma-separated values)

3. **Empty CSV File**

   - If the CSV file is empty or contains no data rows, an error will be shown
   - Ensure your CSV file contains at least one data row (in addition to headers)

4. **Missing Academic Year**

   - If you don't select an academic year, an alert will prompt you to select one
   - Select an academic year from the dropdown before importing

---

## Update Student Information Instructions

### Accessing the Update Student Information Form

1. Open the main Google Sheets document containing the Students Database
2. Click on the **"Upload"** menu in the top menu bar
3. Select **"Update Student Information"** from the dropdown menu
4. The Update Student Information Form will open in a modal dialog window

### Understanding the Update Student Information Form Interface

The form contains the following fields:

- **Academic Year Dropdown**: Select the academic year sheet to search
- **Student Number Input**: Text field with autocomplete for searching student numbers
- **Load Student Button**: Button to load student information
- **Current Student Information Panel**: Shows all current student data in a grid layout (appears after loading a student)
  - Displays: Student Number, Last Name, First Name, Middle Name, Grade Level, Section, Strand, Gender
- **Field to Update Dropdown**: Select which field you want to modify
- **Current Value Display**: Shows the current value of the selected field
- **New Value Input**: Enter the new value for the field
- **Remarks Input**: Optional field for notes about the update
- **Action Buttons**: Cancel and Update Information buttons

### Searching for Student Information

1. **Select Academic Year**

   - Click on the **Academic Year** dropdown
   - Select the academic year sheet where the student is enrolled
   - The student number autocomplete will populate based on the selected academic year

2. **Enter Student Number**

   - Type the student number in the **Student Number** field
   - As you type, matching student numbers will appear in a dropdown
   - You can click on a suggestion or continue typing
   - Use arrow keys to navigate suggestions and Enter to select

3. **Load Student Information**

   - Click the **"Load Student"** button
   - The button will show "Loading..." during the process
   - If found, student information will appear in the Current Student Information panel
   - The Update Section will become visible

4. **Search Results - Student Found**

   - A green notification will appear showing student data
   - All student fields will be displayed in the information panel
   - The Update Section will appear below the student information

5. **Search Results - Student Not Found**

   - An alert message will inform you that the student was not found
   - Verify the student number and academic year selection
   - Try searching again with the correct information

### Updating Student Information

1. **Prerequisites for Update**

   - A student must first be found using the search function (see previous section)
   - The form must be in "Update" mode with student information displayed
   - The Update Section must be visible

2. **Select Field to Update**

   - Click on the **Field to Update** dropdown
   - Select the field you want to modify (e.g., Last Name, First Name, Grade Level, etc.)
   - The current value will automatically appear in the Current Value display
   - Note: Student Number cannot be updated (it's the unique identifier)

3. **Enter New Value**

   - Type the new value in the **New Value** input field
   - The field will be focused automatically after selecting a field to update
   - Ensure the new value is correct before proceeding

4. **Add Remarks (Optional)**

   - Enter any notes or reasons for the update in the **Remarks** field
   - This information will be logged in the Update Log sheet
   - Remarks are optional but recommended for audit purposes

5. **Save Changes**

   - Click **"Update Information"** to save your changes
   - The button will show "Updating..." during the process
   - Only the selected field will be updated in the database
   - Wait for the success confirmation message

6. **After Successful Update**

   - A success message will show the old and new values
   - The update will be logged in the Update Log sheet
   - The form will automatically close
   - You can verify the change in the academic year sheet

### Update Student Information Form Error Handling

1. **Required Field Validation**

   - If you try to update without selecting a field, an alert will prompt you
   - Select a field from the dropdown before entering a new value
   - Ensure the new value is not empty

2. **Same Value Error**

   - If the new value is the same as the current value, an error will be shown
   - Enter a different value to proceed with the update

3. **Student Not Loaded**

   - If you try to update without loading student information first, an alert will appear
   - Load student information using the search function before updating

4. **Search Errors**

   - If search fails, verify the student number format
   - Check that the correct academic year is selected
   - Ensure the student exists in the selected academic year sheet

---

## Data Management Instructions

### Academic Year Sheets

1. **Sheet Naming Convention**

   - Academic year sheets must follow the format "YYYY-YYYY" (e.g., "2024-2025")
   - Sheets are automatically created when importing data if they don't exist
   - Only sheets matching this format will appear in the Academic Year dropdown

2. **Sheet Structure**

   - Row 1-2: Header rows (system-managed)
   - Row 3 onwards: Student data rows
   - Columns: Student Number, Last Name, First Name, Middle Name, Grade Level, Section, Strand, Gender

3. **Data Organization**

   - Each academic year has its own sheet
   - Student data is organized by academic year
   - Student numbers must be unique within each academic year

### Update Log Sheet

1. **Automatic Logging**

   - All student information updates are automatically logged
   - The Update Log sheet is created automatically if it doesn't exist
   - Each update creates a new log entry

2. **Log Entry Information**

   - Timestamp: When the update was made
   - Updated By: Email of the user who made the update
   - Student Number: The student's identification number
   - Academic Year: The academic year sheet where the update was made
   - Field Updated: Which field was changed
   - Old Value: The previous value
   - New Value: The updated value
   - Remarks: Any notes provided during the update

3. **Viewing Update Log**

   - Navigate to the "Update Log" sheet in your spreadsheet
   - All updates are listed chronologically
   - Use filters to search for specific students or time periods

### Data Validation

1. **Student Number Uniqueness**

   - Student numbers must be unique within each academic year
   - The system prevents importing duplicate student numbers
   - Updates do not change student numbers (they are immutable)

2. **Required Fields**

   - All fields are required during import
   - During updates, only the field being updated needs a new value
   - Empty values are not allowed

3. **Data Format**

   - CSV files must match the exact header format
   - Data is stored as text to prevent auto-formatting
   - All imported data is left-aligned

---

## Troubleshooting Guide

### Import Form Loading Problems

**Issue**: Import form doesn't open or shows errors
**Solutions**:

1. Check your internet connection
2. Refresh the browser page
3. Close and reopen the form from the Google Sheets menu
4. Ensure you have proper permissions to access the spreadsheet
5. Check that the script is properly deployed

### CSV Import Failures

**Issue**: CSV file doesn't import or shows format errors
**Solutions**:

1. Verify CSV headers match exactly: Student Number, Last Name, First Name, Middle Name, Grade Level, Section, Strand, Gender
2. Check that the CSV file is saved in UTF-8 encoding
3. Ensure there are no special characters causing parsing issues
4. Verify the CSV file is not corrupted
5. Check that student numbers are unique within the file
6. Ensure data rows start from row 2 (row 1 is headers)

### Duplicate Student Number Errors

**Issue**: Import fails due to duplicate student numbers
**Solutions**:

1. Review the error message to identify duplicate student numbers
2. Remove duplicate entries from your CSV file
3. Check the academic year sheet for existing student numbers
4. Ensure each student has a unique student number
5. Re-import the corrected CSV file

### Update Form Not Finding Students

**Issue**: Student search doesn't return results
**Solutions**:

1. Verify the student number is correct
2. Check that the correct academic year is selected
3. Ensure the student exists in the selected academic year sheet
4. Try typing the full student number without spaces
5. Check the academic year sheet directly to confirm the student exists

### Update Failures

**Issue**: Student information doesn't update or shows errors
**Solutions**:

1. Ensure all required fields are filled (field selection and new value)
2. Check that the new value is different from the current value
3. Verify you have write permissions to the spreadsheet
4. Ensure your internet connection is stable
5. Try refreshing the form and updating again
6. Check the Update Log to see if the update was recorded

### Academic Year Sheet Not Appearing

**Issue**: Academic year doesn't appear in the dropdown
**Solutions**:

1. Verify the sheet name follows the format "YYYY-YYYY" (e.g., "2024-2025")
2. Check that the sheet exists in the spreadsheet
3. Ensure there are no extra spaces in the sheet name
4. Create the sheet manually if needed (following the naming convention)
5. Refresh the form to reload available sheets

### Permission Errors

**Issue**: "Access denied" or permission-related error messages
**Solutions**:

1. Verify you're logged into the correct Google account
2. Check with your administrator about access permissions
3. Ensure you have edit access to the spreadsheet
4. Try logging out and back into Google
5. Contact your systems administrator for permission updates

### Update Log Not Appearing

**Issue**: Update Log sheet doesn't exist or updates aren't logged
**Solutions**:

1. The Update Log sheet is created automatically on first update
2. Check if the sheet exists in your spreadsheet
3. Verify updates are being saved (check the academic year sheet)
4. Check script execution logs for errors
5. The log may be in a different location if the sheet was renamed

### Data Formatting Issues

**Issue**: Imported data appears incorrectly formatted
**Solutions**:

1. Data is intentionally left-aligned to prevent auto-formatting
2. Check the CSV file encoding (should be UTF-8)
3. Verify special characters are properly handled
4. Review the source CSV file for formatting issues
5. Re-import if necessary after fixing the CSV file

### Script Execution Errors

**Issue**: Scripts fail to execute or timeout
**Solutions**:

1. Check Tools → Script editor → Executions for error details
2. Ensure the Web App URL is properly configured in Config.js
3. Verify the API key is correct
4. Check that the script is deployed as a web app
5. Try running the script again after a few minutes
6. Contact your systems developer if problems persist

_This working instruction document covers the complete functionality of the Students Database system. For additional support or system modifications, contact your systems developer._

