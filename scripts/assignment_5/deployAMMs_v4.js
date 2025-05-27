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

    // On-chain validator (Adjust as needed):
    const validatorAddress = _loadAddresses(MAIN_VALIDATOR)[0]; 
    console.log("Validator address: " + validatorAddress);

    const registryAddress = '0xa269147eD50Eb19038d88981Fbe408ac39954FBA';

    console.log("Registry address: " + registryAddress);


    const provider = hre.ethers.provider;


    async function deployToken(artifact, txPromises, nonce, idx) {

        const predictedAddress = ethers.getCreateAddress({
            from: signer.address,
            nonce: nonce,
        });
        console.log("Predicted token address: " + predictedAddress);

        // console.log(artifact);
        

        // console.log("Token bytecode:", artifact.bytecode);
        if (!artifact.bytecode || artifact.bytecode === "0x") {
            throw new Error("Token bytecode is missing or invalid.");
        }

        const tokenFactory = new ethers.ContractFactory(
            artifact.abi,
            artifact.bytecode,
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
            nonce: nonce,
            gasLimit: 1500000,
        });

        txPromises.push(sentTokenTx);

        return predictedAddress;
    }

    async function deployAMM(artifact, txPromises, nonce, tokenAddress) {

        const predictedAddress = ethers.getCreateAddress({
            from: signer.address,
            nonce: nonce,
        });
        console.log("Predicted AMM address: " + predictedAddress);

        // console.log("Token bytecode:", artifact.bytecode);
        if (!artifact.bytecode || artifact.bytecode === "0x") {
            throw new Error("AMM bytecode is missing or invalid.");
        }

        const ammFactory = new ethers.ContractFactory(
            artifact.abi,
            artifact.bytecode,
            signer
        );
        
        // Wait a bit for the compilation of bytecode, if necessary.
        const ammTx = await ammFactory.getDeployTransaction(
            predictedAddress,
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


        return predictedAddress;
    }

    async function deploySystem(idx=0) {

        // Get the nonce for the next transaction.
        // This is needed to predict the address of the token and AMM contracts.

        // Recommended method.
        let nonce = await provider.getTransactionCount(signer.address, "pending")
        // Less reliable.
        let nonce2 = await signer.getNonce();
        // Compare the two.
        console.log("Current nonce: ", nonce, nonce2);


        // Send all transactions fast, collect their promises
        let txPromises = [];


        // 1. Deploy ERC20 tokens
        /////////////////////////

        const coinArtifact = await hre.artifacts.readArtifact("AMMCoin");

        // Two tokens are deployed, so we need to increment the nonce twice.
        // Note: we do await for the compilation of bytecode, if necessary, not for the transaction to be sent.
        const predictedAddressToken1 = await deployToken(coinArtifact, txPromises, nonce++, idx);
        const predictedAddressToken2 = await deployToken(coinArtifact, txPromises, nonce++, idx);

        console.log("Transactions sent: " + txPromises.length);


        // 2. Deploy AMM
        ////////////////
       
        const AMMArtifact = await hre.artifacts.readArtifact("AMMExchange");
 
        // Two tokens are deployed, so we need to increment the nonce twice.
        // Note: we do await for the compilation of bytecode, if necessary, not for the transaction to be sent.
        const predictedAddressAMM1 = await deployAMM(AMMArtifact, txPromises, nonce++, predictedAddressToken1);
        const predictedAddressAMM2 = await deployAMM(AMMArtifact, txPromises, nonce++, predictedAddressToken2);

        console.log("Transactions sent: " + txPromises.length);
        
        // Wait for them to be sent, now we have TransactionResponse objects.
        const transactions = await Promise.all(txPromises);
        
        // console.log(transactions)

        // We wait for all transactions to be mined (maybe in the same block).
        const receipts = await Promise.all(transactions.map((tx) => {
            // console.log(tx);
            return tx.wait()
        }));

        // console.log(receipts)

        // Log deployed addresses
        const tokenReceipt1 = receipts[0];
        const tokenReceipt2 = receipts[1];
        const ammReceipt1 = receipts[2];
        const ammReceipt2 = receipts[3];
        
        const tokenAddress1 = tokenReceipt1.contractAddress;
        const tokenAddress2 = tokenReceipt2.contractAddress;
        const ammAddress1 = ammReceipt1.contractAddress;
        const ammAddress2 = ammReceipt2.contractAddress;

        console.log(`Token 1 deployed at: ${tokenAddress1}`);
        console.log(`Token 2 deployed at: ${tokenAddress2}`);   
        console.log(`AMM 1 deployed at: ${ammAddress1}`);
        console.log(`AMM 2 deployed at: ${ammAddress2}`);

        

        // Save one pair  addresses so that we can re-use them later.
        // Order matters.
        _saveAddresses([ ammAddress1, tokenAddress1 ], ASS5);


        // Creating the contract instances.
        ///////////////////////////////////

        // Token.
        const coinAbi = coinArtifact.abi;
        
        const coinContract1 = new ethers.Contract(predictedAddressToken1, coinAbi, signer);
        const coinContract2 = new ethers.Contract(predictedAddressToken2, coinAbi, signer);

        // Registry.
        const registryArtifact = await hre.artifacts.readArtifact("AMMRegistry");
        const registryAbi = registryArtifact.abi;

        const registryContract = new ethers.Contract(registryAddress, registryAbi, signer);


        // Interacting with the contracts.
        //////////////////////////////////

        // Same in both contracts.
        const balance = await coinContract1.balanceOf(signer.address);
        console.log("Coin balance: " + balance.toString());

        console.log("Approving validator to spend coins & Registering AMM...");
        
        // Batching transactions.

        // Reset promises.
        txPromises = [];

        let tx = coinContract1.approve(validatorAddress, balance.toString(), { nonce: nonce++ });
        console.log("Sent approve 1 tx");
        txPromises.push(tx);

        tx = registryContract.registerAMM(ammAddress1, { nonce: nonce++ });
        console.log("Sent registerAMM 1 tx");
        txPromises.push(tx);

        tx = coinContract2.approve(validatorAddress, balance.toString(), { nonce: nonce++ });
        console.log("Sent approve 2 tx");
        txPromises.push(tx);

        tx = registryContract.registerAMM(ammAddress2, { nonce: nonce++ });
        console.log("Sent registerAMM 2 tx");
        txPromises.push(tx);

        // Wait for them to be sent, now we have TransactionResponse objects.
        const interactTxs = await Promise.all(txPromises);
    
        // We wait for all transactions to be mined (maybe in the same block).
        await Promise.all(interactTxs.map((tx) => tx.wait()));
        
        console.log("All approve/register transactions mined successfully.");

        // Check allowances.
        ////////////////////

        const allowance = await coinContract1.allowance(signer.address, validatorAddress);
        console.log("Allowance for validator (Coin 1): " + allowance.toString());
        
        const allowance2 = await coinContract2.allowance(signer.address, validatorAddress);
        console.log("Allowance for validator (Coin 2): " + allowance2.toString());
 
    }   

    
    await deploySystem(0);

    console.timeEnd('Execution Time');
} 




// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
