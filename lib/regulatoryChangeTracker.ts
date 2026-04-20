/**
 * regulatoryChangeTracker.ts
 * Tracks regulatory changes and compliance gaps for BJJ App.
 * Covers GDPR, CCPA/CPRA, COPPA, CAN-SPAM, APPI, LGPD, ePrivacy, PCI DSS.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A regulation the app must comply with */
export interface Regulation {
  readonly id: string;
  readonly name: string;
  readonly jurisdiction: string;
  readonly lastUpdated: string;
  readonly version: string;
  readonly keyRequirements: string[];
}

/** A change to an existing regulation */
export interface RegulatoryChange {
  readonly regulationId: string;
  readonly description: string;
  readonly effectiveDate: string;
  readonly publishedDate: string;
  readonly affectedRequirements: string[];
  readonly sourceUrl: string;
}

/** A gap between a requirement and current implementation */
export interface ComplianceGap {
  readonly regulationId: string;
  readonly requirement: string;
  readonly currentState: string;
  readonly severity: 'critical' | 'high' | 'medium' | 'low';
  readonly remediation: string;
}

/** Impact assessment for a regulatory change */
export interface ImpactAssessment {
  readonly regulationId: string;
  readonly severity: 'critical' | 'high' | 'medium' | 'low';
  readonly affectedFeatures: string[];
  readonly deadline: string;
  readonly estimatedEffortDays: number;
  readonly description: string;
}

/** A gap with priority score for ordering */
export interface PrioritizedGap extends ComplianceGap {
  readonly priorityScore: number;
  readonly daysUntilDeadline: number | null;
}

/** A concrete action to close a compliance gap */
export interface ActionItem {
  readonly id: string;
  readonly gap: ComplianceGap;
  readonly action: string;
  readonly owner: string;
  readonly deadline: string;
  readonly status: 'pending' | 'in_progress' | 'completed';
}

/** Current implementation state for compliance checking */
export interface ComplianceState {
  readonly implementedRequirements: string[];
  readonly partialRequirements: string[];
  readonly featureList: string[];
}

