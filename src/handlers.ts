import * as core from "@actions/core";
import type {
  PullRequest,
  PullRequestEvent,
  PullRequestOpenedEvent,
  PullRequestReadyForReviewEvent,
  PullRequestReopenedEvent,
  PullRequestReviewRequestedEvent,
  PullRequestReviewSubmittedEvent,
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
  requestReviewer,
  chooseReviewer,
  getTemplate,
  getPreviousReviewers,
} from "@/github";
import { idToMention, notifyWithTemplate } from "@/discord";

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

  const tmpl = getTemplate("opened");
  return assignAndNotify(c, tmpl);
}

/// Look up three sets: requested reviewers, previous reviewers, and assignees.
/// If there are requested reviewers(>=1), then notify them.
/// If there are previous reviewers(>=1), choose one of them and notify them.
/// If there are assignees(>=1), choose one of them and notify them.
/// Else, assign on random and notify as handleOpened does.
export async function handleReopenOrReadyForReview(c: RouterContext) {
  const pr = (
    c.event.payload! as
      | PullRequestReopenedEvent
      | PullRequestReadyForReviewEvent
  ).pull_request;

  if (!isReadyToReview(pr)) {
    core.info("This pr is draft. No-op.");
    return;
  }

  const isReopened = c.event.activityType === "reopened";

  function tmplAssigned() {
    return getTemplate(
      isReopened ? "reopened_assigned" : "ready_for_review_assigned",
    );
  }

  function tmplExistOne() {
    return getTemplate(
      isReopened ? "reopened_exist_one" : "ready_for_review_exist_one",
    );
  }

  function tmplExistPlural() {
    return getTemplate(
      isReopened ? "reopened_exist_plural" : "ready_for_review_exist_plural",
    );
  }

  async function notifyOne(githubUsername: string) {
    const username = c.usernames.find(
      ({ github }) => github === githubUsername,
    );
    if (username === undefined) {
      return core.warning(`Can't find @${githubUsername} from usernames.`);
    }

    await notifyWithTemplate({
      client: c.webhookClient,
      template: tmplExistOne(),
      username,
      pr,
      showLinkPreview: c.option.showDiscordLinkPreview,
    });
    core.info(`Notified @${username.github} on Discord.`);
  }

  const requestedReviewers = await getRequestedReviewers(c.octokit, pr);
  if (requestedReviewers.length === 1) {
    return notifyOne(requestedReviewers[0]);
  }

  if (requestedReviewers.length > 1) {
    const usernames = c.usernames.filter(({ github }) =>
      requestedReviewers.includes(github),
    );

    await notifyWithTemplate({
      client: c.webhookClient,
      template: tmplExistPlural(),
      username: usernames,
      pr,
      showLinkPreview: c.option.showDiscordLinkPreview,
    });
    return;
  }

  const candidatesSets: [string, string[]][] = [
    ["previous reviewers", await getPreviousReviewers(c.octokit, pr)],
    ["assignees", pr.assignees.map((user) => user.login.toLowerCase())],
  ];
  for (const [setType, candidates] of candidatesSets) {
    core.info(`Find candidates among ${setType}.`);

    const candidatesWithoutAuthor = candidates.filter(
      (github) => github !== pr.user.login.toLowerCase(),
    );

    if (candidatesWithoutAuthor.length === 0) {
      core.info(`No ${setType} after excluding the author.`);
      continue;
    }

    if (candidatesWithoutAuthor.length === 1) {
      return notifyOne(candidatesWithoutAuthor[0]);
    }

    const usernames = c.usernames.filter(({ github }) =>
      candidatesWithoutAuthor.includes(github),
    );

    if (usernames.length === 0) {
      core.warning(`Can't find usernames of any ${setType}.`);
      continue;
    }

    let reviewer;
    try {
      reviewer = chooseReviewer(usernames, [pr.user.login.toLowerCase()]);
    } catch {
      core.info(`No ${setType} after excluding the author.`);
      continue;
    }
    core.info(`Selected @${reviewer.github} from ${setType}.`);

    await requestReviewer(pr, reviewer);
    core.info(`Requested @${reviewer.github} for a review.`);

    await notifyWithTemplate({
      client: c.webhookClient,
      template: tmplAssigned(),
      username: reviewer,
      pr,
      showLinkPreview: c.option.showDiscordLinkPreview,
    });
    core.info(`Notified @${reviewer.github} on Discord.`);
    return;
  }

  core.info(
    `No proper candidates among requestedReviewers, previousReviewers, and assignees.`,
  );
  core.info(`Start assigning on random.`);
  return assignAndNotify(c, tmplAssigned());
}

