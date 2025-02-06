import * as core from "@actions/core";
import { context as githubContext } from "@actions/github";

import {
  assignReviewer,
  event,
  hasReviewer,
  isReadyToReview,
  parseUsernames,
  selectReviewer,
} from "@/github";
import { sendMessage } from "@/discord";

export async function main() {
  const allowOtherEvents = core.getBooleanInput("allow_other_events");
  const eventName = githubContext.eventName;
  if (eventName !== "pull_request" && !allowOtherEvents) {
    return core.setFailed(
      `This event is ${eventName}. To allow this action to run on all events, set allow_other_events as true.`,
    );
  }

  if (!isReadyToReview() && hasReviewer()) {
    core.info("This pr is draft or already has reviewer(s).");
    core.info("no-op. Stopping.");
    return;
  }

  try {
    const candidatesInput = core.getMultilineInput("candidates");
    const webhookURL = core.getInput("webhook_url");
    const template = core.getInput("template");

    const creator = event.sender.login.toLowerCase();
    let excludedGithubUsername = [creator];
    if (core.getBooleanInput("allow_self_review")) {
      core.info("Allowing the creator to be included in candidates.");
      excludedGithubUsername = [];
    }

    const usernames = parseUsernames(candidatesInput);
    if (usernames.length === 0) {
      core.warning("No candidates. No-op.");
      return;
    }

    const reviewer = selectReviewer(usernames, excludedGithubUsername);
    await assignReviewer(reviewer);
    await sendMessage(webhookURL, template, reviewer);
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    }
  }
}
