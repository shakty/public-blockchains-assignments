// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const hre = require("hardhat");

// Node.js File System module.
const fs = require('fs');
const path = require('path');

const ethers = require("ethers");


const ASS5 = ".address.ass5.json";
const MAIN_VALIDATOR = ".address.validator.json";
const REGISTRY = ".address.registry.json";

const _saveAddresses = (addresses, file) => {
    fs.writeFileSync(path.join(__dirname, file),
                     JSON.stringify(addresses));
    console.log("Deployed addresses saved to " + file);
};
const _loadAddresses = (file) => {
    const filePath = path.join(__dirname, file);
    if (!fs.existsSync(filePath)) {
        console.log("No addresses file found. Returning empty array.");
        return [];
    }
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
}

async function main() {

    console.time('Execution Time');

    // 0. Getting signers added in hardhat.config.js
    // Pick the deployer (default is signer1).
    const [signer1, signer2] = await hre.ethers.getSigners();
    const signer = signer1;
    console.log("Signer address: " + signer.address);

    // On-chain validator:
    const validatorAddress = _loadAddresses(MAIN_VALIDATOR)[0]; 
    console.log("Validator address: " + validatorAddress);

    // On-chain registry:
    const registryAddress = '0xa269147eD50Eb19038d88981Fbe408ac39954FBA';
    console.log("Registry address: " + registryAddress);

    // Getting the provider.
    const provider = hre.ethers.provider;


    async function deployAMM(idx=0) {

        // Get the nonce for the next transaction.
        // This is needed to predict the address of the token and AMM contracts.

        // Recommended method.
        let nonce = await provider.getTransactionCount(signer.address, "pending")
        // Less reliable.
        let nonce2 = await signer.getNonce();
        // Compare the two.
        console.log("Current nonce: ", nonce, nonce2);


        // Send all transactions fast, collect their promises
        const txPromises = [];

        // 1. Deploy ERC20 token
        ////////////////////////

        const predictedAddressToken = ethers.getCreateAddress({
            from: signer.address,
            nonce: nonce,
        });
        console.log("Predicted token address: " + predictedAddressToken);

        const coinArtifact = await hre.artifacts.readArtifact("AMMCoin");

        // console.log(coinArtifact);
        

        // console.log("Token bytecode:", coinArtifact.bytecode);
        if (!coinArtifact.bytecode || coinArtifact.bytecode === "0x") {
            throw new Error("Token bytecode is missing or invalid.");
        }

        const tokenFactory = new ethers.ContractFactory(
            coinArtifact.abi,
            coinArtifact.bytecode,
            signer
        );

        // Potentially async operations take place (e.g., ens resolution).
        const tokenTx = await tokenFactory.getDeployTransaction(
            `Cool Coin ${idx}`,
            `CC${idx}`,
            1000
        );

        // console.log("Token transaction data:", tokenTx);
        
        // Notice: there is no AWAIT.
        const sentTokenTx = signer.sendTransaction({
            ...tokenTx,
            nonce: nonce++,
            gasLimit: 1500000,
        });

        txPromises.push(sentTokenTx);


        // 2. Deploy AMM
        ////////////////

        const predictedAddressAMM = ethers.getCreateAddress({
            from: signer.address,
            nonce: nonce,
        });
        console.log("Predicted AMM address: " + predictedAddressAMM);
    
        const AMMArtifact = await hre.artifacts.readArtifact("AMMExchange");

        // console.log(AMMArtifact);

        const ammFactory = new ethers.ContractFactory(
            AMMArtifact.abi,
            AMMArtifact.bytecode,
            signer
        );
        
        // Need to wait a bit for the compilation of bytecode / access file
        // system.
        const ammTx = await ammFactory.getDeployTransaction(
            predictedAddressToken,
            validatorAddress,
            registryAddress
        );

        // console.log(ammTx.data);
        
        // Notice: there is no AWAIT.
        const sentAmmTx = signer.sendTransaction({
            ...ammTx,
            nonce: nonce++,
            gasLimit: 3000000,
        });

        txPromises.push(sentAmmTx);

        // Wait for them to be sent, now we have TransactionResponse objects.
        const transactions = await Promise.all(txPromises);
        
        
        // We wait for all transactions to be mined (maybe in the same block).
        const receipts = await Promise.all(transactions.map((tx) => {
            // console.log(tx);
            return tx.wait()
        }));

        // Log deployed addresses
        const tokenReceipt = receipts[0];
        const ammReceipt = receipts[1];
        console.log(`Token deployed at: ${tokenReceipt.contractAddress}`);
        console.log(`AMM deployed at: ${ammReceipt.contractAddress}`);

        const tokenAddress = tokenReceipt.contractAddress;
        const ammAddress = ammReceipt.contractAddress;

        // Save the addresses so that we can re-use them in the interact.js script.
        // Order matters.
        _saveAddresses([ ammAddress, tokenAddress ], ASS5);


        // Creating the contract instances.

        // Token.
        const coinPath = path.join(__dirname, "../../artifacts/contracts/assignment5/AMMCoin.sol/AMMCoin.json");
        const coinAbi = require(coinPath).abi;
        
        const coinContract = new ethers.Contract(tokenAddress, coinAbi, signer);

        // Registry.
        const registryPath = path.join(__dirname, "../../artifacts/contracts/assignment5/AMMRegistry.sol/AMMRegistry.json");
        const registryAbi = require(registryPath).abi;

        const registryContract = new ethers.Contract(registryAddress, registryAbi, signer);


        // Check contract are deployed correctly.

        const codeTk = await provider.getCode(predictedAddressToken);
        if (codeTk === "0x") {
            throw new Error("Token contract not deployed at predicted address: " + predictedAddressToken);
        }

        
        // Check contract are deployed correctly.
        const codeAMM = await provider.getCode(predictedAddressAMM);
        if (codeAMM === "0x") {
            throw new Error("AMM contract not deployed at predicted address: " + predictedAddressAMM);
        }

        // Interacting with the contracts.

        const balance = await coinContract.balanceOf(signer.address);
        console.log("Coin balance: " + balance.toString());

        console.log("Approving validator to spend coins & Registering AMM...");
        
        // Batching transactions.

        const tx1 = await coinContract.approve(validatorAddress, balance.toString(), { nonce: nonce++ });
        console.log("Sent approve tx:", tx1.hash);

        const tx2 = await registryContract.registerAMM(ammAddress, { nonce: nonce++ });
        console.log("Sent registerAMM tx:", tx2.hash);

        // Wait for all at once
        await Promise.all([
            tx1.wait(),
            tx2.wait()
        ]);

        const allowance = await coinContract.allowance(signer.address, validatorAddress);
        console.log("Allowance for validator: " + allowance.toString());
    
        
    }   

    
    await deployAMM(0);

    await deployAMM(1);


    console.timeEnd('Execution Time');
} 




// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
