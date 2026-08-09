/** JSK OS Build 1013 - Access control contract tests. */

var testBuild1013AccessTempUserCache_;
function testBuild1013AccessTempUser() {
  if (!testBuild1013AccessTempUserCache_) {
    testBuild1013AccessTempUserCache_ = {
      email: 'access-api-test+' + new Date().getTime() + '@example.com',
      role: JSK_ACCESS.ROLES.READ_ONLY
    };
  }
  return testBuild1013AccessTempUserCache_;
}

function testBuild1013AccessControlFoundation() {
  var roles = JSK_ACCESS.ROLES;
  var admin = JSKOS.AccessControl.permissionsForRole(roles.ADMINISTRATOR);
  var manager = JSKOS.AccessControl.permissionsForRole(roles.MANAGER);
  var executive = JSKOS.AccessControl.permissionsForRole(roles.EXECUTIVE);
  var staff = JSKOS.AccessControl.permissionsForRole(roles.STAFF);
  var readOnly = JSKOS.AccessControl.permissionsForRole(roles.READ_ONLY);

  var checks = {
    administratorHasAll: admin['*'] === true,
    managerCanUpdatePolicies: manager['policies.update'] === true,
    managerCannotManageAccess: manager['access.manage'] !== true,
    executiveCanViewReports: executive['reports.view'] === true,
    executiveCannotUpdateClaims: executive['claims.update'] !== true,
    staffCanUpdateTasks: staff['tasks.update'] === true,
    staffCannotViewRevenue: staff['revenue.view'] !== true,
    readOnlyCanViewDashboard: readOnly['dashboard.view'] === true,
    readOnlyCannotUpdateCompanies: readOnly['companies.update'] !== true,
    everyRouteProtected: Object.keys(JSKOS.RouteConfig.ROUTES).every(function (key) {
      return Boolean(JSK_ACCESS.ROUTE_PERMISSIONS[key]);
    }),
    accessApisAvailable:
      typeof apiGetAccessContext === 'function' &&
      typeof apiAccessListUsers === 'function' &&
      typeof apiAccessSetUserRole === 'function' &&
      typeof apiAccessRemoveUserRole === 'function',
    createMapsToCreate:
      JSKOS.AccessControl.getOperationPermission('claims', 'create') === 'claims.create',
    deleteMapsToArchive:
      JSKOS.AccessControl.getOperationPermission('documents', 'delete') === 'documents.archive',
    completeMapsToUpdate:
      JSKOS.AccessControl.getOperationPermission('tasks', 'complete') === 'tasks.update',
    searchMapsToView:
      JSKOS.AccessControl.getOperationPermission('people', 'search') === 'people.view',
    client360MapsToView:
      JSKOS.AccessControl.getOperationPermission('client360', 'view') === 'client360.view',
    filterReadsMapToView:
      JSKOS.AccessControl.getOperationPermission('companies', 'filters') === 'companies.view' &&
      JSKOS.AccessControl.getOperationPermission('documents', 'link-options') === 'documents.view'
  };

  var failed = Object.keys(checks).filter(function (key) { return !checks[key]; });
  if (failed.length) {
    throw new Error('Build 1013 access contract failed: ' + failed.join(', '));
  }
  var result = { success: true, build: 1013, checks: checks };
  console.info(JSON.stringify(result));
  return result;
}

function testBuild1013AccessBootstrap() {
  var roles = JSK_ACCESS.ROLES;
  var admin = JSKOS.AccessControl.permissionsForRole(roles.ADMINISTRATOR);
  var readOnly = JSKOS.AccessControl.permissionsForRole(roles.READ_ONLY);

  var checks = {
    adminHasWildcard: admin['*'] === true,
    readOnlyHasNoCreate: readOnly['people.create'] !== true,
    readOnlyHasNoUpdate: readOnly['people.update'] !== true,
    readOnlyCanViewPeople: readOnly['people.view'] === true
  };

  var failed = Object.keys(checks).filter(function (key) { return !checks[key]; });
  if (failed.length) {
    throw new Error('Build 1013 access bootstrap failed: ' + failed.join(', '));
  }

  return { success: true, checks: checks };
}

