# Template Masterfile Sheet Structure Guide

## 📋 Overview

This document outlines the **Google Sheets-native structure** for the Template Masterfile spreadsheet. This structure promotes efficiency, dynamicness, and ease of use without requiring complex SQL-like operations.

---

## 🎯 Design Principles

1. **Minimal User Input** - Maximum automation, minimum manual data entry
2. **Auto-Population** - Most fields fill automatically via formulas and scripts
3. **Dialog-Driven** - Primary interactions through user-friendly dialogs, not direct sheet editing
4. **Protected Sheets** - Users rarely touch sheets directly; scripts handle the work
5. **Simple Reference Lists** - Small, manageable reference sheets
6. **Visual Feedback** - Color coding and status indicators for clarity

---

## 👤 User Interaction Model

**What Users Do:**
- ✅ Manage assignments via "Manage Assignments" dialog (assign instructors to grade/section/subject)
- ✅ Manage advisory classes via "Manage Advisory Classes" dialog (assign instructors to advisory classes)
- ✅ Fill out OGS template generation dialog (select grade, section, instructor)
- ✅ Click "Generate Template" button
- ✅ View MASTER_DATA for generated templates
- ✅ Update reference lists (Subjects, Instructors) occasionally

**What Users DON'T Do:**
- ❌ Manually enter data in MASTER_DATA, ASSIGNMENTS, or ADVISORY sheets
- ❌ Write formulas
- ❌ Track template URLs
- ❌ Update timestamps
- ❌ Select subjects manually (auto-detected from assignments)

**Scripts Handle Everything:**
- Auto-detect subjects from assignments
- Generate template files with one sheet per subject
- Auto-fill all template data
- Track who created each template
- Link template URLs automatically

---

## 🎨 System Overview

### **Sheet Count: 8 sheets**

| # | Sheet Name              | User Editable? | Purpose                                    |
|---|-------------------------|----------------|--------------------------------------------|
| 1 | MASTER_DATA             | ❌ Protected   | Auto-managed OGS template generation records |
| 2 | ASSIGNMENTS             | ❌ Protected   | Instructor-grade-section-subject assignments |
| 3 | ADVISORY                | ❌ Protected   | Instructor advisory class assignments       |
| 4 | SUBJECTS_REFERENCE      | ✅ Yes         | Simple subject list                        |
| 5 | INSTRUCTORS_REFERENCE   | ✅ Yes         | Instructor list with email                 |
| 6 | SECTIONS_REFERENCE      | ✅ Yes         | Grade levels & sections                    |
| 7 | GRADING_REFERENCE ⭐    | ✅ Yes         | Dynamic grading rules                      |
| 8 | ATTENDANCE_MONTHLY_DAYS | ✅ Yes         | Number of school days per month per school year |

### **🔑 Key Dynamicness Features**

1. **Dynamic Grading Weights**
   - Fixed components: Written Work, Performance Task, Assessment
   - Different subjects can have different weight distributions
   - Override DEFAULT with subject-specific rules (e.g., PE 20-60-20, Math 30-40-30)
   - Changes apply immediately to new templates
   - Simple subject name matching (no complex hierarchies)

2. **Flexible Reference Lists**
   - Add subjects anytime (just type + ✓)
   - Add instructors anytime (just type + ✓)
   - Add sections anytime (just type grade + section name)
   - Inactive items hidden but preserved for history

3. **Assignment-Based System**
   - Instructors are assigned to grade/section/subject combinations
   - OGS template generation uses assignments to auto-detect subjects
   - No need to manually select subjects - system knows which subjects each instructor teaches
   - One template file contains multiple sheets (one per subject)
   - Assignments managed via dedicated dialog

4. **Zero Manual Data Entry**
   - Users interact via dialogs only
   - Scripts auto-fill all data
   - Scripts auto-generate templates
   - Scripts auto-link files
   - Subjects auto-detected from assignments

5. **Historical Tracking**
   - Never delete data, just archive (inactive assignments)
   - All template generation logged in MASTER_DATA
   - Complete audit trail with user tracking
   - View all generated templates in one place

6. **Simple & User-Friendly**
   - School year entered by user in dialog
   - No complex configuration needed
   - Grading weights in GRADING_REFERENCE sheet
   - Assignment-based workflow reduces errors

---

## 📊 Sheet Structure

### **Sheet 1: MASTER_DATA** (Template Generation Records)

**Purpose:** Records all OGS templates that have been generated. This sheet only contains data for templates that have actually been created.

**🔒 PROTECTED SHEET - Scripts manage this automatically. Users should NOT edit directly.**

**Sheet Structure:**

```
Row 1 (Column Headers):
School Year | Grade Level | Section | Instructor | Template Link | Created | Modified | Created By
```

**Column Details:**

| Column | Field Name         | Filled By    | Description                                   | Example                  |
|--------|--------------------|--------------|-----------------------------------------------|--------------------------|
| A      | School Year        | 💬 Dialog    | User enters in dialog                         | 2024-2025                |
| B      | Grade Level        | 💬 Dialog    | User selects in dialog                        | Grade 1                  |
| C      | Section            | 💬 Dialog    | User selects in dialog (A, B, C, etc.)        | A                        |
| D      | Instructor         | 💬 Dialog    | User selects instructor (from assignments)     | Rojo, R.                 |
| E      | Template Link      | 🤖 Auto      | Auto-filled when template is generated        | [Open Template]          |
| F      | Created            | 🤖 Auto      | Auto-timestamp when created                   | 2025-05-03 10:30         |
| G      | Modified           | 🤖 Auto      | Auto-timestamp when modified                  | 2025-05-03 14:15         |
| H      | Created By         | 🤖 Auto      | Email of user who created the template        | admin@school.edu         |

**📄 Template Link** → Clickable hyperlink to open template directly

**Sample Data (Visual Representation):**

