import createFastify, {FastifyRequest, FastifyReply} from "fastify";
// @ts-ignore
import fastifyMysql from "fastify-mysql";
import fastifyStatic from "fastify-static";

import axios from "axios";

import {
  countMetion,
  getGomiWorkers,
  restartLoop,
  updateGomiWorkers,
} from "./SQLRepository";

import {
  MySQLClient,
  MySQLQueryable,
  VerificationBody
} from "./types";

declare module "fastify" {
  interface FastifyInstance {
    mysql: MySQLQueryable & {
        getConnection(): Promise<MySQLClient>;
    };
  }

  interface FastifyRequest {
      // add types if needed
  }

  interface FastifyReply {
      // add types if needed
  }
}

const fastify = createFastify({
  logger: {level: 'warn'}
});

// fastify.register(fastifyStatic, {
//   root: path.join(__dirname, "public")
// });

fastify.register(fastifyMysql, {
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: process.env.MYSQL_PORT || '3306',
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWD || '',
  database: process.env.MYSQL_DBNAME || '_shiftbot',
  pool: 100,
  promise: true
});

const isVerificationRequest = (request: any): request is VerificationBody => {
  /**
   * Check given object is assignable to `VerificationBody` or not.
   * 
   * Arg:
   *  request(any)  : Any object.
   * 
   * Return:
   *  If given object is assignable to `VerificationBody`, return `true`, otherwise `false`.
   */
  if (!request) return false;
  if (typeof request === 'object') {
    if (
        'token' in request && typeof request['token'] === 'string' &&
        'challenge' in request && typeof request['challenge'] === 'string' &&
        'type' in request && typeof request['type'] === 'string'
    ) {
      return true;
    }
  }
  return false;
}

async function getDBConnection(): Promise<MySQLClient> {
  return fastify.mysql.getConnection();
}

// Routings
fastify.post('/verification', verification);
fastify.post('/initialize', postInitialize);
fastify.post('/gomi', sendGomiWorker);
fastify.post('/update', updateGomi);
fastify.post('/restart', restartGomi);

fastify.get('/', accessHome);
// For browser debug
fastify.get('/gomi', sendGomiWorker);
fastify.get('/update', updateGomi);
fastify.get('/restart', restartGomi);

// Routing functions
async function verification(req: FastifyRequest, reply: FastifyReply) {
  if (isVerificationRequest(req.body)) {
    const rb: VerificationBody = req.body;

    const res = {
      challenge: rb['challenge']
    }
  
    reply
      .code(200)
      .type('application/json')
      .send(res);
  }
  reply
    .code(500)
    .type('application/json')
    .send({msg: 'Cannot handle reqested data.', requested: req.body});
}

async function postInitialize() {
  
}

async function sendGomiWorker(req: FastifyRequest, reply: FastifyReply) {
  const db = await getDBConnection();
  const workers = await getGomiWorkers(db);

  let message, channel;
  if (workers){
    message = `次回のごみ捨て当番は${workers[0].name}さん、${workers[1].name}さんです。`
    channel = 'random';
  } else {
    message = ':damesou:';
    channel = 'ULMK1UHJS';
  }

  const slackReq = {
    token: 'BOT_OAUTH_TOKEN',
    channel: channel,
    text: message,
    as_user: false
  }

  // const eventBody = req.body as SlackEventBody;
  // const slackRes = await axios.post('POST_MESSAEG_DEST', slackReq);
  // const loggingObj = {
  //   status: slackRes.status,
  //   request: eventBody,
  //   apiResponse: slackRes.data
  // }
  let sender = 'ULMK1UHJS';
  await countMetion(db, sender);
  await db.release();

  reply
    .code(200)
    .type('application/json')
    .send(slackReq);
}

async function updateGomi(req: FastifyRequest, reply: FastifyReply) {
  const db = await getDBConnection();
  const workers = await updateGomiWorkers(db);  

  let message, channel;
  if (workers){
    message = `次回のごみ捨て当番は${workers[0].name}さん、${workers[1].name}さんです。`
    channel = 'random';
  } else {
    message = ':damesou:';
    channel = 'ULMK1UHJS';
  }

  const slackReq = {
    token: 'BOT_OAUTH_TOKEN',
    channel: channel,
    text: message,
    as_user: false
  }

  // const eventBody = req.body as SlackEventBody;
  // const slackRes = await axios.post('POST_MESSAEG_DEST', slackReq);
  // const loggingObj = {
  //   status: slackRes.status,
  //   request: eventBody,
  //   apiResponse: slackRes.data
  // }
  let sender = 'ULMK1UHJS';
  await countMetion(db, sender);
  await db.release();

  reply
    .code(200)
    .type('application/json')
    .send(slackReq);

}

async function restartGomi(req: FastifyRequest, reply: FastifyReply) {
  const db = await getDBConnection();
  const workers = await restartLoop(db);
  
  let message, channel;
  if (workers){
    message = `次回のごみ捨て当番は${workers[0].name}さん、${workers[1].name}さんです。`
    channel = 'random';
  } else {
    message = ':damesou:';
    channel = 'ULMK1UHJS';
  }

  const slackReq = {
    token: 'BOT_OAUTH_TOKEN',
    channel: channel,
    text: message,
    as_user: false
  }

  // const eventBody = req.body as SlackEventBody;
  // const slackRes = await axios.post('POST_MESSAEG_DEST', slackReq);
  // const loggingObj = {
  //   status: slackRes.status,
  //   request: eventBody,
  //   apiResponse: slackRes.data
  // }
  let sender = 'ULMK1UHJS';
  await countMetion(db, sender);
  await db.release();

  reply
    .code(200)
    .type('application/json')
    .send(slackReq);
}

async function accessHome(req: FastifyRequest, reply: FastifyReply) {
  reply
    .code(200)
    .type('application/json')
    .send({status: 'OK'});
}

// Start listening
fastify.listen(3000 , err => {if (err) throw err});