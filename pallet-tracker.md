**Pallet Tracker**

Application Feature Specification

_Version 1.0 · Generated 14 May 2026_

# **1\. Purpose**

This document defines all features of the Pallet Tracker application. It serves as a complete reference for what the application currently does, so that features can be reviewed, prioritised, or removed before any rebuild or iteration is commenced.

Each feature is listed with a description and its current inclusion status. Use this document to mark which features you want to keep, modify, or discard.

# **2\. Application Architecture**

## **2.1 Platform**

- Runs entirely in the browser - no server, no database, no login required
- All data is stored in the browser's local storage (persists between sessions on the same device and browser)
- Single-page application - all functionality available on one screen
- No installation required - opens directly in a web browser

## **2.2 Data storage**

- Movement records are saved to browser local storage under the key pallet-movements
- Staff list is saved under the key pallet-staff
- The active staff selection is saved under the key pallet-active-staff
- Data does not sync across devices or browsers
- Data is lost if the user clears browser storage

# **3\. Feature Inventory**

## **3.1 Dashboard - summary metrics**

Four metric cards displayed at the top of the application, always visible and automatically updated whenever a movement is added, edited, or deleted.

| **Metric**          | **Description**                                                                                       | **Status**     |
| ------------------- | ----------------------------------------------------------------------------------------------------- | -------------- |
| **Total issued**    | Running total of all pallets issued to customers across all time                                      | **✓ Included** |
| **Total returned**  | Running total of all pallets returned by customers across all time                                    | **✓ Included** |
| **Net outstanding** | Difference between total issued and total returned (can be negative if more are returned than issued) | **✓ Included** |
| **Customer count**  | Number of unique customers who have at least one movement on record                                   | **✓ Included** |

## **3.2 Recording pallet movements**

The primary data-entry form. Used to record both outgoing (issue) and incoming (return) pallet movements.

| **Feature**             | **Description**                                                                                                                                                  | **Status**     |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| **Issue toggle**        | Switch the form between 'Issue pallets' and 'Return pallets' mode. The submit button label and colour change to reflect the selected mode.                       | **✓ Included** |
| **Customer name field** | Free-text input for the customer name. Shows an autocomplete dropdown populated from existing customer names already on record.                                  | **✓ Included** |
| **Quantity field**      | Numeric input for the number of pallets being issued or returned. Must be a positive integer.                                                                    | **✓ Included** |
| **Date field**          | Date picker for the movement date. Defaults to today's date. Can be set to a past date to record backdated movements.                                            | **✓ Included** |
| **Note field**          | Optional free-text field for additional context (e.g. a purchase order number, delivery reference, or driver name).                                              | **✓ Included** |
| **Staff requirement**   | A staff member must be selected before a movement can be recorded. If no staff member is selected, submission is blocked and the user is prompted to select one. | **✓ Included** |
| **Negative balances**   | Return quantities are not capped. A customer's balance can go negative if more pallets are returned than were issued. No warning is shown.                       | **✓ Included** |
| **Timestamp**           | The exact date and time the record was created is stored separately from the movement date, allowing backdated entries to be identified.                         | **✓ Included** |

## **3.3 Staff management**

Allows the business to maintain a list of staff members. Every movement record is attributed to the staff member who was active at the time of recording.

| **Feature**                      | **Description**                                                                                                                                                          | **Status**     |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------- |
| **Add staff**                    | Enter a name and press Add (or Enter) to add a staff member to the list. Duplicate names are rejected.                                                                   | **✓ Included** |
| **Remove staff**                 | Any staff member can be removed from the list. Existing movement records that reference a removed staff member are not affected - the name is retained on those records. | **✓ Included** |
| **Active staff selector**        | A dropdown at the top of the entry form shows the current staff member. The selection persists between sessions. All movements are stamped with this name.               | **✓ Included** |
| **Staff attribution on records** | Every movement record stores the name of the staff member who recorded it. This is shown in the movement log and included in CSV exports.                                | **✓ Included** |

## **3.4 Movement log**

A chronological table of all recorded pallet movements, with filtering and per-row actions.

| **Feature**            | **Description**                                                                                                                                                                                          | **Status**     |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| **Log table**          | Displays all movements in reverse-chronological order (most recent first). Columns: Date, Customer, Type (Issue/Return), Qty, Staff, Note.                                                               | **✓ Included** |
| **Filter by customer** | Dropdown to restrict the log to a single customer. Populated dynamically from all customers on record.                                                                                                   | **✓ Included** |
| **Filter by type**     | Dropdown to show only Issue movements or only Return movements.                                                                                                                                          | **✓ Included** |
| **Filter by staff**    | Dropdown to show only movements recorded by a specific staff member.                                                                                                                                     | **✓ Included** |
| **Edit record**        | Each row has an edit button (pencil icon) that opens an inline edit form. All fields can be changed: customer, type, quantity, date, staff, and note.                                                    | **✓ Included** |
| **Edit timestamp**     | When a record is edited, the edit date and time are stored. An edit indicator (small pencil icon) is shown on the date cell. Hovering shows both the original recorded-at time and the last edited time. | **✓ Included** |
| **Delete record**      | Each row has a delete button (trash icon). Deletion requires confirmation. Deleted records cannot be recovered.                                                                                          | **✓ Included** |
| **Hover highlight**    | Table rows highlight on hover for readability.                                                                                                                                                           | **✓ Included** |

