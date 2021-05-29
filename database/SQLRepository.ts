import mysql from "mysql2/promise";
import { Member } from "../shared/types";
import { getRandomInt, dbLogger } from "../shared/util";

/**
 * This module is for bot with bolt
 */

/**
 * Create database connection pool.
 */
const pool = mysql.createPool({
  connectionLimit: 100,
  port: 3306,
  host: process.env.MYSQL_HOST || "127.0.0.1",
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWD || "root",
  database: process.env.MYSQL_DBNAME || "asi",
});

/**
 * Get connection object from connection pool.
 * @returns connection(mysql.PoolConnection)
 */
async function getConnection(): Promise<mysql.PoolConnection> {
  return await pool.getConnection();
}

/**
 * Return next cleaning role.
 * TODO: assertion or validation that return value is assignable to `Member[2]`
 *
 * @returns Member[] its length == 2
 */
export async function getGomiWorkers(): Promise<Member[]> {
  const db = await getConnection();
  const [rows]: any[] = await db.query(
    "SELECT `members`.* FROM `members` JOIN `trash` ON `members`.`slackID` = `trash`.`slackID` WHERE `on_duty` = true"
  );
  return rows as Member[];
}

/**
 * Return `Member` object who has given slackID
 *
 * @param slackID(string) : Unique slackID
 * @return row(Member|null) : `Member` object or null in `Promise`
 */
export async function getMemberBySlackID(
  slackID: string
): Promise<Member | null> {
  const db = await getConnection();
  const [
    rows,
  ]: any[] = await db.query("SELECT * FROM `members` WHERE slackID = ?", [
    slackID,
  ]);
  // Maybe cause bug
  for (const row of rows) {
    return row as Member;
  }
  return null;
}

/**
 * Update next cleaning role and return `Member` object of next role.
 *
 * @return guriToGura(Array<Member>|null) : Listed `Member` object or null in `Promise`
 */
export async function updateGomiWorkers(): Promise<Member[] | null> {
  const db = await getConnection();
  const gomiWorkers = await getGomiWorkers();
  if (!gomiWorkers) {
    return null;
  }
  await db.query(
    "UPDATE `easteregg` SET `count` = `count`+1 WHERE `slackID` = ? OR `slackID` = ?",
    [gomiWorkers[0].slackID, gomiWorkers[1].slackID]
  );
  // TODO Which should it be judged by `slackID` or `on_duty`?
  await db.query("UPDATE `trash` SET `on_duty` = FALSE WHERE `on_duty` = TRUE");
  const [rows]: any[] = await db.query(
    "SELECT `members`.* FROM `members` JOIN `trash` ON `members`.`slackID` = `trash`.`slackID` WHERE `trash`.`done_in_loop` = FALSE"
  );

  // TODO Should consider when update `on_duty` and `done_in_loop`
  let guriToGura: Member[] | null = null;
  if (rows.length === 0) {
    guriToGura = await restartLoop();
  } else if (rows.length === 1) {
    guriToGura = await restartLoop(rows[0] as Member);
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
 * @param partner(Member): If there is one member who is not assigned in loop,
 *                         this value is passed, and is considered as one of
 *                         next cleaning role.
 * @return Listed `Member` object or null in `Promise`
 */
export async function restartLoop(partner?: Member): Promise<Member[] | null> {
  const db = await getConnection();
  await db.query(
    "UPDATE `trash` SET `on_duty` = false, `done_in_loop` = false"
  );
  const [result]: any[] = await db.query("SELECT * FROM `members`");
  const rows = result as Member[];
  // TODO SHOULD improve this code block
  let guri: Member, gura: Member;
  if (partner) {
    guri = partner;
    // IMPROVE!!
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
 * If there is no proble with changing argument type to Member[]
 * move this to `util.ts`
 *
 * @param rows
 */
function chooseTwin(rows: Member[]): Member[] {
  const guri = rows[getRandomInt(rows.length)] as Member;
  let cand = rows.filter((row) => row.grade !== guri.grade);
  if (cand.length < 1) {
    cand = rows.filter((row) => row.slackID !== guri.slackID);
  }
  const gura = cand[getRandomInt(cand.length)] as Member;
  console.log(rows, cand);
  return [guri, gura];
}
