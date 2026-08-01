/** JSK OS Build 1004 task foundation smoke test. */

function testTaskFoundation() {
  var migration = ensureBuild1004Tasks();
  var repository = new TaskRepository();
  var search = repository.search({});
  if (!migration.success || !Array.isArray(search.items)) {
    throw new Error('Task foundation test failed.');
  }
  return { success: true, schemaVersion: migration.schemaVersion, taskCount: search.totalItems };
}