function testBuild1013AccessRoleContract() {
  var roles = JSK_ACCESS.ROLES;
  var adminRoutes = JSKOS.AccessControl.getAccessibleRoutesForRole(roles.ADMINISTRATOR);
  var managerRoutes = JSKOS.AccessControl.getAccessibleRoutesForRole(roles.MANAGER);
  var executiveRoutes = JSKOS.AccessControl.getAccessibleRoutesForRole(roles.EXECUTIVE);
  var staffRoutes = JSKOS.AccessControl.getAccessibleRoutesForRole(roles.STAFF);
  var readOnlyRoutes = JSKOS.AccessControl.getAccessibleRoutesForRole(roles.READ_ONLY);

  var checks = {
    administratorCanAccessAllRoutes:
      adminRoutes.length === Object.keys(JSK_ACCESS.ROUTE_PERMISSIONS).length,
    managerCannotAccessAdmin:
      managerRoutes.indexOf('access') === -1,
    executiveCannotAccessAdmin:
      executiveRoutes.indexOf('access') === -1,
    staffCannotAccessAdmin:
      staffRoutes.indexOf('access') === -1,
    readOnlyCannotAccessAdmin:
      readOnlyRoutes.indexOf('access') === -1,
    readOnlyHasOnlyViewRoutes:
      JSKOS.AccessControl.hasRolePermission(roles.READ_ONLY, 'dashboard.view') &&
      !JSKOS.AccessControl.hasRolePermission(roles.READ_ONLY, 'dashboard.update')
  };

  var failed = Object.keys(checks).filter(function (key) { return !checks[key]; });
  if (failed.length) {
    throw new Error('Build 1013 role contract failed: ' + failed.join(', '));
  }

  return { success: true, checks: checks };
}

function testBuild1013AccessPermissionErrors() {
  var error;
  try {
    JSKOS.AccessControl.requirePermission('access.manage', { email: 'system' });
  } catch (e) {
    error = e;
  }

  if (!error || error.name !== 'UnauthorizedError' || error.code !== 'UNAUTHORIZED') {
    throw new Error('Build 1013 access permission error contract failed. Expected UnauthorizedError.');
  }

  return { success: true, error: { name: error.name, code: error.code } };
}

function testBuild1013AccessContextSystemUser() {
  var context = JSKOS.AccessControl.getContext('system');
  if (context.authenticated !== false || context.role !== 'Unassigned') {
    throw new Error('System user context contract failed. Expected unauthenticated unassigned role.');
  }
  if (Object.keys(context.permissions).length !== 0) {
    throw new Error('System user context contract failed. Expected no permissions.');
  }
  return { success: true, context: context };
}

function testBuild1013AccessApiContext() {
  var response = apiGetAccessContext();
  if (!response || response.success !== true || !response.data || typeof response.data.email !== 'string') {
    throw new Error('Build 1013 access API context contract failed.');
  }
  return { success: true, context: response.data };
}

function testBuild1013AccessListUsersApi() {
  var response = apiAccessListUsers();
  if (!response || response.success !== true || !Array.isArray(response.data)) {
    throw new Error('Build 1013 access list users API contract failed.');
  }
  var invalid = response.data.some(function (item) {
    return !item || typeof item.email !== 'string' || typeof item.role !== 'string';
  });
  if (invalid) {
    throw new Error('Build 1013 access list users API contract failed: invalid user shape.');
  }
  return { success: true, userCount: response.data.length };
}

function testBuild1013AccessSetUserRoleApi() {
  var payload = testBuild1013AccessTempUser();
  try {
    apiAccessRemoveUserRole(payload);
  } catch (ignored) {
    // Ensure the temporary test user is removed before assignment.
  }
  var response = apiAccessSetUserRole(payload);
  if (!response || response.success !== true || !response.data ||
      response.data.email !== payload.email || response.data.role !== payload.role) {
    throw new Error('Build 1013 access set user role API contract failed.');
  }
  return { success: true, assignment: response.data };
}

function testBuild1013AccessRemoveUserRoleApi() {
  var payload = { email: testBuild1013AccessTempUser().email };
  var response = apiAccessRemoveUserRole(payload);
  if (!response || response.success !== true || !response.data ||
      response.data.email !== payload.email || response.data.removed !== true) {
    throw new Error('Build 1013 access remove user role API contract failed.');
  }
  return { success: true, removed: response.data.email };
}

function testBuild1013AccessCleanupTestUserApi() {
  var payload = { email: testBuild1013AccessTempUser().email };
  var response = apiAccessRemoveUserRole(payload);
  if (!response || response.success !== true || !response.data ||
      response.data.email !== payload.email || response.data.removed !== true) {
    throw new Error('Build 1013 access cleanup test user API contract failed.');
  }
  return { success: true, cleaned: response.data.email };
}

