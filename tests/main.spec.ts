import "@ton/test-utils";

import { beforeEach, describe, expect, it } from "vitest";
import {
  Address,
  beginCell,
  Cell,
  Contract,
  contractAddress,
  ContractProvider,
  ContractState,
  Sender,
  SendMode,
  toNano,
} from "@ton/core";
import { Blockchain, SandboxContract, TreasuryContract } from "@ton/sandbox";
import { getStateInit, StateConfig } from "../scripts/shared";
import { aw } from "vitest/dist/chunks/reporters.D7Jzd9GS.js";

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
    const recentSender = stack.readAddress();
    const ownerAddress = stack.readAddress();

    return { amount, recentSender, ownerAddress };
  }

  async getBalance(provider: ContractProvider) {
    const { stack } = await provider.get("balance", []);

    return stack.readBigNumber();
  }
}

const Contract_sendWithdrawal = (
  contract: SandboxContract<MainContract>,
  sender: Sender,
  value: bigint,
  withdrawAmount: bigint
) =>
  contract.sendInternalMessage(
    sender,
    value,
    beginCell()
      .storeUint(/* withdraw opcode */ 3, 32)
      .storeCoins(withdrawAmount)
      .endCell()
  );

describe("main.fc contract tests", () => {
  let blockchain: Blockchain;

  let ownerAddress: SandboxContract<TreasuryContract>;
  let initialAddress: SandboxContract<TreasuryContract>;
  let contract: SandboxContract<MainContract>;

  const initialCount = 0;

  beforeEach(async () => {
    blockchain = await Blockchain.create();
    ownerAddress = await blockchain.treasury("ownerAddress");
    initialAddress = await blockchain.treasury("initialAddress");

    contract = blockchain.openContract(
      MainContract.create({
        initialCount: initialCount,
        ownerAddress: ownerAddress.address,
        initialAddress: initialAddress.address,
      })
    );
  });
  it("counter increases", async () => {
    const increment_by = 220;

    const senderWallet: SandboxContract<TreasuryContract> =
      await blockchain.treasury("sender");

    const transaction = await contract.sendInternalMessage(
      senderWallet.getSender(),
      toNano("0.05"),
      beginCell()
        .storeUint(/* increment opcode */ 1, 32)
        .storeUint(/* increment_by */ increment_by, 32)
        .endCell()
    );

    expect(transaction.transactions).transaction({
      from: senderWallet.address,
      to: contract.address,
      success: true,
    });

    const contractData = await contract.getData();

    expect(contractData.recentSender.toString()).toBe(
      senderWallet.address.toString()
    );
    expect(contractData.ownerAddress.toString()).toBe(
      ownerAddress.address.toString()
    );

    expect(contractData.amount).toBe(initialCount + increment_by);
  });

  it("balance increases", async () => {
    const senderWallet: SandboxContract<TreasuryContract> =
      await blockchain.treasury("sender");

    const transaction = await contract.sendInternalMessage(
      senderWallet.getSender(),
      toNano("5"),
      beginCell().storeUint(/* deposit opcode */ 2, 32).endCell()
    );

    expect(transaction.transactions).transaction({
      from: senderWallet.address,
      to: contract.address,
      value: toNano("5"),
      success: true,
    });

    const balance = await contract.getBalance();

    expect(Number(balance)).greaterThan(4.99);

    const contractData = await contract.getData();

    expect(contractData.recentSender).equalAddress(initialAddress.address);
    expect(contractData.ownerAddress).equalAddress(ownerAddress.address);

    expect(contractData.amount).toBe(initialCount);
  });

  it("bounces if body is empty", async () => {
    const senderWallet: SandboxContract<TreasuryContract> =
      await blockchain.treasury("sender");

    const transaction = await contract.sendInternalMessage(
      senderWallet.getSender(),
      toNano("5"),
      Cell.EMPTY
    );

    expect(transaction.transactions).transaction({
      from: senderWallet.address,
      to: contract.address,
      value: toNano("5"),
      success: false,
    });
  });

  it("successfully withdraws funds on behalf of owner", async () => {
    const senderWallet: SandboxContract<TreasuryContract> =
      await blockchain.treasury("sender");

    const initialTopUpAmount = toNano("5");
    const transaction = await contract.sendInternalMessage(
      senderWallet.getSender(),
      initialTopUpAmount,
      beginCell().storeUint(/* deposit opcode */ 2, 32).endCell()
    );

    expect(transaction.transactions).transaction({
      from: senderWallet.address,
      to: contract.address,
      value: initialTopUpAmount,
      success: true,
    });

    const withdrawAmount = toNano("2");
    const secondTopUpAmount = toNano("0.1");
    const withdraw = await Contract_sendWithdrawal(
      contract,
      ownerAddress.getSender(),
      secondTopUpAmount,
      withdrawAmount
    );

    expect(withdraw.transactions).transaction({
      from: contract.address,
      to: ownerAddress.address,
      value: withdrawAmount,
      success: true,
    });
    expect(withdraw.transactions).transaction({
      from: ownerAddress.address,
      to: contract.address,
      value: secondTopUpAmount,
      success: true,
    });

    const estimateFees = toNano("0.05");
    expect(Number(await contract.getBalance())).greaterThan(
      Number(
        initialTopUpAmount - withdrawAmount + secondTopUpAmount - estimateFees
      )
    );
  });
  it("fails to withdraw if sender is not owner", async () => {
    await contract.sendInternalMessage(
      (await blockchain.treasury("sender")).getSender(),
      toNano(1),
      beginCell().storeUint(/* deposit opcode */ 2, 32).endCell()
    );

    const hacker = await blockchain.treasury("treasury");

    const withdraw = await Contract_sendWithdrawal(
      contract,
      hacker.getSender(),
      toNano("0.05"),
      toNano("0.5")
    );

    expect(withdraw.transactions).transaction({
      from: hacker.address,
      to: contract.address,
      value: toNano("0.05"),
      success: false,
      exitCode: 103,
    });
  });

  it("fails to withdraw because of lack of balance", async () => {
    const withdraw = await Contract_sendWithdrawal(
      contract,
      ownerAddress.getSender(),
      toNano("0.5"),
      toNano("1")
    );

    expect(withdraw.transactions).transaction({
      from: ownerAddress.address,
      to: contract.address,
      value: toNano("0.5"),
      success: false,
      exitCode: 104,
    });
  });
});
