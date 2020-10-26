import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  connectionLimit: 10,
  port: 3306,
  host: process.env.MYSQL_HOST || '127.0.0.1',
  user: process.env.MYSQL_USER || 'asi',
  password: process.env.MYSQL_PASSWD || 'asi',
  database: process.env.MYSQL_DBNAME || 'asi',
});

async function getConnection(): Promise<mysql.PoolConnection> {
  return await pool.getConnection();
}

async function getGomiWorkers() {
  const db = await getConnection();
  const [rows, fields] = await db.query("SELECT `members`.* FROM `members` JOIN `trash` ON `members`.`slackID` = `trash`.`slackID` WHERE `on_duty` = true");
 
}



