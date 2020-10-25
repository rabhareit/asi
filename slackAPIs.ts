import axios from "axios";
import { promises } from "fs";

import { PostMessageRequest, SlackAPIResponce } from "./types";

const ACCESS_TOKEN = '';
const POST_MESSAGE = 'https://slack.com/api/chat.postMessage';

export async function postMessage(message: string, dest: string): Promise<Object> {
  const header = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${ACCESS_TOKEN}`
  }
  const req: PostMessageRequest = {
    token: ACCESS_TOKEN,
    channel: dest,
    text: message
  }

  const res: SlackAPIResponce = await axios.post(POST_MESSAGE, req, {headers: header});
  if (res.ok) {
    return {status: res.ok, ts: res.ts}
  } else {
    return res;
  }
}