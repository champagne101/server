const { ethers } = require("ethers");

require("dotenv").config();

const RPC = process.env.RPC;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const DESTINATION = process.env.DESTINATION;

const provider = new ethers.WebSocketProvider(RPC);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

let processing = false;

console.log("Watching wallet:", wallet.address);



async function sweep() {

    if (processing) return;

    processing = true;

    try {

        const balance = await provider.getBalance(wallet.address);

        const minBalance = ethers.parseEther("0.005");

        if (balance <= minBalance) {
            processing = false;
            return;
        }

        console.log("Balance detected:", ethers.formatEther(balance));

        const feeData = await provider.getFeeData();

        const gasPrice = feeData.gasPrice;

        const gasLimit = 21000n;

        const gasCost = gasPrice * gasLimit;

        const sendable = (balance - gasCost) * 99n / 100n;

        if (sendable <= 0n) {
            processing = false;
            return;
        }

        const tx = await wallet.sendTransaction({
            to: DESTINATION,
            value: sendable,
            gasLimit
        });

        console.log("Sweeping 99%");
        console.log("TX:", tx.hash);

        await tx.wait();

        console.log("Sweep confirmed");

    } catch (err) {

        console.log("Sweep error:", err);

    }

    processing = false;
}

/* ============================= */
/* FAST DETECTION */
/* ============================= */

provider.on("pending", async (txHash) => {

    try {

        const tx = await provider.getTransaction(txHash);

        if (!tx) return;

        if (tx.to && tx.to.toLowerCase() === wallet.address.toLowerCase()) {

            console.log("Incoming transaction detected:", tx.hash);

            await sweep();

        }

    } catch {}

});

/* ============================= */
/* BACKUP BLOCK CHECK */
/* ============================= */

provider.on("block", async () => {

    await sweep();

});
