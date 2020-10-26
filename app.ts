import { App } from "@slack/bolt"


const asi = new App({
  signingSecret: '',
  token: ''
});

asi.message( async ({message, say}) => {
  const msg = message.text;
  if(msg?.match('ごみ')) {
    // await getGomiWorkers(); 
    await say(`次回のゴミ当番はです。`);
  }
});

( async () => {
  await asi.start(process.env.ASI_PORT || 3000);
  console.log('⚡ asi powered by @slack/bolt is running ⚡');
})();