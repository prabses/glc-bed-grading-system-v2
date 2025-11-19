# Template Masterfile - Working Instructions

## Table of Contents

1. [System Overview](#system-overview)
2. [Generate OGS Template Instructions](#generate-ogs-template-instructions)
3. [Manage Subjects Instructions](#manage-subjects-instructions)
4. [Manage Advisory Classes Instructions](#manage-advisory-classes-instructions)
5. [Data Management Instructions](#data-management-instructions)
6. [Troubleshooting Guide](#troubleshooting-guide)

---

## System Overview

The Template Masterfile is a Google Apps Script application that manages Official Grade Sheet (OGS) template generation for educational institutions. The system provides three main interfaces:

- **Generate OGS Template Form**: For creating Official Grade Sheet templates with multiple subjects
- **Manage Subjects Form**: For assigning teachers to grade levels, sections, and subjects
- **Manage Advisory Classes Form**: For assigning teachers to advisory classes (grade level and section)

All forms are accessible through custom menus in the Google Sheets interface and feature secure API architecture for data operations.

---

## Generate OGS Template Instructions

### Accessing the Generate OGS Template Form

1. Open the main Google Sheets document containing the Template Masterfile
2. Click on the **"Export OGS"** menu in the top menu bar
3. Select **"Export OGS"** from the dropdown menu
4. The Generate OGS Template Form will open in a modal dialog window

### Understanding the Generate OGS Template Form Interface

The form contains the following fields:

- **School Year Input**: Text field for entering the school year (e.g., "2024-2025")
- **Grade Level Dropdown**: Select the grade level (e.g., "Grade 1", "Grade 2")
- **Section Dropdown**: Select the section (populated based on grade level selection)
- **Teacher Input**: Autocomplete field for selecting teacher (filtered by grade/section)
- **Assigned Subjects Display**: Shows subjects that will be included in the template
- **Action Buttons**: Cancel and Generate Template buttons

### Generating an OGS Template

1. **Enter School Year**

   - Type the school year in the **School Year** field
   - Format: "YYYY-YYYY" (e.g., "2024-2025")
   - This field is required

2. **Select Grade Level**

   - Click on the **Grade Level** dropdown
   - Select the appropriate grade level (e.g., "Grade 1", "Grade 7", "Grade 11")
   - The Section dropdown will become enabled after selection
   - The Teacher field will be disabled until section is selected

3. **Select Section**

   - After selecting a grade level, the **Section** dropdown will populate
   - Select the section for the class (e.g., "A", "B", "C")
   - The Teacher field will become enabled after section selection
   - Sections are filtered based on the selected grade level

4. **Select Teacher**

   - Type the teacher's name in the **Teacher** field
   - As you type, matching teachers assigned to the selected grade/section will appear
   - Click on a suggestion or use arrow keys to navigate and Enter to select
   - Only teachers assigned to the selected grade level and section will appear

5. **Review Assigned Subjects**

   - After selecting a teacher, the **Assigned Subjects** section will appear
   - This shows all subjects assigned to the selected teacher for the grade/section
   - Subjects are automatically detected from the SUBJECTS sheet
   - Verify that all expected subjects are listed

6. **Generate the Template**

   - Click the **"Generate Template"** button
   - The button will show "Generating..." during the process
   - Wait for the success confirmation message
   - The template file will be created in Google Drive
   - A link to the template will be provided in the success message

7. **After Successful Generation**

   - The template file will contain one sheet per subject
   - Each sheet includes:
     - Student information columns (Student Number, Last Name, First Name, Middle Name)
     - Four grading periods (1ST, 2ND, 3RD, 4TH GRADING)
     - Grading components per period (Written Work, Performance Task, Assessment)
     - Transmuted grades for each period
     - Final grading column
   - The template is saved to Google Drive
   - A record is added to the MASTER_DATA sheet with a link to the template

### Generate OGS Template Form Error Handling

1. **Missing Required Fields**

   - If any required field is empty, an alert will prompt you to fill it
   - Ensure School Year, Grade Level, Section, and Teacher are all selected

2. **No Subjects Assigned**

   - If no subjects are assigned to the selected teacher/grade/section, an error will appear
   - You must assign subjects first using the "Manage Subjects" form
   - See the Manage Subjects Instructions section for details

3. **Template Already Exists**

   - If a template file already exists for the same combination, an error will show
   - The error message will include a link to the existing file
   - Delete the existing file if you want to regenerate it

4. **Teacher Not Found**

   - If no teachers are assigned to the selected grade/section, the teacher field will be disabled
   - Assign teachers to subjects first using the "Manage Subjects" form

---

## Manage Subjects Instructions

### Accessing the Manage Subjects Form

1. Open the main Google Sheets document containing the Template Masterfile
2. Click on the **"Menu"** in the top menu bar
3. Select **"Manage Subjects"** from the dropdown menu
4. The Manage Subjects Form will open in a modal dialog window

### Understanding the Manage Subjects Form Interface

The form contains the following sections:

#### Form Fields Section (Add Subjects)

- **Grade Level Dropdown**: Select the grade level
- **Section Dropdown**: Select the section (populated based on grade level)
- **Teacher Input**: Autocomplete field for selecting teacher
- **Subjects Checkboxes**: List of all active subjects from SUBJECTS_REF sheet
- **Action Buttons**: Add Subject and Close buttons

#### Subjects List Section (View/Delete Existing)

- **Select All Checkbox**: Select or deselect all subjects in the list
- **Selected Count Display**: Shows how many subjects are selected
- **Delete Selected Button**: Removes selected subject assignments
- **Subjects List**: Shows current subject assignments for the selected grade/section

### Adding Subject Assignments

1. **Select Grade Level**

   - Click on the **Grade Level** dropdown
   - Select the appropriate grade level
   - The Section dropdown will become enabled

2. **Select Section**

   - After selecting a grade level, the **Section** dropdown will populate
   - Select the section for the class
   - The subjects list below will update to show existing assignments

3. **Select Teacher**

   - Type the teacher's name in the **Teacher** field
   - As you type, matching active teachers will appear in a dropdown
   - Click on a suggestion or use arrow keys to navigate and Enter to select
   - Only active teachers from TEACHERS_REF will appear

4. **Select Subjects**

   - Check the boxes next to the subjects you want to assign
   - You can select multiple subjects at once
   - All active subjects from SUBJECTS_REF are shown
   - Selected subjects will be assigned to the teacher for the grade/section

5. **Add the Assignment**

   - Click the **"Add Subject"** button
   - The button will show "Adding..." during the process
   - If multiple subjects are selected, it will show "Adding X assignment(s)..."
   - Wait for the success confirmation message

6. **After Successful Addition**

   - The subjects will be assigned to the teacher
   - The subjects list will refresh to show the new assignments
   - The form will reset for adding more assignments

### Viewing Existing Subject Assignments

1. **Select Grade Level and Section**

   - Select the grade level and section you want to view
   - The subjects list will automatically update to show existing assignments
   - Each assignment shows: Teacher name and Subject name

2. **Understanding the List**

   - Only active assignments are shown
   - Each row represents one teacher-subject assignment
   - The list updates automatically when you change grade level or section

### Deleting Subject Assignments

1. **Select Assignments to Delete**

   - Check the boxes next to the assignments you want to remove
   - You can select multiple assignments at once
   - Use "Select All" to select all visible assignments
   - The selected count will update as you select/deselect

2. **Delete Selected Assignments**

   - Click the **"Delete Selected"** button
   - A confirmation dialog will appear
   - Confirm the deletion
   - The button will show "Deleting X..." during the process
   - Wait for the success confirmation message

3. **After Successful Deletion**

   - The selected assignments will be removed (marked as Archived)
   - The subjects list will refresh to show remaining assignments
   - The assignments are archived, not permanently deleted

### Manage Subjects Form Error Handling

1. **Missing Required Fields**

   - If any required field is empty, an alert will prompt you to fill it
   - Ensure Grade Level, Section, Teacher, and at least one Subject are selected

2. **Subject Already Assigned**

   - If a subject is already assigned to a different teacher for the same grade/section, an error will appear
   - You must deactivate the existing assignment first
   - The error message will show which assignments conflict

3. **No Subjects Selected**

   - If you try to add assignments without selecting any subjects, an alert will appear
   - Select at least one subject checkbox before clicking "Add Subject"

4. **No Assignments to Delete**

   - If you try to delete without selecting any assignments, an alert will appear
   - Select at least one assignment checkbox before clicking "Delete Selected"

---

## Manage Advisory Classes Instructions

### Accessing the Manage Advisory Classes Form

1. Open the main Google Sheets document containing the Template Masterfile
2. Click on the **"Menu"** in the top menu bar
3. Select **"Manage Advisory Classes"** from the dropdown menu
4. The Manage Advisory Classes Form will open in a modal dialog window

### Understanding the Manage Advisory Classes Form Interface

The form contains the following sections:

#### Form Fields Section (Add Advisory)

- **Teacher Input**: Autocomplete field for selecting teacher
- **Grade Level Dropdown**: Select the grade level
- **Section Dropdown**: Select the section (populated based on grade level)
- **Action Buttons**: Add Advisory and Close buttons

#### Advisories List Section (View/Delete Existing)

- **Select All Checkbox**: Select or deselect all advisories in the list
- **Selected Count Display**: Shows how many advisories are selected
- **Delete Selected Button**: Removes selected advisory assignments
- **Advisories List**: Shows current advisory assignments for the selected teacher

### Adding Advisory Assignments

1. **Select Teacher**

   - Type the teacher's name in the **Teacher** field
   - As you type, matching active teachers will appear in a dropdown
   - Click on a suggestion or use arrow keys to navigate and Enter to select
   - Only active teachers from TEACHERS_REF will appear

2. **Select Grade Level**

   - Click on the **Grade Level** dropdown
   - Select the appropriate grade level
   - The Section dropdown will become enabled

3. **Select Section**

   - After selecting a grade level, the **Section** dropdown will populate
   - Select the section for the advisory class
   - The advisories list will update to show existing assignments for the teacher

4. **Add the Advisory**

   - Click the **"Add Advisory"** button
   - The button will show "Adding..." during the process
   - Wait for the success confirmation message

5. **After Successful Addition**

   - The advisory will be assigned to the teacher
   - The advisories list will refresh to show the new assignment
   - The form will reset for adding more advisories

### Viewing Existing Advisory Assignments

1. **Select Teacher**

   - Type or select a teacher in the **Teacher** field
   - The advisories list will automatically update to show existing assignments
   - Each assignment shows: Grade Level and Section (e.g., "Grade 1A")

2. **Understanding the List**

   - Only active advisories are shown
   - Each row represents one teacher-grade-section advisory assignment
   - The list updates automatically when you change the teacher

### Deleting Advisory Assignments

1. **Select Advisories to Delete**

   - Check the boxes next to the advisories you want to remove
   - You can select multiple advisories at once
   - Use "Select All" to select all visible advisories
   - The selected count will update as you select/deselect

2. **Delete Selected Advisories**

   - Click the **"Delete Selected"** button
   - A confirmation dialog will appear
   - Confirm the deletion
   - The button will show "Deleting..." during the process
   - Wait for the success confirmation message

3. **After Successful Deletion**

   - The selected advisories will be removed (marked as Archived)
   - The advisories list will refresh to show remaining assignments
   - The advisories are archived, not permanently deleted

### Manage Advisory Classes Form Error Handling

1. **Missing Required Fields**

   - If any required field is empty, an alert will prompt you to fill it
   - Ensure Teacher, Grade Level, and Section are all selected

2. **Advisory Already Assigned**

   - If a grade/section already has an active advisory with a different teacher, an error will appear
   - You must deactivate the existing advisory first
   - The error message will show which advisory conflicts

3. **No Advisories to Delete**

   - If you try to delete without selecting any advisories, an alert will appear
   - Select at least one advisory checkbox before clicking "Delete Selected"

---

## Data Management Instructions

### Reference Sheets

The system uses several reference sheets that you can edit directly:

1. **SUBJECTS_REF Sheet**

   - Contains the list of all available subjects
   - Add new subjects by adding a new row with the subject name
   - Mark subjects as active/inactive using the Active column (✓ for active)
   - Only active subjects appear in the Manage Subjects form

2. **TEACHERS_REF Sheet**

   - Contains the list of all teachers
   - Add new teachers by adding a new row with the teacher name
   - Mark teachers as active/inactive using the Active column (✓ for active)
   - Only active teachers appear in the forms

3. **SECTIONS_REF Sheet**

   - Contains grade levels and sections
   - Add new sections by adding a new row with grade level and section
   - The Level column (Elementary/JHS/SHS) is automatically determined
   - Sections are filtered by grade level in the forms

4. **GRADING_REF Sheet**

   - Contains grading weight configurations for subjects
   - Each row defines weights for Written Work, Performance Task, and Assessment
   - Subject-specific weights override the DEFAULT row
   - Only active rows are used
   - The DEFAULT row serves as a fallback for subjects without specific weights

### Protected Sheets

The following sheets are managed automatically by the system and should not be edited directly:

1. **MASTER_DATA Sheet**

   - Contains records of all generated OGS templates
   - Each row represents one template file
   - Includes: School Year, Grade Level, Section, Teacher, Template Link, Created, Modified, Created By
   - Templates are linked via hyperlinks in the Template Link column

2. **SUBJECTS Sheet**

   - Contains all subject assignments (teacher-grade-section-subject)
   - Managed through the Manage Subjects form
   - Includes status (Active/Archived) and audit fields

3. **ADVISORY Sheet**

   - Contains all advisory assignments (teacher-grade-section)
   - Managed through the Manage Advisory Classes form
   - Includes status (Active/Archived) and audit fields

### Template File Structure

1. **File Organization**

   - Templates are saved to Google Drive
   - File names follow a specific format based on the template details
   - Each template file contains multiple sheets (one per subject)

2. **Sheet Structure per Subject**

   - Each subject sheet includes:
     - Header information (Teacher, School Year, Level, Section, Subject)
     - Student information columns
     - Four grading periods with three components each
     - Transmuted grades and final grading
   - Formulas are automatically set up for grade calculations

3. **Student Data Integration**

   - Templates can pull student data from the STUDENTS DB spreadsheet
   - Student information is automatically populated if available
   - Student rows are pre-created for easy data entry

---

## Troubleshooting Guide

### Form Loading Problems

**Issue**: Forms don't open or show errors
**Solutions**:

1. Check your internet connection
2. Refresh the browser page
3. Close and reopen the form from the Google Sheets menu
4. Ensure you have proper permissions to access the spreadsheet
5. Check that the script is properly deployed as a web app

### Template Generation Failures

**Issue**: OGS template doesn't generate or shows errors
**Solutions**:

1. Verify that subjects are assigned to the teacher for the selected grade/section
2. Check that the teacher exists in TEACHERS_REF and is marked as active
3. Ensure GRADING_REF has a DEFAULT row with active status
4. Verify all required fields are filled (School Year, Grade Level, Section, Teacher)
5. Check script execution logs for detailed error messages
6. Ensure you have Google Drive permissions to create files

### Subject Assignment Errors

**Issue**: Cannot assign subjects or shows conflict errors
**Solutions**:

1. Verify the subject exists in SUBJECTS_REF and is marked as active
2. Check if the subject is already assigned to a different teacher for the same grade/section
3. Deactivate the existing assignment first if you want to reassign it
4. Ensure the teacher exists in TEACHERS_REF and is marked as active
5. Verify grade level and section are correctly selected

### Advisory Assignment Errors

**Issue**: Cannot assign advisory or shows conflict errors
**Solutions**:

1. Check if the grade/section already has an active advisory with a different teacher
2. Deactivate the existing advisory first if you want to reassign it
3. Ensure the teacher exists in TEACHERS_REF and is marked as active
4. Verify grade level and section are correctly selected

### Dropdown Not Populating

**Issue**: Dropdowns are empty or don't show expected options
**Solutions**:

1. Check that reference sheets (SUBJECTS_REF, TEACHERS_REF, SECTIONS_REF) have data
2. Verify items are marked as active (✓ in Active column)
3. Ensure reference sheets follow the correct structure (2 header rows)
4. Refresh the form to reload data
5. Check that sheet names match exactly (case-sensitive)

### Teacher Autocomplete Not Working

**Issue**: Teacher suggestions don't appear or are incorrect
**Solutions**:

1. Verify teachers exist in TEACHERS_REF and are marked as active
2. Check that you've selected grade level and section first (for OGS template form)
3. Ensure you're typing the teacher name correctly
4. Try refreshing the form
5. Check that the teacher is assigned to subjects for the selected grade/section (OGS form)

### Template File Not Found

**Issue**: Cannot locate generated template file
**Solutions**:

1. Check the MASTER_DATA sheet for the template link
2. Click on the "Open Template" hyperlink in the Template Link column
3. Verify you have access to the Google Drive folder where templates are saved
4. Check script execution logs for the file location
5. Search Google Drive for files with the expected naming pattern

### Grading Weights Not Applied

**Issue**: Template uses wrong grading weights
**Solutions**:

1. Check GRADING_REF sheet for the subject-specific weights
2. Verify the subject name matches exactly (case-sensitive)
3. Ensure the row is marked as active (✓ in Active column)
4. Check that a DEFAULT row exists as a fallback
5. Verify weights add up to 100% (Written Work + Performance Task + Assessment)

### Permission Errors

**Issue**: "Access denied" or permission-related error messages
**Solutions**:

1. Verify you're logged into the correct Google account
2. Check with your administrator about access permissions
3. Ensure you have edit access to the spreadsheet
4. Verify you have Google Drive permissions to create files
5. Check that the script is deployed with proper permissions
6. Try logging out and back into Google

### Data Not Saving

**Issue**: Changes don't persist after form submission
**Solutions**:

1. Check that the Web App URL is properly configured in Config.js
2. Verify the API key is correct
3. Ensure the script is deployed as a web app
4. Check script execution logs for errors
5. Verify you have write permissions to the spreadsheet
6. Try refreshing the form and submitting again

### Reference Sheet Structure Issues

**Issue**: Forms don't recognize data in reference sheets
**Solutions**:

1. Verify reference sheets have exactly 2 header rows
2. Check that the Active column is the last column
3. Ensure data starts from row 3 (after 2 header rows)
4. Verify column names match expected format
5. Check for extra spaces or formatting issues in data

### Batch Operations Slow

**Issue**: Adding or deleting multiple items is slow
**Solutions**:

1. The system uses batch operations for better performance
2. Wait for the operation to complete (shows progress in button text)
3. Avoid clicking multiple times
4. Check your internet connection speed
5. Try smaller batches if dealing with very large numbers of items

_This working instruction document covers the complete functionality of the Template Masterfile system. For additional support or system modifications, contact your systems developer._

