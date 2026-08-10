/** JSK OS Builds 1007-1013 release regression and stable-readiness suites. */

function runJSKOSReleaseSuite_(build, tests, schemaVersion) {
  var results = tests.map(function (test) {
    try {
      return { name: test.name, success: true, result: test.run() };
    } catch (error) {
      return {
        name: test.name,
        success: false,
        error: error.message || String(error)
      };
    }
  });
  var failures = results.filter(function (result) { return !result.success; });
  var report = {
    success: failures.length === 0,
    build: build,
    version: JSKOS.Config.APP.VERSION,
    schemaVersion: schemaVersion,
    passed: results.length - failures.length,
    failed: failures.length,
    results: results,
    generatedAt: new Date().toISOString()
  };
  console.info(JSON.stringify(report));
  if (failures.length) {
    throw new Error(
      'Build ' + build + ' release regression failed: ' +
      failures.map(function (item) {
        return item.name + ' - ' + item.error;
      }).join('; ')
    );
  }
  return report;
}

function testUiMarker_(renderer, markers) {
  var content = renderer().getContent();
  markers.forEach(function (marker) {
    if (content.indexOf(marker) === -1) {
      throw new Error('Missing UI marker: ' + marker);
    }
  });
  return { success: true, markersChecked: markers.length };
}

function testBuild1002ReleaseCandidate() {
  return runJSKOSReleaseSuite_(1002, [
    { name: 'Dashboard service', run: testDashboardService },
    { name: 'Renewal candidates', run: testRenewalAutomationCandidates },
    { name: 'Renewal follow-up plan', run: testRenewalFollowUpPlan },
    { name: 'GARUDA intelligence', run: testGarudaRenewalIntelligence }
  ], JSK_POLICY_SCHEMA.VERSION);
}

function testBuild1003ReleaseCandidate() {
  return runJSKOSReleaseSuite_(1003, [
    { name: 'Renewal work queue', run: testRenewalWorkQueue },
    { name: 'Work queue timezone', run: testRenewalWorkQueueTimezoneFormatting }
  ], JSK_POLICY_SCHEMA.VERSION);
}

function testBuild1007ReleaseCandidate() {
  return runJSKOSReleaseSuite_(1007, [
    { name: 'Claim foundation', run: testClaimFoundation },
    { name: 'Claim UI', run: testClaimUiRendering },
    { name: 'Claim navigation', run: testBuild1007RuntimeNavigation }
  ], JSK_CLAIM_SCHEMA.VERSION);
}

function testBuild1008ReleaseCandidate() {
  return runJSKOSReleaseSuite_(1008, [
    { name: 'Document foundation', run: testDocumentFoundation },
    { name: 'Document serialization', run: testDocumentApiSerialization },
    { name: 'Document mapping', run: testDocumentHeaderMapping },
    { name: 'Archived document search', run: testArchivedDocumentSearch },
    { name: 'Document expiry summary', run: testDocumentExpirySummary },
    { name: 'Document UI', run: testDocumentUiRendering }
  ], JSK_DOCUMENT_SCHEMA.VERSION);
}

function testBuild1009ReleaseCandidate() {
  return runJSKOSReleaseSuite_(1009, [
    { name: 'Endorsement foundation', run: testEndorsementFoundation },
    { name: 'Endorsement transitions', run: testEndorsementStatusTransitions },
    { name: 'Endorsement intelligence', run: testEndorsementIntelligenceApi },
    { name: 'Endorsement UI', run: testEndorsementUiRendering }
  ], JSK_ENDORSEMENT_SCHEMA.VERSION);
}

function testBuild1010ReleaseCandidate() {
  return runJSKOSReleaseSuite_(1010, [
    { name: 'Quote foundation', run: testQuoteFoundation },
    { name: 'Quote comparison', run: testQuoteComparisonApi },
    { name: 'Quote totals', run: testQuoteAutomaticTotals },
    { name: 'Quote UI', run: function () {
      return testUiMarker_(renderQuoteUi, [
        'Quote Management',
        'quoteTableBody',
        'apiQuoteSearch',
        'apiQuoteCreate'
      ]);
    } }
  ], JSK_QUOTE_SCHEMA.VERSION);
}

function testBuild1012ReleaseCandidate() {
  return runJSKOSReleaseSuite_(1012, [
    { name: 'Report foundation', run: testReportFoundation },
    { name: 'Report automation plan', run: testReportAutomationPlan },
    { name: 'Report UI', run: function () {
      return testUiMarker_(renderReportUi, [
        'Reports & Analytics',
        'Executive Summary',
        'apiReportExecutiveSummary',
        'apiReportExport'
      ]);
    } },
    { name: 'Complete navigation', run: testCompleteNavigation },
    { name: 'Trigger audit contract', run: testAutomationTriggerAuditContract }
  ], JSK_REPORT_SCHEMA.VERSION);
}

