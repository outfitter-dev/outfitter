/**
 * Shared types for status gatherers
 */

/** Possible states for a gatherer operation. */
export type GathererStatus = "success" | "unavailable" | "error";

/**
 * Result returned by a status gatherer.
 * @typeParam T - Type of gathered data
 */
export interface GathererResult<T = unknown> {
  /** Gathered data (present when success) */
  data?: T;
  /** Error message (present when error) */
  error?: string;
  /** Unavailability reason (present when unavailable) */
  reason?: string;
  /** Source identifier */
  source: string;
  /** Operation status */
  status: GathererStatus;
  /** ISO timestamp of when data was gathered */
  timestamp: string;
}

/**
 * Issue from Beads local issue tracking.
 */
export interface BeadsIssue {
  assignee?: string;
  closed_at?: string;
  created_at: string;
  dependency_count: number;
  dependent_count: number;
  description?: string;
  id: string;
  issue_type: "bug" | "feature" | "task" | "epic" | "chore";
  labels: string[];
  priority: 0 | 1 | 2 | 3 | 4;
  status: "open" | "in_progress" | "blocked" | "closed";
  title: string;
  updated_at: string;
}

/**
 * Aggregated statistics for Beads issues.
 */
export interface BeadsStats {
  average_lead_time?: number;
  blocked: number;
  closed: number;
  in_progress: number;
  open: number;
  ready: number;
  total: number;
}

/**
 * Data gathered from Beads issue tracker.
 */
export interface BeadsData {
  blocked: BeadsIssue[];
  inProgress: BeadsIssue[];
  ready: BeadsIssue[];
  recentlyClosed: BeadsIssue[];
  stats: BeadsStats;
}

/**
 * Pull request from GitHub.
 */
export interface GitHubPR {
  author: { login: string };
  headRefName: string;
  isDraft: boolean;
  number: number;
  reviewDecision?: "APPROVED" | "CHANGES_REQUESTED" | "REVIEW_REQUIRED" | null;
  state: "OPEN" | "CLOSED" | "MERGED";
  statusCheckRollup?: {
    state: "SUCCESS" | "FAILURE" | "PENDING" | "EXPECTED";
    contexts?: Array<{
      name: string;
      state: string;
      conclusion?: string;
    }>;
  };
  title: string;
  updatedAt: string;
  url: string;
}

/**
 * GitHub Actions workflow run.
 */
export interface GitHubWorkflowRun {
  conclusion: string | null;
  createdAt: string;
  name: string;
  status: string;
  url: string;
}

/**
 * Data gathered from GitHub.
 */
export interface GitHubData {
  openPRs: GitHubPR[];
  recentRuns: GitHubWorkflowRun[];
  repo: string;
}

/**
 * Branch in a Graphite stack.
 */
export interface GraphiteBranch {
  children: string[];
  commitCount: number;
  isCurrent: boolean;
  name: string;
  needsRestack: boolean;
  needsSubmit: boolean;
  parent?: string;
  prNumber?: number;
  prStatus?: "draft" | "open" | "ready" | "merged" | "closed";
  prUrl?: string;
}

/**
 * Data gathered from Graphite.
 */
export interface GraphiteData {
  branches: GraphiteBranch[];
  currentBranch: string;
  stacks: string[][]; // Each stack as array of branch names
  trunk: string;
}

/**
 * Issue from Linear.
 */
export interface LinearIssue {
  assignee?: { name: string };
  createdAt: string;
  identifier: string;
  labels: Array<{ name: string }>;
  priority: number;
  state: {
    name: string;
    type: string;
  };
  title: string;
  updatedAt: string;
  url: string;
}

/**
 * Data gathered from Linear.
 */
export interface LinearData {
  issues: LinearIssue[];
  team?: string;
}

/**
 * Aggregated status report result.
 */
export interface SitrepResult {
  results: {
    graphite?: GathererResult<GraphiteData>;
    github?: GathererResult<GitHubData>;
    linear?: GathererResult<LinearData>;
    beads?: GathererResult<BeadsData>;
  };
  sources: string[];
  timeConstraint: string;
  timestamp: string;
}
