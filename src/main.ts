import * as core from "@actions/core";

import { initContext } from "@/github";
import { ActivityTypeRouter, Router } from "@/router";
import type { RouterContext, PullRequestActivityType } from "@/types";
import {
  fallbackHandler,
  handleConvertedToDraft,
  handleOpened,
  handleReopenOrReadyForReview,
  handleReviewRequested,
  handleReviewRequestedRemoved,
  handleSchedule,
} from "@/handlers";

export async function main() {
  const prRouter = new ActivityTypeRouter<
    RouterContext,
    PullRequestActivityType
  >();
  {
    prRouter.add("opened", handleOpened);
    prRouter.add("reopened", handleReopenOrReadyForReview);
    prRouter.add("ready_for_review", handleReopenOrReadyForReview);
    prRouter.add("review_requested", handleReviewRequested);
    prRouter.add("review_request_removed", handleReviewRequestedRemoved);
    prRouter.add("converted_to_draft", handleConvertedToDraft);
    prRouter.fallback(fallbackHandler);
  }

  const router = new Router<RouterContext>();
  {
    router.add("pull_request", prRouter);
    router.add("schedule", handleSchedule);
    router.fallback(fallbackHandler);
  }

  core.info("Execute router.route()");
  try {
    const context = initContext();
    await router.route(context);
  } catch (error) {
    if (error instanceof Error) {
      return core.setFailed(error.message);
    }

    core.setFailed("Failed with an unknown exception.");
  }
}