function testBuild1013AccessSetUserRoleInvalidEmailApi() {
  var response = apiAccessSetUserRole({ email: 'invalid-email', role: JSK_ACCESS.ROLES.READ_ONLY });
  if (!response || response.success !== false) {
    throw new Error('Build 1013 access set user role invalid email contract failed. Expected failure.');
  }
  if (response.code !== 'ACCESS_ERROR' || !response.error || response.error.details.type !== 'Error') {
    throw new Error('Build 1013 access set user role invalid email contract failed: invalid error envelope.');
  }
  return { success: true, message: response.message };
}

function testBuild1013AccessSetUserRoleInvalidRoleApi() {
  var tempUser = testBuild1013AccessTempUser();
  var response = apiAccessSetUserRole({ email: tempUser.email, role: 'INVALID_ROLE' });
  if (!response || response.success !== false) {
    throw new Error('Build 1013 access set user role invalid role contract failed. Expected failure.');
  }
  if (response.code !== 'ACCESS_ERROR' || !response.error || response.error.details.type !== 'Error') {
    throw new Error('Build 1013 access set user role invalid role contract failed: invalid error envelope.');
  }
  return { success: true, message: response.message };
}

function testBuild1013AccessRemoveSelfRoleApi() {
  var contextResponse = apiGetAccessContext();
  var email = contextResponse && contextResponse.data && contextResponse.data.email;
  if (!email || typeof email !== 'string') {
    throw new Error('Build 1013 access remove self role contract failed: no authenticated email.');
  }
  var response = apiAccessRemoveUserRole({ email: email });
  if (!response || response.success !== false) {
    throw new Error('Build 1013 access remove self role contract failed. Expected failure.');
  }
  if (response.code !== 'ACCESS_ERROR' || !response.error || response.error.details.type !== 'Error') {
    throw new Error('Build 1013 access remove self role contract failed: invalid error envelope.');
  }
  return { success: true, message: response.message };
}

function testBuild1013AccessRouteRendering() {
  var output = doGet({ parameter: { page: 'access' } });
  if (!output || typeof output.getContent !== 'function') {
    throw new Error('Build 1013 access route rendering failed.');
  }
  var content = output.getContent();
  if (content.indexOf('User Access & Security') === -1) {
    throw new Error('Build 1013 access route rendering failed: page title missing.');
  }
  return { success: true, route: 'access', contentLength: content.length };
}

function testBuild1013AccessNavigationModel() {
  var navigation = JSKOS.Router.getNavigation('access');
  if (!Array.isArray(navigation)) {
    throw new Error('Build 1013 access navigation model failed: expected array.');
  }
  var accessItem = navigation.filter(function (item) {
    return item && item.key === 'access';
  })[0];
  if (!accessItem) {
    throw new Error('Build 1013 access navigation model failed: access item missing.');
  }
  if (typeof accessItem.href !== 'string' || accessItem.href.indexOf('page=access') === -1) {
    throw new Error('Build 1013 access navigation model failed: invalid access href.');
  }
  return { success: true, accessItem: accessItem, navigationKeys: navigation.map(function (item) { return item.key; }) };
}

function testBuild1013AccessSidebarNavigation() {
  var html = buildJSKOSNavigationHtml_('access');
  if (typeof html !== 'string' || html.indexOf('class="nav-item') === -1) {
    throw new Error('Build 1013 access sidebar navigation failed: invalid html.');
  }
  if (html.indexOf('page=access') === -1) {
    throw new Error('Build 1013 access sidebar navigation failed: access link missing.');
  }
  if (html.indexOf('class="nav-item active"') === -1) {
    throw new Error('Build 1013 access sidebar navigation failed: active state missing.');
  }
  return { success: true, htmlLength: html.length };
}

function testBuild1013AccessUiRendering() {
  var content = renderAccessUi().getContent();
  var markers = [
    'User Access & Security', 'accessTableBody', 'apiAccessListUsers',
    'apiAccessSetUserRole', 'Administrator', 'Read-only'
  ];
  var missing = markers.filter(function (marker) {
    return content.indexOf(marker) === -1;
  });
  if (missing.length) throw new Error('Access UI markers missing: ' + missing.join(', '));
  return { success: true, markersChecked: markers.length };
}