```
┌────────────────┬─────────────┬─────────┬───────────────┬─────────────────┬──────────────────┬──────────────────┬──────────────────┐
│ School Year    │ Grade Level │ Section │ Instructor    │ Template Link   │ Created          │ Modified         │ Created By       │
├────────────────┼─────────────┼─────────┼───────────────┼─────────────────┼──────────────────┼──────────────────┼──────────────────┤
│ 2024-2025      │ Grade 1     │ A       │ Rojo, R.      │ [Open Template] │ 2025-05-03 10:30 │ 2025-05-03 10:30 │ admin@school.edu │
│ 2024-2025      │ Grade 1     │ B       │ Santos, J.    │ [Open Template] │ 2025-05-03 11:20 │ 2025-05-03 11:20 │ admin@school.edu │
│ 2024-2025      │ Grade 2     │ A       │ Cruz, Maria A.│ [Open Template] │ 2025-05-03 12:00 │ 2025-05-03 12:00 │ admin@school.edu │
└────────────────┴─────────────┴─────────┴───────────────┴─────────────────┴──────────────────┴──────────────────┴──────────────────┘
```

**Key Features:**
- ✅ Only contains records for templates that have been generated
- ✅ One row per template file (each file contains multiple subject sheets)
- ✅ Template file contains all subjects for the instructor in that grade/section
- ✅ One-click access to templates via hyperlinks
- ✅ Sheet is protected - prevents accidental edits
- ✅ Complete audit trail with user tracking
- ✅ No separate history sheet needed - everything in one place!

---

### **Sheet 2: ASSIGNMENTS** (Instructor Assignments)

**Purpose:** Stores which instructors are assigned to which subjects for each grade level and section combination. This is the master assignment list that drives the OGS template generation.

**🔒 PROTECTED SHEET - Scripts manage this automatically. Users manage via "Manage Assignments" dialog.**

**Sheet Structure:**

```
Row 1 (Column Headers):
Grade Level | Section | Instructor | Subject | Status | Created | Modified | Created By
```

**Column Details:**

| Column | Field Name    | Filled By    | Description                                   | Example                  |
|--------|---------------|--------------|-----------------------------------------------|--------------------------|
| A      | Grade Level   | 💬 Dialog    | Grade level for the assignment                | Grade 1                  |
| B      | Section       | 💬 Dialog    | Section letter (A, B, C, etc.)                | A                        |
| C      | Instructor    | 💬 Dialog    | Full name of assigned instructor              | Rojo, R.                 |
| D      | Subject       | 💬 Dialog    | Subject name                                  | English 1                |
| E      | Status        | 🤖 Auto      | "Active" for active assignments, "Inactive" for inactive | Active                  |
| F      | Created       | 🤖 Auto      | Auto-timestamp when assignment was created    | 2025-05-03 10:30         |
| G      | Modified      | 🤖 Auto      | Auto-timestamp when assignment was modified   | 2025-05-03 14:15         |
| H      | Created By    | 🤖 Auto      | Email of user who created the assignment      | admin@school.edu         |

**Sample Data (Visual Representation):**

```
┌─────────────┬─────────┬───────────────┬───────────────┬──────────┬──────────────────┬──────────────────┬──────────────────┐
│ Grade Level │ Section │ Instructor    │ Subject       │ Status   │ Created          │ Modified         │ Created By       │
├─────────────┼─────────┼───────────────┼───────────────┼──────────┼──────────────────┼──────────────────┼──────────────────┤
│ Grade 1     │ A       │ Rojo, R.      │ English 1     │ Active   │ 2025-05-03 10:30 │ 2025-05-03 10:30 │ admin@school.edu │
│ Grade 1     │ A       │ Rojo, R.      │ Mathematics 1 │ Active   │ 2025-05-03 10:30 │ 2025-05-03 10:30 │ admin@school.edu │
│ Grade 1     │ A       │ Rojo, R.      │ Science 1     │ Active   │ 2025-05-03 10:30 │ 2025-05-03 10:30 │ admin@school.edu │
│ Grade 1     │ A       │ Cruz, Maria A.│ Filipino 1    │ Active   │ 2025-05-03 11:00 │ 2025-05-03 11:00 │ admin@school.edu │
│ Grade 1     │ B       │ Santos, J.    │ English 1     │ Active   │ 2025-05-03 11:15 │ 2025-05-03 11:15 │ admin@school.edu │
│ Grade 1     │ B       │ Santos, J.    │ Mathematics 1 │ Active   │ 2025-05-03 11:15 │ 2025-05-03 11:15 │ admin@school.edu │
└─────────────┴─────────┴───────────────┴───────────────┴──────────┴──────────────────┴──────────────────┴──────────────────┘
```

**Key Features:**
- ✅ Managed via "Manage Assignments" dialog (Actions menu)
- ✅ One row per instructor-subject-grade-section combination
- ✅ Active assignments (Status = "Active") are used for template generation
- ✅ Inactive assignments (Status = "Inactive") are preserved for history
- ✅ OGS template dialog only shows instructors with active assignments
- ✅ Subjects are auto-detected from assignments when generating templates
- ✅ Sheet is auto-created when first assignment is added
- ✅ Complete audit trail with creation/modification dates and user tracking
- ✅ Modified date updates when assignment is reactivated or deleted

**Workflow:**
1. Admin uses "Manage Assignments" dialog to assign instructors
2. When generating OGS template, user selects Grade Level → Section
3. System shows only instructors with active assignments for that grade/section
4. User selects instructor
5. System auto-detects all subjects assigned to that instructor for that grade/section
6. Template is generated with one sheet per subject

---

### **Sheet 3: ADVISORY** (Advisory Class Assignments)

**Purpose:** Stores which instructors are assigned as advisors to which grade level and section combinations. This tracks advisory class assignments separately from subject teaching assignments. Uses status (Active/Inactive) to manage changes over time.

**🔒 PROTECTED SHEET - Scripts manage this automatically. Users manage via "Manage Advisory Classes" dialog.**

**Sheet Structure:**

```
Row 1 (Column Headers):
Instructor | Grade Level | Section | Status | Created | Modified | Created By
```

**Column Details:**

| Column | Field Name    | Filled By    | Description                                   | Example                  |
|--------|---------------|--------------|-----------------------------------------------|--------------------------|
| A      | Instructor    | 💬 Dialog    | Full name of assigned instructor              | Rojo, R.                 |
| B      | Grade Level   | 💬 Dialog    | Grade level for the advisory class           | Grade 1                  |
| C      | Section       | 💬 Dialog    | Section letter (A, B, C, etc.)                | A                        |
| D      | Status        | 🤖 Auto      | "Active" for active assignments, "Inactive" for inactive | Active                  |
| E      | Created       | 🤖 Auto      | Auto-timestamp when advisory was created      | 2025-05-03 10:30         |
| F      | Modified      | 🤖 Auto      | Auto-timestamp when advisory was modified     | 2025-05-03 14:15         |
| G      | Created By    | 🤖 Auto      | Email of user who created the advisory        | admin@school.edu         |

