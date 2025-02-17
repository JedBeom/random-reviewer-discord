import { ActivityType, type ActionEvent, type ActionEventName } from "@/types";

interface IContext {
  event: ActionEvent;
}

export type Handler<C extends IContext> = (context: C) => Promise<void>;
export type Middleware<C extends IContext> = (next: Handler<C>) => Handler<C>;

export class Router<C extends IContext> {
  private router = {} as Record<Partial<ActionEventName>, Handler<C>>;
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
    let handler: Handler<C> = this.fallbackHandler;

    if (this.router[context.event.name] !== undefined) {
      handler = this.router[context.event.name];
    }

    for (let i = this.middlewares.length - 1; i >= 0; i--) {
      handler = this.middlewares[i](handler);
    }

    return handler(context);
  }
}

export class ActivityTypeRouter<C extends IContext, T> {
  private router = {} as Record<Partial<ActivityType>, Handler<C>>;
  private fallbackHandler: Handler<C> = async (_: C) => {};

  constructor() {}

  add(name: ActivityType & T, handler: Handler<C>) {
    this.router[name] = handler;
  }

  fallback(handler: Handler<C>) {
    this.fallbackHandler = handler;
  }

  async route(context: C): Promise<void> {
    let handler = this.fallbackHandler;

    if (this.router[context.event.activityType] !== undefined) {
      handler = this.router[context.event.activityType];
    }

    return handler(context);
  }

  toHandler() {
    return this.route.bind(this);
  }
}
