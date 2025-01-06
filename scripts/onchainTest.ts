import { getAddress, TESTNET } from "./shared";
import { getHttpV4Endpoint } from "@orbs-network/ton-access";
import { Address, toNano, TonClient4 } from "@ton/ton";
import qrcodeTerminal from "qrcode-terminal";

const sleep = (timeoutms: number): Promise<void> =>
  new Promise<void>((res) => setTimeout(res, timeoutms));
async function onchainTestScript() {
  const address = getAddress();

  const client4 = new TonClient4({
    endpoint: await getHttpV4Endpoint({
      network: TESTNET ? "testnet" : "mainnet",
    }),
  });
  const latestBlock = await client4.getLastBlock();
  const status = await client4.getAccount(latestBlock.last.seqno, address);

  if (status.account.state.type !== "active") {
    console.error("Contract is not active");
    return;
  }

  let archivedAddress: Address | null = null;
  const link =
    "https://app.tonkeeper.com/transfer/" +
    address.toString({ testOnly: TESTNET }) +
    "?" +
    new URLSearchParams([
      ["text", "test transaction"],
      ["amount", toNano("0.01").toString(10)],
    ]).toString();
  qrcodeTerminal.generate(link, { small: true }, console.log);
  while (true) {
    await sleep(2_000);

    const latestBlock = await client4.getLastBlock();
    const { exitCode, result } = await client4.runMethod(
      latestBlock.last.seqno,
      address,
      "get_the_latest_sender"
    );
    if (exitCode !== 0) {
      console.log("unknown exit code");
      continue;
    }
    if (result[0].type !== "slice") {
      console.log("unknown result type: " + JSON.stringify(result));
      continue;
    }
    const mostRecentSender = result[0].cell.beginParse().loadAddress();

    if (
      mostRecentSender &&
      mostRecentSender.toString() !== archivedAddress?.toString()
    ) {
      console.log(
        "address has changed: " + mostRecentSender.toString({ testOnly: true })
      );
      archivedAddress = mostRecentSender;
    }
  }
}
onchainTestScript();
