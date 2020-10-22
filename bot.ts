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

  interface VerificationRequest extends FastifyRequest {
    body: VerificationBody
  }

  interface FastifyReply {
      // add types if needed
  }
}

const fastify = createFastify({
  logger: {level: 'warn'}
});

fastify.register(fastifyStatic, {
  root: path.join(__dirname, "public")
});

// fastify.register(fastifyMysql, {
//   host: process.env.MYSQL_HOST || '127.0.0.1',
//   port: process.env.MYSQL_PORT || '3306',
//   user: process.env.MYSQL_USER || '',
//   password: process.env.MYSQL_PASSWD || '',
//   database: process.env.MYSQL_DBNAME || '',
//   pool: 100,
//   promise: true
// });

interface VerificationBody {
  token: string,
  challenge: string,
  type: string
}

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

// APIs
fastify.post('/verification', verification);
fastify.post('/initialize', postInitialize);
fastify.post('/gomi', replyGomi);
fastify.post('/update', updateGomi);
fastify.post('/restart', restartGomi);

fastify.get('/', accessHome);

async function verification(req: FastifyRequest, reply: FastifyReply) {
  // TODO Why I cannot define this as `VerificationBody`
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

fastify.listen(3000 , err => {if (err) throw err});