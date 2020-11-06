import Axios from "axios"

import { ChaplusRequest, ChaplusResponse} from './types'

const endpoint = process.env.CHAPLUS_ENDPOINT
const apikey = process.env.CHAPLUS_APIKEY

const dest = `${endpoint}?apikey=${apikey}`

export async function chatting(text: string, sender: string): Promise<string> {
  const header = {
    'Content-type': 'application/json'
  }
  const req: ChaplusRequest = {
    utterance: text,
    username: `${sender}さん`,
    agentState: {
      agentName: 'ごみ捨てbot',
      tone: 'normal',
    }
  }
  
  const res = await Axios.post(dest, req, {headers: header});
  const cplsResp = res.data as ChaplusResponse
  return cplsResp.bestResponse.utterance.replace('さんさん', 'さん');
}