**Sample Data (Visual Representation):**

```
┌───────────────┬─────────────┬─────────┬──────────┬──────────────────┬──────────────────┬──────────────────┐
│ Instructor    │ Grade Level │ Section │ Status   │ Created          │ Modified         │ Created By       │
├───────────────┼─────────────┼─────────┼──────────┼──────────────────┼──────────────────┼──────────────────┤
│ Rojo, R.      │ Grade 1     │ A       │ Active   │ 2025-05-03 10:30 │ 2025-05-03 10:30 │ admin@school.edu │
│ Cruz, Maria A.│ Grade 1     │ B       │ Active   │ 2025-05-03 11:00 │ 2025-05-03 11:00 │ admin@school.edu │
│ Santos, J.     │ Grade 2     │ A       │ Active   │ 2025-05-03 11:15 │ 2025-05-03 11:15 │ admin@school.edu │
│ Rojo, R.      │ Grade 2     │ B       │ Inactive │ 2024-05-03 10:30 │ 2025-05-03 14:00 │ admin@school.edu │
└───────────────┴─────────────┴─────────┴──────────┴──────────────────┴──────────────────┴──────────────────┘
```

**Key Features:**
- ✅ Managed via "Manage Advisory Classes" dialog (Actions menu)
- ✅ One row per instructor-grade-section combination
- ✅ Active advisories (Status = "Active") are tracked for current assignments
- ✅ Inactive advisories (Status = "Inactive") are preserved for history
- ✅ Sheet is auto-created when first advisory is added
- ✅ Complete audit trail with creation/modification dates and user tracking
- ✅ Modified date updates when advisory is reactivated or deleted
- ✅ Separate from subject teaching assignments (ASSIGNMENTS sheet)
- ✅ Simplified structure - no school year field, relies on status for management

**One-to-One Rules:**
- ✅ **One class = one active advisor**: Each class (grade + section) can only have one active advisor at a time
- ✅ **One instructor = one active advisory**: Each instructor can only have one active advisory at a time
- ✅ When reassigning an instructor to a different class, their previous advisory becomes Inactive
- ✅ When assigning a new instructor to a class that already has an active advisor, the operation is blocked

**Workflow:**
1. Admin uses "Manage Advisory Classes" dialog to assign instructors as advisors
2. Select instructor, grade level, and section
3. System tracks which instructor is the advisor for each class
4. Advisories can be filtered by instructor
5. Bulk delete available for managing multiple advisories at once
6. Status (Active/Inactive) manages changes over time without needing school year tracking

**Difference from ASSIGNMENTS:**
- **ASSIGNMENTS**: Tracks which instructors teach which subjects (for OGS template generation)
- **ADVISORY**: Tracks which instructors are advisors for which classes (for class management)

---

### **Sheet 4: SUBJECTS_REFERENCE** (Reference Sheet)

**Purpose:** Simple list of all subjects. Admin updates this occasionally.

**👥 USER-EDITABLE - Admins can add/edit subjects here**

**Sheet Structure with Parent Headers:**

```
Row 1 (Parent Header):
┌─────────────────────────────────────────┐
│         SUBJECT INFORMATION             │
└─────────────────────────────────────────┘
              Col A-B

Row 2 (Column Headers):
Subject Name | Active
```

**Column Details:**

| Column | Field Name    | Parent Header         | Description                    | Example         |
|--------|---------------|-----------------------|--------------------------------|-----------------|
| A      | Subject Name  | Subject Information   | Full subject name              | English 1       |
| B      | Active        | Subject Information   | ✓ or blank (hide if inactive)  | ✓               |

**Sample Data:**

```
Row 1: SUBJECT INFORMATION (merged across A-B)
Row 2: Subject Name      | Active
Row 3: English 1         | ✓
Row 4: Mathematics 1     | ✓
Row 5: Filipino 7        | ✓
Row 6: Science 1         | ✓
Row 7: Physical Ed 1     | ✓
Row 8: Chemistry 1       | ✓
Row 9: Old Subject       |     ← Inactive, won't show in dialog
```

**Key Features:**
- ✅ Ultra-minimal - just 2 columns
- ✅ Easy to add new subjects (just type name + check mark)
- ✅ Inactive subjects remain for historical reference
- ✅ Dialog only shows active subjects (✓ in column B)
- ✅ No unnecessary metadata

**Usage:**
- Scripts read column A for dropdown list in dialog
- Only rows where column B = "✓" appear in dialog

---

### **Sheet 5: INSTRUCTORS_REFERENCE** (Reference Sheet)

**Purpose:** List of instructors with contact information. Admin updates when new teachers join or leave.

**👥 USER-EDITABLE - Admins can add/edit instructors here**

**Sheet Structure with Parent Headers:**

```
Row 1 (Parent Header):
┌─────────────────────────────────────────────────────────────┐
│              INSTRUCTOR INFORMATION                         │
└─────────────────────────────────────────────────────────────┘
                     Col A-C

Row 2 (Column Headers):
Full Name | Email | Active
```

**Column Details:**

| Column | Field Name    | Parent Header           | Description                      | Example              |
|--------|---------------|-------------------------|----------------------------------|----------------------|
| A      | Full Name     | Instructor Information  | Full name of instructor          | Rojo, R.             |
| B      | Email         | Instructor Information  | Official email address           | rojo@school.edu      |
| C      | Active        | Instructor Information  | ✓ or blank (hide if inactive)    | ✓                    |

**Sample Data:**

```
Row 1: INSTRUCTOR INFORMATION (merged across A-C)
Row 2: Full Name        | Email                | Active
Row 3: Rojo, R.         | rojo@school.edu      | ✓
Row 4: Cruz, Maria A.   | mcruz@school.edu     | ✓
Row 5: Santos, John P.  | jsantos@school.edu   | ✓
Row 6: Garcia, Ana M.   | agarcia@school.edu   |     ← On leave, inactive
Row 7: Reyes, Pedro S.  | preyes@school.edu    | ✓
Row 8: Lopez, Carmen D. | clopez@school.edu    | ✓
```

