export type MySQLResultRows = Array<any> & { insertId: number};
export type MySQLColumnCatalogs = Array<any>;
export type MySQLResultSet = [MySQLResultRows, MySQLColumnCatalogs];

export interface MySQLQueryable {
  query(sql: string, param?: ReadonlyArray<any>): Promise<MySQLResultSet>;
}

export interface MySQLClient extends MySQLQueryable {
  beginTransaction(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  release(): Promise<void>;
}

export interface Member {
  slackID: string,
  name: string,
  kana: string,
  grade: string
}

export interface MemberSimple {
  id: string,
  name: string
}

export interface Easteregg {
  id: string,
  count: number,
  mentions: number
}

export interface VerificationBody {
  token: string,
  challenge: string,
  type: string
}

export interface SlackEvent {
  type: string,
  event_ts: string,
  user: string,
  ts: string,
  item?: string | Object
}

export interface SlackMessageEvent extends SlackEvent{
  // type: string,
  channel: string,
  // user: string,
  text: string,
  // ts: string,
  // event_ts: string,
  channel_type: string
}

export interface SlackEventAuthorizations {
  enterprise_id: string,
  team_id: string,
  user_id: string,
  is_bot: boolean
}

export interface SlackEventBody {
  token: string,
  team_id: string,
  api_app_id: string,
  event: SlackEvent,
  type: string,
  authed_users?: string[],
  authed_teams?: string[],
  authorizations?: SlackEventAuthorizations,
  event_context?: string,
  event_id: string,
  event_time: number
}
