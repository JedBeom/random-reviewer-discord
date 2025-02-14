import { ActivityType, type ActionEvent, type ActionEventName } from "@/types";

interface IContext {
  event: ActionEvent;
}

export type Handler<C extends IContext> = (context: C) => Promise<void>;
export type Middleware<C extends IContext> = (next: Handler<C>) => Handler<C>;

export class Router<C extends IContext> {
  private router: Record<Partial<ActionEventName>, Handler<C>> = {} as Record<
    Partial<ActionEventName>,
    Handler<C>
  >;
  private fallbackHandler: Handler<C> = async (_: C) => {};
  private middlewares = [] as Middleware<C>[];

  constructor() {}

  use(middleware: Middleware<C>) {
    this.middlewares.push(middleware);
  }

  add(name: ActionEventName, handler: Handler<C>) {
    this.router[name] = handler;
  }

  fallback(handler: Handler<C>) {
    this.fallbackHandler = handler;
  }

  async route(context: C): Promise<void> {
    let handler: Handler<C>;

    if (this.router[context.event.name] === undefined) {
      handler = this.fallbackHandler;
    } else {
      handler = this.router[context.event.name];
    }

    for (let i = this.middlewares.length - 1; i >= 0; i--) {
      handler = this.middlewares[i](handler);
    }

    return handler(context);
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

  async route(context: C): Promise<void> {
    let handler: Handler<C>;

    if (this.router[context.event.activityType] === undefined) {
      handler = this.fallbackHandler;
    } else {
      handler = this.router[context.event.activityType];
    }

    return handler(context);
  }

  toHandler() {
    return this.route;
  }
}
