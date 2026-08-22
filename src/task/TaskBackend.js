/** JSK OS Build 1004 - Task service and API. */

function taskApiExecute_(operation, callback) {
  try {
    var authority = JSKOS.LegacyMutationAuthority.requireUser('tasks', operation);
    requireBuild1004Tasks_();
    return { success: true, data: callback(JSKOS.LegacyMutationAuthority.actor(authority), authority), error: null, meta: { operation: operation, timestamp: new Date().toISOString() } };
  } catch (error) {
    console.error('Task API ' + operation + ' failed: ' + (error.stack || error));
    return { success: false, data: null, error: { name: error.name || 'Error', message: error.message || String(error), code: error.code || '', details: error.currentVersion ? { currentVersion: error.currentVersion, code: error.code } : {} } };
  }
}

function taskRequest_(payload) { return payload && typeof payload === 'object' ? payload : {}; }
function taskRepository_() { requireBuild1004Tasks_(); return new TaskRepository(); }

function apiTaskCreate(payload) {
  return taskApiExecute_('create', function (actor) {
    var request = taskRequest_(payload);
    return taskRepository_().create(request.data || {}, actor);
  });
}
function apiTaskGet(payload) {
  return taskApiExecute_('get', function () {
    var request = taskRequest_(payload);
    var task = taskRepository_().findById(request.taskId, false);
    if (!task) throw new Error('Task not found.');
    return task;
  });
}
function apiTaskUpdate(payload) {
  return taskApiExecute_('update', function (actor) {
    var request = taskRequest_(payload);
    return taskRepository_().update(request.taskId, request.data || {}, actor, request.expectedVersion);
  });
}
function apiTaskSearch(payload) {
  return taskApiExecute_('search', function () { return taskRepository_().search(taskRequest_(payload)); });
}
function apiTaskComplete(payload) {
  var request = taskRequest_(payload);
  request.data = Object.assign({}, request.data || {}, { status: 'Completed' });
  return apiTaskUpdate(request);
}