/** Build 1013 dropdown entry point kept in the central release-suite file. */
function testBuild1013ReleaseCandidate() {
  return runJSKOSReleaseSuite_(1013, [
    { name: 'Access-control foundation', run: testBuild1013AccessControlFoundation },
    { name: 'Access bootstrap contract', run: testBuild1013AccessBootstrap },
    { name: 'Access role contract', run: testBuild1013AccessRoleContract },
    { name: 'Access permission error contract', run: testBuild1013AccessPermissionErrors },
    { name: 'System user access context', run: testBuild1013AccessContextSystemUser },
    { name: 'Access API context contract', run: testBuild1013AccessApiContext },
    { name: 'Access list users API contract', run: testBuild1013AccessListUsersApi },
    { name: 'Access set user role API contract', run: testBuild1013AccessSetUserRoleApi },
    { name: 'Access remove user role API contract', run: testBuild1013AccessRemoveUserRoleApi },
    { name: 'Access cleanup test user API contract', run: testBuild1013AccessCleanupTestUserApi },
    { name: 'Access invalid set-user-role payload', run: testBuild1013AccessSetUserRoleInvalidEmailApi },
    { name: 'Access invalid role payload contract', run: testBuild1013AccessSetUserRoleInvalidRoleApi },
    { name: 'Access remove self-role protection', run: testBuild1013AccessRemoveSelfRoleApi },
    { name: 'Access navigation model contract', run: testBuild1013AccessNavigationModel },
    { name: 'Access sidebar navigation contract', run: testBuild1013AccessSidebarNavigation },
    { name: 'Access route rendering contract', run: testBuild1013AccessRouteRendering },
    { name: 'Administrator access UI', run: testBuild1013AccessUiRendering },
    { name: 'Role isolation and API security audit', run: testBuild1013SecurityAudit }
  ], 1);
}

/** Build 1014 Client 360 operational intelligence and hardening. */
function testBuild1014ReleaseCandidate() {
  return testBuild1014Client360IntelligenceReleaseCandidate();
}

/** Build 1015 unified Client Context and relationship integrity. */
function testBuild1015ReleaseCandidate() {
  return runJSKOSReleaseSuite_(1015,[
    {name:'Client context normalization',run:testBuild1015ClientContextNormalization},
    {name:'Bounded policy IDs',run:testBuild1015PolicyIdBounds},
    {name:'Context matching and isolation',run:testBuild1015ContextMatching},
    {name:'Context preservation and clear',run:testBuild1015ContextPreservationAndClear},
    {name:'Contextual repository isolation',run:testBuild1015ContextualRepositoryIsolation},
    {name:'Policy context fallback',run:testBuild1015PolicyContextFallback},
    {name:'Relationship integrity',run:testBuild1015RelationshipIntegrity},
    {name:'Endorsement batching',run:testBuild1015EndorsementBatching},
    {name:'Unified Client 360 metadata',run:testBuild1015UnifiedContextMetadata}
  ],null);
}

/** Build 1016 Action Readiness and Workflow Foundation. */
function testBuild1016ReleaseCandidate() {
  return runJSKOSReleaseSuite_(1016,[
    {name:'Bounded action catalog',run:testBuild1016ActionCatalog},
    {name:'Readiness statuses and permissions',run:testBuild1016ReadinessStatuses},
    {name:'Missing prerequisites',run:testBuild1016MissingPrerequisites},
    {name:'Company/Person/Policy isolation',run:testBuild1016ContextIsolation},
    {name:'Route and deep-link safety',run:testBuild1016DeepLinkSafety},
    {name:'Read-only source ownership',run:testBuild1016ReadOnlyOwnership},
    {name:'Bounded Policy handoff',run:testBuild1016PolicyBounds},
    {name:'No unauthorized data leakage',run:testBuild1016NoPermissionLeakage},
    {name:'Client 360 action UI',run:testBuild1016UiRendering}
  ],null);
}

