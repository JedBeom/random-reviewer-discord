import {
  describe,
  expect,
  test,
  beforeEach,
  afterEach,
  jest,
} from "@jest/globals";
import type { Username } from "@/types";
import { parseUsernames, chooseReviewer, groupReviewers } from "@/github";
import type { PullRequest } from "@octokit/webhooks-types";

// example usernames
const user1: Username = { github: "jedbeom", discord: "1111111111111111111" };
const user2: Username = { github: "minyoy", discord: "2222222222222222222" };
const user3: Username = {
  github: "andless2004",
  discord: "3333333333333333333",
};
const user4: Username = { github: "j1ny0ung", discord: "4444444444444444444" };
const user5: Username = { github: "hs1l", discord: "5555555555555555555" };

const parseUsernamesSets = [
  {
    id: 1,
    input: [
      "jedbeom:1111111111111111111",
      "#minyoy:2222222222222222222",
      "andless2004:3333333333333333333",
      "#j1ny0ung:4444444444444444444",
      "hs1l:5555555555555555555",
    ],
    expected: [user1, user3, user5] as Username[],
  },
  {
    id: 2,
    input: [],
    expected: [],
  },
  {
    id: 3,
    input: [
      "jedbeom:1111111111111111111",
      "minyoy:2222222222222222222",
      "andless2004:3333333333333333333",
      "j1ny0ung:4444444444444444444",
      "hs1l:5555555555555555555",
    ],
    expected: [user1, user2, user3, user4, user5],
  },
];

describe("parseUsernames", () => {
  for (const set of parseUsernamesSets) {
    test(`id: ${set.id}`, () => {
      expect(parseUsernames(set.input)).toStrictEqual(set.expected);
    });
  }
});

const selectReviewerSets = [
  {
    id: 1,
    usernames: [user1, user5],
    exclude: [user1.github],
    expected: user5,
  },
  {
    id: 2,
    usernames: [user1, user2, user3],
    exclude: [user1.github],
    expected: user2,
  },
  {
    id: 3,
    usernames: [user1, user2, user3],
    exclude: [user3.github],
    expected: user1,
  },
];

beforeEach(() => {
  jest.spyOn(global.Math, "random").mockReturnValue(0.001);
});

afterEach(() => {
  jest.spyOn(global.Math, "random").mockRestore();
});

describe("chooseReviewer", () => {
  for (const set of selectReviewerSets) {
    test(`id: ${set.id}`, () => {
      expect(chooseReviewer(set.usernames, set.exclude)).toStrictEqual(
        set.expected,
      );
    });
  }

  test("Zero candidates throws an error", () => {
    expect(() => chooseReviewer([user1], [user1.github])).toThrow(
      new Error("No candidates after excluding the creator."),
    );
  });
});

describe("groupReviewers", () => {
  const now = new Date();
  const pulls = <PullRequest[]>[
    {
      draft: false,
      created_at: new Date(now.getTime() - 5 * 60 * 60 * 1000).toISOString(), // 5 hours ago
      requested_reviewers: [
        { login: "reviewer1" },
        { login: "reviewer2" },
        { slug: "ignore_me!" },
      ],
      base: {
        repo: { owner: { login: "owner" }, name: "repo" },
      },
      number: 1,
    },
    {
      draft: false,
      created_at: new Date(now.getTime() - 10 * 60 * 60 * 1000).toISOString(), // 10 hours ago
      requested_reviewers: [{ login: "reviewer1" }],
      base: { repo: { owner: { login: "owner" }, name: "repo" } },
      number: 2,
    },
    {
      draft: true,
      created_at: new Date(now.getTime() - 15 * 60 * 60 * 1000).toISOString(), // 15 hours ago
      requested_reviewers: [{ login: "reviewer3" }],
      base: { repo: { owner: { login: "owner" }, name: "repo" } },
      number: 3,
    },
  ];

  test("should group reviewers correctly based on minAge", () => {
    const minAge = 6; // 6 hours
    const result = groupReviewers(pulls, minAge);

    expect(result).toEqual({
      reviewer1: [pulls[1]],
    });
  });

  test("should exclude draft pull requests", () => {
    const minAge = 1; // 1 hour
    const result = groupReviewers(pulls, minAge);

    expect(result).toEqual({
      reviewer1: [pulls[0], pulls[1]],
      reviewer2: [pulls[0]],
    });
  });

  test("should exclude pull requests younger than minAge", () => {
    const minAge = 12; // 12 hours
    const result = groupReviewers(pulls, minAge);

    expect(result).toEqual({});
  });
});
