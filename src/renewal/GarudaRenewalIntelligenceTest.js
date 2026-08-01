/** JSK OS Build 1002 GARUDA intelligence tests. */

function testGarudaRenewalIntelligence() {
  var insights = JSKOS.GarudaRenewalIntelligence.analyzePolicies([
    {
      policyId: 'CRITICAL', policyNumber: 'P-1', insuredName: 'Critical Client',
      policyStatus: 'Active', renewalDate: new Date(2026, 6, 25),
      renewalStage: 'Negotiation', riskCategory: 'Critical',
      totalPremium: 150000, claimsCount: 4
    },
    {
      policyId: 'NORMAL', policyNumber: 'P-2', insuredName: 'Normal Client',
      policyStatus: 'Active', renewalDate: new Date(2026, 9, 1),
      riskCategory: 'Low', totalPremium: 5000, claimsCount: 0
    },
    { policyId: 'WON', policyStatus: 'Active', renewalDate: new Date(2026, 7, 2), renewalStage: 'Won' }
  ], new Date(2026, 7, 1), 5);

  if (insights.length !== 2) throw new Error('GARUDA eligibility failed.');
  if (insights[0].policyId !== 'CRITICAL') throw new Error('GARUDA priority sorting failed.');
  if (insights[0].priorityScore !== 100) throw new Error('GARUDA score cap failed.');
  if (insights[0].successPrediction !== 'Low') throw new Error('GARUDA prediction failed.');
  return { success: true, topInsight: insights[0] };
}