**Key Features:**
- ✅ Simple - just 3 columns (name, email, active)
- ✅ Easy to add new instructors
- ✅ Email captured for communication/notifications
- ✅ Inactive instructors stay for historical reference
- ✅ Dialog only shows active instructors (✓ in column C)

**Usage:**
- Scripts read column A for dropdown list in dialog
- Email (column B) can be used for auto-notifications
- Only rows where column C = "✓" appear in dialog

---

### **Sheet 6: SECTIONS_REFERENCE** (Reference Sheet)

**Purpose:** List of sections for each grade level. Update at start of each academic year.

**👥 USER-EDITABLE - Admins update at start of school year**

**Sheet Structure with Parent Headers:**

```
Row 1 (Parent Header):
┌─────────────────────────────────────────┐
│         SECTION INFORMATION             │
└─────────────────────────────────────────┘
              Col A-C

Row 2 (Column Headers):
Grade Level | Section | Level
```

**Column Details:**

| Column | Field Name    | Parent Header        | Description                    | Example        |
|--------|---------------|----------------------|--------------------------------|----------------|
| A      | Grade Level   | Section Information  | Grade level                    | Grade 1        |
| B      | Section       | Section Information  | Section letter (A, B, C, etc.) | A              |
| C      | Level         | Section Information  | School level (Elementary/JHS/SHS) | Elementary   |

**Sample Data:**

```
Row 1: SECTION INFORMATION (merged across A-C)
Row 2: Grade Level | Section | Level
Row 3: Grade 1     | A       | Elementary
Row 4: Grade 1     | B       | Elementary
Row 5: Grade 1     | C       | Elementary
Row 6: Grade 7     | A       | JHS
Row 7: Grade 7     | B       | JHS
Row 8: Grade 7     | C       | JHS
Row 9: Grade 11    | A       | SHS
Row 10: Grade 11   | B       | SHS
Row 11: Grade 11   | C       | SHS
Row 12: Grade 12   | A       | SHS
```

**Key Features:**
- ✅ Simple - just 3 columns (Grade Level, Section, Level)
- ✅ Easy to add sections for new school year
- ✅ Sections are just letters (A, B, C, etc.) for simplicity
- ✅ Level tagging (Elementary, JHS, SHS) used for template file naming
- ✅ No need for school year tracking here (handled in MASTER_DATA)
- ✅ Scripts use this for cascading dropdown (select grade → show sections)
- ✅ Grade levels appear in dropdown in the same order as in the sheet (not alphabetically sorted)

**Usage:**
- Dialog reads this for section dropdown
- Sections filtered by grade level selected by user
- Grade levels display in the order they appear in the sheet
- No complicated metadata needed

---

### **Sheet 7: GRADING_REFERENCE** (Dynamic Grading Configuration) ⭐

**Purpose:** Define grading computation weights dynamically. Supports different grading schemes per subject.

**👥 USER-EDITABLE - Admins configure grading weights here**

**🎯 KEY DYNAMICNESS FEATURE:**
- Define DEFAULT weights for all subjects
- Override with SPECIFIC weights per subject
- Scripts automatically apply the most specific match
- **Fixed Components:** Written Work, Performance Task, Assessment

**Sheet Structure with Parent Headers:**

```
Row 1 (Parent Headers):
┌──────────────┬────────────────────────────────────────────────────────────┬────────┐
│ SUBJECT NAME │                  GRADING COMPONENTS (%)                    │ STATUS │
└──────────────┴────────────────────────────────────────────────────────────┴────────┘
     Col A                           Col B-D                                 Col E

Row 2 (Column Headers):
Subject Name | Written Work | Performance Task | Assessment | Active
```

**Column Details:**

| Column | Field Name       | Parent Header        | Description                                      | Example           |
|--------|------------------|----------------------|--------------------------------------------------|-------------------|
| A      | Subject Name     | Subject Name         | "DEFAULT" or specific subject name               | DEFAULT           |
| B      | Written Work     | Grading Components   | Percentage weight for Written Work               | 30                |
| C      | Performance Task | Grading Components   | Percentage weight for Performance Task           | 50                |
| D      | Assessment       | Grading Components   | Percentage weight for Assessment                 | 20                |
| E      | Active           | Status               | ✓ or blank                                       | ✓                 |

**Sample Data (Dynamic Configuration):**

```
Row 1: SUBJECT NAME | GRADING COMPONENTS (%) (merged B-D) | STATUS
Row 2: Subject Name     | Written Work | Performance Task | Assessment | Active
Row 3: DEFAULT          | 30           | 50               | 20         | ✓
Row 4: Physical Ed 1    | 20           | 60               | 20         | ✓
Row 5: Mathematics 1    | 30           | 40               | 30         | ✓
Row 6: English 1        | 35           | 45               | 20         | ✓
```

**Note:** All weights should add up to 100%

**🔄 How Dynamic Matching Works:**

When generating template for "Mathematics 1":
1. Script checks: Is there a row for "Mathematics 1"? → **YES, use 30-40-30!**
2. If not found, use: **DEFAULT** row (30-50-20)

When generating template for "English 1":
1. Script checks: Is there a row for "English 1"? → **YES, use 35-45-20!**
2. If not found, use: **DEFAULT** row (30-50-20)

When generating template for "Filipino 7":
1. Script checks: Is there a row for "Filipino 7"? → No match found
2. Use: **DEFAULT** row (30-50-20)

**Priority Order (Most specific to least):**
```
1. Exact Subject Match (e.g., "Mathematics 1")
2. DEFAULT (fallback for all subjects without specific rules)
```

**Key Features:**
- ✅ **Fixed components** - Always Written Work, Performance Task, Assessment
- ✅ **Flexible weights** - Different percentages per subject
- ✅ **Easy to update** - Change percentages anytime, takes effect immediately
- ✅ **Dynamic application** - Scripts auto-select correct weights for each subject
- ✅ **Simplified structure** - Only 5 columns, subject-based matching
- ✅ **Historical tracking** - Inactive rows preserved
- ✅ **Always valid** - Must have DEFAULT row as fallback

**Usage:**
- Scripts read this when generating OGS templates
- Automatically applies correct weights to the 3 fixed components
- Template columns are always consistent: WW, PT, Assessment

