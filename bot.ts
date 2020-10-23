import createFastify, {FastifyRequest, FastifyReply} from "fastify";
// @ts-ignore
import fastifyMysql from "fastify-mysql";
import fastifyStatic from "fastify-static";

import axios from "axios";
import { ServerResponse } from "http";
import path from "path";
import log4js from "log4js";

import { SlackEventBody } from "./types";
import { syncBuiltinESMExports } from "module";
import { access } from "fs";

type MySQLResultRows = Array<any> & { insertId: number};
type MySQLColumnCatalogs = Array<any>;
type MySQLResultSet = [MySQLResultRows, MySQLColumnCatalogs];

interface MySQLQueryable {
  query(sql: string, param?: ReadonlyArray<any>): Promise<MySQLResultSet>;
}

interface MySQLClient extends MySQLQueryable {
  beginTransaction(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  release(): Promise<void>;
}

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
  user: process.env.MYSQL_USER || 'asi',
  password: process.env.MYSQL_PASSWD || 'asi',
  database: process.env.MYSQL_DBNAME || 'asi',
  pool: 100,
  promise: true
});

log4js.configure({
  appenders: {
    system: {type: 'file', filename: 'private/default.log'},
    db: {type: 'file', filename: 'private/db.transaction.log'},
    access: {type: 'file', filename: 'private/access.log'},
    debug: {type: 'file', filename: 'private/debug.log'}
  },
  categories: {
    default: {appenders: ['system'], level: 'info'},
    db: {appenders: ['db'], level: 'info'},
    access: {appenders: ['access'], level: 'info'},
    debug: {appenders: ['debug'], level: 'debug'}
  }
})
const dbLogger = log4js.getLogger('db');
const accessLogger = log4js.getLogger('access');

function getRandomInt(max: number): number {
  return Math.floor(Math.random()*Math.floor(max));
}

interface VerificationBody {
  token: string,
  challenge: string,
  type: string
}

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

interface Member {
  slackID: string,
  name: string,
  kana: string,
  grade: string
}

interface MemberSimple {
  id: string,
  name: string
}

interface Easteregg {
  id: string,
  count: number,
  mentions: number
}

async function getDBConnection(): Promise<MySQLClient> {
  return fastify.mysql.getConnection();
}

async function getMemberBySlackID(db: MySQLQueryable, slackId: string): Promise<Member | null> {
  /**
   * Return `Member` object who has given slackID
   * 
   * Args:
   *  db(MySQLQueryable)  : Database object
   *  slackID(string)     : Unique slackID
   * 
   * Return:
   *  `Member` object or null in `Promise`
   */
  const [rows,] = await db.query("SELECT * FROM `members` WHERE slackID = ?", [slackId]);
  for (const row of rows) {
    return row as Member;
  }
  return null;
}

async function getGomiWorkers(db: MySQLQueryable): Promise<Member[] | null> {
  /**
   * Return `Member` object on duty of cleaning.
   * 
   * Args:
   *  db(MySQLQueryable)  : Database object
   * 
   * Return:
   *  Listed `Member` object or null in `Promise`
   */
  const [rows,] = await db.query("SELECT `members`.* FROM `members` JOIN `trash` ON `members`.`slackID` = `trash`.`slackID` WHERE `on_duty` = true");
  const gomiWorkers: Member[] = rows.map( row => row as Member);
  return gomiWorkers;
}

async function updateGomiWorkers(db: MySQLQueryable): Promise<Member[] | null> {
  /**
   * Update next cleaning role and return `Member` object of next role.
   * 
   * Args:
   *  db(MySQLQueryable)  : Database object
   * 
   * Return:
   *  Listed `Member` object or null in `Promise`
   */
  const gomiWorkers = await getGomiWorkers(db);
  if (!gomiWorkers) {
    return null;
  }
  await db.query("UPDATE `easteregg` SET `count` = `count`+1 WHERE `slackID` = ? OR `slackID` = ?", [gomiWorkers[0].slackID, gomiWorkers[1].slackID]);
  // TODO Which should it be judged by `slackID` or `on_duty`?
  await db.query("UPDATE `trash` SET `on_duty` = FALSE WHERE `on_duty` = TRUE");
  const [rows,] = await db.query("SELECT `members`.* FROM `members` JOIN `trash` ON `members`.`slackID` = `trash`.`slackID` WHERE `trash`.`done_in_loop` = FALSE");

  // TODO Should consider when update `on_duty` and `done_in_loop` 
  let guriToGura: Member[] | null = null;
  if (rows.length === 0) {
    guriToGura =  await restartLoop(db);
  } else if (rows.length === 1) {
    guriToGura = await restartLoop(db, rows[0] as Member);
  } else if (rows.length > 1) {
    guriToGura = chooseTwin(rows);
    await db.query("UPDATE `trash` SET `on_duty` = TRUE, `done_in_loop` = TRUE WHERE `slackID` = ?", [guriToGura[0].slackID]);
    await db.query("UPDATE `trash` SET `on_duty` = TRUE, `done_in_loop` = TRUE WHERE `slackID` = ?", [guriToGura[1].slackID]);  
    dbLogger.info({
      status: true, 
      method: 'updateGomiWorkers',
      sql: 'update',
      target: [guriToGura[0].slackID, guriToGura[1].slackID],
      columns: ['trash.on_duty', 'trash.done_in_loop']
    });
  }
  
  if (!guriToGura){
    dbLogger.error({status: false, msg: 'updateGomiWorkers(), Cannot find next GomiWorker'})
    return null;
  }

  return guriToGura;
}

