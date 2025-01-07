import {
  Address,
  beginCell,
  Cell,
  contractAddress,
  StateInit,
} from "@ton/core";
import compiledContract from "../build/main.compiled.json" with { type: "json" };

export const TESTNET = !process.env.MAINNET;
const getCodeCell = () => Cell.fromHex(compiledContract.hex);
export type StateConfig = {
  initialCount: number;
  initialAddress: Address;
};
export const getStateInit = (config: StateConfig) =>
  ({
    code: getCodeCell(),
    data: beginCell()
      .storeUint(config.initialCount, 32)
      .storeAddress(config.initialAddress)
      .endCell(),
  }) satisfies StateInit;

export const getAddress = (config: StateConfig) =>
  contractAddress(0, getStateInit(config));
