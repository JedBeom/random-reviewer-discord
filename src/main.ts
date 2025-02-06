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

/**
 * The main function for the action.
 *
 * @returns Resolves when the action is complete.
 */
export async function main() {
  core.info(`eventName is ${githubContext.eventName}`);

  if (!isReadyToReview() && hasReviewer()) {
    core.info("This pr is draft or already has reviewer(s).");
    return;
  }

  try {
    const candidatesInput = core.getMultilineInput("candidates");
    const webhookURL = core.getInput("webhook_url");
    const template = core.getInput("template");
    const creator = event.sender.login;

    const usernames = parseUsernames(candidatesInput);
    const reviewer = selectReviewer(usernames, [creator]);
    await assignReviewer(reviewer);
    await sendMessage(webhookURL, template, reviewer);
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    }
  }
}
