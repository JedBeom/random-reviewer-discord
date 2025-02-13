import {
  describe,
  expect,
  test,
  beforeEach,
  afterEach,
  jest,
} from "@jest/globals";
import { type Username } from "@/types";
import { parseUsernames, chooseReviewer } from "@/github";

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

describe("selectReviewer", () => {
  for (const set of selectReviewerSets) {
    test(`id: ${set.id}`, () => {
      expect(chooseReviewer(set.usernames, set.exclude)).toStrictEqual(
        set.expected,
      );
    });
  }
});