export async function handleReviewRequested(c: RouterContext) {
  const event = c.event.payload! as PullRequestReviewRequestedEvent;

  if (
    event.pull_request.state === "closed" &&
    !c.option.notifyReviewRequestedOnClosed
  ) {
    core.info(
      "This PR is closed and notify_review_requested_on_closed is false.",
    );
    return;
  }

  if (event.pull_request.draft && !c.option.notifyReviewRequestedOnDraft) {
    core.info(
      "This PR is draft and notify_review_requested_on_draft is false.",
    );
    return;
  }

  if (event.pull_request.requested_reviewers.length === 0) {
    return core.error(
      "No requested reviewers although the event is review_requested.",
    );
  }

  // TODO: support teams as reviewers
  const requestedReviewers = event.pull_request.requested_reviewers
    .filter((reviewer) => "login" in reviewer)
    .map((user) => user.login.toLowerCase());

  if (requestedReviewers.length > 1) {
    core.info("This pr has multiple reviewers.");
    const reviewers: Username[] = c.usernames.filter(({ github }) =>
      requestedReviewers.includes(github),
    );

    const tmpl = getTemplate("review_requested_plural");
    await notifyWithTemplate({
      client: c.webhookClient,
      template: tmpl,
      username: reviewers,
      pr: event.pull_request,
      showLinkPreview: c.option.showDiscordLinkPreview,
      dataSender: event.sender.login,
    });
    return core.info("Notified them on Discord.");
  }

  const reviewer = c.usernames.find(
    ({ github }) => github === requestedReviewers[0],
  );
  if (reviewer === undefined) {
    return core.warning(
      `Can't find ${requestedReviewers[0]} among the candidates.`,
    );
  }

  const tmpl = getTemplate("review_requested_one");
  await notifyWithTemplate({
    client: c.webhookClient,
    template: tmpl,
    username: reviewer,
    pr: event.pull_request,
    showLinkPreview: c.option.showDiscordLinkPreview,
    dataSender: event.sender.login,
  });
  return core.info(`Notified @${reviewer.github} on Discord.`);
}

export async function handleSchedule(c: RouterContext) {
  const repo = (c.event.payload as ScheduleEvent).repo;

  const prs = await listPRs(repo.owner, repo.repo);
  core.info(`Found ${prs.length} prs matching the condition.`);

  core.info(`Exclude prs not old more than ${c.option.schedulePrsMinAge}`);
  const grouped = groupReviewers(prs, c.option.schedulePrsMinAge);
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
        "\n" +
        grouped[reviewer.github]
          .map((pr) => `    - [${pr.title} #${pr.number}](${pr.html_url})`)
          .join("\n"),
    );
  }

  const msg = getTemplate("schedule");

  await c.webhookClient.postMessage(
    msg + "\n\n" + lines.join("\n"),
    !c.option.showDiscordLinkPreview,
  );
  core.info("Notified them on Discord.");
}

export async function handleReviewSubmitted(c: RouterContext) {
  const event = c.event.payload! as PullRequestReviewSubmittedEvent;
  const author = c.usernames.find(
    ({ github }) => github === event.pull_request.user.login.toLowerCase(),
  );

  if (author === undefined) {
    core.info(
      `The author @${event.pull_request.user.login} is not found. Stop running.`,
    );
    return;
  }

  if (event.review.state === "dismissed") {
    core.info("The review was dismissed and not considered as an event.");
    return;
  }

  const tmpl = getTemplate(
    ("review_submitted_" + event.review.state) as TemplateKey,
  );
  await notifyWithTemplate({
    client: c.webhookClient,
    template: tmpl,
    username: author,
    pr: event.pull_request as PullRequest,
    showLinkPreview: c.option.showDiscordLinkPreview,
    dataReviewer: event.review.user.login,
  });
}

export async function assignAndNotify(c: RouterContext, template: string) {
  const event = c.event.payload! as PullRequestEvent;

  const creator = event.sender.login.toLowerCase();
  const reviewer = chooseReviewer(c.usernames, [creator]);
  core.info(`The user @${reviewer.github} is picked.`);

  await requestReviewer(event.pull_request, reviewer);
  core.info(`Assigned @${reviewer.github} as the reviewer.`);

  await notifyWithTemplate({
    client: c.webhookClient,
    template,
    username: reviewer,
    pr: event.pull_request,
    showLinkPreview: c.option.showDiscordLinkPreview,
  });

  return core.info(`Notified @${reviewer.github} on Discord.`);
}
