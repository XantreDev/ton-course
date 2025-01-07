import "@ton/test-utils";

import { describe, expect, it } from "vitest";
import compiledContract from "../build/main.compiled.json" with { type: "json" };
import {
  Address,
  beginCell,
  Cell,
  Contract,
  contractAddress,
  ContractProvider,
  Sender,
  SendMode,
  toNano,
} from "@ton/core";
import { Blockchain, BlockchainContractProvider, internal } from "@ton/sandbox";
import { getStateInit, StateConfig } from "../scripts/shared";

class MainContract implements Contract {
  constructor(
    readonly address: Address,
    readonly init?: { code: Cell; data: Cell }
  ) {}

  static create(config: StateConfig): MainContract {
    const workchain = 0;
    const init = getStateInit(config);

    return new MainContract(contractAddress(workchain, init), init);
  }

  // we must use classes because, most of sandbox methods uses prototype chain modification to work
  async sendInternalMessage(
    contractProvider: ContractProvider,
    sender: Sender,
    value: bigint,
    body: Cell = Cell.EMPTY
  ) {
    await contractProvider.internal(sender, {
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      value,
      body,
    });
  }
  async getData(provider: ContractProvider) {
    const { stack } = await provider.get("get_contract_storage_data", []);

    const amount = stack.readNumber();
    const address = stack.readAddress();

    return { amount, recentSender: address };
  }
}

describe("main.fc contract tests", () => {
  it("aboba", async () => {
    const blockchain = await Blockchain.create();
    const initialAddress = blockchain.treasury("initialAddress");
    const initialCount = 0;
    const increment_by = 220;
    const contract = await blockchain.openContract(
      MainContract.create({
        initialCount: initialCount,
        initialAddress: (await initialAddress).address,
      })
    );
    const senderWallet = await blockchain.treasury("sender");

    const transaction = await contract.sendInternalMessage(
      senderWallet.getSender(),
      toNano("0.05"),
      beginCell()
        .storeUint(/* opcode */ 1, 32)
        .storeUint(/* increment_by */ increment_by, 32)
        .endCell()
    );

    expect(transaction.transactions).transaction({
      from: senderWallet.address,
      to: contract.address,
      success: true,
    });

    const { recentSender, amount } = await contract.getData();
    expect(recentSender.toString()).toBe(senderWallet.address.toString());
    expect(amount).toBe(initialCount + increment_by)
  });
});