**Example Generated Template Columns:**

For "Mathematics 1" (30-40-30):
```
Student | Last Name | First Name | Written Work (30%) | Performance Task (40%) | Assessment (30%) | Final Grade | Remarks
```

For "Physical Ed 1" (20-60-20):
```
Student | Last Name | First Name | Written Work (20%) | Performance Task (60%) | Assessment (20%) | Final Grade | Remarks
```

For any other subject using DEFAULT (30-50-20):
```
Student | Last Name | First Name | Written Work (30%) | Performance Task (50%) | Assessment (20%) | Final Grade | Remarks
```

**💡 Pro Tip:** All weights must add up to 100%. Add rows for any subject or grade level that needs different weight distribution.

---

### **Sheet 8: ATTENDANCE_MONTHLY_DAYS** (Reference Sheet)

**Purpose:** Defines the total number of school days for each month per school year. Used as the base for calculating attendance percentages in OGS templates.

**👥 USER-EDITABLE - Admins configure monthly school days here**

**Sheet Structure with Parent Headers:**

```
Row 1 (Parent Header):
┌─────────────────────────────────────────────────────────────┐
│                  MONTHLY SCHOOL DAYS INFORMATION            │
└─────────────────────────────────────────────────────────────┘
                          Col A-C

Row 2 (Column Headers):
School Year | Month | Number of School Days
```

**Column Details:**

| Column | Field Name         | Parent Header         | Description                                    | Example                  |
|--------|-------------------|-----------------------|------------------------------------------------|--------------------------|
| A      | School Year       | Monthly School Days   | School year this applies to                    | 2024-2025                |
| B      | Month             | Monthly School Days   | Month name (full or abbreviated)              | June                     |
| C      | Number of School Days | Monthly School Days | Total school days for this month              | 22                       |

**Sample Data:**

```
Row 1: MONTHLY SCHOOL DAYS INFORMATION (merged across A-C)
Row 2: School Year | Month  | Number of School Days
Row 3: 2024-2025   | June    | 22
Row 4: 2024-2025   | July    | 23
Row 5: 2024-2025   | August  | 21
Row 6: 2024-2025   | September | 20
Row 5: 2024-2025   | October | 22
Row 6: 2024-2025   | November | 19
Row 7: 2024-2025   | December | 15
Row 8: 2024-2025   | January | 22
Row 9: 2024-2025   | February | 20
Row 10: 2024-2025  | March   | 22
```

**Key Features:**
- ✅ Defines total school days per month per school year
- ✅ Used as denominator for attendance percentage calculations
- ✅ School year-specific configuration
- ✅ Accounts for varying month lengths and school calendar

**Usage:**
- Scripts read this when generating OGS templates to populate the "School DAYS" column in the Attendance sheet
- The Attendance sheet is automatically added to OGS templates when the instructor is an advisor for the class
- School DAYS values are pre-filled from this sheet for each month
- Days PRESENT and Days ABSENT are entered manually by the instructor

**💡 Pro Tip:** 
- Include all months in the school year (typically June to March)
- Number of school days should exclude weekends and holidays
- These values are automatically populated in the Attendance sheet's "School DAYS" columns

---

## 🔧 Setup Instructions (Simplified)

### **Step 1: Create the Spreadsheet**
1. Create a new Google Spreadsheet
2. Name it: "Template Masterfile - 2024-2025"
3. Create **6 reference sheets** with these exact names (MASTER_DATA, ASSIGNMENTS, and ADVISORY are auto-created by scripts):
   - SUBJECTS_REFERENCE
   - INSTRUCTORS_REFERENCE
   - SECTIONS_REFERENCE
   - GRADING_REFERENCE
   - ATTENDANCE_MONTHLY_DAYS

### **Step 2: Set Up Headers**