/** Build 1017 non-persistent Workflow Intent and draft handoff. */
function testBuild1017ReleaseCandidate(){return runJSKOSReleaseSuite_(1017,[
  {name:'Intent normalization',run:testBuild1017IntentNormalization},
  {name:'Unsupported and malformed isolation',run:testBuild1017UnsupportedAndMalformed},
  {name:'Destination permission isolation',run:testBuild1017PermissionIsolation},
  {name:'Incomplete intent',run:testBuild1017IncompleteIntent},
  {name:'Allowlisted draft payload',run:testBuild1017AllowlistedDraft},
  {name:'Policy bounds and relationship integrity',run:testBuild1017BoundsAndRelationship},
  {name:'Handoff permission revalidation',run:testBuild1017HandoffRevalidation},
  {name:'Read-only non-persistence',run:testBuild1017ReadOnly},
  {name:'Workflow intent UI',run:testBuild1017UiRendering}
],null);}

/** Build 1018 Workflow Confirmation and audit receipt foundation. */
function testBuild1018ReleaseCandidate(){return runJSKOSReleaseSuite_(1018,[
  {name:'Confirmation normalization and receipt',run:testBuild1018Confirmation},
  {name:'Tampering and blocked isolation',run:testBuild1018TamperingAndBlocked},
  {name:'Server-derived actor',run:testBuild1018ActorAndBounds},
  {name:'Replay and append-only behavior',run:testBuild1018ReplayAndAppendOnly},
  {name:'Receipt validation and handoff',run:testBuild1018ReceiptAndHandoff},
  {name:'Audit failure fails closed',run:testBuild1018AuditFailure},
  {name:'Receipt expiry',run:testBuild1018Expiry},
  {name:'Exact receipt expiry boundaries',run:testBuild1018ExactExpiryBoundaries},
  {name:'No destination writes',run:testBuild1018NoWrites},
  {name:'Atomic confirmation and handoff',run:testBuild1018AtomicConcurrency},
  {name:'Valid Workflow_Audit schema',run:testBuild1018ValidAuditSchema},
  {name:'Invalid Workflow_Audit schemas fail closed',run:testBuild1018InvalidAuditSchemas},
  {name:'First-time Workflow_Audit initialization',run:testBuild1018FirstInitialization},
  {name:'Concurrent Workflow_Audit initialization',run:testBuild1018ConcurrentInitializationContract},
  {name:'Atomic Workflow_Audit repository evidence',run:testBuild1018AtomicRepositoryEvidence},
  {name:'Malformed confirmation evidence fails closed',run:testBuild1018MalformedConfirmationFailsClosed},
  {name:'Receipt expiry window has one active authority',run:testBuild1018ExpiryWindowAuthority},
  {name:'Complete Workflow_Audit evidence lookup',run:testBuild1018CompleteEvidenceLookup},
  {name:'Repository exact-expiry handoff boundary',run:testBuild1018RepositoryExpiryBoundary},
  {name:'Interleaved confirmation race',run:testBuild1018InterleavedConfirmationRace},
  {name:'Interleaved handoff race',run:testBuild1018InterleavedHandoffRace},
  {name:'Interleaved initialization race',run:testBuild1018InterleavedInitializationRace},
  {name:'Valid complete correlated lifecycle',run:testBuild1018ValidCorrelatedLifecycle},
  {name:'Malformed correlated lifecycle isolation',run:testBuild1018MalformedCorrelatedLifecycle},
  {name:'Distant malformed lifecycle isolation',run:testBuild1018DistantMalformedLifecycle},
  {name:'Policy evidence bounds',run:testBuild1018PolicyEvidenceBounds},
  {name:'Canonical persisted authority fields',run:testBuild1018CanonicalPersistedFields},
  {name:'Global workflow receipt uniqueness',run:testBuild1018GlobalReceiptUniqueness},
  {name:'Generic repository policy write bound',run:testBuild1018GenericPolicyWriteBound},
  {name:'Generic authority append path closed',run:testBuild1018GenericAuthorityAppendClosed},
  {name:'Strict authority policy context',run:testBuild1018StrictPolicyContext},
  {name:'Confirmation receipt UI',run:testBuild1018Ui}
],null);}

