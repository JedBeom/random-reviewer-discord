import * as core from "@actions/core";

import {
  assignReviewer,
  getDefaultContext,
  getRequestedReviewers,
  isReadyToReview,
  chooseReviewer,
  listPRs,
  groupReviewers,
} from "@/github";
import { idToMention, notifySingleReviewer, sendMessage } from "@/discord";
import { ActivityTypeRouter, Router } from "@/router";
import type {
  RouterContext,
  PullRequestActivityType,
  ScheduleEvent,
} from "@/types";
import type {
  PullRequestEvent,
  PullRequestOpenedEvent,
  PullRequestReadyForReviewEvent,
  PullRequestReviewRequestedEvent,
} from "@octokit/webhooks-types";

export async function main() {
  const prRouter = new ActivityTypeRouter<
    RouterContext,
    PullRequestActivityType
  >();
  prRouter.add("opened", handleOpened);
  prRouter.add("reopened", handleReopenOrReadyForReview);
  prRouter.add("ready_for_review", handleReopenOrReadyForReview);
  prRouter.add("review_requested", handleReviewRequested);
  prRouter.add("converted_to_draft", handleConvertedToDraft);
  prRouter.fallback(fallbackHandler);

  const router = new Router<RouterContext>();
  router.add("pull_request", prRouter);
  router.add("schedule", handleSchedule);
  router.fallback(fallbackHandler);

  core.info("Execute router.route()");
  try {
    const context = getDefaultContext();
    await router.route(context);
  } catch (error) {
    if (error instanceof Error) {
      return core.setFailed(error.message);
    }

    core.setFailed("Failed with an unknown exception.");
  }
}

async function fallbackHandler(c: RouterContext) {
  core.setFailed(
    `The event ${c.event.name}.${c.event.activityType} is not supported.`,
  );
  core.setFailed(
    `Edit the yaml file and make sure to specify the supported types only.`,
  );
}

async function handleOpened(c: RouterContext) {
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

  return assignAndNotify(c);
}

async function handleReopenOrReadyForReview(c: RouterContext) {
  const pr = (c.event.payload! as PullRequestReadyForReviewEvent).pull_request;

  if (!isReadyToReview(pr)) {
    core.info("This pr is draft. No-op.");
    return;
  }

  // Requested Reviewers do stay in place
  // despite being drafted and being set ready for review
  const requestedReviewers = await getRequestedReviewers(c.octokit, pr);
  if (requestedReviewers.length === 0) {
    core.info(`No requested reviewers. Start assigning a new reviewer.`);
    return assignAndNotify(c);
  }

  core.info(`This pr has the reviewer(s): ${requestedReviewers.join(", ")}.`);
  core.info(`Start notifying them.`);
  const mentions = c.usernames
    .filter(({ github }) => requestedReviewers.includes(github))
    .map(({ discord }) => idToMention(discord))
    .join(" ");

  await sendMessage(
    c.webhookURL,
    c.event.activityType === "reopened"
      ? `${mentions}, [Pr title #314](https://github.com) is reopened.`
      : `${mentions}, [Pr title #314](https://github.com) is now ready for review!`,
  );
  core.info("Notified them on Discord.");
}

async function handleReviewRequested(c: RouterContext) {
  const pr = (c.event.payload! as PullRequestReviewRequestedEvent).pull_request;

  if (pr.requested_reviewers.length === 0) {
    return core.setFailed(
      "No requested reviewers although the event is review_requested.",
    );
  }

  // TODO: support teams as reviewers
  const reviewers = pr.requested_reviewers
    .filter((reviewer) => "login" in reviewer)
    .map((user) => user.login);

  if (reviewers.length > 1) {
    const mentions = c.usernames
      .filter(({ github }) => reviewers.includes(github))
      .map(({ discord }) => idToMention(discord))
      .join(" ");

    await sendMessage(
      c.webhookURL,
      `${mentions}, you were manually assigned as the reviewers of [Pr title #314](https://github.com).`,
    );
    return core.info("Notified them on Discord.");
  }

  const reviewer = c.usernames.find(({ github }) => github === reviewers[0]);
  if (reviewer === undefined) {
    return core.setFailed(
      `Github user ${reviewers[0]} is not found among the candidates.`,
    );
  }

  await notifySingleReviewer(
    c.webhookURL,
    `${idToMention(reviewer.discord)} were manually assigned as the reviewer of [asdf alshbilsj #314](https://github.com).`,
    reviewer,
    pr,
  );
  return core.info(`Notified @${reviewer.github} on Discord.`);
}

async function handleSchedule(c: RouterContext) {
  const repo = (c.event.payload as ScheduleEvent).repo;
  const prs = await listPRs(repo.owner, repo.repo);
  core.info(`Found ${prs.length} prs matching the condition.`);

  const grouped = await groupReviewers(prs);
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

  const lists: string[] = [];
  for (const reviewer of reviewers) {
    lists.push(
      "- " +
        idToMention(reviewer.discord) +
        grouped[reviewer.github]
          .map((pr) => `[${pr.title} #${pr.number}](${pr.html_url})`)
          .join(", "),
    );
  }

  await sendMessage(
    c.webhookURL,
    "Review Reminder Time!\n\n" + lists.join("\n"),
  );
  core.info("Notified them on Discord.");
}

async function handleConvertedToDraft() {
  // TODO: use actions artifacts to restore message ID
  // and edit it

  // Requested Reviewers do stay in place despite being drafted
  core.info("Not implemented");
}

async function assignAndNotify(c: RouterContext) {
  const event = c.event.payload! as PullRequestEvent;

  const creator = event.sender.login.toLowerCase();
  const reviewer = chooseReviewer(c.usernames, [creator]);
  core.info(`The user @${reviewer.github} is picked.`);

  await assignReviewer(event.pull_request, reviewer);
  core.info(`Assigned @${reviewer.github} as the reviewer.`);

  await notifySingleReviewer(
    c.webhookURL,
    `<@${reviewer.discord}>, you were assigned as the reviewer of [asdf alshbilsj #314](https://github.com).`,
    reviewer,
    event.pull_request,
  );
  return core.info(`Notified @${reviewer.github} on Discord.`);
}
