/**
 * JSK OS
 * Module: Core Configuration Tests
 * Version: 1.0.0
 */

/**
 * Runs the complete Core Config test suite.
 *
 * Select this function in Apps Script after clasp push.
 *
 * @return {Object}
 */
function testJskOsCoreConfig() {
  var tests = [
    runJskOsTest_(
      'Application configuration',
      function () {
        if (
          JSKOS.Config.APP.NAME !==
          'JSK OS'
        ) {
          throw new Error(
            'Application name is incorrect.'
          );
        }

        return {
          appName:
            JSKOS.Config.APP.NAME,
          version:
            JSKOS.Config.APP.VERSION
        };
      }
    ),

    runJskOsTest_(
      'Spreadsheet connection',
      function () {
        var spreadsheet =
          JSKOS.ConfigService
            .getSpreadsheet();

        return {
          spreadsheetId:
            spreadsheet.getId(),
          spreadsheetName:
            spreadsheet.getName()
        };
      }
    ),

    runJskOsTest_(
      'Constants registry',
      function () {
        if (
          JSKOS.Constants.MODULES.COMPANY !==
          'COMPANY'
        ) {
          throw new Error(
            'Company module constant failed.'
          );
        }

        if (
          JSKOS.Constants.STATUS.ACTIVE !==
          'Active'
        ) {
          throw new Error(
            'Active status constant failed.'
          );
        }

        return {
          companyModule:
            JSKOS.Constants.MODULES.COMPANY,
          activeStatus:
            JSKOS.Constants.STATUS.ACTIVE
        };
      }
    ),

    runJskOsTest_(
      'Date formatting',
      function () {
        var formattedDate =
          JSKOS.ConfigService.formatDate(
            new Date(),
            'yyyy-MM-dd HH:mm:ss'
          );

        if (!formattedDate) {
          throw new Error(
            'Date formatting returned no value.'
          );
        }

        return formattedDate;
      }
    ),

    runJskOsTest_(
      'Current user resolution',
      function () {
        return JSKOS.ConfigService
          .getCurrentUser();
      }
    )
  ];

  var passed = tests.filter(function (
    test
  ) {
    return test.passed;
  }).length;

  var result = {
    suite: 'JSK OS Core Config',
    version: JSKOS.Config.APP.VERSION,
    total: tests.length,
    passed: passed,
    failed: tests.length - passed,
    success: passed === tests.length,
    tests: tests
  };

  console.log(
    JSON.stringify(result, null, 2)
  );

  return result;
}


/**
 * Executes one test safely.
 *
 * @param {string} testName
 * @param {Function} callback
 * @return {Object}
 * @private
 */
function runJskOsTest_(
  testName,
  callback
) {
  try {
    return {
      name: testName,
      passed: true,
      result: callback()
    };
  } catch (error) {
    return {
      name: testName,
      passed: false,
      error: error.message,
      stack: error.stack || ''
    };
  }
}