function chooseTwin(rows: MySQLResultRows): Member[] {
  const guri = rows[getRandomInt(rows.length)] as Member;
  let cand = rows.filter( row => row.grade !== guri.grade);
  if (cand.length < 1) {
    cand = rows.filter( row => row.slackID !== guri.slackID);
  }
  const gura = cand[getRandomInt(cand.length)] as Member;
  console.log(rows, cand);
  return [guri, gura];
}

async function restartLoop(db: MySQLQueryable, partner?: Member): Promise<Member[] | null> {
  /**
   * Update next cleaning role and return `Member` object of next role.
   * When all members assigned, reset status and assign again.
   * 
   * Args:
   *  db(MySQLQueryable)  : Database object
   *  partner(Member)     : If there is one member who is not assigned in loop,
   *                        this value is passed, and is considered as one of 
   *                        next cleaning role.
   * 
   * Return:
   *  Listed `Member` object or null in `Promise`
   */
  await db.query("UPDATE `trash` SET `on_duty` = false, `done_in_loop` = false");
  const [rows,] = await db.query("SELECT * FROM `members`");
  
  // TODO SHOULD implove this code block
  let guri: Member, gura: Member;
  if (partner) {
    guri = partner;
    const cand = rows.filter( row => row.grade !== guri.grade);
    gura = cand[getRandomInt(cand.length)] as Member;
    await db.query("UPDATE `trash` SET `on_duty` = TRUE WHERE `slackID` = ?", [guri.slackID])
    await db.query("UPDATE `trash` SET `on_duty` = TRUE, `done_in_loop` = TRUE WHERE `slackID` = ?", [gura.slackID]);
    dbLogger.info({
      status: true, 
      method: 'restartLoop1',
      sql: 'update',
      target: [guri.slackID],
      columns: ['trash.on_duty']
    },{
      status: true, 
      method: 'restartLoop2',
      sql: 'update',
      target: [gura.slackID],
      columns: ['trash.on_duty', 'trash.done_in_loop']
    });
  } else {
    guri = rows[getRandomInt(rows.length)] as Member
    const cand = rows.filter( row => row.grade !== guri.grade);
    gura = cand[getRandomInt(cand.length)] as Member;
    await db.query("UPDATE `trash` SET `on_duty` = TRUE, `done_in_loop` = TRUE WHERE `slackID` = ? or `slackID` = ?", [guri.slackID, gura.slackID]);
    dbLogger.info({
      status: true,
      method: 'restartLoop3',
      sql: 'update',
      target: [guri.slackID, gura.slackID],
      columns: ['trash.on_duty', 'trash.done_in_loop']
    });
  }
  return [guri, gura];
}

async function countMetion(db: MySQLQueryable, slackID: string): Promise<void> {
  /**
   * Update number of given member did cleaning role.
   * 
   * Args:
   *  db(MySQLQueryable)  : Database object
   *  slackID(string)     : Unique SlackID
   */
  await db.query("UPDATE `easteregg` SET `mentions` = `mentions` + 1 WHERE `slackID` = ?", [slackID]);
}

async function getGomiCount(db: MySQLQueryable, slackID: string): Promise<number | null> {
  /**
   * Return number of given member did cleaning role. 
   * 
   * Args:
   *  db(MySQLQueryable)  : Database object
   *  slackID(string)     : Unique slackID
   * 
   * Return:
   *  Number of they did cleaning role or `null` in `Promise`
   */
  const [rows,] = await db.query("SELECT * FROM `easteregg` WHERE `slackID` = ?", [slackID]);
  for (const row of rows) {
    const ee = row as Easteregg;
    return ee.count;
  }
  return null;
}

async function getMentionCount(db: MySQLQueryable, slackID: string): Promise<number | null> {
  /**
   * Return number of given member mentioned to this bot. 
   * 
   * Args:
   *  db(MySQLQueryable)  : Database object
   *  slackID(string)     : Unique slackID
   * 
   * Return:
   *  Number of they mentioned or `null` in `Promise`
   */
  const [rows,] = await db.query("SELECT * FROM `easteregg` WHERE `slackID` = ?", [slackID]);
  for (const row of rows) {
    const ee = row as Easteregg;
    return ee.mentions;
  }
  return null; 
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