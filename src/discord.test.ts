import { describe, expect, test } from "@jest/globals";
import { formatString } from "@/discord";
import { type FormatParam } from "@/types";

const sets = [
  {
    id: 1,
    template: "<@{userID}>, you are the reviewer of [PR #{prNumber}]({prURL})!",
    param: {
      userID: "1234",
      prNumber: "77",
      prURL: "https://github.com",
    } as FormatParam,
    expected: "<@1234>, you are the reviewer of [PR #77](https://github.com)!",
  },
  {
    id: 2,
    template: "Reviewer of [PR #{prNumber}]({prURL}) is <@{userID}>!",
    param: {
      userID: "20250206",
      prNumber: "91",
      prURL: "https://github.com/JedBeom/cyes",
    } as FormatParam,
    expected:
      "Reviewer of [PR #91](https://github.com/JedBeom/cyes) is <@20250206>!",
  },
];

describe("formatString", () => {
  for (const set of sets) {
    test(`id: ${set.id}`, () => {
      expect(formatString(set.template, set.param)).toBe(set.expected);
    });
  }
});
