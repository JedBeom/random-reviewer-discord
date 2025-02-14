import { Router, ActivityTypeRouter, Handler } from "@/router";
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

  test("should call middlewares in the correct order", async () => {
    type MiddlewareContext = {
      event: ActionEvent;
      called: string[];
    };

    const middleware1 = jest.fn(
      (next: Handler<MiddlewareContext>) =>
        async (context: MiddlewareContext) => {
          context.called.push("1 starts");
          await next(context);
          context.called.push("1 ends");
        },
    );

    const middleware2 = jest.fn(
      (next: Handler<MiddlewareContext>) =>
        async (context: MiddlewareContext) => {
          context.called.push("2 starts");
          await next(context);
          context.called.push("2 ends");
        },
    );

    const mockHandler = jest.fn(async (context: MiddlewareContext) => {
      context.called.push("handler");
    });

    const router = new Router<MiddlewareContext>();
    router.use(middleware1);
    router.use(middleware2);
    router.add("pull_request", mockHandler);

    const context: MiddlewareContext = {
      event: { name: "pull_request", activityType: "opened", payload: {} },
      called: [],
    };
    await router.route(context);

    expect(middleware1).toHaveBeenCalled();
    expect(middleware2).toHaveBeenCalled();
    expect(context.called).toEqual([
      "1 starts",
      "2 starts",
      "handler",
      "2 ends",
      "1 ends",
    ]);
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