function testBuild1013SecurityAudit() {
  var roles = JSK_ACCESS.ROLES;
  var adminRoutes = JSKOS.AccessControl.getAccessibleRoutesForRole(roles.ADMINISTRATOR);
  var managerRoutes = JSKOS.AccessControl.getAccessibleRoutesForRole(roles.MANAGER);
  var executiveRoutes = JSKOS.AccessControl.getAccessibleRoutesForRole(roles.EXECUTIVE);
  var staffRoutes = JSKOS.AccessControl.getAccessibleRoutesForRole(roles.STAFF);
  var readOnlyRoutes = JSKOS.AccessControl.getAccessibleRoutesForRole(roles.READ_ONLY);
  var checks = {
    adminSeesAccess: adminRoutes.indexOf('access') !== -1,
    nonAdminsCannotManageAccess:
      managerRoutes.indexOf('access') === -1 &&
      executiveRoutes.indexOf('access') === -1 &&
      staffRoutes.indexOf('access') === -1 &&
      readOnlyRoutes.indexOf('access') === -1,
    staffCannotViewFinance:
      staffRoutes.indexOf('revenue') === -1 && staffRoutes.indexOf('reports') === -1,
    executiveCanViewFinance:
      executiveRoutes.indexOf('revenue') !== -1 && executiveRoutes.indexOf('reports') !== -1,
    readOnlyHasNoWrites:
      !JSKOS.AccessControl.hasRolePermission(roles.READ_ONLY, 'companies.update') &&
      !JSKOS.AccessControl.hasRolePermission(roles.READ_ONLY, 'claims.create') &&
      !JSKOS.AccessControl.hasRolePermission(roles.READ_ONLY, 'documents.archive'),
    staffServicingBoundary:
      JSKOS.AccessControl.hasRolePermission(roles.STAFF, 'tasks.update') &&
      JSKOS.AccessControl.hasRolePermission(roles.STAFF, 'documents.create') &&
      !JSKOS.AccessControl.hasRolePermission(roles.STAFF, 'policies.update'),
    managerOperationalBoundary:
      JSKOS.AccessControl.hasRolePermission(roles.MANAGER, 'policies.update') &&
      JSKOS.AccessControl.hasRolePermission(roles.MANAGER, 'claims.archive') &&
      !JSKOS.AccessControl.hasRolePermission(roles.MANAGER, 'access.manage'),
    quoteReconciliationLeastPrivilege:
      JSKOS.AccessControl.hasRolePermission(roles.ADMINISTRATOR, 'quotes.reconcile') &&
      !JSKOS.AccessControl.hasRolePermission(roles.MANAGER, 'quotes.reconcile') &&
      !JSKOS.AccessControl.hasRolePermission(roles.EXECUTIVE, 'quotes.reconcile') &&
      !JSKOS.AccessControl.hasRolePermission(roles.STAFF, 'quotes.reconcile') &&
      !JSKOS.AccessControl.hasRolePermission(roles.READ_ONLY, 'quotes.reconcile') &&
      JSKOS.AccessControl.getOperationPermission('quotes', 'reconcile') === 'quotes.reconcile',
    administratorHasEveryRoute:
      adminRoutes.length === Object.keys(JSK_ACCESS.ROUTE_PERMISSIONS).length,
    protectedWrappersAvailable:
      typeof claimApiExecute_ === 'function' &&
      typeof companyApiExecute_ === 'function' &&
      typeof peopleApiExecute_ === 'function' &&
      typeof policyApiExecute_ === 'function' &&
      typeof documentApiExecute_ === 'function' &&
      typeof endorsementApi_ === 'function' &&
      typeof quoteApi_ === 'function' &&
      typeof revenueApi_ === 'function' &&
      typeof taskApiExecute_ === 'function' &&
      typeof meetingApiExecute_ === 'function' &&
      typeof communicationApiExecute_ === 'function' &&
      typeof reportApi_ === 'function'
  };
  var failed = Object.keys(checks).filter(function (key) { return !checks[key]; });
  if (failed.length) throw new Error('Build 1013 security audit failed: ' + failed.join(', '));
  return {
    success: true,
    checks: checks,
    routeCounts: {
      Administrator: adminRoutes.length, Manager: managerRoutes.length,
      Executive: executiveRoutes.length, Staff: staffRoutes.length,
      'Read-only': readOnlyRoutes.length
    }
  };
}
