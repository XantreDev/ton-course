
import { Cell, contractAddress, StateInit } from '@ton/core'
import compiledContract from '../build/main.compiled.json' with {type: 'json'}

export const TESTNET = !process.env.MAINNET
const getCodeCell = ()=> Cell.fromHex(compiledContract.hex)
export const getStateInit = (): StateInit => ({
    code: getCodeCell(),
    data: Cell.EMPTY
  })
export const getAddress = () => contractAddress(0, getStateInit())