interface SlackEvent {
  type: string,
  event_ts: string,
  user: string,
  ts: string,
  item?: string | Object
}

interface SlackMessageEvent extends SlackEvent{
  // type: string,
  channel: string,
  // user: string,
  text: string,
  // ts: string,
  // event_ts: string,
  channel_type: string
}

interface SlackEventAuthorizations {
  enterprise_id: string,
  team_id: string,
  user_id: string,
  is_bot: boolean
}

interface SlackEventBody {
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

export {SlackEventBody, SlackEvent, SlackEventAuthorizations}