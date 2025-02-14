import * as httpm from "@actions/http-client";
import { type PullRequest } from "@octokit/webhooks-types";

import { type TemplateData, type Username } from "@/types";

export const DEFAULT_TEMPLATE = `- Reviewer: <@{userID}>\n- PR: [#{prNumber}]({prURL})`;

export function formatString(template: string, data: TemplateData): string {
  for (const key in data) {
    template = template.replaceAll(
      new RegExp(`{ *${key} *}`, "g"),
      data[key as keyof TemplateData],
    );
  }

  return template;
}

export function idToMention(id: string) {
  return "<@" + id + ">";
}

interface IDiscordWebhookMessage {
  id: string;
  content: string;
}

// See: https://discord.com/developers/docs/resources/webhook#execute-webhook
export class DiscordWebhookClient {
  private webhookURL: URL;
  private client: httpm.HttpClient;

  constructor(webhookURL: URL) {
    webhookURL.searchParams.delete("wait");
    webhookURL.searchParams.append("wait", "true");
    this.webhookURL = webhookURL;

    this.client = new httpm.HttpClient("JedBeom/random-reviewer-discord");
  }

  private webhookURLWithID(id: string) {
    const idURL = structuredClone(this.webhookURL);
    idURL.pathname += "/messages/" + id;
    return idURL;
  }

  async getMessage(id: string): Promise<IDiscordWebhookMessage> {
    const { result } = await this.client.getJson<IDiscordWebhookMessage>(
      this.webhookURLWithID(id).href,
    );

    if (result === null) {
      throw new Error("Could not get the message");
    }

    return result;
  }

  async postMessage(content: string): Promise<IDiscordWebhookMessage> {
    const { result } = await this.client.postJson<IDiscordWebhookMessage>(
      this.webhookURL.href,
      { content },
    );

    if (result === null) {
      throw new Error("Discord Webhook Message is null");
    }

    return result;
  }

  async patchMessage(id: string, message: IDiscordWebhookMessage) {
    const { result } = await this.client.patchJson<IDiscordWebhookMessage>(
      this.webhookURLWithID(id).href,
      message,
    );

    if (result === null) {
      throw new Error("Could not get the message");
    }

    return result;
  }
}

/* istanbul ignore next */
export async function notifyWithTemplate(
  client: DiscordWebhookClient,
  template: string,
  username: Username | Username[],
  pr: PullRequest,
) {
  if (template === "") {
    template = "NO TEMPLATE WAS GIVEN!!";
  }

  let mention = "";
  if ("length" in username) {
    mention = username.map(({ discord }) => idToMention(discord)).join(" ");
  } else {
    mention = idToMention(username.discord);
  }

  const content = formatString(template, {
    mention: mention,
    prTitle: pr.title,
    prNumber: pr.number.toString(),
    prURL: pr.html_url,
  });

  return client.postMessage(content);
  // TODO: get message ID and upload to actions artifacts
}
