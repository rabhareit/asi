import { App, LogLevel } from "@slack/bolt";
import { getGomiWorkers } from "./database/SQLRepository";
import { generateMessage, isGomiWorker } from "./shared/util";

import { chatting } from "./api/chaplus";
import { MeMessageEvent } from "@slack/bolt/dist/types/events/message-events";
import { postSlackMessage } from "./api/slack";

const signingSecret = process.env.SLACK_SIGNING_SECRET || "";
const botOAuthToken = process.env.SLACK_BOT_OAUTH_TOKEN || "";

const asi = new App({
  signingSecret: signingSecret,
  token: botOAuthToken,
  logLevel: LogLevel.ERROR,
});

asi.message(async ({ message, say }) => {
  message = message as MeMessageEvent;
  const sender = message.user;
  const msg = message.text;

  // If message contain no text, do nothing.
  if (msg === undefined) {
    return;
  }

  // message contain `ごみ` it asks next cleaning role
  if (msg.match("ごみ")) {
    // message contain `ごみ` & `終` it tells finishing cleaning role
    const gomiWorkers = await getGomiWorkers();
    if (msg.match("終") && isGomiWorker(sender, gomiWorkers)) {
      await asi.client.reactions.add({
        token: botOAuthToken,
        channel: message.channel,
        name: "+1",
        timestamp: message.ts,
      });
      await say(`<@${sender}>さんありがとうございます！`);
      return;
    } else {
      const reply = generateMessage(gomiWorkers);
      await say(reply);
      return;
    }
  } else {
    // Else, reply chatting.
    const reply = await chatting(msg, sender);
    await say(reply);
  }
});

// Show next cleaning workers.
asi.command("/gomi", async ({ command, ack, say }) => {
  // Notify slack app recieves command event request.
  await ack();
  const gomiWorkers = await getGomiWorkers();
  const msg = generateMessage(gomiWorkers);
  await say(msg);
});

// Send remind message to next cleaning workers.
asi.command("/gominotif", async ({ command, ack, say }) => {
  // Notify slack app recieves command event request.
  await ack();
  if (command.user_id === "UU063TWGY") {
    const gomiWorkers = await getGomiWorkers();
    gomiWorkers.forEach((worker) => {
      postSlackMessage(
        worker.slackID,
        "次回のごみ捨て当番です！よろしくお願いします！"
      ).then(async (res) => {
        if (res.status) {
          await say(`${worker.name}さん : :ok_woman: Success!`);
        } else {
          await say(`${worker.name}さん : :no_good: Failed...`);
        }
      });
    });
  } else {
    await say("Sorry, you are not allowed to do this action.");
  }
});

(async () => {
  await asi.start(process.env.ASI_PORT || 3000);
  console.log("⚡ asi powered by @slack/bolt is running ⚡");
  postSlackMessage("test", "random");
})();
