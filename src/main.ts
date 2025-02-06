import * as core from "@actions/core";
import { context as githubContext } from "@actions/github";
import * as httpm from "@actions/http-client";
import { PullRequestEvent } from "@octokit/webhooks-types";
import { Octokit } from "@octokit/action";

type Username = {
  github: string;
  discord: string;
};

const event = githubContext.payload as PullRequestEvent;

/**
 * The main function for the action.
 *
 * @returns Resolves when the action is complete.
 */
export async function main() {
  if (githubContext.action != "pull_request") {
    core.setFailed(
      "This action is only for pull_request. Edit `on` in action yaml.",
    );
    return;
  }

  if (!isReadyToReview() && hasReivewer()) {
    core.info("This pr is draft or already has reviewer(s).");
    return;
  }

  try {
    const reviewer = selectReviewer();
    const octokit = new Octokit();
    await octokit.rest.pulls.requestReviewers({
      owner: githubContext.repo.owner,
      repo: githubContext.repo.repo,
      pull_number: githubContext.issue.number,
      reviewers: [reviewer.github],
    });
    await sendMessage(reviewer);
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    }
  }
}

function isReadyToReview(): boolean {
  return !event.pull_request.draft;
}

function hasReivewer(): boolean {
  return event.pull_request.requested_reviewers.length > 0;
}

function selectReviewer(): Username {
  const payload = githubContext.payload as PullRequestEvent;
  const creator = payload.sender.login;

  // get candidates and exclude the creator
  const candidates = getCandidates().filter(
    (username) => username.github != creator,
  );

  // randomly select the reviewer from candidates
  const reviewer = candidates[Math.floor(Math.random() * candidates.length)];

  return reviewer;
}

function getCandidates(): Username[] {
  // env format
  // githubUsername1:discordUsername1
  // githubUsername2:discordUsername2
  // #githubUsername3:discordUsername3 <-- ignored
  // ...
  const candidates = core
    .getMultilineInput("candidates")
    .filter((line) => !line.startsWith("#"))
    .map((val) => {
      const pair = val.split(":").map((username) => username.trim());
      if (pair.length != 2) {
        throw new Error("invalid username format");
      }

      return {
        github: pair[0],
        discord: pair[1],
      } as Username;
    });

  return candidates;
}

const DEFAULT_TEMPLATE = `<@{userID}>, you are assigned as the reviewer of [PR #{prNumber}]({prLink}). Please review!`;

function formatString(template: string, values: { [key: string]: string }) {
  return template.replace(/{(\w)}/g, function (match, key) {
    return typeof values[key] === "undefined" ? match : values[key];
  });
}

async function sendMessage(reviewer: Username) {
  const webhookURL = core.getInput("webhook_url");
  let template = core.getInput("template");
  if (template === "") {
    template = DEFAULT_TEMPLATE;
  }
  const content = formatString(template, {
    userID: reviewer.discord,
    prNumber: event.pull_request.number.toString(),
    prLink: event.pull_request.html_url,
  });

  const client = new httpm.HttpClient("random-reviewer-discord");
  return client.postJson(webhookURL, { content });
}
