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
export async function notifyReviewer(
  webhookURL: URL,
  template: string,
  reviewer: Username | Username[],
  pr: PullRequest,
) {
  if (template === "") {
    template = "NO TEMPLATE WAS GIVEN!!";
  }

  let mention = "";
  if ("length" in reviewer) {
    mention = reviewer.map(({ discord }) => idToMention(discord)).join(" ");
  } else {
    mention = idToMention(reviewer.discord);
  }

  const content = formatString(template, {
    mention: mention,
    prTitle: pr.title,
    prNumber: pr.number.toString(),
    prURL: pr.html_url,
  });

  return sendMessage(webhookURL, content);
  // TODO: get message ID and upload to actions artifacts
}
