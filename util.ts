import childProcess from "child_process";
import log4js from "log4js";
import util from "util";
import { Member } from "./types";

export function getRandomInt(max: number): number {
  return Math.floor(Math.random()*Math.floor(max));
}

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
});

export const dbLogger = log4js.getLogger('db');
export const accessLogger = log4js.getLogger('access');

export const execFile = util.promisify(childProcess.execFile);

export function generateMessage(workers: Member[]): string {
  return `次回のごみ捨て当番は${workers[0].name}(<@${workers[0].slackID}>)さん、${workers[1].name}(<@${workers[1].slackID}>)さんです。`
}