/** Build 1019 controlled Quote Draft execution. */
function testBuild1019ReleaseCandidate(){return runJSKOSReleaseSuite_(1019,[
  {name:'Valid controlled execution',run:testBuild1019ValidExecution},
  {name:'Preview remains non-mutating',run:testBuild1019PreviewNoMutation},
  {name:'Actor, action and destination isolation',run:testBuild1019ActorActionDestination},
  {name:'Permission and relationship revalidation',run:testBuild1019PermissionAndRelationship},
  {name:'Expiry and lifecycle isolation',run:testBuild1019ExpiryAndLifecycle},
  {name:'Strict zero-or-one Policy context',run:testBuild1019PolicyBounds},
  {name:'Mass assignment isolation',run:testBuild1019MassAssignment},
  {name:'Malformed payload isolation',run:testBuild1019MalformedPayload},
  {name:'Idempotent retry',run:testBuild1019IdempotentRetry},
  {name:'Changed retry payload isolation',run:testBuild1019ChangedRetryPayload},
  {name:'Duplicate destination evidence isolation',run:testBuild1019DuplicateDestination},
  {name:'Post-write audit reconciliation',run:testBuild1019AuditRecovery},
  {name:'Write failure retry',run:testBuild1019WriteFailureRetry},
  {name:'Authoritative lock coverage',run:testBuild1019LockCoverage},
  {name:'Client 360 ownership isolation',run:testBuild1019Client360Isolation},
  {name:'Additive Quote schema contract',run:testBuild1019SchemaContract},
  {name:'Execution audit lifecycle contract',run:testBuild1019AuditLifecycleContract},
  {name:'Completed receipt metadata',run:testBuild1019ReceiptCompletionMetadata},
  {name:'Authoritative fingerprint revalidation',run:testBuild1019AuthoritativeFingerprintRevalidation},
  {name:'Post-expiry audit-only reconciliation',run:testBuild1019PostExpiryAuditOnlyReconciliation},
  {name:'Reconciliation failure isolation',run:testBuild1019ReconciliationFailsClosed},
  {name:'Execution timestamp rules',run:testBuild1019ExecutionTimestampRules},
  {name:'Deterministic execution contenders',run:testBuild1019DeterministicConcurrentContenders},
  {name:'Fresh expiry mutation boundaries',run:testBuild1019FreshExpiryMutationBoundaries},
  {name:'Persistence-boundary expiry race',run:testBuild1019PersistenceBoundaryExpiry},
  {name:'Integrity errors are not audit pending',run:testBuild1019IntegrityErrorsNotAuditPending},
  {name:'Uncertain destination never recreates',run:testBuild1019UncertainDestinationNeverRecreates},
  {name:'Quote v1-v2 migration fixtures',run:testBuild1019QuoteMigrationFixtures}
],null);}

/** Build 1020 Quote execution operational reconciliation control. */
function testBuild1020ReleaseCandidate(){return runJSKOSReleaseSuite_(1020,[
  {name:'Verified reconciliation inspection',run:testBuild1020VerifiedInspection},
  {name:'Audit-only reconciliation',run:testBuild1020AuditOnlyReconciliation},
  {name:'Zero, one and multiple destination matches',run:testBuild1020ZeroOneMultipleMatches},
  {name:'Audit and destination lookup outages',run:testBuild1020LookupOutages},
  {name:'Authority tampering isolation',run:testBuild1020TamperingFailsClosed},
  {name:'Receipt and destination identity isolation',run:testBuild1020ReceiptAndIdentityTampering},
  {name:'Mutable Quote business-field independence',run:testBuild1020MutableBusinessFieldsIndependent},
  {name:'Normal Quote CRUD reconciliation compatibility',run:testBuild1020RepositoryCrudReconciliationCompatibility},
  {name:'Expired audit-only reconciliation',run:testBuild1020ExpiredAuditOnlyRules},
  {name:'Audit storage pending state',run:testBuild1020AuditStoragePending},
  {name:'Concurrent reconciliation idempotency',run:testBuild1020ConcurrentIdempotency},
  {name:'Unauthorized reconciliation isolation',run:testBuild1020UnauthorizedIsolation},
  {name:'Malformed lifecycle isolation',run:testBuild1020MalformedLifecycleAndMetadata},
  {name:'Safe bounded diagnostics',run:testBuild1020SafeDiagnostics},
  {name:'Strict reconciliation API payload',run:testBuild1020StrictApiPayload},
  {name:'Read-only destination ownership',run:testBuild1020ReadOnlyDestinationOwnership},
  {name:'Least-privilege reconciliation permission',run:testBuild1020LeastPrivilegeContract},
  {name:'Bounded authoritative audit lookup',run:testBuild1020BoundedAuditLookupContract},
  {name:'Large audit history and lifecycle bounds',run:testBuild1020LargeAuditAndLifecycleBounds},
  {name:'Audit sheet-read failure classification',run:testBuild1020SheetReadFailureClassification},
  {name:'Read-only inspection construction',run:testBuild1020ReadOnlyInspectionConstruction},
  {name:'Read-only sheet resolution failure',run:testBuild1020ReadOnlySheetResolutionFailure},
  {name:'Real read-only repositories remain write-free',run:testBuild1020RealReadOnlyRepositoriesNoWrites},
  {name:'Quote reconciliation recovery UI',run:function(){return testUiMarker_(renderQuoteUi,['workflowReconcileButton','apiQuoteWorkflowReconciliationInspect','apiQuoteWorkflowReconcile','RECONCILIATION REQUIRED','EXECUTION UNCERTAIN']);}}
],null);}

