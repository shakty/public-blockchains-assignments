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

// Helper function to deploy contracts.
// Notice the use of the spread operator.
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax
const _deploy = async (signer, cName, what="contract", ...args) =>  {
    const Contract = await hre.ethers.getContractFactory(cName, {
        signer: signer,
        gasLimit: 15000000,
    });
    const c = await Contract.deploy(...args);
    console.log(`Deploying ${what}...`);
    await c.waitForDeployment();
    console.log(`Deployed ${what} to ${c.target}`);
    return c.target;
}

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

    // On-chain registry:
    const registryAddress = '0xa269147eD50Eb19038d88981Fbe408ac39954FBA';

    console.log("Registry address: " + registryAddress);

    // Getting the provider.
    const provider = hre.ethers.provider;


    async function deployAMM(idx=0) {

        // 3. Deploying ERC20 token.
        const tokenAddress = await _deploy(
                                        // Parameters for fetching contract.
                                        signer, "AMMCoin", "Token",
                                        // Parameters for ERC20's constructor.
                                        "Cool Coin " + idx, "CC" + idx, 1000);
    

        console.log("Token address: " + tokenAddress);


        // 4. Finally, deploying the AMM.
        const ammAddress = await _deploy(
                                        // Parameters for fetching contract.
                                        signer, 
                                        
                                        "AMMExchange", 
                                        
                                        "AMM",
                                        // Parameters for AMM's constructor.
                                        tokenAddress, 
                                        validatorAddress, 
                                        registryAddress);

        // Save the addresses so that we can re-use them in the interact.js script.
        // Order matters.
        _saveAddresses([ ammAddress, tokenAddress ], ASS5);


        // const [ ammAddress, tokenAddress ] = _loadAddresses(ASS5);
        // console.log("AMM address: " + ammAddress);
        // console.log("Token address: " + tokenAddress);  


        // Creating the contract instances.

        // Token.
        const coinPath = path.join(__dirname, "../../artifacts/contracts/assignment5/AMMCoin.sol/AMMCoin.json");
        const coinAbi = require(coinPath).abi;
        
        const coinContract = new hre.ethers.Contract(tokenAddress, coinAbi, signer);

        // Registry.
        const registryPath = path.join(__dirname, "../../artifacts/contracts/assignment5/AMMRegistry.sol/AMMRegistry.json");
        const registryAbi = require(registryPath).abi;

        const registryContract = new hre.ethers.Contract(registryAddress, registryAbi, signer);
        
        // Interacting with the contracts.

        const balance = await coinContract.balanceOf(signer.address);
        console.log("Coin balance: " + balance.toString());

        console.log("Approving validator to spend coins & Registering AMM...");
        
        // ! Sending transactions without waiting with manual nonce.
        ////////////////////////////////////////////////////////////

        // Get the nonce for the next transaction.
        // This is needed to predict the address of the token and AMM contracts.

        // Recommended method.
        let nonce = await provider.getTransactionCount(signer.address, "pending")
        // Less reliable.
        let nonce2 = await signer.getNonce();
        // Compare the two.
        console.log("Current nonce: ", nonce, nonce2);



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
