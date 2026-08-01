/**
 * JSK OS Build 1002 - GARUDA Renewal Intelligence.
 * Explainable deterministic scoring, ready for a future ML/API adapter.
 */

var JSKOS = JSKOS || {};

JSKOS.GarudaRenewalIntelligence = (function () {
  'use strict';

  function analyzePolicies(policies, referenceDate, limit) {
    var today = startOfDay_(referenceDate || new Date());
    var eligible = { issued: true, active: true, 'renewal due': true };
    var insights = (Array.isArray(policies) ? policies : []).reduce(
      function (items, policy) {
        var status = normalize_(policy && policy.policyStatus);
        var stage = normalize_(policy && policy.renewalStage);
        var renewalDate = startOfDay_(policy && policy.renewalDate);

        if (!eligible[status] || !renewalDate || stage === 'won' || stage === 'lost') {
          return items;
        }

        items.push(scorePolicy_(policy, today, renewalDate, stage));
        return items;
      },
      []
    );

    insights.sort(function (left, right) {
      if (right.priorityScore !== left.priorityScore) {
        return right.priorityScore - left.priorityScore;
      }
      return left.daysUntilRenewal - right.daysUntilRenewal;
    });

    return insights.slice(0, Math.max(1, Number(limit) || 5));
  }

  function scorePolicy_(policy, today, renewalDate, stage) {
    var days = daysBetween_(today, renewalDate);
    var risk = normalize_(policy.riskCategory);
    var premium = Math.max(0, Number(policy.totalPremium) || 0);
    var claims = Math.max(0, Number(policy.claimsCount) || 0);
    var score = urgencyPoints_(days) + riskPoints_(risk) +
      premiumPoints_(premium) + claimsPoints_(claims) + stagePriorityPoints_(stage);
    score = clamp_(score, 0, 100);

    var successScore = successScore_(days, risk, claims, stage);
    return {
      policyId: String(policy.policyId || ''),
      policyNumber: String(policy.policyNumber || policy.policyId || 'Unnumbered'),
      insuredName: String(policy.insuredName || 'Unknown Client'),
      renewalDate: renewalDate.toISOString(),
      daysUntilRenewal: days,
      priorityScore: score,
      priority: score >= 70 ? 'Critical' : score >= 45 ? 'High' : score >= 25 ? 'Medium' : 'Low',
      successProbability: successScore,
      successPrediction: successScore >= 70 ? 'High' : successScore >= 45 ? 'Medium' : 'Low',
      suggestedFollowUp: suggestedFollowUp_(days, stage),
      riskAlert: riskAlert_(days, risk, claims, premium),
      renewalStage: policy.renewalStage || 'Call Pending'
    };
  }

  function urgencyPoints_(days) {
    if (days < 0) return 40;
    if (days <= 7) return 35;
    if (days <= 30) return 25;
    if (days <= 60) return 15;
    if (days <= 90) return 8;
    return 0;
  }

  function riskPoints_(risk) {
    return ({ critical: 25, high: 18, medium: 10, low: 3 })[risk] || 5;
  }

  function premiumPoints_(premium) {
    if (premium >= 100000) return 15;
    if (premium >= 50000) return 10;
    if (premium >= 10000) return 5;
    return 2;
  }

  function claimsPoints_(claims) {
    if (claims >= 3) return 15;
    if (claims >= 1) return 7;
    return 0;
  }

  function stagePriorityPoints_(stage) {
    return ({ negotiation: 10, 'quote sent': 6, 'whatsapp sent': 3 })[stage] || 0;
  }

  function successScore_(days, risk, claims, stage) {
    var score = 55;
    score += ({ negotiation: 25, 'quote sent': 15, 'whatsapp sent': 8, 'call pending': -5 })[stage] || -5;
    if (days < 0) score -= 20;
    else if (days <= 7) score -= 5;
    if (risk === 'critical') score -= 20;
    else if (risk === 'high') score -= 10;
    if (claims >= 3) score -= 15;
    else if (claims >= 1) score -= 5;
    return clamp_(score, 5, 95);
  }

  function suggestedFollowUp_(days, stage) {
    if (days < 0) return 'Call today and escalate overdue renewal';
    if (stage === 'negotiation') return 'Review objections and close within 24 hours';
    if (stage === 'quote sent') return 'Confirm quote receipt and schedule decision call';
    if (stage === 'whatsapp sent') return 'Call client and qualify renewal intent';
    if (days <= 7) return 'Call today and prepare renewal quote';
    if (days <= 30) return 'Contact within 48 hours';
    return 'Schedule first renewal call this week';
  }

  function riskAlert_(days, risk, claims, premium) {
    var alerts = [];
    if (days < 0) alerts.push('Overdue');
    if (risk === 'critical' || risk === 'high') alerts.push('High client risk');
    if (claims >= 3) alerts.push('High claims frequency');
    if (premium >= 100000) alerts.push('High-value premium');
    return alerts.length ? alerts.join(' · ') : 'No immediate risk alert';
  }

  function normalize_(value) {
    return String(value || '').trim().toLowerCase();
  }

  function startOfDay_(value) {
    if (value === null || value === undefined || String(value).trim() === '') return null;
    var date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
    if (isNaN(date.getTime())) return null;
    date.setHours(0, 0, 0, 0);
    return date;
  }

  function daysBetween_(fromDate, toDate) {
    return Math.round((toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000));
  }

  function clamp_(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, Math.round(value)));
  }

  return { analyzePolicies: analyzePolicies };
})();
