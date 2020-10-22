import createFastify, {FastifyRequest, FastifyReply} from "fastify";
// @ts-ignore
import fastifyMysql from "fastify-mysql";
import fastifyStatic from "fastify-static";

import { ServerResponse } from "http";
import path from "path";

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
  release(): void;
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
  id: string,
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

  await db.query("UPDATE `easteregg` SET `count` = `count`+1 WHERE `slackID` = ? OR ?", [gomiWorkers[0].id, gomiWorkers[1].id]);
  await db.query("UPDATE `trash` SET `done_in_loop` = TRUE, `on_duty` = FALSE WHERE `on_duty` = TRUE");
  const [rows,] = await db.query("SELECT `members`.* FROM `members` JOIN `trash` ON `members`.`slackID` = `trash`.`slackID` WHERE `trash`.`done_in_loop` = FALSE");

  if (rows.length == 0) {
    return await restartLoop(db);
  } else if (rows.length == 1) {
    return await restartLoop(db, rows[0] as Member);
  } else if (rows.length > 1) {
    const guri = rows[Math.floor(Math.random()*rows.length)] as Member;
    let cand = rows.filter( row => row.grade !== guri.grade);
    if (cand.length < 1) {
      cand = rows.filter( row => row.id !== guri.id);
    }
    const gura = cand[Math.floor(Math.random()*cand.length)];
    return [guri, gura];
  }
  return null;
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
  const guri = partner ? partner : rows[Math.floor(Math.random()*rows.length)] as Member;
  const cand = rows.filter( row => row.grade !== guri.grade);
  const gura = cand[Math.floor(Math.random()*rows.length)] as Member;
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
fastify.post('/gomi', replyGomi);
fastify.post('/update', updateGomi);
fastify.post('/restart', restartGomi);

fastify.get('/', accessHome);

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

async function replyGomi() {
  
}

async function updateGomi() {
  
}

async function restartGomi() {
  
}

async function accessHome(req: FastifyRequest, reply: FastifyReply) {
  reply
    .code(200)
    .type('application/json')
    .send({status: 'OK'});
}

// Start listening
fastify.listen(3000 , err => {if (err) throw err});