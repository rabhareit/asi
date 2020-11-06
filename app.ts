import { App } from "@slack/bolt"

const asi = new App({
  signingSecret: process.env.SIGNING_SECRET,
  token: process.env.SLACK_TOKEN
});

asi.message( 'ごみ', async ({message, say}) => {
  const msg = message.text;
  if(msg?.match('ごみ')) {
    // await getGomiWorkers(); 
    await say(`次回のゴミ当番はです。`);
  }
});

asi.command('gomi', async ({say}) => {
  await say('次回のゴミ当番は${}さんです。');
});

( async () => {
  await asi.start(process.env.ASI_PORT || 3000);
  console.log('⚡ asi powered by @slack/bolt is running ⚡');
})();