import { type FormatParam, type Username } from "@/types";
export declare const DEFAULT_TEMPLATE = "- Reviewer: <@{userID}>\n- PR: [#{prNumber}]({prURL})";
export declare function formatString(template: string, param: FormatParam): string;
export declare function sendMessage(webhookURL: string, template: string, reviewer: Username): Promise<import("@actions/http-client/lib/interfaces.js").TypedResponse<unknown>>;
