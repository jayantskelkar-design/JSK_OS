/** JSK OS Build 1005 - Meeting foundation smoke test. */

function testMeetingFoundation() {
  var migration = ensureBuild1005Meetings();
  var repository = new MeetingRepository();
  var search = repository.search({});
  if (!migration.success || !Array.isArray(search.items)) throw new Error('Meeting foundation test failed.');
  var result = { success: true, schemaVersion: migration.schemaVersion, meetingCount: search.totalItems };
  console.info(JSON.stringify(result));
  return result;
}
