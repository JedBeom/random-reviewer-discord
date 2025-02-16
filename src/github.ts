import * as core from "@actions/core";
import { context as githubContext } from "@actions/github";
import { Octokit } from "@octokit/action";
import type { PullRequest } from "@octokit/webhooks-types";

import type {
  ActivityType,
  ActionEvent,
  ActionEventName,
  Username,
  RouterContext,
  ScheduleEvent,
  TemplateKey,
  Option,
} from "@/types";
import { DiscordWebhookClient } from "@/discord";

/* istanbul ignore next */
function createScheduleEvent(): ScheduleEvent {
  return {
    action: "",
    repo: githubContext.repo,
    actor: githubContext.actor,
  };
}

/* istanbul ignore next */
export function getActionEvent(): ActionEvent {
  const name = githubContext.eventName as ActionEventName;
  let payload = githubContext.payload;
  if (name === "schedule") {
    payload = createScheduleEvent();
  }
  let activityType = "";
  if (githubContext.payload.action !== undefined) {
    activityType = githubContext.payload.action;
  }

  return {
    name: githubContext.eventName as ActionEventName,
    activityType: activityType as ActivityType,
    payload,
  };
}

/* istanbul ignore next */
export function initContext(): RouterContext {
  const event = getActionEvent();

  const usernames = parseUsernames(core.getMultilineInput("usernames"));

  if (usernames.length === 0) {
    throw new Error("No candidates. Stop running.");
  }

  const webhookURLInput = core.getInput("webhook_url");
  const webhookURL = new URL(webhookURLInput);
  const webhookClient = new DiscordWebhookClient(webhookURL);

  const octokit = new Octokit();

  const option: Option = {
    schedulePrsMinAge: Number(core.getInput("schedule_prs_min_age")),
    showDiscordLinkPreview: core.getBooleanInput("show_discord_link_preview"),
    notifyReviewRequestedOnClosed: core.getBooleanInput(
      "notify_review_requested_on_closed",
    ),
    notifyReviewRequestedOnDraft: core.getBooleanInput(
      "notify_review_requested_on_draft",
    ),
  };

  return {
    event,
    usernames,
    webhookClient,
    octokit,
    option,
  };
}

/* istanbul ignore next */
export function isReadyToReview(pr: PullRequest): boolean {
  return !pr.draft;
}

/* istanbul ignore next */
export async function getRequestedReviewers(
  octokit: Octokit,
  pr: PullRequest,
): Promise<string[]> {
  const { data } = await octokit.rest.pulls.listRequestedReviewers({
    owner: pr.base.repo.owner.login,
    repo: pr.base.repo.name,
    pull_number: pr.number,
  });

  // TODO: support teams
  return data.users.map((user) => user.login.toLowerCase());
}

/* istanbul ignore next */
export async function getPreviousReviewers(
  octokit: Octokit,
  pr: PullRequest,
): Promise<string[]> {
  const { data: reviews } = await octokit.rest.pulls.listReviews({
    owner: pr.base.repo.owner.login,
    repo: pr.base.repo.name,
    pull_number: pr.number,
  });

  return reviews
    .filter((review) => !!review.user)
    .map((review) => review.user!.login.toLowerCase());
}

export function chooseReviewer(
  usernames: Username[],
  exclude: string[],
): Username {
  // get candidates and exclude the creator
  const candidates = usernames.filter(
    (username) => !exclude.includes(username.github),
  );

  if (candidates.length === 0) {
    throw new Error("No candidates after excluding the creator.");
  }

  // randomly select the reviewer from candidates
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export function parseUsernames(input: string[]): Username[] {
  // format
  // githubUsername1:discordUsername1
  // githubUsername2:discordUsername2
  // #githubUsername3:discordUsername3 <-- ignored
  // ...
  const candidates = input
    .filter((line) => !line.startsWith("#"))
    .map((val) => {
      const pair = val
        .split(":")
        .map((username) => username.trim().toLowerCase());

      return {
        github: pair[0],
        discord: pair[1],
      } as Username;
    });

  return candidates;
}

/* istanbul ignore next */
export async function assignReviewer(pr: PullRequest, reviewer: Username) {
  const octokit = new Octokit();

  await octokit.rest.issues.addAssignees({
    owner: pr.base.repo.owner.login,
    repo: pr.base.repo.name,
    assignees: [reviewer.github],
    issue_number: pr.number,
  });

  return octokit.rest.pulls.requestReviewers({
    owner: pr.base.repo.owner.login,
    repo: pr.base.repo.name,
    pull_number: pr.number,
    reviewers: [reviewer.github],
  });
}

/* istanbul ignore next */
export async function listPRs(owner: string, repo: string) {
  const octokit = new Octokit();

  const { data: pulls } = await octokit.rest.pulls.list({
    owner,
    repo,
    state: "open",
    sort: "popularity",
    direction: "asc",
    per_page: 15, // TODO: get from input
  });

  return pulls as PullRequest[];
}

export function groupReviewers(
  pulls: PullRequest[],
  minAge: number,
): Record<string, PullRequest[]> {
  const now = new Date();
  const group = {} as Record<string, PullRequest[]>;
  for (const pull of pulls) {
    if (pull.draft) {
      continue;
    }

    const createdAt = new Date(pull.created_at);
    const diffHours = (now.getTime() - createdAt.getTime()) / 1000 / 60 / 60;
    if (diffHours < minAge) {
      continue;
    }

    for (const reviewer of pull.requested_reviewers) {
      if (!("login" in reviewer)) {
        // TODO: suppor teams
        continue;
      }
      if (group[reviewer.login] === undefined) {
        group[reviewer.login.toLowerCase()] = [];
      }

      group[reviewer.login.toLowerCase()].push(pull);
    }
  }

  return group;
}

/* istanbul ignore next */
export function getTemplate(key: TemplateKey) {
  return core
    .getMultilineInput("template_" + key, { required: true })
    .join("\n");
}
