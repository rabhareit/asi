import axios from "axios";

import { PostMessageRequest, SlackAPIResponse, SlackAPIResponseSimple} from "./types";

const ACCESS_TOKEN = '';
const POST_MESSAGE = 'https://slack.com/api/chat.postMessage';

export async function postSlackMessage(message: string, dest: string): Promise<SlackAPIResponseSimple> {
  const header = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${ACCESS_TOKEN}`
  }
  const req: PostMessageRequest = {
    token: ACCESS_TOKEN,
    channel: dest,
    text: message,
    as_user: false
  }

  const res: SlackAPIResponse = await axios.post(POST_MESSAGE, req, {headers: header});
  if (res.ok) {
    return {status: res.ok, ts: res.ts}
  } else {
    return {status: res.ok, error: res.error};
  }
}