/** Build 1021 bounded Quote reconciliation operations queue. */
function testBuild1021ReleaseCandidate(){return runJSKOSReleaseSuite_(1021,[
  {name:'Bounded candidate discovery',run:testBuild1021CandidateDiscovery},
  {name:'Malformed and mixed evidence isolation',run:testBuild1021MalformedAndMixedEvidence},
  {name:'Audit and candidate hard bounds',run:testBuild1021HardBounds},
  {name:'Stable absolute cursor pagination',run:testBuild1021CursorStability},
  {name:'Strict pagination validation',run:testBuild1021PaginationValidation},
  {name:'Storage states and zero-write reads',run:testBuild1021StorageStatesAndZeroWrites},
  {name:'Row-read outage classification',run:testBuild1021RowReadFailure},
  {name:'Permission conjunction',run:testBuild1021PermissionConjunction},
  {name:'Safe advisory response contract',run:testBuild1021SafeResponseContract},
  {name:'Fresh inspection authority isolation',run:testBuild1021StaleQueueHasNoAuthority},
  {name:'No mutation ownership',run:testBuild1021NoMutationOwnership},
  {name:'Recovery queue UI safety',run:testBuild1021UiSafety}
],null);}

function testCompleteNavigation() {
  var routeKeys = Object.keys(JSKOS.RouteConfig.ROUTES);
  var results = routeKeys.map(function (routeKey) {
    var content = doGet({ parameter: { page: routeKey } }).getContent();
    var nav = content.match(
      /<nav class="navigation"[^>]*>[\s\S]*?<\/nav>/i
    );
    if (!nav) throw new Error('Canonical navigation missing: ' + routeKey);
    var missing = routeKeys.filter(function (expectedKey) {
      return nav[0].indexOf('page=' + expectedKey) === -1;
    });
    if (missing.length) {
      throw new Error(
        routeKey + ' navigation missing: ' + missing.join(', ')
      );
    }
    return { route: routeKey, links: routeKeys.length };
  });
  return { success: true, routesChecked: results.length, results: results };
}

function testJSKOSStableReleaseReadiness() {
  var suites = [
    { name: 'Core configuration', run: testJskOsCoreConfig },
    { name: 'Core framework', run: testCoreFramework },
    { name: 'Core UI integration', run: testCoreUiIntegration },
    { name: 'Release operations plan', run: testReleaseOperationsPlan },
    { name: 'Build 1002', run: testBuild1002ReleaseCandidate },
    { name: 'Build 1003', run: testBuild1003ReleaseCandidate },
    { name: 'Build 1004', run: testBuild1004ReleaseCandidate },
    { name: 'Build 1005', run: testBuild1005ReleaseCandidate },
    { name: 'Build 1006', run: testBuild1006ReleaseCandidate },
    { name: 'Build 1007', run: testBuild1007ReleaseCandidate },
    { name: 'Build 1008', run: testBuild1008ReleaseCandidate },
    { name: 'Build 1009', run: testBuild1009ReleaseCandidate },
    { name: 'Build 1010', run: testBuild1010ReleaseCandidate },
    { name: 'Build 1011', run: testBuild1011ReleaseCandidate },
    { name: 'Build 1012', run: testBuild1012ReleaseCandidate },
    { name: 'Build 1013', run: testBuild1013ReleaseCandidate },
    { name: 'Client 360 v0.1', run: testClient360V01ReleaseCandidate },
    { name: 'Build 1014', run: testBuild1014ReleaseCandidate },
    { name: 'Build 1015', run: testBuild1015ReleaseCandidate },
    { name: 'Build 1016', run: testBuild1016ReleaseCandidate },
    { name: 'Build 1017', run: testBuild1017ReleaseCandidate },
    { name: 'Build 1018', run: testBuild1018ReleaseCandidate },
    { name: 'Build 1019', run: testBuild1019ReleaseCandidate },
    { name: 'Build 1020', run: testBuild1020ReleaseCandidate },
    { name: 'Build 1021', run: testBuild1021ReleaseCandidate },
    { name: 'All web routes', run: testAllWebRoutes }
  ];
  var report = runJSKOSReleaseSuite_('STABLE', suites, null);
  var triggers = auditAutomationTriggers();
  report.triggerAudit = triggers;
  report.readyForStableDeployment = report.success && triggers.success;
  console.info(JSON.stringify(report));
  return report;
}
