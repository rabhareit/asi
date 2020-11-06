import createFastify, {FastifyRequest, FastifyReply} from "fastify";
// @ts-ignore
import fastifyMysql from "fastify-mysql";
import fastifyStatic from "fastify-static";

import {
  countMetion,
  getGomiWorkers,
  restartLoop,
  updateGomiWorkers,
} from "./SQLPlugin";

import { postSlackMessage } from "./slackAPIs";

import {
  MySQLClient,
  MySQLQueryable,
  VerificationBody,
  SlackEventBody,
  SlackMessageEvent,
  SlackAPIResponseSimple
} from "./types";

import { execFile, generateMessage } from "./util";

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

/**
 * Check given object is assignable to `VerificationBody` or not.
 * 
 * @param request : Any object
 * @returns boolean : 
 * If given object is assignable to `VerificationBody`, return `true`, 
 * otherwise `false`.
 */
const isVerificationRequest = (request: any): request is VerificationBody => {
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

/**
 * Rountings
 */

// Main functions
fastify.post('/verification', verification);
fastify.post('/event', eventHandler);

//For adomin controll and debug
fastify.post('/initialize', postInitialize);
fastify.post('/gomi', postGomiWorker);
fastify.post('/update', updateGomi);
fastify.post('/restart', restartGomi);

// For README
fastify.get('/', accessHome);

// For browser debug(DELETE THESE)
fastify.get('/get/gomi', postGomiWorker);
fastify.get('/get/update', updateGomi);
fastify.get('/get/restart', restartGomi);

/**
 * Event handling function.
 * 
 * @param req 
 * @param reply 
 */
async function eventHandler(req: FastifyRequest, reply: FastifyReply) {
  if (isVerificationRequest(req.body)) {
    return verification(req, reply);
  }
  
  const eventBody = req.body as SlackEventBody
  // TODO: DANGER!!!
  const msgEvent = eventBody.event as SlackMessageEvent

  // TODO: Check regex
  if (msgEvent.text.match(/ごみ/)){
    return await postGomiWorker(req, reply);
  } else {
    return await chatting(req, reply);
  }
}

/**
 * Verification method.
 * When register URL as a Event subscription destination,
 * Slack send `challenge` parameter in request object.
 * This method immidiately return `challenge` parameter and its value as respond.
 * @param req 
 * @param reply 
 */
function verification(req: FastifyRequest, reply: FastifyReply) {
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

/**
 * Initialize database.
 *  
 * @param req 
 * @param reply 
 */
async function postInitialize(req: FastifyRequest, reply: FastifyReply) {
  await execFile('./db/init.sh');

  //TODO: Error handling
  const res = {
    status: 'OK'
  };

  // May not be needed.
  reply
    .code(200)
    .type('application/json')
    .send(res);

}

/**
 * Send Slack message about next cleaning role.
 * Do not call this directoly. Please wrap it with main event handler.
 * 
 * @param req 
 * @param reply 
 */
async function postGomiWorker(req: FastifyRequest, reply: FastifyReply) {
  const db = await getDBConnection();
  const workers = await getGomiWorkers(db);

  let message, channel;
  if (workers){
    message = generateMessage(workers); 
    channel = 'shiftbot';
  } else {
    message = ':damesou:';
    channel = 'UU063TWGY';
  }

  // const apiRes: SlackAPIResponseSimple = await postSlackMessage(message, channel);

  // // If you would like to log interactions, use following as a sample.
  // const eventBody = req.body as SlackEventBody;
  // const loggingObj = {
  //   status: apiRes.status,
  //   request: eventBody,
  //   msg: apiRes.status ? apiRes.ts : apiRes.error
  // }

  // const senderId = eventBody.event.user;
  // let sender = 'ULMK1UHJS';
  // await countMetion(db, sender);
  await db.release();

  console.log(message)
  reply.code(200);
}

/**
 * Update next cleaning role and send it to Slack.
 * Do not call this directoly. Please wrap this with main event handler.
 * 
 * @param req 
 * @param reply 
 */
async function updateGomi(req: FastifyRequest, reply: FastifyReply) {
  const db = await getDBConnection();
  const workers = await updateGomiWorkers(db);  

  let message, channel;
  if (workers){
    message = generateMessage(workers); 
    channel = 'random';
  } else {
    message = ':damesou:';
    channel = 'ULMK1UHJS';
  }

  // const apiRes = await postSlackMessage(message, channel);

  // // If you would like to log interactions, use following as a sample.
  // const eventBody = req.body as SlackEventBody;
  // const loggingObj = {
  //   status: apiRes.status,
  //   request: eventBody,
  //   msg: apiRes.status ? apiRes.ts : apiRes.error
  // }

  // const senderId = eventBody.event.user;
  // let sender = 'ULMK1UHJS';
  // await countMetion(db, sender);
  await db.release();

  reply
    .code(200)
    .type('application/json')
    .send({msg: message});

}

/**
 * Reset status and restart cycle, 
 * then assign next cleaning role and send it to Slack.
 * Do not call this directly. Please wrap it with main event handler. 
 * @param req 
 * @param reply 
 */
async function restartGomi(req: FastifyRequest, reply: FastifyReply) {
  const db = await getDBConnection();
  const workers = await restartLoop(db);
  
  let message, channel;
  if (workers){
    message = generateMessage(workers); 
    channel = 'random';
  } else {
    message = ':damesou:';
    channel = 'ULMK1UHJS';
  }

  const apiRes = await postSlackMessage(message, channel);

  // // If you would like to log interactions, use following as a sample.
  // const eventBody = req.body as SlackEventBody;
  // const loggingObj = {
  //   status: apiRes.status,
  //   request: eventBody,
  //   msg: apiRes.status ? apiRes.ts : apiRes.error
  // }

  // const senderId = eventBody.event.user;
  // let sender = 'ULMK1UHJS';
  // await countMetion(db, sender);
  await db.release();

  reply
    .code(200)
    .type('application/json')
    .send({msg: message});

}

/**
 * Send response to reqested text.
 * 
 * @param req 
 * @param reply 
 */
async function chatting(req: FastifyRequest, reply: FastifyReply) {
  // TODO
}

async function accessHome(req: FastifyRequest, reply: FastifyReply) {
  reply
    .code(200)
    .type('application/json')
    .send({status: 'OK'});
}

// Start listening
fastify.listen(3000 , err => {if (err) throw err});
