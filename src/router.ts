import { ActivityType, type ActionEvent, type ActionEventName } from "@/types";

interface IContext {
  event: ActionEvent;
}

export type Handler<C extends IContext> = (context: C) => Promise<void>;
type RouterChild<C extends IContext> =
  | ActivityTypeRouter<C, unknown>
  | Handler<C>;

export class Router<C extends IContext> {
  private router: Record<Partial<ActionEventName>, RouterChild<C>> =
    {} as Record<Partial<ActionEventName>, RouterChild<C>>;
  private fallbackHandler: Handler<C> = async (_: C) => {};

  constructor() {}

  add(name: ActionEventName, handler: RouterChild<C>) {
    this.router[name] = handler;
  }

  fallback(handler: Handler<C>) {
    this.fallbackHandler = handler;
  }

  async route(context: C) {
    if (this.router[context.event.name] === undefined) {
      return this.fallbackHandler(context);
    }

    const child = this.router[context.event.name];
    if (typeof child === "function") {
      return child(context);
    }

    return child.route(context);
  }
}

export class ActivityTypeRouter<C extends IContext, T> {
  private router: Record<Partial<ActivityType>, Handler<C>> = {} as Record<
    Partial<ActivityType>,
    Handler<C>
  >;
  private fallbackHandler: Handler<C> = async (_: C) => {};

  constructor() {}

  add(name: ActivityType & T, handler: Handler<C>) {
    this.router[name] = handler;
  }

  fallback(handler: Handler<C>) {
    this.fallbackHandler = handler;
  }

  async route(context: C) {
    if (this.router[context.event.activityType] === undefined) {
      return this.fallbackHandler(context);
    }

    const handler = this.router[context.event.activityType];
    return handler(context);
  }
}
