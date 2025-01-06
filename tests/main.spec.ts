import "@ton/test-utils"

import {describe, expect, it} from 'vitest'
import compiledContract from '../build/main.compiled.json' with {type: 'json'}
import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode, toNano } from '@ton/core'
import {Blockchain, BlockchainContractProvider, internal} from '@ton/sandbox'


class MainContract implements Contract {
  constructor(
    readonly address: Address,
    readonly init?: {code: Cell; data: Cell}
  ) {}
  
  static create(code: Cell): MainContract {
    const workchain = 0;
    const data = beginCell().endCell()
    const init = {code, data}

    return new MainContract(contractAddress(workchain, init), init)
  }
  
  // we must use classes because, most of sandbox methods uses prototype chain modification to work
  async sendInternalMessage(contractProvider: ContractProvider, sender: Sender, value: bigint) {
    await contractProvider.internal(sender, ({
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      value,
      // sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell().endCell()
    }))
  }
  async getData(provider: ContractProvider) {
    const {stack} = await provider.get("get_the_latest_sender", [])
    return {
      recentSender: stack.readAddress()
    }
  }
}

// const MainContract_sendInternalMessage = async (
//     blockchain: Blockchain,
//     sender: Address,
//     receiver: Address,
//     value: bigint,
//   ) => 

// const MainContract_getData = async (provider: ContractProvider) => {
// }

describe("main.fc contract tests", () => {
  const hexContractCode = compiledContract.hex 

  const codeCell = Cell.fromHex(hexContractCode)
  it("aboba", async () => {
    const blockchain = await Blockchain.create()
    const contract = await blockchain.openContract(MainContract.create(codeCell))
    const senderWallet = await blockchain.treasury('sender')
    
    const transaction = await contract.sendInternalMessage(senderWallet.getSender(), toNano("0.05"))

    expect(transaction.transactions).transaction({
      from: senderWallet.address,
      to: contract.address,
      success: true
    })
    
    const {recentSender} = await contract.getData()
    expect(recentSender.toString()).toBe(senderWallet.address.toString())
  })
})