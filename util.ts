import log4js from "log4js";

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
