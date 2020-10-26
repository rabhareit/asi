/**
 * Database object's types/interfaces that are used by fastify
 */
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

/**
 * Structure of `member` table
 */
export interface Member {
  slackID: string,
  name: string,
  kana: string,
  grade: string
}

/**
 * Simple version of `member` table
 */
export interface MemberSimple {
  id: string,
  name: string
}

/**
 * Structure of `easteregg` table
 */
export interface Easteregg {
  id: string,
  count: number,
  mentions: number
}

/**
 * Request body structure of verification event.
 */
export interface VerificationBody {
  token: string,
  challenge: string,
  type: string
}

/**
 * Common options of slack event notification body.
 */
export interface SlackEvent extends BasicEventBody {
  type: string,
  event_ts: string,
  user: string,
  ts: string,
  item?: string | Object
}

/**
 * Structure of `message` event notification body
 */
export interface SlackMessageEvent extends SlackEvent{
  // type: string,
  channel: string,
  // user: string,
  text: string,
  // ts: string,
  // event_ts: string,
  channel_type: string
}

export interface SlackEventAuthorizations extends BasicEventBody {
  enterprise_id: string,
  team_id: string,
  user_id: string,
  is_bot: boolean
}

/**
 * TODO: What's this???
 */
export interface SlackEventBody extends BasicEventBody {
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

/**
 * Arguments necessary for sending message via slack API
 * For detail, see official documents of `chat.postMessage` method
 * https://api.slack.com/methods/chat.postMessage
 */
export interface PostMessageRequest extends BasicEventBody {
  // Bot user oauth token
  token: string,
  // Channel ID or name
  channel: string,
  // Message you would like to send(This value should be a single String value)
  text: string,
  // Deprecated argument
  as_user?: boolean,                     
  // Make interface detail If you need
  attachments?: PostMessageAttachment[],
  // Make interface detail If you need
  blocks?: Object[],
  // This value will be ignored in newer token
  icon_emoji?: string,
  icon_url?: string,
  link_names?: boolean,
  // Which you send message as markdown or not(`true` means markdown)
  mrkdwn?: boolean,
  parse?: string,
  // Which this reply visible to everyone or not
  reply_broadcast?: boolean,
  thread_ts?: string,
  unfurl_links?: boolean,
  unfurl_media?: boolean,
  username?: string
}

/**
 * Detail structure of `PostMessageAttachment` in above interface
 */
export interface PostMessageAttachment extends BasicEventBody {
  pretext?: string,
  text?: string
}

/**
 * Response body structure of `chat.postMessage` slack API method
 */
export interface SlackAPIResponse extends BasicEventBody {
  ok: boolean,
  error?: string
  channel?: string,
  ts?: string,
  message?: SlackMessage,
  warning?: string
}

/**
 * Detail structure of `SlackMessage` in above interface
 */
interface SlackMessage extends BasicEventBody {
  text?: string,
  user?: string,
  bot_id?: string,
  attachments?: [
    {
      text?: string,
      id?: string,
      fallback?: string
      [key: string]: any
    }
  ],
  type?: string,
  subtype?: string,
  ts?: string
}
/**
 * Simple version of `SlackAPIResponse` interface
 */
export interface SlackAPIResponseSimple {
  status: boolean,
  ts?: string,
  error?: string,
  warning?: string
}

/**
 * TODO: Consider well this is really necessary or not
 */
interface BasicEventBody {
  [key: string]: any
}