## **3.5 Customer balances**

A summary view showing the pallet account for each customer - how many were issued, how many returned, and the current balance.

| **Feature**                | **Description**                                                                                                                        | **Status**     |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| **Customer balance table** | Displays one row per customer. Columns: Customer, Issued, Returned, Balance. Sorted by balance descending (highest outstanding first). | **✓ Included** |
| **Positive balance**       | Shown in blue. Indicates the customer has more pallets outstanding than returned.                                                      | **✓ Included** |
| **Negative balance**       | Shown in red with a minus sign. Indicates the customer has returned more pallets than were issued.                                     | **✓ Included** |
| **Zero balance**           | Shown in muted grey. Indicates the customer's account is settled.                                                                      | **✓ Included** |
| **Balance bar**            | A small horizontal bar provides a visual indication of outstanding balance relative to the customer with the largest balance.          | **✓ Included** |

## **3.6 CSV export**

Allows data to be downloaded as spreadsheet-compatible CSV files for use in Excel or other tools.

| **Feature**                  | **Description**                                                                                                                                                               | **Status**     |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| **Export movement log**      | Downloads all movement records (respecting active filters) as a CSV. Columns: Date, Recorded at, Customer, Type, Qty, Staff, Note, Edited at. Filename includes today's date. | **✓ Included** |
| **Export customer balances** | Downloads a summary of all customer balances as a CSV. Columns: Customer, Issued, Returned, Balance. Sorted by balance descending. Filename includes today's date.            | **✓ Included** |
| **CSV formatting**           | Values containing commas, quotes, or line breaks are correctly quoted and escaped. Compatible with Excel, Google Sheets, and other tools.                                     | **✓ Included** |

## **3.7 User experience details**

| **Feature**                      | **Description**                                                                                                                         | **Status**     |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| **Tabbed interface**             | The main view is split into two tabs: Movement log and Customer balances. Only one tab is visible at a time.                            | **✓ Included** |
| **Autocomplete customers**       | The customer name field uses a browser datalist to suggest existing customer names as the user types.                                   | **✓ Included** |
| **Form defaults**                | Date field defaults to today. Quantity defaults to 1. Type defaults to Issue.                                                           | **✓ Included** |
| **Form reset on submit**         | After a successful submission, the Customer and Note fields are cleared and Qty resets to 1. The Date and staff selection are retained. | **✓ Included** |
| **Confirmation on delete**       | Deleting a movement requires the user to confirm via a browser confirmation dialog.                                                     | **✓ Included** |
| **Confirmation on staff remove** | Removing a staff member requires confirmation.                                                                                          | **✓ Included** |
| **Light/dark mode**              | The application inherits the host page's colour scheme and adapts automatically to light or dark mode.                                  | **✓ Included** |
| **Responsive layout**            | The application adjusts to the available width. On narrower viewports, the form and table may be constrained.                           | **✓ Included** |

# **4\. Data Model**

## **4.1 Movement record**

Each movement stored in local storage contains the following fields:

| **Field**      | **Type**             | **Description**                                                                        |
| -------------- | -------------------- | -------------------------------------------------------------------------------------- |
| **id**         | _Number (timestamp)_ | Unique identifier. Set to Date.now() at the time of creation.                          |
| **date**       | _ISO 8601 string_    | The movement date as selected by the user. May differ from recordedAt if backdated.    |
| **recordedAt** | _ISO 8601 string_    | The exact date and time the record was created in the application.                     |
| **editedAt**   | _ISO 8601 string_    | The date and time of the most recent edit. Absent if the record has never been edited. |
| **customer**   | _String_             | The customer name as entered by the user.                                              |
| **type**       | _String_             | 'issue' or 'return'.                                                                   |
| **qty**        | _Integer_            | Number of pallets. Always a positive integer regardless of type.                       |
| **staff**      | _String_             | Name of the staff member who recorded the movement.                                    |
| **note**       | _String_             | Optional free-text note. Empty string if not provided.                                 |

# **5\. Features Not Currently Included**

The following are capabilities that have been discussed or are commonly expected in pallet tracking tools, but are not present in the current application. These could be added in a future iteration.

- User authentication - no login, no user accounts, no access control
- Multi-device sync - data does not replicate across browsers or devices
- Cloud or server-based storage - all data is local to the browser
- CSV import - data can be exported but not imported from a file
- Date range filtering - the movement log cannot be filtered by a date range
- Editing records from the customer balances view - edits must be made from the movement log tab
- Pallet types or categories - all pallets are treated as identical
- Printable reports - there is no print layout or PDF export
- Notifications or alerts for high outstanding balances
- Audit trail - deleted records leave no trace
- Multi-business or multi-site support

# **6\. How to Use This Document**

Review each feature in Section 3 and indicate your preference using one of the following:

- Keep - include this feature in the rebuilt application as described
- Remove - exclude this feature entirely
- Modify - keep but change the behaviour (describe what you want instead)
- Promote from Section 5 - add a feature that is not currently included

_Once you have reviewed the document, share your decisions and any notes. The application will then be rebuilt to match your specification exactly._

_Pallet Tracker - Feature Specification · For internal use_