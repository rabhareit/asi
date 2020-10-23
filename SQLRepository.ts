import {
  MySQLQueryable,
  MySQLResultRows,
  Easteregg,
  Member,
} from "./types";
import { getRandomInt, dbLogger } from "./util";

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

export async function getMemberBySlackID(db: MySQLQueryable, slackId: string): Promise<Member | null> {
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

export async function getGomiWorkers(db: MySQLQueryable): Promise<Member[] | null> {
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

export async function updateGomiWorkers(db: MySQLQueryable): Promise<Member[] | null> {
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

export async function restartLoop(db: MySQLQueryable, partner?: Member): Promise<Member[] | null> {
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

export async function countMetion(db: MySQLQueryable, slackID: string): Promise<void> {
  /**
   * Update number of given member did cleaning role.
   * 
   * Args:
   *  db(MySQLQueryable)  : Database object
   *  slackID(string)     : Unique SlackID
   */
  await db.query("UPDATE `easteregg` SET `mentions` = `mentions` + 1 WHERE `slackID` = ?", [slackID]);
}

export async function getGomiCount(db: MySQLQueryable, slackID: string): Promise<number | null> {
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

export async function getMentionCount(db: MySQLQueryable, slackID: string): Promise<number | null> {
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
