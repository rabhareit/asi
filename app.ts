import { App, LogLevel } from "@slack/bolt"
import { getGomiWorkers } from "./SQLRepository";
import { BoltCustomLogger, generateMessage, isGomiWorker } from "./util";

import { chatting } from "./api";

const signingSecret = process.env.SLACK_SIGNING_SECRET || '';
const botOAuthToken = process.env.SLACK_BOT_OAUTH_TOKEN || '';

const asi = new App({
  signingSecret: signingSecret,
  token: botOAuthToken,
  logLevel: LogLevel.ERROR,
});

asi.message(async ({message, say}) => {
  const sender = message.user;
  const msg = message.text;

  // If message contain no text, do nothing.
  if (msg === undefined) {
    return
  }

  // message contain `ごみ` it asks next cleaning role
  if(msg.match('ごみ')){
    // message contain `ごみ` & `終` it tells finishing cleaning role
    const gomiWorkers = await getGomiWorkers();
    if (msg.match('終') && isGomiWorker(sender, gomiWorkers)) {
      await asi.client.reactions.add({
        token: botOAuthToken,
        channel: message.channel,
        name: '+1',
        timestamp: message.ts
      });
      await say(`<@${sender}>さんありがとうございます！`);
      return
    }
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
