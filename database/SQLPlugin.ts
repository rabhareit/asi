import {
  MySQLQueryable,
  MySQLResultRows,
  Easteregg,
  Member,
} from "../shared/types";
import { getRandomInt, dbLogger } from "../shared/util";

/**
 * This module is for bot with fastify
 */

/**
 * Choose two menbers randomly as a next cleaning role.
 * Selected member should be different grade.
 *
 * @param rows (MySQLResultRows) : Result rows implicitly Listed Member object
 * @returns [guri, gura] (Array<Member>) : Next cleaning role.
 */
function chooseTwin(rows: MySQLResultRows): Member[] {
  const guri = rows[getRandomInt(rows.length)] as Member;
  let cand = rows.filter((row) => row.grade !== guri.grade);
  if (cand.length < 1) {
    cand = rows.filter((row) => row.slackID !== guri.slackID);
  }
  const gura = cand[getRandomInt(cand.length)] as Member;
  return [guri, gura];
}

/**
 * Return Member object who has given slackID
 *
 * @param db (MySQLQueryable) : Database connection object
 * @param slackId (string) : slackID that identify member
 *
 * @returns row (Member|null) : `Member` object or null in `Promise
 */
export async function getMemberBySlackID(
  db: MySQLQueryable,
  slackId: string
): Promise<Member | null> {
  const [rows] = await db.query("SELECT * FROM `members` WHERE slackID = ?", [
    slackId,
  ]);
  for (const row of rows) {
    return row as Member;
  }
  return null;
}

/**
 * Return `Member` object on duty of cleaning.
 *
 * @param db (MySQLQueryable)  : Database connection object
 *
 * @returns gomiWorkers (Array<Member>| null) : Listed `Member` object or null in `Promise`
 */
export async function getGomiWorkers(
  db: MySQLQueryable
): Promise<Member[] | null> {
  const [rows] = await db.query(
    "SELECT `members`.* FROM `members` JOIN `trash` ON `members`.`slackID` = `trash`.`slackID` WHERE `on_duty` = true"
  );
  const gomiWorkers: Member[] = rows.map((row) => row as Member);
  return gomiWorkers;
}

/**
 * Update next cleaning role and return `Member` object of next role.
 *
 * @param db (MySQLQueryable)  : Database connection object
 * @returns guriToGura (Array<Member>|null) : Listed `Member` object or null in `Promise`
 */
export async function updateGomiWorkers(
  db: MySQLQueryable
): Promise<Member[] | null> {
  const gomiWorkers = await getGomiWorkers(db);
  if (!gomiWorkers) {
    return null;
  }
  await db.query(
    "UPDATE `easteregg` SET `count` = `count`+1 WHERE `slackID` = ? OR `slackID` = ?",
    [gomiWorkers[0].slackID, gomiWorkers[1].slackID]
  );
  // TODO Which should it be judged by `slackID` or `on_duty`?
  await db.query("UPDATE `trash` SET `on_duty` = FALSE WHERE `on_duty` = TRUE");
  const [rows] = await db.query(
    "SELECT `members`.* FROM `members` JOIN `trash` ON `members`.`slackID` = `trash`.`slackID` WHERE `trash`.`done_in_loop` = FALSE"
  );

  // TODO Should consider when update `on_duty` and `done_in_loop`
  let guriToGura: Member[] | null = null;
  if (rows.length === 0) {
    guriToGura = await restartLoop(db);
  } else if (rows.length === 1) {
    guriToGura = await restartLoop(db, rows[0] as Member);
  } else if (rows.length > 1) {
    guriToGura = chooseTwin(rows);
    await db.query(
      "UPDATE `trash` SET `on_duty` = TRUE, `done_in_loop` = TRUE WHERE `slackID` = ?",
      [guriToGura[0].slackID]
    );
    await db.query(
      "UPDATE `trash` SET `on_duty` = TRUE, `done_in_loop` = TRUE WHERE `slackID` = ?",
      [guriToGura[1].slackID]
    );
    dbLogger.info({
      status: true,
      method: "updateGomiWorkers",
      sql: "update",
      target: [guriToGura[0].slackID, guriToGura[1].slackID],
      columns: ["trash.on_duty", "trash.done_in_loop"],
    });
  }

  if (!guriToGura) {
    dbLogger.error({
      status: false,
      msg: "updateGomiWorkers(), Cannot find next GomiWorker",
    });
    return null;
  }

  return guriToGura;
}

