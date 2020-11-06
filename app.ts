import { App, LogLevel } from "@slack/bolt"
import { getGomiWorkers } from "./SQLRepository";
import { generateMessage } from "./util";

import { createWriteStream } from "fs";
import { chatting } from "./api";
import { send } from "process";

const logWritable = createWriteStream('private/bolt.log')
const signingSecret = process.env.SLACK_SIGNING_SECRET || '';
const botOAuthToken = process.env.SLACK_BOT_OAUTH_TOKEN || '';

const asi = new App({
  signingSecret: signingSecret,
  token: botOAuthToken,
  // logLevel: LogLevel.ERROR,
  logger: {
    debug: (...msgs) => {logWritable.write(`[debug] : ${JSON.stringify(msgs)}\n`)},
    info: (...msgs) => {logWritable.write(`[info] : ${JSON.stringify(msgs)}\n`)},
    warn: (...msgs) => {logWritable.write(`[warn] : ${JSON.stringify(msgs)}\n`)},
    error: (...msgs) => {logWritable.write(`[error] : ${JSON.stringify(msgs)}\n`)},
    getLevel: () => {return LogLevel.ERROR},
    setLevel: (label: LogLevel) => {},
    setName: (name: string) => {}
  }
});

asi.message(async ({message, say}) => {
  const sender = message.user;
  const msg = message.text;

  // If message contain no text, do nothing.
  if (msg === undefined) {
    return
  }

  // message contain `ごみ` it asks next cleaning role
  if(msg?.match('ごみ')){
    // message contain `ごみ` & `終` it tells finishing cleaning role
    if (msg?.match('終')) {
      await asi.client.reactions.add({
        token: botOAuthToken,
        channel: message.channel,
        name: '+1',
        timestamp: message.ts
      });
      await say(`<@${sender}>さんありがとうございます！`);
      return
    }
    const gomiWorkers = await getGomiWorkers();
    const reply = generateMessage(gomiWorkers);
    await say(reply);
  }

  // Else, reply chatting.
  const reply = await chatting(msg, sender);
  await say(reply);
});

asi.command('/gomi', async ({command, ack, say}) => {
  // Notify slack app recieves command event request.
  await ack();
  const gomiWorkers = await getGomiWorkers();
  const msg = generateMessage(gomiWorkers);
  await say(msg);
});

( async () => {
  await asi.start(process.env.ASI_PORT || 3000);
  console.log('⚡ asi powered by @slack/bolt is running ⚡');
})();
