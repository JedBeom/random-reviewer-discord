import { context as githubContext } from "@actions/github";

import { Octokit } from "@octokit/action";
import { PullRequestEvent } from "@octokit/webhooks-types";

import { type Username } from "@/types";

export const event = githubContext.payload as PullRequestEvent;

export function isReadyToReview(): boolean {
  return !event.pull_request.draft;
}

export function hasReviewer(): boolean {
  return event.pull_request.requested_reviewers.length > 0;
}

export function selectReviewer(
  usernames: Username[],
  exclude: string[],
): Username {
  // get candidates and exclude the creator
  const candidates = usernames.filter(
    (username) => !exclude.includes(username.github),
  );

  // randomly select the reviewer from candidates
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export function parseUsernames(input: string[]): Username[] {
  // env format
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

export async function assignReviewer(reviewer: Username) {
  const octokit = new Octokit();
  return octokit.rest.pulls.requestReviewers({
    owner: githubContext.repo.owner,
    repo: githubContext.repo.repo,
    pull_number: githubContext.issue.number,
    reviewers: [reviewer.github],
  });
}