**For MASTER_DATA, ASSIGNMENTS, and ADVISORY sheets:**
- These sheets are **auto-created by scripts** with column headers only (no parent headers)
- **Row 1:** Column Headers only
- Format: Bold, background color (#d9d9d9), centered
- Data starts at **Row 2**
- ADVISORY sheet columns: Instructor | Grade Level | Section | Status | Created | Modified | Created By

**For reference sheets (SUBJECTS_REFERENCE, INSTRUCTORS_REFERENCE, SECTIONS_REFERENCE, GRADING_REFERENCE, ATTENDANCE_MONTHLY_DAYS), create TWO header rows:**

**Row 1:** Parent Headers (merged cells across related columns)
- Format: Bold, larger font (12-14pt), centered, background color (#f3f3f3)
- Merge cells across the columns they represent (see diagrams above)

**Row 2:** Column Headers  
- Format: Bold, background color (#d9d9d9), centered
- These are the actual field names

**Example for SUBJECTS_REFERENCE:**
```
Row 1: Merge cells A1:B1, type "SUBJECT INFORMATION"
Row 2: Cell A2 = "Subject Name", Cell B2 = "Active"
```

**Example for GRADING_REFERENCE:**
```
Row 1: 
  - Merge A1 = "SUBJECT NAME"
  - Merge B1:D1 = "GRADING COMPONENTS (%)"
  - Merge E1 = "STATUS"
Row 2: Subject Name | Written Work | Performance Task | Assessment | Active
```

### **Step 3: Add Initial Data**

**⚠️ Important Note: Data starts at Row 3 for reference sheets**  
Since reference sheets have 2 header rows (Row 1 = Parent Headers, Row 2 = Column Headers), all actual data starts at **Row 3**.

**For MASTER_DATA and ASSIGNMENTS:**
- Data starts at **Row 2** (only one header row)

**GRADING_REFERENCE Sheet:**
Add at least the DEFAULT row starting at Row 3:
```
Row 1: SUBJECT NAME | GRADING COMPONENTS (%) (merged B1:D1) | STATUS
Row 2: Subject Name | Written Work | Performance Task | Assessment | Active
Row 3: DEFAULT      | 30           | 50               | 20         | ✓
```

**SUBJECTS_REFERENCE, INSTRUCTORS_REFERENCE, SECTIONS_REFERENCE:**
Add your initial data starting at Row 3 (names, emails for instructors, and ✓ marks).

### **Step 4: Protect Sheets**
Protect these sheets (so users don't accidentally edit them):
- MASTER_DATA (scripts manage this)

Leave these **UNPROTECTED** (users need to edit):
- SUBJECTS_REFERENCE
- INSTRUCTORS_REFERENCE
- SECTIONS_REFERENCE
- GRADING_REFERENCE
- ATTENDANCE_MONTHLY_DAYS

### **Step 5: Set Up Conditional Formatting (Optional but Recommended)**

**For MASTER_DATA (entire rows):**
- Select entire data range (A2:H1000)
- Format → Conditional formatting
- Custom formula: `=$G2="Active"` → Green background (#d9ead3)
- Add another rule: `=$G2="Archived"` → Gray background (#efefef)

This visually highlights active vs archived assignments.

**Note:** Since MASTER_DATA no longer has a Status column, you may want to remove or update this conditional formatting.

### **Step 6: Install the Apps Script Code**
Copy the Apps Script code (Code.js) and attach it to this spreadsheet via Extensions → Apps Script.

**That's it!** The system is ready to use.

---

## 💡 Usage Examples (User-Friendly Workflow)

### **Example 1: Creating a New Assignment (Primary Workflow)**

**User clicks menu: Actions → Create New Assignment**

Dialog appears:
```
┌─────────────────────────────────────────┐
│ Create New Assignment                   │
├─────────────────────────────────────────┤
│ School Year:  [Input: 2024-2025]       │
│ Grade Level:  [Dropdown: Grade 1▼]     │
│ Section:      [Dropdown: A▼]           │
│ Subject:      [Dropdown: English 1▼]    │
│ Instructor:   [Dropdown: Rojo, R.▼]    │
│                                         │
│  [Generate Template] [Cancel]          │
└─────────────────────────────────────────┘
```

User:
1. Enters School Year (e.g., "2024-2025")
2. Selects Grade Level (e.g., "Grade 1")
3. Section dropdown auto-filters to show Grade 1 sections → selects "A"
4. Selects Subject (e.g., "English 1")
5. Selects Instructor (e.g., "Rojo, R.")
6. Clicks **Generate Template**

**Script automatically:**
- Gets grading weights from GRADING_REFERENCE sheet
- Gets level (Elementary/JHS/SHS) from SECTIONS_REFERENCE
- Creates new row in MASTER_DATA with all data
- Generates OGS template file with correct grading columns
- Creates new Google Sheet file in same Drive folder with format: `OGS_GRADE1_A_2024-2025 - OFFICIAL GRADING SHEETS  - ELEMENTARY`
- Adds template link to MASTER_DATA
- Sets status to "Active"
- Records who created it and when

Result: Template created, zero manual data entry, complete audit trail!

---

### **Example 2: Adding a New Subject**

**Admin goes to SUBJECTS_REFERENCE sheet:**
1. Click next empty row
2. Type subject name: "Calculus 1"
3. Put ✓ in Active column
4. Done!

Next time user opens "Create New Assignment" dialog, "Calculus 1" appears in dropdown.

---

### **Example 3: Adding a New Instructor**

**Admin goes to INSTRUCTORS_REFERENCE sheet:**
1. Click next empty row
2. Type instructor name: "Dela Cruz, Pedro M."
3. Type email: "pdelacruz@school.edu"
4. Put ✓ in Active column
5. Done!

Next time user opens "Create New Assignment" dialog, new instructor appears in dropdown.

---

### **Example 4: Changing Instructor Mid-Year**

**User clicks menu: Actions → Change Instructor**

Dialog appears:
```
┌─────────────────────────────────────────┐
│ Change Instructor                       │
├─────────────────────────────────────────┤
│ Find Assignment:                        │
│ Grade Level:  [Dropdown: Grade 1▼]     │
│ Section:      [Dropdown: A▼]           │
│ Subject:      [Dropdown: English 1▼]    │
│                                         │
│ Current: Rojo, R.                       │
│                                         │
│ New Instructor: [Dropdown: Santos, J.▼]│
│                                         │
│  [Change Instructor] [Cancel]          │
└─────────────────────────────────────────┘
```

**Script automatically:**
- Finds the active assignment
- Archives old assignment (Status → "Archived")
- Creates new assignment with new instructor
- Links to same template OR generates new one (configurable)
- Updates Modified timestamp and preserves original creator

---

### **Example 5: Setting Up Custom Grading for PE**

**Admin goes to GRADING_REFERENCE sheet:**
1. Click next empty row
2. Fill in:
   ```
   Subject Name: Physical Ed 1
   Written Work: 20
   Performance Task: 60
   Assessment: 20
   Active: ✓
   ```
3. Done!

Next time template is generated for "Physical Ed 1", it will use these custom weights (20-60-20) instead of DEFAULT (30-50-20).

---

### **Example 6: Viewing All Templates**

**User opens MASTER_DATA sheet:**

See all assignments:
- Filter by School Year, Grade Level, Section, Subject, or Instructor
- Sort by any column
- Click Template Link to open template directly
- View Created By and timestamps for audit trail

Use Google Sheets built-in filters (Data → Create a filter) for easy searching and filtering.

---

### **Example 7: Preparing for New Academic Year**

**Admin:**
1. When creating new assignments, users simply enter the new school year in the dialog
2. Example: "2025-2026"
3. Done!

Each assignment can have its own school year, making it flexible and simple.

Old assignments remain visible in MASTER_DATA (Status = "Archived" or still "Active" for reference).

---

## 🚀 Efficiency & Dynamicness Features

### **1. Dynamic Grading Component Resolution**

The system automatically selects the correct grading scheme:

```javascript
// Example: Get grading weights for a subject
function getGradingWeights(subjectName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName('GRADING_REFERENCE');
  const data = sheet.getDataRange().getValues();
  
  // Skip both header rows (indices 0 and 1)
  const dataRows = data.slice(2);
  
  // Priority 1: Exact subject match
  let match = dataRows.find(row => 
    row[0] === subjectName && row[4] === '✓'  // Column E (Active)
  );
  
  // Priority 2: DEFAULT (fallback)
  if (!match) {
    match = dataRows.find(row => 
      row[0] === 'DEFAULT' && row[4] === '✓'
    );
  }
  
  return {
    writtenWork: match[1],      // Column B
    performanceTask: match[2],  // Column C
    assessment: match[3]        // Column D
  };
}

// Usage example:
// const weights = getGradingWeights('Mathematics 1');
// Result: { writtenWork: 30, performanceTask: 40, assessment: 30 }
```

**Why This is Powerful:**
- ✅ Add new grading rule → affects all future templates
- ✅ Update weight percentages → new templates use new weights
- ✅ No code changes needed
- ✅ Instantly flexible

---

### **2. Helper Functions for Code.js**

**⚠️ Important:** Since all sheets have 2 header rows (parent + column headers), data starts at **Row 3** (index 2 in arrays).

```javascript
// Get active items from any reference sheet
function getActiveItems(sheetName, columnIndex = 0) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName(sheetName);
  const data = sheet.getDataRange().getValues();
  
  return data
    .filter((row, index) => 
      index >= 2 &&  // Skip TWO header rows (parent + column headers)
      row[row.length - 1] === '✓'  // Last column is Active
    )
    .map(row => row[columnIndex]);
}

// Usage examples:
// getActiveItems('SUBJECTS_REFERENCE')     → ['English 1', 'Math 1', ...]
// getActiveItems('INSTRUCTORS_REFERENCE') → ['Rojo, R.', 'Cruz, M.', ...]

// Get sections for specific grade level
function getSectionsForGrade(gradeLevel) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName('SECTIONS_REFERENCE');
  const data = sheet.getDataRange().getValues();
  
  return data
    .filter((row, index) => index >= 2 && row[0] === gradeLevel)  // Skip 2 header rows
    .map(row => row[1]);
}

// All actions are automatically logged in MASTER_DATA
// with Created By, Created, and Modified timestamps
```

---

### **3. Minimal User Modification Philosophy**

**What Users Edit:**
- Reference lists (2-3 columns each, just add rows)
- Grading components (copy existing row, modify values)

**What Users Never Touch:**
- MASTER_DATA (protected, script-managed with full audit trail)

**Result:**
- 🎯 Less training needed
- 🎯 Fewer errors
- 🎯 Faster operations
- 🎯 More confidence

---

## 🔄 System Workflow Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                    USER INTERACTION FLOW                             │
└──────────────────────────────────────────────────────────────────────┘

1. USER ACTION: Clicks "Actions" → "Create New Assignment"
                          │
                          ▼
2. DIALOG APPEARS:  ┌─────────────────────┐
                    │  Enter School Year  │ ← User types (e.g., A.Y. 2024-2025)
                    │  Select Grade Level │ ← Reads from SECTIONS_REFERENCE
                    │  Select Section     │ ← Filtered by Grade Level
                    │  Select Subject     │ ← Reads from SUBJECTS_REFERENCE (Active=✓)
                    │  Select Instructor  │ ← Reads from INSTRUCTORS_REFERENCE (Active=✓)
                    └─────────────────────┘
                          │
                          ▼
3. SCRIPT RUNS:     Get Grading Weights ← GRADING_REFERENCE (Subject → DEFAULT)
                          │
                          ▼
4. TEMPLATE CREATED: ┌──────────────────────────────────────┐
                     │  OGS Template Generated              │
                     │  - Student info columns              │
                     │  - Dynamic grading columns          │
                     │  - Formulas for final grade         │
                     └──────────────────────────────────────┘
                          │
                          ▼
5. DATA SAVED:      MASTER_DATA ← New row added (auto-filled with audit info)
                    Template Link ← Hyperlink to file
                          │
                          ▼
6. USER SEES:       Success message + link to template
                    MASTER_DATA updated automatically


┌──────────────────────────────────────────────────────────────────────┐
│                  DATA FLOW & DEPENDENCIES                            │
└──────────────────────────────────────────────────────────────────────┘

USER INPUT (Dialog Form)
  └─→ Provides: School Year, Grade Level, Section, Subject, Instructor
        ↓
SECTIONS_REFERENCE          SUBJECTS_REFERENCE       INSTRUCTORS_REFERENCE
  └─→ Grade Levels (dropdown)   └─→ Subject Names (dropdown)  └─→ Instructor Names (dropdown)
        ↓                            ↓                        ↓
        └────────────────┬───────────┴──────────┬─────────────┘
                         ▼                      ▼
                   DIALOG FORM          GRADING_REFERENCE
                         │                      │
                         │    ┌─────────────────┘
                         │    │ (Subject Name → DEFAULT)
                         ▼    ▼
                    SCRIPT EXECUTION
                         │
                         ▼
               ┌─────────┴──────────┐
               │                     │
               ▼                     ▼
         MASTER_DATA          OGS TEMPLATE FILE
      (With Audit Trail)     (Google Sheets)
               │                     │
               │                     │
               └─────────────────────┘
               (All data accessible via MASTER_DATA)


┌──────────────────────────────────────────────────────────────────────┐
│                    DYNAMICNESS IN ACTION                             │
└──────────────────────────────────────────────────────────────────────┘

SCENARIO: Admin adds new subject "Calculus 2"

Step 1: Admin → SUBJECTS_REFERENCE sheet → Add row
        ┌─────────────────┬────────┐
        │ Calculus 2      │   ✓    │
        └─────────────────┴────────┘
        
Step 2: IMMEDIATELY available in dialog dropdown
        ┌─────────────────────────┐
        │ Select Subject:         │
        │  ▼ English 1            │
        │    Math 1               │
        │    Calculus 2  ← NEW!   │
        └─────────────────────────┘

Step 3: User creates assignment for "Calculus 2"
        Script looks up grading weights:
        1. Check: "Calculus 2" in GRADING_REFERENCE? → No
        2. Use DEFAULT grading weights (30-50-20)

Step 4: Template generated with standard grading columns
        Written Work (30%) | Performance Task (50%) | Assessment (20%)
        No code changes needed!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SCENARIO: Admin changes PE grading weights

Step 1: Admin → GRADING_REFERENCE sheet
        Before: Written Work (30%) | Performance Task (50%) | Assessment (20%)
        After:  Written Work (20%) | Performance Task (60%) | Assessment (20%)

Step 2: IMMEDIATELY affects new templates
        Next PE template generated → Uses new weights automatically

Step 3: Old templates unchanged (already generated)
        Historical data preserved
```

---

## 📋 Maintenance Best Practices

### **What Admins Update Regularly**

**Start of School Year:**
1. SECTIONS_REFERENCE → Add new sections for the year
2. When creating assignments, users simply enter the new school year in the dialog
3. Done! System ready for new year.

**When New Teachers Join:**
1. INSTRUCTORS_REFERENCE → Add new row with name + email + ✓
2. Done! They appear in dialog dropdown immediately.

**When New Subjects Added:**
1. SUBJECTS_REFERENCE → Add new row with name + ✓
2. Done! They appear in dialog dropdown immediately.

**When Grading Rules Change:**
1. GRADING_REFERENCE → Update weights or add new row
2. Done! New templates use new rules automatically.

**When Instructor Leaves/Returns:**
1. INSTRUCTORS_REFERENCE → Remove/Add ✓ in Active column
2. They disappear/appear in dialog dropdown automatically.

### **What Users Monitor**

**Check MASTER_DATA sheet:**
- View all template assignments
- Filter by School Year, Grade Level, Section, Subject, or Instructor
- See who created each template and when
- Click Template Link to open templates directly

**That's it!** No complex maintenance needed.

### **Backup Strategy (Recommended)**

- **Weekly:** File → Make a copy → Name: "Backup - YYYY-MM-DD"
- **End of Term:** Download as Excel file for offline archive
- **Google Drive:** Enable version history (automatic)

---

## 🔍 Troubleshooting

### **Dialog doesn't show new subject/instructor**
**Solution:** Make sure there's a ✓ in the Active column. Reload the spreadsheet if needed.

### **Template generates with wrong grading components**
**Solution:** Check GRADING_REFERENCE sheet. Verify:
1. Subject Name matches exactly
2. Active column has ✓
3. DEFAULT row exists as fallback

### **Can't find a template**
**Solution:** Check MASTER_DATA sheet. Use Ctrl+F to search by instructor, subject, or section. Use Data → Create a filter for advanced filtering.

### **Script execution error**
**Solution:** 
1. Check Tools → Script editor → Executions for error details
2. Ensure GRADING_REFERENCE has DEFAULT row
3. Verify all reference sheets have proper 2-row headers

---

## 📚 Related Documentation

- `Code.js` - Main Apps Script file for template generation
- `OGSTemplateDialog.html` - User interface for template creation
- `SYSTEM FLOW.txt` - Overall system workflow

---

## 🎯 Summary: Why This Structure Works

### **Minimal User Modifications**
✅ Only 5 sheets users edit (reference lists)  
✅ Just 2-3 columns per sheet  
✅ No formulas for users to manage  
✅ No complex relationships  

### **Maximum Dynamicness**
✅ Add subjects/instructors → immediate availability  
✅ Change grading rules → instant effect on new templates  
✅ No configuration files needed
✅ No code changes ever needed  

### **User-Friendly Design**
✅ Dialog-driven interface  
✅ Protected sheets prevent accidents  
✅ Visual feedback (colors, links)  
✅ Automatic logging and history  

### **Scalable & Maintainable**
✅ Works for 10 or 1000 subjects  
✅ Handles multiple academic years  
✅ Historical data preserved  
✅ Easy to train new users  

### **Key Innovation: GRADING_REFERENCE**
The star of this structure! Features:
- **Fixed Components:** Written Work, Performance Task, Assessment (consistent across all subjects)
- **Flexible Weights:** Different percentages per subject (e.g., PE 20-60-20, Math 30-40-30)
- **Dynamic Matching:** Subject-specific → DEFAULT fallback (simple 2-level priority)
- **Ultra-Simple:** Only 5 columns (Subject Name, 3 weights, Active)

**Result:** Consistent structure + Subject-specific flexibility = Maximum clarity!

---

## 📝 Change Log

| Date       | Version | Changes                                                                          | By    |
|------------|---------|----------------------------------------------------------------------------------|-------|
| 2025-11-11 | 1.8     | Added ADVISORY sheet for managing instructor advisory class assignments          | AI    |
| 2025-10-30 | 1.7     | Removed DASHBOARD sheet (users can view/filter MASTER_DATA directly)            | AI    |
| 2025-10-30 | 1.6     | Combined TEMPLATE_HISTORY into MASTER_DATA (added Created By column)             | AI    |
| 2025-10-29 | 1.5     | Removed CONFIG sheet (School Year now user input in dialog)                      | AI    |
| 2025-10-29 | 1.4     | Removed Term column (one-time grading system, not per-quarter)                   | AI    |
| 2025-10-29 | 1.3.1   | Clarified GRADING_REFERENCE: Subject Name column (subject-specific matching)     | AI    |
| 2025-10-29 | 1.3     | Simplified GRADING_REFERENCE to fixed 3 components (WW, PT, Assessment)          | AI    |
| 2025-10-29 | 1.2     | Added parent headers for all sheets (2-row header structure)                     | AI    |
| 2025-10-29 | 1.1     | Updated sheet names to include "REFERENCE", added Email to instructors           | AI    |
| 2025-10-29 | 1.0     | Initial design with dynamic grading components                                   | AI    |

---

## 📞 Support

For questions or issues with this structure:
1. Review MASTER_DATA for all assignments and recent actions (Created By, Created, Modified columns)
2. Verify reference sheets have proper data
3. Contact system administrator

---

**Last Updated:** November 11, 2025  
**Document Version:** 1.8  
**Structure Focus:** One-time grading templates + Subject-specific weights + Advisory class management + Simplified structure (7 sheets total, 5 reference sheets)

---

## 📌 Quick Reference: Sheet Names

| Sheet Name              | Columns | User Editable | Purpose                                |
|-------------------------|---------|---------------|----------------------------------------|
| MASTER_DATA             | 8       | ❌ Protected  | OGS template generation records        |
| ASSIGNMENTS             | 8       | ❌ Protected  | Instructor-grade-section-subject assignments |
| ADVISORY                | 7       | ❌ Protected  | Instructor advisory class assignments  |
| SUBJECTS_REFERENCE      | 2       | ✅ Yes        | Subject names                          |
| INSTRUCTORS_REFERENCE   | 3       | ✅ Yes        | Instructors + emails                   |
| SECTIONS_REFERENCE      | 3       | ✅ Yes        | Grade levels, sections & level tags   |
| GRADING_REFERENCE       | 5       | ✅ Yes        | Dynamic grading weights                |
| ATTENDANCE_MONTHLY_DAYS | 3       | ✅ Yes        | Monthly school days per school year   |

