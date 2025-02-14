import { Router, ActivityTypeRouter } from "@/router";
import type {
  ActionEvent,
  ActivityType,
  PullRequestActivityType,
} from "@/types";
import { describe, expect, test, beforeEach, jest } from "@jest/globals";

type TestContext = {
  event: ActionEvent;
};

const mockHandler = jest.fn(async (_: TestContext) => {});

describe("Router", () => {
  let router: Router<TestContext>;

  beforeEach(() => {
    router = new Router<TestContext>();
  });

  test("should call the correct handler for a given event name", async () => {
    router.add("pull_request", mockHandler);
    const context: TestContext = {
      event: { name: "pull_request", activityType: "opened", payload: {} },
    };
    await router.route(context);
    expect(mockHandler).toHaveBeenCalledWith(context);
  });

  test("should call the fallback handler if no handler is found", async () => {
    const fallbackHandler = jest.fn(async (_: TestContext) => {});
    router.fallback(fallbackHandler);
    const context: TestContext = {
      event: {
        name: "branch_protection_rule",
        activityType: "opened",
        payload: {},
      },
    };
    await router.route(context);
    expect(fallbackHandler).toHaveBeenCalledWith(context);
  });

  test("should call the ActivityTypeRouter for a given event name and activityType", async () => {
    const prRouter = new ActivityTypeRouter<
      TestContext,
      PullRequestActivityType
    >();
    prRouter.add("assigned", mockHandler);
    router.add("pull_request", prRouter.toHandler());

    const context: TestContext = {
      event: {
        name: "pull_request",
        activityType: "assigned",
        payload: {},
      },
    };
    await router.route(context);
    expect(mockHandler).toHaveBeenCalledWith(context);
  });
});

describe("ActivityTypeRouter", () => {
  let activityRouter: ActivityTypeRouter<TestContext, ActivityType>;

  beforeEach(() => {
    activityRouter = new ActivityTypeRouter<TestContext, ActivityType>();
  });

  test("should call the correct handler for a given activity type", async () => {
    activityRouter.add("opened", mockHandler);
    const context: TestContext = {
      event: { name: "pull_request", activityType: "opened", payload: {} },
    };
    await activityRouter.route(context);
    expect(mockHandler).toHaveBeenCalledWith(context);
  });

  test("should call the fallback handler if no handler is found", async () => {
    const fallbackHandler = jest.fn(async (_: TestContext) => {});
    activityRouter.fallback(fallbackHandler);
    const context: TestContext = {
      event: {
        name: "pull_request",
        activityType: "assigned",
        payload: {},
      },
    };
    await activityRouter.route(context);
    expect(fallbackHandler).toHaveBeenCalledWith(context);
  });
});
