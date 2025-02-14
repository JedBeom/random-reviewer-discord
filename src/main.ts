import * as core from "@actions/core";

import { initContext } from "@/github";
import { ActivityTypeRouter, Router } from "@/router";
import type {
  RouterContext,
  PullRequestActivityType,
  PullRequestReviewActivityType,
} from "@/types";
import {
  fallbackHandler,
  handleOpened,
  handleReopenOrReadyForReview,
  handleReviewRequested,
  handleReviewSubmitted,
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
    prRouter.fallback(fallbackHandler);
  }

  const reviewRouter = new ActivityTypeRouter<
    RouterContext,
    PullRequestReviewActivityType
  >();
  {
    reviewRouter.add("submitted", handleReviewSubmitted);
    reviewRouter.fallback(fallbackHandler);
  }

  const router = new Router<RouterContext>();
  {
    router.add("pull_request", prRouter.toHandler());
    router.add("pull_request_review", reviewRouter.toHandler());
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
