function migrateCompanyDatabase() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  if (!spreadsheet) {
    throw new Error('Active spreadsheet is not available.');
  }

  const sheetName = 'Companies';

  const headers = [
    'Company ID',
    'Company Name',
    'Industry',
    'GSTIN',
    'Website',
    'Address',
    'Area',
    'Zone',
    'Owner Person ID',
    'Primary Contact ID',
    'Employees',
    'Turnover Range',
    'Current Covers',
    'Risk Category',
    'Corporate Potential',
    'Last Review',
    'Next Review',
    'Status',
    'Google Maps Link',
    'Remarks',
    'Created At',
    'Created By',
    'Updated At',
    'Updated By',
    'Record Version',
    'Is Deleted'
  ];

  let sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
    sheet.getRange('A1').setValue('JSK OS – COMPANIES / BUSINESSES');
    sheet.getRange(2, 1, 1, headers.length).setValues([headers]);
  } else {
    const headerRow = findCompanyHeaderRow_(sheet);

    if (!headerRow) {
      throw new Error(
        'Companies sheet exists, but Company ID and Company Name header row was not found.'
      );
    }

    const lastColumn = Math.max(sheet.getLastColumn(), 1);

    const existingHeaders = sheet
      .getRange(headerRow, 1, 1, lastColumn)
      .getDisplayValues()[0]
      .map(function (header) {
        return String(header || '').trim();
      });

    const missingHeaders = headers.filter(function (header) {
      return existingHeaders.indexOf(header) === -1;
    });

    if (missingHeaders.length > 0) {
      sheet
        .getRange(
          headerRow,
          existingHeaders.length + 1,
          1,
          missingHeaders.length
        )
        .setValues([missingHeaders]);
    }
  }

  SpreadsheetApp.flush();

  return {
    success: true,
    message: 'Company database migration completed.',
    sheetName: sheetName
  };
}


function findCompanyHeaderRow_(sheet) {
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();

  if (lastRow < 1 || lastColumn < 1) {
    return null;
  }

  const rowsToScan = Math.min(lastRow, 10);

  const values = sheet
    .getRange(1, 1, rowsToScan, lastColumn)
    .getDisplayValues();

  for (let rowIndex = 0; rowIndex < values.length; rowIndex++) {
    const row = values[rowIndex].map(function (value) {
      return String(value || '').trim().toLowerCase();
    });

    if (
      row.indexOf('company id') !== -1 &&
      row.indexOf('company name') !== -1
    ) {
      return rowIndex + 1;
    }
  }

  return null;
}