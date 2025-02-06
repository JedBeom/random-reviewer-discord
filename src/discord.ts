import * as httpm from "@actions/http-client";

import { event } from "@/github";
import { type FormatParam, type Username } from "@/types";

export const DEFAULT_TEMPLATE = `<@{userID}>, you are assigned as the reviewer of [PR {prNumber}]({prURL}). Please review!`;

export function formatString(template: string, param: FormatParam): string {
  for (const key in param) {
    template = template.replace(`{${key}}`, param[key as keyof FormatParam]);
  }

  return template;
}

export async function sendMessage(
  webhookURL: string,
  template: string,
  reviewer: Username,
) {
  if (template === "") {
    template = DEFAULT_TEMPLATE;
  }
  const content = formatString(template, {
    userID: reviewer.discord,
    prNumber: event.pull_request.number.toString(),
    prURL: event.pull_request.html_url,
  });

  const client = new httpm.HttpClient(event.repository.name);
  return client.postJson(webhookURL, { content });
}
