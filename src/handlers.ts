import * as core from "@actions/core";
import type {
  PullRequestEvent,
  PullRequestOpenedEvent,
  PullRequestReadyForReviewEvent,
  PullRequestReviewRequestedEvent,
} from "@octokit/webhooks-types";

import type {
  RouterContext,
  ScheduleEvent,
  Username,
  TemplateKey,
} from "@/types";
import {
  isReadyToReview,
  getRequestedReviewers,
  groupReviewers,
  listPRs,
  assignReviewer,
  chooseReviewer,
  getTemplate,
} from "@/github";
import { idToMention, notifyReviewer } from "@/discord";

export async function fallbackHandler(c: RouterContext) {
  core.setFailed(
    `The event ${c.event.name}.${c.event.activityType} is not supported.`,
  );
  core.setFailed(
    `Edit the yaml file and make sure to specify the supported types only.`,
  );
}

export async function handleOpened(c: RouterContext) {
  const pr = (c.event.payload! as PullRequestOpenedEvent).pull_request;

  if (!isReadyToReview(pr)) {
    core.info("This pr is draft. No-op.");
    return;
  }

  const requestedReviewers = await getRequestedReviewers(c.octokit, pr);
  if (requestedReviewers.length > 0) {
    core.info(
      `This pr has the reviewers: ${requestedReviewers.join(", ")}. Stop running.`,
    );
    return;
  }

  return assignAndNotify(c, "opened");
}

export async function handleReopenOrReadyForReview(c: RouterContext) {
  const pr = (c.event.payload! as PullRequestReadyForReviewEvent).pull_request;
  const isReopened = c.event.activityType === "reopened";

  if (!isReadyToReview(pr)) {
    core.info("This pr is draft. No-op.");
    return;
  }

  // Requested Reviewers do stay in place
  // despite being drafted and being set ready for review
  const requestedReviewers = await getRequestedReviewers(c.octokit, pr);
  if (requestedReviewers.length === 0) {
    core.info(`No requested reviewers. Start assigning a new reviewer.`);
    return assignAndNotify(
      c,
      isReopened ? "reopened_assigned" : "ready_for_review_assigned",
    );
  }

  if (requestedReviewers.length === 1) {
    core.info(`This pr has the reviewer: ${requestedReviewers[0]}.`);
    const reviewer = c.usernames.find(
      ({ github }) => github === requestedReviewers[0],
    );

    if (reviewer === undefined) {
      core.setFailed(
        `Can't find ${requestedReviewers[0]} from the candidates.`,
      );
      return;
    }

    const tmpl = getTemplate(
      isReopened ? "reopened_exist_one" : "ready_for_review_exist_one",
    );
    await notifyReviewer(c.webhookClient, tmpl, reviewer, pr);
    core.info(`Notified @${reviewer.github} on Discord.`);
  }

  core.info(`This pr has the reviewer(s): ${requestedReviewers.join(", ")}.`);
  core.info(`Start notifying them.`);
  const reviewers = c.usernames.filter(({ github }) =>
    requestedReviewers.includes(github),
  );

  const tmpl = getTemplate(
    isReopened ? "reopened_exist_plural" : "ready_for_review_exist_plural",
  );

  await notifyReviewer(c.webhookClient, tmpl, reviewers, pr);
  core.info("Notified them on Discord.");
}

export async function handleReviewRequested(c: RouterContext) {
  const pr = (c.event.payload! as PullRequestReviewRequestedEvent).pull_request;

  if (pr.requested_reviewers.length === 0) {
    return core.error(
      "No requested reviewers although the event is review_requested.",
    );
  }

  // TODO: support teams as reviewers
  const requestedReviewers = pr.requested_reviewers
    .filter((reviewer) => "login" in reviewer)
    .map((user) => user.login);

  if (requestedReviewers.length > 1) {
    core.info("This pr has multiple reviewers.");
    const reviewers: Username[] = c.usernames.filter(({ github }) =>
      requestedReviewers.includes(github),
    );

    const tmpl = getTemplate("review_requested_plural");
    await notifyReviewer(c.webhookClient, tmpl, reviewers, pr);
    return core.info("Notified them on Discord.");
  }

  const reviewer = c.usernames.find(
    ({ github }) => github === requestedReviewers[0],
  );
  if (reviewer === undefined) {
    return core.setFailed(
      `Can't find ${requestedReviewers[0]} among the candidates.`,
    );
  }

  const tmpl = getTemplate("review_requested_one");
  await notifyReviewer(c.webhookClient, tmpl, reviewer, pr);
  return core.info(`Notified @${reviewer.github} on Discord.`);
}

export async function handleSchedule(c: RouterContext) {
  const repo = (c.event.payload as ScheduleEvent).repo;
  const prs = await listPRs(repo.owner, repo.repo);
  core.info(`Found ${prs.length} prs matching the condition.`);

  const minAge = Number(
    core.getInput("remind_prs_min_age", { required: true }),
  );
  core.info(`Exclude prs not old more than ${minAge}`);
  const grouped = groupReviewers(prs, minAge);
  const reviewerGithubs = Object.keys(grouped);
  core.info(`${reviewerGithubs.length} reviewer(s) will be notified.`);

  const reviewers = c.usernames.filter(({ github }) =>
    reviewerGithubs.includes(github),
  );

  if (reviewers.length !== reviewerGithubs.length) {
    core.warning(
      `Expected ${reviewerGithubs.length} usernames, but got ${reviewers.length}.`,
    );
  }

  const lines: string[] = [];
  for (const reviewer of reviewers) {
    lines.push(
      "- " +
        idToMention(reviewer.discord) +
        grouped[reviewer.github]
          .map((pr) => `[${pr.title} #${pr.number}](${pr.html_url})`)
          .join(", "),
    );
  }

  const msg = getTemplate("schedule");

  await c.webhookClient.postMessage(msg + "\n\n" + lines.join("\n"));
  core.info("Notified them on Discord.");
}

export async function assignAndNotify(c: RouterContext, tmplKey: TemplateKey) {
  const event = c.event.payload! as PullRequestEvent;

  const creator = event.sender.login.toLowerCase();
  const reviewer = chooseReviewer(c.usernames, [creator]);
  core.info(`The user @${reviewer.github} is picked.`);

  await assignReviewer(event.pull_request, reviewer);
  core.info(`Assigned @${reviewer.github} as the reviewer.`);

  const tmpl = getTemplate(tmplKey);
  core.info(`Use the template ${tmplKey}: """${tmpl}"""`);

  await notifyReviewer(c.webhookClient, tmpl, reviewer, event.pull_request);
  return core.info(`Notified @${reviewer.github} on Discord.`);
}
