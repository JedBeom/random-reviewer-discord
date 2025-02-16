import type { WebhookPayload } from "@actions/github/lib/interfaces.d.ts";
import type { Octokit } from "@octokit/action";
import type {
  PullRequestEvent,
  PullRequestReviewEvent,
} from "@octokit/webhooks-types";
import type { DiscordWebhookClient } from "@/discord";

export type Username = {
  github: string;
  discord: string;
};

export type TemplateData = {
  mention: string;
  prTitle: string;
  prNumber: string;
  prURL: string;
};

// https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows
// Array.from(document.querySelectorAll("a.heading-link code").entries()).map(([_, code]) => `"${code.innerHTML}"`).join(" | ")
export type ActionEventName =
  | "branch_protection_rule"
  | "check_run"
  | "check_suite"
  | "create"
  | "delete"
  | "deployment"
  | "deployment_status"
  | "discussion"
  | "discussion_comment"
  | "fork"
  | "gollum"
  | "issue_comment"
  | "issue_comment"
  | "issues"
  | "label"
  | "merge_group"
  | "milestone"
  | "page_build"
  | "public"
  | "pull_request"
  | "pull_request"
  | "pull_request"
  | "pull_request"
  | "pull_request_comment"
  | "issue_comment"
  | "pull_request_review"
  | "pull_request_review_comment"
  | "pull_request_target"
  | "pull_request_target"
  | "pull_request_target"
  | "pull_request_target"
  | "push"
  | "registry_package"
  | "release"
  | "repository_dispatch"
  | "schedule"
  | "status"
  | "watch"
  | "workflow_call"
  | "workflow_dispatch"
  | "workflow_run";

export type PullRequestActivityType = PullRequestEvent["action"];
export type PullRequestReviewActivityType = PullRequestReviewEvent["action"];

export interface ScheduleEvent {
  action: "";
  repo: {
    owner: string;
    repo: string;
  };
  actor: string;
}

export type ActivityType =
  | PullRequestActivityType
  | PullRequestReviewActivityType
  | "";

export type ActionEvent = {
  name: ActionEventName;
  activityType: ActivityType;
  payload: WebhookPayload | ScheduleEvent;
};

export type Option = {
  schedulePrsMinAge: number;
  showDiscordLinkPreview: boolean;
};

export type RouterContext = {
  event: ActionEvent;
  usernames: Username[];
  webhookClient: DiscordWebhookClient;
  octokit: Octokit;
  option: Option;
};

export type TemplateKey =
  | "opened"
  | "reopened_assigned"
  | "reopened_exist_one"
  | "reopened_exist_plural"
  | "ready_for_review_assigned"
  | "ready_for_review_exist_one"
  | "ready_for_review_exist_plural"
  | "review_requested_one"
  | "review_requested_plural"
  | "converted_to_draft"
  | "review_request_removed"
  | "schedule"
  | "review_submitted";
