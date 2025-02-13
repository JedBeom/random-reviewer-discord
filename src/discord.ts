import * as httpm from "@actions/http-client";

import { type FormatParam, type Username } from "@/types";
import { type PullRequest } from "@octokit/webhooks-types";

export const DEFAULT_TEMPLATE = `- Reviewer: <@{userID}>\n- PR: [#{prNumber}]({prURL})`;

export function formatString(template: string, param: FormatParam): string {
  for (const key in param) {
    template = template.replaceAll(
      new RegExp(`{ *${key} *}`, "g"),
      param[key as keyof FormatParam],
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
/* istanbul ignore next */
export async function sendMessage(
  webhookURL: URL,
  content: string,
): Promise<string> {
  webhookURL.searchParams.delete("wait");
  webhookURL.searchParams.append("wait", "true");

  const client = new httpm.HttpClient("JedBeom/random-reviewer-discord");
  const { result } = await client.postJson<IDiscordWebhookMessage>(
    webhookURL.href,
    { content },
  );

  if (result === null) {
    throw new Error("Discord Webhook Message is null");
  }

  return result.id;
}

/* istanbul ignore next */
export async function notifySingleReviewer(
  webhookURL: URL,
  template: string,
  reviewer: Username,
  pr: PullRequest,
) {
  if (template === "") {
    template = DEFAULT_TEMPLATE;
  }
  const content = formatString(template, {
    userID: reviewer.discord,
    prNumber: pr.number.toString(),
    prURL: pr.html_url,
  });

  return sendMessage(webhookURL, content);
  // TODO: get message ID and upload to actions artifacts
}