/** Program-wide regulatory compliance report */
export interface RegulatoryReport {
  readonly generatedAt: string;
  readonly overallCompliancePercent: number;
  readonly byRegulation: Array<{
    regulation: Regulation;
    compliancePercent: number;
    gapCount: number;
    criticalGaps: number;
  }>;
  readonly totalGaps: number;
  readonly criticalGaps: number;
  readonly upcomingDeadlines: Array<{ regulationId: string; deadline: string; description: string }>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Regulations tracked by the app */
export const TRACKED_REGULATIONS: Regulation[] = [
  { id: 'GDPR', name: 'General Data Protection Regulation', jurisdiction: 'EU/EEA', lastUpdated: '2024-01-01', version: '2016/679', keyRequirements: ['consent_management', 'data_portability', 'right_to_erasure', 'dpo_appointment', 'breach_notification_72h', 'privacy_by_design', 'data_processing_records'] },
  { id: 'CCPA_CPRA', name: 'California Consumer Privacy Act / CPRA', jurisdiction: 'California, US', lastUpdated: '2023-01-01', version: 'CPRA 2023', keyRequirements: ['opt_out_sale', 'data_access_request', 'data_deletion', 'non_discrimination', 'sensitive_data_consent', 'data_minimization'] },
  { id: 'COPPA', name: "Children's Online Privacy Protection Act", jurisdiction: 'US', lastUpdated: '2013-07-01', version: '16 CFR 312', keyRequirements: ['parental_consent_under_13', 'age_gate', 'data_minimization_children', 'parental_access_delete'] },
  { id: 'CAN_SPAM', name: 'CAN-SPAM Act', jurisdiction: 'US', lastUpdated: '2008-05-01', version: '15 USC 7701', keyRequirements: ['unsubscribe_mechanism', 'valid_sender_address', 'no_deceptive_headers', 'commercial_identification'] },
  { id: 'APPI', name: 'Act on Protection of Personal Information', jurisdiction: 'Japan', lastUpdated: '2022-04-01', version: 'Amended 2022', keyRequirements: ['purpose_specification', 'consent_for_transfer', 'cross_border_transfer_rules', 'breach_notification', 'individual_rights'] },
  { id: 'LGPD', name: 'Lei Geral de Protecao de Dados', jurisdiction: 'Brazil', lastUpdated: '2020-09-18', version: 'Lei 13.709', keyRequirements: ['legal_basis_processing', 'data_subject_rights', 'dpo_appointment', 'international_transfer_rules', 'breach_notification'] },
  { id: 'ePrivacy', name: 'ePrivacy Directive', jurisdiction: 'EU/EEA', lastUpdated: '2009-11-25', version: '2002/58/EC amended', keyRequirements: ['cookie_consent', 'communication_confidentiality', 'traffic_data_rules', 'location_data_consent'] },
  { id: 'PCI_DSS', name: 'Payment Card Industry Data Security Standard', jurisdiction: 'Global', lastUpdated: '2024-03-31', version: 'v4.0.1', keyRequirements: ['no_raw_card_storage', 'encryption_in_transit', 'access_control', 'vulnerability_management', 'logging_monitoring', 'incident_response_plan'] },
];

const SEVERITY_WEIGHTS: Record<string, number> = { critical: 100, high: 70, medium: 40, low: 10 };

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check compliance of a regulation against current implementation state.
 * Returns a list of gaps where requirements are not fully met.
 */
export function checkCompliance(
  regulation: Regulation,
  currentState: ComplianceState,
): ComplianceGap[] {
  const gaps: ComplianceGap[] = [];

  for (const req of regulation.keyRequirements) {
    if (currentState.implementedRequirements.includes(req)) {
      continue;
    }
    const isPartial = currentState.partialRequirements.includes(req);
    gaps.push({
      regulationId: regulation.id,
      requirement: req,
      currentState: isPartial ? 'partial' : 'missing',
      severity: isPartial ? 'medium' : 'high',
      remediation: isPartial
        ? `Complete implementation of ${req} for ${regulation.id}`
        : `Implement ${req} as required by ${regulation.id}`,
    });
  }
  return gaps;
}

/**
 * Assess the impact of a regulatory change on the application.
 */
export function assessImpact(change: RegulatoryChange): ImpactAssessment {
  const affectedCount = change.affectedRequirements.length;
  const severity: ImpactAssessment['severity'] =
    affectedCount >= 4 ? 'critical' : affectedCount >= 2 ? 'high' : affectedCount >= 1 ? 'medium' : 'low';

  const featureMap: Record<string, string[]> = {
    consent_management: ['settings', 'onboarding', 'cookie_banner'],
    data_portability: ['data_export', 'settings'],
    right_to_erasure: ['account_deletion', 'settings'],
    breach_notification_72h: ['incident_response', 'admin_dashboard'],
    cookie_consent: ['cookie_banner', 'analytics'],
    opt_out_sale: ['settings', 'privacy_center'],
    unsubscribe_mechanism: ['email_system', 'notification_preferences'],
  };

  const affectedFeatures = new Set<string>();
  for (const req of change.affectedRequirements) {
    for (const feature of featureMap[req] ?? ['general']) {
      affectedFeatures.add(feature);
    }
  }

  return {
    regulationId: change.regulationId,
    severity,
    affectedFeatures: [...affectedFeatures],
    deadline: change.effectiveDate,
    estimatedEffortDays: affectedCount * 3,
    description: change.description,
  };
}

/**
 * Prioritize compliance gaps by deadline proximity, severity, and user impact.
 */
export function prioritizeGaps(
  gaps: ComplianceGap[],
  deadlines?: Map<string, string>,
): PrioritizedGap[] {
  const now = Date.now();
  return gaps
    .map((gap) => {
      const deadlineStr = deadlines?.get(gap.regulationId) ?? null;
      const daysUntilDeadline = deadlineStr
        ? Math.ceil((new Date(deadlineStr).getTime() - now) / (1000 * 60 * 60 * 24))
        : null;
      const deadlineUrgency = daysUntilDeadline !== null ? Math.max(0, 100 - daysUntilDeadline) : 0;
      const severityScore = SEVERITY_WEIGHTS[gap.severity] ?? 0;
      const priorityScore = severityScore + deadlineUrgency;
      return { ...gap, priorityScore, daysUntilDeadline };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore);
}

/**
 * Generate concrete action items to close each compliance gap.
 */
export function generateActionPlan(gaps: ComplianceGap[]): ActionItem[] {
  return gaps.map((gap, i) => ({
    id: `ACT-${String(i + 1).padStart(3, '0')}`,
    gap,
    action: gap.remediation,
    owner: 'unassigned',
    deadline: '',
    status: 'pending',
  }));
}

/**
 * Build a dashboard-style report across all tracked regulations.
 */
export function buildRegulatoryDashboard(
  regulations: Regulation[],
  state: ComplianceState,
  upcomingChanges?: RegulatoryChange[],
): RegulatoryReport {
  let totalReqs = 0;
  let totalMet = 0;
  let totalGaps = 0;
  let criticalGaps = 0;

  const byRegulation = regulations.map((reg) => {
    const gaps = checkCompliance(reg, state);
    const met = reg.keyRequirements.length - gaps.length;
    const compliancePercent = reg.keyRequirements.length > 0
      ? (met / reg.keyRequirements.length) * 100
      : 100;
    const critical = gaps.filter((g) => g.severity === 'critical').length;
    totalReqs += reg.keyRequirements.length;
    totalMet += met;
    totalGaps += gaps.length;
    criticalGaps += critical;
    return { regulation: reg, compliancePercent, gapCount: gaps.length, criticalGaps: critical };
  });

  const upcomingDeadlines = (upcomingChanges ?? []).map((c) => ({
    regulationId: c.regulationId,
    deadline: c.effectiveDate,
    description: c.description,
  }));

  return {
    generatedAt: new Date().toISOString(),
    overallCompliancePercent: totalReqs > 0 ? (totalMet / totalReqs) * 100 : 100,
    byRegulation,
    totalGaps,
    criticalGaps,
    upcomingDeadlines,
  };
}

/**
 * Check whether a regulatory change deadline is approaching within the given threshold.
 */
export function isDeadlineApproaching(change: RegulatoryChange, daysThreshold: number): boolean {
  const deadline = new Date(change.effectiveDate).getTime();
  const now = Date.now();
  const diffDays = (deadline - now) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= daysThreshold;
}

/**
 * Format a regulatory report as a human-readable string.
 */
export function formatRegulatoryReport(report: RegulatoryReport): string {
  const lines: string[] = [
    '=== Regulatory Compliance Report ===',
    `Generated: ${report.generatedAt}`,
    `Overall compliance: ${report.overallCompliancePercent.toFixed(1)}%`,
    `Total gaps: ${report.totalGaps} (${report.criticalGaps} critical)`,
    '',
    '--- By Regulation ---',
  ];
  for (const entry of report.byRegulation) {
    const marker = entry.criticalGaps > 0 ? ' [!]' : '';
    lines.push(
      `  ${entry.regulation.id}: ${entry.compliancePercent.toFixed(0)}% compliant, ${entry.gapCount} gaps${marker}`,
    );
  }
  if (report.upcomingDeadlines.length > 0) {
    lines.push('', '--- Upcoming Deadlines ---');
    for (const d of report.upcomingDeadlines) {
      lines.push(`  ${d.regulationId} by ${d.deadline}: ${d.description}`);
    }
  }
  return lines.join('\n');
}
