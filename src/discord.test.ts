import { describe, expect, test } from "@jest/globals";
import { formatString, idToMention } from "@/discord";
import type { TemplateData } from "@/types";

const setsFormatString = [
  {
    id: 1,
    template:
      "{mention}, you are the reviewer of [{prTitle      } #{prNumber}]({prURL})!",
    data: {
      mention: "<@1234>",
      prTitle: "LEMON MELON COOKIE",
      prNumber: "77",
      prURL: "https://github.com",
    } as TemplateData,
    expected:
      "<@1234>, you are the reviewer of [LEMON MELON COOKIE #77](https://github.com)!",
  },
  {
    id: 2,
    template: "Reviewer of [{prTitle} #{ prNumber}]({ prURL }) is {mention}!",
    data: {
      mention: "<@20250206>",
      prTitle: "MOCHIMOCHI",
      prNumber: "91",
      prURL: "https://github.com/JedBeom/cyes",
    } as TemplateData,
    expected:
      "Reviewer of [MOCHIMOCHI #91](https://github.com/JedBeom/cyes) is <@20250206>!",
  },
];

describe("formatString", () => {
  for (const set of setsFormatString) {
    test(`id: ${set.id}`, () => {
      expect(formatString(set.template, set.data)).toBe(set.expected);
    });
  }
});

describe("idToMention", () => {
  test("1234 to <@1234>", () => {
    expect(idToMention("1234")).toBe("<@1234>");
  });
});
