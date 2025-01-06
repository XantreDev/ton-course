import { beginCell, Cell, contractAddress, StateInit, storeStateInit, toNano } from '@ton/core'
import compiledContract from '../build/main.compiled.json' with {type: 'json'}
import qrTerminal from 'qrcode-terminal'
import {getAddress, getStateInit, TESTNET} from './shared'

const deployScript = async () => {
  const address = getAddress()
  console.log("Deployment QR for " + address + " is here:")
  
  const stateBuilder = beginCell()
  storeStateInit(getStateInit())(stateBuilder)
  const stateInitCell = stateBuilder.endCell()
  
  
  const link = "https://app.tonkeeper.com/transfer/"

  qrTerminal.generate(link + address.toString({testOnly: TESTNET}) + "?" + new URLSearchParams([
    ['text', "Deploy contract"],
    ['amount', toNano('0.05').toString(10)],
    ['init', stateInitCell.toBoc({idx: false}).toString('base64')]
  ]).toString(), {small: true}, console.log)
}

deployScript()