/**
 * Update next cleaning role and return `Member` object of next role.
 * When all members assigned, reset status and assign again.
 *
 * @param db (MySQLQueryable)  : Database connection object
 * @param partner (Member)     : If there is one member who is not assigned in loop,
 *                               this value is passed, and is considered as one of
 *                               next cleaning role.
 * @returns [guri, gura] (Array<Member>|null) : Listed `Member` object or null in `Promise`
 */
export async function restartLoop(
  db: MySQLQueryable,
  partner?: Member
): Promise<Member[] | null> {
  await db.query(
    "UPDATE `trash` SET `on_duty` = false, `done_in_loop` = false"
  );
  const [rows] = await db.query("SELECT * FROM `members`");

  // TODO SHOULD implove this code block
  let guri: Member, gura: Member;
  if (partner) {
    guri = partner;
    const cand = rows.filter((row) => row.grade !== guri.grade);
    gura = cand[getRandomInt(cand.length)] as Member;
    await db.query("UPDATE `trash` SET `on_duty` = TRUE WHERE `slackID` = ?", [
      guri.slackID,
    ]);
    await db.query(
      "UPDATE `trash` SET `on_duty` = TRUE, `done_in_loop` = TRUE WHERE `slackID` = ?",
      [gura.slackID]
    );
    dbLogger.info(
      {
        status: true,
        method: "restartLoop1",
        sql: "update",
        target: [guri.slackID],
        columns: ["trash.on_duty"],
      },
      {
        status: true,
        method: "restartLoop2",
        sql: "update",
        target: [gura.slackID],
        columns: ["trash.on_duty", "trash.done_in_loop"],
      }
    );
  } else {
    guri = rows[getRandomInt(rows.length)] as Member;
    const cand = rows.filter((row) => row.grade !== guri.grade);
    gura = cand[getRandomInt(cand.length)] as Member;
    await db.query(
      "UPDATE `trash` SET `on_duty` = TRUE, `done_in_loop` = TRUE WHERE `slackID` = ? or `slackID` = ?",
      [guri.slackID, gura.slackID]
    );
    dbLogger.info({
      status: true,
      method: "restartLoop3",
      sql: "update",
      target: [guri.slackID, gura.slackID],
      columns: ["trash.on_duty", "trash.done_in_loop"],
    });
  }
  return [guri, gura];
}

/**
 * Update number of given member did cleaning role.
 *
 * @param db (MySQLQueryable)  : Database connection object
 * @param slackID (string)     : Unique SlackID that identify member
 */
export async function countMetion(
  db: MySQLQueryable,
  slackID: string
): Promise<void> {
  await db.query(
    "UPDATE `easteregg` SET `mentions` = `mentions` + 1 WHERE `slackID` = ?",
    [slackID]
  );
}

/**
 * Return number of given member did cleaning role.
 *
 * @param db (MySQLQueryable)  : Database connection object
 * @param slackID (string)     : Unique slackID that identify member
 *
 * @returns ee.count (number|null) Number of they did cleaning role or `null` in `Promise`
 */
export async function getGomiCount(
  db: MySQLQueryable,
  slackID: string
): Promise<number | null> {
  const [rows] = await db.query(
    "SELECT * FROM `easteregg` WHERE `slackID` = ?",
    [slackID]
  );
  for (const row of rows) {
    const ee = row as Easteregg;
    return ee.count;
  }
  return null;
}

/**
 * Return number of given member mentioned to this bot.
 *
 * @param db (MySQLQueryable)  : Database connectin object
 * @param slackID (string)     : Unique slackID that identify member
 *
 * @returns ee.mentions (number|null) : Number of they mentioned or `null` in `Promise`
 */
export async function getMentionCount(
  db: MySQLQueryable,
  slackID: string
): Promise<number | null> {
  const [rows] = await db.query(
    "SELECT * FROM `easteregg` WHERE `slackID` = ?",
    [slackID]
  );
  for (const row of rows) {
    const ee = row as Easteregg;
    return ee.mentions;
  }
  return null;
}
