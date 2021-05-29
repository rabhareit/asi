import axios, { AxiosResponse } from "axios";

import {
  PostMessageRequest,
  SlackAPIResponse,
  SlackAPIResponseSimple,
} from "../shared/types";

const ACCESS_TOKEN = process.env.BOT_OAUTH_TOKEN || "";
const POST_MESSAGE = "https://slack.com/api/chat.postMessage";

/**
 * Send message to specified channel.
 * If you'd like to send 1:1 message, pass user's slack id as `channel`.
 * @param channel(string) : Channel name or id you'd like to send message.
 * @param message(string) : Message content.
 * @return {status: boolean, ts?: string, error?: string}(SlackAPIResponseSimple) : Simple information of API response
 */
export async function postSlackMessage(
  channel: string,
  message: string
): Promise<SlackAPIResponseSimple> {
  const header = {
    "Content-Type": "application/json; charset=UTF-8",
    Authorization: `Bearer ${ACCESS_TOKEN}`,
  };

  const req: PostMessageRequest = {
    token: ACCESS_TOKEN,
    channel: channel,
    text: message,
  };

  const response: AxiosResponse = await axios.post(POST_MESSAGE, req, {
    headers: header,
  });
  const res = response.data as SlackAPIResponse;
  if (res.ok) {
    return { status: res.ok, ts: res.ts };
  } else {
    return { status: res.ok, error: res.error };
  }
}
