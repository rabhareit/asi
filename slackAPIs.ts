import axios, { AxiosResponse } from "axios";

import { PostMessageRequest, SlackAPIResponse, SlackAPIResponseSimple} from "./types";

const ACCESS_TOKEN = process.env.BOT_OAUTH_TOKEN || '';
const POST_MESSAGE = 'https://slack.com/api/chat.postMessage';

export async function postSlackMessage(message: string, dest: string): Promise<SlackAPIResponseSimple> {
  const header = {
    'Content-Type': 'application/json; charset=UTF-8',
    'Authorization': `Bearer ${ACCESS_TOKEN}`
  }

  const req: PostMessageRequest = {
    token: ACCESS_TOKEN,
    channel: dest,
    text: message
  }

  const response: AxiosResponse = await axios.post(POST_MESSAGE, req, {headers: header});
  const res: SlackAPIResponse = response.data;
  if (res.ok) {
    return {status: res.ok, ts: res.ts}
  } else {
    return {status: res.ok, error: res.error};
  }
}

